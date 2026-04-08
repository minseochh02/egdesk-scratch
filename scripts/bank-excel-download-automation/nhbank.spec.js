/**
 * NH Bank (농협은행) - Business Banking Automation
 * Site: ibz.nonghyup.com
 * Flow: Login via cert -> 입출금거래내역조회 -> Excel download
 *
 * Key notes:
 * - No frames — all interactions on main page
 * - Cert UI is in-browser (INIpay module, not native QWidget)
 * - Cert selection via Playwright (click table row)
 * - Password via Arduino HID (security keyboard blocks synthetic input)
 * - Similar pattern to Woori Bank
 */

require('dotenv').config();
const { chromium } = require('playwright-core');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { ArduinoHID } = require('./arduino-typer');

(async () => {
  // ── Connect Arduino first ──
  const arduino = new ArduinoHID();
  await arduino.connect();
  console.log('[Arduino] Connected and ready.');

  // ── Set up downloads directory ──
  const downloadsPath = path.join(os.homedir(), 'Downloads', 'EGDesk-Browser', 'nhbank');
  if (!fs.existsSync(downloadsPath)) {
    fs.mkdirSync(downloadsPath, { recursive: true });
  }
  console.log('📥 Downloads:', downloadsPath);

  // ── Create temp profile ──
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-profile-'));

  // ── Launch browser ──
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    channel: 'chrome',
    viewport: null,
    permissions: ['clipboard-read', 'clipboard-write'],
    acceptDownloads: true,
    downloadsPath: downloadsPath,
    args: [
      '--start-maximized',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--allow-running-insecure-content',
      '--disable-features=PrivateNetworkAccessSendPreflights',
      '--disable-features=PrivateNetworkAccessRespectPreflightResults',
    ],
  });

  let page = context.pages()[0] || await context.newPage();

  // Auto-accept dialogs
  page.on('dialog', async (dialog) => {
    console.log(`🔔 Dialog: ${dialog.type()} - "${dialog.message()}"`);
    await dialog.accept();
  });

  // ── SIGINT handler ──
  process.on('SIGINT', async () => {
    console.log('\n[SIGINT] Cleaning up...');
    try { await arduino.close(); } catch (e) {}
    try { await context.close(); } catch (e) {}
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) {}
    process.exit(0);
  });

  try {
    // ══════════════════════════════════════════════════════════════
    // STEP 1: Navigate to NH Bank business banking
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 1] Navigating to ibz.nonghyup.com...');
    await page.goto('https://ibz.nonghyup.com/');
    await page.waitForTimeout(3000);
    console.log('[STEP 1] ✓ Page loaded.');

    // ══════════════════════════════════════════════════════════════
    // STEP 2: Click 로그인
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 2] Clicking 로그인...');
    try {
      await page.locator('.login').first().click({ timeout: 10000 });
    } catch (e) {
      await page.locator('a:has-text("로그인")').first().click({ timeout: 10000 });
    }
    await page.waitForTimeout(2000);
    console.log('[STEP 2] ✓ 로그인 clicked.');

    // ══════════════════════════════════════════════════════════════
    // STEP 3: Click 공동인증서 로그인
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 3] Clicking 공동인증서 로그인...');
    try {
      await page.locator('span:has-text("공동인증서 로그인")').click({ timeout: 10000 });
    } catch (e) {
      await page.locator('xpath=/html/body/div[5]/div[2]/form[2]/div/div[1]/a[2]/p/span').click();
    }
    await page.waitForTimeout(3000);
    console.log('[STEP 3] ✓ 공동인증서 로그인 clicked. Cert dialog should appear.');

    // ══════════════════════════════════════════════════════════════
    // STEP 4: Select certificate from in-browser cert table
    // The cert list is a regular HTML table — Playwright can interact.
    // Select the first cert row (or match by expiry date).
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 4] Selecting certificate...');

    const targetExpiry = process.env.CERT_EXPIRY || '2026-08-15';

    // Try to click the cert row matching the target expiry
    let certClicked = false;
    try {
      const certRow = page.locator(`tr:has-text("${targetExpiry}")`).first();
      await certRow.click({ timeout: 5000 });
      certClicked = true;
      console.log(`[STEP 4] ✓ Cert with expiry ${targetExpiry} selected.`);
    } catch (e) {
      console.log(`[STEP 4] Could not find cert with expiry ${targetExpiry}, trying first row...`);
    }

    if (!certClicked) {
      try {
        // Click first cert row in the table
        await page.locator('div.cert-list table tbody tr').first().click({ timeout: 5000 });
        certClicked = true;
      } catch (e) {
        // Broader fallback
        await page.locator('table tbody tr').first().click({ timeout: 5000 });
        certClicked = true;
      }
      console.log('[STEP 4] ✓ First cert selected.');
    }
    await page.waitForTimeout(1000);

    // ══════════════════════════════════════════════════════════════
    // STEP 5: Tab to password field and type password via Arduino
    // Same pattern as Woori: Tab loop until activeElement matches
    // the password input ID, then type via Arduino HID.
    // Security keyboard blocks Playwright's fill().
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 5] Tabbing to password input...');
    let focused = '';
    for (let i = 1; i <= 20; i++) {
      await arduino.key('TAB');
      await page.waitForTimeout(300);
      focused = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
      console.log(`[STEP 5] Tab #${i} -> focused: "${focused}"`);
      if (focused === 'ini_cert_pwd') {
        console.log(`[STEP 5] ✓ Password input focused after ${i} Tab(s).`);
        break;
      }
    }
    if (focused !== 'ini_cert_pwd') {
      throw new Error(`Could not Tab to password input. Last focused: "${focused}"`);
    }

    const certPassword = process.env.CERT_PASSWORD;
    if (!certPassword) {
      throw new Error('CERT_PASSWORD not set. Use: $env:CERT_PASSWORD = "yourpassword"');
    }
    console.log('[STEP 5] Typing password via Arduino...');
    await arduino.type(certPassword);
    console.log('[STEP 5] ✓ Password typed.');
    await page.waitForTimeout(1000);

    // ══════════════════════════════════════════════════════════════
    // STEP 6: Click 확인 to submit cert login
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 6] Clicking 확인...');
    try {
      await page.locator('[id="INI_certSubmit"]').click({ timeout: 5000 });
    } catch (e) {
      await page.locator('button:has-text("확인")').first().click({ timeout: 5000 });
    }
    await page.waitForTimeout(5000);
    console.log('[STEP 6] ✓ Cert login submitted.');

    // ══════════════════════════════════════════════════════════════
    // STEP 7: Navigate to 입출금거래내역조회
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 7] Navigating to 입출금거래내역조회...');

    // Click 조회 menu
    try {
      await page.locator('.ibz-tooltip-ctrl:has-text("조회")').first().click({ timeout: 5000 });
    } catch (e) {
      await page.locator('button:has-text("조회")').first().click({ timeout: 5000 });
    }
    await page.waitForTimeout(2000);

    // Click 입출금거래내역조회(당일) submenu
    try {
      await page.locator('a:has-text("입출금거래내역조회")').first().click({ timeout: 5000 });
    } catch (e) {
      await page.locator('.text-link:has-text("입출금거래내역조회")').first().click({ timeout: 5000 });
    }
    await page.waitForTimeout(3000);
    console.log('[STEP 7] ✓ 입출금거래내역조회 page loaded.');

    // ══════════════════════════════════════════════════════════════
    // STEP 8: Get all accounts from dropdown, loop each one
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 8] Reading account list from dropdown...');

    const acctSelect = page.locator('[id="drw_acno"]');
    const accounts = await acctSelect.evaluate((sel) => {
      return Array.from(sel.options)
        .filter((opt) => opt.value && opt.value !== '' && !opt.text.includes('선택'))
        .map((opt, i) => ({ index: i, value: opt.value, text: opt.text.trim() }));
    }).catch(() => []);

    // If filter skipped too many, try including all with a value
    if (accounts.length === 0) {
      const allAccounts = await acctSelect.evaluate((sel) => {
        return Array.from(sel.options)
          .filter((opt, i) => i > 0 && opt.value)
          .map((opt, i) => ({ index: i + 1, value: opt.value, text: opt.text.trim() }));
      }).catch(() => []);
      accounts.push(...allAccounts);
    }

    console.log(`[STEP 8] Found ${accounts.length} account(s):`);
    for (const acct of accounts) {
      console.log(`    [${acct.index}] ${acct.text}`);
    }

    for (let ai = 0; ai < accounts.length; ai++) {
      const acct = accounts[ai];
      console.log(`\n══ Account ${ai + 1}/${accounts.length}: ${acct.text} ══`);

      // Select account
      console.log(`[STEP 9-${ai + 1}] Selecting account...`);
      await acctSelect.selectOption({ value: acct.value });
      await page.waitForTimeout(1000);
      console.log(`[STEP 9-${ai + 1}] ✓ Account selected.`);

      // Set date range (3 months)
      console.log(`[STEP 10-${ai + 1}] Setting date range...`);
      try {
        await page.locator('a:has-text("3개월")').click({ timeout: 5000 });
        console.log(`[STEP 10-${ai + 1}] ✓ 3개월 selected.`);
      } catch (e) {
        console.log(`[STEP 10-${ai + 1}] ⚠️ 3개월 button not found, continuing...`);
      }
      await page.waitForTimeout(1000);

      // Click 조회 button: a.ibz-btn.size-lg.fill with href=#! and exact text "조회"
      console.log(`[STEP 11-${ai + 1}] Clicking 조회...`);
      await page.locator('a.ibz-btn.size-lg.fill:text-is("조회")').first().click({ timeout: 5000 });
      await page.waitForTimeout(3000);
      console.log(`[STEP 11-${ai + 1}] ✓ Search executed.`);

      // Check for date error (account opened after start date)
      const dateError = await page.evaluate(() => {
        const body = document.body.textContent || '';
        return body.includes('계좌 개설일보다 과거를 선택할 수 없습니다') ||
               body.includes('조회시작일이 계좌개설일');
      });

      if (dateError) {
        console.log(`[STEP 11-${ai + 1}] ⚠️ Date error — retrying with 1개월...`);
        try {
          await page.locator('button:has-text("확인")').first().click({ timeout: 3000 });
        } catch (e) {}
        await page.waitForTimeout(1000);

        try {
          await page.locator('a:has-text("1개월")').click({ timeout: 5000 });
        } catch (e) {}
        await page.waitForTimeout(500);

        await page.locator('a.ibz-btn.size-lg.fill:text-is("조회")').first().click({ timeout: 5000 });
        await page.waitForTimeout(3000);
        console.log(`[STEP 11-${ai + 1}] ✓ Retried with 1개월.`);
      }

      // Download Excel
      console.log(`[STEP 12-${ai + 1}] Downloading Excel...`);
      const downloadPromise = page.waitForEvent('download', { timeout: 60000 });

      try {
        await page.locator('a:has-text("엑셀저장")').first().click({ timeout: 5000 });
      } catch (e) {
        try {
          await page.locator('.ibz-btn:has-text("엑셀저장")').first().click({ timeout: 5000 });
        } catch (e2) {
          await page.locator('button:has-text("엑셀저장")').first().click({ timeout: 5000 });
        }
      }

      // Check if download or no-data dialog
      const downloadResult = await Promise.race([
        downloadPromise.then(d => ({ type: 'download', data: d })),
        page.waitForTimeout(5000).then(() => ({ type: 'timeout' }))
      ]);

      if (downloadResult.type === 'timeout') {
        const noDataMsg = await page.evaluate(() => {
          const body = document.body.textContent || '';
          return body.includes('저장할 데이터가 없습니다') ||
                 body.includes('조회결과가 없습니다') ||
                 body.includes('거래내역이 없습니다');
        });
        if (noDataMsg) {
          console.log(`[STEP 12-${ai + 1}] ⚠️ No data for account ${acct.text}, skipping.`);
          try {
            await page.locator('button:has-text("확인"), a:has-text("확인")').first().click({ timeout: 3000 });
          } catch (e) {}
          await page.waitForTimeout(1000);
          continue;
        }
        console.log(`[STEP 12-${ai + 1}] ⚠️ Download timed out for account ${acct.text}`);
        continue;
      }

      const download = downloadResult.data;
      const suggestedFilename = download.suggestedFilename();
      const finalPath = path.resolve(downloadsPath, suggestedFilename);

      await page.waitForTimeout(500);
      const tempPath = await download.path();
      if (!tempPath || !fs.existsSync(tempPath)) {
        console.log(`[STEP 12-${ai + 1}] ⚠️ Download failed for account ${acct.text}`);
        continue;
      }

      fs.copyFileSync(tempPath, finalPath);
      const stats = fs.statSync(finalPath);
      console.log(`[STEP 12-${ai + 1}] ✓ Downloaded: ${finalPath} (${stats.size} bytes)`);
    }

    console.log(`\n🎉 NH Bank automation complete! Processed ${accounts.length} account(s).`);

  } finally {
    await arduino.close();
    await context.close();
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) {}
  }
})().catch(console.error);
