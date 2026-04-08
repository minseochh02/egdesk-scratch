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
  sendEnterKeyViaSendKeys,
};
