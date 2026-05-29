/**
 * Shinhan cert dialog UIA probe.
 *
 * Opens bizbank.shinhan.com, clicks 공동인증서 로그인, waits for the
 * native cert window to appear, then dumps and analyses the full UIA
 * element tree to determine whether keyboard cert-list navigation is
 * possible with INIPay.
 *
 * No Arduino, no password needed.
 *
 * Usage:
 *   node scripts/debug/shinhan-cert-probe.js
 */

'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { chromium } = require('playwright-core');

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

// ── UIA probes ────────────────────────────────────────────────────────────────

const UIA_HEADER =
  'Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes; ' +
  '$root = [System.Windows.Automation.AutomationElement]::RootElement; ';

function findWindowByClass(cls) {
  const out = psSafe(
    UIA_HEADER +
    `$c = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, '${cls}'); ` +
    '$w = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $c); ' +
    'if ($w) { "$($w.Current.ClassName)|$($w.Current.Name)" } else { "" }'
  );
  if (!out) return null;
  const pipe = out.indexOf('|');
  return { windowClass: out.slice(0, pipe), windowName: out.slice(pipe + 1) };
}

function findWindowByTitle(keyword) {
  const out = psSafe(
    UIA_HEADER +
    '$all = $root.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition); ' +
    `$m = $all | Where-Object { $_.Current.Name -match '${keyword}' } | Select-Object -First 1; ` +
    'if ($m) { "$($m.Current.ClassName)|$($m.Current.Name)" } else { "" }'
  );
  if (!out) return null;
  const pipe = out.indexOf('|');
  return { windowClass: out.slice(0, pipe), windowName: out.slice(pipe + 1) };
}

function listAllDesktopWindows() {
  return psSafe(
    UIA_HEADER +
    '$all = $root.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition); ' +
    'foreach ($c in $all) { "$($c.Current.ClassName)|$($c.Current.Name)" }',
    12000
  );
}

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

// ── detect cert window (INICertManUI, QWidget, or by title) ──────────────────

function detectCertWindow() {
  for (const cls of ['INICertManUI', 'QWidget', 'INIPAYMSWindows', 'INIPayUI']) {
    const w = findWindowByClass(cls);
    if (w) return w;
  }
  for (const kw of ['인증서', 'cert', 'certificate']) {
    const w = findWindowByTitle(kw);
    if (w) return w;
  }
  return null;
}

// ── analysis & verdict ────────────────────────────────────────────────────────

function analyse(win, elems) {
  console.log(`\n${'='.repeat(70)}`);
  console.log('  UIA Element Tree');
  console.log('='.repeat(70));

  if (elems.length === 0) {
    console.log('  No elements found — UIA returned empty tree.');
    console.log('  INIPay may be using a fully custom-drawn window that blocks UIA.\n');
    return;
  }

  console.log(`  Total elements: ${elems.length}\n`);

  // Print table
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

  // Groupings
  const listControls = elems.filter((e) => ['List', 'DataGrid', 'Tree'].includes(e.Control));
  const listItems    = elems.filter((e) => ['ListItem', 'DataItem', 'TreeItem'].includes(e.Control));
  const withSelPat   = elems.filter((e) => e.SelectionPattern);
  const withSelItem  = elems.filter((e) => e.SelectionItemPattern);
  const selectedItems = withSelItem.filter((e) => e.IsSelected);
  const kbFocusable  = elems.filter((e) => e.KbFocus);

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

  // Verdict
  const hasList       = listControls.length > 0;
  const listHasSelPat = listControls.some((e) => e.SelectionPattern);
  const itemsHasSIP   = listItems.some((e) => e.SelectionItemPattern);

  console.log(`\n${'─'.repeat(50)}`);
  console.log('  Verdict');
  console.log('─'.repeat(50));

  if (!hasList && listItems.length === 0) {
    console.log('  ❌ NO cert list visible to UIA.');
    console.log('     INIPay uses a custom-drawn control UIA cannot enumerate.');
    console.log('     Keyboard DOWN arrow is blind — UIA cannot confirm cert selection.');
    console.log('     → Index-based cert selection is NOT reliably possible via key navigation.');
  } else if (hasList && !listHasSelPat) {
    console.log('  ⚠️  Cert list container IS in UIA tree but has NO SelectionPattern.');
    console.log('     We can see the list exists, but cannot read or drive selection from Node.js.');
    console.log('     DOWN arrow might still move visual focus — but we cannot confirm it.');
  } else if (hasList && listHasSelPat && itemsHasSIP) {
    console.log('  ✅ Cert list is UIA-navigable (SelectionPattern + SelectionItemPattern).');
    console.log('     DOWN arrow works AND we can confirm which cert is selected from Node.js.');
    console.log(`     Cert entries: ${listItems.length}`);
  } else {
    console.log('  ⚠️  Partial UIA support — see Analysis section for details.');
  }
  console.log();
}

// ── main ──────────────────────────────────────────────────────────────────────

(async () => {
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-shinhan-probe-'));

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    channel: 'chrome',
    viewport: null,
    args: [
      '--start-maximized',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
    ],
  });

  const page = context.pages()[0] || await context.newPage();
  page.on('dialog', async (d) => { try { await d.accept(); } catch (e) {} });

  process.on('SIGINT', async () => {
    console.log('\n[SIGINT] Cleaning up...');
    try { await context.close(); } catch (e) {}
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) {}
    process.exit(0);
  });

  try {
    // ── STEP 1: navigate ──────────────────────────────────────────────────────
    console.log('[1] Navigating to bizbank.shinhan.com...');
    await page.goto('https://bizbank.shinhan.com/main.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    console.log('[1] ✓ Page loaded.');

    // ── STEP 2: dismiss popup ─────────────────────────────────────────────────
    console.log('[2] Dismissing popup (if any)...');
    const popupSelectors = [
      '[id="mf_divRPPop99_1775110936087_wframe_btn_closePopIco"]',
      'input[value="팝업닫기"]',
      'a:has-text("닫기")',
    ];
    for (const sel of popupSelectors) {
      try {
        await page.locator(sel).first().click({ timeout: 2500 });
        console.log(`[2] ✓ Popup dismissed via: ${sel}`);
        await page.waitForTimeout(1000);
        break;
      } catch (e) {}
    }

    // ── STEP 3: click 공동인증서 로그인 ───────────────────────────────────────
    console.log('[3] Clicking 공동인증서 로그인...');
    try {
      await page.locator('[id="mf_wfm_main_btn_goCert"]').click({ timeout: 10000 });
    } catch (e) {
      await page.locator('a:has-text("공동인증서 로그인")').first().click({ timeout: 10000 });
    }
    console.log('[3] ✓ Cert login button clicked. Waiting for native cert window...');

    // ── STEP 4: poll for cert window (30 s) ──────────────────────────────────
    console.log('[4] Polling for cert window...');
    let certWin = null;
    for (let i = 0; i < 30; i++) {
      certWin = detectCertWindow();
      if (certWin) {
        console.log(`[4] ✓ Cert window detected!`);
        console.log(`      Class : ${certWin.windowClass}`);
        console.log(`      Title : ${certWin.windowName}`);
        break;
      }
      await page.waitForTimeout(1000);
      if (i % 5 === 4) console.log(`[4] Still waiting... (${i + 1}s elapsed)`);
    }

    if (!certWin) {
      console.error('\n[4] ✗ Cert window not detected within 30 seconds.\n');
      console.log('All visible desktop windows:');
      const all = listAllDesktopWindows();
      if (all) all.split('\n').forEach((l) => console.log('  ', l));
      else console.log('  (none / UIA error)');
      return;
    }

    // Give the dialog a moment to finish rendering before probing
    await page.waitForTimeout(1500);

    // ── STEP 5: probe ─────────────────────────────────────────────────────────
    console.log('\n[5] Dumping UIA element tree...');
    const elems = dumpDescendants(certWin.windowClass);
    analyse(certWin, elems);

    console.log('[Done] Cert dialog is still open — close it manually when finished.');
    console.log('       Press Ctrl+C to quit this script and close the browser.\n');

    // Keep alive until user presses Ctrl+C
    await new Promise(() => {});

  } finally {
    try { await context.close(); } catch (e) {}
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) {}
  }
})().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
