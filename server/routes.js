import express from 'express';
import crypto from 'node:crypto';
import { db } from './db.js';
import { parseMutationPayload } from './parser.js';
import { matchAndProcessMutation, manualMatchMutation } from './matcher.js';
import { getWebhookConfig, generateHmacSignature, dispatchWebhook, retryWebhookLog } from './dispatcher.js';
import { getDokuConfig, verifyDokuNotificationSignature, createDokuCheckoutSession } from './doku.js';
import { hashPassword, generateToken, authMiddleware, apiKeyMiddleware } from './auth.js';

const router = express.Router();

async function updateExpiredInvoices() {
  try {
    await db.run("UPDATE invoices SET status = 'EXPIRED' WHERE status = 'PENDING' AND expires_at <= datetime('now')");
  } catch (err) {
    console.error('Error auto-expiring invoices:', err);
  }
}

// 0. Auth & Registration
router.post('/auth/register', async (req, res) => {
  try {
    const { name, username, email, password } = req.body;
    if (!username || !password || !email) {
      return res.status(400).json({ success: false, error: 'Nama, username, email, dan password wajib diisi.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password minimal 6 karakter.' });
    }

    const existing = await db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing) {
      return res.status(400).json({ success: false, error: 'Username atau Email sudah terdaftar.' });
    }

    const userId = 'mch_' + crypto.randomBytes(8).toString('hex');
    const apiKey = 'pb_live_' + crypto.randomBytes(16).toString('hex');
    const apiSecret = 'pb_sec_' + crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    await db.run(`
      INSERT INTO users (
        id, username, email, name, password_hash, role, api_key, api_secret, webhook_url, plan, plan_expires_at, invoice_quota, used_quota
      ) VALUES (?, ?, ?, ?, ?, 'merchant', ?, ?, 'https://webhook.site/test-merchant', 'PRO_TRIAL', ?, 500, 0)
    `, [userId, username, email, name || username, hashPassword(password), apiKey, apiSecret, expiresAt]);

    const newUser = await db.get('SELECT id, username, email, name, role, plan, api_key, api_secret, plan_expires_at, invoice_quota, used_quota FROM users WHERE id = ?', [userId]);
    const token = generateToken(newUser);

    res.status(201).json({ success: true, data: { token, user: newUser } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username dan Password wajib diisi.' });
    }

    const user = await db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, username]);
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
          name: user.name || user.username,
          email: user.email || '',
          role: user.role,
          plan: user.plan || 'STARTER',
          api_key: user.api_key,
          api_secret: user.api_secret,
          plan_expires_at: user.plan_expires_at,
          invoice_quota: user.invoice_quota || 500,
          used_quota: user.used_quota || 0
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await db.get('SELECT id, username, name, email, role, plan, api_key, api_secret, webhook_url, plan_expires_at, invoice_quota, used_quota, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ success: false, error: 'User tidak ditemukan' });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/auth/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ success: false, error: 'Password lama dan baru wajib diisi.' });
    if (newPassword.length < 6) return res.status(400).json({ success: false, error: 'Password baru minimal 6 karakter.' });

    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!user || user.password_hash !== hashPassword(currentPassword)) return res.status(400).json({ success: false, error: 'Password saat ini salah.' });

    const newHash = hashPassword(newPassword);
    await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user.id]);
    res.json({ success: true, message: 'Password berhasil diubah.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 1. Merchant Profile, API Keys, & Subscription
router.get('/merchant/profile', authMiddleware, async (req, res) => {
  try {
    const profile = await db.get('SELECT id, username, name, email, role, plan, api_key, api_secret, webhook_url, plan_expires_at, invoice_quota, used_quota, created_at FROM users WHERE id = ?', [req.user.id]);
    res.json({ success: true, data: profile });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/merchant/regenerate-keys', authMiddleware, async (req, res) => {
  try {
    const newApiKey = 'pb_live_' + crypto.randomBytes(16).toString('hex');
    const newApiSecret = 'pb_sec_' + crypto.randomBytes(24).toString('hex');
    await db.run('UPDATE users SET api_key = ?, api_secret = ? WHERE id = ?', [newApiKey, newApiSecret, req.user.id]);
    res.json({ success: true, data: { api_key: newApiKey, api_secret: newApiSecret } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/merchant/webhook-settings', authMiddleware, async (req, res) => {
  try {
    const { webhook_url } = req.body;
    await db.run('UPDATE users SET webhook_url = ? WHERE id = ?', [webhook_url, req.user.id]);
    res.json({ success: true, message: 'Webhook URL merchant berhasil diperbarui.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/merchant/subscribe', authMiddleware, async (req, res) => {
  try {
    const { plan } = req.body;
    const plans = {
      STARTER: { name: 'Starter Plan', price: 49000, quota: 500 },
      PRO: { name: 'Pro Plan', price: 149000, quota: 5000 },
      ENTERPRISE: { name: 'Enterprise Plan', price: 349000, quota: 999999 }
    };
    const targetPlan = plans[plan] || plans.PRO;
    const invoiceId = 'INV-SUB-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000);
    const uniqueCode = Math.floor(1 + Math.random() * 999);
    const totalAmount = targetPlan.price + uniqueCode;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const orderId = 'ORD-' + crypto.randomBytes(6).toString('hex');
    await db.run(`INSERT INTO subscription_orders (id, merchant_id, plan_name, price, status, invoice_id) VALUES (?, ?, ?, ?, 'PENDING', ?)`, [orderId, req.user.id, plan, totalAmount, invoiceId]);

    await db.run(`
      INSERT INTO invoices (
        id, merchant_id, customer_name, customer_email, base_amount, unique_code, total_amount, payment_method, payment_url, status, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [invoiceId, req.user.id, `Langganan ${targetPlan.name} (${req.user.username})`, req.user.email || 'billing@merchant.com', targetPlan.price, uniqueCode, totalAmount, 'MANUAL_TRANSFER', null, 'PENDING', expiresAt]);

    const created = await db.get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    res.json({ success: true, data: { orderId, invoice: created, plan: targetPlan } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. External REST API for Merchants
router.post('/gateway/invoices', apiKeyMiddleware, async (req, res) => {
  try {
    const { customer_name, customer_email, amount, expiry_minutes = 60, payment_method = 'MANUAL_TRANSFER' } = req.body;
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({ success: false, error: 'Nominal amount harus berupa angka valid > 0' });
    }

    const merchant = req.merchant;
    if (merchant.invoice_quota > 0 && merchant.used_quota >= merchant.invoice_quota) {
      return res.status(403).json({ success: false, error: 'Invoice quota exceeded. Silakan upgrade paket langganan Anda.' });
    }

    const invoiceId = 'INV-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000);
    const uniqueCode = Math.floor(1 + Math.random() * 999);
    const totalAmount = Number(amount) + uniqueCode;
    const expiresAt = new Date(Date.now() + Number(expiry_minutes) * 60 * 1000).toISOString();

    let paymentUrl = null;
    if (payment_method === 'DOKU_CHECKOUT') {
      try {
        const dokuSession = await createDokuCheckoutSession({
          invoiceId,
          amount: Number(amount),
          customerName: customer_name || 'Customer',
          customerEmail: customer_email || 'customer@example.com'
        });
        if (dokuSession && dokuSession.paymentUrl) paymentUrl = dokuSession.paymentUrl;
      } catch (dokuErr) {
        console.warn('[External Gateway] DOKU session skipped:', dokuErr.message);
      }
    }

    await db.run(`
      INSERT INTO invoices (
        id, merchant_id, customer_name, customer_email, base_amount, unique_code, total_amount, payment_method, payment_url, status, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [invoiceId, merchant.id, customer_name || 'Pelanggan Toko', customer_email || '', Number(amount), uniqueCode, totalAmount, payment_method, paymentUrl, 'PENDING', expiresAt]);

    await db.run('UPDATE users SET used_quota = used_quota + 1 WHERE id = ?', [merchant.id]);

    const created = await db.get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    res.status(201).json({
      success: true,
      data: {
        invoice_id: created.id,
        customer_name: created.customer_name,
        base_amount: created.base_amount,
        unique_code: created.unique_code,
        total_amount: created.total_amount,
        payment_method: created.payment_method,
        payment_url: created.payment_url,
        status: created.status,
        expires_at: created.expires_at,
        created_at: created.created_at
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Inbound Webhook Callbacks
router.post('/callbacks/payhooks', async (req, res) => {
  const startTime = Date.now();
  const apiKey = req.headers['x-payhooks-key'];
  const payload = req.body || {};
  const config = await getWebhookConfig();

  let device = null;
  if (apiKey) {
    device = await db.get('SELECT * FROM devices WHERE secret_key = ? OR id = ?', [apiKey, payload.device_id || apiKey]);
  } else if (payload.device_id) {
    device = await db.get('SELECT * FROM devices WHERE id = ?', [payload.device_id]);
  }

  if (config.strictDeviceMode && !device) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized device.' });
  }

  if (device) {
    await db.run("UPDATE devices SET last_ping_at = datetime('now') WHERE id = ?", [device.id]);
  } else if (payload.device_id) {
    await db.run(`
      INSERT INTO devices (id, name, secret_key, last_ping_at, is_active, merchant_id)
      VALUES (?, ?, ?, datetime('now'), 1, 'usr_admin_01')
    `, [payload.device_id, `Android (${payload.device_id})`, apiKey || 'ph_dev_' + crypto.randomBytes(16).toString('hex')]);
  }

  res.status(200).json({ status: 'ok', message: 'Payload received and queued', latency_ms: Date.now() - startTime, received_at: new Date().toISOString() });

  setImmediate(async () => {
    try {
      const parsed = parseMutationPayload(payload);
      await matchAndProcessMutation(device ? device.id : payload.device_id || 'PH-AND-01', payload, parsed, device?.merchant_id);
    } catch (err) {
      console.error('[Callback] Error processing mutation:', err);
    }
  });
});

router.post('/callbacks/doku', async (req, res) => {
  try {
    const rawBody = JSON.stringify(req.body);
    const dokuConfig = await getDokuConfig();
    const payload = req.body || {};

    if (dokuConfig.secretKey) {
      const isValid = verifyDokuNotificationSignature(req.headers, rawBody, dokuConfig.secretKey);
      if (!isValid) return res.status(401).json({ status: 'INVALID_SIGNATURE' });
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
            id, device_id, merchant_id, raw_payload, amount, sender_name, matched_invoice_id, package_name, app_title, received_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `, [mutationId, 'DOKU-GATEWAY', inv.merchant_id || 'usr_admin_01', rawBody, paidAmount, inv.customer_name || 'DOKU Customer', invoiceNumber, 'com.doku.gateway', `DOKU (${channel})`]);

        await dispatchWebhook({
          invoice_id: invoiceNumber,
          customer_name: inv.customer_name,
          amount: inv.base_amount,
          unique_code: inv.unique_code,
          paid_amount: paidAmount,
          source_app: `doku.${channel.toLowerCase()}`,
          paid_at: new Date().toISOString(),
          matched_type: 'doku_gateway',
          merchant_id: inv.merchant_id
        });
      }
    }
    res.status(200).json({ status: 'OK' });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

// 4. Dashboard Stats
router.get('/dashboard/stats', authMiddleware, async (req, res) => {
  try {
    await updateExpiredInvoices();
    const merchantId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    const whereClause = isAdmin ? '' : "WHERE merchant_id = '" + merchantId + "'";
    const mutWhere = isAdmin ? "WHERE date(received_at) = date('now')" : "WHERE merchant_id = '" + merchantId + "' AND date(received_at) = date('now')";

    const todayMutations = await db.get(`SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount FROM mutations ${mutWhere}`);
    const invoiceStats = await db.get(`
      SELECT 
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END), 0) as paid,
        COALESCE(SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END), 0) as pending,
        COALESCE(SUM(CASE WHEN status = 'PAID' THEN total_amount ELSE 0 END), 0) as collected_revenue
      FROM invoices ${whereClause}
    `);
    const activeDevices = await db.all(`SELECT id, name, last_ping_at, is_active FROM devices ${whereClause ? whereClause + ' AND is_active = 1' : 'WHERE is_active = 1'}`);
    const recentMutations = await db.all(`SELECT m.*, i.customer_name FROM mutations m LEFT JOIN invoices i ON m.matched_invoice_id = i.id ${whereClause ? "WHERE m.merchant_id = '" + merchantId + "'" : ''} ORDER BY m.received_at DESC LIMIT 5`);
    const merchantProfile = await db.get('SELECT plan, invoice_quota, used_quota, plan_expires_at, api_key, api_secret, webhook_url FROM users WHERE id = ?', [merchantId]);

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
        recent_mutations: recentMutations || [],
        plan_info: merchantProfile || {}
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Mutations & Invoices
router.get('/mutations', authMiddleware, async (req, res) => {
  try {
    const merchantId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    const where = isAdmin ? '' : "WHERE m.merchant_id = '" + merchantId + "'";
    const mutations = await db.all(`SELECT m.*, i.customer_name, i.total_amount as invoice_total, i.status as invoice_status FROM mutations m LEFT JOIN invoices i ON m.matched_invoice_id = i.id ${where} ORDER BY m.received_at DESC LIMIT 200`);
    res.json({ success: true, data: mutations });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/mutations/:id/match-manual', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { invoice_id } = req.body;
    if (!invoice_id) return res.status(400).json({ success: false, error: 'Invoice ID is required' });
    const result = await manualMatchMutation(id, invoice_id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/invoices', authMiddleware, async (req, res) => {
  try {
    await updateExpiredInvoices();
    const merchantId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    const where = isAdmin ? '' : "WHERE merchant_id = '" + merchantId + "'";
    const invoices = await db.all(`SELECT * FROM invoices ${where} ORDER BY created_at DESC LIMIT 200`);
    res.json({ success: true, data: invoices });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/invoices', authMiddleware, async (req, res) => {
  try {
    const { customer_name, customer_email, base_amount, expiry_minutes = 60, payment_method = 'MANUAL_TRANSFER' } = req.body;
    if (!base_amount || isNaN(base_amount) || Number(base_amount) <= 0) return res.status(400).json({ success: false, error: 'Nominal base amount harus > 0' });

    const invoiceId = 'INV-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000);
    const uniqueCode = Math.floor(1 + Math.random() * 999);
    const totalAmount = Number(base_amount) + uniqueCode;
    const expiresAt = new Date(Date.now() + Number(expiry_minutes) * 60 * 1000).toISOString();

    let paymentUrl = null;
    if (payment_method === 'DOKU_CHECKOUT') {
      try {
        const dokuSession = await createDokuCheckoutSession({ invoiceId, amount: Number(base_amount), customerName: customer_name || 'Customer', customerEmail: customer_email || 'customer@example.com' });
        if (dokuSession && dokuSession.paymentUrl) paymentUrl = dokuSession.paymentUrl;
      } catch (dokuErr) {
        console.warn('[Invoice] DOKU session skipped:', dokuErr.message);
      }
    }

    await db.run(`
      INSERT INTO invoices (
        id, merchant_id, customer_name, customer_email, base_amount, unique_code, total_amount, payment_method, payment_url, status, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [invoiceId, req.user.id, customer_name || 'Pelanggan Umum', customer_email || '', Number(base_amount), uniqueCode, totalAmount, payment_method, paymentUrl, 'PENDING', expiresAt]);

    await db.run('UPDATE users SET used_quota = used_quota + 1 WHERE id = ?', [req.user.id]);
    const created = await db.get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Devices & DOKU
router.get('/devices', authMiddleware, async (req, res) => {
  try {
    const merchantId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    const where = isAdmin ? '' : "WHERE merchant_id = '" + merchantId + "'";
    const devices = await db.all(`SELECT * FROM devices ${where} ORDER BY last_ping_at DESC`);
    res.json({ success: true, data: devices });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/devices', authMiddleware, async (req, res) => {
  try {
    const { id, name } = req.body;
    if (!id || !name) return res.status(400).json({ success: false, error: 'Device ID and Name are required' });
    const secretKey = 'ph_dev_' + crypto.randomBytes(16).toString('hex');
    await db.run(`INSERT INTO devices (id, name, secret_key, last_ping_at, is_active, merchant_id) VALUES (?, ?, ?, datetime('now'), 1, ?)`, [id, name, secretKey, req.user.id]);
    res.json({ success: true, data: { id, name, secret_key: secretKey } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/devices/:id/regenerate-key', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const newKey = 'ph_dev_' + crypto.randomBytes(16).toString('hex');
    await db.run('UPDATE devices SET secret_key = ? WHERE id = ? AND merchant_id = ?', [newKey, id, req.user.id]);
    res.json({ success: true, new_secret_key: newKey });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/devices/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await db.run('DELETE FROM devices WHERE id = ? AND merchant_id = ?', [id, req.user.id]);
    res.json({ success: true, message: 'Device deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/devices/:id/ping', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await db.run("UPDATE devices SET last_ping_at = datetime('now') WHERE id = ?", [id]);
    res.json({ success: true, pinged_at: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/doku/config', authMiddleware, async (req, res) => {
  try {
    const config = await getDokuConfig();
    res.json({ success: true, data: config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/doku/config', authMiddleware, async (req, res) => {
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

// 7. Webhooks
router.get('/webhooks/config', authMiddleware, async (req, res) => {
  try {
    const merchant = await db.get('SELECT webhook_url, api_secret FROM users WHERE id = ?', [req.user.id]);
    const config = await getWebhookConfig();
    res.json({ success: true, data: { ...config, webhookUrl: merchant?.webhook_url || config.webhookUrl, webhookSecret: merchant?.api_secret || config.webhookSecret } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/webhooks/config', authMiddleware, async (req, res) => {
  try {
    const { webhookUrl } = req.body;
    if (webhookUrl !== undefined) await db.run('UPDATE users SET webhook_url = ? WHERE id = ?', [webhookUrl, req.user.id]);
    res.json({ success: true, message: 'Webhook configuration updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/webhooks/logs', authMiddleware, async (req, res) => {
  try {
    const merchantId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    const where = isAdmin ? '' : "WHERE w.merchant_id = '" + merchantId + "'";
    const logs = await db.all(`SELECT w.*, i.total_amount, i.customer_name FROM webhook_logs w LEFT JOIN invoices i ON w.invoice_id = i.id ${where} ORDER BY w.created_at DESC LIMIT 100`);
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/webhooks/logs/:id/retry', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await retryWebhookLog(id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/webhooks/test', authMiddleware, async (req, res) => {
  try {
    const { test_url, secret_key } = req.body;
    const merchant = await db.get('SELECT webhook_url, api_secret FROM users WHERE id = ?', [req.user.id]);
    const targetUrl = test_url || merchant?.webhook_url || (await getWebhookConfig()).webhookUrl;
    const targetSecret = secret_key || merchant?.api_secret || (await getWebhookConfig()).webhookSecret;

    const samplePayload = {
      event_id: crypto.randomUUID(),
      event: 'invoice.paid',
      timestamp: Math.floor(Date.now() / 1000),
      data: { invoice_id: 'INV-TEST-999', customer_name: 'Test Simulator', amount: 100000, unique_code: 123, paid_amount: 100123, sender_name: 'Budi Test', source_app: 'com.bca', paid_at: new Date().toISOString() }
    };

    const payloadString = JSON.stringify(samplePayload);
    const signature = generateHmacSignature(payloadString, targetSecret);
    const startTime = Date.now();
    let status = 200;
    let responseText = 'OK';

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Bridge-Signature': signature, 'User-Agent': 'Payment-Bridge-Test-Runner/1.0' },
        body: payloadString
      });
      status = response.status;
      responseText = await response.text();
    } catch (err) {
      status = 502;
      responseText = err.message;
    }

    res.json({ success: true, execution_time_ms: Date.now() - startTime, signature, status_code: status, response_preview: responseText.slice(0, 500), sent_payload: samplePayload });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/simulate/notification', authMiddleware, async (req, res) => {
  try {
    const { device_id = 'PH-AND-01', package_name = 'com.bca', title = 'BCA Mobile', text = '' } = req.body;
    const rawPayload = { device_id, package_name, title, text, timestamp: Math.floor(Date.now() / 1000) };
    const parsed = parseMutationPayload(rawPayload);
    const result = await matchAndProcessMutation(device_id, rawPayload, parsed, req.user.id);
    res.json({ success: true, parsed, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

