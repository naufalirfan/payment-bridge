import express from 'express';
import crypto from 'node:crypto';
import { db } from './db.js';
import { parseMutationPayload } from './parser.js';
import { matchAndProcessMutation, manualMatchMutation } from './matcher.js';
import { getWebhookConfig, generateHmacSignature, dispatchWebhook, retryWebhookLog } from './dispatcher.js';
import { getDokuConfig, verifyDokuNotificationSignature, createDokuCheckoutSession } from './doku.js';
import { hashPassword, generateToken, authMiddleware } from './auth.js';

const router = express.Router();

// Helper to auto-expire past-due invoices
async function updateExpiredInvoices() {
  try {
    await db.run("UPDATE invoices SET status = 'EXPIRED' WHERE status = 'PENDING' AND expires_at <= datetime('now')");
  } catch (err) {
    console.error('Error auto-expiring invoices:', err);
  }
}

// ----------------------------------------------------
// 0. Authentication Routes (Public: login / Protected: me, change-password)
// ----------------------------------------------------
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username dan Password wajib diisi.' });
    }

    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Username atau Password salah.' });
    }

    const hashed = hashPassword(password);
    if (user.password_hash !== hashed) {
      return res.status(401).json({ success: false, error: 'Username atau Password salah.' });
    }

    const token = generateToken(user);
    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await db.get('SELECT id, username, role, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User tidak ditemukan' });
    }
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/auth/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Password lama dan baru wajib diisi.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Password baru minimal 6 karakter.' });
    }

    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!user || user.password_hash !== hashPassword(currentPassword)) {
      return res.status(400).json({ success: false, error: 'Password saat ini salah.' });
    }

    const newHash = hashPassword(newPassword);
    await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user.id]);

    res.json({ success: true, message: 'Password berhasil diubah.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 1. Inbound Webhook Callback from Payhooks Android (Public Webhook)
// ----------------------------------------------------
router.post('/callbacks/payhooks', async (req, res) => {
  const startTime = Date.now();
  const apiKey = req.headers['x-payhooks-key'];
  const payload = req.body || {};

  const config = await getWebhookConfig();

  // Device verification
  let device = null;
  if (apiKey) {
    device = await db.get('SELECT * FROM devices WHERE secret_key = ? OR id = ?', [apiKey, payload.device_id || apiKey]);
  } else if (payload.device_id) {
    device = await db.get('SELECT * FROM devices WHERE id = ?', [payload.device_id]);
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
    await db.run("UPDATE devices SET last_ping_at = datetime('now') WHERE id = ?", [device.id]);
  } else if (payload.device_id) {
    // Auto-register device if not found (permissive mode)
    await db.run(`
      INSERT INTO devices (id, name, secret_key, last_ping_at, is_active)
      VALUES (?, ?, ?, datetime('now'), 1)
    `, [payload.device_id, `Android (${payload.device_id})`, apiKey || 'ph_dev_' + crypto.randomBytes(16).toString('hex')]);
  }

  // Fast response within < 50ms
  res.status(200).json({
    status: 'ok',
    message: 'Payload received and queued for matching',
    latency_ms: Date.now() - startTime,
    received_at: new Date().toISOString()
  });

  // Async processing in background
  setImmediate(async () => {
    try {
      const parsed = parseMutationPayload(payload);
      await matchAndProcessMutation(device ? device.id : payload.device_id || 'PH-AND-01', payload, parsed);
    } catch (err) {
      console.error('[Callback] Error processing mutation in queue:', err);
    }
  });
});

// ----------------------------------------------------
// 2. Inbound Webhook Callback from DOKU Payment Gateway (Public Webhook)
// ----------------------------------------------------
router.post('/callbacks/doku', async (req, res) => {
  try {
    const rawBody = JSON.stringify(req.body);
    const dokuConfig = await getDokuConfig();
    const payload = req.body || {};

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

    if (transactionStatus === 'SUCCESS') {
      const inv = await db.get('SELECT * FROM invoices WHERE id = ?', [invoiceNumber]);
      if (inv && inv.status === 'PENDING') {
        await db.run("UPDATE invoices SET status = 'PAID' WHERE id = ?", [invoiceNumber]);

        const mutationId = 'MUT-DOKU-' + Date.now();
        await db.run(`
          INSERT INTO mutations (
            id, device_id, raw_payload, amount, sender_name, matched_invoice_id, package_name, app_title, received_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `, [
          mutationId,
          'DOKU-GATEWAY',
          rawBody,
          paidAmount,
          inv.customer_name || 'DOKU Customer',
          invoiceNumber,
          'com.doku.gateway',
          `DOKU (${channel})`
        ]);

        await dispatchWebhook({
          invoice_id: invoiceNumber,
          customer_name: inv.customer_name,
          amount: inv.base_amount,
          unique_code: inv.unique_code,
          paid_amount: paidAmount,
          source_app: `doku.${channel.toLowerCase()}`,
          paid_at: new Date().toISOString(),
          matched_type: 'doku_gateway'
        });
      }
    }

    res.status(200).json({ status: 'OK' });
  } catch (err) {
    console.error('[DOKU Callback] Error handling notification:', err);
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

// ----------------------------------------------------
// 3. Dashboard Statistics API
// ----------------------------------------------------
router.get('/dashboard/stats', async (req, res) => {
  try {
    await updateExpiredInvoices();

    const todayMutations = await db.get(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total_amount
      FROM mutations 
      WHERE date(received_at) = date('now')
    `);

    const invoiceStats = await db.get(`
      SELECT 
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END), 0) as paid,
        COALESCE(SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END), 0) as pending,
        COALESCE(SUM(CASE WHEN status = 'PAID' THEN total_amount ELSE 0 END), 0) as collected_revenue
      FROM invoices
    `);

    const activeDevices = await db.all(`
      SELECT id, name, last_ping_at, is_active 
      FROM devices 
      WHERE is_active = 1
    `);

    const recentMutations = await db.all(`
      SELECT m.*, i.customer_name 
      FROM mutations m 
      LEFT JOIN invoices i ON m.matched_invoice_id = i.id 
      ORDER BY m.received_at DESC 
      LIMIT 5
    `);

    res.json({
      success: true,
      data: {
        today_mutations_count: todayMutations?.count || 0,
        today_mutations_amount: todayMutations?.total_amount || 0,
        total_invoices: invoiceStats?.total || 0,
        paid_invoices: invoiceStats?.paid || 0,
        pending_invoices: invoiceStats?.pending || 0,
        collected_revenue: invoiceStats?.collected_revenue || 0,
        devices: activeDevices || [],
        recent_mutations: recentMutations || []
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 4. Mutations API
// ----------------------------------------------------
router.get('/mutations', async (req, res) => {
  try {
    const mutations = await db.all(`
      SELECT 
        m.*,
        i.customer_name,
        i.total_amount as invoice_total,
        i.status as invoice_status
      FROM mutations m
      LEFT JOIN invoices i ON m.matched_invoice_id = i.id
      ORDER BY m.received_at DESC
      LIMIT 200
    `);

    res.json({ success: true, data: mutations });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/mutations/:id/match-manual', async (req, res) => {
  try {
    const { id } = req.params;
    const { invoice_id } = req.body;
    if (!invoice_id) {
      return res.status(400).json({ success: false, error: 'Invoice ID is required' });
    }

    const result = await manualMatchMutation(id, invoice_id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 5. Invoices API
// ----------------------------------------------------
router.get('/invoices', async (req, res) => {
  try {
    await updateExpiredInvoices();
    const invoices = await db.all(`
      SELECT * FROM invoices 
      ORDER BY created_at DESC 
      LIMIT 200
    `);
    res.json({ success: true, data: invoices });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/invoices', async (req, res) => {
  try {
    const { customer_name, customer_email, base_amount, expiry_minutes = 60, payment_method = 'MANUAL_TRANSFER' } = req.body;
    if (!base_amount || isNaN(base_amount) || Number(base_amount) <= 0) {
      return res.status(400).json({ success: false, error: 'Nominal base amount harus berupa angka valid > 0' });
    }

    const invoiceId = 'INV-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000);
    const uniqueCode = Math.floor(1 + Math.random() * 999);
    const totalAmount = Number(base_amount) + uniqueCode;
    const expiresAt = new Date(Date.now() + Number(expiry_minutes) * 60 * 1000).toISOString();

    let paymentUrl = null;
    if (payment_method === 'DOKU_CHECKOUT') {
      try {
        const dokuSession = await createDokuCheckoutSession({
          invoiceId,
          amount: Number(base_amount),
          customerName: customer_name || 'Customer',
          customerEmail: customer_email || 'customer@example.com'
        });
        if (dokuSession && dokuSession.payment_url) {
          paymentUrl = dokuSession.payment_url;
        }
      } catch (dokuErr) {
        console.warn('[Invoice] DOKU session creation skipped:', dokuErr.message);
      }
    }

    await db.run(`
      INSERT INTO invoices (
        id, customer_name, customer_email, base_amount, unique_code, total_amount, payment_method, payment_url, status, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
    `, [
      invoiceId,
      customer_name || 'Pelanggan Umum',
      customer_email || '',
      Number(base_amount),
      uniqueCode,
      totalAmount,
      payment_method,
      paymentUrl,
      expiresAt
    ]);

    const created = await db.get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 6. DOKU Gateway Configuration API
// ----------------------------------------------------
router.get('/doku/config', async (req, res) => {
  try {
    const config = await getDokuConfig();
    res.json({ success: true, data: config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/doku/config', async (req, res) => {
  try {
    const { clientId, secretKey, isProduction, dokuEnabled } = req.body;
    if (clientId !== undefined) await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['doku_client_id', clientId]);
    if (secretKey !== undefined) await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['doku_secret_key', secretKey]);
    if (isProduction !== undefined) await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['doku_is_production', isProduction ? '1' : '0']);
    if (dokuEnabled !== undefined) await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['doku_enabled', dokuEnabled ? '1' : '0']);

    res.json({ success: true, message: 'Konfigurasi DOKU berhasil disimpan' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 7. Devices Management API
// ----------------------------------------------------
router.get('/devices', async (req, res) => {
  try {
    const devices = await db.all('SELECT * FROM devices ORDER BY last_ping_at DESC');
    res.json({ success: true, data: devices });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/devices', async (req, res) => {
  try {
    const { id, name } = req.body;
    if (!id || !name) {
      return res.status(400).json({ success: false, error: 'Device ID and Name are required' });
    }
    const secretKey = 'ph_dev_' + crypto.randomBytes(16).toString('hex');
    await db.run(`
      INSERT INTO devices (id, name, secret_key, last_ping_at, is_active)
      VALUES (?, ?, ?, datetime('now'), 1)
    `, [id, name, secretKey]);

    res.json({ success: true, data: { id, name, secret_key: secretKey } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/devices/:id/regenerate-key', async (req, res) => {
  try {
    const { id } = req.params;
    const newKey = 'ph_dev_' + crypto.randomBytes(16).toString('hex');
    await db.run('UPDATE devices SET secret_key = ? WHERE id = ?', [newKey, id]);
    res.json({ success: true, new_secret_key: newKey });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/devices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.run('DELETE FROM devices WHERE id = ?', [id]);
    res.json({ success: true, message: 'Device deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/devices/:id/ping', async (req, res) => {
  try {
    const { id } = req.params;
    await db.run("UPDATE devices SET last_ping_at = datetime('now') WHERE id = ?", [id]);
    res.json({ success: true, pinged_at: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 8. Webhook Configuration & Testing API
// ----------------------------------------------------
router.get('/webhooks/config', async (req, res) => {
  try {
    const config = await getWebhookConfig();
    res.json({ success: true, data: config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/webhooks/config', async (req, res) => {
  try {
    const { webhookUrl, webhookSecret, retryAttempts, retryDelaySeconds, strictDeviceMode } = req.body;
    if (webhookUrl !== undefined) await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['webhook_url', webhookUrl]);
    if (webhookSecret !== undefined) await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['webhook_secret', webhookSecret]);
    if (retryAttempts !== undefined) await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['retry_attempts', retryAttempts.toString()]);
    if (retryDelaySeconds !== undefined) await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['retry_delay_seconds', retryDelaySeconds.toString()]);
    if (strictDeviceMode !== undefined) await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['strict_device_mode', strictDeviceMode ? '1' : '0']);

    res.json({ success: true, message: 'Webhook configuration updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/webhooks/logs', async (req, res) => {
  try {
    const logs = await db.all(`
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
    `);
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

// ----------------------------------------------------
// 9. Payhooks Mutation Simulation API
// ----------------------------------------------------
router.post('/simulate/notification', async (req, res) => {
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
    const result = await matchAndProcessMutation(device_id, rawPayload, parsed);

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
router.get('/export/mutations', async (req, res) => {
  try {
    const mutations = await db.all(`
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
    `);

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

router.get('/export/invoices', async (req, res) => {
  try {
    const invoices = await db.all(`SELECT * FROM invoices ORDER BY created_at DESC`);

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
