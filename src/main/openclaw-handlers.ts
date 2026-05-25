/**
 * IPC handlers for OpenClaw CLI install, config, gateway, and Telegram pairing.
 */
import { ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';

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
          enabled: true,
          botToken: resolvedToken,
          ...(currentCfg.channels?.telegram ?? {}),
          botToken: resolvedToken, // ensure our token wins
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

        // ── 5. THE GOLDEN MERGE: One final write to rule them all ──
        await runGoldenMerge(configDir, configPath, resolvedToken, log);

        // ── 6. Install daemon ──
        await installDaemon(cleanEnv, log);

        // ── 6a. Install gateway binary ──
        await installGateway(cleanEnv, log);

        // ── 6b. RE-APPLY GOLDEN MERGE after daemon install ──
        // Some onboard commands rewrite the config and strip custom keys.
        try {
          const currentCfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          const lastGood = JSON.parse(fs.readFileSync(path.join(configDir, 'openclaw.json.last-good'), 'utf-8'));
          const merged = { ...currentCfg, ...lastGood };
          fs.writeFileSync(configPath, JSON.stringify(merged, null, 2));
          log('✅ openclaw.json re-finalized after daemon install.');
        } catch {}

        // ── 7. Start Gateway ──
        const { spawn } = await import('child_process');
        log('Killing any existing gateway…');
        await killGateway().catch(() => {});
        await new Promise(r => setTimeout(r, 1500));

        // ── 7b. Disable bonjour plugin (causes CIAO PROBING CANCELLED crash) ──
        try {
          if (fs.existsSync(configPath)) {
            const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            cfg.plugins = cfg.plugins ?? {};
            cfg.plugins.entries = cfg.plugins.entries ?? {};
            cfg.plugins.entries.bonjour = { enabled: false };
            fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
            log('Disabled bonjour plugin to prevent mDNS crash.');
          }
        } catch (e: any) {
          log(`Could not patch bonjour config (non-fatal): ${e?.message}`);
        }

        log('Spawning: openclaw gateway');
        try {
          const gatewayProc = spawn('openclaw', ['gateway'], IS_WIN
            ? { env: cleanEnv, detached: false, stdio: ['ignore', 'pipe', 'pipe'] as const, shell: true }
            : { env: cleanEnv, detached: true,  stdio: ['ignore', 'pipe', 'pipe'] as const });

          const gatewayOutput: string[] = [];
          
          // Pipe gateway output to our log and UI
          gatewayProc.stdout?.on('data', (d: Buffer) => {
            const msg = d.toString();
            gatewayOutput.push(msg);
            // Only log meaningful lines to avoid flooding
            if (msg.includes('[') || msg.includes('Error')) {
              log(`[gateway:stdout] ${msg.trim()}`);
            }
          });
          gatewayProc.stderr?.on('data', (d: Buffer) => {
            const msg = d.toString();
            gatewayOutput.push(msg);
            log(`[gateway:stderr] ${msg.trim()}`);
          });

          // Poll until gateway reports reachable (up to 45s) instead of a fixed sleep
          let gatewayReachable = false;
          for (let i = 0; i < 15; i++) {
            try {
              const { stdout: probe } = await execAsync('openclaw channels status', {
                env: cleanEnv, timeout: 8_000, maxBuffer: 1024 * 1024,
              });
              const probeOut = probe.trim();
              log(`Gateway probe ${i + 1}/15: ${probeOut.slice(0, 120)}`);
              if (probeOut.includes('Gateway reachable') || probeOut.includes('running')) {
                gatewayReachable = true;
                break;
              }
            } catch { /* not ready yet */ }
            if (i < 14) await new Promise(r => setTimeout(r, 3000));
          }

          // Detach stdout/stderr before unreffing
          // gatewayProc.stdout?.destroy();
          // gatewayProc.stderr?.destroy();
          gatewayProc.unref();

          if (!gatewayReachable) {
            log(`⚠️ Gateway did not become reachable within 45s. Output: ${gatewayOutput.join('').slice(-1000) || '(none)'}`);
          } else {
            log('Gateway is reachable — proceeding to Telegram pairing.');
          }
        } catch (e: any) {
          log(`Gateway spawn failed: ${e?.message}`);
        }

        // ── 8. Telegram Pairing Automation ──
        let pairingCode = '';
        let pairingError = '';

        // Helper to poll the CLI for a pairing code in the background
        const pollCliForCode = async (maxAttempts = 20) => {
          for (let i = 0; i < maxAttempts; i++) {
            if (pairingCode) return; // Stop if browser already found it
            try {
              const rawOut: string = await new Promise(resolve => {
                const { exec } = require('child_process');
                exec('openclaw pairing list telegram', { env: cleanEnv, timeout: 10_000, maxBuffer: 1024 * 1024 },
                  (_err: any, stdout: string) => resolve(stdout || '')
                );
              });
              const match = rawOut.match(/openclaw\s+pairing\s+approve\s+telegram\s+([A-Z0-9]{8})/) ||
                            rawOut.match(/\b([A-Z0-9]{8})\b/);
              if (match) {
                pairingCode = match[1];
                log(`Pairing code found via CLI: ${pairingCode}`);
                return;
              }
            } catch { /* ignore CLI errors during polling */ }
            if (i < maxAttempts - 1) await new Promise(r => setTimeout(r, 3000));
          }
        };

        try {
          // 1. Check for existing code first (fast check)
          const existingCode: string = await new Promise(resolve => {
            const { exec } = require('child_process');
            exec('openclaw pairing list telegram', { env: cleanEnv, timeout: 10_000, maxBuffer: 1024 * 1024 },
              (_err: any, stdout: string) => resolve(stdout || '')
            );
          });
          const existingMatch = existingCode.match(/openclaw\s+pairing\s+approve\s+telegram\s+([A-Z0-9]{8})/) ||
                                existingCode.match(/\b([A-Z0-9]{8})\b/);
          if (existingMatch) {
            pairingCode = existingMatch[1];
            log(`Existing pending pairing code found: ${pairingCode}`);
          }

          if (!pairingCode) {
            log('No existing code — starting parallel browser and CLI polling…');
            
            // Start CLI poller in background
            const cliPoller = pollCliForCode();

            // Start Browser flow to trigger the code
            try {
              const { chromium: chromiumExtra } = await import('playwright-extra');
              const StealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default;
              chromiumExtra.use(StealthPlugin());

              const context = await chromiumExtra.launchPersistentContext(setupProfileDir, {
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
                const msgCountBefore = await page.locator('.message').count().catch(() => 0);
                
                await page.locator('.input-message-input').first().click({ force: true });
                await page.keyboard.type('/start');
                await page.keyboard.press('Enter');
                log('/start sent — polling browser chat for code…');

                // Poll browser chat for 30s (CLI poller is also running in background)
                for (let i = 0; i < 15 && !pairingCode; i++) {
                  await page.waitForTimeout(2000);
                  const texts = await page.locator('.message').allTextContents();
                  const newContent = texts.slice(msgCountBefore).join('\n');
                  const codeRe = /openclaw\s+pairing\s+approve\s+telegram\s+([A-Z0-9]{8})/;
                  const match = newContent.match(codeRe);
                  if (match) {
                    pairingCode = match[1];
                    log(`Pairing code found in browser chat: ${pairingCode}`);
                    break;
                  }
                }
              } finally {
                await context.close().catch(() => {});
              }
            } catch (browserErr: any) {
              log(`Browser flow encountered an error (will rely on CLI): ${browserErr.message}`);
            }

            // Ensure CLI poller finishes or finds the code if browser didn't
            await cliPoller;
          }
        } catch (outerErr: any) {
          pairingError = outerErr.message;
          log(`Pairing automation error: ${pairingError}`);
        }

        // ── 9. Final Approval ──
        if (pairingCode) {
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
        } else if (!pairingError) {
          pairingError = 'No pending pairing request found after /start.';
        }

        log(`Final: pairingCode="${pairingCode}" pairingError="${pairingError}"`);

        // ── 8. Verify channels status ──
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
    const { exec, spawn } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    const homeDir = os.homedir();
    const profileDir = path.join(getGoogleProfilesDir(), profileName);

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

    const logs: string[] = [];
    const log = (msg: string) => {
      logs.push(msg);
      console.log('[openclaw:pair]', msg);
      const electronLog = require('electron-log');
      electronLog.info(`[openclaw:pair] ${msg}`);
    };

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

      // ── 1. Run openclaw onboard to configure Gemini as the provider ──
      const geminiKey = cleanEnv.GEMINI_API_KEY;

      if (geminiKey) {
        try {
          const { stdout: onboardOut, stderr: onboardErr } = await execAsync(
            `openclaw onboard --non-interactive --accept-risk --mode local --auth-choice gemini-api-key --gemini-api-key "${geminiKey}"`,
            { env: cleanEnv, timeout: 30_000, maxBuffer: 1024 * 1024 }
          );
          log(`Onboard: ${(onboardOut || onboardErr || 'done').trim().slice(0, 300)}`);
        } catch (e: any) {
          const out = (e.stdout || e.stderr || '').trim();
          // openclaw exits non-zero even on success — check output for success indicators
          const succeeded = out.includes('openclaw.json') || out.includes('Telegram: ok');
          log(succeeded ? `Onboard: ${out.slice(0, 300)}` : `Onboard failed: ${(e.message || out).slice(0, 300)}`);
        }
      } else {
        log('⚠️ No Gemini API key found in EGDesk store — skipping onboard');
      }

      // ── 1a. RE-APPLY TELEGRAM TOKEN from store ──
      // onboard might have wiped the config. Restore the token from Electron Store.
      try {
        const configPath = path.join(homeDir, '.openclaw', 'openclaw.json');
        const profiles = store.get('googleProfiles') || {};
        const savedProfile = profiles[profileName] || {};
        const token = savedProfile.telegramBotToken;

        if (token && fs.existsSync(configPath)) {
          const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          cfg.channels = cfg.channels ?? {};
          cfg.channels.telegram = cfg.channels.telegram ?? {};
          cfg.channels.telegram.enabled = true;
          cfg.channels.telegram.botToken = token;
          fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
          log('✅ Restored Telegram bot token to config.');
        }
      } catch (e: any) {
        log(`Could not restore token (non-fatal): ${e?.message}`);
      }

      // ── 1b. Disable bonjour plugin (causes CIAO PROBING CANCELLED crash) ──
      try {
        const configPath = path.join(homeDir, '.openclaw', 'openclaw.json');
        if (fs.existsSync(configPath)) {
          const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          cfg.plugins = cfg.plugins ?? {};
          cfg.plugins.entries = cfg.plugins.entries ?? {};
          cfg.plugins.entries.bonjour = { enabled: false };
          fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
          log('Disabled bonjour plugin to prevent mDNS crash.');
        }
      } catch (e: any) {
        log(`Could not patch bonjour config (non-fatal): ${e?.message}`);
      }

      // ── 1c. Kill any existing gateway, then restart with correct env (including GEMINI_API_KEY) ──
      try {
        await killGateway();
        log('Killed existing gateway process.');
      } catch { /* no existing gateway — that's fine */ }

      {
        log('Spawning fresh gateway with Gemini API key…');
        let gatewayStartError = '';
        const gatewayProc = spawn('openclaw', ['gateway'], IS_WIN
          ? { env: cleanEnv, detached: false, stdio: ['ignore', 'pipe', 'pipe'] as const, shell: true }
          : { env: cleanEnv, detached: true,  stdio: ['ignore', 'pipe', 'pipe'] as const });

        const gatewayOutput: string[] = [];
        gatewayProc.stdout?.on('data', (d: Buffer) => gatewayOutput.push(d.toString()));
        gatewayProc.stderr?.on('data', (d: Buffer) => gatewayOutput.push(d.toString()));
        gatewayProc.on('error', (err) => { gatewayStartError = err.message; });
        gatewayProc.on('exit', (code) => {
          if (code !== null) gatewayOutput.push(`[exited with code ${code}]`);
        });

        // Poll until gateway reports reachable (up to 45s) instead of a fixed sleep
        let gatewayReachable = false;
        for (let i = 0; i < 15; i++) {
          if (gatewayStartError) break; // spawn itself failed — no point waiting
          try {
            const { stdout: probe } = await execAsync('openclaw channels status', {
              env: cleanEnv, timeout: 8_000, maxBuffer: 1024 * 1024,
            });
            const probeOut = probe.trim();
            log(`Gateway probe ${i + 1}/15: ${probeOut.slice(0, 120)}`);
            if (probeOut.includes('Gateway reachable') || probeOut.includes('running')) {
              gatewayReachable = true;
              break;
            }
          } catch { /* not ready yet */ }
          if (i < 14) await new Promise(r => setTimeout(r, 3000));
        }

        // Detach stdout/stderr before unreffing — otherwise the main process keeps reading
        // every byte the gateway prints indefinitely and burns CPU.
        gatewayProc.stdout?.destroy();
        gatewayProc.stderr?.destroy();
        gatewayProc.unref();

        if (gatewayStartError) {
          log(`⚠️ Gateway spawn error: ${gatewayStartError}`);
        } else if (gatewayOutput.some(o => o.includes('exited with code'))) {
          log(`⚠️ Gateway crashed: ${gatewayOutput.join(' ').trim()}`);
        } else if (!gatewayReachable) {
          const out = gatewayOutput.join('').trim();
          log(`⚠️ Gateway did not become reachable within 45s. Output: ${out.slice(0, 300) || '(none)'}`);
        } else {
          log('Gateway is reachable — proceeding to Telegram pairing.');
        }
      }

      // ── 2. Open Telegram Web → send /start (skip if already connected) ──
      // Check connection first — if gateway is already paired there's nothing to do
      let alreadyConnectedEarly = false;
      try {
        const { stdout: preCheck } = await execAsync('openclaw channels status', {
          env: cleanEnv, timeout: 10_000, maxBuffer: 1024 * 1024,
        });
        // Only skip if connected AND not reporting an unauthorized error
        if (preCheck.includes('connected') && !preCheck.includes('Unauthorized')) {
          log('✅ Telegram already connected — skipping browser /start flow.');
          alreadyConnectedEarly = true;
        }
      } catch { /* non-fatal */ }

      let pairingCode = '';
      let pairingError = '';

      // Helper to poll the CLI for a pairing code in the background
      const pollCliForCode = async (maxAttempts = 20) => {
        for (let i = 0; i < maxAttempts; i++) {
          if (pairingCode) return; // Stop if browser already found it
          try {
            const pairResult = await execAsync('openclaw pairing list telegram', {
              env: cleanEnv, timeout: 10_000, maxBuffer: 1024 * 1024,
            }).catch((e: any) => ({
              stdout: e.stdout || '',
              stderr: e.stderr || e.message || '',
            }));
            const raw = (pairResult.stdout || '').trim();
            const match = raw.match(/openclaw\s+pairing\s+approve\s+telegram\s+([A-Z0-9]{8})/) ||
                          raw.match(/\b([A-Z0-9]{8})\b/);
            if (match) {
              pairingCode = match[1];
              log(`Pairing code found via CLI: ${pairingCode}`);
              return;
            }
          } catch { /* ignore CLI errors during polling */ }
          if (i < maxAttempts - 1) await new Promise(r => setTimeout(r, 3000));
        }
      };

      if (!alreadyConnectedEarly) {
        if (!fs.existsSync(profileDir)) {
          pairingError = `Profile dir not found: ${profileDir}`;
          log(`⚠️ ${pairingError}`);
        } else {
          log('Starting parallel browser and CLI polling…');
          
          // Start CLI poller in background
          const cliPoller = pollCliForCode();

          // Start Browser flow to trigger the code
          try {
            const { chromium: chromiumExtra } = await import('playwright-extra');
            const StealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default;
            chromiumExtra.use(StealthPlugin());

            const context = await chromiumExtra.launchPersistentContext(profileDir, {
              headless: false,
              channel: 'chrome',
              viewport: null,
              args: ['--window-size=907,867', '--no-default-browser-check', '--disable-blink-features=AutomationControlled', '--no-first-run'],
              ignoreDefaultArgs: ['--enable-automation'],
            });
            
            try {
              const pages = context.pages();
              const page = pages.length > 0 ? pages[0] : await context.newPage();
              const tgUrl = `https://web.telegram.org/k/#@${botUsername}`;
              
              log(`Navigating to ${tgUrl}`);
              await page.goto(tgUrl, { waitUntil: 'load', timeout: 30_000 });
              
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
              const msgCountBefore = await page.locator('.message').count().catch(() => 0);
              
              await page.locator('.input-message-input').first().click({ force: true });
              await page.keyboard.type('/start');
              await page.keyboard.press('Enter');
              log('/start sent — polling browser chat for code…');

              for (let i = 0; i < 15 && !pairingCode; i++) {
                await page.waitForTimeout(2000);
                const texts = await page.locator('.message').allTextContents();
                const newContent = texts.slice(msgCountBefore).join('\n');
                const codeRe = /openclaw\s+pairing\s+approve\s+telegram\s+([A-Z0-9]{8})/;
                const match = newContent.match(codeRe);
                if (match) {
                  pairingCode = match[1];
                  log(`Pairing code found in browser chat: ${pairingCode}`);
                  break;
                }
              }
            } finally {
              await context.close().catch(() => {});
            }
          } catch (browserErr: any) {
            log(`Browser flow encountered an error (will rely on CLI): ${browserErr.message}`);
          }

          // Ensure CLI poller finishes or finds the code if browser didn't
          await cliPoller;
        }
      }

      // ── 3. Approve the pairing code ──
      if (pairingCode) {
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
      } else if (!alreadyConnectedEarly && !pairingError) {
        pairingError = 'No pairing code found after polling.';
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

      return { success: true, pairingCode, pairingError: alreadyConnected ? '' : pairingError, status: statusOutput, logs };
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
      const { stdout, stderr } = await execAsync('openclaw channels status', {
        env: cleanEnv, timeout: 10_000, maxBuffer: 1024 * 1024,
      });
      statusOutput = (stdout || '').trim();
      const errOut = (stderr || '').trim();
      if (errOut) statusOutput += `\n[stderr] ${errOut}`;
      
      connected = statusOutput.includes('connected');
    } catch (e: any) {
      // Surface the real error so the UI can show "command not found" or Node errors
      const rawErr = (e?.stderr || e?.stdout || e?.message || String(e)).trim();
      statusError = rawErr.slice(0, 500);
    }

    // Derive running from status output — if the gateway is reachable it's running
    const running = statusOutput.includes('Gateway reachable') || statusOutput.includes('running');

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
      // 1. Kill any existing gateway first
      await killGateway().catch(() => {});
      await new Promise(r => setTimeout(r, 1000));

      // 1b. Check if config exists
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

      // 2b. Ensure Kakao plugin is installed (idempotent — openclaw skips if already present)
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
      } catch { /* non-fatal — plugin may already be installed */ }

      // 2c. Ensure gateway binary is installed
      try {
        await installGateway(cleanEnv, (msg) => console.log('[openclaw:start]', msg));
      } catch { /* non-fatal */ }

      // 3. Spawn and capture initial output for debugging
      const spawnOpts = IS_WIN
        ? { env: cleanEnv, detached: false, stdio: ['ignore', 'pipe', 'pipe'] as const, shell: true }
        : { env: cleanEnv, detached: true,  stdio: ['ignore', 'pipe', 'pipe'] as const };

      const proc = spawn('openclaw', ['gateway'], spawnOpts);
      
      let output = '';
      proc.stdout?.on('data', (d) => { output += d.toString(); });
      proc.stderr?.on('data', (d) => { output += d.toString(); });

      // Wait a few seconds to see if it crashes immediately
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          // Detach stdout/stderr before unreffing — otherwise Electron keeps reading every
          // byte the gateway prints, accumulating it in `output` indefinitely and burning CPU.
          proc.stdout?.destroy();
          proc.stderr?.destroy();
          proc.unref();
          resolve({ success: true });
        }, 4000);

        proc.on('error', (err) => {
          clearTimeout(timeout);
          resolve({ success: false, error: `Spawn error: ${err.message}\n\nOutput: ${output}` });
        });

        proc.on('exit', (code) => {
          clearTimeout(timeout);
          resolve({
            success: false,
            error: `Gateway exited immediately with code ${code}.\n\nOutput: ${output.slice(0, 500)}`
          });
        });
      });
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
