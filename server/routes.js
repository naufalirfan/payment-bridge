import express from 'express';
import crypto from 'node:crypto';
import { db } from './db.js';
import { parseMutationPayload } from './parser.js';
import { matchAndProcessMutation, manualMatchMutation } from './matcher.js';
import { getWebhookConfig, generateHmacSignature, dispatchWebhook, retryWebhookLog } from './dispatcher.js';
import { getDokuConfig, verifyDokuNotificationSignature, createDokuCheckoutSession } from './doku.js';

const router = express.Router();

// Helper to auto-expire past-due invoices
function updateExpiredInvoices() {
  try {
    db.prepare("UPDATE invoices SET status = 'EXPIRED' WHERE status = 'PENDING' AND expires_at <= datetime('now')").run();
  } catch (err) {
    console.error('Error auto-expiring invoices:', err);
  }
}

// ----------------------------------------------------
// 1. Inbound Webhook Callback from Payhooks Android
// ----------------------------------------------------
router.post('/callbacks/payhooks', (req, res) => {
  const startTime = Date.now();
  const apiKey = req.headers['x-payhooks-key'];
  const payload = req.body || {};

  const config = getWebhookConfig();

  // Device verification
  let device = null;
  if (apiKey) {
    device = db.prepare('SELECT * FROM devices WHERE secret_key = ? OR id = ?').get(apiKey, payload.device_id || apiKey);
  } else if (payload.device_id) {
    device = db.prepare('SELECT * FROM devices WHERE id = ?').get(payload.device_id);
  }

  // If strict mode is enabled, reject unknown devices
  if (config.strictDeviceMode && !device) {
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized device: Device ID or X-Payhooks-Key is not registered in Payment Bridge.'
    });
  }

  // Update device ping timestamp if device exists
  if (device) {
    db.prepare("UPDATE devices SET last_ping_at = datetime('now') WHERE id = ?").run(device.id);
  } else if (payload.device_id) {
    // Auto-register device if not found (permissive mode)
    db.prepare(`
      INSERT INTO devices (id, name, secret_key, last_ping_at, is_active)
      VALUES (?, ?, ?, datetime('now'), 1)
    `).run(payload.device_id, `Android (${payload.device_id})`, apiKey || 'ph_dev_' + crypto.randomBytes(16).toString('hex'));
  }

  // Fast response within < 50ms as required (< 150ms)
  res.status(200).json({
    status: 'ok',
    message: 'Payload received and queued for matching',
    latency_ms: Date.now() - startTime,
    received_at: new Date().toISOString()
  });

  // Async processing in background
  setImmediate(() => {
    try {
      const parsed = parseMutationPayload(payload);
      matchAndProcessMutation(device ? device.id : payload.device_id || 'PH-AND-01', payload, parsed);
    } catch (err) {
      console.error('[Callback] Error processing mutation in queue:', err);
    }
  });
});

// ----------------------------------------------------
// 2. Inbound Webhook Callback from DOKU Payment Gateway
// ----------------------------------------------------
router.post('/callbacks/doku', (req, res) => {
  try {
    const rawBody = JSON.stringify(req.body);
    const dokuConfig = getDokuConfig();
    const payload = req.body || {};

    // Validate Signature if DOKU secret key is configured
    if (dokuConfig.secretKey) {
      const isValid = verifyDokuNotificationSignature(req.headers, rawBody, dokuConfig.secretKey);
      if (!isValid) {
        console.warn('[DOKU Callback] Invalid DOKU notification signature rejected.');
        return res.status(401).json({ status: 'INVALID_SIGNATURE' });
      }
    }

    const order = payload.order || {};
    const transaction = payload.transaction || {};
    const invoiceNumber = order.invoice_number || payload.invoice_number;
    const paidAmount = order.amount || transaction.amount || 0;
    const channel = payload.channel?.id || payload.payment?.payment_method_type || 'DOKU';

    const transactionStatus = (transaction.status || payload.status || '').toUpperCase();
    const isSuccess = transactionStatus === 'SUCCESS' || transactionStatus === 'SUCCESSFUL' || transactionStatus === 'COMPLETED' || transactionStatus === 'PAID';

    if (!invoiceNumber) {
      return res.status(400).json({ status: 'MISSING_INVOICE_NUMBER' });
    }

    // Find target invoice
    const targetInvoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceNumber);
    if (!targetInvoice) {
      console.warn(`[DOKU Callback] Invoice ${invoiceNumber} not found.`);
      return res.status(200).json({ status: 'INVOICE_NOT_FOUND_ACKNOWLEDGED' });
    }

    if (isSuccess && targetInvoice.status !== 'PAID') {
      // Mark invoice as PAID atomically
      db.prepare("UPDATE invoices SET status = 'PAID' WHERE id = ?").run(targetInvoice.id);

      // Record mutation
      const mutationId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO mutations (id, device_id, raw_payload, amount, sender_name, matched_invoice_id, package_name, app_title, received_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        mutationId,
        'DOKU-GATEWAY',
        rawBody,
        paidAmount || targetInvoice.total_amount,
        targetInvoice.customer_name || 'DOKU Payer',
        targetInvoice.id,
        'com.doku',
        `DOKU (${channel})`
      );

      // Dispatch outbound webhook to merchant server
      setTimeout(async () => {
        try {
          await dispatchWebhook(targetInvoice, {
            package_name: 'com.doku',
            app_title: `DOKU (${channel})`,
            sender_name: targetInvoice.customer_name
          });
        } catch (err) {
          console.error('[DOKU Callback] Error dispatching merchant webhook:', err);
        }
      }, 10);
    }

    // Acknowledge DOKU HTTP notification with 200 OK
    res.status(200).json({ status: 'OK' });
  } catch (err) {
    console.error('[DOKU Callback Exception]', err);
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

// ----------------------------------------------------
// 3. Dashboard Statistics
// ----------------------------------------------------
router.get('/dashboard/stats', (req, res) => {
  try {
    updateExpiredInvoices();

    const todayMutations = db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount 
      FROM mutations 
      WHERE DATE(received_at) = DATE('now')
    `).get();

    const totalInvoices = db.prepare('SELECT COUNT(*) as count FROM invoices').get().count;
    const paidInvoices = db.prepare("SELECT COUNT(*) as count FROM invoices WHERE status = 'PAID'").get().count;
    const pendingInvoices = db.prepare("SELECT COUNT(*) as count FROM invoices WHERE status = 'PENDING'").get().count;
    
    const collectedRevenue = db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as total 
      FROM invoices 
      WHERE status = 'PAID'
    `).get().total;

    const devices = db.prepare('SELECT * FROM devices ORDER BY last_ping_at DESC').all();
    const dokuConfig = getDokuConfig();

    res.json({
      success: true,
      data: {
        today_mutations_count: todayMutations.count,
        today_mutations_amount: todayMutations.total_amount,
        total_invoices: totalInvoices,
        paid_invoices: paidInvoices,
        pending_invoices: pendingInvoices,
        collected_revenue: collectedRevenue,
        devices,
        doku_enabled: dokuConfig.enabled && !!dokuConfig.clientId
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 4. Mutations API
// ----------------------------------------------------
router.get('/mutations', (req, res) => {
  try {
    const { status, search, limit = 100 } = req.query;
    let query = `
      SELECT 
        m.id,
        m.device_id,
        m.raw_payload,
        m.amount,
        m.sender_name,
        m.matched_invoice_id,
        m.package_name,
        m.app_title,
        m.received_at,
        i.customer_name as matched_customer,
        i.total_amount as matched_total_amount,
        i.status as invoice_status
      FROM mutations m
      LEFT JOIN invoices i ON m.matched_invoice_id = i.id
      WHERE 1=1
    `;
    const params = [];

    if (status === 'MATCHED') {
      query += ' AND m.matched_invoice_id IS NOT NULL';
    } else if (status === 'UNMATCHED') {
      query += ' AND m.matched_invoice_id IS NULL';
    }

    if (search) {
      query += ' AND (m.app_title LIKE ? OR m.raw_payload LIKE ? OR m.sender_name LIKE ? OR m.amount LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    query += ' ORDER BY m.received_at DESC LIMIT ?';
    params.push(parseInt(limit, 10));

    const mutations = db.prepare(query).all(...params);
    res.json({ success: true, data: mutations });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/mutations/match-manual', (req, res) => {
  try {
    const { mutation_id, invoice_id } = req.body;
    if (!mutation_id || !invoice_id) {
      return res.status(400).json({ success: false, error: 'mutation_id and invoice_id are required' });
    }
    const result = manualMatchMutation(mutation_id, invoice_id);
    res.json({ success: true, message: 'Mutation successfully matched with invoice', result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 5. Invoices API (Payhooks Transfer & DOKU Checkout)
// ----------------------------------------------------
router.get('/invoices', (req, res) => {
  try {
    updateExpiredInvoices();
    const { status, search } = req.query;
    let query = 'SELECT * FROM invoices WHERE 1=1';
    const params = [];

    if (status && status !== 'ALL') {
      query += ' AND status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (id LIKE ? OR customer_name LIKE ? OR total_amount LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    query += ' ORDER BY created_at DESC';

    const invoices = db.prepare(query).all(...params);
    res.json({ success: true, data: invoices });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/invoices', async (req, res) => {
  try {
    updateExpiredInvoices();
    const { 
      customer_name, 
      customer_email,
      base_amount, 
      gateway = 'MANUAL', // 'MANUAL' or 'DOKU'
      custom_unique_code, 
      expiry_minutes = 1440 
    } = req.body;

    const baseAmt = parseFloat(base_amount);

    if (!baseAmt || baseAmt <= 0) {
      return res.status(400).json({ success: false, error: 'Valid base_amount is required' });
    }

    const invoiceId = `INV-${new Date().toISOString().slice(0, 7).replace('-', '')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const expiresAt = new Date(Date.now() + expiry_minutes * 60 * 1000).toISOString();

    let uniqueCode = 0;
    let totalAmount = baseAmt;
    let paymentMethod = 'MANUAL_TRANSFER';
    let paymentUrl = null;

    if (gateway === 'DOKU') {
      paymentMethod = 'DOKU_CHECKOUT';
      uniqueCode = 0;
      totalAmount = baseAmt;

      // Call DOKU API if keys are configured
      const dokuConfig = getDokuConfig();
      if (dokuConfig.clientId && dokuConfig.secretKey) {
        try {
          const session = await createDokuCheckoutSession({
            invoiceId,
            amount: baseAmt,
            customerName: customer_name,
            customerEmail: customer_email,
            expiryMinutes
          });
          paymentUrl = session.paymentUrl;
        } catch (dokuErr) {
          console.warn('[DOKU Checkout Warning]', dokuErr.message);
          // Still create invoice, paymentUrl remains null or fallback
        }
      }
    } else {
      // Anti-collision logic for Manual Payhooks Transfer
      paymentMethod = 'MANUAL_TRANSFER';
      const usedCodes = db.prepare(`
        SELECT unique_code FROM invoices 
        WHERE status = 'PENDING' AND base_amount = ? AND expires_at > datetime('now')
      `).all(baseAmt).map(r => r.unique_code);

      if (custom_unique_code) {
        const parsedCustom = parseInt(custom_unique_code, 10);
        if (usedCodes.includes(parsedCustom)) {
          return res.status(400).json({
            success: false,
            error: `Kode unik ${parsedCustom} sedang aktif digunakan oleh invoice pending lain dengan nominal yang sama. Gunakan kode lain.`
          });
        }
        uniqueCode = parsedCustom;
      } else {
        const availableCodes = [];
        for (let c = 100; c <= 999; c++) {
          if (!usedCodes.includes(c)) availableCodes.push(c);
        }

        if (availableCodes.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'Seluruh kombinasi kode unik (100-999) untuk nominal ini sedang aktif. Harap tunggu hingga salah satu invoice kedaluwarsa.'
          });
        }

        uniqueCode = availableCodes[Math.floor(Math.random() * availableCodes.length)];
      }

      totalAmount = baseAmt + uniqueCode;
    }

    const insert = db.prepare(`
      INSERT INTO invoices (id, customer_name, customer_email, base_amount, unique_code, total_amount, payment_method, payment_url, status, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, datetime('now'))
    `);

    insert.run(
      invoiceId, 
      customer_name || 'Customer ' + (uniqueCode || 'DOKU'), 
      customer_email || null,
      baseAmt, 
      uniqueCode, 
      totalAmount, 
      paymentMethod,
      paymentUrl,
      expiresAt
    );

    const created = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
    res.json({ success: true, data: created });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 6. DOKU Configuration API
// ----------------------------------------------------
router.get('/doku/config', (req, res) => {
  try {
    const config = getDokuConfig();
    res.json({ success: true, data: config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/doku/config', (req, res) => {
  try {
    const { clientId, secretKey, isProduction, enabled } = req.body;
    const setSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

    if (clientId !== undefined) setSetting.run('doku_client_id', clientId);
    if (secretKey !== undefined) setSetting.run('doku_secret_key', secretKey);
    if (isProduction !== undefined) setSetting.run('doku_is_production', isProduction ? '1' : '0');
    if (enabled !== undefined) setSetting.run('doku_enabled', enabled ? '1' : '0');

    res.json({ success: true, message: 'DOKU configuration updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 7. Device Management API
// ----------------------------------------------------
router.get('/devices', (req, res) => {
  try {
    const devices = db.prepare('SELECT * FROM devices ORDER BY last_ping_at DESC').all();
    res.json({ success: true, data: devices });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/devices', (req, res) => {
  try {
    const { id, name } = req.body;
    if (!id || !name) {
      return res.status(400).json({ success: false, error: 'Device ID and Name are required' });
    }
    const secretKey = 'ph_dev_' + crypto.randomBytes(16).toString('hex');
    db.prepare(`
      INSERT INTO devices (id, name, secret_key, last_ping_at, is_active)
      VALUES (?, ?, ?, datetime('now'), 1)
    `).run(id, name, secretKey);

    res.json({ success: true, data: { id, name, secret_key: secretKey } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/devices/:id/regenerate-key', (req, res) => {
  try {
    const { id } = req.params;
    const newKey = 'ph_dev_' + crypto.randomBytes(16).toString('hex');
    db.prepare('UPDATE devices SET secret_key = ? WHERE id = ?').run(newKey, id);
    res.json({ success: true, new_secret_key: newKey });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/devices/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM devices WHERE id = ?').run(id);
    res.json({ success: true, message: 'Device deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/devices/:id/ping', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("UPDATE devices SET last_ping_at = datetime('now') WHERE id = ?").run(id);
    res.json({ success: true, pinged_at: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 8. Webhook Configuration & Testing API
// ----------------------------------------------------
router.get('/webhooks/config', (req, res) => {
  try {
    const config = getWebhookConfig();
    res.json({ success: true, data: config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/webhooks/config', (req, res) => {
  try {
    const { webhookUrl, webhookSecret, retryAttempts, retryDelaySeconds, strictDeviceMode } = req.body;
    const setSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

    if (webhookUrl !== undefined) setSetting.run('webhook_url', webhookUrl);
    if (webhookSecret !== undefined) setSetting.run('webhook_secret', webhookSecret);
    if (retryAttempts !== undefined) setSetting.run('retry_attempts', retryAttempts.toString());
    if (retryDelaySeconds !== undefined) setSetting.run('retry_delay_seconds', retryDelaySeconds.toString());
    if (strictDeviceMode !== undefined) setSetting.run('strict_device_mode', strictDeviceMode ? '1' : '0');

    res.json({ success: true, message: 'Webhook configuration updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/webhooks/logs', (req, res) => {
  try {
    const logs = db.prepare(`
      SELECT 
        w.id,
        w.invoice_id,
        w.status_code,
        w.response_body,
        w.attempts,
        w.payload,
        w.created_at,
        i.total_amount,
        i.customer_name
      FROM webhook_logs w
      LEFT JOIN invoices i ON w.invoice_id = i.id
      ORDER BY w.created_at DESC
      LIMIT 100
    `).all();
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/webhooks/logs/:id/retry', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await retryWebhookLog(id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/webhooks/test', async (req, res) => {
  try {
    const { test_url, secret_key } = req.body;
    const targetUrl = test_url || getWebhookConfig().webhookUrl;
    const targetSecret = secret_key || getWebhookConfig().webhookSecret;

    const samplePayload = {
      event_id: crypto.randomUUID(),
      event: 'invoice.paid',
      timestamp: Math.floor(Date.now() / 1000),
      data: {
        invoice_id: 'INV-TEST-999',
        customer_name: 'Test Simulator',
        amount: 100000,
        unique_code: 123,
        paid_amount: 100123,
        sender_name: 'Budi Test',
        source_app: 'com.bca',
        paid_at: new Date().toISOString()
      }
    };

    const payloadString = JSON.stringify(samplePayload);
    const signature = generateHmacSignature(payloadString, targetSecret);

    const startTime = Date.now();
    let status = 200;
    let responseText = 'OK';

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Bridge-Signature': signature,
          'User-Agent': 'Payment-Bridge-Test-Runner/1.0'
        },
        body: payloadString
      });
      status = response.status;
      responseText = await response.text();
    } catch (err) {
      status = 502;
      responseText = err.message;
    }

    res.json({
      success: true,
      execution_time_ms: Date.now() - startTime,
      signature,
      status_code: status,
      response_preview: responseText.slice(0, 500),
      sent_payload: samplePayload
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 9. Payhooks Mutation Simulation API
// ----------------------------------------------------
router.post('/simulate/notification', (req, res) => {
  try {
    const { device_id = 'PH-AND-01', package_name = 'com.bca', title = 'BCA Mobile', text = '' } = req.body;
    const rawPayload = {
      device_id,
      package_name,
      title,
      text,
      timestamp: Math.floor(Date.now() / 1000)
    };

    const parsed = parseMutationPayload(rawPayload);
    const result = matchAndProcessMutation(device_id, rawPayload, parsed);

    res.json({
      success: true,
      parsed,
      result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 10. CSV Data Export
// ----------------------------------------------------
router.get('/export/mutations', (req, res) => {
  try {
    const mutations = db.prepare(`
      SELECT 
        m.id,
        m.device_id,
        m.app_title,
        m.amount,
        m.sender_name,
        m.matched_invoice_id,
        m.received_at
      FROM mutations m
      ORDER BY m.received_at DESC
    `).all();

    let csv = 'Mutation ID,Device,Provider,Amount (IDR),Sender,Matched Invoice ID,Received At\n';
    for (const m of mutations) {
      csv += `"${m.id}","${m.device_id || ''}","${m.app_title || ''}",${m.amount},"${m.sender_name || ''}","${m.matched_invoice_id || 'UNMATCHED'}","${m.received_at}"\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=mutations_${new Date().toISOString().slice(0, 10)}.csv`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/export/invoices', (req, res) => {
  try {
    const invoices = db.prepare(`SELECT * FROM invoices ORDER BY created_at DESC`).all();

    let csv = 'Invoice ID,Customer,Base Amount (IDR),Unique Code,Total Amount (IDR),Method,Payment URL,Status,Expires At,Created At\n';
    for (const inv of invoices) {
      csv += `"${inv.id}","${inv.customer_name || ''}",${inv.base_amount},${inv.unique_code},${inv.total_amount},"${inv.payment_method || 'MANUAL'}","${inv.payment_url || ''}","${inv.status}","${inv.expires_at}","${inv.created_at}"\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=invoices_${new Date().toISOString().slice(0, 10)}.csv`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
