/**
 * IBK 기업뱅킹 — 외화거래내역조회 Excel parser.
 *
 * Excel layout:
 *   Row 0: Title "거래내역조회_외환"
 *   Row 1: Metadata (계좌번호, 예금주명, 조회기간 — all in one merged cell)
 *   Row 2: Header — [" ", "거래일시", "통화", "입금", "출금", "거래후잔액", "적요", "수출계좌번호", "해외수입업자"]
 *   Row 3+: Data rows
 *   Last row: "합계" summary (stop here)
 */

const XLSX = require('xlsx');
const fs = require('fs');

function parseAmount(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  const n = parseFloat(String(val).replace(/[,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function normalizeHeader(cell) {
  return String(cell ?? '')
    .replace(/\r|\n/g, '')
    .replace(/\s/g, '')
    .trim();
}

/**
 * @param {string} filePath
 * @returns {{ accountNumber: string|null, rows: object[], warnings: string[] }}
 */
function parseIbkForeignCurrencyExcel(filePath) {
  const warnings = [];
  if (!filePath || !fs.existsSync(filePath)) {
    warnings.push(`File not found: ${filePath}`);
    return { accountNumber: null, rows: [], warnings };
  }

  const buf = fs.readFileSync(filePath);
  const workbook = XLSX.read(buf, { type: 'buffer', cellDates: false, raw: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    warnings.push('No sheets in workbook');
    return { accountNumber: null, rows: [], warnings };
  }

  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });

  // Extract account number from row 1 metadata cell
  let accountNumber = null;
  if (data[1]) {
    const metaStr = String(data[1][0] ?? '');
    const accMatch = metaStr.match(/계좌번호[:：]\s*([\d-]+)/);
    if (accMatch) accountNumber = accMatch[1].trim();
  }

  // Find header row — look for "거래일시"
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(data.length, 8); i++) {
    const row = data[i];
    if (!row) continue;
    if (row.some((c) => normalizeHeader(c) === '거래일시')) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) {
    warnings.push('Could not find header row (expected "거래일시")');
    return { accountNumber, rows: [], warnings };
  }

  // Build column index map from header row
  const colMap = {};
  (data[headerRowIdx] || []).forEach((cell, idx) => {
    const key = normalizeHeader(cell);
    if (key) colMap[key] = idx;
  });

  const rows = [];

  for (let r = headerRowIdx + 1; r < data.length; r++) {
    const row = data[r];
    if (!row || !Array.isArray(row)) continue;

    // Stop at 합계 summary row
    if (row.some((c) => normalizeHeader(c) === '합계')) break;

    const datetimeRaw = String(row[colMap['거래일시']] ?? '').trim();
    if (!datetimeRaw) continue;

    // Normalize datetime: "2026-05-07 12:10:41" → keep as-is
    const datetime = datetimeRaw.replace(/\//g, '-');

    const credit = parseAmount(row[colMap['입금']]);
    const debit = parseAmount(row[colMap['출금']]);
    const balance = parseAmount(row[colMap['거래후잔액']]);
    const currency = String(row[colMap['통화']] ?? '').trim() || null;
    const memo = String(row[colMap['적요']] ?? '').trim() || null;
    const exportAccountNumber = String(row[colMap['수출계좌번호']] ?? '').trim() || null;
    const foreignBuyer = String(row[colMap['해외수입업자']] ?? '').trim() || null;

    rows.push({
      transactionDatetime: datetime,
      currency,
      credit,
      debit,
      balance,
      memo,
      exportAccountNumber,
      foreignBuyer,
    });
  }

  return { accountNumber, rows, warnings };
}

module.exports = { parseIbkForeignCurrencyExcel };
