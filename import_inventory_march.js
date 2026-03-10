const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const os = require('os');

// Database path
const dbPath = path.join(os.homedir(), 'Library/Application Support/EGDesk/database/user_data.db');
const directory = '창고별재고-january/march';

console.log('='.repeat(80));
console.log('Excel Inventory Data Import Script - MARCH 2026');
console.log('='.repeat(80));
console.log(`Database: ${dbPath}`);
console.log(`Source Directory: ${directory}`);
console.log('='.repeat(80));

// Connect to database
const db = new Database(dbPath);

// Get all Excel files
const files = fs.readdirSync(directory)
  .filter(file => file.endsWith('.xlsx'))
  .sort((a, b) => {
    // Sort by number in filename: ESZ018R (1).xlsx, ESZ018R (2).xlsx, etc.
    const numA = parseInt(a.match(/\((\d+)\)/)?.[1] || '0');
    const numB = parseInt(b.match(/\((\d+)\)/)?.[1] || '0');
    return numA - numB;
  });

console.log(`Found ${files.length} Excel files to import\n`);

// Prepare insert statement
const insertStmt = db.prepare(`
  INSERT INTO inventory (품목코드, 품목명_규격_, 창고코드, 창고명, 재고수량, imported_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);

// Track statistics
let totalFiles = 0;
let totalRows = 0;
let totalErrors = 0;
const fileStats = [];

// Process each file
for (const filename of files) {
  const filepath = path.join(directory, filename);

  try {
    console.log(`Processing: ${filename}`);

    // Read workbook
    const workbook = XLSX.readFile(filepath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Get all data as array
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    if (data.length < 3) {
      console.log(`  ⚠ Skipped: Not enough rows (${data.length} rows)\n`);
      continue;
    }

    // Extract date from row 0
    const row0 = data[0];
    let importDate = null;

    // Look for date in first row
    for (const cell of row0) {
      if (cell && typeof cell === 'string') {
        // Match pattern: "회사명 : (주)영일오엔씨 / 2026/03/01"
        const dateMatch = cell.match(/(\d{4})\/(\d{2})\/(\d{2})/);
        if (dateMatch) {
          const [, year, month, day] = dateMatch;
          importDate = `${year}-${month}-${day}`;
          break;
        }
      }
    }

    if (!importDate) {
      console.log(`  ✗ Error: Could not determine date for ${filename}\n`);
      totalErrors++;
      continue;
    }

    console.log(`  Date: ${importDate}`);

    // Row 1 is headers, data starts at row 2
    const dataRows = data.slice(2);
    let insertedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Begin transaction for this file
    const transaction = db.transaction((rows) => {
      for (const row of rows) {
        // Skip empty rows
        if (!row || row.length === 0 || !row[0]) {
          skippedCount++;
          continue;
        }

        try {
          // Map columns: [품목코드, 품목명[규격], 창고코드, 창고명, 재고수량]
          const [itemCode, itemName, warehouseCode, warehouseName, quantity] = row;

          // Skip if essential fields are missing
          if (!itemCode || !itemName) {
            skippedCount++;
            continue;
          }

          // Insert row
          insertStmt.run(
            itemCode,
            itemName,
            warehouseCode,
            warehouseName,
            quantity,
            importDate
          );

          insertedCount++;
        } catch (error) {
          errorCount++;
          console.log(`    Error inserting row: ${error.message}`);
        }
      }
    });

    // Execute transaction
    transaction(dataRows);

    console.log(`  Inserted: ${insertedCount} rows`);
    if (skippedCount > 0) {
      console.log(`  Skipped: ${skippedCount} rows`);
    }
    if (errorCount > 0) {
      console.log(`  Errors: ${errorCount} rows`);
    }
    console.log();

    totalFiles++;
    totalRows += insertedCount;
    totalErrors += errorCount;

    fileStats.push({
      filename,
      date: importDate,
      inserted: insertedCount,
      skipped: skippedCount,
      errors: errorCount
    });

  } catch (error) {
    console.log(`  ✗ Error processing ${filename}: ${error.message}\n`);
    totalErrors++;
  }
}

// Close database
db.close();

// Print summary
console.log('='.repeat(80));
console.log('IMPORT SUMMARY - MARCH 2026');
console.log('='.repeat(80));
console.log(`Files Processed: ${totalFiles}/${files.length}`);
console.log(`Total Rows Inserted: ${totalRows}`);
if (totalErrors > 0) {
  console.log(`Total Errors: ${totalErrors}`);
}
console.log();

// Print file details
console.log('FILE DETAILS:');
console.log('-'.repeat(80));
for (const stat of fileStats) {
  console.log(`${stat.filename} (${stat.date}): ${stat.inserted} rows inserted`);
}
console.log();

// Verify database state
const dbVerify = new Database(dbPath, { readonly: true });
const statsAll = dbVerify.prepare(`
  SELECT
    COUNT(*) as total_rows,
    COUNT(DISTINCT imported_at) as unique_dates,
    MIN(imported_at) as earliest_date,
    MAX(imported_at) as latest_date
  FROM inventory
`).get();

const statsMarch = dbVerify.prepare(`
  SELECT
    COUNT(*) as total_rows,
    COUNT(DISTINCT imported_at) as unique_dates,
    MIN(imported_at) as earliest_date,
    MAX(imported_at) as latest_date
  FROM inventory
  WHERE imported_at >= '2026-03-01' AND imported_at <= '2026-03-31'
`).get();
dbVerify.close();

console.log('='.repeat(80));
console.log('DATABASE VERIFICATION');
console.log('='.repeat(80));
console.log('March 2026 Data:');
console.log(`  Total rows: ${statsMarch.total_rows}`);
console.log(`  Unique dates: ${statsMarch.unique_dates}`);
console.log(`  Date range: ${statsMarch.earliest_date} to ${statsMarch.latest_date}`);
console.log();
console.log('Overall Database:');
console.log(`  Total rows: ${statsAll.total_rows}`);
console.log(`  Unique dates: ${statsAll.unique_dates}`);
console.log(`  Date range: ${statsAll.earliest_date} to ${statsAll.latest_date}`);
console.log('='.repeat(80));
console.log('Import completed successfully!');
