const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Get the actual directory path
const dir = fs.readdirSync('.').find(d => d.includes('재고'));
console.log(`Found directory: ${dir}`);

// Get first file
const files = fs.readdirSync(dir).filter(f => f.endsWith('.xlsx'));
const sampleFile = path.join(dir, files[0]);

console.log(`Reading sample file: ${sampleFile}\n`);

const workbook = XLSX.readFile(sampleFile);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

console.log(`Sheet name: ${sheetName}\n`);

// Convert sheet to JSON to see the data
const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

console.log('First 20 rows:');
console.log('='.repeat(80));

data.slice(0, 20).forEach((row, index) => {
  console.log(`Row ${index}:`, row);
});

console.log('\n' + '='.repeat(80));
console.log(`Total rows in sheet: ${data.length}`);

// Also show with headers
console.log('\n' + '='.repeat(80));
console.log('Data with inferred headers (first 5 rows):');
console.log('='.repeat(80));

const dataWithHeaders = XLSX.utils.sheet_to_json(sheet, { defval: null });
console.log(JSON.stringify(dataWithHeaders.slice(0, 5), null, 2));
