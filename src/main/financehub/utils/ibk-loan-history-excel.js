/**
 * IBK 기업뱅킹 — 대출거래내역조회 Excel parser.
 * Filename pattern: `_대출거래내역조회YYYYMMDD.xlsx`. Header row is row 2 (1-based).
 *
 * @module ibk-loan-history-excel
 */

const XLSX = require('xlsx');
const fs = require('fs');

/** 1-based row index of header row */
const HEADER_ROW_1BASED = 2;

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
 * Parse IBK 대출거래내역조회 workbook.
 *
 * @param {string} filePath - .xls / .xlsx
 * @returns {{
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
function parseIbkLoanHistoryExcel(filePath) {
  const warnings = [];
  if (!filePath || !fs.existsSync(filePath)) {
    warnings.push(`File not found: ${filePath}`);
    return { rows: [], warnings };
  }

  const buf = fs.readFileSync(filePath);
  const workbook = XLSX.read(buf, { type: 'buffer', cellDates: true, raw: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    warnings.push('No sheets in workbook');
    return { rows: [], warnings };
  }

  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
  const headerRowIdx = HEADER_ROW_1BASED - 1;
  if (!data[headerRowIdx]) {
    warnings.push(`Header row ${HEADER_ROW_1BASED} missing`);
    return { rows: [], warnings };
  }

  const colMap = buildColMap(data[headerRowIdx]);
  for (const hk of HEADER_KEYS) {
    if (colMap[normalizeHeader(hk)] === undefined) {
      warnings.push(`Missing expected column: ${hk}`);
    }
  }

  const rows = [];
  for (let r = headerRowIdx + 1; r < data.length; r++) {
    const row = data[r];
    if (!row || !Array.isArray(row)) continue;

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

  return { rows, warnings };
}

module.exports = {
  parseIbkLoanHistoryExcel,
  HEADER_ROW_1BASED,
  HEADER_KEYS,
  parseDateCell,
  parseAmount,
  parseRate,
};
