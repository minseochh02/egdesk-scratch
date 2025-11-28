import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './SignInPage.css';

export default function SignInPage() {
  const { signInWithGoogle, signInWithGithub, switchAccount } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [provider, setProvider] = useState<'google' | 'github' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [availableAccounts, setAvailableAccounts] = useState<any[]>([]);

  useEffect(() => {
    window.electron.auth.getAllAccounts().then((result: any) => {
      if (result.success && result.accounts) {
        setAvailableAccounts(result.accounts);
      }
    });
  }, []);

  const handleAccountSwitch = async (userId: string) => {
    setSigningIn(true);
    setError(null);
    try {
      await switchAccount(userId);
    } catch (err: any) {
      console.error('Account switch failed:', err);
      setError(err.message || 'Failed to switch account');
      setSigningIn(false);
    }
  };

  const handleSignIn = async (signInMethod: (scopes?: string) => Promise<void>, providerName: 'google' | 'github') => {
    setSigningIn(true);
    setProvider(providerName);
    setError(null);
    
    try {
      if (providerName === 'google') {
        // Request full scopes for Google to ensure Apps Script and Drive features work
        const scopes = [
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile',
          'openid',
          'https://www.googleapis.com/auth/script.projects',
          'https://www.googleapis.com/auth/script.projects.readonly',
          'https://www.googleapis.com/auth/script.scriptapp',
          'https://www.googleapis.com/auth/script.send_mail',
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive',
        ].join(' ');
        await signInMethod(scopes);
      } else {
        await signInMethod();
      }
      // The auth state will be updated when the OAuth callback is received
    } catch (err: any) {
      console.error('Sign in failed:', err);
      setError(err.message || 'Sign in failed. Please try again.');
      setSigningIn(false);
      setProvider(null);
    }
  };

  return (
    <div className="signin-container">
      <div className="signin-content">
        {/* Logo/Header */}
        <div className="signin-header">
          <div className="signin-logo">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="12" fill="url(#gradient)" />
              <path
                d="M24 14L24 34M14 24L34 24"
                stroke="white"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="gradient" x1="0" y1="0" x2="48" y2="48">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className="signin-title">EGDesk</h1>
          <p className="signin-subtitle">
            Sign in to access your workspace
          </p>
        </div>

        {/* Sign In Card */}
        <div className="signin-card">
          <h2 className="card-title">
            {availableAccounts.length > 0 ? 'Welcome back' : 'Sign in to continue'}
          </h2>
          <p className="card-subtitle">
            {availableAccounts.length > 0 ? 'Choose an account to continue' : 'Choose your preferred authentication method'}
          </p>

          {availableAccounts.length > 0 && (
            <div className="available-accounts">
              <div className="accounts-list">
                {availableAccounts.map((account) => (
                  <button
                    key={account.userId}
                    className="account-item"
                    onClick={() => handleAccountSwitch(account.userId)}
                    disabled={signingIn}
                  >
                    <div className="account-avatar">
                      {account.user.user_metadata?.avatar_url ? (
                        <img src={account.user.user_metadata.avatar_url} alt="Avatar" />
                      ) : (
                        <div className="avatar-placeholder">
                          {account.email?.[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="account-info">
                      <div className="account-email">{account.email}</div>
                      <div className="account-provider">
                        {account.user.app_metadata?.provider || 'Email'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="divider">
                <div className="divider-line"></div>
                <div className="divider-text">Or add another account</div>
              </div>
            </div>
          )}

          {error && (
            <div className="signin-error">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* OAuth Buttons */}
          <div className="oauth-buttons">
            <button
              onClick={() => handleSignIn(signInWithGoogle, 'google')}
              disabled={signingIn}
              className="oauth-button oauth-button-google"
            >
              {signingIn && provider === 'google' ? (
                <>
                  <div className="spinner"></div>
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <svg className="oauth-icon" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>

            <button
              onClick={() => handleSignIn(signInWithGithub, 'github')}
              disabled={signingIn}
              className="oauth-button oauth-button-github"
            >
              {signingIn && provider === 'github' ? (
                <>
                  <div className="spinner"></div>
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <svg className="oauth-icon" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  <span>Continue with GitHub</span>
                </>
              )}
            </button>
          </div>

          {/* Divider */}
          <div className="divider">
            <div className="divider-line"></div>
            <div className="divider-text">Why sign in?</div>
          </div>

          {/* Features */}
          <div className="features">
            <div className="feature">
              <div className="feature-icon feature-icon-blue">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <div>
                <h3 className="feature-title">Secure Access</h3>
                <p className="feature-description">
                  OAuth-based authentication ensures secure connections
                </p>
              </div>
            </div>

            <div className="feature">
              <div className="feature-icon feature-icon-purple">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
              </div>
              <div>
                <h3 className="feature-title">Email Verification</h3>
                <p className="feature-description">
                  Access is granted based on your verified email
                </p>
              </div>
            </div>

            <div className="feature">
              <div className="feature-icon feature-icon-green">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
              </div>
              <div>
                <h3 className="feature-title">Instant Access</h3>
                <p className="feature-description">
                  Connect to your workspace immediately after sign in
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="signin-footer">
          <p className="footer-text">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}

