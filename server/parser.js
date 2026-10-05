/**
 * Bank and E-Wallet Notification Parser
 * Extracts transaction amount, transfer type, bank provider, and sender information
 */

export function cleanNominal(rawStr) {
  if (!rawStr) return 0;
  let cleaned = rawStr.toString().trim().replace(/Rp|IDR|\s/gi, '');
  
  if (cleaned.includes('.') && cleaned.includes(',')) {
    if (cleaned.indexOf('.') < cleaned.indexOf(',')) {
      // Format: 150.000,50 -> 150000.50
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // Format: 150,000.50 -> 150000.50
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes('.')) {
    const parts = cleaned.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      // Format: 150.231 or 1.000.000 (Indonesian thousands separator)
      cleaned = cleaned.replace(/\./g, '');
    }
  } else if (cleaned.includes(',')) {
    const parts = cleaned.split(',');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      // Format: 150,231 (English thousands separator)
      cleaned = cleaned.replace(/,/g, '');
    } else {
      cleaned = cleaned.replace(',', '.');
    }
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function extractSender(text) {
  const match = text.match(/(?:dari|pengirim|oleh|customer|dr)\s+([A-Za-z0-9\.\-][A-Za-z0-9\s\.\-]*?)(?=\s+(?:sebesar|ke|rekening|Rp|berhasil|\d|\.|\$)|$)/i);
  if (match) {
    const clean = match[1].trim();
    if (clean.length >= 2 && !clean.toLowerCase().startsWith('rp')) {
      return clean;
    }
  }
  return null;
}

export function parseMutationPayload(payload) {
  const { package_name = '', title = '', text = '' } = payload;
  const fullText = `${title} ${text}`.trim();

  let amount = 0;
  let isCredit = true; // Inbound transfer by default
  let detectedBank = 'Unknown Provider';
  let senderName = null;

  const lowerPkg = package_name.toLowerCase();
  const lowerText = fullText.toLowerCase();

  // Strip out "sisa saldo / saldo akhir" to prevent accidental match on remaining account balance
  const textWithoutBalance = fullText.replace(/(?:sisa\s*saldo|saldo\s*akhir|balance)\s*(?::|adalah|sebesar)?\s*Rp?\.?\s*[\d\.,]+/gi, '');

  // 1. QRIS Payment Detection
  if (lowerText.includes('qris') || lowerPkg.includes('qris') || lowerText.includes('dana bisnis')) {
    detectedBank = 'QRIS Merchant';
    const match = textWithoutBalance.match(/(?:sebesar|nominal|pembayaran|terima|Rp\.?)\s*Rp?\.?\s*([\d\.,]+)/i) ||
                  textWithoutBalance.match(/Rp\s*([\d\.,]+)/i);
    if (match) amount = cleanNominal(match[1]);
    senderName = extractSender(textWithoutBalance);
  }
  // 2. BCA (BCA Mobile / myBCA / Blu)
  else if (lowerPkg.includes('bca') || lowerText.includes('bca')) {
    if (lowerPkg.includes('bcadigital') || lowerText.includes('blu')) {
      detectedBank = 'Blu by BCA';
    } else {
      detectedBank = 'BCA';
    }
    const match = textWithoutBalance.match(/(?:Rp\.?|CR\s*Rp\.?|sebesar\s*Rp\.?|masuk\s*Rp\.?)\s*([\d\.,]+)/i) ||
                  textWithoutBalance.match(/Rp\s*([\d\.,]+)/i);
    if (match) amount = cleanNominal(match[1]);
    senderName = extractSender(textWithoutBalance);
  }
  // 3. Bank Mandiri (Livin' by Mandiri)
  else if (lowerPkg.includes('mandiri') || lowerPkg.includes('bmri') || lowerText.includes('livin')) {
    detectedBank = 'Bank Mandiri';
    const match = textWithoutBalance.match(/(?:Dana\s*masuk|Transfer\s*masuk|sebesar|Rp\.?)\s*Rp?\.?\s*([\d\.,]+)/i);
    if (match) amount = cleanNominal(match[1]);
    senderName = extractSender(textWithoutBalance);
  }
  // 4. Bank BRI (BRImo)
  else if (lowerPkg.includes('bri') || lowerText.includes('brimo')) {
    detectedBank = 'Bank BRI';
    const match = textWithoutBalance.match(/(?:Transfer\s*Masuk|Dana\s*masuk|Rp\.?)\s*([\d\.,]+)/i);
    if (match) amount = cleanNominal(match[1]);
    senderName = extractSender(textWithoutBalance);
  }
  // 5. Bank BNI (wondr by BNI / BNI Mobile)
  else if (lowerPkg.includes('bni') || lowerText.includes('bni') || lowerText.includes('wondr')) {
    detectedBank = 'Bank BNI';
    const match = textWithoutBalance.match(/(?:Transfer\s*masuk|Dana\s*masuk|sebesar|Rp\.?)\s*([\d\.,]+)/i);
    if (match) amount = cleanNominal(match[1]);
    senderName = extractSender(textWithoutBalance);
  }
  // 6. Bank Syariah Indonesia (BSI / BYOND)
  else if (lowerPkg.includes('bsi') || lowerText.includes('bsi') || lowerText.includes('byond')) {
    detectedBank = 'Bank BSI';
    const match = textWithoutBalance.match(/(?:Transfer\s*masuk|Dana\s*masuk|sebesar|Rp\.?)\s*([\d\.,]+)/i);
    if (match) amount = cleanNominal(match[1]);
    senderName = extractSender(textWithoutBalance);
  }
  // 7. SeaBank
  else if (lowerPkg.includes('seabank') || lowerText.includes('seabank')) {
    detectedBank = 'SeaBank';
    const match = textWithoutBalance.match(/(?:Transfer\s*Masuk|Dana\s*Diterima|Menerima|sebesar|Rp\.?)\s*Rp?\.?\s*([\d\.,]+)/i);
    if (match) amount = cleanNominal(match[1]);
    senderName = extractSender(textWithoutBalance);
  }
  // 8. Bank Jago
  else if (lowerPkg.includes('jago') || lowerText.includes('jago')) {
    detectedBank = 'Bank Jago';
    const match = textWithoutBalance.match(/(?:Uang\s*Masuk|menerima\s*uang|sebesar|Rp\.?)\s*Rp?\.?\s*([\d\.,]+)/i);
    if (match) amount = cleanNominal(match[1]);
    senderName = extractSender(textWithoutBalance);
  }
  // 9. Jenius (BTPN)
  else if (lowerPkg.includes('jenius') || lowerPkg.includes('btpn') || lowerText.includes('jenius')) {
    detectedBank = 'Jenius BTPN';
    const match = textWithoutBalance.match(/(?:Uang\s*masuk|In-Out|sebesar|Rp\.?)\s*Rp?\.?\s*([\d\.,]+)/i);
    if (match) amount = cleanNominal(match[1]);
    senderName = extractSender(textWithoutBalance);
  }
  // 10. DANA E-Wallet
  else if (lowerPkg.includes('dana') || lowerText.includes('dana')) {
    detectedBank = 'DANA';
    const match = textWithoutBalance.match(/(?:Isi\s*Saldo|sebesar|terima\s*uang|Rp\.?)\s*Rp?\.?\s*([\d\.,]+)/i);
    if (match) amount = cleanNominal(match[1]);
    senderName = extractSender(textWithoutBalance);
  }
  // 11. OVO E-Wallet
  else if (lowerPkg.includes('ovo') || lowerText.includes('ovo')) {
    detectedBank = 'OVO';
    const match = textWithoutBalance.match(/(?:Top\s*up|sebesar|terima|Rp\.?)\s*Rp?\.?\s*([\d\.,]+)/i);
    if (match) amount = cleanNominal(match[1]);
  }
  // 12. GoPay
  else if (lowerPkg.includes('gojek') || lowerText.includes('gopay')) {
    detectedBank = 'GoPay';
    const match = textWithoutBalance.match(/(?:menerima|sebesar|terima\s*transfer|Rp\.?)\s*Rp?\.?\s*([\d\.,]+)/i);
    if (match) amount = cleanNominal(match[1]);
    senderName = extractSender(textWithoutBalance);
  }
  // 13. ShopeePay
  else if (lowerPkg.includes('shopee') || lowerText.includes('shopeepay')) {
    detectedBank = 'ShopeePay';
    const match = textWithoutBalance.match(/(?:menerima|isi\s*saldo|sebesar|transfer\s*masuk|Rp\.?)\s*Rp?\.?\s*([\d\.,]+)/i);
    if (match) amount = cleanNominal(match[1]);
    senderName = extractSender(textWithoutBalance);
  }
  // 14. LinkAja
  else if (lowerPkg.includes('linkaja') || lowerPkg.includes('mwallet') || lowerText.includes('linkaja')) {
    detectedBank = 'LinkAja';
    const match = textWithoutBalance.match(/(?:terima\s*uang|isi\s*saldo|sebesar|Rp\.?)\s*Rp?\.?\s*([\d\.,]+)/i);
    if (match) amount = cleanNominal(match[1]);
  }
  // Generic Fallback Regex
  else {
    const genericMatch = textWithoutBalance.match(/(?:Rp|IDR)\s*([\d\.,]+)/i) ||
                         textWithoutBalance.match(/(?:sebesar|nominal|masuk)\s*Rp?\.?\s*([\d\.,]+)/i) ||
                         textWithoutBalance.match(/([\d\.,]{4,})/);
    if (genericMatch) {
      amount = cleanNominal(genericMatch[1]);
    }
    senderName = extractSender(textWithoutBalance);
  }

  // Detect if debit (outgoing transaction)
  const debitKeywords = [
    'debit', 'db ', 'transfer ke', 'kirim ke', 'kirim uang ke', 'kamu telah mentransfer',
    'berhasil kirim', 'pembayaran di', 'pembayaran merchant', 'top up ke', 'pembelian',
    'pulsa', 'paket data', 'tagihan', 'tarik tunai', 'biaya admin', 'keluar', 'outbound'
  ];

  for (const kw of debitKeywords) {
    if (lowerText.includes(kw)) {
      isCredit = false;
      break;
    }
  }

  return {
    amount,
    isCredit,
    detectedBank,
    senderName: senderName || null,
    rawText: fullText
  };
}
