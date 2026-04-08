/**
 * Hana Bank (하나은행) - Business Banking Automation
 * Site: biz.kebhana.com
 * Flow: Login via cert -> 조회 -> 거래내역 조회 -> Excel download
 *
 * Key notes:
 * - Uses iframe [id="hanaMainframe"] for most interactions
 * - Cert login may open a new window/popup
 * - Arduino HID for cert password entry (click to focus, then type)
 * - Cert window is native QWidget (Wizvera Delfino G3) - uses OCR to read cert list
 */

require('dotenv').config();
const { chromium } = require('playwright-core');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { ArduinoHID } = require('./arduino-typer');

(async () => {
  // ── Connect Arduino first (before browser, to avoid reset issues) ──
  const arduino = new ArduinoHID();
  await arduino.connect();
  console.log('[Arduino] Connected and ready.');

  // ── Set up downloads directory ──
  const downloadsPath = path.join(os.homedir(), 'Downloads', 'EGDesk-Browser', 'hana');
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

  // ── SIGINT handler for clean Arduino release ──
  process.on('SIGINT', async () => {
    console.log('\n[SIGINT] Cleaning up...');
    try { await arduino.close(); } catch (e) {}
    try { await context.close(); } catch (e) {}
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) {}
    process.exit(0);
  });

  // Helper: close any popup overlays on page or frame
  async function closePopups() {
    for (const target of [page, page.frame({ name: 'hanaMainframe' })].filter(Boolean)) {
      try {
        const closed = await target.evaluate(() => {
          let count = 0;
          // Close buttons with common popup-close text
          const btns = document.querySelectorAll('button, a, span, div');
          for (const b of btns) {
            const text = b.textContent?.trim() || '';
            if ((text === '닫기' || text === '팝업 닫기' || text === '오늘 하루 열지않기' || text === '확인') && b.offsetParent !== null) {
              const rect = b.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                b.click();
                count++;
              }
            }
          }
          // Also try closing any visible modal/layer
          const layers = document.querySelectorAll('.layer_popup, .popup_wrap, .pop_wrap, [class*="popup"]');
          for (const l of layers) {
            const closeBtn = l.querySelector('.btn_close, .close, [class*="close"]');
            if (closeBtn) { closeBtn.click(); count++; }
          }
          return count;
        });
        if (closed > 0) console.log(`[Popup] Closed ${closed} popup(s).`);
      } catch (e) {}
    }
  }

  try {
    // ══════════════════════════════════════════════════════════════
    // STEP 1: Navigate to Hana Bank business banking
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 1] Navigating to biz.kebhana.com...');
    await page.goto('https://biz.kebhana.com/index.jsp?pc');
    await page.waitForTimeout(3000);

    // Detect all frames on the page (Hana uses frameset, not iframes)
    const allFrames = page.frames();
    console.log(`[STEP 1] Page loaded. ${allFrames.length} frame(s) detected:`);
    for (const f of allFrames) {
      console.log(`  - "${f.name() || '(main)'}" url=${f.url().substring(0, 80)}`);
    }

    // Get the main frame by name (frameset requires this, not frameLocator)
    const frame = page.frame({ name: 'hanaMainframe' });
    if (!frame) throw new Error('hanaMainframe not found');
    console.log('[STEP 1] ✓ hanaMainframe found.');

    // Close any initial popups
    await closePopups();
    await page.waitForTimeout(1000);

    // ══════════════════════════════════════════════════════════════
    // STEP 2: Click 로그인 #1 (main page button)
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 2] Clicking 로그인 #1 (main page)...');
    await frame.locator('button:has-text("로그인")').first().click({ timeout: 10000 });
    await page.waitForTimeout(2000);
    console.log('[STEP 2] ✓ First 로그인 clicked.');

    // ══════════════════════════════════════════════════════════════
    // STEP 3: Click 로그인 #2 → opens 전자 서명 작성 window
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 3] Setting lastUsedCertFirst, then clicking 로그인 #2...');

    // Enable "last used cert first" so the correct cert is pre-selected
    try {
      await frame.evaluate(() => {
        if (typeof DelfinoConfig !== 'undefined') {
          DelfinoConfig.lastUsedCertFirst = true;
        }
      });
      console.log('[STEP 3] ✓ DelfinoConfig.lastUsedCertFirst = true');
    } catch (e) {
      console.log('[STEP 3] DelfinoConfig not available (will select cert manually).');
    }

    await frame.locator('[id="certLogin"]').click({ timeout: 10000 });
    console.log('[STEP 3] ✓ Second 로그인 clicked.');

    // ══════════════════════════════════════════════════════════════
    // STEP 4: Wait for native 전자 서명 작성 window
    // This is a native Windows app (not a browser tab), so we use
    // PowerShell to detect it, and Arduino for all interaction.
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 4] Detecting cert window...');
    const { execSync } = require('child_process');
    const scriptDir = path.dirname(require.resolve('./hana.spec.js'));
    const enumWindowsScript = path.join(scriptDir, 'enum-windows.ps1');

    // Helper: get all visible window titles using Win32 EnumWindows
    function getAllWindowTitles() {
      try {
        const result = execSync(
          `powershell -ExecutionPolicy Bypass -File "${enumWindowsScript}"`,
          { encoding: 'utf8', timeout: 10000 }
        ).trim();
        return result.split('\n').map(s => s.trim()).filter(Boolean);
      } catch (e) {
        console.log(`[STEP 4] EnumWindows error: ${e.message}`);
        return [];
      }
    }

    // Helper: simple PowerShell command with UTF-8
    function ps(cmd, timeout = 10000) {
      return execSync(
        `powershell -command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${cmd}"`,
        { encoding: 'utf8', timeout }
      ).trim();
    }

    // First dump: show ALL windows right now
    let titles = getAllWindowTitles();
    console.log(`[STEP 4] All visible windows right after certLogin (${titles.length}):`);
    for (const t of titles) console.log(`  - "${t}"`);

    // Poll for the cert window - detect by QWidget class (security module uses Qt)
    // The enum-windows.ps1 returns titles, but we also need to check for QWidget
    // Use a separate PS command that checks for QWidget class specifically
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

      // Fallback: also check enum-windows output
      titles = getAllWindowTitles();
      // The title might come through garbled, so just check if any new window appeared
      if (i === 0) {
        console.log(`[STEP 4] Windows (${titles.length}): ${titles.join(' | ')}`);
      }

      await page.waitForTimeout(1000);
      if (i % 5 === 4) console.log(`[STEP 4] Still waiting... (${i + 1}s)`);
    }

    if (!windowFound) {
      throw new Error('Cert window (QWidget) not detected within 30 seconds.');
    }

    await page.waitForTimeout(2000);

    // ══════════════════════════════════════════════════════════════
    // STEP 5: Select certificate (native window - Arduino only)
    // The first cert should already be highlighted. Press Enter.
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 5] Selecting certificate in native window...');
    await arduino.key('ENTER');
    await page.waitForTimeout(2000);
    console.log('[STEP 5] ✓ Certificate selected (Enter pressed).');

    // ══════════════════════════════════════════════════════════════
    // STEP 6: Tab to password input and type password
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 6] Tabbing to password input in native window...');
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
    // STEP 7: Press Enter to confirm (확인)
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 7] Pressing Enter to confirm...');
    await arduino.key('ENTER');
    await page.waitForTimeout(5000);
    console.log('[STEP 7] ✓ Cert login complete.');

    // ══════════════════════════════════════════════════════════════
    // STEP 8: Close any popup overlays after login
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 8] Closing popups after login...');
    await closePopups();
    await page.waitForTimeout(2000);
    await closePopups(); // try again in case multiple popups
    await page.waitForTimeout(1000);

    // ══════════════════════════════════════════════════════════════
    // STEP 9: Navigate to 조회 > 거래내역 조회
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 9] Navigating to 거래내역 조회...');

    // Click 조회 menu
    try {
      await frame.locator('[id="15000"]').click({ timeout: 5000 });
    } catch (e) {
      await page.getByRole('link', { name: '조회' }).click({ timeout: 5000 });
    }
    await page.waitForTimeout(2000);

    // Click 거래내역 조회 — the actual page link (not the toggle)
    // Target: a.btn_item with href containing menuItemId=wcdep700r16i
    try {
      await frame.locator('a[href*="menuItemId=wcdep700r16i"]').first().click({ timeout: 5000 });
    } catch (e) {
      // Fallback: find visible 거래내역 조회 link that's NOT a toggle (no href=#)
      console.log('[STEP 9] Direct selector failed, trying evaluate...');
      await frame.evaluate(() => {
        const links = document.querySelectorAll('a.btn_item');
        for (const a of links) {
          if (a.textContent.trim() === '거래내역 조회' && a.getAttribute('href') !== '#') {
            const rect = a.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              a.click();
              return;
            }
          }
        }
      });
    }
    await page.waitForTimeout(3000);
    console.log('[STEP 9] ✓ Transaction inquiry page loaded.');

    // Close any popups on the transaction page
    await closePopups();
    await page.waitForTimeout(1000);

    // ══════════════════════════════════════════════════════════════
    // STEP 10: Get all accounts from dropdown, loop each one
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 10] Reading account list from dropdown...');

    // Debug: dump all selects in the frame to find the account dropdown
    const allSelects = await frame.evaluate(() => {
      const selects = document.querySelectorAll('select');
      return Array.from(selects).map(s => ({
        id: s.id,
        name: s.name,
        className: s.className,
        optionCount: s.options.length,
        firstOptions: Array.from(s.options).slice(0, 5).map(o => o.text.trim())
      }));
    });
    console.log(`[STEP 10] All selects in frame (${allSelects.length}):`);
    for (const s of allSelects) {
      console.log(`    id="${s.id}" name="${s.name}" options=${s.optionCount} first=[${s.firstOptions.join(', ')}]`);
    }

    // Try common account dropdown IDs
    let acctSelectId = null;
    for (const candidateId of ['sAcctNo', 'sAccount', 'ID_sAcctNo', 'acct', 'drw_acno', 'sInqAcctNo']) {
      const exists = await frame.evaluate((id) => !!document.getElementById(id), candidateId);
      if (exists) {
        acctSelectId = candidateId;
        break;
      }
    }

    // If none found, try to find first select with account-like options
    if (!acctSelectId) {
      acctSelectId = await frame.evaluate(() => {
        const selects = document.querySelectorAll('select');
        for (const s of selects) {
          for (const opt of s.options) {
            if (/\d{3}-\d+/.test(opt.text) || /\d{10,}/.test(opt.value)) {
              return s.id || null;
            }
          }
        }
        return null;
      });
    }

    if (!acctSelectId) {
      console.log('[STEP 10] ⚠️ Could not find account dropdown. Downloading current view only.');
    }

    let accounts = [];
    if (acctSelectId) {
      const acctSelect = frame.locator(`#${acctSelectId}`);
      accounts = await acctSelect.evaluate((sel) => {
        return Array.from(sel.options)
          .filter((opt) => opt.value && opt.value !== '' && !opt.text.includes('선택'))
          .map((opt, i) => ({ index: i, value: opt.value, text: opt.text.trim() }));
      }).catch(() => []);

      if (accounts.length === 0) {
        accounts = await acctSelect.evaluate((sel) => {
          return Array.from(sel.options)
            .filter((opt, i) => i > 0 && opt.value)
            .map((opt, i) => ({ index: i + 1, value: opt.value, text: opt.text.trim() }));
        }).catch(() => []);
      }
    }

    // If no dropdown or no accounts, treat as single-account download
    if (accounts.length === 0) {
      accounts = [{ index: 0, value: '', text: 'default' }];
    }

    console.log(`[STEP 10] Found ${accounts.length} account(s):`);
    for (const acct of accounts) {
      console.log(`    [${acct.index}] ${acct.text}`);
    }

    // Calculate start date (3 months ago)
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const startDate = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;

    for (let ai = 0; ai < accounts.length; ai++) {
      const acct = accounts[ai];
      console.log(`\n══ Account ${ai + 1}/${accounts.length}: ${acct.text} ══`);

      // Select account (skip if single default)
      if (acctSelectId && acct.value) {
        console.log(`[STEP 11-${ai + 1}] Selecting account...`);
        await frame.locator(`#${acctSelectId}`).selectOption({ value: acct.value });
        await page.waitForTimeout(1000);
        console.log(`[STEP 11-${ai + 1}] ✓ Account selected.`);
      }

      // Set start date
      console.log(`[STEP 12-${ai + 1}] Setting start date to ${startDate}...`);
      try {
        await frame.evaluate((val) => {
          const el = document.getElementById('sInqStrDt');
          if (el) {
            el.value = val;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, startDate);
        console.log(`[STEP 12-${ai + 1}] ✓ Start date set.`);
      } catch (e) {
        console.log(`[STEP 12-${ai + 1}] ⚠️ Could not set start date: ${e.message}`);
      }
      await page.waitForTimeout(500);

      // Set query count to 100
      try {
        await frame.evaluate(() => {
          const el = document.getElementById('ID_sRqstNcnt4');
          if (el) { el.value = '100'; }
        });
      } catch (e) {}

      // Click 조회 (search)
      console.log(`[STEP 13-${ai + 1}] Clicking 조회...`);
      try {
        await frame.locator('button:has-text("조회")').click({ timeout: 5000 });
      } catch (e) {
        await frame.evaluate(() => {
          const btns = document.querySelectorAll('button');
          for (const b of btns) {
            if (b.textContent.trim() === '조회') { b.click(); return; }
          }
        });
      }
      await page.waitForTimeout(3000);
      console.log(`[STEP 13-${ai + 1}] ✓ Search executed.`);

      // Check for date error
      const dateError = await frame.evaluate(() => {
        const body = document.body.textContent || '';
        return body.includes('계좌 개설일보다 과거를 선택할 수 없습니다') ||
               body.includes('조회시작일이 계좌개설일');
      });

      if (dateError) {
        console.log(`[STEP 13-${ai + 1}] ⚠️ Date error — retrying with yesterday...`);
        try {
          await frame.locator('button:has-text("확인")').first().click({ timeout: 3000 });
        } catch (e) {}
        await page.waitForTimeout(1000);

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
        await frame.evaluate((val) => {
          const el = document.getElementById('sInqStrDt');
          if (el) { el.value = val; el.dispatchEvent(new Event('change', { bubbles: true })); }
        }, yStr);
        await page.waitForTimeout(500);

        try {
          await frame.locator('button:has-text("조회")').click({ timeout: 5000 });
        } catch (e) {}
        await page.waitForTimeout(3000);
        console.log(`[STEP 13-${ai + 1}] ✓ Retried with yesterday.`);
      }

      // Download Excel
      console.log(`[STEP 14-${ai + 1}] Downloading Excel...`);
      const downloadPromise = page.waitForEvent('download', { timeout: 60000 });

      try {
        await frame.locator('button:has-text("전체엑셀다운로드")').click({ timeout: 5000 });
      } catch (e) {
        try {
          await frame.locator('button:has-text("엑셀다운로드")').click({ timeout: 5000 });
        } catch (e2) {
          await frame.locator('button:has-text("엑셀")').first().click({ timeout: 5000 });
        }
      }

      // Check if download or no-data
      const downloadResult = await Promise.race([
        downloadPromise.then(d => ({ type: 'download', data: d })),
        page.waitForTimeout(5000).then(() => ({ type: 'timeout' }))
      ]);

      if (downloadResult.type === 'timeout') {
        const noDataMsg = await frame.evaluate(() => {
          const body = document.body.textContent || '';
          return body.includes('저장할 데이터가 없습니다') ||
                 body.includes('조회결과가 없습니다') ||
                 body.includes('거래내역이 없습니다') ||
                 body.includes('조회된 데이터가 없습니다');
        });
        if (noDataMsg) {
          console.log(`[STEP 14-${ai + 1}] ⚠️ No data for account ${acct.text}, skipping.`);
          try {
            await frame.locator('button:has-text("확인")').first().click({ timeout: 3000 });
          } catch (e) {}
          await page.waitForTimeout(1000);
          continue;
        }
        console.log(`[STEP 14-${ai + 1}] ⚠️ Download timed out for account ${acct.text}`);
        continue;
      }

      const download = downloadResult.data;
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

    console.log(`\n🎉 Hana Bank automation complete! Processed ${accounts.length} account(s).`);

  } finally {
    await arduino.close();
    await context.close();
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) {}
  }
})().catch(console.error);
