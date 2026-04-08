/**
 * KB Bank (KB국민은행) - Business Banking Automation
 * Site: obiz.kbstar.com
 * Flow: Login via cert -> 조회/이체 -> 거래내역 조회 -> Excel download per account
 *
 * Key notes:
 * - No frames — all interactions on main page
 * - Cert login opens a native window (need to detect type)
 * - Account dropdown has stable id="acct"
 * - Date input has stable id="조회검색시작일"
 * - Downloads per account in a loop
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
  const downloadsPath = path.join(os.homedir(), 'Downloads', 'EGDesk-Browser', 'kb');
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
    // STEP 1: Navigate to KB Bank business banking
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 1] Navigating to obiz.kbstar.com...');
    await page.goto('https://obiz.kbstar.com/quics?page=C019320');
    await page.waitForTimeout(3000);
    console.log('[STEP 1] ✓ Page loaded.');

    // ══════════════════════════════════════════════════════════════
    // STEP 2: Set DelfinoConfig + Click 공동인증서 로그인
    // ══════════════════════════════════════════════════════════════
    try {
      await page.evaluate(() => {
        if (typeof DelfinoConfig !== 'undefined') {
          DelfinoConfig.lastUsedCertFirst = true;
        }
      });
      console.log('[STEP 2] ✓ DelfinoConfig.lastUsedCertFirst = true');
    } catch (e) {
      console.log('[STEP 2] DelfinoConfig not available (will select cert manually).');
    }

    console.log('[STEP 2] Clicking 공동인증서 로그인...');
    try {
      await page.locator('button:has-text("공동인증서")').first().click({ timeout: 10000 });
    } catch (e) {
      await page.locator('.btn:has-text("공동인증서")').first().click({ timeout: 10000 });
    }
    console.log('[STEP 2] ✓ 공동인증서 로그인 clicked. Waiting for cert window...');

    // ══════════════════════════════════════════════════════════════
    // STEP 3: Wait for native cert window
    // Try multiple detection methods: INICertManUI, QWidget, or by name
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 3] Detecting cert window...');

    let windowFound = false;
    let windowType = '';
    for (let i = 0; i < 30; i++) {
      // Try INICertManUI (like Shinhan)
      try {
        const result = ps(
          "Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes; " +
          "$r = [System.Windows.Automation.AutomationElement]::RootElement; " +
          "$c = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, 'INICertManUI'); " +
          "$w = $r.FindFirst([System.Windows.Automation.TreeScope]::Children, $c); " +
          "if ($w) { $w.Current.Name } else { '' }"
        );
        if (result) {
          console.log(`[STEP 3] ✓ Found cert window (INICertManUI): "${result}"`);
          windowFound = true;
          windowType = 'INICertManUI';
          break;
        }
      } catch (e) {}

      // Try QWidget (like Hana)
      try {
        const result = ps(
          "Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes; " +
          "$r = [System.Windows.Automation.AutomationElement]::RootElement; " +
          "$c = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, 'QWidget'); " +
          "$w = $r.FindFirst([System.Windows.Automation.TreeScope]::Children, $c); " +
          "if ($w) { $w.Current.Name } else { '' }"
        );
        if (result) {
          console.log(`[STEP 3] ✓ Found cert window (QWidget): "${result}"`);
          windowFound = true;
          windowType = 'QWidget';
          break;
        }
      } catch (e) {}

      // Try by name "인증서 선택"
      try {
        const result = ps(
          "Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes; " +
          "$r = [System.Windows.Automation.AutomationElement]::RootElement; " +
          "$c = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, '인증서 선택'); " +
          "$w = $r.FindFirst([System.Windows.Automation.TreeScope]::Children, $c); " +
          "if ($w) { $w.Current.ClassName } else { '' }"
        );
        if (result) {
          console.log(`[STEP 3] ✓ Found cert window (인증서 선택, class=${result})`);
          windowFound = true;
          windowType = result;
          break;
        }
      } catch (e) {}

      await page.waitForTimeout(1000);
      if (i % 5 === 4) console.log(`[STEP 3] Still waiting... (${i + 1}s)`);
    }

    if (!windowFound) {
      throw new Error('Cert window not detected within 30 seconds. Run detect-cert-window.js to diagnose.');
    }

    await page.waitForTimeout(2000);

    // ══════════════════════════════════════════════════════════════
    // STEP 4: Select certificate (Enter) + Tab to password + type + confirm
    // KB uses QWidget (Delfino) — same pattern as IBK/Hana
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 4] Selecting certificate (Enter)...');
    await arduino.key('ENTER');
    await page.waitForTimeout(2000);
    console.log('[STEP 4] ✓ Certificate selected.');

    console.log('[STEP 4] Tabbing to password input...');
    for (let i = 1; i <= 4; i++) {
      await arduino.key('TAB');
      await page.waitForTimeout(300);
      console.log(`[STEP 4] Tab #${i}`);
    }

    const certPassword = process.env.CERT_PASSWORD;
    if (!certPassword) {
      throw new Error('CERT_PASSWORD not set. Use: $env:CERT_PASSWORD = "yourpassword"');
    }
    console.log('[STEP 4] Typing password via Arduino...');
    await arduino.type(certPassword);
    console.log('[STEP 4] ✓ Password typed.');
    await page.waitForTimeout(1000);

    console.log('[STEP 4] Pressing Enter to confirm...');
    await arduino.key('ENTER');
    await page.waitForTimeout(5000);
    console.log('[STEP 4] ✓ Cert login complete.');

    // ══════════════════════════════════════════════════════════════
    // STEP 5: Navigate to 조회/이체 > 거래내역 조회
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 5] Navigating to 거래내역 조회...');

    // Click 기업 tab first to reveal business menu
    console.log('[STEP 5] Clicking 기업...');
    const bizPos = await page.evaluate(() => {
      const els = document.querySelectorAll('a, button, span');
      for (const el of els) {
        if (el.textContent.trim() === '기업') {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
          }
        }
      }
      return null;
    });
    if (bizPos) {
      await page.mouse.click(bizPos.x, bizPos.y);
      await page.waitForTimeout(2000);
      console.log('[STEP 5] ✓ 기업 clicked.');
    } else {
      console.log('[STEP 5] ⚠️ 기업 not found, continuing...');
    }

    // Find 조회/이체 position and use page.mouse.move() for real mouseenter
    console.log('[STEP 5] Finding 조회/이체 menu...');
    const menuPos = await page.evaluate(() => {
      const links = document.querySelectorAll('a');
      for (const a of links) {
        if (a.textContent.trim() === '조회/이체') {
          const rect = a.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
          }
        }
      }
      return null;
    });

    if (menuPos) {
      console.log(`[STEP 5] Hovering at (${menuPos.x}, ${menuPos.y}) via page.mouse.move()...`);
      await page.mouse.move(menuPos.x, menuPos.y);
      await page.waitForTimeout(2000);

      // Find ALL 거래내역조회 links — need to click first (category), then second (actual page)
      const allSubs = await page.evaluate(() => {
        const links = document.querySelectorAll('a');
        const matches = [];
        for (const a of links) {
          if (a.textContent.trim() === '거래내역조회') {
            const rect = a.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              matches.push({ x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) });
            }
          }
        }
        return matches;
      });

      console.log(`[STEP 5] Found ${allSubs.length} 거래내역조회 link(s).`);

      if (allSubs.length >= 1) {
        // Click first 거래내역조회 (category)
        console.log(`[STEP 5] Clicking 1st 거래내역조회 at (${allSubs[0].x}, ${allSubs[0].y})...`);
        await page.mouse.click(allSubs[0].x, allSubs[0].y);
        await page.waitForTimeout(2000);

        // Debug: dump all visible links that contain 거래내역
        const debugLinks = await page.evaluate(() => {
          const links = document.querySelectorAll('a');
          const results = [];
          for (const a of links) {
            if (a.textContent.includes('거래내역')) {
              const rect = a.getBoundingClientRect();
              results.push({
                text: a.textContent.trim(),
                href: a.getAttribute('href'),
                visible: rect.width > 0 && rect.height > 0,
                x: Math.round(rect.x + rect.width / 2),
                y: Math.round(rect.y + rect.height / 2)
              });
            }
          }
          return results;
        });
        console.log('[STEP 5] All 거래내역 links after 1st click:');
        for (const l of debugLinks) {
          console.log(`    "${l.text}" href=${l.href} visible=${l.visible} (${l.x},${l.y})`);
        }

        // Click "거래내역 조회" (with space) — the actual page link
        const targetLink = debugLinks.find(l => l.visible && l.text === '거래내역 조회');
        if (targetLink) {
          console.log(`[STEP 5] Clicking "거래내역 조회" at (${targetLink.x}, ${targetLink.y})...`);
          await page.mouse.click(targetLink.x, targetLink.y);
        } else {
          console.log('[STEP 5] "거래내역 조회" not found, falling back to direct nav...');
          await page.goto('https://obiz.kbstar.com/quics?page=C102210');
        }
      } else {
        console.log('[STEP 5] 거래내역조회 not found after hover, falling back to direct nav...');
        await page.goto('https://obiz.kbstar.com/quics?page=C015668');
      }
    } else {
      console.log('[STEP 5] 조회/이체 not found, falling back to direct nav...');
      await page.goto('https://obiz.kbstar.com/quics?page=C015668');
    }
    await page.waitForTimeout(5000);
    console.log('[STEP 5] ✓ 거래내역 조회 page loaded.');

    // ══════════════════════════════════════════════════════════════
    // STEP 6: Get all accounts from dropdown, loop each one
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 6] Reading account list from dropdown...');

    // Debug: dump all select elements on page
    const allSelects = await page.evaluate(() => {
      const selects = document.querySelectorAll('select');
      return Array.from(selects).map(s => ({
        id: s.id,
        name: s.name,
        className: s.className,
        optionCount: s.options.length,
        firstOptions: Array.from(s.options).slice(0, 3).map(o => o.text.trim())
      }));
    });
    console.log(`[STEP 6] All selects on page (${allSelects.length}):`);
    for (const s of allSelects) {
      console.log(`    id="${s.id}" name="${s.name}" class="${s.className}" options=${s.optionCount} first=[${s.firstOptions.join(', ')}]`);
    }

    // Also dump all inputs
    const allInputs = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      return Array.from(inputs).slice(0, 15).map(i => ({
        id: i.id, name: i.name, type: i.type, value: i.value, placeholder: i.placeholder
      }));
    });
    console.log(`[STEP 6] First inputs on page:`);
    for (const inp of allInputs) {
      console.log(`    id="${inp.id}" name="${inp.name}" type=${inp.type} value="${inp.value}"`);
    }

    const acctSelect = page.locator('[id="acct"]');
    const accounts = await acctSelect.evaluate((sel) => {
      return Array.from(sel.options)
        .filter((opt) => opt.value) // include all options with a value
        .map((opt, i) => ({ index: i, value: opt.value, text: opt.text.trim() }));
    }).catch(() => []);

    console.log(`[STEP 6] Found ${accounts.length} account(s):`);
    for (const acct of accounts) {
      console.log(`    [${acct.index}] ${acct.text}`);
    }

    // Calculate start date (3 months ago)
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const startYear = String(threeMonthsAgo.getFullYear());
    const startMonth = String(threeMonthsAgo.getMonth() + 1).padStart(2, '0');

    for (let ai = 0; ai < accounts.length; ai++) {
      const acct = accounts[ai];
      console.log(`\n══ Account ${ai + 1}/${accounts.length}: ${acct.text} ══`);

      // Select account
      console.log(`[STEP 7-${ai + 1}] Selecting account...`);
      await acctSelect.selectOption({ index: acct.index });
      await page.waitForTimeout(1000);
      console.log(`[STEP 7-${ai + 1}] ✓ Account selected.`);

      // Set start date via fromYear and fromMonth selects
      console.log(`[STEP 8-${ai + 1}] Setting start date to ${startYear}-${startMonth}...`);
      await page.locator('#fromYear').selectOption(startYear);
      await page.waitForTimeout(300);
      await page.locator('#fromMonth').selectOption(startMonth);
      await page.waitForTimeout(1000);
      console.log(`[STEP 8-${ai + 1}] ✓ Start date set.`);

      // Click 조회
      console.log(`[STEP 9-${ai + 1}] Clicking 조회...`);
      try {
        await page.locator('button.u-button:has-text("조회")').first().click({ timeout: 5000 });
      } catch (e) {
        await page.locator('button:has-text("조회")').first().click({ timeout: 5000 });
      }
      await page.waitForTimeout(3000);
      console.log(`[STEP 9-${ai + 1}] ✓ Search executed.`);

      // Check for date error (account opened after start date)
      const dateError = await page.evaluate(() => {
        const body = document.body.textContent || '';
        return body.includes('계좌 개설일보다 과거를 선택할 수 없습니다') ||
               body.includes('조회시작일이 계좌개설일');
      });

      if (dateError) {
        console.log(`[STEP 9-${ai + 1}] ⚠️ Date error — retrying with current month...`);
        try {
          await page.locator('button:has-text("확인")').first().click({ timeout: 3000 });
        } catch (e) {}
        await page.waitForTimeout(1000);

        // Set date to current year/month
        const curYear = String(now.getFullYear());
        const curMonth = String(now.getMonth() + 1).padStart(2, '0');
        await page.locator('#fromYear').selectOption(curYear);
        await page.waitForTimeout(300);
        await page.locator('#fromMonth').selectOption(curMonth);
        await page.waitForTimeout(500);

        // Re-click 조회
        try {
          await page.locator('button.u-button:has-text("조회")').first().click({ timeout: 5000 });
        } catch (e) {
          await page.locator('button:has-text("조회")').first().click({ timeout: 5000 });
        }
        await page.waitForTimeout(3000);
        console.log(`[STEP 9-${ai + 1}] ✓ Retried with current month.`);
      }

      // Click 엑셀저장
      console.log(`[STEP 10-${ai + 1}] Downloading Excel...`);
      const downloadPromise = page.waitForEvent('download', { timeout: 60000 });

      try {
        await page.locator('button.u-button:has-text("엑셀저장")').first().click({ timeout: 5000 });
      } catch (e) {
        await page.locator('button:has-text("엑셀저장")').first().click({ timeout: 5000 });
      }

      // Check if "no data" dialog appeared instead of download
      const noDataAfterExcel = await Promise.race([
        downloadPromise.then(d => ({ type: 'download', data: d })),
        page.waitForTimeout(5000).then(() => ({ type: 'timeout' }))
      ]);

      if (noDataAfterExcel.type === 'timeout') {
        // Check if a no-data dialog appeared
        const noDataMsg = await page.evaluate(() => {
          const body = document.body.textContent || '';
          return body.includes('저장할 데이터가 없습니다') ||
                 body.includes('조회결과가 없습니다') ||
                 body.includes('거래내역이 없습니다');
        });
        if (noDataMsg) {
          console.log(`[STEP 10-${ai + 1}] ⚠️ No data for account ${acct.text}, skipping.`);
          try {
            await page.locator('button:has-text("확인")').first().click({ timeout: 3000 });
          } catch (e) {}
          await page.waitForTimeout(1000);
          continue;
        }
        console.log(`[STEP 10-${ai + 1}] ⚠️ Download timed out for account ${acct.text}`);
        continue;
      }

      const download = noDataAfterExcel.data;
      const suggestedFilename = download.suggestedFilename();
      const finalPath = path.resolve(downloadsPath, suggestedFilename);

      await page.waitForTimeout(500);
      const tempPath = await download.path();
      if (!tempPath || !fs.existsSync(tempPath)) {
        console.log(`[STEP 10-${ai + 1}] ⚠️ Download failed for account ${acct.text}`);
        continue;
      }

      fs.copyFileSync(tempPath, finalPath);
      const stats = fs.statSync(finalPath);
      console.log(`[STEP 10-${ai + 1}] ✓ Downloaded: ${finalPath} (${stats.size} bytes)`);
    }

    console.log(`\n🎉 KB Bank automation complete! Downloaded ${accounts.length} account(s).`);

  } finally {
    await arduino.close();
    await context.close();
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) {}
  }
})().catch(console.error);
