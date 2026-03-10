const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Directory containing the Excel files
const directory = '창고별재고-january';

// Get all Excel files
const files = fs.readdirSync(directory)
    .filter(file => file.endsWith('.xlsx'))
    .sort();

console.log(`Found ${files.length} Excel files\n`);

// Array to store rename operations
const renameOperations = [];

// Read first row of each file and determine new name
files.forEach(filename => {
    const filepath = path.join(directory, filename);
    try {
        // Read the workbook
        const workbook = XLSX.readFile(filepath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Get the range of the sheet
        const range = XLSX.utils.decode_range(sheet['!ref']);

        // Read first row
        let dateFound = null;

        // Check all cells in the first row
        for (let col = range.s.c; col <= range.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
            const cell = sheet[cellAddress];

            if (cell) {
                // Check if it's a date
                if (cell.t === 'd') {
                    dateFound = cell.v;
                    break;
                } else if (cell.t === 'n' && cell.w) {
                    // Try to parse as date (Excel stores dates as numbers)
                    const excelDate = XLSX.SSF.parse_date_code(cell.v);
                    if (excelDate) {
                        dateFound = new Date(excelDate.y, excelDate.m - 1, excelDate.d);
                        break;
                    }
                } else if (cell.t === 's') {
                    // Try to parse string as date
                    const str = cell.v;
                    const parsed = new Date(str);
                    if (!isNaN(parsed.getTime())) {
                        dateFound = parsed;
                        break;
                    }
                }
            }
        }

        if (dateFound) {
            // Format the date as YYYYMMDD
            const year = dateFound.getFullYear();
            const month = String(dateFound.getMonth() + 1).padStart(2, '0');
            const day = String(dateFound.getDate()).padStart(2, '0');
            const dateString = `${year}${month}${day}`;

            // Create new filename: 창고별재고YYYYMMDD.xlsx
            const newFilename = `창고별재고${dateString}.xlsx`;
            const newFilepath = path.join(directory, newFilename);

            renameOperations.push({
                old: filename,
                new: newFilename,
                oldPath: filepath,
                newPath: newFilepath,
                date: dateFound.toISOString().split('T')[0]
            });
        } else {
            console.log(`⚠️  ${filename}: Could not find date, skipping`);
        }

    } catch (error) {
        console.log(`❌ ${filename}: ERROR - ${error.message}`);
    }
});

// Sort operations by date
renameOperations.sort((a, b) => a.date.localeCompare(b.date));

// Display rename plan
console.log('='.repeat(80));
console.log('RENAME PLAN:');
console.log('='.repeat(80));
renameOperations.forEach(op => {
    console.log(`${op.old}`);
    console.log(`  → ${op.new} (${op.date})`);
});

console.log('\n' + '='.repeat(80));
console.log(`Total files to rename: ${renameOperations.length}`);
console.log('='.repeat(80));

// Ask for confirmation
const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question('\nProceed with renaming? (yes/no): ', (answer) => {
    if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
        console.log('\nRenaming files...\n');

        let successCount = 0;
        let errorCount = 0;

        renameOperations.forEach(op => {
            try {
                // Check if target file already exists
                if (fs.existsSync(op.newPath) && op.oldPath !== op.newPath) {
                    console.log(`⚠️  Skipping ${op.old} - ${op.new} already exists`);
                    errorCount++;
                } else if (op.oldPath === op.newPath) {
                    console.log(`✓ ${op.old} - already correctly named`);
                    successCount++;
                } else {
                    fs.renameSync(op.oldPath, op.newPath);
                    console.log(`✓ ${op.old} → ${op.new}`);
                    successCount++;
                }
            } catch (error) {
                console.log(`❌ ${op.old}: ${error.message}`);
                errorCount++;
            }
        });

        console.log('\n' + '='.repeat(80));
        console.log(`Completed: ${successCount} successful, ${errorCount} errors`);
        console.log('='.repeat(80));
    } else {
        console.log('\nRename operation cancelled.');
    }
    rl.close();
});
