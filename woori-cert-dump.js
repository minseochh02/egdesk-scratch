/**
 * woori-cert-dump.js
 *
 * Opens Woori Bank's cert selection dialog, dumps every cert row with real
 * .xwup-tableview-cell XPaths, clicks the November-expiry cert, then keeps
 * the browser open for inspection (does NOT complete login).
 *
 * Usage (from egdesk-scratch/):
 *   node woori-cert-dump.js              # click cert expiring in November (month 11)
 *   node woori-cert-dump.js --month 9    # click September instead
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

function parseArgs(argv) {
  let month = parseInt(process.env.WOORI_CERT_MONTH || '11', 10);
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--month' && argv[i + 1]) {
      month = parseInt(argv[i + 1], 10);
      i += 1;
    }
  }
  return {
    month: Number.isNaN(month) ? 11 : month,
    expiry: process.env.CERT_EXPIRY || process.env.WOORI_CERT_EXPIRY || '',
  };
}

(async () => {
  const { month, expiry } = parseArgs(process.argv);
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-profile-'));

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
    try {
      await context.close();
    } catch (_) {}
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch (_) {}
    process.exit(0);
  });

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
    } else {
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
    }

    const resolveArgs = expiry ? { expiry } : { month };
    console.log(
      `\n[5] Clicking cert${expiry ? ` expiry=${expiry}` : ` with November expiry (month=${month})`}...`
    );
    const target = await page.evaluate(resolveWooriCertCellInBrowser, resolveArgs);
    if (!target?.ok) {
      throw new Error(target?.reason || 'cert not found for given month/expiry');
    }
    console.log(
      `[5] Target row ${target.rowIdx}: name="${target.nameText}" expiry="${target.expiryText}" → nth(${target.cellIndex})`
    );

    await page.locator('.xwup-tableview-cell').nth(target.cellIndex).click({ timeout: 8000, force: true });
    await page.waitForTimeout(1500);

    const afterClick = await page.evaluate(() => ({
      pwdVisible: !!document.querySelector('#xwup_certselect_tek_input1'),
      pwdDisplay: document.querySelector('#xwup_certselect_tek_input1')?.offsetParent != null,
      selectedText: document.querySelector('.xwup_cert_table, #xwup_cert_table')?.innerText?.slice(0, 200) || '',
    }));
    if (afterClick.pwdVisible) {
      console.log('[5] ✓ Click OK — password field (#xwup_certselect_tek_input1) is present');
    } else {
      console.log('[5] ⚠️ Click done but password field not visible yet — check browser');
    }

    console.log('\nBrowser stays open 30s for inspection (Ctrl+C to exit early)...');
    await page.waitForTimeout(30000);
  } finally {
    await context.close();
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch (_) {}
  }
})().catch(console.error);
