/**
 * Shinhan cert — HARDWARE HID click test (make-or-break).
 *
 * Software input (keybd_event / mouse_event / SetCursorPos) is stripped by the
 * bank's kernel anti-keylogger driver — that's why DOWN keys AND software clicks
 * did nothing. A REAL USB HID device (Arduino Leonardo) emits input that is
 * indistinguishable from a physical mouse, so it should pass the filter.
 *
 * This test drives the Arduino mouse to:
 *   1. Click 하드디스크 (a normal button) — does hardware click work AT ALL?
 *   2. Click row 1 of the cert list  — does it work on the SECURE list?
 *
 * Positioning is CLOSED-LOOP: move a little, read the real cursor back via a
 * DPI-aware GetCursorPos, correct the residual, repeat until within TOL px.
 * This defeats Windows pointer acceleration and the signed-char remainder
 * overflow bug in arduino-hid-bank.js moveTo().
 *
 * YOU are the capture: watch the cert window and report what highlights.
 *
 * Env (all optional):
 *   ARDUINO_PORT = COMx           (default: auto-detect)
 *   BAUD         = 9600
 *   ROW_OFFSET   = physical px below the column header to click for row 1 (default 18)
 *   TOL          = closed-loop tolerance in px (default 2)
 *   MOVE_CAP     = max px moved per closed-loop iteration (default 400)
 *
 * Usage:  node shinhan-cert-hid-click.js
 *         $env:ARDUINO_PORT="COM5"; node shinhan-cert-hid-click.js
 */

const { chromium } = require('playwright-core');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');

let SerialPort = null;
try { ({ SerialPort } = require('serialport')); } catch (_) {}

const ARDUINO_PORT = process.env.ARDUINO_PORT || null;
const BAUD = parseInt(process.env.BAUD || '9600', 10);
const ROW_OFFSET = parseInt(process.env.ROW_OFFSET || '25', 10);
const TOL = parseInt(process.env.TOL || '2', 10);
const MOVE_CAP = parseInt(process.env.MOVE_CAP || '400', 10);

// ───────────────────────── PowerShell helper ─────────────────────────
function psFile(script, timeout = 20000) {
  const tmp = path.join(os.tmpdir(), `ps-tmp-${Date.now()}-${Math.random().toString(36).slice(2)}.ps1`);
  fs.writeFileSync(tmp, '﻿' + script, 'utf8');
  try {
    return execSync(
      `powershell -ExecutionPolicy Bypass -NonInteractive -File "${tmp}"`,
      { encoding: 'utf8', timeout }
    ).trim();
  } finally {
    try { fs.unlinkSync(tmp); } catch (_) {}
  }
}

function probeCertWindow() {
  const raw = psFile(`
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$root = [System.Windows.Automation.AutomationElement]::RootElement
$cond = New-Object System.Windows.Automation.PropertyCondition(
  [System.Windows.Automation.AutomationElement]::ClassNameProperty, 'INICertManUI')
$w = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $cond)
if ($w) { $w.Current.Name } else { '' }
`);
  return raw || '';
}

// Read list rect, header, DPI, 하드디스크(14001) rect — all PHYSICAL px — plus mouse-accel reg.
function readMetrics() {
  const raw = psFile(`
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public class DpiH2 { [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr h); }
'@
$AE=[System.Windows.Automation.AutomationElement]
$TS=[System.Windows.Automation.TreeScope]
$root=$AE::RootElement
$wc=New-Object System.Windows.Automation.PropertyCondition($AE::ClassNameProperty,'INICertManUI')
$cw=$root.FindFirst($TS::Children,$wc)
if(-not $cw){Write-Host 'ERR:NO_WIN';exit}
try { $hwnd=New-Object IntPtr($cw.Current.NativeWindowHandle); $dpi=[DpiH2]::GetDpiForWindow($hwnd); Write-Host ("DPI:{0}" -f $dpi) } catch { Write-Host 'DPI:0' }
$ac=New-Object System.Windows.Automation.PropertyCondition($AE::AutomationIdProperty,'14006')
$list=$cw.FindFirst($TS::Descendants,$ac)
if($list){ $b=$list.Current.BoundingRectangle; Write-Host ("LIST:{0},{1},{2},{3}" -f [int]$b.X,[int]$b.Y,[int]$b.Width,[int]$b.Height) } else { Write-Host 'LIST:0,0,0,0' }
$hc=New-Object System.Windows.Automation.PropertyCondition($AE::ClassNameProperty,'SysHeader32')
$hd=$cw.FindFirst($TS::Descendants,$hc)
if($hd){ $hb=$hd.Current.BoundingRectangle; Write-Host ("HEADER:{0},{1},{2},{3}" -f [int]$hb.X,[int]$hb.Y,[int]$hb.Width,[int]$hb.Height) } else { Write-Host 'HEADER:none' }
$dc=New-Object System.Windows.Automation.PropertyCondition($AE::AutomationIdProperty,'14001')
$dk=$cw.FindFirst($TS::Descendants,$dc)
if($dk){ $db=$dk.Current.BoundingRectangle; Write-Host ("HARDDISK:{0},{1},{2},{3}" -f [int]$db.X,[int]$db.Y,[int]$db.Width,[int]$db.Height) } else { Write-Host 'HARDDISK:none' }
try { $mm=Get-ItemProperty 'HKCU:\\Control Panel\\Mouse'; Write-Host ("ACCEL:speed={0},t1={1},t2={2},sens={3}" -f $mm.MouseSpeed,$mm.MouseThreshold1,$mm.MouseThreshold2,$mm.MouseSensitivity) } catch { Write-Host 'ACCEL:err' }
`);
  const out = { dpi: 0, list: null, header: null, harddisk: null, accel: '' };
  for (const line of raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean)) {
    if (line.startsWith('DPI:')) out.dpi = parseInt(line.slice(4), 10) || 0;
    else if (line.startsWith('LIST:')) { const [x, y, w, h] = line.slice(5).split(',').map(Number); out.list = { x, y, w, h }; }
    else if (line.startsWith('HEADER:') && line !== 'HEADER:none') { const [x, y, w, h] = line.slice(7).split(',').map(Number); out.header = { x, y, w, h }; }
    else if (line.startsWith('HARDDISK:') && line !== 'HARDDISK:none') { const [x, y, w, h] = line.slice(9).split(',').map(Number); out.harddisk = { x, y, w, h }; }
    else if (line.startsWith('ACCEL:')) out.accel = line.slice(6);
  }
  return out;
}

// DPI-aware physical cursor position.
function readCursor() {
  const raw = psFile(`
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public class Cur2 {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }
}
'@
[void][Cur2]::SetProcessDPIAware()
$p = New-Object Cur2+POINT
[void][Cur2]::GetCursorPos([ref]$p)
Write-Host ("CUR:{0},{1}" -f $p.X,$p.Y)
`, 10000);
  const m = raw.match(/CUR:(-?\d+),(-?\d+)/);
  return m ? { x: parseInt(m[1], 10), y: parseInt(m[2], 10) } : null;
}

// ───────────────────────── HID (Arduino) ─────────────────────────
function hidWrite(sp, cmd, settleMs) {
  return new Promise((resolve, reject) => {
    sp.write(cmd + '\n', (err) => {
      if (err) return reject(err);
      sp.drain(() => setTimeout(resolve, settleMs));
    });
  });
}

// Relative move, chunked so each MOUSE_MOVE stays small (avoids signed-char overflow on the Arduino).
async function moveRel(sp, dx, dy) {
  while (dx !== 0 || dy !== 0) {
    const sx = Math.max(-100, Math.min(100, dx));
    const sy = Math.max(-100, Math.min(100, dy));
    const moveMs = Math.max(Math.abs(sx), Math.abs(sy)) + 70; // ~5px/step*5ms ≈ 1ms/px + buffer
    await hidWrite(sp, `MOUSE_MOVE:${sx},${sy}`, moveMs);
    dx -= sx; dy -= sy;
  }
}

async function click(sp) { await hidWrite(sp, 'MOUSE_CLICK:left', 350); }

// Move cursor to absolute physical (tx,ty) with adaptive damping.
// Pointer acceleration amplifies raw moves, so we start at 50% of delta (slight undershoot)
// and halve stepScale whenever a sign flip (oscillation) is detected.
// Once within 20 px we switch to 2 px fine steps which fall below the accel threshold.
async function moveAbsolute(sp, tx, ty, label) {
  let stepScale = 0.5;
  let lastSign = { x: 0, y: 0 };

  for (let i = 1; i <= 28; i++) {
    const cur = readCursor();
    if (!cur) { console.log(`    [${label}] iter ${i}: cursor read failed`); break; }

    const dx = tx - cur.x, dy = ty - cur.y;
    const err = Math.max(Math.abs(dx), Math.abs(dy));

    if (err <= TOL) {
      console.log(`    [${label}] locked at (${cur.x},${cur.y}) after ${i - 1} move(s), err=${err}px`);
      return cur;
    }

    const curSign = { x: Math.sign(dx), y: Math.sign(dy) };
    if ((lastSign.x !== 0 && curSign.x !== 0 && curSign.x !== lastSign.x) ||
        (lastSign.y !== 0 && curSign.y !== 0 && curSign.y !== lastSign.y)) {
      stepScale = Math.max(0.03, stepScale * 0.5); // oscillation detected — reduce gain
    }
    lastSign = curSign;

    let mvx, mvy;
    if (err <= 20) {
      // Fine phase: 2 px steps — too small for pointer accel to amplify
      mvx = Math.max(-2, Math.min(2, dx));
      mvy = Math.max(-2, Math.min(2, dy));
    } else {
      mvx = Math.max(-MOVE_CAP, Math.min(MOVE_CAP, Math.round(dx * stepScale)));
      mvy = Math.max(-MOVE_CAP, Math.min(MOVE_CAP, Math.round(dy * stepScale)));
      if (mvx === 0 && dx !== 0) mvx = Math.sign(dx);
      if (mvy === 0 && dy !== 0) mvy = Math.sign(dy);
    }

    console.log(`    [${label}] iter ${i}: cur=(${cur.x},${cur.y}) Δ=(${dx},${dy}) scale=${stepScale.toFixed(3)} → move(${mvx},${mvy})`);
    await moveRel(sp, mvx, mvy);
  }

  const cur = readCursor();
  if (cur) console.log(`    [${label}] ⚠ final (${cur.x},${cur.y}), target (${tx},${ty}), residual Δ=(${tx - cur.x},${ty - cur.y})`);
  return cur;
}

async function detectPort() {
  if (ARDUINO_PORT) return ARDUINO_PORT;
  if (!SerialPort) return null;
  const ports = await SerialPort.list();
  console.log('    available serial ports:');
  for (const p of ports) console.log(`      ${p.path}  mfr='${p.manufacturer || ''}' vid=${p.vendorId || ''} pid=${p.productId || ''}`);
  const cand = ports.find(p =>
    /arduino|sparkfun|leonardo|micro|wch|ch340|2341|1b4f/i.test(`${p.manufacturer || ''} ${p.vendorId || ''} ${p.friendlyName || ''}`)
  );
  return cand ? cand.path : (ports[0] ? ports[0].path : null);
}

// ───────────────────────── main ─────────────────────────
(async () => {
  if (!SerialPort) { console.error('✗ serialport module not available in this folder.'); return; }

  const portPath = await detectPort();
  if (!portPath) { console.error('✗ no serial port found. Set ARDUINO_PORT=COMx.'); return; }
  console.log(`[0] Using Arduino port: ${portPath} @ ${BAUD}`);

  const sp = new SerialPort({ path: portPath, baudRate: BAUD });
  await new Promise((resolve, reject) => {
    sp.on('open', () => setTimeout(resolve, 2000));
    sp.on('error', reject);
  });
  sp.on('data', (d) => {
    const s = d.toString().trim();
    if (/READY|ERROR|CLICK DONE|Commands:/i.test(s)) console.log(`    [ino] ${s}`);
  });
  console.log('    ✓ Arduino connected');

  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shinhan-hid-'));
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false, channel: 'chrome', viewport: null,
    args: [
      '--start-maximized',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--allow-running-insecure-content',
      '--disable-features=IsolateOrigins,site-per-process,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults,BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessPermissionPrompt,LocalNetworkAccessChecks,PrivateNetworkAccessChecks',
    ],
  });
  const page = context.pages()[0] || await context.newPage();
  page.on('dialog', async d => { try { await d.accept(); } catch (_) {} });

  try {
    console.log('[1] Navigating + triggering cert dialog...');
    await page.goto('https://bizbank.shinhan.com/main.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    try { await page.locator('[id="mf_divRPPop99_1775110936087_wframe_btn_closePopIco"]').click({ timeout: 3000 }); } catch (_) {
      try { await page.locator('input[value="팝업닫기"]').first().click({ timeout: 2000 }); } catch (_) {}
    }
    await page.waitForTimeout(2000);
    try { await page.locator('[id="mf_wfm_main_btn_goCert"]').click({ timeout: 10000 }); } catch (_) {
      await page.locator('a:has-text("공동인증서 로그인")').first().click({ timeout: 10000 });
    }

    console.log('[2] Waiting for INICertManUI...');
    let found = false;
    for (let i = 0; i < 30; i++) { if (probeCertWindow()) { found = true; break; } await page.waitForTimeout(1000); }
    if (!found) { console.error('✗ cert window not found'); return; }
    console.log('    ✓ window found');

    console.log('[3] Reading metrics (UIA physical px) + mouse-accel settings...');
    const m = readMetrics();
    if (!m.list || !m.list.w) { console.error('✗ could not read list rect'); return; }
    const scale = m.dpi ? (m.dpi / 96) : 0;
    console.log(`    DPI     : ${m.dpi}${scale ? `  (${Math.round(scale * 100)}%)` : ''}`);
    console.log(`    LIST    : x=${m.list.x} y=${m.list.y} w=${m.list.w} h=${m.list.h}`);
    console.log(`    HEADER  : ${m.header ? `y=${m.header.y} h=${m.header.h} → row top at ${m.header.y + m.header.h}` : '(none, assume +32)'}`);
    console.log(`    HARDDISK: ${m.harddisk ? `x=${m.harddisk.x} y=${m.harddisk.y} w=${m.harddisk.w} h=${m.harddisk.h}` : '(none)'}`);
    console.log(`    ACCEL   : ${m.accel}   ← speed=0 means 'enhance pointer precision' OFF (best for us)`);

    // 3a — HID-click 하드디스크 to populate (first hardware-click test on a normal button)
    if (m.harddisk) {
      const hx = m.harddisk.x + Math.round(m.harddisk.w / 2);
      const hy = m.harddisk.y + Math.round(m.harddisk.h / 2);
      console.log(`\n[4] HID-click 하드디스크 at physical (${hx},${hy})...`);
      await moveAbsolute(sp, hx, hy, '하드디스크');
      await click(sp);
      console.log('    👁  Did the 하드디스크 button respond and the cert list populate?');
      await page.waitForTimeout(2500);
    } else {
      console.log('\n[4] (no 하드디스크 button found — assuming list already populated)');
    }

    // 3b — HID-click row 1 of the secure list
    const rowTop = m.header ? (m.header.y + m.header.h) : (m.list.y + 32);
    const tx = m.list.x + Math.round(m.list.w / 2);
    const ty = rowTop + ROW_OFFSET;
    console.log(`\n[5] HID-click ROW 1 at physical (${tx},${ty})  (header bottom ${rowTop} + ${ROW_OFFSET})...`);
    await moveAbsolute(sp, tx, ty, 'row1');
    await click(sp);

    console.log('\n    ════════════════════════════════════════════════════');
    console.log('    👁  LOOK AT THE CERT WINDOW NOW.');
    console.log('        (a) Did 하드디스크 populate the list earlier?');
    console.log('        (b) Is a certificate row now HIGHLIGHTED/SELECTED?');
    console.log('        (c) If yes — which row (top = 1)?');
    console.log('    ════════════════════════════════════════════════════');
    console.log('    (holding 12s...)');
    await page.waitForTimeout(12000);
  } finally {
    try { await context.close(); } catch (_) {}
    try { await new Promise(r => sp.close(r)); } catch (_) {}
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (_) {}
  }
})().catch(console.error);
