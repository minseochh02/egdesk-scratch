import React, { useState, useEffect, useRef } from 'react';

const PROFILE_NAME = 'openclaw-default';

type Step =
  | 'welcome'      // Title + Get Started
  | 'logging-in'   // Chrome open, waiting for Google login
  | 'creating'     // Running GitHub signup automation
  | 'token'        // Generating GitHub token
  | 'telegram'     // Telegram login + BotFather setup
  | 'installing'   // OpenClaw CLI + config
  | 'kakao'        // KakaoTalk channel + bot creation
  | 'done';        // Accounts dashboard

function cleanGmailToUsername(email: string): string {
  // quus.aispace@gmail.com → egdesk-quusaispace
  const local = email.split('@')[0];
  const cleaned = local.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return `egdesk-${cleaned}`;
}

const OpenClawPage: React.FC = () => {
  const [step, setStep] = useState<Step>('welcome');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [googleEmail, setGoogleEmail] = useState('');
  const [googlePhone, setGooglePhone] = useState('');
  const googlePhoneRef = useRef('');
  const [githubUsername, setGithubUsername] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [createdAccounts, setCreatedAccounts] = useState<string[]>([]);
  const [githubTokens, setGithubTokens] = useState<Record<string, string>>({});
  const [telegramBotTokens, setTelegramBotTokens] = useState<string[]>([]);
  const [telegramSetup, setTelegramSetup] = useState(false);
  const [kakaoSetup, setKakaoSetup] = useState(false);
  const [kakaoSearchId, setKakaoSearchId] = useState('');
  const [kakaoChannelUrl, setKakaoChannelUrl] = useState('');
  const [kakaoBotName, setKakaoBotName] = useState('');
  const [openclawInstalled, setOpenclawInstalled] = useState(false);
  const [openclawStatus, setOpenclawStatus] = useState('');
  const [openclawPairingCode, setOpenclawPairingCode] = useState('');
  const [error, setError] = useState('');
  const [telegramStatus, setTelegramStatus] = useState<{ stage: string; message: string; action?: string } | null>(null);
  const [githubStatus, setGithubStatus] = useState<{ stage: string; message: string } | null>(null);
  const [googleStatus, setGoogleStatus] = useState<{ stage: string; message: string } | null>(null);
  const [reuseKakao, setReuseKakao] = useState(true);

  // Listen for Telegram status events from the backend during setup
  useEffect(() => {
    if (!window.electron?.ipcRenderer?.on) return;
    const cleanup = window.electron.ipcRenderer.on('telegram:status', (data: { stage: string; message: string; action?: string }) => {
      setTelegramStatus(data);
    });
    return () => { if (cleanup) cleanup(); };
  }, []);

  // Listen for GitHub status events (account creation + token generation)
  useEffect(() => {
    if (!window.electron?.ipcRenderer?.on) return;
    const cleanup = window.electron.ipcRenderer.on('github:status', (data: { stage: string; message: string }) => {
      setGithubStatus(data);
    });
    return () => { if (cleanup) cleanup(); };
  }, []);

  // Listen for Google login status events
  useEffect(() => {
    if (!window.electron?.ipcRenderer?.on) return;
    const cleanup = window.electron.ipcRenderer.on('google:status', (data: { stage: string; message: string }) => {
      setGoogleStatus(data);
    });
    return () => { if (cleanup) cleanup(); };
  }, []);

  const addLog = (msg: string) =>
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);

  // On mount: check if a profile with created accounts already exists → go to done
  useEffect(() => {
    (async () => {
      try {
        const result = await (window as any).electron.debug.googleProfile.list();
        const profile = result?.profiles?.find((p: any) => p.profileName === PROFILE_NAME);
        if (profile?.githubAccounts?.length) {
          setCreatedAccounts(profile.githubAccounts);
          if (profile.googleEmail) setGoogleEmail(profile.googleEmail);
          if (profile.githubTokens) setGithubTokens(profile.githubTokens);
          if (profile.telegramBotTokens?.length) {
            setTelegramBotTokens(profile.telegramBotTokens);
            setTelegramSetup(true);
          } else if (profile.telegramBotToken) {
            setTelegramBotTokens([profile.telegramBotToken]);
            setTelegramSetup(true);
          }
          if (profile.kakaoSetup) {
            setKakaoSetup(true);
            if (profile.kakaoSearchId) setKakaoSearchId(profile.kakaoSearchId);
            if (profile.kakaoChannelUrl) setKakaoChannelUrl(profile.kakaoChannelUrl);
            if (profile.kakaoBotName) setKakaoBotName(profile.kakaoBotName);
          }
          setStep('done');
        }
      } catch (_) {}
    })();
  }, []);

  const runGithubCreation = async (username: string) => {
    setStep('creating');
    addLog(`Starting GitHub signup for: ${username}`);
    addLog('Running "Continue with Google" flow on GitHub…');
    addLog('Complete any CAPTCHA or email verification in the browser, then close it.');

    try {
      const result = await (window as any).electron.debug.github.createAccount(
        PROFILE_NAME,
        username
      );

      if (result?.success) {
        const resolvedUsername: string = result.githubUsername;
        if (result.isExistingAccount) {
          addLog(`✅ Existing GitHub account detected: ${resolvedUsername}`);
        } else {
          addLog(`✅ GitHub account created: ${resolvedUsername}`);
        }
        setCreatedAccounts(prev =>
          prev.includes(resolvedUsername) ? prev : [...prev, resolvedUsername]
        );
        setGithubUsername(resolvedUsername);
        await runTokenCreation(resolvedUsername);
      } else {
        addLog(`❌ ${result?.error || 'Unknown error'}`);
        setError(result?.error || 'Account creation failed.');
        setStep('welcome');
      }
    } catch (e: any) {
      addLog(`❌ Error: ${e?.message || e}`);
      setError(e?.message || String(e));
      setStep('welcome');
    }
  };

  const runTokenCreation = async (username: string) => {
    setStep('token');
    addLog(`Generating GitHub token for: ${username}`);
    addLog('Opening GitHub Developer Settings — please wait…');

    try {
      const result = await (window as any).electron.debug.github.createToken(
        PROFILE_NAME,
        username
      );

      if (result?.success) {
        addLog(`✅ Token generated successfully!`);
        setGithubTokens(prev => ({ ...prev, [username]: result.token }));
      } else {
        addLog(`⚠️ Token generation failed: ${result?.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      addLog(`⚠️ Token error: ${e?.message || e}`);
    }
    setGithubStatus(null);
    // Always proceed to Telegram setup (non-fatal)
    await runTelegramSetup();
  };

  const runOpenclawSetup = async (botToken: string) => {
    setStep('installing');
    addLog('Installing OpenClaw…');
    try {
      const result = await (window as any).electron.debug.openclaw.setup(PROFILE_NAME, botToken);
      if (result?.success) {
        addLog(
          result.alreadyInstalled ? '✅ OpenClaw already on PATH.' : '✅ OpenClaw installed.'
        );
        addLog(`✅ Config written to ${result.configPath ?? '~/.openclaw/openclaw.json'}`);
        if (result.pairingCode) {
          addLog(`🔗 Pairing code: ${result.pairingCode}`);
          addLog(`✅ Approved: openclaw pairing approve telegram ${result.pairingCode}`);
          setOpenclawPairingCode(result.pairingCode);
        } else if (result.pairingError) {
          addLog(`⚠️ Pairing step: ${result.pairingError}`);
        }
        if (result.status) addLog(`Status: ${result.status}`);
        setOpenclawInstalled(true);
        setOpenclawStatus(result.status ?? '');
      } else {
        addLog(`⚠️ OpenClaw setup failed: ${result?.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      addLog(`⚠️ OpenClaw error: ${e?.message || e}`);
    }
    setStep('done');
  };

  const runKakaoSetup = async () => {
    setStep('kakao');
    addLog('Setting up KakaoTalk channel and bot...');

    // Use existing random suffix if we have one, to keep names stable during retries
    let rand = Math.floor(Math.random() * 9999);
    if (kakaoSearchId && kakaoSearchId.includes('_')) {
      const parts = kakaoSearchId.split('_');
      const last = parts[parts.length - 1];
      if (!isNaN(parseInt(last))) rand = parseInt(last);
    } else if (kakaoBotName && kakaoBotName.includes(' ')) {
      const parts = kakaoBotName.split(' ');
      const last = parts[parts.length - 1];
      if (!isNaN(parseInt(last))) rand = parseInt(last);
    }

    const channelName = 'EGDesk OpenClaw';
    const searchId = `egdesk_${rand}`;
    const botName = `EGClaw Bot ${rand}`;

    // Get tunnel URL — prefer already-populated tunnelUrl state
    let skillUrl = tunnelUrl;
    let kakaoApiKey = '';
    let storedServerName = '';

    // Try stored tunnel config (survives restarts, valid even when tunnel is offline)
    try {
      const tunnelConfig = await (window as any).electron.invoke('get-mcp-tunnel-config');
      if (!skillUrl && tunnelConfig?.tunnel?.publicUrl) {
        skillUrl = tunnelConfig.tunnel.publicUrl;
      }
      kakaoApiKey = tunnelConfig?.kakaoCallbackApiKey || '';
      storedServerName = tunnelConfig?.tunnel?.serverName || '';
    } catch { /* non-fatal */ }

    // Fall back to live active-tunnel lookup
    if (!skillUrl) {
      try {
        const listResult = await (window as any).electron.tunnel.list();
        const names: string[] = listResult?.tunnels ?? listResult ?? [];
        for (const name of names) {
          const info = await (window as any).electron.tunnel.info(name);
          if (info?.isConnected && info?.publicUrl) {
            skillUrl = info.publicUrl;
            break;
          }
        }
      } catch { /* non-fatal */ }
    }

    // Auto-setup: start local MCP server + tunnel if still no URL
    if (!skillUrl) {
      addLog('No tunnel URL found — auto-starting MCP tunnel...');
      try {
        // Ensure local MCP server is running on port 8080
        const serverStatus = await (window as any).electron.invoke('https-server-status');
        if (!serverStatus?.isRunning) {
          addLog('Starting local MCP server on port 8080...');
          await (window as any).electron.invoke('https-server-start', { port: 8080, useHTTPS: false });
          await new Promise(r => setTimeout(r, 1000));
        }

        // Use stored server name on reconnect; generate a new one on first-time setup.
        // Never generate a new name if one already exists — that would orphan the existing Kakao channel.
        const generatedName = googleEmail
          ? cleanGmailToUsername(googleEmail)
          : `egdesk-${Math.random().toString(16).slice(2, 10)}`;
        const serverName = storedServerName || generatedName;
        if (serverName) {
          const isFirstTime = !storedServerName;
          addLog(isFirstTime ? `Creating new tunnel "${serverName}"...` : `Reconnecting tunnel "${serverName}"...`);
          const tunnelResult = await (window as any).electron.invoke('mcp-tunnel-start', serverName, 'http://localhost:8080');

          if (tunnelResult?.publicUrl) {
            skillUrl = tunnelResult.publicUrl;
            addLog(`Tunnel started: ${skillUrl}`);
          } else if (tunnelResult?.message?.includes('already running')) {
            const freshConfig = await (window as any).electron.invoke('get-mcp-tunnel-config');
            skillUrl = freshConfig?.tunnel?.publicUrl || '';
            if (skillUrl) addLog(`Tunnel already running: ${skillUrl}`);
          } else {
            addLog(`⚠️ Tunnel start failed: ${tunnelResult?.error || tunnelResult?.message || 'unknown'}`);
          }
        }
      } catch (e: any) {
        addLog(`⚠️ Tunnel auto-setup error: ${e?.message || e}`);
      }
    }

    // Hard gate — if still no tunnel URL or API key, skip Kakao entirely
    if (!skillUrl || !kakaoApiKey) {
      addLog('⚠️ Skipping KakaoTalk setup — tunnel could not be established and Kakao channel IDs are a finite resource.');
      return;
    }

    addLog(`Using tunnel URL: ${skillUrl}`);

    // Step A: Create Channel — skip if already done and saved in profile
    let channelOk = false;
    let resolvedSearchId = searchId;
    let resolvedChannelUrl = '';

    if (kakaoSetup && kakaoSearchId && reuseKakao) {
      addLog(`✅ KakaoTalk channel already set up (@${kakaoSearchId}) — skipping creation.`);
      resolvedSearchId = kakaoSearchId;
      resolvedChannelUrl = kakaoChannelUrl;
      channelOk = true;
    } else {
      addLog(`Creating KakaoTalk channel "@${searchId}"...`);
      try {
        const channelResult = await (window as any).electron.debug.kakao.createChannel(
          PROFILE_NAME, channelName, searchId, reuseKakao
        );
        if (channelResult?.success) {
          const finalSearchId = channelResult.searchId || searchId;
          addLog(`✅ KakaoTalk channel created: @${finalSearchId}`);
          resolvedSearchId = finalSearchId;
          resolvedChannelUrl = channelResult.channelUrl ?? '';
          setKakaoSearchId(finalSearchId);
          if (channelResult.channelUrl) {
            setKakaoChannelUrl(channelResult.channelUrl);
            addLog(`채널 URL: ${channelResult.channelUrl}`);
          }
          channelOk = true;
        } else {
          addLog(`⚠️ KakaoTalk channel creation failed: ${channelResult?.error || 'Unknown error'}`);
        }
      } catch (e: any) {
        addLog(`⚠️ KakaoTalk channel error: ${e?.message || e}`);
      }
    }

    // Step B: Create Bot — skip if channel and bot are already done
    if (channelOk) {
      if (kakaoSetup && kakaoBotName && reuseKakao) {
        addLog(`✅ KakaoTalk bot already set up (${kakaoBotName}) — skipping creation.`);
        setKakaoSetup(true);
      } else {
      addLog(`Creating KakaoTalk bot "${botName}"...`);
      try {
        const botResult = await (window as any).electron.debug.kakao.createBot(
          PROFILE_NAME, botName, `@${resolvedSearchId}`, skillUrl, reuseKakao
        );
        if (botResult?.success) {
          const finalBotName = botResult.botName || botName;
          addLog(`✅ KakaoTalk bot created and deployed: ${finalBotName}`);
          setKakaoBotName(finalBotName);
          setKakaoSetup(true);
          // Persist Kakao config so it survives app restart
          try {
            await (window as any).electron.debug.googleProfile.update(PROFILE_NAME, {
              kakaoSetup: true,
              kakaoSearchId: resolvedSearchId,
              kakaoChannelUrl: resolvedChannelUrl,
              kakaoBotName: finalBotName,
            });
          } catch { /* non-fatal */ }
        } else {
          addLog(`⚠️ KakaoTalk bot creation failed: ${botResult?.error || 'Unknown error'}`);
        }
      } catch (e: any) {
        addLog(`⚠️ KakaoTalk bot error: ${e?.message || e}`);
      }
      } // end else (bot not yet created)
    }

    // Don't call setStep('done') here — let the caller decide what comes next
    // (main flow continues to OpenClaw; retry flow sets done itself via retryKakaoSetup)
  };

  const runTelegramSetup = async () => {
    setStep('telegram');
    addLog('Opening Telegram Web — enter the verification code sent to your phone…');

    let tokenForOpenClaw = '';
    try {
      const phone = googlePhoneRef.current;
      if (!phone) {
        addLog('⚠️ No phone number detected — skipping Telegram setup.');
        await runOpenclawSetup('');
        return;
      }

      const result = await (window as any).electron.debug.telegram.setup(PROFILE_NAME, phone);

      if (result?.success) {
        addLog('✅ Telegram + BotFather setup complete!');
        setTelegramSetup(true);
        if (result.tokens?.length > 0) {
          setTelegramBotTokens(result.tokens);
          tokenForOpenClaw = result.tokens[result.tokens.length - 1];
          addLog(`🤖 ${result.tokens.length} bot token(s) found.`);
        } else if (result.token) {
          setTelegramBotTokens([result.token]);
          tokenForOpenClaw = result.token;
          addLog(`🤖 Bot token saved.`);
        }
      } else {
        addLog(`⚠️ Telegram setup failed: ${result?.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      addLog(`⚠️ Telegram error: ${e?.message || e}`);
    }
    setTelegramStatus(null);
    // Kakao first, then OpenClaw
    await runKakaoSetup();
    await runOpenclawSetup(tokenForOpenClaw);
  };

  const handleGetStarted = async () => {
    if (!loginEmail || !loginPassword) {
      setError('Please enter your Google email and password.');
      return;
    }
    setError('');
    setLogs([]);
    setStep('logging-in');
    addLog('Opening Chrome — entering your Google credentials automatically…');

    try {
      const result = await (window as any).electron.debug.googleProfile.login(PROFILE_NAME, loginEmail, loginPassword);
      setGoogleStatus(null);
      if (!result?.success) {
        setError(result?.error || 'Failed to log in to Google.');
        setStep('welcome');
        return;
      }

      // Use the email we already know
      addLog('Login saved. Detecting Google account…');
      const email: string = result.detectedEmail || loginEmail;
      const username = email ? cleanGmailToUsername(email) : 'egdesk-user';

      if (email) {
        setGoogleEmail(email);
        addLog(`Detected account: ${email}`);
        addLog(`GitHub username will be: ${username}`);
      } else {
        addLog('Could not detect email. Using default username.');
      }

      // Detect phone number for Telegram setup
      addLog('Detecting phone number from Google Account…');
      const phoneResult = await (window as any).electron.debug.googleProfile.getPhone(PROFILE_NAME);
      if (phoneResult?.phone) {
        setGooglePhone(phoneResult.phone);
        googlePhoneRef.current = phoneResult.phone;
        addLog(`Detected phone: ${phoneResult.phone}`);
      } else {
        addLog('Phone number not found — Telegram step will be skipped.');
      }

      setGithubUsername(username);
      await runGithubCreation(username);
    } catch (e: any) {
      setError(e?.message || String(e));
      setStep('welcome');
    }
  };

  const handleRegenerateToken = async () => {
    setError('');
    setLogs([]);
    const username = githubUsername || cleanGmailToUsername(googleEmail);
    await runTokenCreation(username);
  };

  const [isPairing, setIsPairing] = useState(false);
  const [isRunningKakao, setIsRunningKakao] = useState(false);

  // ── Tunnel URL (for Kakao skill endpoint) ──
  const [tunnelUrl, setTunnelUrl] = useState('');

  const refreshTunnelUrl = async () => {
    try {
      const listResult = await (window as any).electron.tunnel.list();
      const names: string[] = listResult?.tunnels ?? listResult ?? [];
      for (const name of names) {
        const info = await (window as any).electron.tunnel.info(name);
        if (info?.isConnected && info?.publicUrl) {
          setTunnelUrl(info.publicUrl);
          return;
        }
      }
      setTunnelUrl('');
    } catch { /* non-fatal */ }
  };

  useEffect(() => {
    if (step !== 'done') return;
    refreshTunnelUrl();
  }, [step]);
  const [gatewayRunning, setGatewayRunning] = useState(false);
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [gatewayStatusText, setGatewayStatusText] = useState('');
  const [isTogglingGateway, setIsTogglingGateway] = useState(false);
  const [localServerRunning, setLocalServerRunning] = useState(false);
  const [tunnelRunning, setTunnelRunning] = useState(false);

  const refreshStatus = async () => {
    try {
      const result = await (window as any).electron.debug.openclaw.status();
      setGatewayRunning(result?.gatewayRunning ?? false);
      setTelegramConnected(result?.telegramConnected ?? false);
      setGatewayStatusText(result?.statusOutput ?? '');
    } catch { /* non-fatal */ }
    try {
      const serverStatus = await (window as any).electron.invoke('https-server-status');
      setLocalServerRunning(serverStatus?.isRunning ?? false);
    } catch { /* non-fatal */ }
    try {
      const listResult = await (window as any).electron.tunnel.list();
      const names: string[] = listResult?.tunnels ?? listResult ?? [];
      let anyConnected = false;
      for (const name of names) {
        const info = await (window as any).electron.tunnel.info(name);
        if (info?.isConnected) { anyConnected = true; break; }
      }
      setTunnelRunning(anyConnected);
    } catch { /* non-fatal */ }
  };

  // Poll status every 10s when on the done screen.
  // Use recursive setTimeout (not setInterval) so the next poll only starts after the
  // previous one finishes — prevents concurrent openclaw channels status subprocesses
  // from stacking up if a call takes close to the 10s timeout.
  useEffect(() => {
    if (step !== 'done') return;
    let cancelled = false;
    const poll = async () => {
      await refreshStatus();
      if (!cancelled) setTimeout(poll, 10_000);
    };
    poll();
    return () => { cancelled = true; };
  }, [step]);

  const handleStartGateway = async () => {
    setIsTogglingGateway(true);
    try {
      // 1. Start local MCP server
      addLog('Starting local MCP server…');
      try {
        const serverStatus = await (window as any).electron.invoke('https-server-status');
        if (!serverStatus?.isRunning) {
          await (window as any).electron.invoke('https-server-start', { port: 8080, useHTTPS: false });
          await new Promise(r => setTimeout(r, 1000));
          addLog('✅ Local MCP server started on port 8080.');
        } else {
          addLog('✅ Local MCP server already running.');
        }
        setLocalServerRunning(true);
      } catch (e: any) {
        addLog(`⚠️ Local server error: ${e?.message || e}`);
      }

      // 2. Start tunnel
      addLog('Starting tunnel…');
      try {
        const tunnelConfig = await (window as any).electron.invoke('get-mcp-tunnel-config');
        const storedServerName = tunnelConfig?.tunnel?.serverName || '';
        if (storedServerName) {
          let alreadyConnected = false;
          try {
            const info = await (window as any).electron.tunnel.info(storedServerName);
            alreadyConnected = !!info?.isConnected;
          } catch {}

          if (alreadyConnected) {
            addLog(`✅ Tunnel "${storedServerName}" already connected.`);
            if (!tunnelUrl) await refreshTunnelUrl();
            setTunnelRunning(true);
          } else {
            const tunnelResult = await (window as any).electron.invoke('mcp-tunnel-start', storedServerName, 'http://localhost:8080');
            if (tunnelResult?.publicUrl) {
              setTunnelUrl(tunnelResult.publicUrl);
              setTunnelRunning(true);
              addLog(`✅ Tunnel started: ${tunnelResult.publicUrl}`);
            } else if (tunnelResult?.message?.includes('already running')) {
              await refreshTunnelUrl();
              setTunnelRunning(true);
              addLog('✅ Tunnel already running.');
            } else {
              addLog(`⚠️ Tunnel: ${tunnelResult?.error || tunnelResult?.message || 'unknown'}`);
            }
          }
        } else {
          addLog('⚠️ No tunnel name configured — skipping tunnel start.');
        }
      } catch (e: any) {
        addLog(`⚠️ Tunnel error: ${e?.message || e}`);
      }

      // 3. Start OpenClaw gateway
      addLog('Starting OpenClaw gateway…');
      const startResult = await (window as any).electron.debug.openclaw.start();
      if (startResult?.success === false) {
        const err = startResult.error || 'unknown error';
        addLog(`❌ Gateway start failed: ${err}`);
        setError(`Gateway start failed: ${err}`);
      } else {
        addLog('✅ Gateway started.');
        setGatewayRunning(true);
      }
      for (let i = 0; i < 5; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const s = await (window as any).electron.debug.openclaw.status();
        setGatewayRunning(s?.gatewayRunning ?? true);
        setTelegramConnected(s?.telegramConnected ?? false);
        setGatewayStatusText(s?.statusOutput ?? '');
        if (s?.gatewayRunning) break;
      }
    } catch (e: any) {
      addLog(`⚠️ Start failed: ${e?.message || e}`);
    } finally {
      await refreshStatus();
      setIsTogglingGateway(false);
    }
  };

  const handleStopGateway = async () => {
    if (isTogglingGateway) return;
    setIsTogglingGateway(true);
    addLog('Stopping OpenClaw gateway…');
    try {
      await (window as any).electron.debug.openclaw.stop();
      addLog('✅ Gateway stopped.');
    } catch (e: any) {
      addLog(`⚠️ Stop failed: ${e?.message || e}`);
    } finally {
      await refreshStatus();
      setIsTogglingGateway(false);
    }
  };

  const retryKakaoSetup = async () => {
    if (isRunningKakao) return;
    setIsRunningKakao(true);
    setLogs([]);
    try {
      await runKakaoSetup();
      setStep('done'); // standalone retry — go to done after kakao finishes
    } catch (e: any) {
      addLog(`⚠️ KakaoTalk setup error: ${e?.message || e}`);
    } finally {
      setIsRunningKakao(false);
    }
  };

  const [isRetryingSetup, setIsRetryingSetup] = useState(false);

  const retryOpenclawSetup = async () => {
    if (isRetryingSetup) return;
    setIsRetryingSetup(true);
    setLogs([]);
    addLog('Re-running OpenClaw setup (config + gateway + pairing)…');
    try {
      // Pass empty string — handler reads saved token from profile.json automatically
      const result = await (window as any).electron.debug.openclaw.setup(PROFILE_NAME, '');
      if (result?.success) {
        addLog(result.alreadyInstalled ? '✅ OpenClaw already on PATH.' : '✅ OpenClaw installed.');
        addLog(`✅ Config written to ${result.configPath ?? '~/.openclaw/openclaw.json'}`);
        if (result.pairingCode) {
          addLog(`✅ Telegram paired (code: ${result.pairingCode})`);
          setOpenclawPairingCode(result.pairingCode);
        } else if (result.pairingError) {
          addLog(`⚠️ Pairing: ${result.pairingError}`);
        }
        if (result.status) addLog(`Status: ${result.status}`);
        setOpenclawInstalled(true);
        setOpenclawStatus(result.status ?? '');
      } else {
        addLog(`⚠️ Setup failed: ${result?.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      addLog(`⚠️ Setup error: ${e?.message || e}`);
    } finally {
      await refreshStatus();
      setIsRetryingSetup(false);
    }
  };

  const runPairing = async () => {
    if (isPairing) return;
    setIsPairing(true);
    setLogs([]);
    addLog('Retrying Telegram pairing…');
    try {
      const result = await (window as any).electron.debug.openclaw.pair(PROFILE_NAME);

      // Display all backend logs first so the user sees step-by-step what happened
      if (result?.logs?.length) {
        for (const l of result.logs) addLog(`  ${l}`);
      }

      if (result?.success) {
        const connected = result.status?.includes('connected');
        if (result.pairingCode) {
          setOpenclawPairingCode(result.pairingCode);
          addLog(`✅ Telegram pairing approved (code: ${result.pairingCode})`);
        } else if (connected) {
          addLog('✅ Telegram already connected — nothing to do.');
        } else if (result.pairingError) {
          addLog(`⚠️ Pairing: ${result.pairingError}`);
        } else {
          addLog('✅ Pairing complete.');
        }
      } else {
        addLog(`⚠️ Pairing failed: ${result?.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      addLog(`⚠️ Pairing error: ${e?.message || e}`);
    } finally {
      await refreshStatus();
      setIsPairing(false);
    }
  };

  const handleReset = async () => {
    // Perform a deep reset: clear Electron Store + openclaw.json + Chrome profile
    try {
      await (window as any).electron.debug.openclaw.reset(PROFILE_NAME);
      await (window as any).electron.debug.googleProfile.delete(PROFILE_NAME);
    } catch { /* non-fatal */ }

    setStep('welcome');
    setLoginPassword('');
    setGoogleEmail('');
    setGooglePhone('');
    googlePhoneRef.current = '';
    setGithubUsername('');
    setLogs([]);
    setCreatedAccounts([]);
    setGithubTokens({});
    setTelegramBotTokens([]);
    setTelegramSetup(false);
    setKakaoSetup(false);
    setKakaoSearchId('');
    setKakaoChannelUrl('');
    setKakaoBotName('');
    setOpenclawInstalled(false);
    setOpenclawStatus('');
    setOpenclawPairingCode('');
    setIsPairing(false);
    setGatewayRunning(false);
    setTelegramConnected(false);
    setGatewayStatusText('');
    setIsTogglingGateway(false);
    setLocalServerRunning(false);
    setTunnelRunning(false);
    setTunnelUrl('');
    setError('');
  };

  return (
    <div style={{
      height: '100%',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: step === 'welcome' ? 'center' : 'flex-start',
      padding: '48px 24px',
      color: '#fff',
    }}>

      {/* ── WELCOME ── */}
      {step === 'welcome' && (
        <div style={{ textAlign: 'center', maxWidth: '480px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🦀</div>
          <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.5px' }}>
            EG-OpenClaw
          </h1>
          <p style={{ color: '#888', fontSize: '15px', lineHeight: 1.6, marginBottom: '40px' }}>
            Log in once with your Google account and OpenClaw will automatically
            set up your developer accounts — no passwords or tokens to manage.
          </p>
          {error && (
            <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '16px' }}>{error}</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px', textAlign: 'left' }}>
            <div>
              <label style={{ display: 'block', color: '#aaa', fontSize: '12px', marginBottom: '4px' }}>Google Email</label>
              <input
                type="email"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                placeholder="you@gmail.com"
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: '6px',
                  border: '1px solid #444', backgroundColor: '#1a1a1a',
                  color: '#fff', fontSize: '14px', boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: '#aaa', fontSize: '12px', marginBottom: '4px' }}>Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: '6px',
                  border: '1px solid #444', backgroundColor: '#1a1a1a',
                  color: '#fff', fontSize: '14px', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', justifyContent: 'center' }}>
            <input
              type="checkbox"
              id="reuseKakao"
              checked={reuseKakao}
              onChange={e => setReuseKakao(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="reuseKakao" style={{ color: '#aaa', fontSize: '13px', cursor: 'pointer' }}>
              Reuse existing Kakao channel/bot if found
            </label>
          </div>
          <button
            onClick={handleGetStarted}
            style={{
              padding: '14px 40px',
              backgroundColor: '#238636',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Get Started
          </button>
        </div>
      )}

      {/* ── LOGGING IN ── */}
      {step === 'logging-in' && (
        <div style={{ textAlign: 'center', maxWidth: '480px' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>🌐</div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Log in with Google</h2>

          {/* Pulsing banner while waiting for the user to log in */}
          {googleStatus?.stage === 'waiting-for-login' && (
            <div style={{
              marginBottom: '16px', borderRadius: '8px', overflow: 'hidden',
              border: '2px solid #4ade80',
              animation: 'gl-pulse 1.4s ease-in-out infinite',
              textAlign: 'left',
            }}>
              <style>{`
                @keyframes gl-pulse {
                  0%, 100% { box-shadow: 0 0 0 0 rgba(74,222,128,0.45); }
                  50% { box-shadow: 0 0 0 8px rgba(74,222,128,0); }
                }
              `}</style>
              <div style={{ background: '#052e16', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '28px', lineHeight: 1 }}>🔑</span>
                <div>
                  <div style={{ color: '#86efac', fontWeight: 'bold', fontSize: '15px' }}>Sign in with Google</div>
                  <div style={{ color: '#4ade80', fontSize: '12px', marginTop: '2px' }}>{googleStatus.message}</div>
                </div>
              </div>
              <div style={{ background: '#021d0e', padding: '10px 16px', color: '#86efac', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <span>👉</span>
                <span>Complete login in the browser window — it will close automatically.</span>
              </div>
            </div>
          )}

          {/* Stage indicator for all non-waiting stages */}
          {googleStatus && googleStatus.stage !== 'waiting-for-login' && (() => {
            const cfg: Record<string, { icon: string; color: string; bg: string; border: string }> = {
              'opening':         { icon: '🌐', color: '#aaa',    bg: '#1a1a1a', border: '#444' },
              'navigating':      { icon: '🌐', color: '#aaa',    bg: '#1a1a1a', border: '#444' },
              'filling-email':   { icon: '✉️',  color: '#93c5fd', bg: '#0c1a2e', border: '#3b82f6' },
              'filling-password':{ icon: '🔑', color: '#93c5fd', bg: '#0c1a2e', border: '#3b82f6' },
              'waiting-2fa':     { icon: '📱', color: '#fbbf24', bg: '#1c1200', border: '#d97706' },
              '2fa-approved':    { icon: '✅', color: '#4ade80', bg: '#0d2a1a', border: '#16a34a' },
              'profile-linked':  { icon: '✅', color: '#4caf50', bg: '#0d2a1a', border: '#4caf50' },
              'logged-in':       { icon: '✅', color: '#4caf50', bg: '#0d2a1a', border: '#4caf50' },
              'already-logged-in': { icon: '✅', color: '#4caf50', bg: '#0d2a1a', border: '#4caf50' },
            };
            const c = cfg[googleStatus.stage] ?? { icon: '⏳', color: '#aaa', bg: '#1a1a1a', border: '#444' };
            return (
              <>
                <div style={{
                  marginBottom: '16px', borderRadius: '6px',
                  border: `1px solid ${c.border}`, backgroundColor: c.bg,
                  padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px',
                  textAlign: 'left',
                }}>
                  <span style={{ fontSize: '18px', lineHeight: 1 }}>{c.icon}</span>
                  <div style={{ color: c.color, fontSize: '13px' }}>{googleStatus.message}</div>
                </div>
                {googleStatus.stage === 'waiting-2fa' && (
                  <div style={{ marginBottom: '16px' }}>
                    <p style={{ color: '#888', fontSize: '13px', marginBottom: '10px' }}>
                      Approve the sign-in prompt on your phone, then come back here.<br/>
                      If you didn't receive it, tap the button below.
                    </p>
                    <button
                      onClick={() => (window as any).electron.debug.googleProfile.resendTwoFactor()}
                      style={{
                        padding: '8px 20px',
                        backgroundColor: '#1a1a1a',
                        color: '#fbbf24',
                        border: '1px solid #d97706',
                        borderRadius: '6px',
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      Resend it
                    </button>
                  </div>
                )}
              </>
            );
          })()}

          {!googleStatus && (
            <p style={{ color: '#888', fontSize: '14px', marginBottom: '32px', lineHeight: 1.6 }}>
              Chrome is opening — signing in with your Google account automatically…
            </p>
          )}

          <Console logs={logs} onClear={() => setLogs([])} />
          <button
            onClick={handleReset}
            style={{
              marginTop: '24px',
              padding: '8px 16px',
              backgroundColor: 'transparent',
              color: '#666',
              border: '1px solid #333',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Cancel & Reset
          </button>
        </div>
      )}

      {/* ── TOKEN ── */}
      {step === 'token' && (
        <div style={{ textAlign: 'center', maxWidth: '480px' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔑</div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Generating Token</h2>
          {githubUsername && (
            <p style={{ color: '#888', fontSize: '13px', marginBottom: '16px' }}>
              GitHub: <span style={{ color: '#58a6ff', fontFamily: 'monospace' }}>{githubUsername}</span>
            </p>
          )}

          {/* Pulsing email banner when Gmail is being read for sudo code */}
          {githubStatus?.stage === 'sudo-awaiting-code' && (
            <div style={{
              marginBottom: '16px', borderRadius: '8px', overflow: 'hidden',
              border: '2px solid #fbbf24',
              animation: 'gh-pulse 1.4s ease-in-out infinite',
              textAlign: 'left',
            }}>
              <style>{`
                @keyframes gh-pulse {
                  0%, 100% { box-shadow: 0 0 0 0 rgba(251,191,36,0.5); }
                  50% { box-shadow: 0 0 0 8px rgba(251,191,36,0); }
                }
              `}</style>
              <div style={{ background: '#7c4a00', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '28px', lineHeight: 1 }}>📧</span>
                <div>
                  <div style={{ color: '#fde68a', fontWeight: 'bold', fontSize: '15px' }}>Check Your Email</div>
                  <div style={{ color: '#fcd34d', fontSize: '12px', marginTop: '2px' }}>{githubStatus.message}</div>
                </div>
              </div>
              <div style={{ background: '#3a2200', padding: '10px 16px', color: '#fde68a', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <span>👉</span>
                <span>Enter the 8-digit GitHub verification code in the browser window.</span>
              </div>
            </div>
          )}

          {/* Stage indicator for all other github:status states */}
          {githubStatus && githubStatus.stage !== 'sudo-awaiting-code' && (() => {
            const stageConfig: Record<string, { icon: string; label: string; color: string; bg: string; border: string }> = {
              'navigating':           { icon: '🌐', label: 'Opening GitHub…',                    color: '#aaa',    bg: '#1a1a1a', border: '#444' },
              'checking-login':       { icon: '🔍', label: 'Checking login…',                    color: '#aaa',    bg: '#1a1a1a', border: '#444' },
              'logged-in':            { icon: '✅', label: 'Logged in',                          color: '#4caf50', bg: '#0d2a1a', border: '#4caf50' },
              'checking-tokens':      { icon: '🔍', label: 'Scanning existing tokens…',          color: '#aaa',    bg: '#1a1a1a', border: '#444' },
              'token-exists':         { icon: '✅', label: 'Token already exists',               color: '#4caf50', bg: '#0d2a1a', border: '#4caf50' },
              'no-tokens':            { icon: '➕', label: 'No tokens yet — creating…',          color: '#aaa',    bg: '#1a1a1a', border: '#444' },
              'other-tokens':         { icon: '➕', label: 'Creating token…',                    color: '#aaa',    bg: '#1a1a1a', border: '#444' },
              'deleting-old':         { icon: '🗑️', label: 'Removing old token…',               color: '#f59e0b', bg: '#2a1a00', border: '#f59e0b' },
              'sudo-required':        { icon: '🔒', label: 'GitHub identity check required…',    color: '#f59e0b', bg: '#2a1a00', border: '#f59e0b' },
              'sudo-checking-gmail':  { icon: '📧', label: 'Reading verification code from Gmail…', color: '#60a5fa', bg: '#0a1a2a', border: '#60a5fa' },
              'sudo-code-found':      { icon: '✅', label: 'Code found — verifying…',            color: '#4caf50', bg: '#0d2a1a', border: '#4caf50' },
              'sudo-verified':        { icon: '✅', label: 'Identity verified!',                  color: '#4caf50', bg: '#0d2a1a', border: '#4caf50' },
              'sudo-failed':          { icon: '⚠️', label: 'Verification failed',                color: '#f87171', bg: '#2a0a0a', border: '#f87171' },
              'filling-form':         { icon: '⌨️', label: 'Filling token form…',               color: '#aaa',    bg: '#1a1a1a', border: '#444' },
              'generating':           { icon: '⏳', label: 'Submitting…',                        color: '#aaa',    bg: '#1a1a1a', border: '#444' },
              'extracting-token':     { icon: '🔑', label: 'Extracting token…',                  color: '#aaa',    bg: '#1a1a1a', border: '#444' },
            };
            const cfg = stageConfig[githubStatus.stage] ?? { icon: '⏳', label: 'Running…', color: '#aaa', bg: '#1a1a1a', border: '#444' };
            return (
              <div style={{
                marginBottom: '16px', borderRadius: '6px', overflow: 'hidden',
                border: `1px solid ${cfg.border}`, backgroundColor: cfg.bg,
                padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px',
                textAlign: 'left',
              }}>
                <span style={{ fontSize: '18px', lineHeight: 1 }}>{cfg.icon}</span>
                <div>
                  <div style={{ color: cfg.color, fontWeight: 'bold', fontSize: '13px' }}>{cfg.label}</div>
                  {githubStatus.message && (
                    <div style={{ color: '#888', fontSize: '11px', marginTop: '2px' }}>{githubStatus.message}</div>
                  )}
                </div>
              </div>
            );
          })()}

          {!githubStatus && (
            <p style={{ color: '#666', fontSize: '13px', lineHeight: 1.6 }}>
              Opening GitHub Developer Settings to generate a personal access token.
              This may take a moment — please don't close the browser.
            </p>
          )}

          <Console logs={logs} onClear={() => setLogs([])} />
          <button
            onClick={handleReset}
            style={{
              marginTop: '24px',
              padding: '8px 16px',
              backgroundColor: 'transparent',
              color: '#666',
              border: '1px solid #333',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Cancel & Reset
          </button>
        </div>
      )}

      {/* ── CREATING ── */}
      {step === 'creating' && (
        <div style={{ textAlign: 'center', maxWidth: '480px' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>🐙</div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Creating GitHub Account</h2>
          {googleEmail && (
            <p style={{ color: '#888', fontSize: '13px', marginBottom: '4px' }}>
              Google: <span style={{ color: '#4ade80' }}>{googleEmail}</span>
            </p>
          )}
          {githubUsername && (
            <p style={{ color: '#888', fontSize: '13px', marginBottom: '24px' }}>
              Username: <span style={{ color: '#58a6ff', fontFamily: 'monospace' }}>{githubUsername}</span>
            </p>
          )}
          <p style={{ color: '#666', fontSize: '13px', lineHeight: 1.6 }}>
            Signing up on GitHub using your Google account.
            Complete any CAPTCHA or email verification in the browser, then close it.
          </p>
          <Console logs={logs} onClear={() => setLogs([])} />
          <button
            onClick={handleReset}
            style={{
              marginTop: '24px',
              padding: '8px 16px',
              backgroundColor: 'transparent',
              color: '#666',
              border: '1px solid #333',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Cancel & Reset
          </button>
        </div>
      )}

      {/* ── INSTALLING OPENCLAW ── */}
      {step === 'installing' && (
        <div style={{ textAlign: 'center', maxWidth: '480px' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚙️</div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Installing OpenClaw</h2>
          <p style={{ color: '#666', fontSize: '13px', lineHeight: 1.6, marginBottom: '24px' }}>
            Downloading and configuring OpenClaw with your Telegram bot token…
          </p>
          <Console logs={logs} onClear={() => setLogs([])} />
        </div>
      )}

      {/* ── TELEGRAM ── */}
      {step === 'telegram' && (
        <div style={{ textAlign: 'center', maxWidth: '480px' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>✈️</div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Setting Up Telegram</h2>
          {googlePhone && (
            <p style={{ color: '#888', fontSize: '13px', marginBottom: '16px' }}>
              Phone: <span style={{ color: '#fff', fontFamily: 'monospace' }}>{googlePhone}</span>
            </p>
          )}

          {/* Awaiting-code banner — pulsing yellow when user needs to enter code */}
          {telegramStatus?.stage === 'awaiting-code' && (
            <div style={{
              marginBottom: '16px', borderRadius: '8px', overflow: 'hidden',
              border: '2px solid #fbbf24',
              animation: 'tg-pulse 1.4s ease-in-out infinite',
              textAlign: 'left',
            }}>
              <style>{`
                @keyframes tg-pulse {
                  0%, 100% { box-shadow: 0 0 0 0 rgba(251,191,36,0.5); }
                  50% { box-shadow: 0 0 0 8px rgba(251,191,36,0); }
                }
              `}</style>
              <div style={{ background: '#7c4a00', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '28px', lineHeight: 1 }}>📲</span>
                <div>
                  <div style={{ color: '#fde68a', fontWeight: 'bold', fontSize: '15px' }}>Check Your Phone</div>
                  <div style={{ color: '#fcd34d', fontSize: '12px', marginTop: '2px' }}>{telegramStatus.message}</div>
                </div>
              </div>
              <div style={{ background: '#3a2200', padding: '10px 16px', color: '#fde68a', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <span>👉</span>
                <span>{telegramStatus.action ?? 'Open Telegram on your phone and enter the verification code in the browser window.'}</span>
              </div>
            </div>
          )}

          {/* Stage indicator for all other states */}
          {telegramStatus && telegramStatus.stage !== 'awaiting-code' && (() => {
            const stageConfig: Record<string, { icon: string; label: string; color: string; bg: string; border: string }> = {
              'navigating':        { icon: '🌐', label: 'Opening Telegram Web…',           color: '#aaa',    bg: '#1a1a1a', border: '#444' },
              'checking-login':    { icon: '🔍', label: 'Checking login status…',           color: '#aaa',    bg: '#1a1a1a', border: '#444' },
              'already-logged-in': { icon: '✅', label: 'Already logged in',               color: '#4caf50', bg: '#0d2a1a', border: '#4caf50' },
              'phone-login':       { icon: '📱', label: 'Entering phone number…',           color: '#aaa',    bg: '#1a1a1a', border: '#444' },
              'submitting-phone':  { icon: '➡️', label: 'Submitting phone number…',         color: '#aaa',    bg: '#1a1a1a', border: '#444' },
              'verifying-code':    { icon: '⏳', label: 'Verifying code…',                 color: '#aaa',    bg: '#1a1a1a', border: '#444' },
              'logged-in':         { icon: '✅', label: 'Logged in!',                       color: '#4caf50', bg: '#0d2a1a', border: '#4caf50' },
              'opening-botfather': { icon: '🤖', label: 'Opening BotFather…',              color: '#aaa',    bg: '#1a1a1a', border: '#444' },
              'newbot':            { icon: '⌨️', label: 'Sending /newbot command…',         color: '#aaa',    bg: '#1a1a1a', border: '#444' },
              'bot-name':          { icon: '⌨️', label: 'Entering bot display name…',       color: '#aaa',    bg: '#1a1a1a', border: '#444' },
              'bot-username':      { icon: '⌨️', label: 'Entering bot username…',           color: '#aaa',    bg: '#1a1a1a', border: '#444' },
              'extracting-token':  { icon: '🔑', label: 'Extracting bot token…',            color: '#aaa',    bg: '#1a1a1a', border: '#444' },
              'saving':            { icon: '💾', label: 'Saving to profile…',               color: '#aaa',    bg: '#1a1a1a', border: '#444' },
              'code-expired':      { icon: '⚠️', label: 'Code expired — retrying…',        color: '#f59e0b', bg: '#2a1a00', border: '#f59e0b' },
              'awaiting-close':    { icon: '🏁', label: 'Done! You can close the browser.', color: '#4caf50', bg: '#0d2a1a', border: '#4caf50' },
            };
            const cfg = stageConfig[telegramStatus.stage] ?? { icon: '⏳', label: 'Running…', color: '#aaa', bg: '#1a1a1a', border: '#444' };
            return (
              <div style={{
                marginBottom: '16px', borderRadius: '6px', overflow: 'hidden',
                border: `1px solid ${cfg.border}`, backgroundColor: cfg.bg,
                padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px',
                textAlign: 'left',
              }}>
                <span style={{ fontSize: '18px', lineHeight: 1 }}>{cfg.icon}</span>
                <div>
                  <div style={{ color: cfg.color, fontWeight: 'bold', fontSize: '13px' }}>{cfg.label}</div>
                  {telegramStatus.message && (
                    <div style={{ color: '#888', fontSize: '11px', marginTop: '2px' }}>{telegramStatus.message}</div>
                  )}
                </div>
              </div>
            );
          })()}

          {!telegramStatus && (
            <p style={{ color: '#666', fontSize: '13px', lineHeight: 1.6, marginBottom: '16px' }}>
              The browser will open Telegram. Enter the verification code sent to your phone,
              then BotFather will automatically create your bot.
            </p>
          )}

          <Console logs={logs} onClear={() => setLogs([])} />
          <button
            onClick={handleReset}
            style={{
              marginTop: '24px',
              padding: '8px 16px',
              backgroundColor: 'transparent',
              color: '#666',
              border: '1px solid #333',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Cancel & Reset
          </button>
        </div>
      )}

      {/* ── KAKAO ── */}
      {step === 'kakao' && (
        <div style={{ textAlign: 'center', maxWidth: '480px' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>💬</div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Setting Up KakaoTalk</h2>
          <p style={{ color: '#666', fontSize: '13px', lineHeight: 1.6, marginBottom: '24px' }}>
            Creating a KakaoTalk channel and chatbot. The browser will open automatically —
            this may take several minutes while waiting for callback approval.
          </p>
          <Console logs={logs} onClear={() => setLogs([])} />
        </div>
      )}

      {/* ── DONE ── */}
      {step === 'done' && (
        <div style={{ width: '100%', maxWidth: '560px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '4px' }}>Your Accounts</h2>
          {googleEmail && (
            <p style={{ color: '#888', fontSize: '13px', marginBottom: '24px' }}>
              Google: <span style={{ color: '#4ade80' }}>{googleEmail}</span>
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
            {createdAccounts.map(username => (
              <div key={username} style={{
                backgroundColor: '#161b22',
                border: '1px solid #30363d',
                borderRadius: '8px',
                padding: '14px 18px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: githubTokens[username] ? '10px' : '0' }}>
                  <span style={{ fontSize: '20px' }}>🐙</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>GitHub</div>
                    <div style={{ color: '#58a6ff', fontSize: '13px', fontFamily: 'monospace' }}>
                      github.com/{username}
                    </div>
                  </div>
                </div>
                {githubTokens[username] && (
                  <div style={{
                    marginTop: '8px',
                    padding: '8px 10px',
                    backgroundColor: '#0d1117',
                    border: '1px solid #21262d',
                    borderRadius: '6px',
                  }}>
                    <div style={{ color: '#888', fontSize: '11px', marginBottom: '4px' }}>
                      🔑 Personal Access Token
                    </div>
                    <div style={{
                      color: '#3fb950',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      wordBreak: 'break-all',
                    }}>
                      {githubTokens[username]}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {telegramSetup && (
              <div style={{
                backgroundColor: '#161b22',
                border: '1px solid #30363d',
                borderRadius: '8px',
                padding: '14px 18px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: telegramBotTokens.length > 0 ? '10px' : '0' }}>
                  <span style={{ fontSize: '20px' }}>✈️</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>Telegram</div>
                    <div style={{ color: '#888', fontSize: '13px' }}>BotFather — egdesk_openclaw_bot</div>
                  </div>
                </div>
                {telegramBotTokens.map((token, i) => (
                  <div key={token} style={{
                    marginTop: '8px',
                    padding: '8px 10px',
                    backgroundColor: '#0d1117',
                    border: '1px solid #21262d',
                    borderRadius: '6px',
                  }}>
                    <div style={{ color: '#888', fontSize: '11px', marginBottom: '4px' }}>
                      🤖 Bot Token {telegramBotTokens.length > 1 ? `#${i + 1}` : ''}
                    </div>
                    <div style={{
                      color: '#3fb950',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      wordBreak: 'break-all',
                    }}>
                      {token}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {kakaoSetup && (
              <div style={{
                backgroundColor: '#161b22',
                border: '1px solid #30363d',
                borderRadius: '8px',
                padding: '14px 18px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '20px' }}>💬</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>KakaoTalk</div>
                    <div style={{ color: '#888', fontSize: '13px' }}>Channel + Chatbot deployed</div>
                  </div>
                </div>
                {kakaoSearchId && (
                  <div style={{
                    marginTop: '8px',
                    padding: '8px 10px',
                    backgroundColor: '#0d1117',
                    border: '1px solid #21262d',
                    borderRadius: '6px',
                  }}>
                    <div style={{ color: '#888', fontSize: '11px', marginBottom: '4px' }}>📢 Channel ID</div>
                    <div style={{ color: '#fbbf24', fontSize: '12px', fontFamily: 'monospace' }}>
                      @{kakaoSearchId}
                    </div>
                  </div>
                )}
                {kakaoChannelUrl && (
                  <div style={{
                    marginTop: '8px',
                    padding: '8px 10px',
                    backgroundColor: '#0d1117',
                    border: '1px solid #21262d',
                    borderRadius: '6px',
                  }}>
                    <div style={{ color: '#888', fontSize: '11px', marginBottom: '4px' }}>🔗 채널 URL</div>
                    <div style={{ color: '#60a5fa', fontSize: '12px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                      {kakaoChannelUrl}
                    </div>
                  </div>
                )}
                {kakaoBotName && (
                  <div style={{
                    marginTop: '8px',
                    padding: '8px 10px',
                    backgroundColor: '#0d1117',
                    border: '1px solid #21262d',
                    borderRadius: '6px',
                  }}>
                    <div style={{ color: '#888', fontSize: '11px', marginBottom: '4px' }}>🤖 Bot Name</div>
                    <div style={{ color: '#3fb950', fontSize: '12px', fontFamily: 'monospace' }}>
                      {kakaoBotName}
                    </div>
                  </div>
                )}
              </div>
            )}

            {openclawInstalled && (
              <div style={{
                backgroundColor: '#161b22',
                border: '1px solid #30363d',
                borderRadius: '8px',
                padding: '14px 18px',
                marginBottom: '10px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '20px' }}>⚙️</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>OpenClaw</div>
                    <div style={{ color: '#888', fontSize: '12px' }}>~/.openclaw/openclaw.json configured</div>
                  </div>
                </div>
                {openclawPairingCode && (
                  <div style={{
                    marginTop: '8px',
                    padding: '8px 10px',
                    backgroundColor: '#0d1117',
                    border: '1px solid #21262d',
                    borderRadius: '6px',
                  }}>
                    <div style={{ color: '#888', fontSize: '11px', marginBottom: '4px' }}>🔗 Telegram pairing approved</div>
                    <div style={{ color: '#3fb950', fontSize: '12px', fontFamily: 'monospace' }}>
                      {openclawPairingCode}
                    </div>
                  </div>
                )}
                {openclawStatus && (
                  <div style={{
                    marginTop: '8px',
                    color: '#888',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>
                    {openclawStatus}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Gateway status card ── */}
          <div style={{
            backgroundColor: '#161b22',
            border: `1px solid ${gatewayRunning ? '#1a5a3a' : '#30363d'}`,
            borderRadius: '8px',
            padding: '14px 18px',
            marginBottom: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '20px' }}>🦀</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>OpenClaw Gateway</div>
                  <div style={{ fontSize: '12px', marginTop: '2px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ color: localServerRunning ? '#4ade80' : '#666' }}>
                      {localServerRunning ? '● Server' : '○ Server'}
                    </span>
                    <span style={{ color: tunnelRunning ? '#4ade80' : '#666' }}>
                      {tunnelRunning ? '● Tunnel' : '○ Tunnel'}
                    </span>
                    <span style={{ color: gatewayRunning ? '#4ade80' : '#666' }}>
                      {gatewayRunning ? '● Gateway' : '○ Gateway'}
                    </span>
                    <span style={{ color: telegramConnected ? '#4ade80' : '#666' }}>
                      {telegramConnected ? '✓ Telegram' : '✗ Telegram'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={gatewayRunning ? handleStopGateway : handleStartGateway}
                disabled={isTogglingGateway}
                style={{
                  padding: '6px 16px',
                  backgroundColor: gatewayRunning ? '#3a1a1a' : '#0a3a2a',
                  color: isTogglingGateway ? '#666' : (gatewayRunning ? '#f87171' : '#4ade80'),
                  border: `1px solid ${gatewayRunning ? '#5a2a2a' : '#1a5a3a'}`,
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isTogglingGateway ? 'not-allowed' : 'pointer',
                  flexShrink: 0,
                }}
              >
                {isTogglingGateway ? '⏳' : (gatewayRunning ? 'Stop' : 'Start')}
              </button>
            </div>
            {gatewayStatusText && (
              <div style={{
                marginTop: '10px',
                color: '#666',
                fontSize: '11px',
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {gatewayStatusText}
              </div>
            )}
            {tunnelUrl && (
              <div style={{ marginTop: '10px', borderTop: '1px solid #21262d', paddingTop: '10px' }}>
                <div style={{ color: '#666', fontSize: '11px', marginBottom: '4px' }}>💬 KakaoTalk skill endpoint</div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '6px 10px',
                  backgroundColor: '#0d1117',
                  border: '1px solid #21262d',
                  borderRadius: '6px',
                }}>
                  <div style={{ color: '#60a5fa', fontSize: '11px', fontFamily: 'monospace', flex: 1, wordBreak: 'break-all' }}>
                    {tunnelUrl}/kakao/skill
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(`${tunnelUrl}/kakao/skill`)}
                    style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '11px', padding: '0 4px', flexShrink: 0 }}
                    title="Copy"
                  >📋</button>
                </div>
              </div>
            )}
          </div>

          {error && (
            <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '12px' }}>{error}</p>
          )}

          {createdAccounts.length > 0 && !githubTokens[createdAccounts[createdAccounts.length - 1]] && (
            <button
              onClick={handleRegenerateToken}
              style={{
                padding: '10px 24px',
                backgroundColor: '#1f6feb',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                marginBottom: '10px',
                marginRight: '8px',
              }}
            >
              🔑 Generate Token
            </button>
          )}

          <button
            onClick={retryOpenclawSetup}
            disabled={isRetryingSetup}
            style={{
              padding: '10px 24px',
              backgroundColor: isRetryingSetup ? '#1a2a3a' : '#0d2137',
              color: isRetryingSetup ? '#666' : '#93c5fd',
              border: '1px solid #1e3a5f',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: isRetryingSetup ? 'not-allowed' : 'pointer',
              marginBottom: '10px',
              marginRight: '8px',
            }}
          >
            {isRetryingSetup ? '⏳ Setting up…' : '⚙️ Retry OpenClaw Setup'}
          </button>

          <button
            onClick={runPairing}
            disabled={isPairing}
            style={{
              padding: '10px 24px',
              backgroundColor: isPairing ? '#1a3a2a' : '#0a3a2a',
              color: isPairing ? '#666' : '#4ade80',
              border: '1px solid #1a5a3a',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: isPairing ? 'not-allowed' : 'pointer',
              marginBottom: '10px',
              marginRight: '8px',
            }}
          >
            {isPairing ? '⏳ Pairing…' : '🔗 Retry Telegram Pairing'}
          </button>

          <button
            onClick={retryKakaoSetup}
            disabled={isRunningKakao}
            style={{
              padding: '10px 24px',
              backgroundColor: isRunningKakao ? '#1a1a3a' : '#0a1a3a',
              color: isRunningKakao ? '#666' : '#60a5fa',
              border: '1px solid #1a3a6a',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: isRunningKakao ? 'not-allowed' : 'pointer',
              marginBottom: '10px',
              marginRight: '8px',
            }}
          >
            {isRunningKakao ? '⏳ Setting up KakaoTalk…' : '💬 Retry KakaoTalk Setup'}
          </button>

          <button
            onClick={handleReset}
            style={{
              padding: '10px 24px',
              backgroundColor: 'transparent',
              color: '#888',
              border: '1px solid #30363d',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              marginBottom: '10px',
            }}
          >
            🔄 Reset & Start Over
          </button>

          <Console logs={logs} onClear={() => setLogs([])} />
        </div>
      )}

    </div>
  );
};

const Console: React.FC<{ logs: string[]; onClear?: () => void }> = ({ logs, onClear }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (logs.length === 0) return null;
  return (
    <div style={{ marginTop: '28px', textAlign: 'left', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ fontSize: '11px', color: '#666', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          System Logs
        </div>
        {onClear && (
          <button
            onClick={onClear}
            style={{
              background: 'none',
              border: 'none',
              color: '#444',
              fontSize: '10px',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: '0 4px'
            }}
          >
            Clear
          </button>
        )}
      </div>
      <div
        ref={scrollRef}
        style={{
          backgroundColor: '#0a0a0a',
          border: '1px solid #222',
          borderRadius: '6px',
          padding: '12px',
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          fontSize: '11px',
          lineHeight: '1.5',
          color: '#aaa',
          maxHeight: '300px',
          overflowY: 'auto',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
        }}
      >
        {logs.map((log, i) => {
          const isError = log.includes('❌') || log.includes('⚠️') || log.includes('Error:') || log.includes('[CLI Error]');
          const isSuccess = log.includes('✅');
          return (
            <div
              key={i}
              style={{
                marginBottom: '4px',
                color: isError ? '#f87171' : isSuccess ? '#4ade80' : '#aaa',
                borderLeft: isError ? '2px solid #ef4444' : isSuccess ? '2px solid #22c55e' : 'none',
                paddingLeft: isError || isSuccess ? '8px' : '0',
              }}
            >
              {log}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OpenClawPage;
