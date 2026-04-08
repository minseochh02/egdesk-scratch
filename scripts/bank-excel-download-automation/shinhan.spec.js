/**
 * Shinhan Bank (신한은행) - Business Banking Automation
 * Site: bizbank.shinhan.com
 * Flow: Login via cert -> 조회 -> 계좌별거래내역 -> Excel download
 *
 * Key notes:
 * - No frames — all interactions on main page
 * - Cert login opens a native window titled "인증서 선택"
 * - Similar to Hana (native cert window, Arduino HID for password)
 * - Poll for window name "인증서 선택" instead of QWidget class
 */

require('dotenv').config();
const { chromium } = require('playwright-core');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');
const { ArduinoHID } = require('./arduino-typer');

(async () => {
  // ── Connect Arduino first ──
  const arduino = new ArduinoHID();
  await arduino.connect();
  console.log('[Arduino] Connected and ready.');

  // ── Set up downloads directory ──
  const downloadsPath = path.join(os.homedir(), 'Downloads', 'EGDesk-Browser', 'shinhan');
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

  // Helper: simple PowerShell command with UTF-8
  function ps(cmd, timeout = 10000) {
    return execSync(
      `powershell -command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${cmd}"`,
      { encoding: 'utf8', timeout }
    ).trim();
  }

  try {
    // ══════════════════════════════════════════════════════════════
    // STEP 1: Navigate to Shinhan Bank business banking
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 1] Navigating to bizbank.shinhan.com...');
    await page.goto('https://bizbank.shinhan.com/main.html');
    await page.waitForTimeout(3000);
    console.log('[STEP 1] ✓ Page loaded.');

    // ══════════════════════════════════════════════════════════════
    // STEP 2: Close popup if present
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 2] Checking for popup...');
    try {
      await page.locator('[id="mf_divRPPop99_1775110936087_wframe_btn_closePopIco"]').click({ timeout: 3000 });
      console.log('[STEP 2] ✓ Popup closed.');
    } catch (e) {
      try {
        // Try generic close button
        await page.locator('input[value="팝업닫기"]').first().click({ timeout: 2000 });
        console.log('[STEP 2] ✓ Popup closed (fallback).');
      } catch (e2) {
        console.log('[STEP 2] No popup to close, continuing...');
      }
    }
    await page.waitForTimeout(2000);

    // ══════════════════════════════════════════════════════════════
    // STEP 3: Click 공동인증서 로그인 → opens native cert window
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 3] Clicking 공동인증서 로그인...');
    try {
      await page.locator('[id="mf_wfm_main_btn_goCert"]').click({ timeout: 10000 });
    } catch (e) {
      await page.locator('a:has-text("공동인증서 로그인")').first().click({ timeout: 10000 });
    }
    console.log('[STEP 3] ✓ 공동인증서 로그인 clicked. Waiting for cert window...');

    // ══════════════════════════════════════════════════════════════
    // STEP 4: Wait for native "인증서 선택" window
    // Poll using PowerShell UIA to find a window with that name.
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 4] Detecting cert window (INICertManUI)...');

    let windowFound = false;
    for (let i = 0; i < 30; i++) {
      try {
        const windowInfo = ps(
          "Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes; " +
          "$r = [System.Windows.Automation.AutomationElement]::RootElement; " +
          "$c = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, 'INICertManUI'); " +
          "$w = $r.FindFirst([System.Windows.Automation.TreeScope]::Children, $c); " +
          "if ($w) { $w.Current.Name } else { '' }"
        );
        if (windowInfo) {
          console.log(`[STEP 4] ✓ Found cert window (INICertManUI): "${windowInfo}"`);
          windowFound = true;
          break;
        }
      } catch (e) {}

      await page.waitForTimeout(1000);
      if (i % 5 === 4) console.log(`[STEP 4] Still waiting... (${i + 1}s)`);
    }

    if (!windowFound) {
      throw new Error('Cert window (INICertManUI) not detected within 30 seconds.');
    }

    await page.waitForTimeout(2000);

    // ══════════════════════════════════════════════════════════════
    // STEP 5: Type password and confirm (native window - Arduino only)
    // ══════════════════════════════════════════════════════════════
    const certPassword = process.env.CERT_PASSWORD;
    if (!certPassword) {
      throw new Error('CERT_PASSWORD not set. Use: $env:CERT_PASSWORD = "yourpassword"');
    }
    console.log('[STEP 5] Typing password via Arduino...');
    await arduino.type(certPassword);
    console.log('[STEP 5] ✓ Password typed.');
    await page.waitForTimeout(1000);

    console.log('[STEP 5] Pressing Enter to confirm...');
    await arduino.key('ENTER');
    await page.waitForTimeout(5000);
    console.log('[STEP 5] ✓ Cert login complete.');

    // ══════════════════════════════════════════════════════════════
    // STEP 8: Navigate to 조회 > 계좌별거래내역
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 8] Navigating to 계좌별거래내역...');

    // Click 조회 menu
    try {
      await page.locator('[id="mf_header_gen_topGnb_0_tbx_topItemText"]').click({ timeout: 5000 });
    } catch (e) {
      await page.locator('span:has-text("조회")').first().click({ timeout: 5000 });
    }
    await page.waitForTimeout(2000);

    // Click 계좌별거래내역 submenu
    try {
      await page.locator('span:has-text("계좌별거래내역")').first().click({ timeout: 5000 });
    } catch (e) {
      await page.locator('[id="mf_header_gen_topGnb_0_gen_menuBox_1_gen_section_0_gen_depth3_0_btn_dep3_text_span"]').click({ timeout: 5000 });
    }
    await page.waitForTimeout(3000);
    console.log('[STEP 8] ✓ 계좌별거래내역 page loaded.');

    // ══════════════════════════════════════════════════════════════
    // STEP 7: Find dynamic selectors and get all accounts
    // The wq_uuid_XXXX IDs change each session, so we find them
    // by looking for the select element and date input on the page.
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 7] Finding dynamic element IDs...');

    // Find account select: it's the select whose id contains "sbx_acctList"
    const acctSelectId = await page.evaluate(() => {
      const sel = document.querySelector('select[id*="sbx_acctList"]');
      return sel ? sel.id : null;
    });
    if (!acctSelectId) throw new Error('Could not find account dropdown (sbx_acctList)');
    console.log(`[STEP 7] Account dropdown: #${acctSelectId}`);

    // Find date input: it's the input whose id contains "ibx_fromDate"
    const fromDateId = await page.evaluate(() => {
      const inp = document.querySelector('input[id*="ibx_fromDate"]');
      return inp ? inp.id : null;
    });
    if (!fromDateId) throw new Error('Could not find from-date input (ibx_fromDate)');
    console.log(`[STEP 7] Date input: #${fromDateId}`);

    // Find search button: id contains "btn_search" but NOT the header search
    const searchBtnId = await page.evaluate(() => {
      const btns = document.querySelectorAll('input[id*="btn_search"]');
      for (const btn of btns) {
        if (!btn.id.includes('header') && btn.value === '조회') return btn.id;
      }
      // fallback: any btn_search not in header
      for (const btn of btns) {
        if (!btn.id.includes('header')) return btn.id;
      }
      return null;
    });
    if (!searchBtnId) throw new Error('Could not find search button (btn_search)');
    console.log(`[STEP 7] Search button: #${searchBtnId}`);

    // Find excel button: id contains "btn_excel"
    const excelBtnId = await page.evaluate(() => {
      const btn = document.querySelector('input[id*="btn_excel"]');
      return btn ? btn.id : null;
    });
    if (!excelBtnId) throw new Error('Could not find excel button (btn_excel)');
    console.log(`[STEP 7] Excel button: #${excelBtnId}`);

    const acctSelect = page.locator(`[id="${acctSelectId}"]`);
    const accounts = await acctSelect.evaluate((sel) => {
      return Array.from(sel.options)
        .filter((opt, i) => i > 0 && opt.value) // skip placeholder
        .map((opt, i) => ({ index: i + 1, value: opt.value, text: opt.text.trim() }));
    });

    console.log(`[STEP 7] Found ${accounts.length} account(s):`);
    for (const acct of accounts) {
      console.log(`    [${acct.index}] ${acct.text}`);
    }

    // Calculate start date (3 months ago, first of month)
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const startDateStr = `${threeMonthsAgo.getFullYear()}${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}01`;

    for (let ai = 0; ai < accounts.length; ai++) {
      const acct = accounts[ai];
      console.log(`\n══ Account ${ai + 1}/${accounts.length}: ${acct.text} ══`);

      // Select account
      console.log(`[STEP 8-${ai + 1}] Selecting account...`);
      await acctSelect.selectOption({ index: acct.index });
      await page.waitForTimeout(1000);
      console.log(`[STEP 8-${ai + 1}] ✓ Account selected.`);

      // Set start date via evaluate (bypass Playwright fill issues with custom inputs)
      console.log(`[STEP 9-${ai + 1}] Setting start date to ${startDateStr}...`);
      await page.evaluate(({ id, val }) => {
        const el = document.getElementById(id);
        if (el) {
          el.value = val;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, { id: fromDateId, val: startDateStr });
      await page.waitForTimeout(1000);
      console.log(`[STEP 9-${ai + 1}] ✓ Start date set.`);

      // Click 조회
      console.log(`[STEP 10-${ai + 1}] Clicking 조회...`);
      await page.locator(`[id="${searchBtnId}"]`).click({ timeout: 5000 });
      await page.waitForTimeout(3000);
      console.log(`[STEP 10-${ai + 1}] ✓ Search executed.`);

      // Click 엑셀다운
      console.log(`[STEP 11-${ai + 1}] Downloading Excel...`);
      await page.locator(`[id="${excelBtnId}"]`).click({ timeout: 5000 });
      await page.waitForTimeout(2000);

      // Check for "저장할 데이터가 없습니다" (no data) dialog
      const noData = await page.evaluate(() => {
        const el = document.querySelector('[class*="MessagePop"], [id*="MessagePop"]');
        if (el && el.textContent.includes('저장할 데이터가 없습니다')) return true;
        // Also check all visible text for the message
        const all = document.querySelectorAll('div, span, td');
        for (const node of all) {
          if (node.offsetParent !== null && node.textContent.includes('저장할 데이터가 없습니다')) return true;
        }
        return false;
      });

      if (noData) {
        console.log(`[STEP 11-${ai + 1}] ⚠️ No data for account ${acct.text}, skipping download.`);
        // Close the dialog
        try {
          await page.locator('a:has-text("확인")').first().click({ timeout: 3000 });
        } catch (e) {
          try {
            await page.locator('[id*="MessagePop"][id*="btn_ok"]').click({ timeout: 3000 });
          } catch (e2) {
            // Dialog might auto-dismiss or be handled by dialog handler
          }
        }
        await page.waitForTimeout(1000);
        continue;
      }

      // Click 아니요 on the "include personal info?" dialog
      try {
        await page.locator('a:has-text("아니요")').first().click({ timeout: 5000 });
      } catch (e) {
        try {
          await page.locator('[id*="MessagePop"][id*="btn_cancel"]').click({ timeout: 3000 });
        } catch (e2) {
          console.log(`[STEP 11-${ai + 1}] ⚠️ No 아니요 dialog, continuing...`);
        }
      }
      await page.waitForTimeout(2000);

      // Click 파일저장 to trigger download
      const downloadPromise = page.waitForEvent('download', { timeout: 60000 });

      try {
        await page.locator('input[value="파일저장"]').first().click({ timeout: 5000 });
      } catch (e) {
        await page.locator('[id*="excel_download"][id*="btn_saveFile"]').click({ timeout: 5000 });
      }

      const download = await downloadPromise;
      const suggestedFilename = download.suggestedFilename();
      const finalPath = path.resolve(downloadsPath, suggestedFilename);

      await page.waitForTimeout(500);
      const tempPath = await download.path();
      if (!tempPath || !fs.existsSync(tempPath)) {
        console.log(`[STEP 11-${ai + 1}] ⚠️ Download failed for account ${acct.text}`);
        continue;
      }

      fs.copyFileSync(tempPath, finalPath);
      const stats = fs.statSync(finalPath);
      console.log(`[STEP 11-${ai + 1}] ✓ Downloaded: ${finalPath} (${stats.size} bytes)`);
    }

    console.log(`\n🎉 Shinhan Bank automation complete! Downloaded ${accounts.length} account(s).`);

  } finally {
    await arduino.close();
    await context.close();
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) {}
  }
})().catch(console.error);
