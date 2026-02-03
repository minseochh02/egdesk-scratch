// ============================================================================
// CARD EXPORT MAPPER
// ============================================================================
// Transforms card transaction database records to standardized 15-column export format
// Handles different field availability across card companies (BC, KB, NH, Shinhan)

/**
 * Map transaction with metadata to standardized 15-column export format
 * @param {Object} transaction - Database transaction record
 * @param {Object} accountInfo - Card account information (optional)
 * @returns {Object} Export row with 15 Korean column headers
 */
function mapTransactionToExportRow(transaction, accountInfo = {}) {
  const metadata = typeof transaction.metadata === 'string'
    ? JSON.parse(transaction.metadata || '{}')
    : (transaction.metadata || {});

  const cardCompanyId = metadata.cardCompanyId || transaction.bank_id;

  return {
    '카드사': extractCardCompany(cardCompanyId),
    '본부명': extractHeadquarters(metadata, cardCompanyId),
    '부서명': extractDepartment(metadata, cardCompanyId),
    '카드번호': metadata.cardNumber || '',
    '카드구분': extractCardType(metadata, cardCompanyId, accountInfo),
    '카드소지자': extractCardholder(metadata, cardCompanyId),
    '거래은행': extractTransactionBank(metadata, cardCompanyId),
    '사용구분': extractUsageType(metadata, cardCompanyId),
    '매출종류': metadata.salesType || '일반매출',
    '접수일자/(승인일자)': formatDateForExport(transaction.date),
    '청구일자': extractBillingDate(metadata, cardCompanyId),
    '승인번호': metadata.approvalNumber || '',
    '가맹점명/국가명(도시명)': transaction.description || transaction.counterparty || '',
    '이용금액': formatAmount(transaction.withdrawal, transaction.deposit),
    '(US $)': calculateUSDAmount(metadata),
    '비고': generateNotes(metadata, transaction)
  };
}

/**
 * Extract card company name from ID
 * @param {string} cardCompanyId - Card company identifier
 * @returns {string} Card company name in Korean
 */
function extractCardCompany(cardCompanyId) {
  const cardCompanyNames = {
    'bc-card': 'BC카드',
    'kb-card': 'KB국민카드',
    'nh-card': 'NH농협카드',
    'shinhan-card': '신한카드',
    'samsung-card': '삼성카드',
    'hyundai-card': '현대카드',
    'lotte-card': '롯데카드',
    'hana-card': '하나카드'
  };
  return cardCompanyNames[cardCompanyId] || '';
}

/**
 * Extract headquarters name (BC Card only)
 * @param {Object} metadata - Transaction metadata
 * @param {string} cardCompanyId - Card company identifier
 * @returns {string} Headquarters name or empty string
 */
function extractHeadquarters(metadata, cardCompanyId) {
  if (cardCompanyId === 'bc-card') {
    return metadata.headquartersName || '';
  }
  return '';
}

/**
 * Extract department name (BC Card, KB Card)
 * @param {Object} metadata - Transaction metadata
 * @param {string} cardCompanyId - Card company identifier
 * @returns {string} Department name or empty string
 */
function extractDepartment(metadata, cardCompanyId) {
  if (cardCompanyId === 'bc-card' || cardCompanyId === 'kb-card') {
    return metadata.departmentName || '';
  }
  return '';
}

/**
 * Extract card type/classification
 * @param {Object} metadata - Transaction metadata
 * @param {string} cardCompanyId - Card company identifier
 * @param {Object} accountInfo - Account information
 * @returns {string} Card classification
 */
function extractCardType(metadata, cardCompanyId, accountInfo) {
  // BC Card has explicit cardType field
  if (cardCompanyId === 'bc-card' && metadata.cardType) {
    return metadata.cardType;
  }

  // Default to corporate card
  return '법인';
}

/**
 * Extract cardholder name (different fields per card company)
 * @param {Object} metadata - Transaction metadata
 * @param {string} cardCompanyId - Card company identifier
 * @returns {string} Cardholder name
 */
function extractCardholder(metadata, cardCompanyId) {
  if (cardCompanyId === 'bc-card') {
    return metadata.cardHolder || '';
  }

  if (cardCompanyId === 'kb-card') {
    return metadata.representativeName || '';
  }

  // NH Card, Shinhan Card use userName
  return metadata.userName || '';
}

/**
 * Extract transaction bank (BC Card only)
 * @param {Object} metadata - Transaction metadata
 * @param {string} cardCompanyId - Card company identifier
 * @returns {string} Transaction bank or empty string
 */
function extractTransactionBank(metadata, cardCompanyId) {
  if (cardCompanyId === 'bc-card') {
    return metadata.transactionBank || '';
  }
  return '';
}

/**
 * Extract usage type/classification
 * @param {Object} metadata - Transaction metadata
 * @param {string} cardCompanyId - Card company identifier
 * @returns {string} Usage classification
 */
function extractUsageType(metadata, cardCompanyId) {
  if (cardCompanyId === 'bc-card') {
    return metadata.usageType || '';
  }

  if (cardCompanyId === 'kb-card') {
    return metadata.approvalType || '';
  }

  if (cardCompanyId === 'shinhan-card') {
    return metadata.transactionType || '';
  }

  // NH Card
  return metadata.transactionMethod || '';
}

/**
 * Extract billing date (different per card company)
 * @param {Object} metadata - Transaction metadata
 * @param {string} cardCompanyId - Card company identifier
 * @returns {string} Billing date or empty string
 */
function extractBillingDate(metadata, cardCompanyId) {
  // NH Card has 결제일 field
  if (metadata.billingDate || metadata['결제일']) {
    const billingDate = metadata.billingDate || metadata['결제일'];
    return formatDateForExport(billingDate);
  }

  // Shinhan Card has payment due date
  if (cardCompanyId === 'shinhan-card' && metadata.paymentDueDate) {
    return formatDateForExport(metadata.paymentDueDate);
  }

  // BC/KB Card don't typically provide billing date
  return '';
}

/**
 * Calculate USD amount from foreign transaction data
 * @param {Object} metadata - Transaction metadata
 * @returns {string} USD amount or empty string
 */
function calculateUSDAmount(metadata) {
  if (metadata.exchangeRate && metadata.foreignAmountKRW) {
    const rate = parseFloat(metadata.exchangeRate);
    const krw = parseFloat(metadata.foreignAmountKRW);

    if (!isNaN(rate) && !isNaN(krw) && rate > 0) {
      return (krw / rate).toFixed(2);
    }
  }

  return '';
}

/**
 * Generate notes/remarks from multiple sources
 * @param {Object} metadata - Transaction metadata
 * @param {Object} transaction - Transaction record
 * @returns {string} Combined notes
 */
function generateNotes(metadata, transaction) {
  const notes = [];

  // Cancellation status
  if (metadata.isCancelled) {
    notes.push('취소');
  }

  // Installment information
  const installment = metadata.installmentPeriod;
  if (installment && installment !== '00' && installment !== '0') {
    notes.push(`${installment}개월 할부`);
  }

  // Foreign transaction
  if (metadata.foreignAmountKRW) {
    notes.push('해외결제');
  }

  return notes.join(', ');
}

/**
 * Format amount (negative for refunds)
 * @param {number} withdrawal - Withdrawal amount
 * @param {number} deposit - Deposit amount (refund)
 * @returns {number} Formatted amount
 */
function formatAmount(withdrawal, deposit) {
  // Refunds are stored as deposits, show as negative
  if (deposit > 0) {
    return -deposit;
  }

  return withdrawal || 0;
}

/**
 * Format date for export (YYYYMMDD format)
 * @param {string} dateString - Date string (YYYY-MM-DD or YYYYMMDD)
 * @returns {string} Formatted date (YYYYMMDD)
 */
function formatDateForExport(dateString) {
  if (!dateString) return '';

  // Remove dashes and slashes
  const cleaned = String(dateString).replace(/[-/]/g, '');

  // Ensure it's 8 digits (YYYYMMDD)
  if (cleaned.length === 8) {
    return cleaned;
  }

  return dateString;
}

/**
 * Map multiple transactions to export format
 * @param {Array} transactions - Array of transaction records
 * @param {Object} accountInfo - Account information
 * @returns {Array} Array of export rows
 */
function mapTransactionsToExportRows(transactions, accountInfo = {}) {
  return transactions.map(tx => mapTransactionToExportRow(tx, accountInfo));
}

module.exports = {
  mapTransactionToExportRow,
  mapTransactionsToExportRows,
  extractCardCompany,
  extractHeadquarters,
  extractDepartment,
  extractCardType,
  extractCardholder,
  extractTransactionBank,
  extractUsageType,
  extractBillingDate,
  calculateUSDAmount,
  generateNotes,
  formatAmount,
  formatDateForExport
};
