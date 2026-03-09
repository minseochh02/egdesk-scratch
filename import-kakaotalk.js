const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// Read the CSV file
const csvPath = path.join(__dirname, 'KakaoTalk_Chat_EGdesk-PM_2026-03-08-18-20-48.csv');
const csvContent = fs.readFileSync(csvPath, 'utf8');

// Remove BOM if present
const contentWithoutBOM = csvContent.replace(/^\ufeff/, '');

// Parse CSV with proper multiline and quote handling
const records = parse(contentWithoutBOM, {
  columns: true,
  skip_empty_lines: true,
  relax_quotes: true,
  relax_column_count: true
});

// Transform to objects with correct field names
const chatMessages = records.map(row => ({
  chat_date: row.Date || row.date || '',
  user_name: row.User || row.user || '',
  message: row.Message || row.message || ''
})).filter(row => row.chat_date && row.user_name && row.message);

// Output statistics
console.log('CSV Parsing Complete');
console.log('Total messages:', chatMessages.length);
console.log('\nDate range:');
console.log('First message:', chatMessages[0].chat_date);
console.log('Last message:', chatMessages[chatMessages.length - 1].chat_date);
console.log('\nSample messages:');
console.log(JSON.stringify(chatMessages.slice(0, 3), null, 2));

// Save to JSON for inspection
fs.writeFileSync(
  path.join(__dirname, 'kakaotalk-parsed.json'),
  JSON.stringify(chatMessages, null, 2),
  'utf8'
);

console.log('\nData saved to kakaotalk-parsed.json');
console.log('Ready for import into database');
