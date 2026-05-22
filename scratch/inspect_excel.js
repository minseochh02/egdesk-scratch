const XLSX = require('xlsx');
const fs = require('fs');

const filePath = `C:\\Users\\user\\Downloads\\거래내역조회_입출식 예금20260522.xlsx`;

console.log('=== INSPECT EXCEL RAW ROWS ===');
if (!fs.existsSync(filePath)) {
  console.error('File not found!');
  process.exit(1);
}

const fileBuffer = fs.readFileSync(filePath);
const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('Total Rows in Excel:', rows.length);
console.log('\n--- First 10 rows:');
for (let i = 0; i < Math.min(10, rows.length); i++) {
  console.log(`Row [${i + 1}]:`, JSON.stringify(rows[i]));
}
