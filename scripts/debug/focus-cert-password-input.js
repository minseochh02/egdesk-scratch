/**
 * Standalone debug script: click the password input inside a native cert dialog.
 *
 * Usage:
 *   node scripts/debug/focus-cert-password-input.js [windowClass] [elementName]
 *
 * Defaults:
 *   windowClass  = QWidget       (Delfino cert dialog class)
 *   elementName  = passwordFrame (name of the password input element)
 *
 * Examples:
 *   node scripts/debug/focus-cert-password-input.js
 *   node scripts/debug/focus-cert-password-input.js QWidget passwordFrame
 *   node scripts/debug/focus-cert-password-input.js INICertManUI passwordFrame
 */

'use strict';

const { spawnSync } = require('child_process');

const windowClass = process.argv[2] || 'QWidget';
const elementName = process.argv[3] || 'passwordFrame';

if (process.platform !== 'win32') {
  console.error('This script requires Windows.');
  process.exit(1);
}

if (!/^[A-Za-z0-9_]+$/.test(windowClass)) {
  console.error(`Invalid windowClass: "${windowClass}" — only alphanumeric and _ allowed.`);
  process.exit(1);
}

console.log(`Targeting window class: ${windowClass}`);
console.log(`Targeting element name: ${elementName}`);
console.log('Running UIA click...');

const script = [
  '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8;',
  'Add-Type -AssemblyName UIAutomationClient;',
  'Add-Type -AssemblyName UIAutomationTypes;',
  'Add-Type -AssemblyName System.Windows.Forms;',
  'Add-Type -MemberDefinition \'[DllImport("user32.dll")] public static extern void mouse_event(int f, int x, int y, int d, int e);\' -Name Mouse -Namespace Win32 -ErrorAction SilentlyContinue;',
  '$r = [System.Windows.Automation.AutomationElement]::RootElement;',
  `$wc = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, '${windowClass}');`,
  '$w = $r.FindFirst([System.Windows.Automation.TreeScope]::Children, $wc);',
  'if (-not $w) { "window_not_found"; exit }',
  `$nc = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, '${elementName}');`,
  '$el = $w.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $nc);',
  'if (-not $el) { "element_not_found"; exit }',
  '$rect = $el.Current.BoundingRectangle;',
  'if ($rect.Width -le 0 -or $rect.Height -le 0) { "no_bounds"; exit }',
  '$x = [int]($rect.X + $rect.Width / 2);',
  '$y = [int]($rect.Y + $rect.Height / 2);',
  '[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($x, $y);',
  'Start-Sleep -Milliseconds 150;',
  '[Win32.Mouse]::mouse_event(0x02, 0, 0, 0, 0);',
  '[Win32.Mouse]::mouse_event(0x04, 0, 0, 0, 0);',
  '"clicked_at_${x}_${y}"',
].join(' ');

const r = spawnSync('powershell.exe', ['-NoProfile', '-Command', script], {
  encoding: 'utf8',
  timeout: 10000,
  windowsHide: true,
});

if (r.error) {
  console.error('spawnSync error:', r.error.message);
  process.exit(1);
}

const stdout = (r.stdout || '').trim();
const stderr = (r.stderr || '').trim();

if (stderr) console.warn('stderr:', stderr);

switch (stdout) {
  case 'window_not_found':
    console.error(`FAIL: No window with class "${windowClass}" found. Is the cert dialog open?`);
    break;
  case 'element_not_found':
    console.error(`FAIL: Window found but no element named "${elementName}" inside it.`);
    console.error('Tip: run scripts/debug/dump-cert-window-elements.js to list all element names.');
    break;
  case 'no_bounds':
    console.error(`FAIL: Element "${elementName}" found but has no bounding rectangle (hidden/zero-size?).`);
    break;
  default:
    if (stdout.startsWith('clicked_at')) {
      console.log(`OK: ${stdout}`);
    } else {
      console.error('Unexpected output:', stdout);
    }
}
