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
  const { date, time } = parseCardDateTime(cardTx.dateTime);
  const amount = parseInt(cardTx.amount) || 0;

  // Handle cancellations/refunds
  // If cancellationStatus has any value, it's a cancelled transaction (refund)
  const isCancelled = cardTx.cancellationStatus === '취소' ||
                     cardTx.cancellationStatus.includes('취소') ||
                     (cardTx.cancellationStatus && cardTx.cancellationStatus.length > 0);

  // Cancelled transactions are refunds (deposits), normal transactions are withdrawals
  const withdrawal = isCancelled ? 0 : amount;
  const deposit = isCancelled ? amount : 0;

  // Prefix type with "취소 -" for cancelled transactions
  const type = isCancelled
    ? `취소 - ${cardTx.transactionMethod}`
    : cardTx.transactionMethod;

  // Store card-specific fields in metadata
  const metadata = {
    cardNumber: cardTx.cardNumber,
    approvalNumber: cardTx.approvalNumber,
    transactionMethod: cardTx.transactionMethod,
    installmentPeriod: cardTx.installmentPeriod,
    cancellationStatus: cardTx.cancellationStatus,
    isCancelled: isCancelled,
    detailLink: cardTx.detailLink,
    xmlData: cardTx.xmlData,
    // Mark as card transaction for UI filtering
    isCardTransaction: true,
    cardCompanyId: cardCompanyId
  };

  return {
    date: date,
    time: time,
    type: type,
    withdrawal: withdrawal,
    deposit: deposit,
    description: cardTx.merchantName,
    balance: 0,                      // Cards don't track running balance
    branch: null,                    // N/A for cards
    counterparty: cardTx.merchantName,
    transactionId: cardTx.approvalNumber,
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
