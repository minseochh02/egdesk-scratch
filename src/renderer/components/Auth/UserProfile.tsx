import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './UserProfile.css';

export default function UserProfile() {
  const { user, session, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      setSigningOut(true);
      try {
        await signOut();
      } catch (error) {
        console.error('Sign out failed:', error);
        setSigningOut(false);
      }
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="user-profile-container">
      <div className="user-profile-content">
        {/* Profile Header */}
        <div className="profile-header">
          <div className="profile-avatar">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <h1 className="profile-title">User Profile</h1>
          <p className="profile-subtitle">Manage your account settings</p>
        </div>

        {/* Profile Information Card */}
        <div className="profile-card">
          <h2 className="card-section-title">Account Information</h2>
          
          <div className="profile-info-grid">
            <div className="profile-info-item">
              <label className="profile-info-label">Email</label>
              <div className="profile-info-value">{user.email}</div>
            </div>

            <div className="profile-info-item">
              <label className="profile-info-label">User ID</label>
              <div className="profile-info-value profile-info-code">{user.id}</div>
            </div>

            <div className="profile-info-item">
              <label className="profile-info-label">Authentication Method</label>
              <div className="profile-info-value">
                <span className="auth-badge">OAuth 2.0</span>
              </div>
            </div>

            {user.user_metadata?.provider && (
              <div className="profile-info-item">
                <label className="profile-info-label">Provider</label>
                <div className="profile-info-value">
                  <span className="provider-badge">
                    {user.user_metadata.provider === 'google' ? (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24">
                          <path
                            fill="currentColor"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="currentColor"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                        </svg>
                        Google
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                        </svg>
                        GitHub
                      </>
                    )}
                  </span>
                </div>
              </div>
            )}

            {session?.expires_at && (
              <div className="profile-info-item">
                <label className="profile-info-label">Session Expires</label>
                <div className="profile-info-value">
                  {new Date(session.expires_at * 1000).toLocaleString()}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Session Information */}
        <div className="profile-card">
          <h2 className="card-section-title">Session Details</h2>
          
          <div className="session-status">
            <div className="status-indicator status-active"></div>
            <span>Active Session</span>
          </div>

          <p className="session-info">
            Your session is securely stored and encrypted on this device. 
            It will automatically refresh when needed.
          </p>
        </div>

        {/* Sign Out Section */}
        <div className="profile-card signout-card">
          <h2 className="card-section-title">Account Actions</h2>
          
          <div className="signout-section">
            <div className="signout-info">
              <h3 className="signout-title">Sign Out</h3>
              <p className="signout-description">
                Sign out of your account on this device. You'll need to sign in again to access the application.
              </p>
            </div>
            
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="signout-button"
            >
              {signingOut ? (
                <>
                  <div className="button-spinner"></div>
                  <span>Signing Out...</span>
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                  <span>Sign Out</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

