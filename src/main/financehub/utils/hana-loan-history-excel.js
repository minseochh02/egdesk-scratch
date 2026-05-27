/**
 * Hana Bank — 대출거래내역 Excel parser.
 * Filename pattern: `거래내역_YYYYMMDD.xls`.
 *
 * Structure:
 * - Row 4 (0-indexed): '계좌번호 : 213-980073-29742'
 * - Row 8 (0-indexed): Headers
 * - Row 9 (0-indexed): Data starts
 * - Footer: Row where Column C is '합계'
 *
 * @module hana-loan-history-excel
 */

const XLSX = require('xlsx');
const fs = require('fs');

/** 0-indexed row index of account number */
const ACCOUNT_ROW_IDX = 4;
/** 0-indexed row index of header row */
const HEADER_ROW_IDX = 8;

/** Expected Korean headers (normalized: no whitespace). */
const HEADER_KEYS = [
  '거래일',
  '거래내용',
  '통화코드',
  '실행/상환금액',
  '이자',
  '수수료',
  '대출금잔액',
  '부리시작일',
  '부리종료일',
  '이율',
  '거래점',
];

function normalizeHeader(cell) {
  return String(cell ?? '')
    .replace(/\r|\n/g, '')
    .replace(/\s/g, '')
    .trim();
}

/** YYYY-MM-DD or null. Accepts Date, Excel serial, or various string forms. */
function parseDateCell(val) {
  if (val == null || val === '' || val === '0000-00-00') return null;
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

/** Integer KRW won, stripping commas / 원 / spaces. */
function parseAmount(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && !Number.isNaN(val)) return Math.round(val);
  const n = parseInt(String(val).replace(/[,원\s]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

/** Decimal rate (e.g. "5.25" or "5.25%" → 5.25). */
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
 * Parse Hana Bank 대출거래내역 workbook.
 *
 * @param {string} filePath - .xls / .xlsx
 * @returns {{
 *   accountNumber: string | null;
 *   rows: Array<{
 *     transactionDate: string;
 *     description: string | null;
 *     currency: string | null;
 *     amount: number | null;
 *     interest: number | null;
 *     fee: number | null;
 *     balance: number | null;
 *     interestStartDate: string | null;
 *     interestEndDate: string | null;
 *     interestRate: number | null;
 *     branch: string | null;
 *   }>;
 *   warnings: string[];
 * }}
 */
function parseHanaLoanHistoryExcel(filePath) {
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

  // Extract account number and balance from Row 4 (0-indexed)
  let accountNumber = null;
  let headerBalance = null;
  const accountRow = data[ACCOUNT_ROW_IDX];
  if (accountRow) {
    const rowStr = JSON.stringify(accountRow);
    const accMatch = rowStr.match(/계좌번호\s*[:：]\s*([\d-]+)/);
    if (accMatch) {
      accountNumber = accMatch[1];
    }
    const balMatch = rowStr.match(/대출잔액\s*[:：]\s*([\d,]+)/);
    if (balMatch) {
      headerBalance = parseAmount(balMatch[1]);
    }
  }

  if (!accountNumber) {
    warnings.push('Could not find account number in Row 5');
  }

  if (!data[HEADER_ROW_IDX]) {
    warnings.push(`Header row ${HEADER_ROW_IDX + 1} missing`);
    return { accountNumber, headerBalance, rows: [], warnings };
  }

  const colMap = buildColMap(data[HEADER_ROW_IDX]);
  for (const hk of HEADER_KEYS) {
    if (colMap[normalizeHeader(hk)] === undefined) {
      warnings.push(`Missing expected column: ${hk}`);
    }
  }

  const rows = [];
  for (let r = HEADER_ROW_IDX + 1; r < data.length; r++) {
    const row = data[r];
    if (!row || !Array.isArray(row)) continue;

    // Stop if we hit '합계' in Column C (index 2)
    if (normalizeHeader(row[2]) === '합계') {
      break;
    }

    const transactionDate = parseDateCell(cellByHeader(colMap, row, '거래일'));
    if (!transactionDate) continue;

    rows.push({
      transactionDate,
      description: String(cellByHeader(colMap, row, '거래내용') ?? '').trim() || null,
      currency: String(cellByHeader(colMap, row, '통화코드') ?? '').trim() || null,
      amount: parseAmount(cellByHeader(colMap, row, '실행/상환금액')),
      interest: parseAmount(cellByHeader(colMap, row, '이자')),
      fee: parseAmount(cellByHeader(colMap, row, '수수료')),
      balance: parseAmount(cellByHeader(colMap, row, '대출금잔액')),
      interestStartDate: parseDateCell(cellByHeader(colMap, row, '부리시작일')),
      interestEndDate: parseDateCell(cellByHeader(colMap, row, '부리종료일')),
      interestRate: parseRate(cellByHeader(colMap, row, '이율')),
      branch: String(cellByHeader(colMap, row, '거래점') ?? '').trim() || null,
    });
  }

  return { accountNumber, headerBalance, rows, warnings };
}

module.exports = {
  parseHanaLoanHistoryExcel,
  ACCOUNT_ROW_IDX,
  HEADER_ROW_IDX,
  HEADER_KEYS,
  parseDateCell,
  parseAmount,
  parseRate,
};
