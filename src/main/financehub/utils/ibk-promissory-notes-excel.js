/**
 * IBK 기업뱅킹 — 외상매출채권 Excel export parser.
 * Header row is row 3 (1-based). Column titles match the bank export.
 *
 * @module ibk-promissory-notes-excel
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

/** 1-based row index of header row */
const HEADER_ROW_1BASED = 3;

/** Expected Korean headers (normalized: no whitespace) */
const HEADER_KEYS = [
  '일련번호',
  '어음번호',
  '구매기업명',
  '종류',
  '상태',
  '취소신청여부',
  '현금성여부',
  '채권금액',
  '채권등록일',
  '채권만기일',
  '대출가능일',
  '대출실행여부',
  '대출금액',
  '세금발급일',
  '입금계좌번호',
  '결제일자',
  '압류금액',
  '최초어음금액',
  '압류권자',
  '구매자사업자번호',
  '지급사업장',
];

/**
 * @param {unknown} cell
 * @returns {string}
 */
function normalizeHeader(cell) {
  return String(cell ?? '')
    .replace(/\r|\n/g, '')
    .replace(/\s/g, '')
    .trim();
}

/**
 * @param {unknown} val
 * @returns {string|null} YYYY-MM-DD
 */
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

/**
 * @param {unknown} val
 * @returns {number}
 */
function parseAmount(val) {
  if (val == null || val === '') return 0;
  if (typeof val === 'number' && !Number.isNaN(val)) return Math.round(val);
  const n = parseInt(String(val).replace(/[,원\s]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Map Korean status text to DB CHECK values.
 * IBK 외상매출채권 `상태` column (observed): **활동** = still valid / outstanding, **완제** = paid (settled).
 * **미완제** must be checked before **완제** — otherwise `t.includes('완제')` would misclassify 미완제 as collected.
 * @param {string} text
 * @returns {'active'|'collected'|'dishonored'|'cancelled'|'endorsed'|'discounted'}
 */
function mapStatusToDb(text) {
  const t = String(text || '').trim();
  const pairs = [
    ['부도', 'dishonored'],
    ['취소', 'cancelled'],
    ['배서', 'endorsed'],
    ['할인', 'discounted'],
    ['미완제', 'active'],
    ['추심완료', 'collected'],
    ['결제완료', 'collected'],
    ['만기', 'collected'],
    ['종결', 'collected'],
    ['완결', 'collected'],
    ['완제', 'collected'],
    ['정상', 'active'],
    ['활동', 'active'],
  ];
  for (const [ko, en] of pairs) {
    if (t.includes(ko)) return /** @type {const} */ (en);
  }
  return 'active';
}

/**
 * Build column index map from header row array.
 * @param {unknown[]} headerRow
 * @returns {Record<string, number>}
 */
function buildColMap(headerRow) {
  /** @type {Record<string, number>} */
  const map = {};
  if (!headerRow || !Array.isArray(headerRow)) return map;
  headerRow.forEach((cell, idx) => {
    const key = normalizeHeader(cell);
    if (key) map[key] = idx;
  });
  return map;
}

/**
 * @param {Record<string, number>} colMap
 * @param {unknown[]} row
 * @param {string} headerKo
 * @returns {unknown}
 */
function cellByHeader(colMap, row, headerKo) {
  const key = normalizeHeader(headerKo);
  const idx = colMap[key];
  if (idx === undefined || !row) return undefined;
  return row[idx];
}

/**
 * Parse IBK 외상매출채권 workbook; returns rows ready for DB mapping (received / 매출채권 semantics).
 *
 * @param {string} filePath - .xls / .xlsx
 * @returns {{
 *   rows: Array<{
 *     noteNumber: string;
 *     issuerName: string;
 *     issuerRegistrationNumber: string | null;
 *     amount: number;
 *     issueDate: string;
 *     maturityDate: string;
 *     collectionDate: string | null;
 *     status: string;
 *     category: string | null;
 *     bankBranch: string | null;
 *     memo: string | null;
 *     metadata: Record<string, unknown>;
 *   }>;
 *   warnings: string[];
 * }}
 */
function parseIbkPromissoryNotesExcel(filePath) {
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

    const buyerName = String(cellByHeader(colMap, row, '구매기업명') ?? '').trim() || '(미상)';
    const bizNo = cellByHeader(colMap, row, '구매자사업자번호');
    const issuerRegistrationNumber = bizNo != null && String(bizNo).trim() !== '' ? String(bizNo).trim() : null;

    const amount = parseAmount(cellByHeader(colMap, row, '채권금액'));
    const issueRaw = cellByHeader(colMap, row, '채권등록일');
    const matRaw = cellByHeader(colMap, row, '채권만기일');
    let issueDate = parseDateCell(issueRaw);
    let maturityDate = parseDateCell(matRaw);
    if (!issueDate) issueDate = '1970-01-01';
    if (!maturityDate) maturityDate = issueDate;

    const statusText = String(cellByHeader(colMap, row, '상태') ?? '');
    const status = mapStatusToDb(statusText);

    const payDateRaw = cellByHeader(colMap, row, '결제일자');
    const collectionDate = parseDateCell(payDateRaw);

    const kind = cellByHeader(colMap, row, '종류');
    const category = kind != null && String(kind).trim() !== '' ? String(kind).trim() : null;

    const branch = cellByHeader(colMap, row, '지급사업장');
    const bankBranch = branch != null && String(branch).trim() !== '' ? String(branch).trim() : null;

    const serial = cellByHeader(colMap, row, '일련번호');
    const metadata = {
      source: 'ibk-excel',
      serial: serial != null ? String(serial).trim() : null,
      cancellationRequested: cellByHeader(colMap, row, '취소신청여부'),
      cashLike: cellByHeader(colMap, row, '현금성여부'),
      loanAvailableDate: parseDateCell(cellByHeader(colMap, row, '대출가능일')),
      loanExecuted: cellByHeader(colMap, row, '대출실행여부'),
      loanAmount: parseAmount(cellByHeader(colMap, row, '대출금액')),
      taxIssueDate: parseDateCell(cellByHeader(colMap, row, '세금발급일')),
      depositAccountNumber: cellByHeader(colMap, row, '입금계좌번호'),
      seizureAmount: parseAmount(cellByHeader(colMap, row, '압류금액')),
      originalNoteAmount: parseAmount(cellByHeader(colMap, row, '최초어음금액')),
      seizureClaimant: cellByHeader(colMap, row, '압류권자'),
      rawStatus: statusText,
    };

    rows.push({
      noteNumber,
      issuerName: buyerName,
      issuerRegistrationNumber,
      amount,
      issueDate,
      maturityDate,
      collectionDate,
      status,
      category,
      bankBranch,
      memo: null,
      metadata,
    });
  }

  return { rows, warnings };
}

module.exports = {
  parseIbkPromissoryNotesExcel,
  HEADER_ROW_1BASED,
  HEADER_KEYS,
  mapStatusToDb,
  parseDateCell,
  parseAmount,
};
