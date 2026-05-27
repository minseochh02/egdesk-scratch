/**
 * IBK 기업뱅킹 — 대출거래내역조회 Excel parser.
 * Supports multiple formats of IBK loan history.
 *
 * Format 1 (New): Header row 3, columns: 거래일자, 거래구분, 통화구분, 거래금액, 원금, 이자금액, 대출잔액, 이율(%), 시작일, 종료일, 상태구분
 * Format 2 (Old): Header row 2, columns: 거래일, 거래내용, 통화코드, 실행/상환금액, 이자, 수수료, 대출금잔액, 부리시작일, 부리종료일, 이율, 거래점
 *
 * @module ibk-loan-history-excel
 */

const XLSX = require('xlsx');
const fs = require('fs');

function normalizeHeader(cell) {
  return String(cell ?? '')
    .replace(/\r|\n/g, '')
    .replace(/\s/g, '')
    .trim();
}

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
 */
function parseIbkLoanHistoryExcel(filePath) {
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

  // 1. Detect format and header row
  let headerRowIdx = -1;
  let format = null;
  let accountNumber = null;
  let headerBalance = null;

  for (let i = 0; i < Math.min(data.length, 10); i++) {
    const row = data[i];
    if (!row) continue;

    const rowStr = JSON.stringify(row);
    
    // Check for account number in metadata rows
    const accMatch = rowStr.match(/대출계좌번호\s*[:：]\s*([\d-]+)/);
    if (accMatch) {
      accountNumber = accMatch[1];
    }

    // Check for balance in metadata rows (merged cells often contain this)
    const balMatch = rowStr.match(/대출잔액\s*[:：]\s*([\d,]+)/);
    if (balMatch) {
      headerBalance = parseAmount(balMatch[1]);
    }

    if (row.some(c => normalizeHeader(c) === '거래일자')) {
      headerRowIdx = i;
      format = 'new';
      break;
    }
    if (row.some(c => normalizeHeader(c) === '거래일')) {
      headerRowIdx = i;
      format = 'old';
      break;
    }
  }

  if (headerRowIdx === -1) {
    warnings.push('Could not find header row (expected "거래일자" or "거래일")');
    return { accountNumber, headerBalance, rows: [], warnings };
  }

  const colMap = buildColMap(data[headerRowIdx]);
  const rows = [];

  for (let r = headerRowIdx + 1; r < data.length; r++) {
    const row = data[r];
    if (!row || !Array.isArray(row)) continue;

    // Stop if we hit '합계'
    if (row.some(c => normalizeHeader(c) === '합계')) {
      break;
    }

    const dateKey = format === 'new' ? '거래일자' : '거래일';
    const transactionDate = parseDateCell(cellByHeader(colMap, row, dateKey));
    if (!transactionDate) continue;

    const description = String(cellByHeader(colMap, row, format === 'new' ? '거래구분' : '거래내용') ?? '').trim();
    if (description === '기간연장') {
      continue;
    }

    if (format === 'new') {
      const balanceVal = cellByHeader(colMap, row, '대출금잔액') ?? cellByHeader(colMap, row, '대출잔액');
      rows.push({
        transactionDate,
        description: String(cellByHeader(colMap, row, '거래구분') ?? '').trim() || null,
        currency: String(cellByHeader(colMap, row, '통화구분') ?? '').trim() || null,
        amount: parseAmount(cellByHeader(colMap, row, '거래금액')),
        interest: parseAmount(cellByHeader(colMap, row, '이자금액')),
        fee: 0, // Not in new format
        balance: parseAmount(balanceVal),
        interestStartDate: parseDateCell(cellByHeader(colMap, row, '시작일')),
        interestEndDate: parseDateCell(cellByHeader(colMap, row, '종료일')),
        interestRate: parseRate(cellByHeader(colMap, row, '이율(%)')),
        branch: null, // Not in new format
      });
    } else {
      const balanceVal = cellByHeader(colMap, row, '대출금잔액') ?? cellByHeader(colMap, row, '대출잔액');
      rows.push({
        transactionDate,
        description: String(cellByHeader(colMap, row, '거래내용') ?? '').trim() || null,
        currency: String(cellByHeader(colMap, row, '통화코드') ?? '').trim() || null,
        amount: parseAmount(cellByHeader(colMap, row, '실행/상환금액')),
        interest: parseAmount(cellByHeader(colMap, row, '이자')),
        fee: parseAmount(cellByHeader(colMap, row, '수수료')),
        balance: parseAmount(balanceVal),
        interestStartDate: parseDateCell(cellByHeader(colMap, row, '부리시작일')),
        interestEndDate: parseDateCell(cellByHeader(colMap, row, '부리종료일')),
        interestRate: parseRate(cellByHeader(colMap, row, '이율')),
        branch: String(cellByHeader(colMap, row, '거래점') ?? '').trim() || null,
      });
    }
  }

  return { accountNumber, headerBalance, rows, warnings };
}

module.exports = {
  parseIbkLoanHistoryExcel,
  parseDateCell,
  parseAmount,
  parseRate,
};
