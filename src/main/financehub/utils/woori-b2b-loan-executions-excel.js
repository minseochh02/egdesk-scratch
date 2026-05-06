/**
 * Woori 기업뱅킹 — 전자결제 → B2B대출(협력) → 대출_신청 → 실행내역 Excel parser.
 * Filename pattern: `실행내역조회 YYYYMMDD.xlsx`. Header row is row 2 (1-based).
 *
 * @module woori-b2b-loan-executions-excel
 */

const XLSX = require('xlsx');
const fs = require('fs');

/** 1-based row index of header row */
const HEADER_ROW_1BASED = 2;

/** Expected Korean headers (normalized: no whitespace). 'No.' is the row-index
 *  column and is intentionally not stored. */
const HEADER_KEYS = [
  '채권번호',
  '입금일',
  '신청금액(원)',
  '이자금액(원)',
  '입금금액(원)',
  '판매처',
  '거래번호',
  '접수일',
  '채권만기일',
  '채권금액(원)',
  '대출만기일',
  '대출잔액(원)',
  '대출금리(%)',
];

function normalizeHeader(cell) {
  return String(cell ?? '')
    .replace(/\r|\n/g, '')
    .replace(/\s/g, '')
    .trim();
}

/** YYYY-MM-DD or null. Accepts Date, Excel serial, or various string forms. */
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
 * Parse Woori B2B 대출 실행내역 workbook.
 *
 * @param {string} filePath - .xls / .xlsx
 * @returns {{
 *   rows: Array<{
 *     transactionNumber: string;
 *     receivableNumber: string | null;
 *     vendor: string | null;
 *     receivedDate: string | null;
 *     depositDate: string | null;
 *     receivableMaturityDate: string | null;
 *     loanMaturityDate: string | null;
 *     appliedAmount: number | null;
 *     interestAmount: number | null;
 *     depositAmount: number | null;
 *     receivableAmount: number | null;
 *     loanBalance: number | null;
 *     loanInterestRate: number | null;
 *   }>;
 *   warnings: string[];
 * }}
 */
function parseWooriB2bLoanExecutionsExcel(filePath) {
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

    // 채권번호 is the per-row unique id. 거래번호 is the seller's master contract
    // number and repeats across rows, so we don't filter on it.
    const receivableNumber = String(cellByHeader(colMap, row, '채권번호') ?? '').trim();
    if (!receivableNumber) continue;

    const transactionNumberRaw = cellByHeader(colMap, row, '거래번호');
    const vendorRaw = cellByHeader(colMap, row, '판매처');

    rows.push({
      receivableNumber,
      transactionNumber:
        transactionNumberRaw != null && String(transactionNumberRaw).trim() !== ''
          ? String(transactionNumberRaw).trim()
          : null,
      vendor: vendorRaw != null && String(vendorRaw).trim() !== '' ? String(vendorRaw).trim() : null,
      receivedDate: parseDateCell(cellByHeader(colMap, row, '접수일')),
      depositDate: parseDateCell(cellByHeader(colMap, row, '입금일')),
      receivableMaturityDate: parseDateCell(cellByHeader(colMap, row, '채권만기일')),
      loanMaturityDate: parseDateCell(cellByHeader(colMap, row, '대출만기일')),
      appliedAmount: parseAmount(cellByHeader(colMap, row, '신청금액(원)')),
      interestAmount: parseAmount(cellByHeader(colMap, row, '이자금액(원)')),
      depositAmount: parseAmount(cellByHeader(colMap, row, '입금금액(원)')),
      receivableAmount: parseAmount(cellByHeader(colMap, row, '채권금액(원)')),
      loanBalance: parseAmount(cellByHeader(colMap, row, '대출잔액(원)')),
      loanInterestRate: parseRate(cellByHeader(colMap, row, '대출금리(%)')),
    });
  }

  return { rows, warnings };
}

module.exports = {
  parseWooriB2bLoanExecutionsExcel,
  HEADER_ROW_1BASED,
  HEADER_KEYS,
  parseDateCell,
  parseAmount,
  parseRate,
};
