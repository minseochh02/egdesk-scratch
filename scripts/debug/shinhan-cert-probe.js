/**
 * Shinhan cert dialog UIA probe.
 *
 * Opens bizbank.shinhan.com the same way shinhan.spec.js does (raw Playwright,
 * temp Chrome profile, same args), triggers the native INIPay cert dialog, then
 * dumps and analyses the full UIA element tree to determine whether keyboard
 * cert-list navigation is possible.
 *
 * No Arduino, no password, no Electron modules.
 *
 * Usage:
 *   node scripts/debug/shinhan-cert-probe.js
 */

'use strict';

const { chromium } = require('playwright-core');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawnSync } = require('child_process');

if (process.platform !== 'win32') {
  console.error('This script requires Windows (UIA is Windows-only).');
  process.exit(1);
}

// ── PowerShell helper ─────────────────────────────────────────────────────────

function ps(script, timeoutMs = 20000) {
  const full = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${script}`;
  const r = spawnSync('powershell.exe', ['-NoProfile', '-Command', full], {
    encoding: 'utf8',
    timeout: timeoutMs,
    windowsHide: true,
  });
  if (r.error) throw r.error;
  if (r.stderr && r.stderr.trim()) process.stderr.write('ps stderr: ' + r.stderr.trim() + '\n');
  return (r.stdout || '').trim();
}

function psSafe(script, timeoutMs = 20000) {
  try { return ps(script, timeoutMs); } catch (e) { return ''; }
}

// ── UIA dump ──────────────────────────────────────────────────────────────────

const UIA_HEADER =
  'Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes; ' +
  '$root = [System.Windows.Automation.AutomationElement]::RootElement; ';

function dumpDescendants(windowClass) {
  const script =
    UIA_HEADER +
    `$wc = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, '${windowClass}'); ` +
    '$win = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $wc); ' +
    'if (-not $win) { "[]"; exit } ' +
    '$all = $win.FindAll([System.Windows.Automation.TreeScope]::Subtree, [System.Windows.Automation.Condition]::TrueCondition); ' +
    '$out = @(); ' +
    'foreach ($el in $all) { ' +
    '  $e = $el.Current; ' +
    '  $item = [ordered]@{ ' +
    '    Name    = $e.Name; ' +
    '    Class   = $e.ClassName; ' +
    '    Control = $e.ControlType.ProgrammaticName.Replace("ControlType.", ""); ' +
    '    KbFocus = $e.IsKeyboardFocusable; ' +
    '    Enabled = $e.IsEnabled; ' +
    '    AutoId  = $e.AutomationId; ' +
    '    Bounds  = "$([int]$e.BoundingRectangle.X),$([int]$e.BoundingRectangle.Y),$([int]$e.BoundingRectangle.Width),$([int]$e.BoundingRectangle.Height)"; ' +
    '  }; ' +
    '  try { $sp = $el.GetCurrentPattern([System.Windows.Automation.SelectionPattern]::Pattern); ' +
    '    $item["SelectionPattern"] = $true; $item["SelectedCount"] = $sp.Current.GetSelection().Length ' +
    '  } catch { $item["SelectionPattern"] = $false }; ' +
    '  try { $sip = $el.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern); ' +
    '    $item["SelectionItemPattern"] = $true; $item["IsSelected"] = $sip.Current.IsSelected ' +
    '  } catch { $item["SelectionItemPattern"] = $false }; ' +
    '  try { $el.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern) | Out-Null; $item["InvokePattern"] = $true } catch { $item["InvokePattern"] = $false }; ' +
    '  try { $vp = $el.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern); $item["Value"] = $vp.Current.Value } catch {}; ' +
    '  $out += $item ' +
    '} ' +
    '$out | ConvertTo-Json -Depth 3 -Compress';

  const raw = psSafe(script, 30000);
  if (!raw || raw === '[]') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (e) {
    console.error('JSON parse error:', e.message);
    console.error('Raw (first 500):', raw.slice(0, 500));
    return [];
  }
}

// ── Wait for cert window ──────────────────────────────────────────────────────

async function waitForCertWindow(page, timeoutMs = 30000) {
  const CLASSES = ['INICertManUI', 'QWidget'];
  const deadline = Date.now() + timeoutMs;
  let i = 0;

  while (Date.now() < deadline) {
    for (const cls of CLASSES) {
      const out = psSafe(
        UIA_HEADER +
        `$c = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, '${cls}'); ` +
        '$w = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $c); ' +
        'if ($w) { "$($w.Current.ClassName)|$($w.Current.Name)" } else { "" }'
      );
      if (out) {
        const [matchedClass, ...rest] = out.split('|');
        return { ok: true, matchedClass, windowName: rest.join('|') };
      }
    }

    // Also try title-based detection
    const titleOut = psSafe(
      UIA_HEADER +
      '$children = $root.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition); ' +
      "$match = $children | Where-Object { $_.Current.Name -match '인증서' } | Select-Object -First 1; " +
      'if ($match) { "$($match.Current.ClassName)|$($match.Current.Name)" } else { "" }'
    );
    if (titleOut) {
      const [matchedClass, ...rest] = titleOut.split('|');
      return { ok: true, matchedClass, windowName: rest.join('|') };
    }

    await page.waitForTimeout(1000);
    i++;
    if (i % 5 === 0) console.log(`  Still waiting for cert window... (${i}s)`);
  }

  return { ok: false, error: 'Cert window not detected within timeout' };
}

// ── Analysis & verdict ────────────────────────────────────────────────────────

function analyse(windowClass, windowName, elems) {
  console.log(`\n${'='.repeat(70)}`);
  console.log('  UIA Element Tree');
  console.log('='.repeat(70));
  console.log(`  Window class : ${windowClass}`);
  console.log(`  Window title : ${windowName}`);
  console.log();

  if (elems.length === 0) {
    console.log('  NO elements found — UIA returned an empty tree.');
    console.log('     INIPay may be using a fully custom-drawn window that blocks UIA.\n');
    return;
  }

  console.log(`  Total elements: ${elems.length}\n`);

  const hdr =
    'Name'.padEnd(30) + 'Class'.padEnd(22) + 'Control'.padEnd(16) +
    'KbFocus'.padEnd(9) + 'SelPat'.padEnd(8) + 'SelItem'.padEnd(9) + 'Selected';
  console.log(hdr);
  console.log('-'.repeat(hdr.length));
  for (const el of elems) {
    const row =
      (el.Name || '').slice(0, 29).padEnd(30) +
      (el.Class || '').slice(0, 21).padEnd(22) +
      (el.Control || '').slice(0, 15).padEnd(16) +
      String(el.KbFocus).padEnd(9) +
      String(el.SelectionPattern).padEnd(8) +
      String(el.SelectionItemPattern).padEnd(9) +
      (el.SelectionItemPattern ? String(el.IsSelected) : '-');
    console.log(row);
  }
  console.log('-'.repeat(hdr.length));

  const listControls  = elems.filter((e) => ['List', 'DataGrid', 'Tree'].includes(e.Control));
  const listItems     = elems.filter((e) => ['ListItem', 'DataItem', 'TreeItem'].includes(e.Control));
  const withSelPat    = elems.filter((e) => e.SelectionPattern);
  const withSelItem   = elems.filter((e) => e.SelectionItemPattern);
  const selectedItems = withSelItem.filter((e) => e.IsSelected);
  const kbFocusable   = elems.filter((e) => e.KbFocus);

  console.log(`\n${'─'.repeat(50)}`);
  console.log('  Analysis');
  console.log('─'.repeat(50));
  console.log(`  List/DataGrid/Tree containers : ${listControls.length}`);
  listControls.forEach((e) =>
    console.log(`    • [${e.Control}] "${e.Name}" class="${e.Class}" kbFocusable=${e.KbFocus} SelectionPattern=${e.SelectionPattern}`)
  );
  console.log(`  ListItem/DataItem/TreeItem    : ${listItems.length}`);
  listItems.slice(0, 10).forEach((e) =>
    console.log(`    • [${e.Control}] "${e.Name}" kbFocusable=${e.KbFocus} selected=${e.IsSelected}`)
  );
  if (listItems.length > 10) console.log(`    … and ${listItems.length - 10} more`);
  console.log(`  Elements with SelectionPattern: ${withSelPat.length}`);
  console.log(`  Elements with SelItemPattern  : ${withSelItem.length}`);
  console.log(`  Currently selected            : ${selectedItems.length}`);
  selectedItems.forEach((e) =>
    console.log(`    ✓ "${e.Name}" class="${e.Class}" control="${e.Control}"`)
  );
  console.log(`  Keyboard-focusable            : ${kbFocusable.length}`);
  kbFocusable.slice(0, 15).forEach((e) =>
    console.log(`    • [${e.Control}] "${e.Name}" class="${e.Class}"`)
  );
  if (kbFocusable.length > 15) console.log(`    … and ${kbFocusable.length - 15} more`);

  const hasList       = listControls.length > 0;
  const listHasSelPat = listControls.some((e) => e.SelectionPattern);
  const itemsHasSIP   = listItems.some((e) => e.SelectionItemPattern);

  console.log(`\n${'─'.repeat(50)}`);
  console.log('  Verdict');
  console.log('─'.repeat(50));

  if (!hasList && listItems.length === 0) {
    console.log('  NO cert list visible to UIA.');
    console.log('     INIPay uses a custom-drawn control UIA cannot enumerate.');
    console.log('     Keyboard DOWN arrow is blind — cannot confirm cert selection from Node.js.');
    console.log('     → Index-based cert selection is NOT reliably verifiable via UIA.');
  } else if (hasList && !listHasSelPat) {
    console.log('  Cert list IS in the UIA tree but has NO SelectionPattern.');
    console.log('     We can see the list, but cannot read/drive selection from Node.js.');
    console.log('     DOWN arrow might move visual focus — but we cannot confirm it.');
  } else if (hasList && listHasSelPat && itemsHasSIP) {
    console.log('  Cert list is fully UIA-navigable (SelectionPattern + SelectionItemPattern).');
    console.log('     DOWN arrow works AND we can confirm which cert is selected from Node.js.');
    console.log(`     Cert entries: ${listItems.length}`);
  } else {
    console.log('  Partial UIA support — see Analysis section for details.');
  }
  console.log();
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-profile-'));

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    channel: 'chrome',
    viewport: null,
    permissions: ['clipboard-read', 'clipboard-write'],
    acceptDownloads: true,
    args: [
      '--start-maximized',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--allow-running-insecure-content',
    ],
  });

  const page = context.pages()[0] || await context.newPage();

  page.on('dialog', async (dialog) => {
    try { await dialog.accept(); } catch (e) {}
  });

  process.on('SIGINT', async () => {
    console.log('\n[SIGINT] Cleaning up...');
    try { await context.close(); } catch (e) {}
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) {}
    process.exit(0);
  });

  console.log('='.repeat(70));
  console.log('  Shinhan cert dialog probe');
  console.log('='.repeat(70));
  console.log();

  // Step 1: Navigate
  console.log('[1] Navigating to bizbank.shinhan.com...');
  await page.goto('https://bizbank.shinhan.com/main.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  console.log('[1] ✓ Page loaded.');

  // Step 2: Close popup
  console.log('[2] Closing popup if present...');
  try {
    await page.locator('[id="mf_divRPPop99_1775110936087_wframe_btn_closePopIco"]').click({ timeout: 3000 });
    console.log('[2] ✓ Popup closed.');
  } catch (e) {
    try {
      await page.locator('input[value="팝업닫기"]').first().click({ timeout: 2000 });
      console.log('[2] ✓ Popup closed (fallback).');
    } catch (e2) {
      console.log('[2] No popup found, continuing.');
    }
  }
  await page.waitForTimeout(1500);

  // Step 3: Click cert login button
  console.log('[3] Clicking 공동인증서 로그인...');
  try {
    await page.locator('[id="mf_wfm_main_btn_goCert"]').click({ timeout: 10000 });
  } catch (e) {
    await page.locator('a:has-text("공동인증서 로그인")').first().click({ timeout: 10000 });
  }
  console.log('[3] ✓ Clicked. Waiting for INIPay cert window...');

  // Step 4: Wait for cert window
  const uia = await waitForCertWindow(page, 30000);
  if (!uia.ok) {
    console.error(`\n[4] FAIL: ${uia.error}`);
    await context.close();
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) {}
    process.exit(1);
  }
  console.log(`[4] ✓ Cert window detected.`);
  console.log(`      Class : ${uia.matchedClass}`);
  console.log(`      Title : ${uia.windowName}`);

  // Give the dialog a moment to finish rendering
  await page.waitForTimeout(1500);

  // Step 5: Dump and analyse UIA element tree
  console.log('\n[5] Dumping UIA element tree...');
  const elems = dumpDescendants(uia.matchedClass);
  analyse(uia.matchedClass, uia.windowName, elems);

  console.log('[Done] Cert dialog is still open — close it manually when finished.');
  console.log('       Press Ctrl+C to quit and close the browser.\n');

  await new Promise(() => {});
})().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
