const XLSX = require('xlsx');
const filePath = '/Users/minseocha/Desktop/projects/Taesung/EGDesk-scratch/egdesk-scratch/_대출거래내역조회20260526.xlsx';
const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];

const range = XLSX.utils.decode_range(sheet['!ref']);
for (let r = 0; r <= 10; r++) {
  const row = [];
  for (let c = 0; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r, c })];
    row.push(cell ? cell.v : null);
  }
  console.log(`Row ${r}:`, row);
}
