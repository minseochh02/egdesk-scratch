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

// Dictionary to store filename -> date mapping
const fileDates = {};

// Read first row of each file
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
        const firstRowValues = [];

        // Check all cells in the first row
        for (let col = range.s.c; col <= range.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
            const cell = sheet[cellAddress];

            if (cell) {
                firstRowValues.push(cell.v);

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
                    const dateFormats = [
                        /(\d{4})-(\d{2})-(\d{2})/,
                        /(\d{4})\/(\d{2})\/(\d{2})/,
                        /(\d{4})\.(\d{2})\.(\d{2})/,
                        /(\d{2})\/(\d{2})\/(\d{4})/,
                    ];

                    for (const regex of dateFormats) {
                        const match = str.match(regex);
                        if (match) {
                            const parsed = new Date(str);
                            if (!isNaN(parsed.getTime())) {
                                dateFound = parsed;
                                break;
                            }
                        }
                    }
                    if (dateFound) break;
                }
            }
        }

        if (dateFound) {
            fileDates[filename] = dateFound;
            console.log(`${filename}: ${dateFound.toISOString().split('T')[0]}`);
        } else {
            console.log(`${filename}: NO DATE FOUND - First row: ${firstRowValues.join(', ')}`);
        }

    } catch (error) {
        console.log(`${filename}: ERROR - ${error.message}`);
    }
});

console.log('\n' + '='.repeat(80));
console.log('ANALYSIS:');
console.log('='.repeat(80));

// Check for missing dates in January
if (Object.keys(fileDates).length > 0) {
    const dates = Object.values(fileDates).sort((a, b) => a - b);
    console.log(`\nDate range: ${dates[0].toISOString().split('T')[0]} to ${dates[dates.length - 1].toISOString().split('T')[0]}`);

    // Determine which year and month to check
    const year = dates[0].getFullYear();
    const month = dates[0].getMonth();

    // Generate all dates in the month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const allDatesInMonth = [];

    for (let day = 1; day <= daysInMonth; day++) {
        allDatesInMonth.push(new Date(year, month, day));
    }

    // Check which dates are missing
    const foundDateStrings = new Set(
        Object.values(fileDates).map(d => d.toISOString().split('T')[0])
    );

    const missingDates = allDatesInMonth.filter(
        d => !foundDateStrings.has(d.toISOString().split('T')[0])
    );

    if (missingDates.length > 0) {
        console.log(`\nMISSING DATES (${missingDates.length}):`);
        missingDates.forEach(date => {
            console.log(`  - ${date.toISOString().split('T')[0]}`);
        });
    } else {
        const monthName = dates[0].toLocaleString('default', { month: 'long', year: 'numeric' });
        console.log(`\nAll ${allDatesInMonth.length} dates in ${monthName} are present!`);
    }
}

console.log('\n' + '='.repeat(80));
console.log('FILE -> DATE MAPPING:');
console.log('='.repeat(80));

const sortedEntries = Object.entries(fileDates).sort((a, b) => a[1] - b[1]);
sortedEntries.forEach(([filename, date]) => {
    console.log(`${filename} -> ${date.toISOString().split('T')[0]}`);
});
