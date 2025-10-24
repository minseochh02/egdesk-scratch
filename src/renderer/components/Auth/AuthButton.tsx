import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './AuthButton.css';

export default function AuthButton() {
  const { user, loading, signInWithGoogle, signInWithGithub, signOut } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="auth-button auth-loading">
        <div className="loading-spinner"></div>
        <span>Loading...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="auth-button-container">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="auth-button auth-signin"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
            <polyline points="10 17 15 12 10 7"></polyline>
            <line x1="15" y1="12" x2="3" y2="12"></line>
          </svg>
          Sign In
        </button>

        {showMenu && (
          <>
            <div className="menu-backdrop" onClick={() => setShowMenu(false)}></div>
            <div className="auth-menu">
              <button
                onClick={async () => {
                  setSigningIn(true);
                  try {
                    await signInWithGoogle();
                  } catch (error) {
                    console.error('Sign in failed:', error);
                    setSigningIn(false);
                  }
                }}
                disabled={signingIn}
                className="auth-menu-item"
              >
                <svg width="20" height="20" viewBox="0 0 24 24">
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
                Continue with Google
              </button>

              <button
                onClick={async () => {
                  setSigningIn(true);
                  try {
                    await signInWithGithub();
                  } catch (error) {
                    console.error('Sign in failed:', error);
                    setSigningIn(false);
                  }
                }}
                disabled={signingIn}
                className="auth-menu-item"
              >
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                Continue with GitHub
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="auth-button-container">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="auth-button auth-user"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <span className="user-email">{user.email}</span>
      </button>

      {showMenu && (
        <>
          <div className="menu-backdrop" onClick={() => setShowMenu(false)}></div>
          <div className="auth-menu">
            <div className="auth-menu-header">
              <p className="user-email-full">{user.email}</p>
              <p className="user-auth-method">Authenticated via OAuth</p>
            </div>

            <button
              onClick={() => {
                navigate('/profile');
                setShowMenu(false);
              }}
              className="auth-menu-item"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              View Profile
            </button>

            <button
              onClick={async () => {
                await signOut();
                setShowMenu(false);
              }}
              className="auth-menu-item auth-signout"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              Sign Out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

