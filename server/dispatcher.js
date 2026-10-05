import crypto from 'node:crypto';
import { db } from './db.js';

export async function getWebhookConfig() {
  const getVal = async (k, def = '') => {
    const row = await db.get('SELECT value FROM settings WHERE key = ?', [k]);
    return row ? row.value : def;
  };

  return {
    webhookUrl: await getVal('webhook_url', ''),
    webhookSecret: await getVal('webhook_secret', 'default_secret'),
    retryAttempts: parseInt(await getVal('retry_attempts', '3'), 10),
    retryDelaySeconds: parseInt(await getVal('retry_delay_seconds', '5'), 10),
    strictDeviceMode: (await getVal('strict_device_mode', '0')) === '1'
  };
}

export function generateHmacSignature(payloadStr, secretKey) {
  return crypto.createHmac('sha256', secretKey).update(payloadStr).digest('hex');
}

export async function dispatchWebhook(invoice, mutation, isManual = false) {
  const config = await getWebhookConfig();
  if (!config.webhookUrl) {
    console.warn('[Dispatcher] No merchant webhook URL configured.');
    return { success: false, reason: 'No webhook URL configured' };
  }

  const eventId = crypto.randomUUID();
  const outboundPayload = {
    event_id: eventId,
    event: 'invoice.paid',
    timestamp: Math.floor(Date.now() / 1000),
    data: {
      invoice_id: invoice.id,
      customer_name: invoice.customer_name || null,
      amount: invoice.base_amount,
      unique_code: invoice.unique_code,
      paid_amount: invoice.total_amount,
      sender_name: mutation?.sender_name || null,
      source_app: mutation ? mutation.package_name || mutation.app_title || 'manual' : 'manual',
      paid_at: new Date().toISOString(),
      matched_type: isManual ? 'manual' : 'automatic'
    }
  };

  const payloadString = JSON.stringify(outboundPayload);
  const signature = generateHmacSignature(payloadString, config.webhookSecret);
  const logId = crypto.randomUUID();

  let attempt = 0;
  let success = false;
  let lastStatus = 0;
  let lastBody = '';

  const maxAttempts = config.retryAttempts || 3;

  while (attempt < maxAttempts && !success) {
    attempt++;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Bridge-Signature': signature,
          'User-Agent': 'Payment-Bridge-Webhook-Dispatcher/1.0'
        },
        body: payloadString,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      lastStatus = response.status;
      lastBody = await response.text();

      if (response.ok) {
        success = true;
      } else {
        console.warn(`[Dispatcher] Attempt ${attempt} failed with status ${lastStatus}: ${lastBody.slice(0, 100)}`);
      }
    } catch (err) {
      lastStatus = 500;
      lastBody = err.message || 'Connection / Timeout Error';
      console.warn(`[Dispatcher] Attempt ${attempt} exception: ${err.message}`);
    }

    if (!success && attempt < maxAttempts) {
      await new Promise(res => setTimeout(res, (config.retryDelaySeconds || 5) * 1000));
    }
  }

  // Insert log to database
  await db.run(`
    INSERT INTO webhook_logs (id, invoice_id, status_code, response_body, attempts, payload, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `, [
    logId,
    invoice.id,
    lastStatus,
    lastBody.slice(0, 2000),
    attempt,
    payloadString
  ]);

  return {
    logId,
    success,
    statusCode: lastStatus,
    attempts: attempt,
    responseBody: lastBody
  };
}

export async function retryWebhookLog(logId) {
  const log = await db.get('SELECT * FROM webhook_logs WHERE id = ?', [logId]);
  if (!log) throw new Error('Webhook log not found');

  const config = await getWebhookConfig();
  if (!config.webhookUrl) {
    throw new Error('Merchant webhook URL is not configured');
  }

  const payloadString = log.payload;
  const signature = generateHmacSignature(payloadString, config.webhookSecret);

  let status = 500;
  let responseBody = '';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bridge-Signature': signature,
        'User-Agent': 'Payment-Bridge-Webhook-Dispatcher/1.0'
      },
      body: payloadString,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    status = response.status;
    responseBody = await response.text();
  } catch (err) {
    responseBody = err.message || 'Connection / Timeout Error';
  }

  // Update existing log with new attempt count and status
  await db.run(`
    UPDATE webhook_logs 
    SET status_code = ?, response_body = ?, attempts = attempts + 1, created_at = datetime('now')
    WHERE id = ?
  `, [status, responseBody.slice(0, 2000), logId]);

  return {
    id: logId,
    status_code: status,
    response_body: responseBody,
    success: status >= 200 && status < 300
  };
}
