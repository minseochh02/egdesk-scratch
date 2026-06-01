/**
 * woori-cert-dump.js
 *
 * Opens Woori Bank's cert selection dialog, dumps every cert row with real
 * .xwup-tableview-cell XPaths, clicks the November-expiry cert, then keeps
 * the browser open for inspection (does NOT complete login).
 *
 * On failure (or if password field does not appear), writes debug HTML to
 * woori-cert-debug/woori-cert-<timestamp>-*.html
 *
 * Usage (from egdesk-scratch/):
 *   node woori-cert-dump.js              # click cert expiring in September (month 9) by default
 *   node woori-cert-dump.js --month 8    # August (2026-08-15)
 *   CERT_EXPIRY=2026-11-15 node woori-cert-dump.js
 */

require('dotenv').config();
const { chromium } = require('playwright-core');
const path = require('path');
const os = require('os');
const fs = require('fs');
const {
  resolveWooriCertCellInBrowser,
  dumpWooriCertRowsInBrowser,
} = require('./scripts/bank-excel-download-automation/woori-xwup-cert');

const DEBUG_DIR = path.join(__dirname, 'woori-cert-debug');

function parseArgs(argv) {
  // Default month 9: debug dumps show certs at 2026-08-15 and 2026-09-28 (no November cert).
  let month = parseInt(process.env.WOORI_CERT_MONTH || '9', 10);
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--month' && argv[i + 1]) {
      month = parseInt(argv[i + 1], 10);
      i += 1;
    }
  }
  return {
    month: Number.isNaN(month) ? 9 : month,
    expiry: process.env.CERT_EXPIRY || process.env.WOORI_CERT_EXPIRY || '',
  };
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function writeDebugHtml(page, label, extra = {}) {
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
  const ts = stamp();
  const base = path.join(DEBUG_DIR, `woori-cert-${ts}-${label}`);

  const snapshot = await page.evaluate(() => {
    const xwupRoot =
      document.querySelector('#xwup') ||
      document.querySelector('[id*="xwup"]') ||
      document.querySelector('.xwup-body')?.closest('div') ||
      null;
    const cells = Array.from(document.querySelectorAll('.xwup-tableview-cell')).map((el, i) => ({
      index: i,
      text: el.innerText.trim().replace(/\s+/g, ' ').slice(0, 120),
      visible: el.offsetParent != null,
      display: getComputedStyle(el).display,
      rect: el.getBoundingClientRect(),
      outerHTML: el.outerHTML.slice(0, 400),
    }));
    return {
      url: location.href,
      title: document.title,
      fullHtml: document.documentElement.outerHTML,
      xwupHtml: xwupRoot ? xwupRoot.outerHTML : null,
      xwupRootTag: xwupRoot ? xwupRoot.id || xwupRoot.className : null,
      cells,
    };
  });

  const fullPath = `${base}-full.html`;
  fs.writeFileSync(fullPath, snapshot.fullHtml, 'utf8');

  let xwupPath = null;
  if (snapshot.xwupHtml) {
    xwupPath = `${base}-xwup.html`;
    fs.writeFileSync(xwupPath, snapshot.xwupHtml, 'utf8');
  }

  const metaPath = `${base}-meta.json`;
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        label,
        timestamp: ts,
        url: snapshot.url,
        title: snapshot.title,
        xwupRoot: snapshot.xwupRootTag,
        cellCount: snapshot.cells.length,
        cells: snapshot.cells,
        ...extra,
      },
      null,
      2
    ),
    'utf8'
  );

  console.log(`\n📁 Debug dump (${label}):`);
  console.log(`   full:  ${fullPath}`);
  if (xwupPath) console.log(`   xwup:  ${xwupPath}`);
  console.log(`   meta:  ${metaPath}`);

  return { fullPath, xwupPath, metaPath, cells: snapshot.cells };
}

async function clickCertCell(page, target) {
  const cell = page.locator('.xwup-tableview-cell').nth(target.cellIndex);
  const box = await cell.boundingBox().catch(() => null);
  console.log(`[5] cell boundingBox:`, box);

  try {
    await cell.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
    await cell.click({ timeout: 8000, force: true });
    return { method: 'playwright-click', ok: true };
  } catch (e1) {
    console.log(`[5] playwright click failed: ${e1.message}`);
  }

  try {
    const viaJs = await page.evaluate((cellIndex) => {
      const el = document.querySelectorAll('.xwup-tableview-cell')[cellIndex];
      if (!el) return { ok: false, reason: 'cell missing in DOM' };
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      if (typeof el.click === 'function') el.click();
      return { ok: true, text: el.innerText.trim().slice(0, 80) };
    }, target.cellIndex);
    if (viaJs.ok) return { method: 'dispatchEvent+click', ok: true, detail: viaJs };
  } catch (e2) {
    console.log(`[5] JS click failed: ${e2.message}`);
  }

  if (target.expiryXpath) {
    try {
      await page.locator(`xpath=${target.expiryXpath}`).click({ timeout: 5000, force: true });
      return { method: 'expiry-xpath', ok: true };
    } catch (e3) {
      console.log(`[5] xpath click failed: ${e3.message}`);
    }
  }

  return { method: 'none', ok: false };
}

async function readActiveFocus(page) {
  return page.evaluate(() => ({
    id: document.activeElement?.id || '',
    tag: document.activeElement?.tagName || '',
  }));
}

/** Try known strategies to focus xwup password input (same as woori.spec.js / automator). */
async function tryFocusPasswordField(page, arduino = null) {
  const attempts = [];
  const pwdCss = '#xwup_certselect_tek_input1';
  const pwdXpath =
    'xpath=/html/body/div[1]/div/div[2]/div[6]/table/tbody/tr/td[2]/form/div[3]/input[1]';

  const tryMethod = async (method, fn) => {
    try {
      await fn();
      await page.waitForTimeout(400);
      const focus = await readActiveFocus(page);
      const ok = focus.id === 'xwup_certselect_tek_input1';
      attempts.push({ method, ok, focus });
      return ok;
    } catch (e) {
      attempts.push({ method, ok: false, error: e.message });
      return false;
    }
  };

  if (await tryMethod('playwright-css-click', () => page.locator(pwdCss).click({ timeout: 3000, force: true }))) {
    return { ok: true, method: 'playwright-css-click', attempts };
  }
  if (await tryMethod('playwright-xpath-click', () => page.locator(pwdXpath).click({ timeout: 3000, force: true }))) {
    return { ok: true, method: 'playwright-xpath-click', attempts };
  }
  if (
    await tryMethod('js-focus', () =>
      page.evaluate(() => {
        const el = document.querySelector('#xwup_certselect_tek_input1');
        if (!el) throw new Error('password input not in DOM');
        el.focus();
        if (typeof el.click === 'function') el.click();
      })
    )
  ) {
    return { ok: true, method: 'js-focus', attempts };
  }

  if (arduino) {
    console.log('[6] Playwright focus failed — trying Arduino TAB (woori.spec.js)...');
    for (let i = 1; i <= 20; i++) {
      await arduino.key('TAB');
      await page.waitForTimeout(300);
      const focus = await readActiveFocus(page);
      console.log(`[6] Tab #${i} -> "${focus.id || focus.tag}"`);
      attempts.push({ method: `arduino-tab-${i}`, ok: focus.id === 'xwup_certselect_tek_input1', focus });
      if (focus.id === 'xwup_certselect_tek_input1') {
        return { ok: true, method: `arduino-tab-${i}`, attempts };
      }
    }
  }

  return { ok: false, attempts };
}

(async () => {
  const { month, expiry } = parseArgs(process.argv);
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-profile-'));

  let arduino = null;
  if (process.env.WOORI_SKIP_ARDUINO !== '1') {
    try {
      const { ArduinoHID } = require('./scripts/bank-excel-download-automation/arduino-typer');
      arduino = new ArduinoHID();
      await arduino.connect();
      console.log('[0] Arduino connected (for password TAB test)');
    } catch (e) {
      console.log(`[0] Arduino not used (${e.message}) — password TAB test skipped unless Playwright focus works`);
    }
  }

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    channel: 'chrome',
    viewport: null,
    args: [
      '--start-maximized',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--allow-running-insecure-content',
      '--disable-features=IsolateOrigins,site-per-process,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults,BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessPermissionPrompt,LocalNetworkAccessChecks,PrivateNetworkAccessChecks',
    ],
  });

  let page = context.pages()[0] || await context.newPage();
  page.on('dialog', async (d) => {
    console.log(`[dialog] ${d.type()}: ${d.message()}`);
    await d.accept();
  });

  process.on('SIGINT', async () => {
    if (arduino) {
      try {
        await arduino.close();
      } catch (_) {}
    }
    try {
      await context.close();
    } catch (_) {}
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch (_) {}
    process.exit(0);
  });

  let clickOk = false;

  try {
    console.log('[1] Navigating to Woori Bank...');
    await page.goto('https://nbi.wooribank.com/nbi/woori?withyou=bi');
    await page.waitForTimeout(3000);

    console.log('[2] Clicking 로그인...');
    try {
      await page.locator('.btn-action1').first().click({ timeout: 8000 });
    } catch (_) {
      await page.getByRole('button', { name: '로그인' }).first().click({ timeout: 8000 });
    }
    await page.waitForTimeout(2500);

    console.log('[3] Clicking (구)공인인증서...');
    try {
      await page
        .locator('xpath=/html/body/div/div[2]/section/div/div/fieldset[1]/div[1]/button[2]/span')
        .click({ timeout: 8000 });
    } catch (_) {
      await page.locator('span:has-text("공인인증서")').first().click({ timeout: 8000 });
    }
    await page.waitForTimeout(3500);

    console.log('[4] Waiting for xwup cert widget...');
    await page.locator('#xwup_media_hdd').waitFor({ timeout: 15000 });
    await page.waitForTimeout(1000);

    const dump = await page.evaluate(dumpWooriCertRowsInBrowser);
    await writeDebugHtml(page, 'before-click', { certRows: dump.rows, month, expiry });

    console.log(`\n.xwup-tableview-cell total: ${dump.allCellCount}`);
    console.log(`#xwup_cert_table present: ${dump.hasCertTable}`);
    console.log(`<table tbody tr> count (stale — do NOT use for clicks): ${dump.staleTableRowCount}`);

    if (dump.rows.length === 0) {
      console.log('\n⚠️  No cert data rows found in .xwup-tableview-cell');
      const raw = await page.evaluate(() => {
        const el = document.querySelector('[id*="xwup"]');
        return el ? el.innerText.substring(0, 2000) : document.body.innerText.substring(0, 2000);
      });
      console.log(raw);
      throw new Error('no cert rows — see woori-cert-debug/*-before-click-full.html');
    }

    console.log(`\n✅ Found ${dump.rows.length} cert row(s)\n`);
    console.log('─'.repeat(80));
    for (const row of dump.rows) {
      console.log(
        `[${row.index}] 구분="${row.texts[0]}"  사용자="${row.texts[1]}"  만료일="${row.texts[2]}"  발급자="${row.texts[3]}"`
      );
      console.log(`     click: page.locator('.xwup-tableview-cell').nth(${row.cellIndex}).click({ force: true })`);
      console.log(`     expiry xpath: ${row.expiryXpath}`);
      console.log();
    }
    console.log('─'.repeat(80));

    const resolveArgs = expiry ? { expiry } : { month };
    console.log(
      `\n[5] Clicking cert${expiry ? ` expiry=${expiry}` : ` with expiry month=${month}`}...`
    );
    const target = await page.evaluate(resolveWooriCertCellInBrowser, resolveArgs);
    if (!target?.ok) {
      await writeDebugHtml(page, 'resolve-failed', { resolveArgs, target });
      throw new Error(target?.reason || 'cert not found for given month/expiry');
    }

    const rowMeta = dump.rows[target.rowIdx];
    if (rowMeta?.expiryXpath) target.expiryXpath = rowMeta.expiryXpath;

    console.log(
      `[5] Target row ${target.rowIdx}: name="${target.nameText}" expiry="${target.expiryText}" → nth(${target.cellIndex})`
    );

    const clickResult = await clickCertCell(page, target);
    console.log(`[5] click result:`, clickResult);
    await page.waitForTimeout(1500);

    const afterClick = await page.evaluate(() => ({
      pwdVisible: !!document.querySelector('#xwup_certselect_tek_input1'),
      pwdDisplayed:
        document.querySelector('#xwup_certselect_tek_input1')?.offsetParent != null,
    }));

    clickOk = clickResult.ok && afterClick.pwdVisible;

    await writeDebugHtml(page, clickOk ? 'after-click-ok' : 'after-click-failed', {
      target,
      clickResult,
      afterClick,
      month,
      expiry,
    });

    if (clickOk) {
      console.log('[5] ✓ Click OK — password field (#xwup_certselect_tek_input1) is present');

      console.log('\n[6] Testing password field focus...');
      await page.waitForTimeout(500);
      const focusResult = await tryFocusPasswordField(page, arduino);
      console.log('[6] focus result:', focusResult.method || 'all failed', focusResult);

      await writeDebugHtml(page, focusResult.ok ? 'after-pwd-focus-ok' : 'after-pwd-focus-failed', {
        target,
        focusResult,
      });

      if (focusResult.ok) {
        console.log(`[6] ✓ Password field focused via ${focusResult.method}`);
        if (process.env.CERT_PASSWORD && arduino) {
          console.log('[7] Typing CERT_PASSWORD via Arduino (optional test)...');
          await arduino.type(process.env.CERT_PASSWORD);
          console.log('[7] ✓ Typed — click 확인 manually or set WOORI_CLICK_OK=1 later');
        }
      } else {
        console.log('[6] ✗ Could not focus password field — connect Arduino (COM port) and re-run');
        console.log('    woori.spec.js uses Arduino TAB; Playwright click alone often fails on xwup tek inputs');
      }
    } else {
      console.log('[5] ✗ Click failed or password field not visible — see woori-cert-debug/');
    }

    console.log('\nBrowser stays open 30s for inspection (Ctrl+C to exit early)...');
    await page.waitForTimeout(30000);
  } catch (err) {
    try {
      await writeDebugHtml(page, 'error', { error: err.message, stack: err.stack });
    } catch (_) {}
    throw err;
  } finally {
    if (arduino) {
      try {
        await arduino.close();
      } catch (_) {}
    }
    await context.close();
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch (_) {}
  }
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
