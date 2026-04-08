/**
 * IBK (기업은행) - Business Banking Automation
 * Site: kiup.ibk.co.kr
 * Flow: Login via cert -> 거래내역조회 -> Excel download
 *
 * Key notes:
 * - Uses frame [name="mainframe"] for most interactions
 * - Cert login: 로그인 → 로그인 (frame) → 공인인증서 → cert window
 * - Cert window is native QWidget (Wizvera Delfino G3)
 * - DelfinoConfig.lastUsedCertFirst = true to pre-select cert
 * - Arduino HID for cert password entry
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
  const downloadsPath = path.join(os.homedir(), 'Downloads', 'EGDesk-Browser', 'ibk');
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

  // ── Helper: PowerShell with UTF-8 ──
  function ps(cmd, timeout = 10000) {
    return execSync(
      `powershell -command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${cmd}"`,
      { encoding: 'utf8', timeout }
    ).trim();
  }

  try {
    // ══════════════════════════════════════════════════════════════
    // STEP 1: Navigate to IBK business banking
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 1] Navigating to kiup.ibk.co.kr...');
    await page.goto('https://kiup.ibk.co.kr/uib/jsp/index.jsp');
    await page.waitForTimeout(3000);

    const allFrames = page.frames();
    console.log(`[STEP 1] Page loaded. ${allFrames.length} frame(s):`);
    for (const f of allFrames) {
      console.log(`  - "${f.name() || '(main)'}" url=${f.url().substring(0, 80)}`);
    }
    console.log('[STEP 1] ✓ Page loaded.');

    // ══════════════════════════════════════════════════════════════
    // STEP 2: Click 로그인 (navigates to login page)
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 2] Clicking 로그인...');
    const frame = page.frame({ name: 'mainframe' });
    if (!frame) throw new Error('mainframe not found');

    try {
      await frame.locator('a:has-text("로그인")').first().click({ timeout: 10000 });
    } catch (e) {
      await page.locator('a:has-text("로그인")').first().click({ timeout: 10000 });
    }
    await page.waitForTimeout(2000);
    console.log('[STEP 2] ✓ 로그인 clicked.');

    // ══════════════════════════════════════════════════════════════
    // STEP 3: Set lastUsedCertFirst, then click 공인인증서 → opens cert window
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 3] Setting lastUsedCertFirst and clicking 공인인증서...');

    try {
      await frame.evaluate(() => {
        if (typeof DelfinoConfig !== 'undefined') {
          DelfinoConfig.lastUsedCertFirst = true;
        }
      });
      console.log('[STEP 3] ✓ DelfinoConfig.lastUsedCertFirst = true');
    } catch (e) {
      console.log(`[STEP 3] ⚠️ Could not set lastUsedCertFirst: ${e.message}`);
    }

    // Click 공인인증서 button (class .ec)
    try {
      await frame.locator('.ec').first().click({ timeout: 10000 });
    } catch (e) {
      await frame.locator('text=(구 공인인증서)').first().click({ timeout: 10000 });
    }
    console.log('[STEP 3] ✓ 공인인증서 clicked. Cert window should open.');

    // ══════════════════════════════════════════════════════════════
    // STEP 5: Wait for native cert window (QWidget)
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 4] Detecting cert window...');

    let windowFound = false;
    for (let i = 0; i < 30; i++) {
      try {
        const qwidgetCheck = ps(
          "Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes; " +
          "$r = [System.Windows.Automation.AutomationElement]::RootElement; " +
          "$c = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, 'QWidget'); " +
          "$w = $r.FindFirst([System.Windows.Automation.TreeScope]::Children, $c); " +
          "if ($w) { $w.Current.Name } else { '' }"
        );
        if (qwidgetCheck) {
          console.log(`[STEP 4] ✓ Found cert window (QWidget): "${qwidgetCheck}"`);
          windowFound = true;
          break;
        }
      } catch (e) {}

      await page.waitForTimeout(1000);
      if (i % 5 === 4) console.log(`[STEP 4] Still waiting... (${i + 1}s)`);
    }

    if (!windowFound) {
      throw new Error('Cert window (QWidget) not detected within 30 seconds.');
    }
    await page.waitForTimeout(2000);

    // ══════════════════════════════════════════════════════════════
    // STEP 6: Select cert (first one, pre-selected by lastUsedCertFirst)
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 5] Selecting certificate (Enter)...');
    await arduino.key('ENTER');
    await page.waitForTimeout(2000);
    console.log('[STEP 5] ✓ Certificate selected.');

    // ══════════════════════════════════════════════════════════════
    // STEP 7: Tab to password input and type password
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 6] Tabbing to password input...');
    for (let i = 1; i <= 4; i++) {
      await arduino.key('TAB');
      await page.waitForTimeout(300);
      console.log(`[STEP 6] Tab #${i}`);
    }

    const certPassword = process.env.CERT_PASSWORD;
    if (!certPassword) {
      throw new Error('CERT_PASSWORD not set. Use: $env:CERT_PASSWORD = "yourpassword"');
    }
    console.log('[STEP 6] Typing password via Arduino...');
    await arduino.type(certPassword);
    console.log('[STEP 6] ✓ Password typed.');
    await page.waitForTimeout(2000);

    // ══════════════════════════════════════════════════════════════
    // STEP 8: Press Enter to confirm (확인)
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 7] Pressing Enter to confirm...');
    await arduino.key('ENTER');
    await page.waitForTimeout(5000);

    // Verify cert window closed
    try {
      const stillOpen = ps(
        "Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes; " +
        "$r = [System.Windows.Automation.AutomationElement]::RootElement; " +
        "$c = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, 'QWidget'); " +
        "$w = $r.FindFirst([System.Windows.Automation.TreeScope]::Children, $c); " +
        "if ($w) { 'OPEN' } else { 'CLOSED' }"
      );
      console.log(`[STEP 7] Cert window: ${stillOpen}`);
    } catch (e) {}
    console.log('[STEP 7] ✓ Cert login complete.');

    // ══════════════════════════════════════════════════════════════
    // STEP 8: Close any popup overlay
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 8] Checking for popups...');
    await page.waitForTimeout(3000);
    try {
      const popupSelectors = [
        'button:has-text("닫기")',
        'button:has-text("확인")',
        'a:has-text("닫기")',
        '.popup_close',
        '.btn_close',
      ];
      for (const sel of popupSelectors) {
        try {
          const btn = frame.locator(sel).first();
          if (await btn.isVisible({ timeout: 1000 })) {
            await btn.click();
            console.log(`[STEP 8] ✓ Popup closed via: ${sel}`);
            await page.waitForTimeout(1000);
          }
        } catch (e) {}
      }
    } catch (e) {
      console.log('[STEP 8] No popup to close.');
    }

    // ══════════════════════════════════════════════════════════════
    // STEP 9: Navigate to 거래내역조회
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 9] Navigating to 거래내역조회...');

    // Debug: dump current page URL and frame URLs
    console.log(`[STEP 9] Page URL: ${page.url()}`);
    const framesNow = page.frames();
    for (const f of framesNow) {
      console.log(`[STEP 9] Frame: "${f.name() || '(main)'}" url=${f.url().substring(0, 100)}`);
    }

    // Re-acquire mainframe (it may have changed after login)
    const frame2 = page.frame({ name: 'mainframe' });
    const activeFrame = frame2 || frame;
    console.log(`[STEP 9] Using frame: ${frame2 ? 'mainframe (re-acquired)' : 'original frame'}`);

    // Debug: dump visible links in frame
    try {
      const links = await activeFrame.evaluate(() => {
        return Array.from(document.querySelectorAll('a'))
          .filter(a => a.offsetParent !== null && a.textContent.trim())
          .slice(0, 30)
          .map(a => ({ text: a.textContent.trim().substring(0, 40), href: a.href?.substring(0, 60) || '' }));
      });
      console.log(`[STEP 9] Visible links in frame (top 30):`);
      for (const l of links) {
        const highlight = /거래|조회|내역|이체/.test(l.text) ? ' ◄◄◄' : '';
        console.log(`    "${l.text}" -> ${l.href}${highlight}`);
      }
    } catch (e) {
      console.log(`[STEP 9] Could not dump frame links: ${e.message}`);
    }

    // Also dump visible links on main page
    try {
      const pageLinks = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a'))
          .filter(a => a.offsetParent !== null && a.textContent.trim())
          .slice(0, 30)
          .map(a => ({ text: a.textContent.trim().substring(0, 40), href: a.href?.substring(0, 60) || '' }));
      });
      console.log(`[STEP 9] Visible links on page (top 30):`);
      for (const l of pageLinks) {
        const highlight = /거래|조회|내역|이체/.test(l.text) ? ' ◄◄◄' : '';
        console.log(`    "${l.text}" -> ${l.href}${highlight}`);
      }
    } catch (e) {
      console.log(`[STEP 9] Could not dump page links: ${e.message}`);
    }

    // 거래내역조회 links are already in the frame DOM — click directly via evaluate
    console.log('[STEP 9] Clicking 거래내역조회 via evaluate...');
    await activeFrame.evaluate(() => {
      const links = document.querySelectorAll('a');
      for (const a of links) {
        if (a.textContent.trim() === '거래내역조회') { a.click(); return; }
      }
    });

    await page.waitForTimeout(3000);
    console.log('[STEP 9] ✓ 거래내역조회 page loaded.');

    // ══════════════════════════════════════════════════════════════
    // STEP 10: Get all accounts from dropdown, loop each one
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 10] Reading account list from dropdown...');

    const acctSelect = frame.locator('[id="ecb_user_num01"]');
    const accounts = await acctSelect.evaluate((sel) => {
      return Array.from(sel.options)
        .filter((opt) => opt.value) // skip empty placeholder
        .map((opt, i) => ({ index: i, value: opt.value, text: opt.text.trim() }));
    });

    console.log(`[STEP 10] Found ${accounts.length} account(s):`);
    for (const acct of accounts) {
      console.log(`    [${acct.index}] ${acct.text}`);
    }

    // Calculate dates
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const startYY = String(threeMonthsAgo.getFullYear());
    const startMM = String(threeMonthsAgo.getMonth() + 1).padStart(2, '0');
    const startDD = '01';

    const yesterday = new Date(now.getTime() - 86400000);
    const yestYY = String(yesterday.getFullYear());
    const yestMM = String(yesterday.getMonth() + 1).padStart(2, '0');
    const yestDD = String(yesterday.getDate()).padStart(2, '0');

    for (let ai = 0; ai < accounts.length; ai++) {
      const acct = accounts[ai];
      console.log(`\n══ Account ${ai + 1}/${accounts.length}: ${acct.text} ══`);

      // Select account
      console.log(`[STEP 11-${ai + 1}] Selecting account...`);
      await acctSelect.selectOption({ index: acct.index });
      await page.waitForTimeout(1000);
      console.log(`[STEP 11-${ai + 1}] ✓ Account selected.`);

      // Set start date (3 months ago)
      let usedYY = startYY, usedMM = startMM, usedDD = startDD;
      console.log(`[STEP 12-${ai + 1}] Setting start date to ${usedYY}-${usedMM}-${usedDD}...`);
      try {
        await frame.locator('[id="inqy_sttg_ymd_yy"]').selectOption(usedYY);
        await frame.locator('[id="inqy_sttg_ymd_mm"]').selectOption(usedMM);
        await frame.locator('[id="inqy_sttg_ymd_dd"]').selectOption(usedDD);
        console.log(`[STEP 12-${ai + 1}] ✓ Start date set.`);
      } catch (e) {
        console.log(`[STEP 12-${ai + 1}] ⚠️ Date setting: ${e.message}`);
      }
      await page.waitForTimeout(1000);

      // Click 조회
      console.log(`[STEP 13-${ai + 1}] Clicking 조회...`);
      try {
        await frame.locator('[id="_btnSubmit"]').click({ timeout: 5000 });
      } catch (e) {
        await frame.locator('button:has-text("조회")').click({ timeout: 5000 });
      }
      await page.waitForTimeout(3000);

      // Check for date error dialog (계좌 개설일보다 과거) — retry with yesterday
      let dateRetried = false;
      try {
        const alertText = await frame.evaluate(() => {
          const els = document.querySelectorAll('.alert, .popup, [class*="msg"], [class*="alert"]');
          for (const el of els) {
            if (el.offsetParent !== null && el.textContent.includes('개설일')) return el.textContent;
          }
          return '';
        });
        if (alertText) {
          console.log(`[STEP 13-${ai + 1}] ⚠️ Date before account opening. Retrying with yesterday...`);
          try {
            await frame.locator('button:has-text("확인")').first().click({ timeout: 3000 });
          } catch (e) {}
          await page.waitForTimeout(1000);

          usedYY = yestYY; usedMM = yestMM; usedDD = yestDD;
          await frame.locator('[id="inqy_sttg_ymd_yy"]').selectOption(usedYY);
          await frame.locator('[id="inqy_sttg_ymd_mm"]').selectOption(usedMM);
          await frame.locator('[id="inqy_sttg_ymd_dd"]').selectOption(usedDD);
          await page.waitForTimeout(500);

          try {
            await frame.locator('[id="_btnSubmit"]').click({ timeout: 5000 });
          } catch (e) {
            await frame.locator('button:has-text("조회")').click({ timeout: 5000 });
          }
          await page.waitForTimeout(3000);
          dateRetried = true;
        }
      } catch (e) {}

      console.log(`[STEP 13-${ai + 1}] ✓ Search executed (date: ${usedYY}-${usedMM}-${usedDD}).`);

      // Download Excel: 저장 → 엑셀파일저장 → DownloadExcel → DownloadButton
      console.log(`[STEP 14-${ai + 1}] Downloading Excel...`);

      // Check for no data first
      const noData = await frame.evaluate(() => {
        const body = document.body?.textContent || '';
        return body.includes('저장할 데이터가 없습니다') || body.includes('조회된 데이터가 없습니다');
      });

      if (noData) {
        console.log(`[STEP 14-${ai + 1}] ⚠️ No data for account ${acct.text}, skipping.`);
        try {
          await frame.locator('button:has-text("확인")').first().click({ timeout: 3000 });
        } catch (e) {}
        await page.waitForTimeout(1000);
        continue;
      }

      const downloadPromise = page.waitForEvent('download', { timeout: 60000 });

      try {
        await frame.locator('span:has-text("저장")').first().click({ timeout: 5000 });
        await page.waitForTimeout(1000);
      } catch (e) {
        console.log(`[STEP 14-${ai + 1}] ⚠️ 저장 click: ${e.message}`);
      }

      try {
        await frame.locator('span:has-text("엑셀파일저장")').first().click({ timeout: 5000 });
        await page.waitForTimeout(1000);
      } catch (e) {
        console.log(`[STEP 14-${ai + 1}] ⚠️ 엑셀파일저장 click: ${e.message}`);
      }

      try {
        await frame.locator('[id="DownloadExcel"]').click({ timeout: 5000 });
        await page.waitForTimeout(500);
      } catch (e) {
        console.log(`[STEP 14-${ai + 1}] ⚠️ DownloadExcel click: ${e.message}`);
      }

      try {
        await frame.locator('[id="DownloadButton"]').click({ timeout: 5000 });
      } catch (e) {
        console.log(`[STEP 14-${ai + 1}] ⚠️ DownloadButton click: ${e.message}`);
      }

      const download = await downloadPromise;
      const suggestedFilename = download.suggestedFilename();
      const finalPath = path.resolve(downloadsPath, suggestedFilename);

      await page.waitForTimeout(500);
      const tempPath = await download.path();
      if (!tempPath || !fs.existsSync(tempPath)) {
        console.log(`[STEP 14-${ai + 1}] ⚠️ Download failed for account ${acct.text}`);
        continue;
      }

      fs.copyFileSync(tempPath, finalPath);
      const stats = fs.statSync(finalPath);
      console.log(`[STEP 14-${ai + 1}] ✓ Downloaded: ${finalPath} (${stats.size} bytes)`);
    }

    console.log(`\n🎉 IBK automation complete! Processed ${accounts.length} account(s).`);

  } finally {
    await arduino.close();
    await context.close();
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) {}
  }
})().catch(console.error);
