// ============================================================================
// CARD TRANSACTION MAPPER
// ============================================================================
// Transforms card transaction data to bank transaction format for database storage

/**
 * Clean card number by removing company name prefixes and extra whitespace
 * @param {string} cardNumber - Raw card number
 * @returns {string} Cleaned card number
 */
function cleanCardNumber(cardNumber) {
  if (!cardNumber) return '';

  // Remove common card company prefixes (e.g., "BC카드            V330930" -> "V330930")
  const prefixes = [
    'BC카드',
    'KB국민카드', 'KB카드',
    'NH농협카드', 'NH카드',
    '신한카드',
    '삼성카드',
    '현대카드',
    '롯데카드',
    '하나카드'
  ];

  let cleaned = String(cardNumber);
  for (const prefix of prefixes) {
    cleaned = cleaned.replace(new RegExp(`^${prefix}\\s*`, 'g'), '');
  }

  // Remove extra whitespace and trim
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * Parse card dateTime to separate date and time
 * @param {string} dateTime - '2026/01/19 14:46:51'
 * @returns {{date: string, time: string}}
 */
function parseCardDateTime(dateTime) {
  if (!dateTime) return { date: '', time: null };

  const [datePart, timePart] = dateTime.split(' ');
  const date = datePart.replace(/\//g, '-'); // 2026/01/19 → 2026-01-19
  const time = timePart || null;
  return { date, time };
}

/**
 * Transform card transaction to bank transaction format
 * @param {Object} cardTx - Card transaction from NH Card
 * @param {string} cardAccountId - Account UUID from database (not used directly, handled by caller)
 * @param {string} cardCompanyId - Card company ID ('nh-card')
 * @returns {Object} Transaction in bank format
 */
function transformCardTransaction(cardTx, cardAccountId, cardCompanyId) {
  // Handle different date/time formats
  let date, time;
  if (cardTx.dateTime) {
    // NH Card format: '2026/01/19 14:46:51'
    const parsed = parseCardDateTime(cardTx.dateTime);
    date = parsed.date;
    time = parsed.time;
  } else if (cardTx.transactionDate || cardTx['이용일시']) {
    // Shinhan Card format: '이용일시' -> 'transactionDate'
    const dateTimeValue = cardTx.transactionDate || cardTx['이용일시'];
    const parsed = parseCardDateTime(dateTimeValue);
    date = parsed.date;
    time = parsed.time;
  } else if (cardTx.approvalDate || cardTx['승인일']) {
    // KB Card & BC Card format: separate approvalDate and approvalTime
    date = cardTx.approvalDate || cardTx['승인일'] || '';
    time = cardTx.approvalTime || cardTx['승인시간'] || null;

    // If approvalDateTime exists, use that instead
    if (cardTx.approvalDateTime) {
      const parsed = parseCardDateTime(cardTx.approvalDateTime);
      date = parsed.date;
      time = parsed.time;
    }

    // Format date if needed (YYYYMMDD -> YYYY-MM-DD)
    if (date && date.length === 8 && !date.includes('-')) {
      date = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
    }
  }

  // Parse amount from different field names (check both English and Korean)
  // NH Card: Check for separate cancellation amount field first
  const cancellationAmount = cardTx['취소금액'] || cardTx.cancellationAmount;
  const hasCancellationAmount = cancellationAmount && parseInt(String(cancellationAmount).replace(/[^\d-]/g, '')) !== 0;

  const amountValue = cardTx.amount || cardTx['이용금액'] || cardTx['국내이용금액(원)'] || cardTx.approvalAmount || 0;
  const amount = parseInt(String(amountValue).replace(/[^\d-]/g, '')) || 0;

  // Handle cancellations/refunds
  // NH Card: cancellationStatus field OR 취소금액 field
  // BC Card: salesType field (매출종류)
  // Shinhan Card: transactionType field (이용구분) OR cancellationDate field (취소일자)
  // KB Card: approvalType field (승인구분)
  const cancellationField = cardTx.cancellationStatus || cardTx.salesType || cardTx.transactionType || cardTx.approvalType || cardTx['승인구분'] || '';
  const hasCancellationDate = !!(cardTx.cancellationDate || cardTx['취소일자']);

  const isCancelled = hasCancellationAmount ||
                     hasCancellationDate ||
                     cancellationField === '취소' ||
                     cancellationField === '승인취소' ||
                     cancellationField === '매입취소' ||
                     (typeof cancellationField === 'string' && cancellationField.includes('취소'));

  // Determine the amount to use
  // For NH Card cancellations, use the 취소금액 field instead of 국내이용금액(원)
  const finalAmount = hasCancellationAmount
    ? parseInt(String(cancellationAmount).replace(/[^\d-]/g, '')) || 0
    : amount;

  // Cancelled transactions are refunds (deposits), normal transactions are withdrawals
  // Use absolute value to handle BC Card's negative amounts for cancellations
  const withdrawal = isCancelled ? 0 : Math.abs(finalAmount);
  const deposit = isCancelled ? Math.abs(finalAmount) : 0;

  // Prefix type with "취소 -" for cancelled transactions
  const transactionMethod = cardTx.transactionMethod || cardTx.usageType || cardTx.transactionType || cardTx.paymentMethod || cardTx['결제방법'] || '카드결제';
  const type = isCancelled
    ? `취소 - ${transactionMethod}`
    : transactionMethod;

  // Store card-specific fields in metadata
  const rawCardNumber = cardTx.cardNumber || cardTx.cardUsed || cardTx['이용카드'] || cardTx['카드번호'];
  const metadata = {
    cardNumber: cleanCardNumber(rawCardNumber),
    approvalNumber: cardTx.approvalNumber || cardTx['승인번호'],
    transactionMethod: cardTx.transactionMethod || cardTx.usageType || cardTx.transactionType || cardTx.paymentMethod || cardTx['결제방법'],
    installmentPeriod: cardTx.installmentPeriod || cardTx.installmentMonths || cardTx['할부개월수'],
    cancellationStatus: cardTx.cancellationStatus,
    salesType: cardTx.salesType,
    isCancelled: isCancelled,
    detailLink: cardTx.detailLink,
    xmlData: cardTx.xmlData,
    // BC Card specific fields
    headquartersName: cardTx.headquartersName || cardTx['본부명'],
    cardHolder: cardTx.cardHolder,
    cardType: cardTx.cardType,
    transactionBank: cardTx.transactionBank,
    exchangeRate: cardTx.exchangeRate,
    foreignAmountKRW: cardTx.foreignAmountKRW,
    // Shinhan Card specific fields
    userName: cardTx.userName || cardTx['이용자명'],
    userNumber: cardTx.userNumber || cardTx['이용자번호'],
    virtualCardNumber: cardTx.virtualCardNumber || cardTx['가상카드번호'],
    cancellationDate: cardTx.cancellationDate || cardTx['취소일자'],
    purchaseStatus: cardTx.purchaseStatus || cardTx['매입상태'],
    paymentDueDate: cardTx.paymentDueDate || cardTx['결제예정일'],
    // NH Card specific fields
    receiptDate: cardTx.receiptDate || cardTx['접수년월일'],
    billingDate: cardTx.billingDate || cardTx['결제일'],
    // KB Card specific fields
    departmentNumber: cardTx.departmentNumber || cardTx['부서번호'],
    departmentName: cardTx.departmentName || cardTx['부서명'],
    businessType: cardTx.businessType || cardTx['업종명'],
    vat: cardTx.vat || cardTx['부가세'],
    approvalMethod: cardTx.approvalMethod || cardTx['승인방식'],
    status: cardTx.status || cardTx['상태'],
    taxType: cardTx.taxType || cardTx['과세유형'],
    merchantStatus: cardTx.merchantStatus || cardTx['가맹점상태'],
    merchantNumber: cardTx.merchantNumber || cardTx['가맹점번호'],
    merchantBusinessNumber: cardTx.merchantBusinessNumber || cardTx['가맹점사업자등록번호'],
    representativeName: cardTx.representativeName || cardTx['대표자성명'],
    merchantAddress: cardTx.merchantAddress || cardTx['가맹점주소'],
    merchantPhone: cardTx.merchantPhone || cardTx['가맹점전화번호'],
    // Mark as card transaction for UI filtering
    isCardTransaction: true,
    cardCompanyId: cardCompanyId
  };

  const merchantName = cardTx.merchantName || cardTx['가맹점명'] || cardTx.representativeName || cardTx['대표자성명'] || '';

  return {
    date: date || '',
    time: time,
    type: type,
    withdrawal: withdrawal,
    deposit: deposit,
    description: merchantName,
    balance: 0,                      // Cards don't track running balance
    branch: null,                    // N/A for cards
    counterparty: merchantName,
    transactionId: cardTx.approvalNumber || '',
    metadata: metadata
  };
}

/**
 * Transform multiple card transactions
 * @param {Array} cardTransactions - Array of card transactions
 * @param {string} cardAccountId - Account UUID (not used, handled by DB layer)
 * @param {string} cardCompanyId - Card company ID
 * @returns {Array} Array of transformed transactions
 */
function transformCardTransactions(cardTransactions, cardAccountId, cardCompanyId) {
  return cardTransactions.map(tx => transformCardTransaction(tx, cardAccountId, cardCompanyId));
}

module.exports = {
  cleanCardNumber,
  parseCardDateTime,
  transformCardTransaction,
  transformCardTransactions,
};
