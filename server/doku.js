import crypto from 'node:crypto';
import { db } from './db.js';

export async function getDokuConfig() {
  const getVal = async (k, def = '') => {
    const row = await db.get('SELECT value FROM settings WHERE key = ?', [k]);
    return row ? row.value : def;
  };

  const isProd = (await getVal('doku_is_production', '0')) === '1';

  return {
    enabled: (await getVal('doku_enabled', '1')) === '1',
    clientId: await getVal('doku_client_id', ''),
    secretKey: await getVal('doku_secret_key', ''),
    isProduction: isProd,
    baseUrl: isProd ? 'https://api.doku.com' : 'https://api-sandbox.doku.com'
  };
}

/**
 * Generate DOKU Digest (Base64 of SHA256 of Raw Body)
 */
export function generateDokuDigest(bodyString) {
  return crypto.createHash('sha256').update(bodyString || '', 'utf8').digest('base64');
}

/**
 * Generate DOKU HMAC-SHA256 Signature for API requests & Notification validation
 */
export function generateDokuSignature({ clientId, requestId, requestTimestamp, requestTarget, rawBody, secretKey }) {
  const digest = generateDokuDigest(rawBody || '');
  const signatureComponent = [
    `Client-Id:${clientId}`,
    `Request-Id:${requestId}`,
    `Request-Timestamp:${requestTimestamp}`,
    `Request-Target:${requestTarget}`,
    `Digest:${digest}`
  ].join('\n');

  const hmac = crypto.createHmac('sha256', secretKey).update(signatureComponent, 'utf8').digest('base64');
  return `HMACSHA256=${hmac}`;
}

/**
 * Verify incoming DOKU Webhook Notification signature
 */
export function verifyDokuNotificationSignature(headers, rawBody, secretKey) {
  const incomingClientId = headers['client-id'];
  const incomingRequestId = headers['request-id'];
  const incomingTimestamp = headers['request-timestamp'];
  const incomingSignature = headers['signature'];
  const requestTarget = '/api/v1/callbacks/doku';

  if (!incomingSignature || !incomingClientId || !secretKey) {
    return false;
  }

  const expectedSignature = generateDokuSignature({
    clientId: incomingClientId,
    requestId: incomingRequestId,
    requestTimestamp: incomingTimestamp,
    requestTarget: requestTarget,
    rawBody: rawBody,
    secretKey: secretKey
  });

  return incomingSignature === expectedSignature;
}

/**
 * Create DOKU Checkout Session / Payment URL
 */
export async function createDokuCheckoutSession({ invoiceId, amount, customerName, customerEmail, expiryMinutes = 1440 }) {
  const config = await getDokuConfig();
  if (!config.clientId || !config.secretKey) {
    throw new Error('DOKU Client ID dan Secret Key belum dikonfigurasi di Payment Bridge.');
  }

  const requestId = crypto.randomUUID();
  const requestTimestamp = new Date().toISOString().slice(0, 19) + 'Z';
  const requestTarget = '/checkout/v1/payment';

  const payload = {
    order: {
      invoice_number: invoiceId,
      amount: Math.round(amount),
      callback_url: `${config.baseUrl}/checkout/v1/payment-callback`,
      auto_redirect: true
    },
    payment: {
      payment_due_date: expiryMinutes
    },
    customer: {
      name: customerName || 'Customer',
      email: customerEmail || 'customer@example.com'
    }
  };

  const rawBody = JSON.stringify(payload);
  const signature = generateDokuSignature({
    clientId: config.clientId,
    requestId,
    requestTimestamp,
    requestTarget,
    rawBody,
    secretKey: config.secretKey
  });

  const response = await fetch(`${config.baseUrl}${requestTarget}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Id': config.clientId,
      'Request-Id': requestId,
      'Request-Timestamp': requestTimestamp,
      'Signature': signature
    },
    body: rawBody
  });

  const responseData = await response.json();

  if (!response.ok) {
    const errMsg = responseData?.error?.message || responseData?.message || `DOKU API Error (HTTP ${response.status})`;
    throw new Error(errMsg);
  }

  return {
    paymentUrl: responseData.response?.payment?.url || responseData.payment?.url,
    invoiceNumber: invoiceId,
    rawResponse: responseData
  };
}
