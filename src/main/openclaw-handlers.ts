/**
 * IPC handlers for OpenClaw CLI install, config, gateway, and Telegram pairing.
 */
import { ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';

const IS_WIN = process.platform === 'win32';

/** `which` on Unix, `where` on Windows */
const WHICH = IS_WIN ? 'where' : 'which';

/** Build a base clean env, removing Electron-injected NODE_OPTIONS and setting the right home var. */
function makeCleanEnv(homeDir: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, HOME: homeDir };
  if (IS_WIN) env.USERPROFILE = homeDir;
  delete env.NODE_OPTIONS;
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
      ]
    : [
        'pkill -f "openclaw gateway"',
        'pkill -f "openclaw"',
        'pkill -9 -f "openclaw"',
      ];

  for (const cmd of cmds) {
    try {
      await execAsync(cmd, { timeout: 5_000 });
      await new Promise(r => setTimeout(r, 1500));
      return;
    } catch { /* not found — try next */ }
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

      // Read profile.json to get saved token + bot username (fallback if caller didn't pass them)
      const profileDir = path.join(getGoogleProfilesDir(), profileName);
      const metaPath = path.join(profileDir, 'profile.json');
      const savedProfile = fs.existsSync(metaPath)
        ? JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
        : {};

      const resolvedToken = botToken?.trim() || savedProfile.telegramBotToken || '';
      const botUsername: string = savedProfile.telegramBotUsername || 'egdesk_openclaw_bot';

      if (!resolvedToken) {
        return { success: false, error: 'No bot token found — run Telegram setup first.' };
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
        }
      } catch { /* non-fatal */ }

      try {
        // ── 1. Install openclaw if not on PATH ──
        let alreadyInstalled = false;
        try {
          await execAsync(`${WHICH} openclaw`, { env: cleanEnv, timeout: 5_000 });
          alreadyInstalled = true;
        } catch {
          // not on PATH — install via npm
        }

        if (!alreadyInstalled) {
          await execAsync('npm install -g openclaw@latest', {
            env: cleanEnv,
            timeout: 120_000,
            maxBuffer: 10 * 1024 * 1024,
          });
        }

        // ── 2. Write ~/.openclaw/openclaw.json with bot token ──
        if (!fs.existsSync(configDir)) {
          fs.mkdirSync(configDir, { recursive: true });
        }

        const existing = fs.existsSync(configPath)
          ? JSON.parse(fs.readFileSync(configPath, 'utf-8'))
          : {};

        const geminiApiKey = cleanEnv.GEMINI_API_KEY || '';

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

        // Write Google/Gemini API key into config if available
        if (geminiApiKey) {
          const existingProviders = { ...(existing.models?.providers ?? {}) };
          delete existingProviders.openai; // remove openai to prevent "missing key" errors
          updated.models = {
            ...(existing.models ?? {}),
            defaultProvider: 'google',
            providers: {
              ...existingProviders,
              google: { ...(existingProviders.google ?? {}), apiKey: geminiApiKey },
            },
          };
          updated.agents = {
            ...(existing.agents ?? {}),
            defaults: {
              ...(existing.agents?.defaults ?? {}),
              model: {
                ...(existing.agents?.defaults?.model ?? {}),
                primary: existing.agents?.defaults?.model?.primary || 'google/gemini-2.0-flash',
              },
            },
          };
        }

        fs.writeFileSync(configPath, JSON.stringify(updated, null, 2));

        // ── 3. Run onboard daemon ──
        try {
          await execAsync('openclaw onboard --install-daemon', {
            env: cleanEnv,
            timeout: 60_000,
            maxBuffer: 5 * 1024 * 1024,
          });
        } catch {
          // non-fatal — daemon may already exist
        }

        // ── 4. Start openclaw gateway (needed before the bot can receive messages) ──
        // Spawn it detached so it keeps running after this handler returns.
        const { spawn } = await import('child_process');
        try {
          const gatewayProc = spawn('openclaw', ['gateway'], IS_WIN
            ? { env: cleanEnv, detached: false, stdio: 'ignore' as const, shell: true }
            : { env: cleanEnv, detached: true,  stdio: 'ignore' as const });
          gatewayProc.unref();
          // Give the gateway a moment to start polling Telegram
          await new Promise(r => setTimeout(r, 5000));
        } catch {
          // non-fatal — gateway may already be running as a daemon
        }

        // ── 5. Open bot in Telegram Web, send a message to trigger pairing request ──
        let pairingCode = '';
        let pairingError = '';
        try {
          const setupProfileDir = path.join(getGoogleProfilesDir(), profileName);
          if (!fs.existsSync(setupProfileDir)) {
            pairingError = `Profile dir not found: ${setupProfileDir}`;
          } else {
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

            const pages = context.pages();
            const page = pages.length > 0 ? pages[0] : await context.newPage();

            try {
              await page.goto(`https://web.telegram.org/k/#@${botUsername}`, {
                waitUntil: 'domcontentloaded',
                timeout: 30_000,
              });
              await page.waitForTimeout(4000);

              // Click the START button if present (first time opening the bot)
              const startSelectors = [
                '.bot-start-btn',
                'button.btn-primary:has-text("Start")',
                'button.btn-primary:has-text("START")',
                '.start-bot-btn',
                'button:has-text("Start")',
              ];
              for (const sel of startSelectors) {
                try {
                  const btn = page.locator(sel).first();
                  if (await btn.isVisible({ timeout: 1500 })) {
                    await btn.click();
                    await page.waitForTimeout(2000);
                    break;
                  }
                } catch { /* keep trying */ }
              }

              // Send /start — this registers the user with the gateway and triggers a pairing request
              await page.waitForSelector('.input-message-input', { timeout: 20_000 });
              await page.locator('.input-message-input').first().click({ timeout: 5000 });
              await page.waitForTimeout(500);
              await page.keyboard.type('/start');
              await page.waitForTimeout(600);
              // Dismiss autocomplete popup before pressing Enter (otherwise Telegram substitutes /status)
              await page.keyboard.press('Escape');
              await page.waitForTimeout(300);
              await page.keyboard.press('Enter');

              // Give the gateway time to receive the message and queue the pairing request
              await page.waitForTimeout(8000);
            } catch (innerErr) {
              pairingError = innerErr instanceof Error ? innerErr.message : String(innerErr);
            } finally {
              await context.close().catch(() => {});
            }
          }
        } catch (outerErr) {
          pairingError = outerErr instanceof Error ? outerErr.message : String(outerErr);
        }

        // ── 6. Fetch pairing code via CLI, then approve ──
        if (!pairingError) {
          // Poll `openclaw pairing list telegram` a few times — the request may take a moment
          for (let attempt = 0; attempt < 5 && !pairingCode; attempt++) {
            try {
              const { stdout } = await execAsync('openclaw pairing list telegram', {
                env: cleanEnv,
                timeout: 10_000,
                maxBuffer: 1024 * 1024,
              });
              // Output lines look like: "KRHGV7EP  telegram  <user-id>  <timestamp>"
              const match = stdout.match(/\b([A-Z0-9]{6,12})\b/);
              if (match) {
                pairingCode = match[1];
              } else if (attempt < 4) {
                await new Promise(r => setTimeout(r, 3000));
              }
            } catch {
              if (attempt < 4) await new Promise(r => setTimeout(r, 3000));
            }
          }

          if (pairingCode) {
            try {
              await execAsync(`openclaw pairing approve telegram ${pairingCode}`, {
                env: cleanEnv,
                timeout: 30_000,
                maxBuffer: 1024 * 1024,
              });
            } catch {
              // non-fatal
            }
          } else {
            pairingError = 'No pending pairing request found after /start.';
          }
        }

        // ── 8. Verify channels status ──
        let statusOutput = '';
        try {
          const { stdout } = await execAsync('openclaw channels status', {
            env: cleanEnv,
            timeout: 15_000,
            maxBuffer: 1024 * 1024,
          });
          statusOutput = stdout.trim();
        } catch {
          // non-fatal
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
    const botUsername: string = savedProfile.telegramBotUsername || 'egdesk_openclaw_bot';
    log(`Bot username: @${botUsername}`);

    try {
      // ── 0. Verify openclaw is on PATH ──
      try {
        const { stdout: whichOut } = await execAsync(`${WHICH} openclaw`, { env: cleanEnv, timeout: 5000 });
        log(`openclaw binary: ${whichOut.trim()}`);
      } catch {
        log('⚠️ openclaw not found on PATH — install may have failed');
      }

      try {
        const { stdout: verOut } = await execAsync('openclaw --version', { env: cleanEnv, timeout: 5000 });
        log(`openclaw version: ${verOut.trim()}`);
      } catch (e: any) {
        log(`openclaw --version failed: ${e?.message || e}`);
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

        await new Promise(r => setTimeout(r, 8000));
        gatewayProc.unref();

        if (gatewayStartError) {
          log(`⚠️ Gateway spawn error: ${gatewayStartError}`);
        } else if (gatewayOutput.some(o => o.includes('exited with code'))) {
          log(`⚠️ Gateway crashed: ${gatewayOutput.join(' ').trim()}`);
        } else {
          const out = gatewayOutput.join('').trim();
          log(out ? `Gateway output: ${out.slice(0, 300)}` : 'Gateway spawned.');
        }

        // Confirm it's now reachable
        try {
          const { stdout: statusProbe } = await execAsync('openclaw channels status', {
            env: cleanEnv, timeout: 10_000, maxBuffer: 1024 * 1024,
          });
          log(`Status after start: ${statusProbe.trim().slice(0, 200)}`);
        } catch (e: any) {
          log(`Status probe failed: ${e?.message || e}`);
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

        const pages = context.pages();
        const page = pages.length > 0 ? pages[0] : await context.newPage();

        try {
          await page.goto(`https://web.telegram.org/k/#@${botUsername}`, {
            waitUntil: 'domcontentloaded',
            timeout: 30_000,
          });
          log('Telegram Web loaded — waiting 4s…');
          await page.waitForTimeout(4000);

          // Click START button if present
          let clickedStart = false;
          for (const sel of ['button.btn-primary:has-text("Start")', 'button:has-text("Start")', '.bot-start-btn']) {
            try {
              const btn = page.locator(sel).first();
              if (await btn.isVisible({ timeout: 1500 })) {
                await btn.click();
                log(`Clicked START button (selector: ${sel})`);
                clickedStart = true;
                await page.waitForTimeout(2000);
                break;
              }
            } catch { /* try next */ }
          }
          if (!clickedStart) log('START button not found — chat may already be active.');

          await page.waitForSelector('.input-message-input', { timeout: 20_000 });
          log('Input box ready — typing /start…');
          await page.locator('.input-message-input').first().click({ timeout: 5000 });
          await page.waitForTimeout(500);
          await page.keyboard.type('/start');
          await page.waitForTimeout(600);
          // Dismiss any autocomplete popup (Telegram Web replaces /start with /status otherwise)
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
          await page.keyboard.press('Enter');
          log('/start sent — waiting up to 30s for bot to respond…');

          // Snapshot message count before /start so we only read NEW bot replies
          let msgCountBefore = 0;
          try {
            msgCountBefore = await page.locator('.message').count();
          } catch { /* ignore */ }

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

    try {
      const { stdout } = await execAsync('openclaw channels status', {
        env: cleanEnv, timeout: 10_000, maxBuffer: 1024 * 1024,
      });
      statusOutput = stdout.trim();
      connected = statusOutput.includes('connected');
    } catch { /* non-fatal */ }

    // Derive running from status output — if the gateway is reachable it's running
    const running = statusOutput.includes('Gateway reachable') || statusOutput.includes('running');

    return { running, connected, statusOutput };
  });

  // ---------------------------------------------------------------------------
  // OpenClaw — start gateway
  // ---------------------------------------------------------------------------
  ipcMain.handle('openclaw:start', async () => {
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
      }
    } catch { /* non-fatal */ }

    const { spawn } = await import('child_process');
    // On Windows, npm global CLI wrappers are .cmd files and need shell: true
    const spawnOpts = IS_WIN
      ? { env: cleanEnv, detached: false, stdio: 'ignore' as const, shell: true }
      : { env: cleanEnv, detached: true,  stdio: 'ignore' as const };
    try {
      const proc = spawn('openclaw', ['gateway'], spawnOpts);
      proc.unref();
      // Give the gateway a moment to start before the caller queries status
      await new Promise(r => setTimeout(r, 3000));
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
}
