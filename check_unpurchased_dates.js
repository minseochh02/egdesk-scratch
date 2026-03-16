const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const directory = '미구매현황';

console.log('='.repeat(80));
console.log('Unpurchased Items Date Coverage Checker');
console.log('='.repeat(80));
console.log(`Source Directory: ${directory}`);
console.log('='.repeat(80));

// Get all Excel files
const files = fs.readdirSync(directory)
  .filter(file => file.endsWith('.xlsx'))
  .sort();

console.log(`Found ${files.length} Excel files\n`);

// Store all dates found in files
const datesFound = new Set();
const fileDetails = [];
let dateRange = null;

// Process each file
for (const filename of files) {
  const filepath = path.join(directory, filename);

  try {
    // Read workbook
    const workbook = XLSX.readFile(filepath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Get all data as array
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    if (data.length < 1) {
      console.log(`⚠ Skipped ${filename}: No data`);
      continue;
    }

    // Extract date from row 0
    const row0 = data[0];
    let fileDate = null;
    let fileDateRange = null;

    // Look for date in first row
    for (const cell of row0) {
      if (cell && typeof cell === 'string') {
        // Match pattern: "회사명 : (주)영일오엔씨 / 2025/03/07  ~ 2026/03/07"
        const rangeMatch = cell.match(/(\d{4})\/(\d{2})\/(\d{2})\s*~\s*(\d{4})\/(\d{2})\/(\d{2})/);
        if (rangeMatch) {
          const [, startYear, startMonth, startDay, endYear, endMonth, endDay] = rangeMatch;
          fileDateRange = {
            start: `${startYear}-${startMonth}-${startDay}`,
            end: `${endYear}-${endMonth}-${endDay}`
          };

          // Store the date range (we'll verify all files have the same range)
          if (!dateRange) {
            dateRange = fileDateRange;
          }
          break;
        }

        // Also try to match single date pattern: "2026/03/07"
        const singleDateMatch = cell.match(/(\d{4})\/(\d{2})\/(\d{2})/);
        if (singleDateMatch && !fileDate) {
          const [, year, month, day] = singleDateMatch;
          fileDate = `${year}-${month}-${day}`;
        }
      }
    }

    if (fileDate) {
      datesFound.add(fileDate);
      fileDetails.push({
        filename,
        date: fileDate,
        dateRange: fileDateRange
      });
    } else {
      console.log(`⚠ Could not extract date from ${filename}`);
    }

  } catch (error) {
    console.log(`✗ Error processing ${filename}: ${error.message}`);
  }
}

console.log('\n' + '='.repeat(80));
console.log('ANALYSIS RESULTS');
console.log('='.repeat(80));

if (dateRange) {
  console.log(`Expected Date Range: ${dateRange.start} ~ ${dateRange.end}`);
  console.log();
}

// Convert set to sorted array
const sortedDates = Array.from(datesFound).sort();

console.log(`Files Found: ${files.length}`);
console.log(`Dates Found: ${sortedDates.length}`);
console.log();

if (sortedDates.length > 0) {
  console.log('Actual Date Range Covered:');
  console.log(`  Start: ${sortedDates[0]}`);
  console.log(`  End: ${sortedDates[sortedDates.length - 1]}`);
  console.log();
}

// Generate all dates in the expected range
if (dateRange) {
  const expectedDates = [];
  const startDate = new Date(dateRange.start);
  const endDate = new Date(dateRange.end);

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    expectedDates.push(dateStr);
  }

  console.log(`Expected Total Dates: ${expectedDates.length}`);
  console.log();

  // Find missing dates
  const missingDates = expectedDates.filter(date => !datesFound.has(date));

  if (missingDates.length === 0) {
    console.log('✓ ALL DATES ARE PRESENT!');
    console.log('  Complete coverage from ' + dateRange.start + ' to ' + dateRange.end);
  } else {
    console.log(`✗ MISSING ${missingDates.length} DATE(S):`);
    console.log('-'.repeat(80));

    // Group consecutive missing dates for easier reading
    let rangeStart = missingDates[0];
    let rangeLast = missingDates[0];

    for (let i = 1; i <= missingDates.length; i++) {
      const currentDate = missingDates[i];
      const lastDate = new Date(rangeLast);
      lastDate.setDate(lastDate.getDate() + 1);
      const expectedNext = lastDate.toISOString().split('T')[0];

      if (currentDate === expectedNext) {
        rangeLast = currentDate;
      } else {
        if (rangeStart === rangeLast) {
          console.log(`  ${rangeStart}`);
        } else {
          console.log(`  ${rangeStart} ~ ${rangeLast} (${getDaysDiff(rangeStart, rangeLast) + 1} days)`);
        }
        rangeStart = currentDate;
        rangeLast = currentDate;
      }
    }
  }
  console.log();
}

// Show sample of dates found
console.log('Sample of Dates Found:');
console.log('-'.repeat(80));
const sampleSize = Math.min(10, sortedDates.length);
for (let i = 0; i < sampleSize; i++) {
  const date = sortedDates[i];
  const filesForDate = fileDetails.filter(f => f.date === date);
  console.log(`  ${date}: ${filesForDate.map(f => f.filename).join(', ')}`);
}
if (sortedDates.length > sampleSize) {
  console.log(`  ... and ${sortedDates.length - sampleSize} more dates`);
}
console.log();

// Check for duplicates (multiple files for the same date)
const duplicateDates = sortedDates.filter(date => {
  const count = fileDetails.filter(f => f.date === date).length;
  return count > 1;
});

if (duplicateDates.length > 0) {
  console.log('⚠ DUPLICATE DATES FOUND:');
  console.log('-'.repeat(80));
  for (const date of duplicateDates) {
    const filesForDate = fileDetails.filter(f => f.date === date);
    console.log(`  ${date}: ${filesForDate.length} files`);
    filesForDate.forEach(f => console.log(`    - ${f.filename}`));
  }
  console.log();
}

console.log('='.repeat(80));
console.log('Analysis Complete!');
console.log('='.repeat(80));

// Helper function to calculate days difference
function getDaysDiff(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}
