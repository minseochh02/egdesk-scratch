import React, { useState, useEffect } from 'react';
import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faSpinner,
  faCheckCircle,
  faExclamationTriangle,
  faTimes
} from '../../utils/fontAwesomeIcons';
import './GoogleOAuthSignIn.css';

interface GoogleOAuthSignInProps {
  onSignInSuccess?: (user: User, session: Session) => void;
  onSignInError?: (error: Error) => void;
  className?: string;
}

interface SupabaseConfig {
  url: string | null;
  anonKey: string | null;
}

const GoogleOAuthSignIn: React.FC<GoogleOAuthSignInProps> = ({
  onSignInSuccess,
  onSignInError,
  className = ''
}) => {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [signingIn, setSigningIn] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [availableAccounts, setAvailableAccounts] = useState<Array<{ userId: string; email: string; user: User }>>([]);
  const [loadingAccounts, setLoadingAccounts] = useState<boolean>(false);
  const [config, setConfig] = useState<SupabaseConfig>({
    url: null,
    anonKey: null
  });

  // Load Supabase configuration
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const result = await window.electron.env.checkConfig();
        if (result.success && result.supabaseUrl && result.supabaseAnonKey) {
          setConfig({
            url: result.supabaseUrl,
            anonKey: result.supabaseAnonKey
          });
          
          // Initialize Supabase client
          const client = createClient(result.supabaseUrl, result.supabaseAnonKey, {
            auth: {
              autoRefreshToken: true,
              persistSession: true,
              detectSessionInUrl: true,
            },
          });
          
          setSupabase(client);
          
          // Check for existing session but don't auto-sign in
          // This allows users to choose which account to use
          const { data: { session: existingSession }, error: sessionError } = await client.auth.getSession();
          
          if (sessionError) {
            console.error('Error getting session:', sessionError);
            setError(sessionError.message);
          } else if (existingSession) {
            // Store the existing session but don't auto-sign in
            // User can choose to use this account or sign in with a different one
            setSession(existingSession);
            setUser(existingSession.user);
            // Don't call onSignInSuccess automatically - let user choose
            console.log('Found existing session for:', existingSession.user.email, '- user can choose to use it or sign in with different account');
          }
        } else {
          setError('Supabase configuration not found. Please configure SUPABASE_URL and SUPABASE_ANON_KEY in your .env file.');
        }
      } catch (err) {
        console.error('Error loading Supabase config:', err);
        setError(err instanceof Error ? err.message : 'Failed to load Supabase configuration');
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [onSignInSuccess]);

  // Load available accounts
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        setLoadingAccounts(true);
        const result = await window.electron.auth.getAllAccounts();
        if (result.success && result.accounts) {
          setAvailableAccounts(result.accounts);
        }
      } catch (err) {
        console.error('Error loading accounts:', err);
      } finally {
        setLoadingAccounts(false);
      }
    };

    if (supabase) {
      loadAccounts();
    }
  }, [supabase]);

  // Check for OAuth callback in URL hash (fallback)
  useEffect(() => {
    if (!supabase || !signingIn) return;

    // Check if there's a hash in the URL that might contain OAuth tokens
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      console.log('Found OAuth tokens in URL hash, refreshing session...');
      
      // Supabase should automatically detect this, but let's manually refresh
      setTimeout(async () => {
        const { data: { session: newSession }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Error getting session from hash:', sessionError);
        } else if (newSession) {
          setSession(newSession);
          setUser(newSession.user);
          setSigningIn(false);
          setError(null);
          onSignInSuccess?.(newSession.user, newSession);
          
          // Clear the hash from URL
          window.history.replaceState(null, '', window.location.pathname);
        }
      }, 500);
    }
  }, [supabase, signingIn, onSignInSuccess]);

  // Listen for auth state changes from Supabase
  useEffect(() => {
    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('Auth state changed:', event, newSession);
      
      if (event === 'SIGNED_IN' && newSession) {
        setSession(newSession);
        setUser(newSession.user);
        setSigningIn(false);
        setError(null);
        onSignInSuccess?.(newSession.user, newSession);
        
        // Reload accounts list after successful sign-in
        window.electron.auth.getAllAccounts().then((result) => {
          if (result.success && result.accounts) {
            setAvailableAccounts(result.accounts);
          }
        });
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
      } else if (event === 'TOKEN_REFRESHED' && newSession) {
        setSession(newSession);
        // When token is refreshed, save it to electron-store via main process
        // This ensures the google_workspace_token is updated with the refreshed token
        if (newSession.user) {
          const isGoogleAuth = 
            newSession.user.app_metadata?.provider === 'google' ||
            newSession.user.identities?.some((id: any) => id.provider === 'google');
          
          if (isGoogleAuth) {
            // Save refreshed session to electron-store
            try {
              if (window.electron.auth.saveSession) {
                await window.electron.auth.saveSession(newSession);
                console.log('✅ Refreshed session saved to electron-store');
              }
            } catch (error) {
              console.error('❌ Error saving refreshed session:', error);
            }
          }
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, onSignInSuccess]);

  // Listen for auth state changes from Electron IPC (OAuth callback)
  useEffect(() => {
    if (!supabase) return;

    const unsubscribe = window.electron.auth.onAuthStateChanged(async (data) => {
      console.log('Electron auth state changed:', data);
      
      if (data.success && data.session) {
        // Refresh the Supabase session to get the latest data
        try {
          const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.getSession();
          
          if (refreshError) {
            console.error('Error refreshing session:', refreshError);
            setError(refreshError.message);
          } else if (refreshedSession) {
            setSession(refreshedSession);
            setUser(refreshedSession.user);
            setSigningIn(false);
            setError(null);
            onSignInSuccess?.(refreshedSession.user, refreshedSession);
          }
        } catch (err) {
          console.error('Error handling auth state change:', err);
          setError(err instanceof Error ? err.message : 'Failed to refresh session');
          setSigningIn(false);
        }
      } else if (!data.success) {
        setSigningIn(false);
        setError('Authentication failed');
      }
    });

    return () => {
      unsubscribe();
    };
  }, [supabase, onSignInSuccess]);

  const handleSignInWithGoogle = async () => {
    try {
      setSigningIn(true);
      setError(null);

      // Sign in with Google OAuth using Electron IPC
      // This will open a new window for OAuth flow
      const scopes = [
        // Basic auth scopes (required for OAuth)
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'openid',
        // Apps Script scopes
        'https://www.googleapis.com/auth/script.projects',
        'https://www.googleapis.com/auth/script.projects.readonly',
        'https://www.googleapis.com/auth/script.scriptapp',
        'https://www.googleapis.com/auth/script.send_mail',
        'https://www.googleapis.com/auth/script.deployments', // Required for listing/creating/updating web app deployments
        // Google Sheets and Drive scopes (required for template copying)
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
      ].join(' ');

      const result = await window.electron.auth.signInWithGoogle(scopes);

      if (!result.success) {
        throw new Error(result.error || 'Failed to sign in with Google');
      }

      console.log('OAuth flow initiated, waiting for callback...');
      // The OAuth window will open, and the callback will be handled by the main process
      // The auth state change listener will handle the session update when the callback is processed
    } catch (err) {
      console.error('Error signing in with Google:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign in with Google';
      setError(errorMessage);
      setSigningIn(false);
      onSignInError?.(err instanceof Error ? err : new Error(errorMessage));
    }
  };

  const handleSignOut = async (userId?: string) => {
    if (!supabase) {
      return;
    }

    try {
      setSigningIn(true);
      
      // Sign out specific account or current session
      const result = await window.electron.auth.signOut(userId);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to sign out');
      }
      
      // Reload accounts list
      const accountsResult = await window.electron.auth.getAllAccounts();
      if (accountsResult.success && accountsResult.accounts) {
        setAvailableAccounts(accountsResult.accounts);
      }
      
      // If signing out current session, clear local state
      if (!userId) {
        setSession(null);
        setUser(null);
      }
      
      setSigningIn(false);
    } catch (err) {
      console.error('Error signing out:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign out');
      setSigningIn(false);
    }
  };

  const handleSwitchAccount = async (userId: string) => {
    try {
      setSigningIn(true);
      setError(null);
      
      const result = await window.electron.auth.switchAccount(userId);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to switch account');
      }
      
      if (result.session) {
        setSession(result.session);
        setUser(result.session.user);
        onSignInSuccess?.(result.session.user, result.session);
      }
      
      setSigningIn(false);
    } catch (err) {
      console.error('Error switching account:', err);
      setError(err instanceof Error ? err.message : 'Failed to switch account');
      setSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className={`google-oauth-signin ${className}`}>
        <div className="google-oauth-loading">
          <FontAwesomeIcon icon={faSpinner} spin />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (error && !config.url) {
    return (
      <div className={`google-oauth-signin ${className}`}>
        <div className="google-oauth-error">
          <FontAwesomeIcon icon={faExclamationTriangle} />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`google-oauth-signin ${className}`}>
      {user && session ? (
        <div className="google-oauth-signed-in">
          <div className="google-oauth-user-info">
            <div className="google-oauth-avatar">
              {user.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt={user.email || 'User'} />
              ) : (
                <div className="google-oauth-avatar-placeholder">
                  {user.email?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
            </div>
            <div className="google-oauth-user-details">
              <div className="google-oauth-user-name">
                {user.user_metadata?.full_name || user.user_metadata?.name || user.email}
              </div>
              <div className="google-oauth-user-email">{user.email}</div>
            </div>
          </div>
          <div className="google-oauth-status">
            <FontAwesomeIcon icon={faCheckCircle} className="google-oauth-status-icon" />
            <span>Signed in</span>
          </div>
          <button
            className="google-oauth-sign-out-btn"
            onClick={() => handleSignOut()}
            disabled={signingIn}
          >
            <FontAwesomeIcon icon={faTimes} />
            <span>Sign Out</span>
          </button>
        </div>
      ) : (
        <div className="google-oauth-sign-in-container">
          {error && (
            <div className="google-oauth-error">
              <FontAwesomeIcon icon={faExclamationTriangle} />
              <span>{error}</span>
            </div>
          )}
          
          {/* Show available accounts if any */}
          {availableAccounts.length > 0 && (
            <div className="google-oauth-accounts-list">
              <p className="google-oauth-accounts-title">Available Accounts:</p>
              {availableAccounts.map((account) => (
                <div key={account.userId} className="google-oauth-account-item">
                  <div className="google-oauth-account-info">
                    <span className="google-oauth-account-email">{account.email}</span>
                    {session?.user?.id === account.userId && (
                      <span className="google-oauth-account-active">(Active)</span>
                    )}
                  </div>
                  <div className="google-oauth-account-actions">
                    {session?.user?.id !== account.userId ? (
                      <button
                        className="google-oauth-switch-btn"
                        onClick={() => handleSwitchAccount(account.userId)}
                        disabled={signingIn}
                      >
                        Use This Account
                      </button>
                    ) : null}
                    <button
                      className="google-oauth-remove-btn"
                      onClick={() => handleSignOut(account.userId)}
                      disabled={signingIn}
                      title="Remove this account"
                    >
                      <FontAwesomeIcon icon={faTimes} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <button
            className="google-oauth-sign-in-btn"
            onClick={handleSignInWithGoogle}
            disabled={signingIn || !supabase}
          >
            {signingIn ? (
              <>
                <FontAwesomeIcon icon={faSpinner} spin />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span className="google-icon">G</span>
                <span>Sign in with Google {availableAccounts.length > 0 ? '(Add Account)' : ''}</span>
              </>
            )}
          </button>
          <div className="google-oauth-scopes">
            <p className="google-oauth-scopes-title">This will request access to:</p>
            <ul className="google-oauth-scopes-list">
              <li>Your email address and profile information</li>
              <li>Google Apps Script (create, update, and run scripts)</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoogleOAuthSignIn;

