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

      // Read profile.json to get saved token + bot username (fallback if caller didn't pass them)
      const profileDir = path.join(getGoogleProfilesDir(), profileName);
      const metaPath = path.join(profileDir, 'profile.json');
      const savedProfile = fs.existsSync(metaPath)
        ? JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
        : {};

      const resolvedToken = botToken?.trim() || savedProfile.telegramBotToken || '';
      const botUsername: string = savedProfile.telegramBotUsername || deriveBotUsername(savedProfile.googleEmail ?? '');

      if (!resolvedToken) {
        return { success: false, error: 'No bot token found — run Telegram setup first.' };
      }

      const log = (msg: string) => console.log(`[openclaw:setup] ${msg}`);

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
        // Use `openclaw --version` to detect both missing and corrupted installs.
        let alreadyInstalled = false;
        try {
          const { stdout: verOut } = await execAsync('openclaw --version', { env: cleanEnv, timeout: 8_000 });
          log(`openclaw already installed: ${verOut.trim()}`);
          alreadyInstalled = true;
        } catch (verErr: any) {
          log(`openclaw check failed (${(verErr?.message || '').split('\n')[0].slice(0, 120)}) — reinstalling…`);
        }

        if (!alreadyInstalled) {
          // Uninstall first to clear any corrupted state, then reinstall clean.
          log('Running: npm uninstall -g openclaw');
          try {
            await execAsync('npm uninstall -g openclaw', {
              env: cleanEnv,
              timeout: 30_000,
              maxBuffer: 5 * 1024 * 1024,
            });
            log('npm uninstall complete');
          } catch (unErr: any) {
            log(`npm uninstall (non-fatal): ${(unErr?.message || '').slice(0, 100)}`);
          }
          log('Running: npm install -g openclaw@latest');
          await execAsync('npm install -g openclaw@latest', {
            env: cleanEnv,
            timeout: 120_000,
            maxBuffer: 10 * 1024 * 1024,
          });
          log('npm install complete');
        }

        // ── 2. Write ~/.openclaw/openclaw.json with bot token ──
        if (!fs.existsSync(configDir)) {
          fs.mkdirSync(configDir, { recursive: true });
        }

        const existing = fs.existsSync(configPath)
          ? JSON.parse(fs.readFileSync(configPath, 'utf-8'))
          : {};

        // Read the tunnel API key from store so OpenClaw can authenticate against protected routes
        let egdeskApiKey = '';
        try {
          const { getStore } = require('./storage');
          const mcpConfig = (getStore()?.get('mcpConfiguration') as any) ?? {};
          egdeskApiKey = mcpConfig?.tunnel?.apiKey ?? '';
        } catch { /* non-fatal */ }

        // Write .env file so openclaw can reference the key via ${EGDESK_API_KEY}
        if (egdeskApiKey) {
          const envPath = path.join(configDir, '.env');
          const envLines = fs.existsSync(envPath)
            ? fs.readFileSync(envPath, 'utf-8').split('\n').filter(l => !l.startsWith('EGDESK_API_KEY='))
            : [];
          envLines.push(`EGDESK_API_KEY=${egdeskApiKey}`);
          fs.writeFileSync(envPath, envLines.join('\n') + '\n');
          log(`🔑 Wrote EGDESK_API_KEY to ${envPath}`);
        }

        // ── 2a. Write base config — only schema-safe keys first ──
        // doctor --fix strips unknown keys, so we write only telegram+gateway here,
        // then add kakao/plugins/mcp AFTER doctor so they survive.
        const updated: any = {
          ...existing,
          gateway: {
            ...(existing.gateway ?? {}),
            mode: (existing.gateway?.mode) || 'local',
          },
          channels: {
            ...(existing.channels ?? {}),
            telegram: {
              ...(existing.channels?.telegram ?? {}),
              botToken: resolvedToken,
            },
          },
        };
        // Strip keys that openclaw's strict schema rejects
        delete updated.models;
        delete updated.mcp;
        delete updated.mcpServers;
        delete updated.plugins; // not a valid schema key — Kakao is registered as a plugin via CLI

        fs.writeFileSync(configPath, JSON.stringify(updated, null, 2));
        log(`Base config written to ${configPath} — telegram.botToken: ${resolvedToken ? '(set)' : '(missing)'}`);
        const lastGoodPath = path.join(configDir, 'openclaw.json.last-good');

        // Run doctor --fix to strip any remaining unrecognized keys from previous runs
        try {
          const { stdout: doctorOut, stderr: doctorErr } = await execAsync('openclaw doctor --fix', { env: cleanEnv, timeout: 15_000, maxBuffer: 1024 * 1024 });
          log(`openclaw doctor --fix: ${(doctorOut || doctorErr || 'ok').trim().slice(0, 200)}`);
        } catch (e: any) {
          log(`openclaw doctor --fix (non-fatal): ${(e?.stdout || e?.stderr || e?.message || '').trim().slice(0, 200)}`);
        }

        // ── 2b. Update last-good with the doctor-validated config ──
        // The correct key is mcp.servers (not mcpServers). Write it AFTER doctor so it survives.
        try {
          const freshCfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          // Strip the wrong key from any previous setup attempts
          delete freshCfg.mcpServers;
          // Register the EGDesk local MCP server under the correct openclaw schema path
          freshCfg.mcp = freshCfg.mcp ?? {};
          freshCfg.mcp.servers = freshCfg.mcp.servers ?? {};
          freshCfg.mcp.servers.egdesk = { type: 'http', url: 'http://localhost:8080' };
          fs.writeFileSync(configPath, JSON.stringify(freshCfg, null, 2));
          fs.writeFileSync(lastGoodPath, JSON.stringify(freshCfg, null, 2));
          log('Config finalized with mcp.servers.egdesk → http://localhost:8080');
        } catch (e: any) {
          log(`Config finalize (non-fatal): ${(e?.message || '').trim().slice(0, 200)}`);
        }

        // ── 3. Install Kakao plugin via openclaw plugins install ──
        // Kakao is a plugin, not a channel config key. Install the bundled plugin package.
        try {
          const { app: electronApp } = require('electron');
          // In production: resources/ is next to the app bundle (process.resourcesPath)
          // In development: __dirname is dist/main/, so go up 3 levels to project root + resources/
          const devResourcesPath = path.join(__dirname, '..', '..', 'resources');
          const prodResourcesPath = process.resourcesPath
            || (electronApp ? path.join(electronApp.getAppPath(), '..', 'resources') : null);
          // Prefer dev path if it contains the plugin (avoids pointing at electron's own resources dir)
          const resourcesBase = fs.existsSync(path.join(devResourcesPath, 'openclaw-kakao-plugin'))
            ? devResourcesPath
            : (prodResourcesPath || devResourcesPath);
          const pluginPath = path.join(resourcesBase, 'openclaw-kakao-plugin');

          if (fs.existsSync(pluginPath)) {
            log(`Installing Kakao plugin from ${pluginPath}…`);
            const { stdout: pOut, stderr: pErr } = await execAsync(
              `openclaw plugins install "${pluginPath}"`,
              { env: cleanEnv, timeout: 60_000, maxBuffer: 5 * 1024 * 1024 }
            );
            log(`Kakao plugin install: ${(pOut || pErr || 'ok').trim().slice(0, 200)}`);
          } else {
            log(`Kakao plugin not found at ${pluginPath} — skipping install`);
          }
        } catch (e: any) {
          log(`Kakao plugin install (non-fatal): ${(e?.message || '').trim().slice(0, 200)}`);
        }

        // ── 3b. Configure Gemini as the AI provider, then install daemon ──
        const geminiKeyForOnboard = cleanEnv.GEMINI_API_KEY;
        if (geminiKeyForOnboard) {
          log('Running: openclaw onboard --non-interactive (Gemini)');
          try {
            const { stdout: onboardOut, stderr: onboardErr } = await execAsync(
              `openclaw onboard --non-interactive --accept-risk --mode local --auth-choice gemini-api-key --gemini-api-key "${geminiKeyForOnboard}"`,
              { env: cleanEnv, timeout: 30_000, maxBuffer: 1024 * 1024 }
            );
            log(`onboard: ${(onboardOut || onboardErr || 'done').trim().slice(0, 300)}`);
          } catch (e: any) {
            const out = (e.stdout || e.stderr || '').trim();
            const succeeded = out.includes('openclaw.json') || out.includes('Telegram: ok');
            log(succeeded ? `onboard: ${out.slice(0, 300)}` : `onboard failed (non-fatal): ${(e.message || out).slice(0, 300)}`);
          }
        } else {
          log('⚠️ No Gemini API key — skipping onboard');
        }

        log('Running: openclaw onboard --install-daemon');
        try {
          const { stdout: onboardOut, stderr: onboardErr } = await execAsync('openclaw onboard --install-daemon', {
            env: cleanEnv,
            timeout: 60_000,
            maxBuffer: 5 * 1024 * 1024,
          });
          log(`onboard stdout: ${onboardOut.trim() || '(empty)'}`);
          if (onboardErr?.trim()) log(`onboard stderr: ${onboardErr.trim()}`);
        } catch (e: any) {
          log(`onboard failed (non-fatal): ${e?.message || e}`);
        }

        // ── 4. Kill any existing gateway, then start a fresh one so it picks up the new config ──
        const { spawn } = await import('child_process');
        log('Killing any existing gateway…');
        await killGateway().catch(() => {});
        await new Promise(r => setTimeout(r, 1500)); // let the port/lock release

        log('Spawning: openclaw gateway');
        try {
          const gatewayProc = spawn('openclaw', ['gateway'], IS_WIN
            ? { env: cleanEnv, detached: false, stdio: 'ignore' as const, shell: true }
            : { env: cleanEnv, detached: true,  stdio: 'ignore' as const });
          gatewayProc.unref();
          log('Gateway spawned — waiting 8s for it to connect to Telegram…');
          await new Promise(r => setTimeout(r, 8000));
          log('Gateway wait complete');
        } catch (e: any) {
          log(`Gateway spawn failed (non-fatal): ${e?.message || e}`);
        }

        // ── 5. Open bot in Telegram Web, send a message to trigger pairing request ──
        let pairingCode = '';
        let pairingError = '';
        try {
          // Check for an existing pending pairing code first — openclaw won't generate a new one
          // if a valid code is already pending (codes last ~1 hour).
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
            log(`Existing pending pairing code found: ${pairingCode} — skipping browser /start`);
          }

          const setupProfileDir = path.join(getGoogleProfilesDir(), profileName);
          log(`Profile dir: ${setupProfileDir} (exists=${fs.existsSync(setupProfileDir)})`);
          if (!pairingCode && !fs.existsSync(setupProfileDir)) {
            pairingError = `Profile dir not found: ${setupProfileDir}`;
          } else if (!pairingCode) {
            // No existing code — open browser and send /start to trigger a new pairing request
            // Check gateway status before opening Chrome — confirm Telegram is connected
            await new Promise(resolve => {
              const { exec } = require('child_process');
              exec('openclaw channels status', { env: cleanEnv, timeout: 10_000, maxBuffer: 1024 * 1024 },
                (_err: any, stdout: string, stderr: string) => {
                  log(`pre-pairing status: ${(stdout + stderr).replace(/\n/g, ' ').trim()}`);
                  resolve(undefined);
                }
              );
            });

            log('Opening Chrome to send /start to bot…');

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
            log('Chrome context opened');

            const pages = context.pages();
            const page = pages.length > 0 ? pages[0] : await context.newPage();

            try {
              const tgUrl = `https://web.telegram.org/k/#@${botUsername}`;
              log(`Navigating to ${tgUrl}`);
              await page.goto(tgUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 30_000,
              });
              log(`Page loaded. Current URL: ${page.url()}`);

              // Wait for the chats page to confirm we are logged in (single unique ID — no strict mode issues)
              const loggedIn = await page.locator('#page-chats').waitFor({ state: 'visible', timeout: 15_000 }).then(() => true).catch(() => false);
              log(`loggedIn=${loggedIn}`);
              if (!loggedIn) {
                log('⚠️ Telegram session not found or page stuck — checking URL…');
                if (page.url().includes('about:blank')) {
                  log('🔄 URL is about:blank — attempting secondary navigation…');
                  await page.goto(tgUrl, { waitUntil: 'load', timeout: 20_000 });
                }
                const retryLogin = await page.locator('#page-chats').waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false);
                if (!retryLogin) throw new Error('Telegram session not found — please run Telegram setup first.');
              }

              // Wait for the bot chat to fully render after navigation
              await page.waitForTimeout(3000);

              // Click the START button if present (first time opening the bot).
              // The button is: <button class="chat-input-control-button …"><div class="c-ripple"></div><span class="i18n">START</span></button>
              // Use force:true because the c-ripple div inside intercepts pointer events.
              const startBtn = page.locator('button.chat-input-control-button:has-text("START")').first();
              let startClicked = false;
              try {
                if (await startBtn.isVisible({ timeout: 5000 })) {
                  log('START button found — clicking…');
                  await startBtn.click({ force: true, timeout: 5000 });
                  await page.waitForTimeout(2000);
                  startClicked = true;
                }
              } catch (e: any) {
                log(`START button click failed: ${e?.message?.split('\n')[0]}`);
              }
              if (!startClicked) log('No START button visible — bot chat already open');

              // Send /start — this registers the user with the gateway and triggers a pairing request
              log('Waiting for message input…');
              await page.waitForSelector('.input-message-input', { timeout: 20_000 });
              // Use force:true to bypass the ripple overlay that intercepts pointer events
              await page.locator('.input-message-input').first().click({ force: true, timeout: 5000 });
              await page.waitForTimeout(500);
              log('Typing /start…');
              await page.keyboard.type('/start');
              await page.waitForTimeout(600);
              // Dismiss autocomplete popup before pressing Enter (otherwise Telegram substitutes /status)
              await page.keyboard.press('Escape');
              await page.waitForTimeout(300);

              await page.keyboard.press('Enter');
              log('/start sent — waiting 30s for bot to respond before reading chat…');

              // Wait the full 30s — the bot needs time to receive /start and decide whether
              // to issue a new code or resend the existing one. No point reading early.
              await page.waitForTimeout(30000);

              // Don't filter by msgCountBefore — if the bot already sent a code within the last hour
              // it won't issue a new one. The existing code is already in the chat history.
              const codeRe = /openclaw\s+pairing\s+approve\s+telegram\s+([A-Z0-9]{8})/g;
              try {
                const texts = await page.locator('.message').allTextContents();
                // Search last 20 messages — use the LAST match (most recent code)
                const recent = texts.slice(-20).join('\n');
                const matches = [...recent.matchAll(codeRe)];
                if (matches.length > 0) {
                  pairingCode = matches[matches.length - 1][1];
                  log(`Pairing code found in chat history: ${pairingCode}`);
                } else {
                  log(`No pairing code found in chat — ${texts.length} total messages. Will try CLI fallback.`);
                }
              } catch { /* non-fatal */ }
              if (!pairingCode) log('No pairing code found in chat after 30s — will try CLI fallback.');
            } catch (innerErr) {
              pairingError = innerErr instanceof Error ? innerErr.message : String(innerErr);
              log(`Inner error: ${pairingError}`);
            } finally {
              await context.close().catch(() => {});
              log('Chrome context closed');
            }
          } // end else if (!pairingCode)
        } catch (outerErr) {
          pairingError = outerErr instanceof Error ? outerErr.message : String(outerErr);
          log(`Outer error: ${pairingError}`);
        }

        log(`pairingError="${pairingError}"`);

        // ── 6. Fetch pairing code via CLI fallback (if not already extracted from chat), then approve ──
        if (!pairingError) {
          // If we already extracted the code from the Telegram chat, skip CLI polling
          if (pairingCode) {
            log(`Using pairing code extracted from chat: ${pairingCode}`);
          } else {
            // Poll `openclaw pairing list telegram` — the request may take a moment to register
            for (let attempt = 0; attempt < 4 && !pairingCode; attempt++) {
              log(`Polling pairing list (attempt ${attempt + 1}/4)…`);
              const rawOut: string = await new Promise(resolve => {
                const { exec } = require('child_process');
                exec('openclaw pairing list telegram', { env: cleanEnv, timeout: 10_000, maxBuffer: 1024 * 1024 },
                  (err: any, stdout: string, stderr: string) => {
                    log(`pairing list exit=${err?.code ?? 0} stdout="${stdout.trim()}" stderr="${stderr.trim()}"`);
                    resolve(stdout || '');
                  }
                );
              });
              // Match the exact command format openclaw outputs (8 uppercase alphanumeric chars)
              const match = rawOut.match(/openclaw\s+pairing\s+approve\s+telegram\s+([A-Z0-9]{8})/) ||
                            rawOut.match(/\b([A-Z0-9]{8})\b/);
              if (match) {
                pairingCode = match[1];
                log(`Pairing code found: ${pairingCode}`);
              } else if (attempt < 3) {
                log('No code yet — waiting 3s…');
                await new Promise(r => setTimeout(r, 3000));
              }
            }
          }

          if (pairingCode) {
            log(`Approving pairing code: ${pairingCode}`);
            try {
              await execAsync(`openclaw pairing approve telegram ${pairingCode}`, {
                env: cleanEnv,
                timeout: 30_000,
                maxBuffer: 1024 * 1024,
              });
            } catch (approveErr: any) {
              log(`pairing approve error: ${approveErr?.message || approveErr}`);
            }
          } else {
            pairingError = 'No pending pairing request found after /start.';
            log(pairingError);
          }
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
    const log = (msg: string) => { logs.push(msg); console.log('[openclaw:pair]', msg); };

    // Read bot username from saved profile
    const profileDir = path.join(getGoogleProfilesDir(), profileName);
    const metaPath = path.join(profileDir, 'profile.json');
    const savedProfile = fs.existsSync(metaPath)
      ? JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
      : {};
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
          await new Promise(r => setTimeout(r, 3000));
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
        }

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
        if (preCheck.includes('connected')) {
          log('✅ Telegram already connected — skipping browser /start flow.');
          alreadyConnectedEarly = true;
        }
      } catch { /* non-fatal */ }

      let pairingCode = '';
      let pairingError = '';

      if (alreadyConnectedEarly) {
        // Jump straight to final status
      } else

      if (!fs.existsSync(profileDir)) {
        pairingError = `Profile dir not found: ${profileDir}`;
        log(`⚠️ ${pairingError}`);
      } else {
        log(`Opening Telegram Web → @${botUsername}`);
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
        log('Chrome context opened');

        const pages = context.pages();
        const page = pages.length > 0 ? pages[0] : await context.newPage();

        try {
          const tgUrl = `https://web.telegram.org/k/#@${botUsername}`;
          log(`Navigating to ${tgUrl}`);
          await page.goto(tgUrl, {
            waitUntil: 'load',
            timeout: 30_000,
          });
          log('Page loaded');

          const loggedIn2 = await page.locator('#page-chats').waitFor({ state: 'visible', timeout: 15_000 }).then(() => true).catch(() => false);
          if (!loggedIn2) throw new Error('Telegram session not found — please run Telegram setup first.');

          // Wait for the bot chat to fully render after navigation
          await page.waitForTimeout(3000);

          // Click START button if present
          let clickedStart = false;
          // Use the exact same selectors and logic as openclaw:setup
          const startBtn = page.locator('button.chat-input-control-button:has-text("START")').first();
          try {
            if (await startBtn.isVisible({ timeout: 5000 })) {
              log('START button found — clicking…');
              await startBtn.click({ force: true, timeout: 5000 });
              await page.waitForTimeout(2000);
              clickedStart = true;
            }
          } catch (e: any) {
            log(`START button click failed: ${e?.message?.split('\n')[0]}`);
          }
          if (!clickedStart) log('No START button visible — bot chat already open');

          await page.waitForSelector('.input-message-input', { timeout: 20_000 });
          log('Input box ready — typing /start…');
          // Use force:true to bypass the ripple overlay that intercepts pointer events
          await page.locator('.input-message-input').first().click({ force: true, timeout: 5000 });
          await page.waitForTimeout(500);
          await page.keyboard.type('/start');
          await page.waitForTimeout(600);
          // Dismiss any autocomplete popup
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);

          // Snapshot message count BEFORE pressing Enter so we don't miss the bot's reply
          let msgCountBefore = 0;
          try {
            msgCountBefore = await page.locator('.message').count();
          } catch { /* ignore */ }

          await page.keyboard.press('Enter');
          log('/start sent — waiting up to 30s for bot to respond…');

          // Poll every 2s for up to 30s — break as soon as bot replies with "Pairing code"
          let waited = 0;
          while (waited < 30000) {
            await page.waitForTimeout(2000);
            waited += 2000;
            try {
              const texts = await page.locator('.message').allTextContents();
              const newContent = texts.slice(msgCountBefore).join('\n');
              if (newContent.includes('Pairing code') || newContent.includes('approve')) {
                log(`Bot responded with pairing code after ${waited / 1000}s.`);
                break;
              }
            } catch { /* non-fatal */ }
          }
          if (waited >= 30000) log('Bot did not respond within 30s — reading current chat state.');

          // Extract pairing code from the chat — prefer a code from a new message,
          // but fall back to the most recent code anywhere in the last 10 messages
          // (the bot sometimes doesn't reply again if a code is still pending)
          try {
            const msgTexts = await page.locator('.message').allTextContents();
            const last3 = msgTexts.slice(-3).map(t => t.trim());
            if (last3.length) log(`Chat messages (last 3): ${JSON.stringify(last3)}`);

            const newMsgs = msgTexts.slice(msgCountBefore).join('\n');
            const last10 = msgTexts.slice(-10).join('\n');

            // Pairing codes are exactly 8 uppercase alphanumeric chars (docs confirmed).
            // Telegram Web concatenates the timestamp directly onto the code text
            // (e.g. "T29BJMQ805:20 PM") so we must match exactly 8 chars.
            const codeRe = /openclaw\s+pairing\s+approve\s+telegram\s+([A-Z0-9]{8})/g;

            // Search new messages first, then fall back to last 10
            for (const searchIn of [newMsgs, last10]) {
              const matches = [...searchIn.matchAll(codeRe)];
              if (matches.length > 0) {
                // Use the LAST match (most recent code)
                pairingCode = matches[matches.length - 1][1];
                log(`Extracted pairing code from chat: ${pairingCode}${searchIn === last10 ? ' (from history)' : ''}`);
                break;
              }
            }

            if (!pairingCode) {
              if (newMsgs.toLowerCase().includes('already') || last10.toLowerCase().includes('authorized')) {
                log('Bot indicates already paired — no new code needed.');
              } else {
                log(`No pairing code found in chat. New content (${newMsgs.length} chars): "${newMsgs.slice(0, 100)}"`);
              }
            }
          } catch (e: any) {
            log(`Could not read chat messages: ${e?.message || e}`);
          }
        } catch (err) {
          pairingError = err instanceof Error ? err.message : String(err);
          log(`⚠️ Browser error: ${pairingError}`);
        } finally {
          await context.close().catch(() => {});
        }
      }

      // ── 3. Approve the pairing code ──
      if (!pairingError) {
        // Primary: extracted from chat above.
        // Fallback: query the gateway CLI.
        if (!pairingCode) {
          log('Polling openclaw pairing list telegram (CLI fallback)…');
          for (let i = 0; i < 4 && !pairingCode; i++) {
            // Capture stdout/stderr even on non-zero exit (command exits 1 when no pending requests)
            const pairResult = await execAsync('openclaw pairing list telegram', {
              env: cleanEnv, timeout: 10_000, maxBuffer: 1024 * 1024,
            }).catch((e: any) => ({
              stdout: e.stdout || '',
              stderr: e.stderr || e.message || '',
            }));
            const raw = (pairResult.stdout || '').trim();
            const errOut = (pairResult.stderr || '').trim();
            log(`pairing list (attempt ${i + 1}): stdout="${raw || '(empty)'}"${errOut ? ` stderr="${errOut.slice(0, 150)}"` : ''}`);
            const m = raw.match(/openclaw\s+pairing\s+approve\s+telegram\s+([A-Z0-9]{8})/) ||
                      raw.match(/\b([A-Z0-9]{8})\b/);
            if (m) pairingCode = m[1];
            else if (i < 3) await new Promise(r => setTimeout(r, 3000));
          }
        }

        if (pairingCode) {
          log(`Approving pairing code: ${pairingCode}…`);
          const approveResult = await execAsync(
            `openclaw pairing approve telegram ${pairingCode}`,
            { env: cleanEnv, timeout: 30_000, maxBuffer: 1024 * 1024 }
          ).catch((e: any) => ({
            stdout: (e.stdout || '') as string,
            // e.stderr is the real process stderr; e.message is Node's "Command failed: ..." wrapper
            stderr: (e.stderr || '') as string,
            failed: true,
          })) as { stdout: string; stderr: string; failed?: boolean };
          const approveOut = approveResult.stdout.trim();
          const approveErr = approveResult.stderr.trim();
          // openclaw exits non-zero even on success — check stdout for the success string
          const approveSucceeded = approveOut.toLowerCase().includes('approved');
          if (approveSucceeded) {
            log(`✅ ${approveOut.slice(0, 200)}`);
          } else {
            if (approveOut) log(`Approve stdout: ${approveOut.slice(0, 200)}`);
            if (approveErr) log(`Approve stderr: ${approveErr.slice(0, 200)}`);
            if (!approveOut && !approveErr) log('Approve returned no output (openclaw may have exited non-zero silently).');
          }
        } else {
          log('No new pairing code found — checking if already connected…');
        }
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
      running,
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
}
