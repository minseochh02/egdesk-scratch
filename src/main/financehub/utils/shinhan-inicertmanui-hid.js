/**
 * Shinhan INICertManUI HID mouse flow — mirrors shinhan-cert-hid-click.js:
 *   1. 하드디스크 (AutomationId 14001) — required; populates cert list
 *   2. Cert row via header bottom + ROW_OFFSET (+ row height per index)
 *   3. Password field refocus
 */

const {
  isWindows,
  runPowerShellUtf8,
  getINICertManUIPasswordFieldCoords,
} = require('./windows-uia-native');

const DEFAULT_ROW_OFFSET = parseInt(process.env.SHINHAN_CERT_ROW_OFFSET || '35', 10);
const DEFAULT_ROW_HEIGHT = parseInt(process.env.SHINHAN_CERT_ROW_HEIGHT || '20', 10);
const HARDDISK_SETTLE_MS = parseInt(process.env.SHINHAN_CERT_HARDDISK_WAIT_MS || '2500', 10);

/**
 * One-shot UIA metrics (same elements as shinhan-cert-hid-click.js readMetrics).
 * @returns {{ ok: boolean, error?: string, dpi?: number, list?: {x:number,y:number,w:number,h:number}, header?: {y:number,h:number}, harddisk?: {x:number,y:number,w:number,h:number} }}
 */
function getINICertManUIMetrics() {
  if (!isWindows()) return { ok: false, error: 'not_windows' };
  try {
    const script =
      'Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes; ' +
      'Add-Type -MemberDefinition \'[DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr h);\' -Name DpiH2 -Namespace Win32 -ErrorAction SilentlyContinue; ' +
      '$r = [System.Windows.Automation.AutomationElement]::RootElement; ' +
      '$wc = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, \'INICertManUI\'); ' +
      '$w = $r.FindFirst([System.Windows.Automation.TreeScope]::Children, $wc); ' +
      'if (-not $w) { \'{"ok":false,"error":"window_not_found"}\'; exit } ' +
      '$dpi = 96; try { $hwnd = New-Object IntPtr($w.Current.NativeWindowHandle); $dpi = [Win32.DpiH2]::GetDpiForWindow($hwnd) } catch {} ' +
      '$lc = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty, \'14006\'); ' +
      '$list = $w.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $lc); ' +
      'if (-not $list) { ' +
      '  $lc2 = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, \'SysListView32\'); ' +
      '  $list = $w.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $lc2) ' +
      '} ' +
      '$lr = if ($list) { $list.Current.BoundingRectangle } else { $null }; ' +
      '$hc = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, \'SysHeader32\'); ' +
      '$hdr = $w.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $hc); ' +
      '$hr = if ($hdr) { $hdr.Current.BoundingRectangle } else { $null }; ' +
      '$dc = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty, \'14001\'); ' +
      '$dk = $w.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $dc); ' +
      '$dr = if ($dk) { $dk.Current.BoundingRectangle } else { $null }; ' +
      '$out = @{ ok = $true; dpi = [int]$dpi }; ' +
      'if ($lr -and $lr.Width -gt 0) { $out.listX=[int]$lr.X; $out.listY=[int]$lr.Y; $out.listW=[int]$lr.Width; $out.listH=[int]$lr.Height } ' +
      'if ($hr -and $hr.Height -gt 0) { $out.headerY=[int]$hr.Y; $out.headerH=[int]$hr.Height } ' +
      'if ($dr -and $dr.Width -gt 0) { $out.hdX=[int]$dr.X; $out.hdY=[int]$dr.Y; $out.hdW=[int]$dr.Width; $out.hdH=[int]$dr.Height } ' +
      '$out | ConvertTo-Json -Compress';
    const raw = runPowerShellUtf8(script, { timeoutMs: 12000 });
    const p = JSON.parse(raw);
    if (!p.ok) return { ok: false, error: p.error || 'unknown' };
    const out = { ok: true, dpi: p.dpi || 96 };
    if (p.listW != null) {
      out.list = { x: p.listX, y: p.listY, w: p.listW, h: p.listH };
    }
    if (p.headerH != null) {
      out.header = { y: p.headerY, h: p.headerH };
    }
    if (p.hdW != null) {
      out.harddisk = { x: p.hdX, y: p.hdY, w: p.hdW, h: p.hdH };
    }
    return out;
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Bring INICertManUI to foreground before HID clicks.
 * @returns {{ ok: boolean, error?: string }}
 */
function focusINICertManUIWindow() {
  if (!isWindows()) return { ok: false, error: 'not_windows' };
  try {
    const result = runPowerShellUtf8(
      'Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes; ' +
      'Add-Type -MemberDefinition \'[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);\' -Name Fg -Namespace Win32 -ErrorAction SilentlyContinue; ' +
      '$r = [System.Windows.Automation.AutomationElement]::RootElement; ' +
      '$wc = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, \'INICertManUI\'); ' +
      '$w = $r.FindFirst([System.Windows.Automation.TreeScope]::Children, $wc); ' +
      'if (-not $w) { "no_window"; exit } ' +
      '$hwnd = New-Object IntPtr($w.Current.NativeWindowHandle); ' +
      '[void][Win32.Fg]::SetForegroundWindow($hwnd); ' +
      'Start-Sleep -Milliseconds 200; ' +
      '"focused"',
      { timeoutMs: 8000 }
    );
    if (result === 'focused') return { ok: true };
    return { ok: false, error: result || 'focus_failed' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * @param {import('./arduino-hid-bank').ArduinoHidBankSession} hid
 * @param {import('playwright').Page} page
 * @param {{ certIndex?: number, rowOffsetPx?: number, rowHeightPx?: number, log?: (s:string)=>void, warn?: (s:string)=>void }} [opts]
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
async function runShinhanINICertManUIHidNavigation(hid, page, opts = {}) {
  const log = opts.log || (() => {});
  const warn = opts.warn || (() => {});
  const certIndex =
    opts.certIndex != null && opts.certIndex > 0 ? opts.certIndex : 1;
  const rowOffset = opts.rowOffsetPx ?? DEFAULT_ROW_OFFSET;
  const rowHeight = opts.rowHeightPx ?? DEFAULT_ROW_HEIGHT;

  const fg = focusINICertManUIWindow();
  if (!fg.ok) {
    warn(`[SHINHAN] INICertManUI 포커스 실패: ${fg.error}`);
  }

  let metrics = getINICertManUIMetrics();
  if (!metrics.ok) {
    return { ok: false, error: metrics.error || 'metrics_failed' };
  }
  if (!metrics.harddisk) {
    return {
      ok: false,
      error:
        '하드디스크 버튼(14001)을 찾지 못했습니다. 인증서 창이 INICertManUI인지 확인하세요.',
    };
  }

  const hx = metrics.harddisk.x + Math.round(metrics.harddisk.w / 2);
  const hy = metrics.harddisk.y + Math.round(metrics.harddisk.h / 2);
  log(`[SHINHAN] 1/3 하드디스크 클릭 (${hx},${hy}) — 리스트 채우기`);
  await hid.moveTo(hx, hy, '하드디스크');
  await hid.click('left');
  await page.waitForTimeout(HARDDISK_SETTLE_MS);

  metrics = getINICertManUIMetrics();
  if (!metrics.ok) {
    return { ok: false, error: metrics.error || 'metrics_after_harddisk_failed' };
  }
  if (!metrics.list || !metrics.list.w) {
    return {
      ok: false,
      error: '하드디스크 클릭 후 인증서 리스트를 찾지 못했습니다.',
    };
  }

  const rowTop = metrics.header
    ? metrics.header.y + metrics.header.h
    : metrics.list.y + 32;
  const tx = metrics.list.x + Math.round(metrics.list.w / 2);
  const ty = rowTop + rowOffset + (certIndex - 1) * rowHeight;

  log(
    `[SHINHAN] 2/3 인증서 ${certIndex}행 클릭 (${tx},${ty}) — headerBottom=${rowTop}, offset=${rowOffset}, rowHeight=${rowHeight}`
  );
  await hid.moveTo(tx, ty, `cert-row-${certIndex}`);
  await hid.click('left');
  await page.waitForTimeout(300);

  const pw = getINICertManUIPasswordFieldCoords();
  if (pw.ok) {
    log(`[SHINHAN] 3/3 비밀번호 필드 클릭 (${pw.x},${pw.y})`);
    await hid.moveTo(pw.x, pw.y, 'password');
    await hid.click('left');
    await page.waitForTimeout(300);
  } else {
    warn(`[SHINHAN] 비밀번호 필드 좌표 실패: ${pw.error}`);
  }

  return { ok: true };
}

module.exports = {
  getINICertManUIMetrics,
  focusINICertManUIWindow,
  runShinhanINICertManUIHidNavigation,
};
