// ============================================================================
// CARD TRANSACTION MAPPER
// ============================================================================
// Transforms card transaction data to bank transaction format for database storage

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
  } else if (cardTx.approvalDate) {
    // BC Card format: separate approvalDate and approvalTime, or combined approvalDateTime
    date = cardTx.approvalDate;
    time = cardTx.approvalTime || null;

    // If approvalDateTime exists, use that instead
    if (cardTx.approvalDateTime) {
      const parsed = parseCardDateTime(cardTx.approvalDateTime);
      date = parsed.date;
      time = parsed.time;
    }
  }

  // Parse amount from different field names
  const amount = parseInt(cardTx.amount || cardTx.approvalAmount) || 0;

  // Handle cancellations/refunds
  // NH Card: cancellationStatus field
  // BC Card: salesType field (매출종류)
  const cancellationField = cardTx.cancellationStatus || cardTx.salesType || '';
  const isCancelled = cancellationField === '취소' ||
                     (typeof cancellationField === 'string' && cancellationField.includes('취소')) ||
                     cancellationField === '매입취소';

  // Cancelled transactions are refunds (deposits), normal transactions are withdrawals
  const withdrawal = isCancelled ? 0 : amount;
  const deposit = isCancelled ? amount : 0;

  // Prefix type with "취소 -" for cancelled transactions
  const transactionType = cardTx.transactionMethod || cardTx.usageType || '카드결제';
  const type = isCancelled
    ? `취소 - ${transactionType}`
    : transactionType;

  // Store card-specific fields in metadata
  const metadata = {
    cardNumber: cardTx.cardNumber,
    approvalNumber: cardTx.approvalNumber,
    transactionMethod: cardTx.transactionMethod || cardTx.usageType,
    installmentPeriod: cardTx.installmentPeriod,
    cancellationStatus: cardTx.cancellationStatus,
    salesType: cardTx.salesType,
    isCancelled: isCancelled,
    detailLink: cardTx.detailLink,
    xmlData: cardTx.xmlData,
    // BC Card specific fields
    cardHolder: cardTx.cardHolder,
    cardType: cardTx.cardType,
    transactionBank: cardTx.transactionBank,
    exchangeRate: cardTx.exchangeRate,
    foreignAmountKRW: cardTx.foreignAmountKRW,
    // Mark as card transaction for UI filtering
    isCardTransaction: true,
    cardCompanyId: cardCompanyId
  };

  const merchantName = cardTx.merchantName || '';

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
  parseCardDateTime,
  transformCardTransaction,
  transformCardTransactions,
};
