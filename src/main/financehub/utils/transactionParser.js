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
      // Fallback logic could go here
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
      metadata: {}, // Could extract metadata from rows < headerRowIndex
      summary: {}
    };
    
  } catch (error) {
    if (ctx && ctx.error) ctx.error(`Error parsing Excel: ${error.message}`);
    throw error;
  }
}

/**
 * Extracts transaction data directly from the HTML page and creates an Excel file
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

    // 5. Unfocus by clicking on page title
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
 * Extracts transaction data directly from the rendered HTML page
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
      },
      transactions: [],
      headers: [],
    };

    // === Extract Account Info ===
    try {
      // Account name
      const accountNameEl = document.querySelector('#wq_uuid_7038');
      if (accountNameEl) result.metadata.accountName = accountNameEl.textContent.trim();

      // Customer name
      const customerNameEl = document.querySelector('#wq_uuid_7042');
      if (customerNameEl) result.metadata.customerName = customerNameEl.textContent.trim();

      // Account number
      const accountNumEl = document.querySelector('#wq_uuid_7045');
      if (accountNumEl) result.metadata.accountNumber = accountNumEl.textContent.trim();

      // Balance
      const balanceEl = document.querySelector('#wq_uuid_7049');
      if (balanceEl) {
        result.metadata.balance = parseInt(balanceEl.textContent.replace(/[,\s]/g, ''), 10) || 0;
      }

      // Available balance
      const availBalEl = document.querySelector('#wq_uuid_7052');
      if (availBalEl) {
        result.metadata.availableBalance = parseInt(availBalEl.textContent.replace(/[,\s]/g, ''), 10) || 0;
      }

      // Open date
      const openDateEl = document.querySelector('#wq_uuid_7056');
      if (openDateEl) result.metadata.openDate = openDateEl.textContent.trim();
    } catch (e) {
      console.error('Error extracting metadata:', e);
    }

    // === Extract Summary ===
    try {
      // Total count
      const totalCountEl = document.querySelector('#wq_uuid_7143');
      if (totalCountEl) {
        result.summary.totalCount = parseInt(totalCountEl.textContent.trim(), 10) || 0;
      }

      // Query date/time
      const queryDateEl = document.querySelector('#wq_uuid_7148');
      if (queryDateEl) result.summary.queryDate = queryDateEl.textContent.trim();

      // Deposit total and count
      const depositTotalEl = document.querySelector('#wq_uuid_7158');
      if (depositTotalEl) {
        result.summary.totalDeposits = parseInt(depositTotalEl.textContent.replace(/[,\s]/g, ''), 10) || 0;
      }
      const depositCountEl = document.querySelector('#wq_uuid_7161');
      if (depositCountEl) {
        result.summary.depositCount = parseInt(depositCountEl.textContent.trim(), 10) || 0;
      }

      // Withdrawal total and count
      const withdrawalTotalEl = document.querySelector('#wq_uuid_7165');
      if (withdrawalTotalEl) {
        result.summary.totalWithdrawals = parseInt(withdrawalTotalEl.textContent.replace(/[,\s]/g, ''), 10) || 0;
      }
      const withdrawalCountEl = document.querySelector('#wq_uuid_7168');
      if (withdrawalCountEl) {
        result.summary.withdrawalCount = parseInt(withdrawalCountEl.textContent.trim(), 10) || 0;
      }
    } catch (e) {
      console.error('Error extracting summary:', e);
    }

    // === Extract Headers ===
    try {
      const headerCells = document.querySelectorAll('#grd_list thead th');
      headerCells.forEach(th => {
        const nobr = th.querySelector('nobr');
        if (nobr) {
          result.headers.push(nobr.textContent.trim());
        }
      });
    } catch (e) {
      console.error('Error extracting headers:', e);
    }

    // === Extract Transactions ===
    try {
      const rows = document.querySelectorAll('#grd_list tbody tr.grid_body_row');
      
      rows.forEach((row, rowIndex) => {
        const cells = row.querySelectorAll('td');
        const transaction = { _rowIndex: rowIndex };
        
        cells.forEach((cell, cellIndex) => {
          const nobr = cell.querySelector('nobr.w2grid_input');
          const value = nobr ? nobr.textContent.trim() : '';
          
          // Map by column index based on known structure
          switch (cellIndex) {
            case 0: // 거래일자
              transaction.date = value;
              break;
            case 1: // 거래시간
              transaction.time = value;
              break;
            case 2: // 적요
              transaction.type = value;
              break;
            case 3: // 출금(원)
              transaction.withdrawal = value ? parseInt(value.replace(/[,\s]/g, ''), 10) || 0 : 0;
              break;
            case 4: // 입금(원)
              transaction.deposit = value ? parseInt(value.replace(/[,\s]/g, ''), 10) || 0 : 0;
              break;
            case 5: // 내용
              transaction.description = value;
              break;
            case 6: // 잔액(원)
              transaction.balance = value ? parseInt(value.replace(/[,\s]/g, ''), 10) || 0 : 0;
              break;
            case 7: // 거래점
              transaction.branch = value;
              break;
          }
        });
        
        // Only add if it looks like a valid transaction
        if (transaction.date || transaction.withdrawal > 0 || transaction.deposit > 0) {
          result.transactions.push(transaction);
        }
      });
    } catch (e) {
      console.error('Error extracting transactions:', e);
    }

    return result;
  });

  ctx.log(`Extracted ${data.transactions.length} transactions from page`);
  ctx.log(`Account: ${data.metadata.accountNumber} (${data.metadata.accountName})`);
  ctx.log(`Summary: ${data.summary.depositCount} deposits (+${data.summary.totalDeposits}), ${data.summary.withdrawalCount} withdrawals (-${data.summary.totalWithdrawals})`);

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
  
  const timestamp = ctx.generateTimestamp ? ctx.generateTimestamp() : Date.now();
  const filename = `신한은행_거래내역_${data.metadata.accountNumber.replace(/-/g, '')}_${timestamp}.xlsx`;
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
  sheetData.push(['계좌번호', data.metadata.accountNumber]);
  sheetData.push(['계좌명', data.metadata.accountName]);
  sheetData.push(['고객명', data.metadata.customerName]);
  sheetData.push(['계좌잔액', data.metadata.balance]);
  sheetData.push(['출금가능금액', data.metadata.availableBalance]);
  sheetData.push(['조회일시', data.summary.queryDate]);
  sheetData.push(['총건수', data.summary.totalCount]);
  sheetData.push([]);  // Empty row

  // Summary row
  sheetData.push([
    '입금합계', data.summary.totalDeposits, `(${data.summary.depositCount}건)`,
    '출금합계', data.summary.totalWithdrawals, `(${data.summary.withdrawalCount}건)`
  ]);
  sheetData.push([]);  // Empty row

  // Headers
  const headers = ['거래일자', '거래시간', '적요', '출금(원)', '입금(원)', '내용', '잔액(원)', '거래점'];
  sheetData.push(headers);

  // Transaction rows
  data.transactions.forEach(tx => {
    sheetData.push([
      tx.date || '',
      tx.time || '',
      tx.type || '',
      tx.withdrawal || '',
      tx.deposit || '',
      tx.description || '',
      tx.balance || '',
      tx.branch || '',
    ]);
  });

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 12 },  // 거래일자
    { wch: 10 },  // 거래시간
    { wch: 15 },  // 적요
    { wch: 12 },  // 출금
    { wch: 12 },  // 입금
    { wch: 20 },  // 내용
    { wch: 12 },  // 잔액
    { wch: 10 },  // 거래점
  ];

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, '거래내역');

  // Write file
  XLSX.writeFile(workbook, filePath);

  ctx.log(`Excel file created: ${filePath}`);
  return filePath;
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
