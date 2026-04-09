/**
 * Windows UI Automation helpers for native certificate dialogs (INI CertMan, etc.)
 */

const { spawnSync } = require('child_process');
const os = require('os');

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
  const tryClass = (className) => {
    if (!/^[A-Za-z0-9_]+$/.test(className)) return null;
    const script =
      'Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes; ' +
      '$r = [System.Windows.Automation.AutomationElement]::RootElement; ' +
      '$c = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, ' +
      `'${className}'); ` +
      '$w = $r.FindFirst([System.Windows.Automation.TreeScope]::Children, $c); ' +
      'if ($w) { $w.Current.Name + "|" + $w.Current.ClassName } else { "" }';
    const out = runPowerShellUtf8(script, { timeoutMs: 12000 });
    if (!out) return null;
    const pipe = out.indexOf('|');
    const name = pipe >= 0 ? out.slice(0, pipe) : out;
    const cls = pipe >= 0 ? out.slice(pipe + 1) : className;
    return { windowName: name, matchedClass: cls };
  };
  const tryName = (exactName) => {
    const safe = exactName.replace(/'/g, "''");
    const script =
      'Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes; ' +
      '$r = [System.Windows.Automation.AutomationElement]::RootElement; ' +
      '$c = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, ' +
      `'${safe}'); ` +
      '$w = $r.FindFirst([System.Windows.Automation.TreeScope]::Children, $c); ' +
      'if ($w) { $w.Current.Name + "|" + $w.Current.ClassName } else { "" }';
    const out = runPowerShellUtf8(script, { timeoutMs: 12000 });
    if (!out) return null;
    const pipe = out.indexOf('|');
    const cls = pipe >= 0 ? out.slice(pipe + 1) : '';
    const name = pipe >= 0 ? out.slice(0, pipe) : out;
    return { windowName: name, matchedClass: cls };
  };
  try {
    // Try common cert dialog class names first (most reliable)
    for (const cls of ['INICertManUI', 'QWidget']) {
      const hit = tryClass(cls);
      if (hit) {
        return { ok: true, windowName: hit.windowName, matchedClass: hit.matchedClass };
      }
    }
    // Try common cert dialog window titles as fallbacks
    // Different security programs use different titles:
    // - INICertMan/INITECH: "전자 서명 작성" (Create Digital Signature)
    // - Delfino/some configs: "인증서 선택" (Certificate Selection)
    for (const title of ['전자 서명 작성', '인증서 선택']) {
      const byName = tryName(title);
      if (byName && byName.matchedClass) {
        return { ok: true, windowName: byName.windowName, matchedClass: byName.matchedClass };
      }
    }
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
      'Timeout: native cert window not detected (tried INICertManUI, QWidget, titles "전자 서명 작성"/"인증서 선택"). ' +
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
  probeRootWindowByClassName,
  waitForRootWindowByClassName,
  probeNativeCertificateDialogWindow,
  waitForNativeCertificateDialogWindow,
  sendEnterKeyViaSendKeys,
};
