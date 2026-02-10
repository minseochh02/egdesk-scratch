const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const DEFAULT_HEADER_KEYWORDS = ['거래일자', '거래일', '일자', '날짜', '거래시간', '적요', '출금', '입금', '잔액'];

const DEFAULT_HEADER_MAPPING = {
  '거래일자': 'date',
  '거래일': 'date',
  '일자': 'date',
  '거래시간': 'time',
  '시간': 'time',
  '적요': 'description',
  '거래적요': 'description',
  '출금': 'withdrawal',
  '출금(원)': 'withdrawal',
  '출금액': 'withdrawal',
  '지급': 'withdrawal',
  '입금': 'deposit',
  '입금(원)': 'deposit',
  '입금액': 'deposit',
  '잔액': 'balance',
  '잔액(원)': 'balance',
  '거래후잔액': 'balance',
  '내용': 'memo',
  '메모': 'memo',
  '비고': 'memo',
  '거래점': 'branch',
  '취급점': 'branch',
  '거래점명': 'branch',
};

/**
 * Parses a transaction Excel file
 * @param {string} filePath - Path to Excel file
 * @param {Object} [ctx] - Context for logging (optional)
 * @returns {Object} Parsed data
 */
function parseTransactionExcel(filePath, ctx) {
  if (ctx && ctx.log) ctx.log(`Parsing Excel file: ${filePath}`);
  
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Convert to JSON with array of arrays to find header
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    // Find header row
    let headerRowIndex = -1;
    let headerMap = {};
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      let matchCount = 0;
      
      // Check if this row contains header keywords
      for (let j = 0; j < row.length; j++) {
        const cell = row[j];
        if (typeof cell === 'string' && DEFAULT_HEADER_KEYWORDS.includes(cell.replace(/\s/g, ''))) {
          matchCount++;
        }
      }
      
      // If we found enough keywords, assume this is the header row
      if (matchCount >= 3) { 
        headerRowIndex = i;
        // Build map
        row.forEach((cell, colIdx) => {
          if (typeof cell === 'string') {
            const key = cell.replace(/\s/g, '');
            if (DEFAULT_HEADER_MAPPING[key]) {
              headerMap[DEFAULT_HEADER_MAPPING[key]] = colIdx;
            }
          }
        });
        break;
      }
    }
    
    if (headerRowIndex === -1) {
      if (ctx && ctx.warn) ctx.warn('Could not find header row in Excel file, using default mapping if possible or failing');
      throw new Error('Could not find header row in Excel file');
    }
    
    // Extract transactions
    const transactions = [];
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      
      const tx = {};
      let hasData = false;
      
      for (const [field, colIdx] of Object.entries(headerMap)) {
        if (row[colIdx] !== undefined) {
          tx[field] = row[colIdx];
          hasData = true;
        }
      }
      
      if (hasData) {
        // Basic cleaning
        if (tx.withdrawal) tx.withdrawal = parseInt(String(tx.withdrawal).replace(/[^0-9]/g, ''), 10) || 0;
        if (tx.deposit) tx.deposit = parseInt(String(tx.deposit).replace(/[^0-9]/g, ''), 10) || 0;
        if (tx.balance) tx.balance = parseInt(String(tx.balance).replace(/[^0-9]/g, ''), 10) || 0;
        
        transactions.push(tx);
      }
    }
    
    if (ctx && ctx.log) ctx.log(`Parsed ${transactions.length} transactions from Excel`);
    
    return {
      transactions,
      metadata: {},
      summary: {}
    };
    
  } catch (error) {
    if (ctx && ctx.error) ctx.error(`Error parsing Excel: ${error.message}`);
    throw error;
  }
}

/**
 * Extracts transaction data directly from the rendered HTML page
 * Uses structural/label-based selectors instead of fragile dynamic IDs
 * @param {Object} ctx - Automation context
 * @returns {Promise<Object>} Extracted data including metadata, summary, and transactions
 */
async function extractTransactionsFromPage(ctx) {
  const data = await ctx.page.evaluate(() => {
    const result = {
      metadata: {
        accountName: '',
        accountNumber: '',
        customerName: '',
        balance: 0,
        availableBalance: 0,
        openDate: '',
      },
      summary: {
        totalDeposits: 0,
        depositCount: 0,
        totalWithdrawals: 0,
        withdrawalCount: 0,
        totalCount: 0,
        queryDate: '',
        queryPeriod: '',
      },
      transactions: [],
      headers: [],
    };

    // === Helper: Find value in table row by header text ===
    function findTableValue(headerText) {
      // Find all th elements containing the header text
      const ths = Array.from(document.querySelectorAll('th'));
      for (const th of ths) {
        if (th.textContent.includes(headerText)) {
          // Get the next td sibling
          const td = th.nextElementSibling;
          if (td && td.tagName === 'TD') {
            // Try to get text from span or div inside, or direct text
            const span = td.querySelector('span');
            const div = td.querySelector('div.w2textbox');
            if (span) return span.textContent.trim();
            if (div) return div.textContent.trim();
            return td.textContent.trim();
          }
        }
      }
      return '';
    }

    // === Extract Account Info from tableTyOutput ===
    try {
      // Account name: 계좌명(계좌별명)
      result.metadata.accountName = findTableValue('계좌명');
      
      // Customer name: 고객명
      result.metadata.customerName = findTableValue('고객명');
      
      // Account number: 계좌번호
      result.metadata.accountNumber = findTableValue('계좌번호');
      
      // Balance: 계좌잔액(원)
      const balanceStr = findTableValue('계좌잔액');
      result.metadata.balance = parseInt(balanceStr.replace(/[,\s원]/g, ''), 10) || 0;
      
      // Available balance: 출금가능금액(원)
      const availStr = findTableValue('출금가능금액');
      result.metadata.availableBalance = parseInt(availStr.replace(/[,\s원]/g, ''), 10) || 0;
      
      // Open date: 신규일자
      result.metadata.openDate = findTableValue('신규일자');
      
      console.log('[EXTRACT] Metadata:', result.metadata);
    } catch (e) {
      console.error('[EXTRACT] Error extracting metadata:', e);
    }

    // === Extract Summary from funcBox area ===
    try {
      // Total count: Find [총 X건] pattern
      const totalCountEl = document.querySelector('.total em, .w2group.total em');
      if (totalCountEl) {
        result.summary.totalCount = parseInt(totalCountEl.textContent.trim(), 10) || 0;
      }
      
      // Query date/time and period: Look for .time elements
      const timeElements = document.querySelectorAll('.time, em.time, span.time');
      for (const el of timeElements) {
        const text = el.textContent.trim();
        // Check if it's a date-time format (YYYY.MM.DD HH:MM:SS)
        if (text.match(/\d{4}\.\d{2}\.\d{2}\s+\d{2}:\d{2}:\d{2}/)) {
          result.summary.queryDate = text;
        }
        // Check if it's a date range (YYYY.MM.DD ~ YYYY.MM.DD)
        if (text.match(/\d{4}\.\d{2}\.\d{2}\s*~\s*\d{4}\.\d{2}\.\d{2}/)) {
          result.summary.queryPeriod = text;
        }
      }
      
      // Deposit/Withdrawal totals from tableTyGrid.result table
      const resultTable = document.querySelector('table.tableTyGrid.result');
      if (resultTable) {
        const rows = resultTable.querySelectorAll('tr');
        rows.forEach(row => {
          const ths = row.querySelectorAll('th');
          const tds = row.querySelectorAll('td');
          
          ths.forEach((th, idx) => {
            const headerText = th.textContent || '';
            const td = tds[idx];
            if (!td) return;
            
            // Extract all spans from the td
            const spans = td.querySelectorAll('span');
            if (spans.length >= 1) {
              // First span typically has the amount
              const amountText = spans[0].textContent.trim();
              const amount = parseInt(amountText.replace(/[,\s]/g, ''), 10) || 0;
              
              // Find count - look for span containing just a number (usually 3rd or 4th span)
              let count = 0;
              for (let i = 1; i < spans.length; i++) {
                const spanText = spans[i].textContent.trim();
                // Check if it's just a number (the count)
                if (/^\d+$/.test(spanText)) {
                  count = parseInt(spanText, 10) || 0;
                  break;
                }
              }
              
              if (headerText.includes('입금')) {
                result.summary.totalDeposits = amount;
                result.summary.depositCount = count;
              } else if (headerText.includes('출금')) {
                result.summary.totalWithdrawals = amount;
                result.summary.withdrawalCount = count;
              }
            }
          });
        });
      }
      
      console.log('[EXTRACT] Summary:', result.summary);
    } catch (e) {
      console.error('[EXTRACT] Error extracting summary:', e);
    }

    // === Extract Headers from grid ===
    try {
      const headerCells = document.querySelectorAll('#grd_list thead th');
      headerCells.forEach(th => {
        const nobr = th.querySelector('nobr');
        if (nobr) {
          result.headers.push(nobr.textContent.trim());
        }
      });
      console.log('[EXTRACT] Headers:', result.headers);
    } catch (e) {
      console.error('[EXTRACT] Error extracting headers:', e);
    }

    // === Extract Transactions from grid body ===
    try {
      const rows = document.querySelectorAll('#grd_list tbody tr.grid_body_row');
      console.log('[EXTRACT] Found', rows.length, 'transaction rows');
      
      rows.forEach((row, rowIndex) => {
        const cells = row.querySelectorAll('td');
        const transaction = { _rowIndex: rowIndex };
        
        cells.forEach((cell, cellIndex) => {
          const nobr = cell.querySelector('nobr.w2grid_input');
          const value = nobr ? nobr.textContent.trim() : '';
          
          // Map by column index based on known Shinhan Bank structure:
          // 0: 거래일자, 1: 거래시간, 2: 적요, 3: 출금(원), 4: 입금(원), 5: 내용, 6: 잔액(원), 7: 거래점
          switch (cellIndex) {
            case 0:
              transaction.date = value;
              break;
            case 1:
              transaction.time = value;
              // Combine date and time into datetime field: YYYY/MM/DD HH:MM:SS
              if (transaction.date && value) {
                transaction.datetime = transaction.date.replace(/-/g, '/') + ' ' + value;
              }
              break;
            case 2:
              transaction.type = value;
              break;
            case 3:
              transaction.withdrawal = value ? parseInt(value.replace(/[,\s]/g, ''), 10) || 0 : 0;
              break;
            case 4:
              transaction.deposit = value ? parseInt(value.replace(/[,\s]/g, ''), 10) || 0 : 0;
              break;
            case 5:
              transaction.description = value;
              break;
            case 6:
              transaction.balance = value ? parseInt(value.replace(/[,\s]/g, ''), 10) || 0 : 0;
              break;
            case 7:
              transaction.branch = value;
              break;
          }
        });
        
        // Only add if it looks like a valid transaction
        if (transaction.date || transaction.withdrawal > 0 || transaction.deposit > 0) {
          result.transactions.push(transaction);
        }
      });
      
      console.log('[EXTRACT] Extracted', result.transactions.length, 'transactions');
    } catch (e) {
      console.error('[EXTRACT] Error extracting transactions:', e);
    }

    return result;
  });

  ctx.log(`Extracted ${data.transactions.length} transactions from page`);
  ctx.log(`Account: ${data.metadata.accountNumber} (${data.metadata.accountName})`);
  ctx.log(`Customer: ${data.metadata.customerName}`);
  ctx.log(`Balance: ${data.metadata.balance.toLocaleString()}원`);
  ctx.log(`Period: ${data.summary.queryPeriod}`);
  ctx.log(`Summary: ${data.summary.depositCount} deposits (+${data.summary.totalDeposits.toLocaleString()}원), ${data.summary.withdrawalCount} withdrawals (-${data.summary.totalWithdrawals.toLocaleString()}원)`);

  return data;
}

/**
 * Creates an Excel file from extracted transaction data
 * @param {Object} ctx - Automation context
 * @param {Object} data - Extracted data from extractTransactionsFromPage
 * @returns {Promise<string>} Path to created Excel file
 */
async function createExcelFromData(ctx, data) {
  ctx.ensureOutputDirectory(ctx.outputDir);
  
  // Determine bank name based on context or data
  let bankName = '신한은행'; // Default for backward compatibility
  if (ctx.config?.bank?.nameKo) {
    bankName = ctx.config.bank.nameKo;
  } else if (data.metadata?.bankName) {
    bankName = data.metadata.bankName;
  }
  
  const timestamp = ctx.generateTimestamp ? ctx.generateTimestamp() : Date.now();
  const accountNum = data.metadata.accountNumber ? data.metadata.accountNumber.replace(/-/g, '') : 'unknown';
  const filename = `${bankName}_거래내역_${accountNum}_${timestamp}.xlsx`;
  const filePath = path.join(ctx.outputDir, filename);

  ctx.log(`Creating Excel file: ${filename}`);

  // Create workbook
  const workbook = XLSX.utils.book_new();

  // === Sheet 1: Transaction Data ===
  const sheetData = [];

  // Title row
  sheetData.push(['거래내역조회']);
  sheetData.push([]);  // Empty row

  // Metadata rows
  sheetData.push(['계좌번호', data.metadata.accountNumber || '']);
  sheetData.push(['계좌명', data.metadata.accountName || '']);
  sheetData.push(['고객명', data.metadata.customerName || '']);
  sheetData.push(['계좌잔액', data.metadata.balance || 0]);
  sheetData.push(['출금가능금액', data.metadata.availableBalance || 0]);
  sheetData.push(['신규일자', data.metadata.openDate || '']);
  sheetData.push(['조회기간', data.summary.queryPeriod || '']);
  sheetData.push(['조회일시', data.summary.queryDate || '']);
  sheetData.push(['총건수', data.summary.totalCount || data.transactions.length]);
  sheetData.push([]);  // Empty row

  // Summary row
  sheetData.push([
    '입금합계', data.summary.totalDeposits || 0, `(${data.summary.depositCount || 0}건)`,
    '출금합계', data.summary.totalWithdrawals || 0, `(${data.summary.withdrawalCount || 0}건)`
  ]);
  sheetData.push([]);  // Empty row

  // Headers - updated to use combined datetime
  const headers = ['거래일시', '적요', '출금(원)', '입금(원)', '내용', '잔액(원)', '거래점'];
  sheetData.push(headers);

  // Transaction rows
  if (data.transactions && data.transactions.length > 0) {
    data.transactions.forEach(tx => {
      // Combine date and time into datetime format: YYYY/MM/DD HH:MM:SS
      const datetime = tx.datetime ||
                      (tx.date && tx.time ? tx.date.replace(/-/g, '/') + ' ' + tx.time : tx.date || '');

      sheetData.push([
        datetime,
        tx.type || '',
        tx.withdrawal || '',
        tx.deposit || '',
        tx.description || '',
        tx.balance || '',
        tx.branch || '',
      ]);
    });
  }

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 18 },  // 거래일시 (combined datetime)
    { wch: 15 },  // 적요
    { wch: 12 },  // 출금
    { wch: 12 },  // 입금
    { wch: 20 },  // 내용
    { wch: 12 },  // 잔액
    { wch: 10 },  // 거래점
  ];

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, '거래내역');

  // Write file using fs to avoid potential path issues with XLSX.writeFile
  try {
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    fs.writeFileSync(filePath, buffer);
    ctx.log(`Excel file created: ${filePath}`);
    return filePath;
  } catch (writeError) {
    ctx.error(`Failed to write Excel file: ${writeError.message}`);
    throw new Error(`Failed to save Excel file to ${filePath}: ${writeError.message}`);
  }
}

/**
 * Extracts transaction data and creates Excel file
 * @param {Object} ctx - Automation context (this)
 * @param {string} accountNumber - Account number to query
 * @param {string} [startDate] - Start date (YYYYMMDD format)
 * @param {string} [endDate] - End date (YYYYMMDD format)
 * @returns {Promise<Object>} Extracted transaction data
 */
async function getTransactions(ctx, accountNumber, startDate, endDate) {
  if (!ctx.page) throw new Error('Browser page not initialized');
  ctx.log(`Fetching transactions for account ${accountNumber} (${startDate} ~ ${endDate})...`);
  
  try {
    // 1. Navigate to inquiry page if needed
    if (!ctx.page.url().includes('010101100010')) {
      await ctx.page.goto(ctx.config.xpaths.inquiryUrl, { waitUntil: 'domcontentloaded' });
      await ctx.page.waitForTimeout(3000);
    }

    // 2. Click account selector dropdown
    ctx.log('Clicking account dropdown...');
    const dropdownSelector = `xpath=${ctx.config.xpaths.accountDropdown}`;
    await ctx.page.click(dropdownSelector);
    await ctx.page.waitForTimeout(1000);

    // 3. Select the specified account
    ctx.log(`Selecting account ${accountNumber}...`);
    const accountOption = ctx.page.locator(`//div[contains(@class, "w2selectbox_layer")]//div[contains(text(), "${accountNumber}")]`).first();
    
    if (await accountOption.count() > 0) {
      await accountOption.click();
    } else {
      ctx.log('Account not found in dropdown, using current selection...');
    }
    await ctx.page.waitForTimeout(1000);

    // 4. Set start date
    ctx.log('Setting start date...');
    const dateInputSelector = `xpath=${ctx.config.xpaths.startDateInput}`;
    
    let targetStartDate = startDate;
    if (!targetStartDate) {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 10);
      targetStartDate = d.toISOString().split('T')[0].replace(/-/g, '');
    }

    const formattedDate = targetStartDate.replace(/[^0-9]/g, '');
    
    const dateInput = ctx.page.locator(dateInputSelector);
    await dateInput.click();
    await ctx.page.waitForTimeout(300);
    await dateInput.fill('');
    await dateInput.fill(formattedDate);
    await ctx.page.waitForTimeout(300);
    
    // Press Tab to unfocus date picker
    await ctx.page.keyboard.press('Tab');
    await ctx.page.waitForTimeout(500);

    // 5. Unfocus by clicking on page title or neutral element
    ctx.log('Unfocusing date picker...');
    try {
      const formLabel = ctx.page.locator('th:has-text("조회계좌번호")').first();
      if (await formLabel.count() > 0) {
        await formLabel.click();
      } else {
        await ctx.page.mouse.click(200, 150);
      }
    } catch (unfocusError) {
      await ctx.page.mouse.click(200, 150);
    }
    await ctx.page.waitForTimeout(500);

    // 6. Select "전체 보기" (View All) to get all transactions
    ctx.log('Selecting "전체 보기" to load all transactions...');
    try {
      const viewCountSelector = ctx.page.locator('select#wfr_grd_inq_btngrp_div_sbx_viewRowCnt_input_0');
      if (await viewCountSelector.count() > 0) {
        await viewCountSelector.selectOption({ label: '전체 보기' });
        ctx.log('Selected "전체 보기"');
        await ctx.page.waitForTimeout(500);
      }
    } catch (e) {
      ctx.warn('Could not select "전체 보기":', e.message);
    }

    // 7. Click "조회" (Inquiry) button
    ctx.log('Clicking Inquiry button...');
    const inquiryBtn = ctx.page.locator(`xpath=${ctx.config.xpaths.inquiryButton}`);
    await inquiryBtn.waitFor({ state: 'visible', timeout: 5000 });
    await inquiryBtn.scrollIntoViewIfNeeded();
    await ctx.page.waitForTimeout(300);
    await inquiryBtn.click({ force: true });
    ctx.log('Inquiry button clicked');
    
    // Wait for results to load
    await ctx.page.waitForTimeout(3000);

    // 8. Extract data from HTML
    ctx.log('Extracting transaction data from page...');
    const extractedData = await extractTransactionsFromPage(ctx);

    // 9. Create Excel file from extracted data
    if (extractedData.transactions.length > 0) {
      const excelPath = await createExcelFromData(ctx, extractedData);
      extractedData.file = excelPath;
      extractedData.status = 'success';
    } else {
      extractedData.status = 'no_data';
      ctx.warn('No transactions found on the page');
    }

    return extractedData;

  } catch (error) {
    ctx.error('Error fetching transactions:', error.message);
    
    try {
      ctx.ensureOutputDirectory(ctx.outputDir);
      const errorScreenshot = path.join(ctx.outputDir, `error-${Date.now()}.png`);
      await ctx.page.screenshot({ path: errorScreenshot, fullPage: true });
      ctx.log(`Error screenshot saved to: ${errorScreenshot}`);
    } catch (ssErr) {
      // Ignore
    }
    
    return { status: 'error', error: error.message, transactions: [] };
  }
}

/**
 * Combined method: extracts transactions and returns parsed data with Excel file
 * @param {Object} ctx - Automation context
 * @param {string} accountNumber - Account number to query
 * @param {string} [startDate] - Start date (YYYYMMDD format)
 * @param {string} [endDate] - End date (YYYYMMDD format)
 * @returns {Promise<Object>} Complete transaction data with file path
 */
async function getTransactionsWithParsing(ctx, accountNumber, startDate, endDate) {
  const result = await getTransactions(ctx, accountNumber, startDate, endDate);
  
  if (result.status === 'success') {
    return {
      success: true,
      file: result.file,
      metadata: result.metadata,
      summary: result.summary,
      transactions: result.transactions,
      headers: result.headers,
    };
  } else {
    return {
      success: false,
      error: result.error || 'No data found',
      transactions: [],
    };
  }
}

module.exports = {
  parseTransactionExcel,
  getTransactions,
  extractTransactionsFromPage,
  createExcelFromData,
  getTransactionsWithParsing,
  DEFAULT_HEADER_KEYWORDS,
  DEFAULT_HEADER_MAPPING
};