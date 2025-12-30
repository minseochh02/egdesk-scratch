import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBuilding,
  faUsers,
  faUser,
  faEnvelope,
  faCalendarAlt,
  faFile,
  faCloud,
  faCog,
  faArrowRight,
  faSpinner,
  faCircleCheck,
  faCircleXmark,
  faPlus,
  faSearch,
  faRefresh,
  faCheckCircle,
  faClock,
} from '../../utils/fontAwesomeIcons';
import './GoogleWorkspaceManager.css';

interface WorkspaceUser {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  isSuspended: boolean;
  lastLoginTime?: string;
}

interface WorkspaceConnection {
  id: string;
  name: string;
  domain: string;
  adminEmail: string;
  createdAt: string;
  updatedAt: string;
  status: 'online' | 'offline' | 'error' | 'checking';
}

interface GoogleWorkspaceToken {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  scopes?: string[];
  saved_at?: number;
  supabase_session?: boolean;
  user_id?: string;
}

const GoogleWorkspaceManager: React.FC = () => {
  const [connections, setConnections] = useState<WorkspaceConnection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<WorkspaceConnection | null>(null);
  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentView, setCurrentView] = useState<'overview' | 'users' | 'settings'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [googleToken, setGoogleToken] = useState<GoogleWorkspaceToken | null>(null);
  const [isCheckingToken, setIsCheckingToken] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);
  const [chromeProfiles, setChromeProfiles] = useState<Array<{ name: string; path: string; email?: string; directoryName: string }>>([]);
  const [selectedChromeProfile, setSelectedChromeProfile] = useState<string | null>(null);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);
  const [isTestingChrome, setIsTestingChrome] = useState(false);

  useEffect(() => {
    loadConnections();
    checkGoogleToken();
    loadChromeProfiles();
    
    // Load saved Chrome profile preference
    const loadSavedProfile = async () => {
      try {
        if (window.electron?.store?.get) {
          const savedProfile = await window.electron.store.get('google-workspace-chrome-profile');
          if (savedProfile) {
            setSelectedChromeProfile(savedProfile);
          }
        } else {
          // Fallback to localStorage
          const savedProfile = localStorage.getItem('google-workspace-chrome-profile');
          if (savedProfile) {
            setSelectedChromeProfile(savedProfile);
          }
        }
      } catch (error) {
        console.warn('Failed to load saved Chrome profile:', error);
      }
    };
    loadSavedProfile();
    
    // Listen for auth state changes to refresh token status
    if (window.electron?.auth?.onAuthStateChanged) {
      const unsubscribe = window.electron.auth.onAuthStateChanged((data) => {
        if (data.success && data.hasSession) {
          checkGoogleToken();
        } else {
          setGoogleToken(null);
        }
      });
      
      return () => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      };
    }
  }, []);

  const loadChromeProfiles = async () => {
    setIsLoadingProfiles(true);
    try {
      if (window.electron?.businessCard?.listChromeProfiles) {
        const result = await window.electron.businessCard.listChromeProfiles();
        if (result.success && result.profiles) {
          setChromeProfiles(result.profiles);
        }
      }
    } catch (error) {
      console.error('Failed to load Chrome profiles:', error);
    } finally {
      setIsLoadingProfiles(false);
    }
  };

  const handleTestOpenChrome = async () => {
    setIsTestingChrome(true);
    try {
      if (!window.electron?.businessCard?.testOpenChrome) {
        throw new Error('Test Chrome API not available');
      }

      const result = await window.electron.businessCard.testOpenChrome(selectedChromeProfile || undefined);
      
      if (result.success) {
        alert(`✅ ${result.message || 'Chrome opened successfully!'}`);
      } else {
        alert(`❌ Failed to open Chrome: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Failed to test open Chrome:', error);
      alert(`❌ Error: ${error.message || 'Failed to open Chrome'}`);
    } finally {
      setIsTestingChrome(false);
    }
  };

  const handleChromeProfileChange = async (profilePath: string) => {
    console.log('🔄 Chrome profile selection changed:', profilePath || '(auto-detect)');
    setSelectedChromeProfile(profilePath || null);
    if (profilePath) {
      // Save to electron-store (preferred)
      if (window.electron?.store?.set) {
        try {
          await window.electron.store.set('google-workspace-chrome-profile', profilePath);
          console.log('✅ Saved Chrome profile to electron-store:', profilePath);
          
          // Verify it was saved
          const verify = await window.electron.store.get('google-workspace-chrome-profile');
          console.log('🔍 Verified saved profile:', verify);
        } catch (error) {
          console.error('❌ Failed to save Chrome profile to electron-store:', error);
          // Fallback to localStorage
          localStorage.setItem('google-workspace-chrome-profile', profilePath);
        }
      } else {
        // Fallback to localStorage
        console.log('⚠️  electron.store not available, using localStorage');
        localStorage.setItem('google-workspace-chrome-profile', profilePath);
      }
    } else {
      // Remove from electron-store
      if (window.electron?.store?.delete) {
        try {
          await window.electron.store.delete('google-workspace-chrome-profile');
          console.log('✅ Removed Chrome profile from electron-store');
        } catch (error) {
          console.warn('⚠️  Failed to remove Chrome profile from electron-store:', error);
          localStorage.removeItem('google-workspace-chrome-profile');
        }
      } else {
        localStorage.removeItem('google-workspace-chrome-profile');
      }
    }
  };

  const checkGoogleToken = async () => {
    setIsCheckingToken(true);
    try {
      if (window.electron?.auth?.getGoogleWorkspaceToken) {
        const result = await window.electron.auth.getGoogleWorkspaceToken();
        if (result.success && result.token) {
          setGoogleToken(result.token);
        } else {
          setGoogleToken(null);
        }
      }
    } catch (error) {
      console.error('Failed to check Google token:', error);
      setGoogleToken(null);
    } finally {
      setIsCheckingToken(false);
    }
  };

  const loadConnections = async () => {
    setIsLoading(true);
    try {
      // TODO: Implement actual connection loading from storage
      // For now, using mock data
      const mockConnections: WorkspaceConnection[] = [];
      setConnections(mockConnections);
    } catch (error) {
      console.error('Failed to load connections:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleOAuth = async () => {
    // OAuth scopes for Google Workspace
    const scopes = [
      // Standard scopes
      'https://www.googleapis.com/auth/gmail.addons.current.action.compose',
      'https://www.googleapis.com/auth/gmail.addons.current.message.action',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'openid',
      // Sensitive scopes
      'https://www.googleapis.com/auth/script.projects',
      'https://www.googleapis.com/auth/script.scriptapp',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/script.deployments',
      'https://www.googleapis.com/auth/script.external_request',
      'https://www.googleapis.com/auth/script.webapp.deploy',
      'https://www.googleapis.com/auth/drive.file',
      // Restricted scopes
    ].join(' ');

    // Use Supabase OAuth with custom scopes
    if (window.electron?.auth?.signInWithGoogle) {
      try {
        const result = await window.electron.auth.signInWithGoogle(scopes);
        if (!result.success) {
          console.error('OAuth error:', result.error);
          alert(`Failed to initiate Google OAuth: ${result.error}`);
        } else {
          // Check for token after a short delay to allow OAuth flow to complete
          setTimeout(() => {
            checkGoogleToken();
          }, 2000);
        }
      } catch (error: any) {
        console.error('OAuth error:', error);
        alert(`Failed to initiate Google OAuth: ${error.message}`);
      }
    } else {
      console.error('Supabase auth not available');
      alert('Authentication service not available. Please check your Supabase configuration.');
    }
  };

  const handleSelectConnection = (connection: WorkspaceConnection) => {
    setSelectedConnection(connection);
    loadUsersForConnection(connection.id);
  };

  const loadUsersForConnection = async (connectionId: string) => {
    setIsLoading(true);
    try {
      // TODO: Implement actual user loading
      const mockUsers: WorkspaceUser[] = [];
      setUsers(mockUsers);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTestCreateSpreadsheet = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      if (!window.electron?.businessCard?.createBusinessCardSpreadsheet) {
        throw new Error('Business Card API not available');
      }

      // Create spreadsheet (folder will be created automatically if not provided)
      const sheetName = '명함 정보'; // Default sheet name

      const result = await window.electron.businessCard.createBusinessCardSpreadsheet(
        undefined, // Let it create a folder automatically
        sheetName
      );

      if (result.success && result.spreadsheetUrl) {
        setTestResult({
          success: true,
          message: `Successfully created business card spreadsheet!\nSpreadsheet ID: ${result.spreadsheetId}\nSpreadsheet URL: ${result.spreadsheetUrl}\nScript ID: ${result.scriptId}\nFolder ID: ${result.folderId}\nFolder URL: ${result.folderUrl}`,
        });
        
        // Open the spreadsheet in browser
        if (window.electron?.shell?.openExternal) {
          window.electron.shell.openExternal(result.spreadsheetUrl);
        } else if (result.spreadsheetUrl) {
          window.open(result.spreadsheetUrl, '_blank');
        }
      } else {
        setTestResult({
          success: false,
          error: result.error || 'Unknown error occurred',
        });
      }
    } catch (error: any) {
      setTestResult({
        success: false,
        error: error.message || 'Failed to create business card spreadsheet',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isTokenExpired = (expiresAt?: number) => {
    if (!expiresAt) return false;
    return expiresAt * 1000 < Date.now();
  };

  // If no connections, show setup view
  if (connections.length === 0 && !isLoading) {
    return (
      <div className="google-workspace-manager">
        <div className="google-workspace-scroll">
          <div className="google-workspace-hero">
            <div className="hero-content">
              <div className="hero-badge">
                <FontAwesomeIcon icon={faBuilding} />
                <span>Google Workspace Manager</span>
              </div>
              <h1>Manage Your Google Workspace</h1>
              <p>
                Connect and manage your Google Workspace domain. Manage users, monitor activity, and control access across your organization.
              </p>
              
              {/* Access Status Card */}
              {isCheckingToken ? (
                <div className="gws-access-status-card gws-access-status-checking">
                  <FontAwesomeIcon icon={faSpinner} spin />
                  <span>Checking access status...</span>
                </div>
              ) : googleToken ? (
                <div className="gws-access-status-card gws-access-status-granted">
                  <div className="gws-access-status-header">
                    <div className="gws-access-status-icon">
                      <FontAwesomeIcon icon={faCheckCircle} />
                    </div>
                    <div className="gws-access-status-info">
                      <h3>Access Granted</h3>
                      <p>You have successfully granted permission to access Google Workspace</p>
                    </div>
                  </div>
                  <div className="gws-access-status-details">
                    <div className="gws-access-status-detail-item">
                      <FontAwesomeIcon icon={faClock} />
                      <span>Granted: {formatDate(googleToken.saved_at)}</span>
                    </div>
                    {googleToken.expires_at && (
                      <div className={`gws-access-status-detail-item ${isTokenExpired(googleToken.expires_at) ? 'expired' : ''}`}>
                        <FontAwesomeIcon icon={isTokenExpired(googleToken.expires_at) ? faCircleXmark : faCircleCheck} />
                        <span>
                          {isTokenExpired(googleToken.expires_at)
                            ? 'Token Expired'
                            : `Expires: ${formatDate(googleToken.expires_at)}`}
                        </span>
                      </div>
                    )}
                    {googleToken.scopes && googleToken.scopes.length > 0 && (
                      <div className="gws-access-status-detail-item">
                        <FontAwesomeIcon icon={faCog} />
                        <span>{googleToken.scopes.length} scopes granted</span>
                      </div>
                    )}
                  </div>
                  <button
                    className="gws-refresh-token-button"
                    onClick={checkGoogleToken}
                    title="Refresh access status"
                  >
                    <FontAwesomeIcon icon={faRefresh} />
                    <span>Refresh Status</span>
                  </button>
                </div>
              ) : (
                <div className="gws-access-status-card gws-access-status-not-granted">
                  <div className="gws-access-status-header">
                    <div className="gws-access-status-icon">
                      <FontAwesomeIcon icon={faCircleXmark} />
                    </div>
                    <div className="gws-access-status-info">
                      <h3>No Access Granted</h3>
                      <p>Click the button below to grant permission to access Google Workspace</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Chrome Profile Selection */}
              <div className="gws-chrome-profile-section">
                <h3>Chrome Profile Selection</h3>
                <p className="gws-chrome-profile-description">
                  Select a Chrome profile to use for authorization. This allows the browser to open with your Google account already logged in.
                </p>
                
                {isLoadingProfiles ? (
                  <div className="gws-chrome-profile-loading">
                    <FontAwesomeIcon icon={faSpinner} spin />
                    <span>Loading Chrome profiles...</span>
                  </div>
                ) : chromeProfiles.length > 0 ? (
                  <div className="gws-chrome-profile-list">
                    <label className="gws-chrome-profile-label">
                      <select
                        className="gws-chrome-profile-select"
                        value={selectedChromeProfile || ''}
                        onChange={(e) => handleChromeProfileChange(e.target.value)}
                      >
                        <option value="">Auto-detect (by email)</option>
                        {chromeProfiles.map((profile) => (
                          <option key={profile.path} value={profile.path}>
                            {profile.name} {profile.email ? `(${profile.email})` : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                    {selectedChromeProfile && (
                      <div className="gws-chrome-profile-selected">
                        <FontAwesomeIcon icon={faCheckCircle} />
                        <span>Using: {chromeProfiles.find(p => p.path === selectedChromeProfile)?.name || 'Selected profile'}</span>
                      </div>
                    )}
                    <div className="gws-chrome-profile-actions">
                      <button
                        className="gws-refresh-profiles-button"
                        onClick={loadChromeProfiles}
                        title="Refresh Chrome profiles list"
                      >
                        <FontAwesomeIcon icon={faRefresh} />
                        <span>Refresh Profiles</span>
                      </button>
                      <button
                        className="gws-test-chrome-button"
                        onClick={handleTestOpenChrome}
                        disabled={isTestingChrome}
                        title="Test opening Chrome with selected profile"
                      >
                        {isTestingChrome ? (
                          <>
                            <FontAwesomeIcon icon={faSpinner} spin />
                            <span>Opening...</span>
                          </>
                        ) : (
                          <>
                            <FontAwesomeIcon icon={faCog} />
                            <span>Test Open Chrome</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="gws-chrome-profile-empty">
                    <p>No Chrome profiles found. The browser will open without a profile.</p>
                    <button
                      className="gws-refresh-profiles-button"
                      onClick={loadChromeProfiles}
                      title="Refresh Chrome profiles list"
                    >
                      <FontAwesomeIcon icon={faRefresh} />
                      <span>Refresh Profiles</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="hero-actions">
                <button className="gws-oauth-button" onClick={handleGoogleOAuth}>
                  <svg className="gws-google-icon" viewBox="0 0 24 24">
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
                  <span>{googleToken ? 'Re-authorize' : 'Give Permission'}</span>
                </button>
                
                {googleToken && (
                  <button
                    className="gws-test-button"
                    onClick={handleTestCreateSpreadsheet}
                    disabled={isTesting}
                  >
                    {isTesting ? (
                      <>
                        <FontAwesomeIcon icon={faSpinner} spin />
                        <span>Creating...</span>
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faFile} />
                        <span>Test: Create Business Card Spreadsheet</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Test Result Display */}
              {testResult && (
                <div className={`gws-test-result ${testResult.success ? 'success' : 'error'}`}>
                  <div className="gws-test-result-header">
                    <FontAwesomeIcon
                      icon={testResult.success ? faCheckCircle : faCircleXmark}
                    />
                    <span>{testResult.success ? 'Success' : 'Error'}</span>
                  </div>
                  {testResult.message && (
                    <div className="gws-test-result-message">
                      <pre>{testResult.message}</pre>
                    </div>
                  )}
                  {testResult.error && (
                    <div className="gws-test-result-error">
                      <pre>{testResult.error}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Connection list view
  if (!selectedConnection) {
    return (
      <div className="google-workspace-manager">
        <div className="google-workspace-scroll">
          <div className="google-workspace-header">
            <div className="header-content">
              <h1>Google Workspace Connections</h1>
              <button className="gws-oauth-button" onClick={handleGoogleOAuth}>
                <svg className="gws-google-icon" viewBox="0 0 24 24">
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
                <span>Sign in with Google</span>
              </button>
            </div>
          </div>

          <div className="connections-list">
            {connections.map((connection) => (
              <div
                key={connection.id}
                className="connection-card"
                onClick={() => handleSelectConnection(connection)}
              >
                <div className="gws-connection-icon">
                  <FontAwesomeIcon icon={faBuilding} />
                </div>
                <div className="connection-info">
                  <h3>{connection.name}</h3>
                  <p>{connection.domain}</p>
                  <div className="connection-meta">
                    <span className="connection-admin">{connection.adminEmail}</span>
                    <span className={`connection-status status-${connection.status}`}>
                      {connection.status}
                    </span>
                  </div>
                </div>
                <div className="connection-arrow">
                  <FontAwesomeIcon icon={faArrowRight} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Connection dashboard view
  return (
    <div className="google-workspace-manager">
      <div className="google-workspace-scroll">
        <div className="google-workspace-header">
          <div className="header-content">
            <button
              className="back-button"
              onClick={() => setSelectedConnection(null)}
            >
              <FontAwesomeIcon icon={faArrowRight} style={{ transform: 'rotate(180deg)' }} />
              <span>Back</span>
            </button>
            <div className="header-title">
              <h1>{selectedConnection.name}</h1>
              <p>{selectedConnection.domain}</p>
            </div>
          </div>
        </div>

        <div className="workspace-tabs">
          <button
            className={`tab-button ${currentView === 'overview' ? 'active' : ''}`}
            onClick={() => setCurrentView('overview')}
          >
            <FontAwesomeIcon icon={faBuilding} />
            <span>Overview</span>
          </button>
          <button
            className={`tab-button ${currentView === 'users' ? 'active' : ''}`}
            onClick={() => setCurrentView('users')}
          >
            <FontAwesomeIcon icon={faUsers} />
            <span>Users</span>
          </button>
          <button
            className={`tab-button ${currentView === 'settings' ? 'active' : ''}`}
            onClick={() => setCurrentView('settings')}
          >
            <FontAwesomeIcon icon={faCog} />
            <span>Settings</span>
          </button>
        </div>

        <div className="workspace-content">
          {currentView === 'overview' && (
            <div className="overview-section">
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="gws-stat-icon">
                    <FontAwesomeIcon icon={faUsers} />
                  </div>
                  <div className="stat-info">
                    <h3>{users.length}</h3>
                    <p>Total Users</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="gws-stat-icon">
                    <FontAwesomeIcon icon={faEnvelope} />
                  </div>
                  <div className="stat-info">
                    <h3>{users.filter(u => !u.isSuspended).length}</h3>
                    <p>Active Users</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="gws-stat-icon">
                    <FontAwesomeIcon icon={faFile} />
                  </div>
                  <div className="stat-info">
                    <h3>0</h3>
                    <p>Storage Used</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="gws-stat-icon">
                    <FontAwesomeIcon icon={faCalendarAlt} />
                  </div>
                  <div className="stat-info">
                    <h3>0</h3>
                    <p>Events Today</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentView === 'users' && (
            <div className="users-section">
              <div className="section-header">
                <div className="search-box">
                  <FontAwesomeIcon icon={faSearch} />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <button className="refresh-button" onClick={() => loadUsersForConnection(selectedConnection.id)}>
                  <FontAwesomeIcon icon={faRefresh} />
                </button>
              </div>

              {isLoading ? (
                <div className="loading-state">
                  <FontAwesomeIcon icon={faSpinner} spin />
                  <p>Loading users...</p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="empty-state">
                  <FontAwesomeIcon icon={faUsers} />
                  <p>No users found</p>
                </div>
              ) : (
                <div className="users-list">
                  {filteredUsers.map((user) => (
                    <div key={user.id} className="user-card">
                      <div className="gws-user-avatar">
                        <FontAwesomeIcon icon={faUser} />
                      </div>
                      <div className="user-info">
                        <h4>{user.name}</h4>
                        <p>{user.email}</p>
                        <div className="user-badges">
                          {user.isAdmin && (
                            <span className="badge badge-admin">Admin</span>
                          )}
                          {user.isSuspended && (
                            <span className="badge badge-suspended">Suspended</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {currentView === 'settings' && (
            <div className="settings-section">
              <div className="settings-card">
                <h3>Connection Settings</h3>
                <div className="setting-item">
                  <label>Connection Name</label>
                  <p>{selectedConnection.name}</p>
                </div>
                <div className="setting-item">
                  <label>Domain</label>
                  <p>{selectedConnection.domain}</p>
                </div>
                <div className="setting-item">
                  <label>Admin Email</label>
                  <p>{selectedConnection.adminEmail}</p>
                </div>
                <div className="setting-item">
                  <label>Status</label>
                  <span className={`connection-status status-${selectedConnection.status}`}>
                    {selectedConnection.status}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GoogleWorkspaceManager;

