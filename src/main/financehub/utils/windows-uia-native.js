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
  sendEnterKeyViaSendKeys,
};
