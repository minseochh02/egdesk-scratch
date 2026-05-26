/**
 * IBK 기업뱅킹 — 배서내역조회 Excel parser.
 * Filename pattern: `배서내역조회YYYYMMDD.xlsx`. Header row is row 3 (1-based).
 *
 * @module ibk-endorsements-excel
 */

const XLSX = require('xlsx');
const fs = require('fs');

/** 1-based row index of header row */
const HEADER_ROW_1BASED = 3;

/** Expected Korean headers (normalized: no whitespace). */
const HEADER_KEYS = [
  '어음번호',
  '발행업체명',
  '사업자번호',
  '발행일자',
  '만기일자',
  '배서인명',
  '배서인실명번호',
  '처리상태',
  '배서일자',
  '무담보배서여부',
  '배서금지배서여부',
  '보증여부',
  '부도처리일자',
  '최종결제일자',
  '지급은행및점포코드',
  '지급은행및점포명',
  '발행인당좌계좌',
  '배서인입금계좌',
  '분할번호',
  '배서번호',
  '배서금액',
  '배서받으시는분업체명',
  '배서받으시는분실명번호',
  '배서받으시는분입금계좌',
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
 * Parse IBK 배서내역조회 workbook.
 *
 * @param {string} filePath - .xls / .xlsx
 * @returns {{
 *   rows: Array<{
 *     noteNumber: string;
 *     issuerName: string | null;
 *     issuerBizNo: string | null;
 *     issueDate: string | null;
 *     maturityDate: string | null;
 *     endorserName: string | null;
 *     endorserIdNo: string | null;
 *     status: string | null;
 *     endorsementDate: string | null;
 *     unsecuredEndorsement: string | null;
 *     endorsementProhibited: string | null;
 *     guaranteed: string | null;
 *     defaultDate: string | null;
 *     finalPaymentDate: string | null;
 *     paymentBankBranchCode: string | null;
 *     paymentBankBranchName: string | null;
 *     issuerCheckingAccount: string | null;
 *     endorserDepositAccount: string | null;
 *     splitNumber: string | null;
 *     endorsementNumber: string | null;
 *     endorsementAmount: number | null;
 *     endorseeName: string | null;
 *     endorseeIdNo: string | null;
 *     endorseeDepositAccount: string | null;
 *   }>;
 *   warnings: string[];
 * }}
 */
function parseIbkEndorsementsExcel(filePath) {
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

    const noteNumber = String(cellByHeader(colMap, row, '어음번호') ?? '').trim();
    if (!noteNumber) continue;

    rows.push({
      noteNumber,
      issuerName: String(cellByHeader(colMap, row, '발행업체명') ?? '').trim() || null,
      issuerBizNo: String(cellByHeader(colMap, row, '사업자번호') ?? '').trim() || null,
      issueDate: parseDateCell(cellByHeader(colMap, row, '발행일자')),
      maturityDate: parseDateCell(cellByHeader(colMap, row, '만기일자')),
      endorserName: String(cellByHeader(colMap, row, '배서인명') ?? '').trim() || null,
      endorserIdNo: String(cellByHeader(colMap, row, '배서인실명번호') ?? '').trim() || null,
      status: String(cellByHeader(colMap, row, '처리상태') ?? '').trim() || null,
      endorsementDate: parseDateCell(cellByHeader(colMap, row, '배서일자')),
      unsecuredEndorsement: String(cellByHeader(colMap, row, '무담보배서여부') ?? '').trim() || null,
      endorsementProhibited: String(cellByHeader(colMap, row, '배서금지배서여부') ?? '').trim() || null,
      guaranteed: String(cellByHeader(colMap, row, '보증여부') ?? '').trim() || null,
      defaultDate: parseDateCell(cellByHeader(colMap, row, '부도처리일자')),
      finalPaymentDate: parseDateCell(cellByHeader(colMap, row, '최종결제일자')),
      paymentBankBranchCode: String(cellByHeader(colMap, row, '지급은행및점포코드') ?? '').trim() || null,
      paymentBankBranchName: String(cellByHeader(colMap, row, '지급은행및점포명') ?? '').trim() || null,
      issuerCheckingAccount: String(cellByHeader(colMap, row, '발행인당좌계좌') ?? '').trim() || null,
      endorserDepositAccount: String(cellByHeader(colMap, row, '배서인입금계좌') ?? '').trim() || null,
      splitNumber: String(cellByHeader(colMap, row, '분할번호') ?? '').trim() || null,
      endorsementNumber: String(cellByHeader(colMap, row, '배서번호') ?? '').trim() || null,
      endorsementAmount: parseAmount(cellByHeader(colMap, row, '배서금액')),
      endorseeName: String(cellByHeader(colMap, row, '배서받으시는분업체명') ?? '').trim() || null,
      endorseeIdNo: String(cellByHeader(colMap, row, '배서받으시는분실명번호') ?? '').trim() || null,
      endorseeDepositAccount: String(cellByHeader(colMap, row, '배서받으시는분입금계좌') ?? '').trim() || null,
    });
  }

  return { rows, warnings };
}

module.exports = {
  parseIbkEndorsementsExcel,
  HEADER_ROW_1BASED,
  HEADER_KEYS,
  parseDateCell,
  parseAmount,
};
