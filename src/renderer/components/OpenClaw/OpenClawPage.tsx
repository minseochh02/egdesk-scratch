import React, { useState, useEffect, useRef } from 'react';

const PROFILE_NAME = 'openclaw-default';

type Step =
  | 'welcome'      // Title + Get Started
  | 'logging-in'   // Chrome open, waiting for Google login
  | 'creating'     // Running GitHub signup automation
  | 'token'        // Generating GitHub token
  | 'telegram'     // Telegram login + BotFather setup
  | 'installing'   // OpenClaw CLI + config
  | 'done';        // Accounts dashboard

function cleanGmailToUsername(email: string): string {
  // quus.aispace@gmail.com → egdesk-quusaispace
  const local = email.split('@')[0];
  const cleaned = local.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return `egdesk-${cleaned}`;
}

const OpenClawPage: React.FC = () => {
  const [step, setStep] = useState<Step>('welcome');
  const [googleEmail, setGoogleEmail] = useState('');
  const [googlePhone, setGooglePhone] = useState('');
  const googlePhoneRef = useRef('');
  const [githubUsername, setGithubUsername] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [createdAccounts, setCreatedAccounts] = useState<string[]>([]);
  const [githubTokens, setGithubTokens] = useState<Record<string, string>>({});
  const [telegramBotTokens, setTelegramBotTokens] = useState<string[]>([]);
  const [telegramSetup, setTelegramSetup] = useState(false);
  const [openclawInstalled, setOpenclawInstalled] = useState(false);
  const [openclawStatus, setOpenclawStatus] = useState('');
  const [openclawPairingCode, setOpenclawPairingCode] = useState('');
  const [error, setError] = useState('');

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
    await runOpenclawSetup(tokenForOpenClaw);
  };

  const handleGetStarted = async () => {
    setError('');
    setLogs([]);
    setStep('logging-in');
    addLog('Opening Chrome — log in with your Google account, then close the window.');

    try {
      const result = await (window as any).electron.debug.googleProfile.launch(PROFILE_NAME);
      if (!result?.success) {
        setError(result?.error || 'Failed to launch Chrome.');
        setStep('welcome');
        return;
      }

      // Chrome closed — detect the Gmail used
      addLog('Login saved. Detecting Google account…');
      const emailResult = await (window as any).electron.debug.googleProfile.getEmail(PROFILE_NAME);
      const email: string = emailResult?.email || '';
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
  const [gatewayRunning, setGatewayRunning] = useState(false);
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [gatewayStatusText, setGatewayStatusText] = useState('');
  const [isTogglingGateway, setIsTogglingGateway] = useState(false);

  const refreshStatus = async () => {
    try {
      const result = await (window as any).electron.debug.openclaw.status();
      setGatewayRunning(result?.running ?? false);
      setTelegramConnected(result?.connected ?? false);
      setGatewayStatusText(result?.statusOutput ?? '');
    } catch { /* non-fatal */ }
  };

  // Poll status every 10s when on the done screen
  useEffect(() => {
    if (step !== 'done') return;
    refreshStatus();
    const interval = setInterval(refreshStatus, 10_000);
    return () => clearInterval(interval);
  }, [step]);

  const handleStartGateway = async () => {
    setIsTogglingGateway(true);
    addLog('Starting OpenClaw gateway…');
    try {
      await (window as any).electron.debug.openclaw.start();
      addLog('✅ Gateway started.');
      // Optimistically mark running; then poll until status confirms or gives up
      setGatewayRunning(true);
      for (let i = 0; i < 5; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const s = await (window as any).electron.debug.openclaw.status();
        setGatewayRunning(s?.running ?? true);
        setTelegramConnected(s?.connected ?? false);
        setGatewayStatusText(s?.statusOutput ?? '');
        if (s?.running) break;
      }
    } catch (e: any) {
      addLog(`⚠️ Start failed: ${e?.message || e}`);
      await refreshStatus();
    }
    setIsTogglingGateway(false);
  };

  const handleStopGateway = async () => {
    setIsTogglingGateway(true);
    addLog('Stopping OpenClaw gateway…');
    try {
      await (window as any).electron.debug.openclaw.stop();
      addLog('✅ Gateway stopped.');
    } catch (e: any) {
      addLog(`⚠️ Stop failed: ${e?.message || e}`);
    }
    await refreshStatus();
    setIsTogglingGateway(false);
  };

  const runPairing = async () => {
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
    }
    setIsPairing(false);
  };

  const handleReset = () => {
    setStep('welcome');
    setGoogleEmail('');
    setGooglePhone('');
    googlePhoneRef.current = '';
    setGithubUsername('');
    setLogs([]);
    setCreatedAccounts([]);
    setGithubTokens({});
    setTelegramBotTokens([]);
    setTelegramSetup(false);
    setOpenclawInstalled(false);
    setOpenclawStatus('');
    setOpenclawPairingCode('');
    setIsPairing(false);
    setGatewayRunning(false);
    setTelegramConnected(false);
    setGatewayStatusText('');
    setIsTogglingGateway(false);
    setError('');
  };

  return (
    <div style={{
      minHeight: '100%',
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
          <p style={{ color: '#888', fontSize: '14px', marginBottom: '32px', lineHeight: 1.6 }}>
            Chrome is open. Sign in with your Google account, then{' '}
            <strong style={{ color: '#ccc' }}>close the window</strong> when done.
          </p>
          <div style={{ color: '#888', fontSize: '13px' }}>⏳ Waiting for Chrome to close…</div>
          <Console logs={logs} />
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
            <p style={{ color: '#888', fontSize: '13px', marginBottom: '24px' }}>
              GitHub: <span style={{ color: '#58a6ff', fontFamily: 'monospace' }}>{githubUsername}</span>
            </p>
          )}
          <p style={{ color: '#666', fontSize: '13px', lineHeight: 1.6 }}>
            Opening GitHub Developer Settings to generate a personal access token.
            This may take a moment — please don't close the browser.
          </p>
          <Console logs={logs} />
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
          <Console logs={logs} />
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
          <Console logs={logs} />
        </div>
      )}

      {/* ── TELEGRAM ── */}
      {step === 'telegram' && (
        <div style={{ textAlign: 'center', maxWidth: '480px' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>✈️</div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Setting Up Telegram</h2>
          {googlePhone && (
            <p style={{ color: '#888', fontSize: '13px', marginBottom: '24px' }}>
              Phone: <span style={{ color: '#fff', fontFamily: 'monospace' }}>{googlePhone}</span>
            </p>
          )}
          <p style={{ color: '#666', fontSize: '13px', lineHeight: 1.6 }}>
            Enter the verification code sent to your phone, then the browser will
            automatically open BotFather and create your bot.
          </p>
          <Console logs={logs} />
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
                  <div style={{ fontSize: '12px', marginTop: '2px' }}>
                    <span style={{
                      color: gatewayRunning ? '#4ade80' : '#666',
                      marginRight: '10px',
                    }}>
                      {gatewayRunning ? '● Running' : '○ Stopped'}
                    </span>
                    <span style={{ color: telegramConnected ? '#4ade80' : '#666' }}>
                      {telegramConnected ? '✓ Telegram connected' : '✗ Telegram not connected'}
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

          <Console logs={logs} />
        </div>
      )}

    </div>
  );
};

const Console: React.FC<{ logs: string[] }> = ({ logs }) => {
  if (logs.length === 0) return null;
  return (
    <div style={{ marginTop: '28px', textAlign: 'left' }}>
      <div style={{
        backgroundColor: '#111',
        border: '1px solid #333',
        borderRadius: '6px',
        padding: '10px',
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#ccc',
        maxHeight: '160px',
        overflowY: 'auto',
      }}>
        {logs.map((log, i) => (
          <div key={i} style={{ marginBottom: '3px' }}>{log}</div>
        ))}
      </div>
    </div>
  );
};

export default OpenClawPage;
