/**
 * IBK 기업뱅킹 — 대출 → 대출조회 → 대출계좌조회 → 거래내역조회 → 엑셀파일저장(출력용) parser.
 * Filename pattern: `거래내역조회YYYYMMDD.xlsx`. Header row is row 3 (1-based);
 * rows 1–2 carry title / account-info metadata that we skip.
 *
 * @module ibk-loan-transactions-excel
 */

const XLSX = require('xlsx');
const fs = require('fs');

const HEADER_ROW_1BASED = 3;

const HEADER_KEYS = [
  '거래일자',
  '거래구분',
  '통화구분',
  '거래금액',
  '원금',
  '이자금액',
  '대출잔액',
  '이율(%)',
  '시작일',
  '종료일',
  '상태구분',
];

function normalizeHeader(cell) {
  return String(cell ?? '')
    .replace(/\r|\n/g, '')
    .replace(/\s/g, '')
    .trim();
}

function parseDateCell(val) {
  if (val == null || val === '') return null;
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof val === 'number' && val > 20000) {
    const epoch = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!Number.isNaN(epoch.getTime())) {
      const y = epoch.getUTCFullYear();
      const m = String(epoch.getUTCMonth() + 1).padStart(2, '0');
      const d = String(epoch.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  const s = String(val).trim();
  const digits = s.replace(/\D/g, '');
  if (digits.length >= 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  return null;
}

function parseAmount(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && !Number.isNaN(val)) return Math.round(val);
  const n = parseInt(String(val).replace(/[,원\s]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

function parseRate(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  const n = parseFloat(String(val).replace(/[%\s,]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function buildColMap(headerRow) {
  const map = {};
  if (!headerRow || !Array.isArray(headerRow)) return map;
  headerRow.forEach((cell, idx) => {
    const key = normalizeHeader(cell);
    if (key) map[key] = idx;
  });
  return map;
}

function cellByHeader(colMap, row, headerKo) {
  const idx = colMap[normalizeHeader(headerKo)];
  if (idx === undefined || !row) return undefined;
  return row[idx];
}

/**
 * @param {string} filePath
 * @returns {{
 *   accountNumber: string|null;
 *   headerBalance: number|null;
 *   rows: Array<{
 *     transactionDate: string|null;
 *     transactionType: string|null;
 *     currency: string|null;
 *     transactionAmount: number|null;
 *     principalAmount: number|null;
 *     interestAmount: number|null;
 *     loanBalance: number|null;
 *     interestRate: number|null;
 *     startDate: string|null;
 *     endDate: string|null;
 *     status: string|null;
 *   }>;
 *   warnings: string[];
 * }}
 */
function parseIbkLoanTransactionsExcel(filePath) {
  const warnings = [];
  if (!filePath || !fs.existsSync(filePath)) {
    warnings.push(`File not found: ${filePath}`);
    return { accountNumber: null, rows: [], warnings };
  }

  const buf = fs.readFileSync(filePath);
  const workbook = XLSX.read(buf, { type: 'buffer', cellDates: true, raw: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    warnings.push('No sheets in workbook');
    return { accountNumber: null, rows: [], warnings };
  }

  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });

  // Extract account number and balance from Row 2 (0-indexed index 1)
  let accountNumber = null;
  let headerBalance = null;
  const metadataRow = data[1];
  if (metadataRow) {
    const rowStr = JSON.stringify(metadataRow);
    const accMatch = rowStr.match(/대출계좌번호\s*[:：]\s*([\d-]+)/);
    if (accMatch) {
      accountNumber = accMatch[1];
    }
    const balMatch = rowStr.match(/대출잔액\s*[:：]\s*([\d,]+)/);
    if (balMatch) {
      headerBalance = parseAmount(balMatch[1]);
    }
  }

  const headerRowIdx = HEADER_ROW_1BASED - 1;
  if (!data[headerRowIdx]) {
    warnings.push(`Header row ${HEADER_ROW_1BASED} missing`);
    return { accountNumber, headerBalance, rows: [], warnings };
  }

  const colMap = buildColMap(data[headerRowIdx]);
  for (const hk of HEADER_KEYS) {
    if (colMap[normalizeHeader(hk)] === undefined) {
      warnings.push(`Missing expected column: ${hk}`);
    }
  }

  const str = (v) => {
    if (v == null) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
  };

  const rows = [];
  for (let r = headerRowIdx + 1; r < data.length; r++) {
    const row = data[r];
    if (!row || !Array.isArray(row)) continue;

    // Stop if we hit '합계' in Column B (index 1)
    if (normalizeHeader(row[1]) === '합계') {
      break;
    }

    // Skip rows with no transaction_date — totals/footer rows often have empty
    // first column or summary labels.
    const transactionDate = parseDateCell(cellByHeader(colMap, row, '거래일자'));
    if (!transactionDate) continue;

    const transactionType = str(cellByHeader(colMap, row, '거래구분'));
    if (transactionType === '기간연장') {
      continue;
    }

    rows.push({
      transactionDate,
      transactionType,
      currency: str(cellByHeader(colMap, row, '통화구분')),
      transactionAmount: parseAmount(cellByHeader(colMap, row, '거래금액')),
      principalAmount: parseAmount(cellByHeader(colMap, row, '원금')),
      interestAmount: parseAmount(cellByHeader(colMap, row, '이자금액')),
      loanBalance: parseAmount(cellByHeader(colMap, row, '대출잔액')),
      interestRate: parseRate(cellByHeader(colMap, row, '이율(%)')),
      startDate: parseDateCell(cellByHeader(colMap, row, '시작일')),
      endDate: parseDateCell(cellByHeader(colMap, row, '종료일')),
      status: str(cellByHeader(colMap, row, '상태구분')),
    });
  }

  return { accountNumber, rows, warnings };
}

module.exports = {
  parseIbkLoanTransactionsExcel,
  HEADER_ROW_1BASED,
  HEADER_KEYS,
  parseDateCell,
  parseAmount,
  parseRate,
};
