/**
 * Windows UI Automation helpers for native certificate dialogs (INI CertMan, etc.)
 */

const { spawnSync, execSync } = require('child_process');
const os = require('os');

/** UIA script bodies copied from scripts/bank-excel-download-automation/kb.spec.js (STEP 3 cert window) */
const KB_SPEC_PS_UIA_INICERTMANUI =
  'Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes; ' +
  '$r = [System.Windows.Automation.AutomationElement]::RootElement; ' +
  "$c = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, 'INICertManUI'); " +
  '$w = $r.FindFirst([System.Windows.Automation.TreeScope]::Children, $c); ' +
  "if ($w) { $w.Current.Name } else { '' }";

const KB_SPEC_PS_UIA_QWIDGET =
  'Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes; ' +
  '$r = [System.Windows.Automation.AutomationElement]::RootElement; ' +
  "$c = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, 'QWidget'); " +
  '$w = $r.FindFirst([System.Windows.Automation.TreeScope]::Children, $c); ' +
  "if ($w) { $w.Current.Name } else { '' }";

const KB_SPEC_PS_UIA_NAME_CERT_SELECT =
  'Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes; ' +
  '$r = [System.Windows.Automation.AutomationElement]::RootElement; ' +
  "$c = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, '인증서 선택'); " +
  '$w = $r.FindFirst([System.Windows.Automation.TreeScope]::Children, $c); ' +
  "if ($w) { $w.Current.ClassName } else { '' }";

function isWindows() {
  return os.platform() === 'win32';
}

/**
 * @param {string} scriptBody - PowerShell statements
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {string} trimmed stdout
 */
function runPowerShellUtf8(scriptBody, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 15000;
  const full = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${scriptBody}`;
  const r = spawnSync('powershell.exe', ['-NoProfile', '-Command', full], {
    encoding: 'utf8',
    timeout: timeoutMs,
    windowsHide: true,
  });
  if (r.error) throw r.error;
  return (r.stdout || '').trim();
}

/**
 * Same invocation as kb.spec.js `ps(cmd)`:
 * execSync(`powershell -command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${cmd}"`)
 * (no -NoProfile — matches the script.)
 * @param {string} scriptBody - PowerShell after the UTF-8 prelude
 * @param {number} [timeoutMs]
 * @returns {string} trimmed stdout, or '' on failure
 */
function runPowerShellKbBankSpec(scriptBody, timeoutMs = 10000) {
  if (!isWindows()) return '';
  try {
    return execSync(
      `powershell -command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${scriptBody}"`,
      { encoding: 'utf8', timeout: timeoutMs }
    ).trim();
  } catch (e) {
    return '';
  }
}

/**
 * One-shot: KB obiz native cert window — same three probes and order as kb.spec.js STEP 3.
 * @returns {{ ok: boolean, windowName?: string, matchedClass?: string, windowType?: string }}
 */
function probeKookminKbCertificateWindow() {
  if (!isWindows()) {
    return { ok: false, error: 'UI Automation requires Windows' };
  }

  try {
    const result1 = runPowerShellKbBankSpec(KB_SPEC_PS_UIA_INICERTMANUI, 10000);
    if (result1) {
      return { ok: true, windowName: result1, matchedClass: 'INICertManUI', windowType: 'INICertManUI' };
    }
  } catch (e) {}

  try {
    const result2 = runPowerShellKbBankSpec(KB_SPEC_PS_UIA_QWIDGET, 10000);
    if (result2) {
      return { ok: true, windowName: result2, matchedClass: 'QWidget', windowType: 'QWidget' };
    }
  } catch (e) {}

  try {
    const result3 = runPowerShellKbBankSpec(KB_SPEC_PS_UIA_NAME_CERT_SELECT, 10000);
    if (result3) {
      return {
        ok: true,
        windowName: '인증서 선택',
        matchedClass: result3,
        windowType: result3,
      };
    }
  } catch (e) {}

  return { ok: false };
}

/**
 * Poll for KB cert window like kb.spec.js (30 × 1s max by default).
 * @param {{ timeoutMs?: number, pollMs?: number, onLog?: (msg: string) => void }} [opts]
 */
async function waitForKookminKbCertificateWindow(opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 30000;
  const pollMs = opts.pollMs ?? 1000;
  const onLog = opts.onLog || (() => {});
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const r = probeKookminKbCertificateWindow();
    if (r.ok) {
      onLog(`UIA (KB spec ps) found cert dialog class=${r.matchedClass} name="${r.windowName}"`);
      return r;
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  const sec = Math.round(timeoutMs / 1000);
  return {
    ok: false,
    error:
      `Cert window not detected within ${sec} seconds. Run detect-cert-window.js to diagnose. ` +
      '(Same probes/order as scripts/bank-excel-download-automation/kb.spec.js STEP 3.)',
  };
}

/**
 * One-shot: top-level window by class name (e.g. INICertManUI).
 * @param {string} className
 * @returns {{ ok: boolean, windowName?: string, error?: string }}
 */
function probeRootWindowByClassName(className) {
  if (!isWindows()) {
    return { ok: false, error: 'UI Automation requires Windows' };
  }
  if (!/^[A-Za-z0-9_]+$/.test(className)) {
    return { ok: false, error: 'Invalid class name' };
  }
  try {
    const script =
      'Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes; ' +
      '$r = [System.Windows.Automation.AutomationElement]::RootElement; ' +
      '$c = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, ' +
      `'${className}'); ` +
      '$w = $r.FindFirst([System.Windows.Automation.TreeScope]::Children, $c); ' +
      'if ($w) { $w.Current.Name } else { "" }';
    const name = runPowerShellUtf8(script, { timeoutMs: 12000 });
    if (name && name.length > 0) {
      return { ok: true, windowName: name };
    }
    return { ok: false };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Poll until window appears or timeout.
 * @param {string} className
 * @param {{ timeoutMs?: number, pollMs?: number, onLog?: (msg: string) => void }} [opts]
 * @returns {Promise<{ ok: boolean, windowName?: string, error?: string }>}
 */
async function waitForRootWindowByClassName(className, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 30000;
  const pollMs = opts.pollMs ?? 1000;
  const onLog = opts.onLog || (() => {});
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const r = probeRootWindowByClassName(className);
    if (r.ok) {
      onLog(`UIA found window class=${className} name="${r.windowName}"`);
      return r;
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return { ok: false, error: `Timeout waiting for window class ${className}` };
}

/**
 * One-shot: find common Korean bank native cert dialogs (INI CertMan, Delfino/Qt, or titled "인증서 선택").
 * Not process-based — uses the same UIA desktop children search as bank-excel-download-automation scripts.
 * @returns {{ ok: boolean, windowName?: string, matchedClass?: string, error?: string }}
 */
function probeNativeCertificateDialogWindow() {
  if (!isWindows()) {
    return { ok: false, error: 'UI Automation requires Windows' };
  }
  try {
    // Try INICertManUI (like Shinhan) - match kb.spec.js exactly
    try {
      const result = runPowerShellUtf8(
        "Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes; " +
        "$r = [System.Windows.Automation.AutomationElement]::RootElement; " +
        "$c = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, 'INICertManUI'); " +
        "$w = $r.FindFirst([System.Windows.Automation.TreeScope]::Children, $c); " +
        "if ($w) { $w.Current.Name } else { '' }",
        { timeoutMs: 12000 }
      );
      if (result) {
        return { ok: true, windowName: result, matchedClass: 'INICertManUI' };
      }
    } catch (e) {}

    // Try QWidget (like Hana) - match kb.spec.js exactly
    try {
      const result = runPowerShellUtf8(
        "Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes; " +
        "$r = [System.Windows.Automation.AutomationElement]::RootElement; " +
        "$c = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, 'QWidget'); " +
        "$w = $r.FindFirst([System.Windows.Automation.TreeScope]::Children, $c); " +
        "if ($w) { $w.Current.Name } else { '' }",
        { timeoutMs: 12000 }
      );
      if (result) {
        return { ok: true, windowName: result, matchedClass: 'QWidget' };
      }
    } catch (e) {}

    // Try by name "인증서 선택" - match kb.spec.js exactly
    try {
      const result = runPowerShellUtf8(
        "Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes; " +
        "$r = [System.Windows.Automation.AutomationElement]::RootElement; " +
        "$c = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, '인증서 선택'); " +
        "$w = $r.FindFirst([System.Windows.Automation.TreeScope]::Children, $c); " +
        "if ($w) { $w.Current.ClassName } else { '' }",
        { timeoutMs: 12000 }
      );
      if (result) {
        return { ok: true, windowName: '인증서 선택', matchedClass: result };
      }
    } catch (e) {}

    return { ok: false };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Poll until a native cert dialog is found (multiple strategies) or timeout.
 * @param {{ timeoutMs?: number, pollMs?: number, onLog?: (msg: string) => void }} [opts]
 * @returns {Promise<{ ok: boolean, windowName?: string, matchedClass?: string, error?: string }>}
 */
async function waitForNativeCertificateDialogWindow(opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 60000;
  const pollMs = opts.pollMs ?? 1000;
  const onLog = opts.onLog || (() => {});
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const r = probeNativeCertificateDialogWindow();
    if (r.ok) {
      onLog(`UIA found cert dialog class=${r.matchedClass} name="${r.windowName}"`);
      return r;
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return {
    ok: false,
    error:
      'Timeout: native cert window not detected (tried INICertManUI, QWidget, title "인증서 선택"). ' +
      'If the bank module shows its own error about a missing process, that is separate from this app — reinstall NPKI/공동인증 modules. ' +
      'If the cert window is visible but this still fails, try running EGDesk as Administrator once, or use Inspect.exe to confirm the window Class name.',
  };
}

/**
 * Returns the Name property of the currently focused native UI element via UIA FocusedElement.
 * Used to detect if TAB navigation has landed on a dangerous button (e.g. 삭제) in a native dialog.
 * Returns '' on non-Windows or any failure.
 */
function getFocusedNativeElementName() {
  if (!isWindows()) return '';
  try {
    return runPowerShellUtf8(
      'Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes; ' +
      '$f = [System.Windows.Automation.AutomationElement]::FocusedElement; ' +
      'if ($f) { $f.Current.Name } else { \'\' }',
      { timeoutMs: 3000 }
    );
  } catch (e) {
    return '';
  }
}

/**
 * Returns a JSON string of properties for the currently focused native UI element.
 * Useful for debugging and verifying password field state.
 */
function getFocusedElementProperties() {
  if (!isWindows()) return '{}';
  try {
    const script = 
      'Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes; ' +
      '$f = [System.Windows.Automation.AutomationElement]::FocusedElement; ' +
      'if (-not $f) { return "{}" } ' +
      '$props = @{ ' +
      '  Name = $f.Current.Name; ' +
      '  ClassName = $f.Current.ClassName; ' +
      '  ControlType = $f.Current.ControlType.ProgrammaticName; ' +
      '  IsEnabled = $f.Current.IsEnabled; ' +
      '  IsPassword = $f.Current.IsPassword; ' +
      '  HelpText = $f.Current.HelpText; ' +
      '}; ' +
      'try { $props["Value"] = $f.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).Current.Value } catch {} ' +
      'try { ' +
      '  $legacy = $f.GetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern).Current; ' +
      '  $props["LegacyValue"] = $legacy.Value; ' +
      '  $props["LegacyDescription"] = $legacy.Description; ' +
      '} catch {} ' +
      'return $props | ConvertTo-Json -Compress';
    return runPowerShellUtf8(script, { timeoutMs: 5000 });
  } catch (e) {
    return '{}';
  }
}

/**
 * Specifically targets elements containing masked characters (*, ●, •, etc.)
 * and returns their lengths to verify password input.
 */
/**
 * Lists all buttons in the certificate window with their names and states.
 * Used to verify safety before/during TAB navigation.
 */
function getMaskedInputVerification(windowClass) {
  if (!isWindows()) return '[]';
  try {
    const script = 
      'Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes; ' +
      '$r = [System.Windows.Automation.AutomationElement]::RootElement; ' +
      `$c = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, '${windowClass}'); ` +
      '$w = $r.FindFirst([System.Windows.Automation.TreeScope]::Children, $c); ' +
      'if (-not $w) { return "[]" } ' +
      '$els = $w.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition); ' +
      '$results = @(); ' +
      'foreach ($e in $els) { ' +
      '  $vals = @($e.Current.Name, $e.Current.HelpText); ' +
      '  try { $vals += $e.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).Current.Value } catch {} ' +
      '  try { $vals += $e.GetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern).Current.Value } catch {} ' +
      '  foreach ($v in $vals) { ' +
      '    if ($v -and $v.Trim().Length -gt 0) { ' +
      '      $maskCount = ($v.ToCharArray() | Where-Object { $_ -match "[*●⚫•○◦⦿⏺]" }).Count; ' +
      '      if ($maskCount -gt 0) { ' +
      '        $results += @{ Class = $e.Current.ClassName; Length = $maskCount; Type = "Masked" }; ' +
      '      } else { ' +
      '        $results += @{ Class = $e.Current.ClassName; RawValue = $v; Type = "Raw" }; ' +
      '      } ' +
      '      break; ' +
      '    } ' +
      '  } ' +
      '} ' +
      'return $results | ConvertTo-Json -Compress';
    return runPowerShellUtf8(script, { timeoutMs: 10000 });
  } catch (e) {
    return '[]';
  }
}

/**
 * Lists all buttons in the certificate window with their names and states.
 * Used to verify safety before/during TAB navigation.
 */
function getNativeButtonsInfo(windowClass) {
  if (!isWindows()) return '[]';
  try {
    const script = 
      'Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes; ' +
      '$r = [System.Windows.Automation.AutomationElement]::RootElement; ' +
      `$c = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, '${windowClass}'); ` +
      '$w = $r.FindFirst([System.Windows.Automation.TreeScope]::Children, $c); ' +
      'if (-not $w) { return "[]" } ' +
      '$els = $w.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition); ' +
      '$results = @(); ' +
      'foreach ($e in $els) { ' +
      '  $name = $e.Current.Name; ' +
      '  if ($name -and $name.Trim().Length -gt 0) { ' +
      '    $results += @{ Name = $name.Trim(); IsEnabled = $e.Current.IsEnabled; Class = $e.Current.ClassName; Control = $e.Current.ControlType.ProgrammaticName.Replace("ControlType.", "") }; ' +
      '  } ' +
      '} ' +
      'return $results | ConvertTo-Json -Compress';
    return runPowerShellUtf8(script, { timeoutMs: 10000 });
  } catch (e) {
    return '[]';
  }
}

/**
 * Directly focuses a named element inside the certificate window via UIA SetFocus().
 * Eliminates dangerous TAB navigation by targeting the element directly.
 * @param {string} windowClass - The window class (e.g. 'QWidget')
 * @param {string} elementName - The Name property to search for (e.g. 'passwordFrame')
 * @returns {{ ok: boolean, error?: string }}
 */
function focusCertElement(windowClass, elementName) {
  if (!isWindows()) return { ok: false, error: 'not windows' };
  try {
    const result = runPowerShellUtf8(
      'Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes; ' +
      'Add-Type -AssemblyName System.Windows.Forms; ' +
      // mouse_event P/Invoke (here-string 없이 안전하게)
      'Add-Type -MemberDefinition \'[DllImport("user32.dll")] public static extern void mouse_event(int f, int x, int y, int d, int e);\' -Name Mouse -Namespace Win32 -ErrorAction SilentlyContinue; ' +
      '$r = [System.Windows.Automation.AutomationElement]::RootElement; ' +
      `$wc = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, '${windowClass}'); ` +
      '$w = $r.FindFirst([System.Windows.Automation.TreeScope]::Children, $wc); ' +
      'if (-not $w) { "window_not_found"; exit } ' +
      `$nc = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, '${elementName}'); ` +
      '$el = $w.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $nc); ' +
      'if (-not $el) { "element_not_found"; exit } ' +
      // BoundingRectangle으로 좌표를 구해서 마우스 클릭
      '$rect = $el.Current.BoundingRectangle; ' +
      'if ($rect.Width -le 0 -or $rect.Height -le 0) { "no_bounds"; exit } ' +
      '$x = [int]($rect.X + $rect.Width / 2); ' +
      '$y = [int]($rect.Y + $rect.Height / 2); ' +
      '[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($x, $y); ' +
      'Start-Sleep -Milliseconds 150; ' +
      '[Win32.Mouse]::mouse_event(0x02, 0, 0, 0, 0); ' +
      '[Win32.Mouse]::mouse_event(0x04, 0, 0, 0, 0); ' +
      '"clicked_at_${x}_${y}"',
      { timeoutMs: 10000 }
    );
    if (result.startsWith('clicked_at')) return { ok: true, method: result };
    return { ok: false, error: result };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * If a deletion confirmation dialog is currently focused (i.e. after accidentally triggering 삭제),
 * finds a '취소' button within that dialog via UIA and invokes it.
 * Returns 'clicked' | 'no_cancel_button' | 'no_window' | 'no_focus' | '' (non-Windows/error).
 */
function dismissNativeDeletionConfirmDialog() {
  if (!isWindows()) return '';
  try {
    return runPowerShellUtf8(
      'Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes; ' +
      '$f = [System.Windows.Automation.AutomationElement]::FocusedElement; ' +
      'if (-not $f) { "no_focus"; exit } ' +
      '$walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker; ' +
      '$node = $f; $win = $null; ' +
      'for ($i = 0; $i -lt 15; $i++) { ' +
      '  $p = $walker.GetParent($node); ' +
      '  if ($p -eq $null) { break } ' +
      '  if ($p.Current.ControlType -eq [System.Windows.Automation.ControlType]::Window) { $win = $p; break } ' +
      '  $node = $p ' +
      '} ' +
      'if (-not $win) { "no_window"; exit } ' +
      '$cond = New-Object System.Windows.Automation.AndCondition(' +
      '  (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button)),' +
      '  (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, "취소"))' +
      '); ' +
      '$btn = $win.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond); ' +
      'if (-not $btn) { "no_cancel_button"; exit } ' +
      '$ip = $btn.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern); ' +
      '$ip.Invoke(); ' +
      '"clicked"',
      { timeoutMs: 5000 }
    );
  } catch (e) {
    return '';
  }
}

/**
 * Send Enter to the foreground window (fallback after typing cert password).
 */
function sendEnterKeyViaSendKeys() {
  if (!isWindows()) return { ok: false, error: 'not windows' };
  try {
    runPowerShellUtf8(
      'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")',
      { timeoutMs: 5000 }
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = {
  isWindows,
  runPowerShellUtf8,
  runPowerShellKbBankSpec,
  probeKookminKbCertificateWindow,
  waitForKookminKbCertificateWindow,
  probeRootWindowByClassName,
  waitForRootWindowByClassName,
  probeNativeCertificateDialogWindow,
  waitForNativeCertificateDialogWindow,
  getFocusedNativeElementName,
  getFocusedElementProperties,
  getMaskedInputVerification,
  getNativeButtonsInfo,
  focusCertElement,
  dismissNativeDeletionConfirmDialog,
  sendEnterKeyViaSendKeys,
};
