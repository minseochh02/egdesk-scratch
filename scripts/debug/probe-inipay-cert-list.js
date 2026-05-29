/**
 * Probe the INIPay (Shinhan) cert dialog window.
 *
 * Run this WHILE the cert dialog is open in the browser.
 * Reports:
 *   - Which window class was found
 *   - Full element tree (Name, Class, ControlType, keyboard-focusable, bounds)
 *   - Whether a List/ListItem structure exists (cert list)
 *   - Whether SelectionPattern / SelectionItemPattern is available (keyboard nav possible?)
 *   - Which cert entry (if any) is currently selected
 *
 * Usage:
 *   node scripts/debug/probe-inipay-cert-list.js [windowClass]
 *
 *   windowClass defaults to auto-detect (tries INICertManUI, QWidget, title "인증서 선택",
 *   then scans ALL desktop children for any cert-looking window).
 */

'use strict';

const { spawnSync } = require('child_process');

if (process.platform !== 'win32') {
  console.error('This script requires Windows.');
  process.exit(1);
}

const KNOWN_CLASSES = ['INICertManUI', 'QWidget', 'INIPAYMSWindows', 'INIPayUI'];
const CERT_TITLE_KEYWORDS = ['인증서', 'cert', 'certificate'];

// ── helpers ──────────────────────────────────────────────────────────────────

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
  try {
    return ps(script, timeoutMs);
  } catch (e) {
    return '';
  }
}

// ── step 1: find the window ───────────────────────────────────────────────────

function findWindow(explicitClass) {
  const uiaHeader =
    'Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes; ' +
    '$root = [System.Windows.Automation.AutomationElement]::RootElement; ';

  // Explicit class override
  if (explicitClass) {
    const out = psSafe(
      uiaHeader +
      `$c = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, '${explicitClass}'); ` +
      '$w = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $c); ' +
      'if ($w) { "$($w.Current.ClassName)|$($w.Current.Name)" } else { "" }'
    );
    if (out) {
      const [cls, ...rest] = out.split('|');
      return { windowClass: cls, windowName: rest.join('|') };
    }
    console.error(`No window with class "${explicitClass}" found. Is the cert dialog open?`);
    process.exit(1);
  }

  // Auto-detect: known classes
  for (const cls of KNOWN_CLASSES) {
    const out = psSafe(
      uiaHeader +
      `$c = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, '${cls}'); ` +
      '$w = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $c); ' +
      'if ($w) { "$($w.Current.ClassName)|$($w.Current.Name)" } else { "" }'
    );
    if (out) {
      const [, ...rest] = out.split('|');
      return { windowClass: cls, windowName: rest.join('|') };
    }
  }

  // Auto-detect: title contains cert keyword
  for (const keyword of CERT_TITLE_KEYWORDS) {
    const out = psSafe(
      uiaHeader +
      '$children = $root.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition); ' +
      `$match = $children | Where-Object { $_.Current.Name -match '${keyword}' } | Select-Object -First 1; ` +
      'if ($match) { "$($match.Current.ClassName)|$($match.Current.Name)" } else { "" }'
    );
    if (out) {
      const [cls, ...rest] = out.split('|');
      return { windowClass: cls, windowName: rest.join('|') };
    }
  }

  return null;
}

// ── step 2: dump all descendants ─────────────────────────────────────────────

function dumpDescendants(windowClass) {
  // Returns JSON array of element descriptors
  const script =
    'Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes; ' +
    '$root = [System.Windows.Automation.AutomationElement]::RootElement; ' +
    `$wc = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, '${windowClass}'); ` +
    '$win = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $wc); ' +
    'if (-not $win) { "[]"; exit } ' +
    '$all = $win.FindAll([System.Windows.Automation.TreeScope]::Subtree, [System.Windows.Automation.Condition]::TrueCondition); ' +
    '$out = @(); ' +
    'foreach ($el in $all) { ' +
    '  $e = $el.Current; ' +
    '  $item = [ordered]@{ ' +
    '    Name     = $e.Name; ' +
    '    Class    = $e.ClassName; ' +
    '    Control  = $e.ControlType.ProgrammaticName.Replace("ControlType.", ""); ' +
    '    KbFocus  = $e.IsKeyboardFocusable; ' +
    '    Enabled  = $e.IsEnabled; ' +
    '    AutoId   = $e.AutomationId; ' +
    '    Bounds   = "$([int]$e.BoundingRectangle.X),$([int]$e.BoundingRectangle.Y),$([int]$e.BoundingRectangle.Width),$([int]$e.BoundingRectangle.Height)"; ' +
    '  }; ' +
    // SelectionPattern (on List/ComboBox containers)
    '  try { $sp = $el.GetCurrentPattern([System.Windows.Automation.SelectionPattern]::Pattern); ' +
    '    $item["SelectionPattern"] = $true; ' +
    '    $sel = $sp.Current.GetSelection(); ' +
    '    $item["SelectedCount"] = $sel.Length ' +
    '  } catch { $item["SelectionPattern"] = $false }; ' +
    // SelectionItemPattern (on individual list items)
    '  try { $sip = $el.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern); ' +
    '    $item["SelectionItemPattern"] = $true; ' +
    '    $item["IsSelected"] = $sip.Current.IsSelected ' +
    '  } catch { $item["SelectionItemPattern"] = $false }; ' +
    // InvokePattern
    '  try { $el.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern) | Out-Null; $item["InvokePattern"] = $true } catch { $item["InvokePattern"] = $false }; ' +
    // ValuePattern
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
    console.error('Raw output (first 500 chars):', raw.slice(0, 500));
    return [];
  }
}

// ── step 3: scan ALL desktop children (fallback) ─────────────────────────────

function listAllDesktopWindows() {
  const script =
    'Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes; ' +
    '$root = [System.Windows.Automation.AutomationElement]::RootElement; ' +
    '$children = $root.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition); ' +
    '$out = @(); ' +
    'foreach ($c in $children) { ' +
    '  $out += "$($c.Current.ClassName)|$($c.Current.Name)" ' +
    '} ' +
    '$out -join "`n"';
  return psSafe(script, 15000);
}

// ── main ──────────────────────────────────────────────────────────────────────

const explicitClass = process.argv[2] || null;

console.log('='.repeat(70));
console.log('  INIPay / Shinhan cert dialog probe');
console.log('='.repeat(70));
console.log();

// 1. Find window
console.log('[1] Searching for cert dialog window...');
const win = findWindow(explicitClass);

if (!win) {
  console.error('FAIL: No cert dialog window found.\n');
  console.log('All visible desktop windows (Class | Name):');
  console.log('-'.repeat(50));
  const all = listAllDesktopWindows();
  if (all) {
    all.split('\n').forEach((line) => console.log('  ', line));
  } else {
    console.log('  (none found or UIA error)');
  }
  console.log();
  console.log('Tip: open the Shinhan cert dialog then re-run this script.');
  console.log('     Or: node scripts/debug/probe-inipay-cert-list.js <YourWindowClass>');
  process.exit(1);
}

console.log(`  Window class : ${win.windowClass}`);
console.log(`  Window title : ${win.windowName}`);
console.log();

// 2. Dump all elements
console.log('[2] Dumping all UI elements inside the window...');
const elems = dumpDescendants(win.windowClass);

if (elems.length === 0) {
  console.error('No elements found — UIA returned empty tree. The dialog may block UIA introspection.');
  process.exit(1);
}

console.log(`  Total elements found: ${elems.length}`);
console.log();

// 3. Print full element table
const COL = { Name: 30, Class: 20, Control: 15, KbFocus: 7, Sel: 5, SelItem: 7, Selected: 8 };
const header =
  'Name'.padEnd(COL.Name) +
  'Class'.padEnd(COL.Class) +
  'Control'.padEnd(COL.Control) +
  'KbFocusable'.padEnd(COL.KbFocus + 4) +
  'SelPat'.padEnd(COL.Sel + 3) +
  'SelItem'.padEnd(COL.SelItem + 1) +
  'Selected';
console.log('[3] Full element tree:');
console.log('-'.repeat(header.length));
console.log(header);
console.log('-'.repeat(header.length));

for (const el of elems) {
  const name = (el.Name || '').slice(0, COL.Name - 1).padEnd(COL.Name);
  const cls  = (el.Class || '').slice(0, COL.Class - 1).padEnd(COL.Class);
  const ctrl = (el.Control || '').slice(0, COL.Control - 1).padEnd(COL.Control);
  const kbf  = String(el.KbFocus).padEnd(COL.KbFocus + 4);
  const sp   = String(el.SelectionPattern).padEnd(COL.Sel + 3);
  const sip  = String(el.SelectionItemPattern).padEnd(COL.SelItem + 1);
  const isel = el.SelectionItemPattern ? String(el.IsSelected) : '-';
  console.log(`${name}${cls}${ctrl}${kbf}${sp}${sip}${isel}`);
}
console.log('-'.repeat(header.length));
console.log();

// 4. Analysis — cert list
console.log('[4] Analysis: cert list structure');
console.log('-'.repeat(50));

const listControls = elems.filter((e) => ['List', 'DataGrid', 'Tree'].includes(e.Control));
const listItems    = elems.filter((e) => ['ListItem', 'DataItem', 'TreeItem'].includes(e.Control));
const withSelPat   = elems.filter((e) => e.SelectionPattern);
const withSelItem  = elems.filter((e) => e.SelectionItemPattern);
const selectedItems = withSelItem.filter((e) => e.IsSelected);
const kbFocusable  = elems.filter((e) => e.KbFocus);

console.log(`  List/DataGrid/Tree containers  : ${listControls.length}`);
listControls.forEach((e) =>
  console.log(`    • [${e.Control}] name="${e.Name}" class="${e.Class}" kbFocusable=${e.KbFocus} SelectionPattern=${e.SelectionPattern}`)
);

console.log(`  ListItem/DataItem/TreeItem rows: ${listItems.length}`);
listItems.slice(0, 10).forEach((e) =>
  console.log(`    • [${e.Control}] name="${e.Name}" kbFocusable=${e.KbFocus} selected=${e.IsSelected}`)
);
if (listItems.length > 10) console.log(`    … and ${listItems.length - 10} more`);

console.log(`  Elements with SelectionPattern : ${withSelPat.length}`);
console.log(`  Elements with SelItemPattern   : ${withSelItem.length}`);
console.log(`  Currently selected elements    : ${selectedItems.length}`);
selectedItems.forEach((e) =>
  console.log(`    ✓ name="${e.Name}" class="${e.Class}" control="${e.Control}"`)
);
console.log(`  Keyboard-focusable elements    : ${kbFocusable.length}`);
kbFocusable.slice(0, 15).forEach((e) =>
  console.log(`    • [${e.Control}] name="${e.Name}" class="${e.Class}"`)
);
if (kbFocusable.length > 15) console.log(`    … and ${kbFocusable.length - 15} more`);

console.log();

// 5. Verdict
console.log('[5] Verdict');
console.log('-'.repeat(50));

const hasList       = listControls.length > 0;
const hasItems      = listItems.length > 0;
const listHasSelPat = listControls.some((e) => e.SelectionPattern);
const itemsHasSIP   = listItems.some((e) => e.SelectionItemPattern);
const certListNavigable = hasList && listHasSelPat && itemsHasSIP;

if (!hasList && !hasItems) {
  console.log('  ❌ NO cert list exposed to UIA.');
  console.log('     INIPay/Shinhan appears to use a custom-drawn control that UIA cannot see.');
  console.log('     Keyboard DOWN navigation will NOT be reflected in UIA selection state.');
  console.log('     → Cert selection by index is NOT possible without a different approach.');
} else if (hasList && !listHasSelPat) {
  console.log('  ⚠️  Cert list IS present in UIA but has NO SelectionPattern.');
  console.log('     The list exists but its selection state cannot be read/driven via UIA.');
  console.log(`     List containers: ${listControls.map((e) => `"${e.Name}" (${e.Class})`).join(', ')}`);
  console.log('     → Keyboard DOWN might still move visual focus, but we cannot confirm the selection from Node.js.');
} else if (certListNavigable) {
  console.log('  ✅ Cert list IS navigable via UIA (SelectionPattern + SelectionItemPattern).');
  console.log('     Keyboard DOWN should work AND UIA can confirm which cert is selected.');
  console.log(`     List containers: ${listControls.map((e) => `"${e.Name}" (${e.Class})`).join(', ')}`);
  console.log(`     Cert entries    : ${listItems.length}`);
} else {
  console.log('  ⚠️  Partial UIA support detected — see Analysis section above.');
}

console.log();
console.log('Done.');
