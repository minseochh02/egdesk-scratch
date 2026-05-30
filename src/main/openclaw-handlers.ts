/**
 * IPC handlers for OpenClaw CLI install, config, gateway, and Telegram pairing.
 */
import { ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { focusPlaywrightPage } from './shared/browser/focus-page';

const IS_WIN = process.platform === 'win32';

/** Derive a unique Telegram bot username from a Google email local part.
 *  e.g. john.doe@gmail.com → egdesk_johndoe_bot */
function deriveBotUsername(email: string): string {
  const localPart = email.split('@')[0] ?? '';
  const sanitized = localPart.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const prefix = 'egdesk_';
  const suffix = '_bot';
  const maxMiddle = 32 - prefix.length - suffix.length; // 21 chars
  const middle = sanitized.slice(0, maxMiddle) || 'user';
  return `${prefix}${middle}${suffix}`;
}

/** `which` on Unix, `where` on Windows */
const WHICH = IS_WIN ? 'where' : 'which';

/** Build a base clean env, removing Electron-injected NODE_OPTIONS and setting the right home var.
 *  Also extends PATH with common npm global bin directories — in production Electron .app bundles
 *  the inherited PATH is stripped and doesn't include /usr/local/bin or ~/.npm-global/bin. */
function makeCleanEnv(homeDir: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, HOME: homeDir };
  if (IS_WIN) env.USERPROFILE = homeDir;
  delete env.NODE_OPTIONS;

  if (IS_WIN) {
    // npm global CLI tools + Node.js runtime on Windows
    const appData = env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
    const extraWin = [
      // Windows system dirs first — where.exe, cmd.exe, etc. live here
      'C:\\Windows\\System32',
      'C:\\Windows',
      'C:\\Windows\\System32\\Wbem',
      // npm global CLI tools + Node.js runtime
      path.join(appData, 'npm'),                           // npm install -g destination (default)
      'C:\\Program Files\\nodejs',                          // Node.js + npm installed by the installer
      'C:\\Program Files (x86)\\nodejs',                   // 32-bit Node.js installer
      path.join(homeDir, 'AppData', 'Roaming', 'npm'),     // explicit in case APPDATA is wrong
      path.join(homeDir, '.volta', 'bin'),                  // Volta version manager
      ...(env.NVM_HOME ? [env.NVM_HOME] : []),              // nvm-windows active version dir
      ...(env.NVM_SYMLINK ? [env.NVM_SYMLINK] : []),        // nvm-windows symlink dir
    ];
    const cur = (env.PATH || '').split(';');
    for (const p of extraWin) if (p && !cur.includes(p)) cur.push(p);
    env.PATH = cur.join(';');
  } else {
    // Common global npm / Homebrew bin directories on macOS/Linux
    const extraUnix = [
      '/usr/local/bin',
      '/opt/homebrew/bin',
      '/opt/homebrew/sbin',
      `${homeDir}/.npm-global/bin`,
      `${homeDir}/.local/bin`,
      '/usr/bin',
      '/bin',
    ];
    const cur = (env.PATH || '').split(':');
    for (const p of extraUnix) if (!cur.includes(p)) cur.push(p);
    env.PATH = cur.join(':');
  }

  return env;
}

/**
 * Kill the openclaw gateway process.
 * On Unix: pkill with progressively broader patterns.
 * On Windows: taskkill by image name, then by commandline filter.
 */
async function killGateway(): Promise<void> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  const cmds = IS_WIN
    ? [
        'taskkill /F /IM openclaw.exe /T',
        'taskkill /F /FI "COMMANDLINE eq *openclaw*gateway*" /T',
        'taskkill /F /FI "WINDOWTITLE eq OpenClaw Gateway*" /T',
      ]
    : [
        'pkill -f "openclaw gateway"',
        'pkill -f "openclaw"',
        'pkill -9 -f "openclaw"',
      ];

  for (const cmd of cmds) {
    try {
      // Don't return early — try all kill methods to be sure
      await execAsync(cmd, { timeout: 5_000 });
    } catch { /* ignore errors if process not found */ }
  }
  // Wait a bit for OS to release ports
  await new Promise(r => setTimeout(r, 2000));
}

/** Run an openclaw CLI command; failures are non-fatal unless rethrown by caller. */
async function execOpenClawCmd(
  cmd: string,
  cleanEnv: NodeJS.ProcessEnv,
  log: (msg: string) => void,
  timeoutMs = 30_000,
): Promise<{ stdout: string; stderr: string }> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      env: cleanEnv,
      timeout: timeoutMs,
      maxBuffer: 5 * 1024 * 1024,
    });
    const out = (stdout || '').trim();
    if (out) log(`${cmd} → ${out.slice(0, 200)}`);
    return { stdout: stdout || '', stderr: stderr || '' };
  } catch (e: any) {
    const errOut = (e?.stderr || e?.stdout || e?.message || '').toString().trim();
    log(`${cmd} → ${errOut.slice(0, 200) || '(not running)'}`);
    return { stdout: (e?.stdout || '') as string, stderr: errOut };
  }
}

/** Stop/uninstall managed gateway service and kill orphaned processes (single-poller model). */
async function teardownManagedGateway(cleanEnv: NodeJS.ProcessEnv, log: (msg: string) => void): Promise<void> {
  log('Tearing down managed gateway service (stop + uninstall)…');
  await execOpenClawCmd('openclaw gateway stop', cleanEnv, log);
  await execOpenClawCmd('openclaw gateway uninstall', cleanEnv, log);
  await execOpenClawCmd('openclaw gateway status --deep', cleanEnv, log);
  await execOpenClawCmd('openclaw doctor --deep', cleanEnv, log);
  log('Killing any orphaned gateway processes…');
  await killGateway().catch(() => {});
  await new Promise(r => setTimeout(r, 1500));
}

function parseTelegramConnectedFromStatusJson(raw: string): boolean {
  try {
    const data = JSON.parse(raw);
    const accounts = data?.channelAccounts?.telegram;
    if (Array.isArray(accounts) && accounts.some((a: { connected?: boolean }) => a?.connected === true)) {
      return true;
    }
  } catch { /* fall through */ }
  return false;
}

function parseTelegramConnectedFromStatusText(raw: string): boolean {
  const text = raw.toLowerCase();
  return text.includes('connected') && !text.includes('unauthorized');
}

async function isTelegramChannelConnected(
  cleanEnv: NodeJS.ProcessEnv,
  execAsync: (cmd: string, opts: object) => Promise<{ stdout: string }>,
): Promise<boolean> {
  try {
    const { stdout } = await execAsync('openclaw channels status --json', {
      env: cleanEnv, timeout: 10_000, maxBuffer: 1024 * 1024,
    });
    if (parseTelegramConnectedFromStatusJson(stdout)) return true;
  } catch { /* try text fallback */ }
  try {
    const { stdout } = await execAsync('openclaw channels status', {
      env: cleanEnv, timeout: 10_000, maxBuffer: 1024 * 1024,
    });
    return parseTelegramConnectedFromStatusText(stdout);
  } catch { /* not ready */ }
  return false;
}

async function waitForTelegramChannelConnected(
  cleanEnv: NodeJS.ProcessEnv,
  execAsync: (cmd: string, opts: object) => Promise<{ stdout: string }>,
  log: (msg: string) => void,
  maxAttempts = 30,
  intervalMs = 2000,
): Promise<boolean> {
  log('Waiting for Telegram channel to connect (not just gateway reachable)…');
  for (let i = 0; i < maxAttempts; i++) {
    if (await isTelegramChannelConnected(cleanEnv, execAsync)) {
      log(`Telegram channel connected (probe ${i + 1}/${maxAttempts}).`);
      return true;
    }
    log(`Telegram connect probe ${i + 1}/${maxAttempts}: not connected yet`);
    if (i < maxAttempts - 1) await new Promise(r => setTimeout(r, intervalMs));
  }
  log('ERROR: Telegram never reached connected. Check: openclaw channels logs --channel telegram');
  try {
    await execAsync('openclaw channels logs --channel telegram', {
      env: cleanEnv, timeout: 15_000, maxBuffer: 1024 * 1024,
    });
  } catch { /* non-fatal */ }
  return false;
}

function parsePairingCodeFromJson(raw: string): string | null {
  try {
    const data = JSON.parse(raw);
    const requests = data?.requests;
    if (Array.isArray(requests) && requests.length > 0) {
      const code = requests[0]?.code;
      if (typeof code === 'string' && /^[A-Z0-9]{6,}$/i.test(code)) return code.toUpperCase();
    }
  } catch { /* fall through */ }
  return null;
}

function parsePairingCodeFromText(raw: string): string | null {
  const match = raw.match(/openclaw\s+pairing\s+approve\s+telegram\s+([A-Z0-9]{8})/i) ||
                raw.match(/\b([A-Z0-9]{8})\b/);
  return match ? match[1].toUpperCase() : null;
}

async function fetchTelegramPairingCode(
  cleanEnv: NodeJS.ProcessEnv,
  execAsync: (cmd: string, opts: object) => Promise<{ stdout: string }>,
): Promise<string | null> {
  try {
    const { stdout } = await execAsync('openclaw pairing list telegram --json', {
      env: cleanEnv, timeout: 10_000, maxBuffer: 1024 * 1024,
    });
    const fromJson = parsePairingCodeFromJson(stdout);
    if (fromJson) return fromJson;
  } catch { /* try text fallback */ }
  try {
    const { stdout } = await execAsync('openclaw pairing list telegram', {
      env: cleanEnv, timeout: 10_000, maxBuffer: 1024 * 1024,
    });
    return parsePairingCodeFromText(stdout);
  } catch { /* no pending request */ }
  return null;
}

async function pollTelegramPairingCode(
  cleanEnv: NodeJS.ProcessEnv,
  execAsync: (cmd: string, opts: object) => Promise<{ stdout: string }>,
  log: (msg: string) => void,
  maxAttempts = 30,
  intervalMs = 2000,
): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const code = await fetchTelegramPairingCode(cleanEnv, execAsync);
    if (code) {
      log(`Pairing code found via CLI: ${code}`);
      return code;
    }
    if (i < maxAttempts - 1) await new Promise(r => setTimeout(r, intervalMs));
  }
  return null;
}

async function spawnSingleGateway(
  cleanEnv: NodeJS.ProcessEnv,
  log: (msg: string) => void,
): Promise<{ ok: boolean; output: string[] }> {
  const { spawn } = await import('child_process');
  log('Spawning: openclaw gateway run --force');
  const gatewayOutput: string[] = [];

  return new Promise((resolve) => {
    const gatewayProc = spawn('openclaw', ['gateway', 'run', '--force'], IS_WIN
      ? { env: cleanEnv, detached: false, stdio: ['ignore', 'pipe', 'pipe'] as const, shell: true }
      : { env: cleanEnv, detached: true, stdio: ['ignore', 'pipe', 'pipe'] as const });

    const push = (msg: string) => {
      gatewayOutput.push(msg);
      if (msg.includes('[') || msg.includes('Error') || msg.includes('error')) {
        log(`[gateway] ${msg.trim()}`);
      }
    };

    gatewayProc.stdout?.on('data', (d: Buffer) => push(d.toString()));
    gatewayProc.stderr?.on('data', (d: Buffer) => push(d.toString()));
    gatewayProc.on('error', (err) => {
      log(`Gateway spawn error: ${err.message}`);
      resolve({ ok: false, output: gatewayOutput });
    });
    gatewayProc.on('exit', (code) => {
      if (code !== null && code !== 0) {
        log(`Gateway exited with code ${code}`);
        resolve({ ok: false, output: gatewayOutput });
      }
    });

    // Give the process a moment to bind before returning
    setTimeout(() => {
      gatewayProc.unref();
      resolve({ ok: true, output: gatewayOutput });
    }, 1500);
  });
}

async function sendTelegramStartInBrowser(
  profileDir: string,
  botUsername: string,
  log: (msg: string) => void,
): Promise<void> {
  const { chromium: chromiumExtra } = await import('playwright-extra');
  const StealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default;
  chromiumExtra.use(StealthPlugin());

  const context = await chromiumExtra.launchPersistentContext(profileDir, {
    headless: false,
    channel: 'chrome',
    viewport: null,
    args: [
      '--window-size=907,867',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  try {
    const pages = context.pages();
    const page = pages.length > 0 ? pages[0] : await context.newPage();
    const tgUrl = `https://web.telegram.org/k/#@${botUsername}`;

    log(`Navigating to ${tgUrl}`);
    await page.goto(tgUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await focusPlaywrightPage(page);

    const loggedIn = await page.locator('#page-chats').waitFor({ state: 'visible', timeout: 15_000 }).then(() => true).catch(() => false);
    if (!loggedIn) throw new Error('Telegram session not found — please run Telegram setup first.');

    await page.waitForTimeout(2000);
    const startBtn = page.locator('button.chat-input-control-button:has-text("START")').first();
    if (await startBtn.isVisible({ timeout: 5000 })) {
      log('Clicking START button…');
      await startBtn.click({ force: true });
      await page.waitForTimeout(2000);
    }

    await page.waitForSelector('.input-message-input', { timeout: 10_000 });
    await page.locator('.input-message-input').first().click({ force: true });
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('/start');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
    log('/start sent to bot — polling CLI for pairing code…');
  } finally {
    await context.close().catch(() => {});
  }
}

async function runTelegramPairingFlow(opts: {
  cleanEnv: NodeJS.ProcessEnv;
  execAsync: (cmd: string, options: object) => Promise<{ stdout: string; stderr?: string }>;
  profileDir: string;
  botUsername: string;
  log: (msg: string) => void;
  skipIfAlreadyPaired?: boolean;
}): Promise<{ pairingCode: string; pairingError: string; alreadyPaired: boolean }> {
  const { cleanEnv, execAsync, profileDir, botUsername, log, skipIfAlreadyPaired = true } = opts;
  let pairingCode = '';
  let pairingError = '';
  let alreadyPaired = false;

  if (skipIfAlreadyPaired) {
    try {
      const { stdout } = await execAsync('openclaw channels status', {
        env: cleanEnv, timeout: 10_000, maxBuffer: 1024 * 1024,
      });
      if (stdout.includes('connected') && !stdout.includes('Unauthorized')) {
        log('✅ Telegram already connected — skipping pairing.');
        alreadyPaired = true;
        return { pairingCode, pairingError, alreadyPaired };
      }
    } catch { /* proceed with pairing */ }
  }

  const channelReady = await waitForTelegramChannelConnected(cleanEnv, execAsync, log);
  if (!channelReady) {
    return {
      pairingCode: '',
      pairingError: 'Telegram channel never reached connected state — /start is not safe yet.',
      alreadyPaired: false,
    };
  }

  pairingCode = (await fetchTelegramPairingCode(cleanEnv, execAsync)) ?? '';
  if (pairingCode) {
    log(`Existing pending pairing code found: ${pairingCode}`);
    return { pairingCode, pairingError, alreadyPaired: false };
  }

  if (!fs.existsSync(profileDir)) {
    pairingError = `Profile dir not found: ${profileDir}`;
    log(`⚠️ ${pairingError}`);
    return { pairingCode, pairingError, alreadyPaired: false };
  }

  try {
    await sendTelegramStartInBrowser(profileDir, botUsername, log);
  } catch (browserErr: any) {
    log(`Browser /start failed: ${browserErr.message}`);
    pairingError = browserErr.message;
  }

  pairingCode = (await pollTelegramPairingCode(cleanEnv, execAsync, log)) ?? '';
  if (!pairingCode && !pairingError) {
    pairingError = 'No pairing code found after /start. Inspect: openclaw pairing list telegram';
  }

  return { pairingCode, pairingError, alreadyPaired: false };
}

/**
 * Helper: ensure OpenClaw CLI is installed.
 */
async function ensureCliInstalled(cleanEnv: NodeJS.ProcessEnv, log: (msg: string) => void): Promise<boolean> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  let alreadyInstalled = false;
  try {
    const { stdout: verOut } = await execAsync('openclaw --version', { env: cleanEnv, timeout: 8_000 });
    log(`openclaw already installed: ${verOut.trim()}`);
    alreadyInstalled = true;
  } catch (verErr: any) {
    log(`openclaw check failed (${(verErr?.message || '').split('\n')[0].slice(0, 120)}) — reinstalling…`);
  }

  if (!alreadyInstalled) {
    log('Running: npm uninstall -g openclaw');
    try {
      await execAsync('npm uninstall -g openclaw', { env: cleanEnv, timeout: 30_000, maxBuffer: 5 * 1024 * 1024 });
    } catch {}
    log('Running: npm install -g openclaw@latest');
    await execAsync('npm install -g openclaw@latest', { env: cleanEnv, timeout: 120_000, maxBuffer: 10 * 1024 * 1024 });
    log('npm install complete');
  }
  return alreadyInstalled;
}

/**
 * Helper: run OpenClaw onboard with Gemini.
 */
async function runOnboardGemini(cleanEnv: NodeJS.ProcessEnv, log: (msg: string) => void): Promise<boolean> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  const geminiKeyForOnboard = cleanEnv.GEMINI_API_KEY;
  if (!geminiKeyForOnboard) {
    log('⚠️ No Gemini API key found for onboard.');
    return false;
  }

  log('Running: openclaw onboard --non-interactive (Gemini)');
  try {
    await execAsync(
      `openclaw onboard --non-interactive --accept-risk --mode local --auth-choice gemini-api-key --gemini-api-key "${geminiKeyForOnboard}"`,
      { env: cleanEnv, timeout: 30_000, maxBuffer: 1024 * 1024 }
    );
    return true;
  } catch (e: any) {
    const out = (e.stdout || e.stderr || '').trim();
    const succeeded = out.includes('openclaw.json') || out.includes('Telegram: ok');
    if (!succeeded) log(`onboard failed: ${out.slice(0, 300)}`);
    return succeeded;
  }
}

/**
 * Helper: run OpenClaw doctor --fix.
 */
async function runDoctorFix(cleanEnv: NodeJS.ProcessEnv, log: (msg: string) => void): Promise<boolean> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  log('Running: openclaw doctor --fix');
  try {
    await execAsync('openclaw doctor --fix', { env: cleanEnv, timeout: 15_000, maxBuffer: 1024 * 1024 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Helper: install Kakao plugin.
 */
async function installKakaoPlugin(cleanEnv: NodeJS.ProcessEnv, log: (msg: string) => void): Promise<boolean> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  try {
    const { app: electronApp } = require('electron');
    const devResourcesPath = path.join(__dirname, '..', '..', 'resources');
    const prodResourcesPath = process.resourcesPath || (electronApp ? path.join(electronApp.getAppPath(), '..', 'resources') : null);
    const resourcesBase = fs.existsSync(path.join(devResourcesPath, 'openclaw-kakao-plugin')) ? devResourcesPath : (prodResourcesPath || devResourcesPath);
    const pluginPath = path.join(resourcesBase, 'openclaw-kakao-plugin');

    if (fs.existsSync(pluginPath)) {
      log(`Installing Kakao plugin from ${pluginPath}…`);
      await execAsync(`openclaw plugins install --force "${pluginPath}"`, { env: cleanEnv, timeout: 60_000, maxBuffer: 5 * 1024 * 1024 });

      // 번들에 node_modules가 빠져 있을 수 있으므로 (.gitignore 등)
      // 설치된 확장 폴더에서 npm install --production을 실행하여 누락된 의존성(zod 등)을 보장
      const extensionDir = path.join(os.homedir(), '.openclaw', 'extensions', 'kakao');
      if (fs.existsSync(path.join(extensionDir, 'package.json'))) {
        log('Installing Kakao plugin dependencies…');
        await execAsync('npm install --production', { cwd: extensionDir, env: cleanEnv, timeout: 120_000, maxBuffer: 5 * 1024 * 1024 });
        log('Kakao plugin dependencies installed.');
      }

      return true;
    } else {
      log(`⚠️ Kakao plugin path not found: ${pluginPath}`);
      return false;
    }
  } catch (e: any) {
    log(`Kakao plugin install failed: ${e?.message}`);
    return false;
  }
}

/**
 * Helper: run Golden Merge to write openclaw.json.
 */
async function runGoldenMerge(configDir: string, configPath: string, resolvedToken: string, log: (msg: string) => void): Promise<boolean> {
  try {
    if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
    
    const currentCfg = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf-8')) : {};
    
    const finalCfg = {
      ...currentCfg,
      gateway: {
        ...(currentCfg.gateway ?? {}),
        mode: 'local',
      },
      agents: {
        ...(currentCfg.agents ?? {}),
        defaults: {
          ...(currentCfg.agents?.defaults ?? {}),
          model: {
            ...(currentCfg.agents?.defaults?.model ?? {}),
            primary: 'google/gemini-3.1-pro-preview',
          }
        }
      },
      channels: {
        ...(currentCfg.channels ?? {}),
        telegram: {
          ...(currentCfg.channels?.telegram ?? {}),
          enabled: true,
          botToken: resolvedToken,
        },
        kakao: {
          enabled: true,
          webhookPath: '/kakao/skill',
          useCallback: true,
          callbackTimeoutMs: 180000,
          dmPolicy: 'open',
          ...(currentCfg.channels?.kakao ?? {}),
        }
      },
      mcp: {
        ...(currentCfg.mcp ?? {}),
        servers: {
          ...(currentCfg.mcp?.servers ?? {}),
          egdesk: { type: 'http', url: 'http://localhost:8080/mcp' }
        }
      },
      plugins: {
        ...(currentCfg.plugins ?? {}),
        entries: {
          ...(currentCfg.plugins?.entries ?? {}),
          bonjour: { enabled: false } // prevent mDNS crash
        }
      }
    };

    // Clean up legacy/wrong keys
    delete (finalCfg as any).mcpServers;

    fs.writeFileSync(configPath, JSON.stringify(finalCfg, null, 2));
    fs.writeFileSync(path.join(configDir, 'openclaw.json.last-good'), JSON.stringify(finalCfg, null, 2));
    log('✅ openclaw.json finalized with Golden Merge (Telegram, Kakao, MCP, Gemini).');
    return true;
  } catch (e: any) {
    log(`❌ Golden Merge failed: ${e?.message}`);
    return false;
  }
}

/**
 * Helper: install OpenClaw gateway binary.
 */
async function installGateway(cleanEnv: NodeJS.ProcessEnv, log: (msg: string) => void): Promise<boolean> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  log('Running: openclaw gateway install');
  try {
    await execAsync('openclaw gateway install', { env: cleanEnv, timeout: 60_000, maxBuffer: 5 * 1024 * 1024 });
    return true;
  } catch (e: any) {
    log(`gateway install failed: ${e?.message}`);
    return false;
  }
}

/**
 * Helper: install OpenClaw daemon.
 */
async function installDaemon(cleanEnv: NodeJS.ProcessEnv, log: (msg: string) => void): Promise<boolean> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  log('Running: openclaw onboard --install-daemon');
  try {
    await execAsync('openclaw onboard --install-daemon', { env: cleanEnv, timeout: 60_000, maxBuffer: 5 * 1024 * 1024 });
    return true;
  } catch {
    return false;
  }
}

export function registerOpenClawHandlers(getGoogleProfilesDir: () => string): void {
  // ---------------------------------------------------------------------------
  // OpenClaw — install CLI, write Telegram bot token to ~/.openclaw/openclaw.json
  // ---------------------------------------------------------------------------
  ipcMain.handle(
    'openclaw:setup',
    async (_event, { botToken, profileName }: { botToken: string; profileName: string }) => {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      const homeDir = os.homedir();
      const configDir = path.join(homeDir, '.openclaw');
      const configPath = path.join(configDir, 'openclaw.json');
      const setupProfileDir = path.join(getGoogleProfilesDir(), profileName);

      // Read profile metadata from Electron Store (fallback if caller didn't pass them)
      const { getStore } = require('./storage');
      const store = getStore();
      const profiles = store.get('googleProfiles') || {};
      const savedProfile = profiles[profileName] || {};

      const resolvedToken = botToken?.trim() || savedProfile.telegramBotToken || '';
      const botUsername: string = savedProfile.telegramBotUsername || deriveBotUsername(savedProfile.googleEmail ?? '');

      if (!resolvedToken) {
        return { success: false, error: 'No bot token found — run Telegram setup first.' };
      }

      const log = (msg: string) => {
        console.log(`[openclaw:setup] ${msg}`);
        // Also log to electron-log for persistence in main.log
        const electronLog = require('electron-log');
        electronLog.info(`[openclaw:setup] ${msg}`);
      };

      // ── 0. Ensure local MCP server + tunnel are running ──
      try {
        const { getLocalServerManager } = require('./mcp/server-creator/local-server-manager');
        const { getStore } = require('./storage');
        const { startTunnel } = require('./mcp/server-creator/tunneling-manager');
        const { randomUUID } = require('crypto');

        const localServer = getLocalServerManager();
        if (!localServer.getStatus().isRunning) {
          log('Starting local MCP server on port 8080...');
          await localServer.startServer({ port: 8080, useHTTPS: false });
          await new Promise(r => setTimeout(r, 1000));
        }

        const store = getStore();
        const mcpConfig = (store?.get('mcpConfiguration') as any) ?? {};
        const serverName = mcpConfig?.tunnel?.serverName;
        const alreadyConnected = mcpConfig?.tunnel?.registered && mcpConfig?.tunnel?.publicUrl;

        if (serverName && !alreadyConnected) {
          log(`Starting tunnel "${serverName}"...`);
          const existingApiKey = mcpConfig?.tunnel?.apiKey || randomUUID();
          const tunnelResult = await startTunnel(serverName, 'http://localhost:8080', existingApiKey);
          if (tunnelResult?.success && tunnelResult?.publicUrl) {
            mcpConfig.tunnel = {
              ...(mcpConfig.tunnel ?? {}),
              registered: true,
              publicUrl: tunnelResult.publicUrl,
              apiKey: existingApiKey,
              lastConnectedAt: new Date().toISOString(),
            };
            store.set('mcpConfiguration', mcpConfig);
            localServer.setApiKey(existingApiKey);
            log(`Tunnel started: ${tunnelResult.publicUrl}`);
          } else {
            log(`⚠️ Tunnel start returned: ${tunnelResult?.message || tunnelResult?.error || 'unknown'}`);
          }
        } else if (!serverName) {
          log('⚠️ No tunnel serverName in store — skipping tunnel start (will have no API key in MCP config)');
        }
      } catch (e: any) {
        log(`⚠️ Server/tunnel auto-start error: ${e?.message || e}`);
      }

      // Build a clean env without NODE_OPTIONS (Electron dev sets --require ts-node/register
      // which breaks npm's preinstall scripts in spawned processes)
      const cleanEnv = makeCleanEnv(homeDir);

      // Inject Gemini API key from EGDesk's AI keys store
      try {
        const { getStore } = require('./storage');
        const store = getStore();
        const aiKeys = store ? store.get('ai-keys', []) : [];
        let googleKey: any = null;
        if (Array.isArray(aiKeys)) {
          googleKey =
            aiKeys.find((k: any) => (k?.name || '').toLowerCase() === 'egdesk' && k?.providerId === 'google') ||
            aiKeys.find((k: any) => k?.providerId === 'google' && k?.isActive) ||
            aiKeys.find((k: any) => k?.providerId === 'google');
        }
        if (googleKey?.fields?.apiKey) {
          cleanEnv.GEMINI_API_KEY = googleKey.fields.apiKey;
          cleanEnv.GOOGLE_API_KEY = googleKey.fields.apiKey;
          cleanEnv.GOOGLE_GENERATIVE_AI_API_KEY = googleKey.fields.apiKey;
        } else {
          return { success: false, error: 'No Gemini API key found. Please add a Google API key in Settings > AI Keys first.' };
        }
      } catch { /* non-fatal */ }

      try {
        log(`profileName=${profileName} botToken=${resolvedToken || '(none)'} botUsername=${botUsername}`);

        // ── 1. Install openclaw if not on PATH or corrupted ──
        const alreadyInstalled = await ensureCliInstalled(cleanEnv, log);

        // ── 2. Run openclaw onboard FIRST to initialize the file ──
        await runOnboardGemini(cleanEnv, log);

        // ── 3. Run doctor --fix to ensure base health ──
        await runDoctorFix(cleanEnv, log);

        // ── 4. Install Kakao plugin ──
        await installKakaoPlugin(cleanEnv, log);

        // ── 5. THE GOLDEN MERGE: final config before any gateway runs ──
        await runGoldenMerge(configDir, configPath, resolvedToken, log);

        // ── 6. Tear down managed gateway service (single-poller model) ──
        await teardownManagedGateway(cleanEnv, log);

        // ── 7. Spawn one gateway against final config ──
        const gatewaySpawn = await spawnSingleGateway(cleanEnv, log);
        if (!gatewaySpawn.ok) {
          log('⚠️ Gateway spawn may have failed — continuing to probe channel state.');
        }

        // ── 8–9. Telegram pairing (waits for channel connected, then CLI-first code) ──
        const { pairingCode, pairingError, alreadyPaired } = await runTelegramPairingFlow({
          cleanEnv,
          execAsync,
          profileDir: setupProfileDir,
          botUsername,
          log,
          skipIfAlreadyPaired: true,
        });

        // ── 9. Approve pairing code ──
        if (pairingCode && !alreadyPaired) {
          log(`Approving pairing code: ${pairingCode}…`);
          try {
            await execAsync(`openclaw pairing approve telegram ${pairingCode}`, {
              env: cleanEnv,
              timeout: 30_000,
              maxBuffer: 1024 * 1024,
            });
          } catch (approveErr: any) {
            log(`pairing approve error (non-fatal): ${approveErr?.message || approveErr}`);
          }
        }

        log(`Final: pairingCode="${pairingCode}" pairingError="${pairingError}" alreadyPaired=${alreadyPaired}`);

        // ── 10. Verify channels status ──
        let statusOutput = '';
        try {
          const { stdout } = await execAsync('openclaw channels status', {
            env: cleanEnv,
            timeout: 15_000,
            maxBuffer: 1024 * 1024,
          });
          statusOutput = stdout.trim();
          log(`channels status: ${statusOutput}`);
        } catch (e: any) {
          log(`channels status failed: ${e?.message || e}`);
        }

        return { success: true, alreadyInstalled, pairingCode, pairingError, status: statusOutput, configPath };
      } catch (error) {
        console.error('[OpenClaw Setup] error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  // ---------------------------------------------------------------------------
  // OpenClaw — retry Telegram pairing only (no reinstall, no config rewrite)
  // ---------------------------------------------------------------------------
  ipcMain.handle('openclaw:pair', async (_event, { profileName }: { profileName: string }) => {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    const homeDir = os.homedir();
    const profileDir = path.join(getGoogleProfilesDir(), profileName);

    const logs: string[] = [];
    const log = (msg: string) => {
      logs.push(msg);
      console.log('[openclaw:pair]', msg);
      const electronLog = require('electron-log');
      electronLog.info(`[openclaw:pair] ${msg}`);
    };

    const cleanEnv = makeCleanEnv(homeDir);

    // Inject Gemini API key from EGDesk's AI keys store
    try {
      const { getStore } = require('./storage');
      const store = getStore();
      const aiKeys = store ? store.get('ai-keys', []) : [];
      let googleKey: any = null;
      if (Array.isArray(aiKeys)) {
        googleKey =
          aiKeys.find((k: any) => (k?.name || '').toLowerCase() === 'egdesk' && k?.providerId === 'google') ||
          aiKeys.find((k: any) => k?.providerId === 'google' && k?.isActive) ||
          aiKeys.find((k: any) => k?.providerId === 'google');
      }
      if (googleKey?.fields?.apiKey) {
        cleanEnv.GEMINI_API_KEY = googleKey.fields.apiKey;
        cleanEnv.GOOGLE_API_KEY = googleKey.fields.apiKey;
        cleanEnv.GOOGLE_GENERATIVE_AI_API_KEY = googleKey.fields.apiKey;
      } else {
        log('❌ No Gemini API key found in EGDesk store.');
        return { success: false, error: 'No Gemini API key found. Please add a Google API key in Settings > AI Keys first.', logs };
      }
    } catch { /* non-fatal */ }

    // Read bot username from Electron Store
    const { getStore } = require('./storage');
    const store = getStore();
    const profiles = store.get('googleProfiles') || {};
    const savedProfile = profiles[profileName] || {};
    
    const botUsername: string = savedProfile.telegramBotUsername || deriveBotUsername(savedProfile.googleEmail ?? '');
    log(`Bot username: @${botUsername}`);

    try {
      // ── 0. Verify openclaw is on PATH & runnable ──
      let needsInstall = false;
      try {
        const { stdout: verOut } = await execAsync('openclaw --version', { env: cleanEnv, timeout: 8_000 });
        log(`openclaw version: ${verOut.trim()}`);
      } catch (e: any) {
        log(`openclaw check failed: ${e?.message || e} — will attempt reinstall`);
        needsInstall = true;
      }

      if (needsInstall) {
        log('openclaw not working — installing via npm…');
        await execAsync('npm install -g openclaw@latest', {
          env: cleanEnv,
          timeout: 120_000,
          maxBuffer: 10 * 1024 * 1024,
        });
        log('npm install complete');
      }

      // ── 1. Restore Telegram token + disable bonjour in config ──
      try {
        const configPath = path.join(homeDir, '.openclaw', 'openclaw.json');
        const token = savedProfile.telegramBotToken;

        if (token && fs.existsSync(configPath)) {
          const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          cfg.channels = cfg.channels ?? {};
          cfg.channels.telegram = cfg.channels.telegram ?? {};
          cfg.channels.telegram.enabled = true;
          cfg.channels.telegram.botToken = token;
          cfg.plugins = cfg.plugins ?? {};
          cfg.plugins.entries = cfg.plugins.entries ?? {};
          cfg.plugins.entries.bonjour = { enabled: false };
          fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
          log('✅ Restored Telegram bot token to config.');
        }
      } catch (e: any) {
        log(`Could not restore token (non-fatal): ${e?.message}`);
      }

      // ── 2. Single gateway: teardown service, spawn run --force ──
      await teardownManagedGateway(cleanEnv, log);
      const gatewaySpawn = await spawnSingleGateway(cleanEnv, log);
      if (!gatewaySpawn.ok) {
        log('⚠️ Gateway spawn may have failed — continuing to probe channel state.');
      }

      // ── 3. Pairing flow (connected gate + CLI code poll) ──
      const { pairingCode, pairingError, alreadyPaired } = await runTelegramPairingFlow({
        cleanEnv,
        execAsync,
        profileDir,
        botUsername,
        log,
        skipIfAlreadyPaired: true,
      });

      if (pairingCode && !alreadyPaired) {
        log(`Approving pairing code: ${pairingCode}…`);
        const approveResult = await execAsync(
          `openclaw pairing approve telegram ${pairingCode}`,
          { env: cleanEnv, timeout: 30_000, maxBuffer: 1024 * 1024 }
        ).catch((e: any) => ({
          stdout: (e.stdout || '') as string,
          stderr: (e.stderr || '') as string,
          failed: true,
        })) as { stdout: string; stderr: string; failed?: boolean };
        
        const approveOut = approveResult.stdout.trim();
        if (approveOut.toLowerCase().includes('approved')) {
          log(`✅ ${approveOut.slice(0, 200)}`);
        } else {
          log(`Approve output: ${approveOut || approveResult.stderr || 'unknown'}`);
        }
      } else if (!alreadyPaired && !pairingError) {
        log('⚠️ No pairing code found after polling.');
      }

      // ── 4. Final status ──
      let statusOutput = '';
      try {
        const { stdout } = await execAsync('openclaw channels status', {
          env: cleanEnv, timeout: 15_000, maxBuffer: 1024 * 1024,
        });
        statusOutput = stdout.trim();
        log(`Final status: ${statusOutput.slice(0, 300)}`);
      } catch (e: any) {
        log(`Status error: ${e?.message || e}`);
      }

      // If status shows "connected", the pairing succeeded (even if approve step errored)
      const alreadyConnected = statusOutput.includes('connected');
      if (alreadyConnected && !pairingCode) {
        log('✅ Telegram already connected — no pairing needed.');
      }

      return { success: true, pairingCode, pairingError: (alreadyPaired || alreadyConnected) ? '' : pairingError, status: statusOutput, logs };
    } catch (error) {
      log(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, error: error instanceof Error ? error.message : String(error), logs };
    }
  });

  // ---------------------------------------------------------------------------
  // OpenClaw — query gateway running status + channel connection
  // ---------------------------------------------------------------------------
  ipcMain.handle('openclaw:status', async () => {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    const homeDir = os.homedir();
    const cleanEnv = makeCleanEnv(homeDir);

    let connected = false;
    let statusOutput = '';
    let statusError = '';

    try {
      const { stdout, stderr } = await execAsync('openclaw channels status --json', {
        env: cleanEnv, timeout: 10_000, maxBuffer: 1024 * 1024,
      });
      statusOutput = (stdout || '').trim();
      const errOut = (stderr || '').trim();
      if (errOut) statusOutput += `\n[stderr] ${errOut}`;
      connected = parseTelegramConnectedFromStatusJson(stdout);
    } catch {
      try {
        const { stdout, stderr } = await execAsync('openclaw channels status', {
          env: cleanEnv, timeout: 10_000, maxBuffer: 1024 * 1024,
        });
        statusOutput = (stdout || '').trim();
        const errOut = (stderr || '').trim();
        if (errOut) statusOutput += `\n[stderr] ${errOut}`;
        connected = parseTelegramConnectedFromStatusText(stdout);
      } catch (e: any) {
        const rawErr = (e?.stderr || e?.stdout || e?.message || String(e)).trim();
        statusError = rawErr.slice(0, 500);
      }
    }

    const running = statusOutput.includes('Gateway reachable') || statusOutput.includes('running') || connected;

    return {
      gatewayRunning: running,
      telegramConnected: connected,
      running,   // keep legacy aliases
      connected,
      statusOutput: statusError ? `[CLI Error] ${statusError}\n${statusOutput}`.trim() : statusOutput,
    };
  });

  // ---------------------------------------------------------------------------
  // OpenClaw — start gateway
  // ---------------------------------------------------------------------------
  ipcMain.handle('openclaw:start', async () => {
    const { exec, spawn } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    const homeDir = os.homedir();
    const cleanEnv = makeCleanEnv(homeDir);

    try {
      const { getStore } = require('./storage');
      const store = getStore();
      const aiKeys = store ? store.get('ai-keys', []) : [];
      let googleKey: any = null;
      if (Array.isArray(aiKeys)) {
        googleKey =
          aiKeys.find((k: any) => (k?.name || '').toLowerCase() === 'egdesk' && k?.providerId === 'google') ||
          aiKeys.find((k: any) => k?.providerId === 'google' && k?.isActive) ||
          aiKeys.find((k: any) => k?.providerId === 'google');
      }
      if (googleKey?.fields?.apiKey) {
        cleanEnv.GEMINI_API_KEY = googleKey.fields.apiKey;
        cleanEnv.GOOGLE_API_KEY = googleKey.fields.apiKey;
        cleanEnv.GOOGLE_GENERATIVE_AI_API_KEY = googleKey.fields.apiKey;
      } else {
        return {
          success: false,
          error: 'No Gemini API key found. Please add a Google API key in Settings > AI Keys first.'
        };
      }
    } catch { /* non-fatal */ }

    try {
      // 1. Tear down managed gateway + spawn single foreground gateway
      await teardownManagedGateway(cleanEnv, (msg) => console.log('[openclaw:start]', msg));

      const configPath = path.join(homeDir, '.openclaw', 'openclaw.json');
      if (!fs.existsSync(configPath)) {
        return {
          success: false,
          error: `OpenClaw configuration not found at ${configPath}. Please run the setup flow first.`
        };
      }

      // 2. Verify openclaw is runnable
      try {
        await execAsync('openclaw --version', { env: cleanEnv, timeout: 5000 });
      } catch (e: any) {
        const errStr = (e?.stderr || e?.stdout || e?.message || String(e)).trim();
        return {
          success: false,
          error: `OpenClaw CLI is not working correctly. Try "Retry OpenClaw Setup" first.\n\nDetails: ${errStr.slice(0, 300)}`
        };
      }

      // 2b. Ensure Kakao plugin is installed (idempotent)
      try {
        const { app: electronApp } = require('electron');
        const devResourcesPath = path.join(__dirname, '..', '..', 'resources');
        const prodResourcesPath = process.resourcesPath
          || (electronApp ? path.join(electronApp.getAppPath(), '..', 'resources') : null);
        const resourcesBase = fs.existsSync(path.join(devResourcesPath, 'openclaw-kakao-plugin'))
          ? devResourcesPath
          : (prodResourcesPath || devResourcesPath);
        const pluginPath = path.join(resourcesBase, 'openclaw-kakao-plugin');
        if (fs.existsSync(pluginPath)) {
          await execAsync(`openclaw plugins install --force "${pluginPath}"`, {
            env: cleanEnv, timeout: 60_000, maxBuffer: 5 * 1024 * 1024,
          });
        }
      } catch { /* non-fatal */ }

      // 3. Spawn gateway run --force
      const spawnResult = await spawnSingleGateway(cleanEnv, (msg) => console.log('[openclaw:start]', msg));
      if (!spawnResult.ok) {
        return {
          success: false,
          error: `Gateway failed to start.\n\nOutput: ${spawnResult.output.join('').slice(0, 500) || '(none)'}`
        };
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  // ---------------------------------------------------------------------------
  // OpenClaw — stop gateway
  // ---------------------------------------------------------------------------
  ipcMain.handle('openclaw:stop', async () => {
    await killGateway();
    return { success: true };
  });

  // ---------------------------------------------------------------------------
  // OpenClaw — deep reset (clear store + config file)
  // ---------------------------------------------------------------------------
  ipcMain.handle('openclaw:reset', async (_event, { profileName }: { profileName: string }) => {
    try {
      // 1. Clear profile from Electron Store
      const { getStore } = require('./storage');
      const store = getStore();
      const profiles = store.get('googleProfiles') || {};
      delete profiles[profileName];
      store.set('googleProfiles', profiles);

      // 2. Wipe openclaw.json
      const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
      if (fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify({
          gateway: { mode: 'local' },
          channels: {}
        }, null, 2));
      }

      // 3. Kill gateway
      await killGateway().catch(() => {});

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  // ---------------------------------------------------------------------------
  // Individual OpenClaw Setup Steps (for debugging)
  // ---------------------------------------------------------------------------

  ipcMain.handle('openclaw:install-cli', async () => {
    const cleanEnv = makeCleanEnv(os.homedir());
    const logs: string[] = [];
    const log = (msg: string) => {
      logs.push(msg);
      console.log('[openclaw:install-cli]', msg);
      const electronLog = require('electron-log');
      electronLog.info(`[openclaw:install-cli] ${msg}`);
    };
    try {
      await ensureCliInstalled(cleanEnv, log);
      return { success: true, logs };
    } catch (e: any) {
      return { success: false, error: e.message, logs };
    }
  });

  ipcMain.handle('openclaw:onboard-gemini', async () => {
    const cleanEnv = makeCleanEnv(os.homedir());
    const logs: string[] = [];
    const log = (msg: string) => {
      logs.push(msg);
      console.log('[openclaw:onboard-gemini]', msg);
      const electronLog = require('electron-log');
      electronLog.info(`[openclaw:onboard-gemini] ${msg}`);
    };
    
    // Inject Gemini API key
    try {
      const { getStore } = require('./storage');
      const store = getStore();
      const aiKeys = store ? store.get('ai-keys', []) : [];
      const googleKey = aiKeys.find((k: any) => k?.providerId === 'google' && k?.isActive) || aiKeys.find((k: any) => k?.providerId === 'google');
      if (googleKey?.fields?.apiKey) {
        cleanEnv.GEMINI_API_KEY = googleKey.fields.apiKey;
      } else {
        return { success: false, error: 'No Gemini API key found.', logs };
      }
    } catch { /* ... */ }

    try {
      const ok = await runOnboardGemini(cleanEnv, log);
      return { success: ok, logs };
    } catch (e: any) {
      return { success: false, error: e.message, logs };
    }
  });

  ipcMain.handle('openclaw:doctor-fix', async () => {
    const cleanEnv = makeCleanEnv(os.homedir());
    const logs: string[] = [];
    const log = (msg: string) => {
      logs.push(msg);
      console.log('[openclaw:doctor-fix]', msg);
      const electronLog = require('electron-log');
      electronLog.info(`[openclaw:doctor-fix] ${msg}`);
    };
    try {
      const ok = await runDoctorFix(cleanEnv, log);
      return { success: ok, logs };
    } catch (e: any) {
      return { success: false, error: e.message, logs };
    }
  });

  ipcMain.handle('openclaw:install-kakao-plugin', async () => {
    const cleanEnv = makeCleanEnv(os.homedir());
    const logs: string[] = [];
    const log = (msg: string) => {
      logs.push(msg);
      console.log('[openclaw:install-kakao-plugin]', msg);
      const electronLog = require('electron-log');
      electronLog.info(`[openclaw:install-kakao-plugin] ${msg}`);
    };
    try {
      const ok = await installKakaoPlugin(cleanEnv, log);
      return { success: ok, logs };
    } catch (e: any) {
      return { success: false, error: e.message, logs };
    }
  });

  ipcMain.handle('openclaw:golden-merge', async (_event, { profileName, botToken }: { profileName: string; botToken?: string }) => {
    const homeDir = os.homedir();
    const configDir = path.join(homeDir, '.openclaw');
    const configPath = path.join(configDir, 'openclaw.json');
    const logs: string[] = [];
    const log = (msg: string) => {
      logs.push(msg);
      console.log('[openclaw:golden-merge]', msg);
      const electronLog = require('electron-log');
      electronLog.info(`[openclaw:golden-merge] ${msg}`);
    };

    const { getStore } = require('./storage');
    const store = getStore();
    const profiles = store.get('googleProfiles') || {};
    const savedProfile = profiles[profileName] || {};
    const resolvedToken = botToken?.trim() || savedProfile.telegramBotToken || '';

    try {
      const ok = await runGoldenMerge(configDir, configPath, resolvedToken, log);
      return { success: ok, logs };
    } catch (e: any) {
      return { success: false, error: e.message, logs };
    }
  });

  ipcMain.handle('openclaw:install-daemon', async () => {
    const cleanEnv = makeCleanEnv(os.homedir());
    const logs: string[] = [];
    const log = (msg: string) => {
      logs.push(msg);
      console.log('[openclaw:install-daemon]', msg);
      const electronLog = require('electron-log');
      electronLog.info(`[openclaw:install-daemon] ${msg}`);
    };
    try {
      const ok = await installDaemon(cleanEnv, log);
      return { success: ok, logs };
    } catch (e: any) {
      return { success: false, error: e.message, logs };
    }
  });

  ipcMain.handle('openclaw:install-gateway', async () => {
    const cleanEnv = makeCleanEnv(os.homedir());
    const logs: string[] = [];
    const log = (msg: string) => {
      logs.push(msg);
      console.log('[openclaw:install-gateway]', msg);
      const electronLog = require('electron-log');
      electronLog.info(`[openclaw:install-gateway] ${msg}`);
    };
    try {
      const ok = await installGateway(cleanEnv, log);
      return { success: ok, logs };
    } catch (e: any) {
      return { success: false, error: e.message, logs };
    }
  });
}

/**
 * Silently re-install the Kakao plugin on every app launch so the daemon
 * (which bypasses openclaw:start) always runs the latest bundled version.
 * Errors are non-fatal — logged but never surface to the user.
 */
export async function silentlyUpdateKakaoPlugin(): Promise<void> {
  try {
    const cleanEnv = makeCleanEnv(os.homedir());
    const log = (msg: string) => {
      const electronLog = require('electron-log');
      electronLog.info(`[openclaw:auto-update-plugin] ${msg}`);
    };
    await installKakaoPlugin(cleanEnv, log);
  } catch (e: any) {
    const electronLog = require('electron-log');
    electronLog.warn(`[openclaw:auto-update-plugin] non-fatal error: ${e?.message}`);
  }
}
