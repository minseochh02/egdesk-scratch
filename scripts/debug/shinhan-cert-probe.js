/**
 * Shinhan cert dialog UIA probe.
 *
 * Uses ShinhanBankAutomator.prepareCorporateCertificateLogin() — the exact
 * same code path the real app uses — to open bizbank.shinhan.com and trigger
 * the native cert dialog. Once the cert window is detected, dumps and analyses
 * the full UIA element tree to determine whether keyboard cert-list navigation
 * is possible with INIPay.
 *
 * No Arduino, no password needed.
 *
 * Usage:
 *   node scripts/debug/shinhan-cert-probe.js
 */

'use strict';

const path = require('path');
const { spawnSync } = require('child_process');
const { ShinhanBankAutomator } = require('../../src/main/financehub/banks/shinhan/ShinhanBankAutomator');

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

// ── analysis & verdict ────────────────────────────────────────────────────────

function analyse(windowClass, windowName, elems) {
  console.log(`\n${'='.repeat(70)}`);
  console.log('  UIA Element Tree');
  console.log('='.repeat(70));
  console.log(`  Window class : ${windowClass}`);
  console.log(`  Window title : ${windowName}`);
  console.log();

  if (elems.length === 0) {
    console.log('  ❌ No elements found — UIA returned an empty tree.');
    console.log('     INIPay may be using a fully custom-drawn window that blocks UIA introspection.\n');
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
    console.log('  ❌ NO cert list visible to UIA.');
    console.log('     INIPay uses a custom-drawn control UIA cannot enumerate.');
    console.log('     Keyboard DOWN arrow is blind — cannot confirm cert selection from Node.js.');
    console.log('     → Index-based cert selection is NOT reliably possible via key navigation.');
  } else if (hasList && !listHasSelPat) {
    console.log('  ⚠️  Cert list IS in the UIA tree but has NO SelectionPattern.');
    console.log('     We can see the list, but cannot read or drive selection from Node.js.');
    console.log('     DOWN arrow might move visual focus — but we cannot confirm it.');
  } else if (hasList && listHasSelPat && itemsHasSIP) {
    console.log('  ✅ Cert list is fully UIA-navigable (SelectionPattern + SelectionItemPattern).');
    console.log('     DOWN arrow works AND we can confirm which cert is selected from Node.js.');
    console.log(`     Cert entries: ${listItems.length}`);
  } else {
    console.log('  ⚠️  Partial UIA support — see Analysis section for details.');
  }
  console.log();
}

// ── main ──────────────────────────────────────────────────────────────────────

(async () => {
  const automator = new ShinhanBankAutomator({
    // No arduinoPort needed — we stop before password entry
  });

  process.on('SIGINT', async () => {
    console.log('\n[SIGINT] Cleaning up...');
    try { await automator.cleanup(false); } catch (e) {}
    process.exit(0);
  });

  console.log('='.repeat(70));
  console.log('  Shinhan cert dialog probe (via ShinhanBankAutomator)');
  console.log('='.repeat(70));
  console.log();

  // Phase 1: open browser, navigate, trigger cert dialog — same as real app
  console.log('[1] Running prepareCorporateCertificateLogin...');
  const prep = await automator.prepareCorporateCertificateLogin();

  if (!prep.success) {
    console.error(`\n[1] FAIL: ${prep.error}`);
    try { await automator.cleanup(false); } catch (e) {}
    process.exit(1);
  }

  console.log(`[1] ✓ Cert window detected.`);
  console.log(`      Phase : ${prep.phase}`);
  console.log(`      Class : ${prep.certWindowClass}`);
  console.log(`      Title : ${prep.certWindowName}`);

  // Give the dialog a moment to finish rendering
  await new Promise((r) => setTimeout(r, 1500));

  // Probe: dump UIA element tree of the cert window
  console.log('\n[2] Dumping UIA element tree...');
  const elems = dumpDescendants(prep.certWindowClass);
  analyse(prep.certWindowClass, prep.certWindowName, elems);

  console.log('[Done] Cert dialog is still open — close it manually when finished.');
  console.log('       Press Ctrl+C to quit and close the browser.\n');

  // Keep process alive until user exits
  await new Promise(() => {});
})().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
