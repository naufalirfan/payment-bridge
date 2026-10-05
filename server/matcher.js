import crypto from 'node:crypto';
import { db } from './db.js';
import { dispatchWebhook } from './dispatcher.js';

export async function matchAndProcessMutation(device_id, rawPayload, parsed) {
  const { amount, detectedBank, isCredit, senderName } = parsed;
  const mutationId = crypto.randomUUID();

  // If outgoing transfer or zero amount, store as unmatched mutation
  if (!isCredit || amount <= 0) {
    await db.run(`
      INSERT INTO mutations (id, device_id, raw_payload, amount, sender_name, matched_invoice_id, package_name, app_title, received_at)
      VALUES (?, ?, ?, ?, ?, NULL, ?, ?, datetime('now'))
    `, [
      mutationId,
      device_id,
      JSON.stringify(rawPayload),
      amount,
      senderName || null,
      rawPayload.package_name || null,
      rawPayload.title || detectedBank
    ]);
    return { mutationId, matched: false, invoice: null };
  }

  // Find exact matching pending active invoice
  const matchedInvoice = await db.get(`
    SELECT * FROM invoices 
    WHERE status = 'PENDING' 
      AND total_amount = ? 
      AND expires_at > datetime('now')
    ORDER BY created_at ASC 
    LIMIT 1
  `, [amount]);

  let matchedInvoiceId = null;

  if (matchedInvoice) {
    // Atomic status update to prevent race conditions
    const updateRes = await db.run("UPDATE invoices SET status = 'PAID' WHERE id = ? AND status = 'PENDING'", [matchedInvoice.id]);

    if (updateRes.changes > 0) {
      matchedInvoiceId = matchedInvoice.id;

      // Save mutation record with matched invoice
      await db.run(`
        INSERT INTO mutations (id, device_id, raw_payload, amount, sender_name, matched_invoice_id, package_name, app_title, received_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `, [
        mutationId,
        device_id,
        JSON.stringify(rawPayload),
        amount,
        senderName || null,
        matchedInvoiceId,
        rawPayload.package_name || null,
        rawPayload.title || detectedBank
      ]);

      // Fire webhook dispatch asynchronously
      setTimeout(async () => {
        try {
          await dispatchWebhook(matchedInvoice, {
            package_name: rawPayload.package_name,
            app_title: rawPayload.title || detectedBank,
            sender_name: senderName
          });
        } catch (err) {
          console.error('[Matcher] Error dispatching webhook:', err);
        }
      }, 10);

      return { mutationId, matched: true, invoice: matchedInvoice };
    }
  }

  // Unmatched mutation (or race condition handled)
  await db.run(`
    INSERT INTO mutations (id, device_id, raw_payload, amount, sender_name, matched_invoice_id, package_name, app_title, received_at)
    VALUES (?, ?, ?, ?, ?, NULL, ?, ?, datetime('now'))
  `, [
    mutationId,
    device_id,
    JSON.stringify(rawPayload),
    amount,
    senderName || null,
    rawPayload.package_name || null,
    rawPayload.title || detectedBank
  ]);

  return { mutationId, matched: false, invoice: null };
}

export async function manualMatchMutation(mutationId, invoiceId) {
  const mutation = await db.get('SELECT * FROM mutations WHERE id = ?', [mutationId]);
  if (!mutation) throw new Error('Mutation not found');

  const invoice = await db.get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
  if (!invoice) throw new Error('Invoice not found');

  if (invoice.status === 'PAID') {
    throw new Error('Invoice is already marked as PAID');
  }

  // Atomic update invoice status to PAID
  const updateRes = await db.run("UPDATE invoices SET status = 'PAID' WHERE id = ? AND status = 'PENDING'", [invoiceId]);
  if (updateRes.changes === 0 && invoice.status !== 'PENDING') {
    throw new Error('Invoice status could not be transitioned to PAID');
  }

  // Link mutation
  await db.run('UPDATE mutations SET matched_invoice_id = ? WHERE id = ?', [invoiceId, mutationId]);

  // Trigger outbound webhook
  setTimeout(async () => {
    try {
      await dispatchWebhook(invoice, mutation, true);
    } catch (err) {
      console.error('[ManualMatch] Error dispatching webhook:', err);
    }
  }, 10);

  return { success: true, invoice, mutation };
}
