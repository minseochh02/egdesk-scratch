import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faServer,
  faCloud,
  faSpinner,
  faCopy
} from '../../utils/fontAwesomeIcons';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import RunningServersSection, { 
  RunningMCPServer,
  AccessLevelConfig 
} from './RunningServersSection';
import GoogleOAuthSignIn from './GoogleOAuthSignIn';
import './RunningServersTabs.css';
import './RunningServers.css';

// Required OAuth scopes for cloud MCP servers
const REQUIRED_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/gmail.addons.current.action.compose',
  'https://www.googleapis.com/auth/gmail.addons.current.message.action',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'openid',
  'https://www.googleapis.com/auth/sites',
  'https://www.googleapis.com/auth/forms',
  'https://www.googleapis.com/auth/gmail.addons.current.message.metadata',
  'https://www.googleapis.com/auth/gmail.addons.current.message.readonly',
  'https://www.googleapis.com/auth/script.projects',
  'https://www.googleapis.com/auth/script.projects.readonly',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/contacts',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/script.scriptapp',
  'https://www.googleapis.com/auth/script.send_mail',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.metadata',
  'https://www.googleapis.com/auth/gmail.insert',
];

interface RunningServersTabsProps {
  // Local servers props (passed to RunningServersSection)
  servers: RunningMCPServer[];
  loading: boolean;
  error: string | null;
  editingServerName: string | null;
  editingServerNameValue: string;
  claudeDesktopStatus: {
    isConfigured: boolean;
    isLoading: boolean;
    error: string | null;
  };
  supabaseConfig: {
    hasSupabaseKey: boolean;
    supabaseAnonKey: string | null;
    supabaseUrl: string | null;
    isLoading: boolean;
  };
  loadRunningServers: (isManualRefresh?: boolean) => Promise<void>;
  setEditingServerNameValue: (value: string) => void;
  handleSaveServerName: (serverId: string) => Promise<void>;
  handleCancelEditServerName: () => void;
  handleEditServerName: (server: RunningMCPServer) => void;
  formatUptime: (seconds: number) => string;
  getStatusIcon: (status: string) => any;
  getStatusColor: (status: string) => string;
  getAccessLevelIcon: (level: string) => any;
  getAccessLevelColor: (level: string) => string;
  getAccessLevelDisplayName: (level: string) => string;
  generateMCPSchema: (server: RunningMCPServer) => string;
  generateNetworkMCPSchema: (server: RunningMCPServer) => string;
  generatePublicMCPSchema: (server: RunningMCPServer) => string;
  handleCopySchema: (server: RunningMCPServer) => void;
  handleCopyNetworkSchema: (server: RunningMCPServer) => void;
  handleCopyPublicSchema: (server: RunningMCPServer) => void;
  handleConfigureClaudeDesktop: (server: RunningMCPServer) => Promise<void>;
  handleUnconfigureClaudeDesktop: (server: RunningMCPServer) => Promise<void>;
  handleEditAccessLevel: (server: RunningMCPServer) => void;
  handleViewDashboard: (server: RunningMCPServer) => void;
  
  // Cloud servers props (for future implementation)
  cloudServers?: RunningMCPServer[];
  cloudLoading?: boolean;
  cloudError?: string | null;
  loadCloudServers?: (isManualRefresh?: boolean) => Promise<void>;
}

type TabType = 'local' | 'cloud';

const RunningServersTabs: React.FC<RunningServersTabsProps> = ({
  servers,
  loading,
  error,
  editingServerName,
  editingServerNameValue,
  claudeDesktopStatus,
  supabaseConfig,
  loadRunningServers,
  setEditingServerNameValue,
  handleSaveServerName,
  handleCancelEditServerName,
  handleEditServerName,
  formatUptime,
  getStatusIcon,
  getStatusColor,
  getAccessLevelIcon,
  getAccessLevelColor,
  getAccessLevelDisplayName,
  generateMCPSchema,
  generateNetworkMCPSchema,
  generatePublicMCPSchema,
  handleCopySchema,
  handleCopyNetworkSchema,
  handleCopyPublicSchema,
  handleConfigureClaudeDesktop,
  handleUnconfigureClaudeDesktop,
  handleEditAccessLevel,
  handleViewDashboard,
  cloudServers = [],
  cloudLoading = false,
  cloudError = null,
  loadCloudServers
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('local');
  const [hasValidOAuthToken, setHasValidOAuthToken] = useState<boolean>(false);
  const [checkingOAuthToken, setCheckingOAuthToken] = useState<boolean>(true);
  const [existingCopies, setExistingCopies] = useState<Map<string, string>>(new Map()); // templateId -> copyId
  const [loadingCopies, setLoadingCopies] = useState<boolean>(true);

  // Check if OAuth token exists and has required scopes
  const checkOAuthToken = async () => {
    try {
      setCheckingOAuthToken(true);
      
      // First, check Supabase session (from GoogleOAuthSignIn component)
      const sessionResult = await window.electron.auth.getSession();
      console.log('🔍 Checking Supabase session:', {
        success: sessionResult.success,
        hasSession: !!sessionResult.session,
        hasUser: !!sessionResult.user,
        provider: sessionResult.user?.app_metadata?.provider
      });
      
      // Check if user is signed in with Google via Supabase
      if (sessionResult.success && sessionResult.session && sessionResult.user) {
        const user = sessionResult.user;
        const isGoogleAuth = 
          user.app_metadata?.provider === 'google' ||
          user.identities?.some((id: any) => id.provider === 'google');
        
        if (isGoogleAuth) {
          console.log('✅ Google OAuth session found via Supabase');
          // User is authenticated with Google via Supabase
          // Check if we also have the token in electron-store with scopes
          const tokenResult = await window.electron.auth.getGoogleWorkspaceToken();
          
          if (tokenResult.success && tokenResult.token) {
            const token = tokenResult.token;
            console.log('📦 Token from store:', {
              hasAccessToken: !!token.access_token,
              hasScopes: !!token.scopes,
              scopesType: typeof token.scopes
            });
            
            // If token has scopes, verify they match
            if (token.scopes) {
              let tokenScopes: string[] = [];
              
              if (Array.isArray(token.scopes)) {
                tokenScopes = token.scopes;
              } else if (typeof token.scopes === 'string') {
                tokenScopes = (token.scopes as string).split(' ');
              }
              
              // Check if all required scopes are present
              const hasAllScopes = REQUIRED_OAUTH_SCOPES.every(scope => 
                tokenScopes.includes(scope)
              );
              
              if (hasAllScopes) {
                console.log('✅ All required scopes present in token');
                setHasValidOAuthToken(true);
                return;
              } else {
                console.log('⚠️ Token exists but missing some required scopes');
                // Still allow access since user is authenticated, but log warning
                setHasValidOAuthToken(true);
                return;
              }
            } else {
              // Token exists but no scopes - still allow since user authenticated
              console.log('⚠️ Token exists but no scopes stored - allowing access');
              setHasValidOAuthToken(true);
              return;
            }
          } else {
            // No token in store, but user is authenticated via Supabase
            // This happens when using GoogleOAuthSignIn component directly
            console.log('✅ Google authenticated via Supabase (token may not be in store yet)');
            setHasValidOAuthToken(true);
            return;
          }
        }
      }
      
      // Fallback: Check electron-store token directly
      const tokenResult = await window.electron.auth.getGoogleWorkspaceToken();
      console.log('🔍 Checking electron-store token:', tokenResult);
      
      if (tokenResult.success && tokenResult.token) {
        const token = tokenResult.token;
        
        // Check if token has access_token OR if it's a Supabase session
        if (token.access_token || token.supabase_session) {
          console.log('✅ Token found in electron-store');
          
          // If it's a Supabase session flag, allow access
          if (token.supabase_session) {
            setHasValidOAuthToken(true);
            return;
          }
          
          // Check scopes if available
          if (token.scopes) {
            let tokenScopes: string[] = [];
            
            if (Array.isArray(token.scopes)) {
              tokenScopes = token.scopes;
            } else if (typeof token.scopes === 'string') {
              tokenScopes = (token.scopes as string).split(' ');
            }
            
            const hasAllScopes = REQUIRED_OAUTH_SCOPES.every(scope => 
              tokenScopes.includes(scope)
            );
            
            setHasValidOAuthToken(hasAllScopes);
            return;
          } else {
            // Token exists but no scopes - allow access
            setHasValidOAuthToken(true);
            return;
          }
        }
      }
      
      console.log('❌ No valid OAuth token or session found');
      setHasValidOAuthToken(false);
    } catch (err) {
      console.error('Error checking OAuth token:', err);
      setHasValidOAuthToken(false);
    } finally {
      setCheckingOAuthToken(false);
    }
  };

  // Load existing copies from electron-store
  const loadExistingCopies = async () => {
    try {
      setLoadingCopies(true);
      const copies = await window.electron.store.get('cloud_mcp_server_copies');
      if (copies && Array.isArray(copies)) {
        const copiesMap = new Map<string, string>();
        copies.forEach((copy: { templateId: string; copyId: string }) => {
          if (copy.templateId && copy.copyId) {
            copiesMap.set(copy.templateId, copy.copyId);
          }
        });
        setExistingCopies(copiesMap);
        console.log('📦 Loaded existing copies:', copiesMap);
      }
    } catch (error) {
      console.error('Error loading existing copies:', error);
    } finally {
      setLoadingCopies(false);
    }
  };

        // Create template copy by calling Edge Function
        const handleCreateTemplateCopy = async (templateId: string, template: RunningMCPServer) => {
          try {
            console.log('🚀 Creating template copy for:', templateId);
            console.log('📋 Spreadsheet ID being sent to Edge Function:', templateId);

      // Get Supabase session token - need the user's JWT, not anon key
      const sessionResult = await window.electron.auth.getSession();
      if (!sessionResult.success || !sessionResult.session) {
        alert('Please sign in with Google first to create a cloud MCP server.');
        return;
      }

      // The session.access_token should be the user's JWT token (not anon key)
      // Verify it's a JWT by checking if it has 3 parts separated by dots
      const supabaseToken = sessionResult.session.access_token;
      
      // Check if it's a valid JWT format (3 parts: header.payload.signature)
      const isJWT = supabaseToken && supabaseToken.split('.').length === 3;
      
      console.log('✅ Got Supabase session:', {
        hasSession: !!sessionResult.session,
        hasAccessToken: !!supabaseToken,
        tokenLength: supabaseToken?.length,
        isJWT: isJWT,
        tokenPrefix: supabaseToken ? supabaseToken.substring(0, 30) + '...' : 'missing',
        userId: sessionResult.user?.id,
        userEmail: sessionResult.user?.email,
        // Decode JWT header to verify it's a JWT (not anon key)
        tokenHeader: supabaseToken ? (() => {
          try {
            const parts = supabaseToken.split('.');
            if (parts.length >= 1) {
              const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
              return header;
            }
          } catch (e) {
            return 'Could not decode';
          }
        })() : null,
      });

      if (!supabaseToken) {
        alert('No access token found in session. Please sign in again.');
        return;
      }

      if (!isJWT) {
        console.error('❌ Token is not a valid JWT format! This might be an anon key.');
        alert('Invalid token format. Please sign in again.');
        return;
      }

      // Get Supabase URL and anon key from config
      const configResult = await window.electron.env.checkConfig();
      if (!configResult.success || !configResult.supabaseUrl) {
        alert('Supabase configuration not found. Please configure SUPABASE_URL in your .env file.');
        return;
      }

      if (!configResult.supabaseAnonKey) {
        alert('Supabase anon key not found. Please configure SUPABASE_ANON_KEY in your .env file.');
        return;
      }

      const supabaseUrl = configResult.supabaseUrl;
      const supabaseAnonKey = configResult.supabaseAnonKey;
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/copy-template`;

      console.log('📡 Calling Edge Function via main process:', {
        url: edgeFunctionUrl,
        templateId: templateId,
      });

      // Call Edge Function via main process to avoid CORS issues
      const result = await window.electron.auth.callEdgeFunction({
        url: edgeFunctionUrl,
        method: 'POST',
        body: {
          templateId: templateId,
        },
        headers: {
          'apikey': supabaseAnonKey, // Required by Supabase Edge Functions
        },
      });

      console.log('📥 Edge Function response:', result);

      if (!result.success) {
        throw new Error(result.error || `HTTP ${result.status}: ${result.statusText}`);
      }

      const data = result.data;

      if (data.success && data.content) {
        console.log('✅ Template content received:', data.content);
        
        // TODO: Create spreadsheet with this content using user's Google OAuth token
        // For now, just show success message
        alert(`Template content retrieved successfully!\n\nTemplate: ${data.content.properties.title}\nSheets: ${data.content.sheets.length}\n\nNext: Create spreadsheet with this content.`);
        
        // Reload copies to update UI
        await loadExistingCopies();
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('❌ Error creating template copy:', error);
      alert(`Failed to create template copy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Check OAuth token on mount and when switching to cloud tab
  useEffect(() => {
    if (activeTab === 'cloud') {
      checkOAuthToken();
      loadExistingCopies();
    }
  }, [activeTab]);

  // Listen for auth state changes to re-check token
  useEffect(() => {
    const unsubscribe = window.electron.auth.onAuthStateChanged((data) => {
      if (activeTab === 'cloud') {
        // Re-check token when auth state changes
        setTimeout(() => {
          checkOAuthToken();
        }, 1000); // Small delay to allow token to be saved
      }
    });

    return () => {
      unsubscribe();
    };
  }, [activeTab]);

  return (
    <div className="running-servers-tabs">
      <div className="running-servers-tabs-header">
        <h2>Running MCP Servers</h2>
        <p>Monitor and manage your active MCP server connections</p>
      </div>

      <div className="running-servers-tabs-nav">
        <button
          className={`running-servers-tab ${activeTab === 'local' ? 'active' : ''}`}
          onClick={() => setActiveTab('local')}
        >
          <FontAwesomeIcon icon={faServer} />
          <span>Local Running MCP Servers</span>
          {servers.length > 0 && (
            <span className="running-servers-tab-badge">{servers.length}</span>
          )}
        </button>
        <button
          className={`running-servers-tab ${activeTab === 'cloud' ? 'active' : ''}`}
          onClick={() => setActiveTab('cloud')}
        >
          <FontAwesomeIcon icon={faCloud} />
          <span>Cloud Running MCP Servers</span>
          {cloudServers.length > 0 && (
            <span className="running-servers-tab-badge">{cloudServers.length}</span>
          )}
        </button>
      </div>

      <div className="running-servers-tabs-content">
        {activeTab === 'local' && (
          <div className="running-servers-tab-panel">
            <RunningServersSection
              servers={servers}
              loading={loading}
              error={error}
              editingServerName={editingServerName}
              editingServerNameValue={editingServerNameValue}
              claudeDesktopStatus={claudeDesktopStatus}
              supabaseConfig={supabaseConfig}
              loadRunningServers={loadRunningServers}
              setEditingServerNameValue={setEditingServerNameValue}
              handleSaveServerName={handleSaveServerName}
              handleCancelEditServerName={handleCancelEditServerName}
              handleEditServerName={handleEditServerName}
              formatUptime={formatUptime}
              getStatusIcon={getStatusIcon}
              getStatusColor={getStatusColor}
              getAccessLevelIcon={getAccessLevelIcon}
              getAccessLevelColor={getAccessLevelColor}
              getAccessLevelDisplayName={getAccessLevelDisplayName}
              generateMCPSchema={generateMCPSchema}
              generateNetworkMCPSchema={generateNetworkMCPSchema}
              generatePublicMCPSchema={generatePublicMCPSchema}
              handleCopySchema={handleCopySchema}
              handleCopyNetworkSchema={handleCopyNetworkSchema}
              handleCopyPublicSchema={handleCopyPublicSchema}
              handleConfigureClaudeDesktop={handleConfigureClaudeDesktop}
              handleUnconfigureClaudeDesktop={handleUnconfigureClaudeDesktop}
              handleEditAccessLevel={handleEditAccessLevel}
              handleViewDashboard={handleViewDashboard}
              hideHeader={true}
            />
          </div>
        )}

        {activeTab === 'cloud' && (
          <div className="running-servers-tab-panel">
            <div className="running-servers-section">
              <div className="section-header">
                <h2>Cloud Running MCP Servers</h2>
                <p>Monitor and manage your cloud-hosted MCP server connections</p>
                {hasValidOAuthToken && (
                  <button
                    onClick={async () => {
                      // Test button - use first template if available
                      if (cloudServers.length > 0) {
                        const template = cloudServers[0];
                        const extractSpreadsheetId = (url: string): string | null => {
                          const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
                          return match ? match[1] : null;
                        };
                        const templateId = extractSpreadsheetId(template.address) || template.id || template.address;
                        
                        console.log('🧪 Test Edge Function - Template Details:', {
                          templateName: template.name,
                          templateAddress: template.address,
                          extractedTemplateId: templateId,
                          templateIdSource: extractSpreadsheetId(template.address) ? 'from URL' : (template.id ? 'from id' : 'from address'),
                        });
                        
                        console.log('📤 Passing to Edge Function - Spreadsheet ID:', templateId);
                        
                        await handleCreateTemplateCopy(templateId, template);
                      } else {
                        alert('No templates available. Please wait for templates to load.');
                      }
                    }}
                    style={{
                      marginTop: '12px',
                      padding: '8px 16px',
                      background: '#667eea',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                    }}
                  >
                    🧪 Test Edge Function (First Template)
                  </button>
                )}
              </div>

              {checkingOAuthToken && (
                <div className="loading-state">
                  <FontAwesomeIcon icon={faSpinner} spin />
                  <span>Checking authentication...</span>
                </div>
              )}

              {!checkingOAuthToken && !hasValidOAuthToken && (
                <div className="cloud-oauth-section">
                  <div className="cloud-oauth-header">
                    <h3>Authentication Required</h3>
                    <p>Sign in with Google to access cloud MCP servers</p>
                  </div>
                  <GoogleOAuthSignIn
                    onSignInSuccess={async (user, session) => {
                      console.log('Google OAuth sign in successful:', user);
                      // Re-check token after sign in
                      await checkOAuthToken();
                      // Optionally reload cloud servers after sign in
                      if (loadCloudServers) {
                        loadCloudServers(true);
                      }
                    }}
                    onSignInError={(error) => {
                      console.error('Google OAuth sign in error:', error);
                    }}
                  />
                </div>
              )}

              {!checkingOAuthToken && hasValidOAuthToken && (
                <>
                  {cloudLoading && (
                    <div className="loading-state">
                      <FontAwesomeIcon icon={faSpinner} spin />
                      <span>Loading cloud servers...</span>
                    </div>
                  )}

                  {cloudError && (
                    <div className="error-state">
                      <span>{cloudError}</span>
                      {loadCloudServers && (
                        <button onClick={() => loadCloudServers(true)}>Retry</button>
                      )}
                    </div>
                  )}

                  {!cloudLoading && !cloudError && !loadingCopies && cloudServers.length > 0 && (
                    <div className="cloud-templates-grid">
                      {cloudServers.map((template) => {
                        // Extract spreadsheet ID from URL (format: https://docs.google.com/spreadsheets/d/{ID}/edit)
                        const extractSpreadsheetId = (url: string): string | null => {
                          const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
                          return match ? match[1] : null;
                        };
                        const templateId = extractSpreadsheetId(template.address) || template.id || template.address;
                        const hasCopy = existingCopies.has(templateId);
                        const copyId = existingCopies.get(templateId);

                        return (
                          <div key={template.id} className="cloud-template-card">
                            {hasCopy ? (
                              // Show existing server card
                              <div className="running-servers-card">
                                <div className="running-servers-card-header">
                                  <div className="mcp-server-info-container">
                                    <div className={`mcp-server-icon-box ${template.type === 'gmail' ? 'gmail-icon-box' : ''}`}>
                                      <FontAwesomeIcon icon={faCloud} />
                                    </div>
                                    <div className="mcp-server-text-details">
                                      <div className="mcp-server-name-container">
                                        <div className="mcp-server-name-display">
                                          <h3 className="mcp-server-name">{template.name}</h3>
                                        </div>
                                      </div>
                                      <p className="mcp-server-description">{template.description || 'Cloud MCP Server'}</p>
                                      <div className="mcp-server-meta">
                                        <span className="mcp-server-type">{template.type}</span>
                                        <span className="mcp-server-version">v{template.version}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="running-servers-status">
                                    <FontAwesomeIcon 
                                      icon={getStatusIcon(template.status || 'running')} 
                                      style={{ color: getStatusColor(template.status || 'running') }}
                                    />
                                    <span style={{ color: getStatusColor(template.status || 'running') }}>
                                      {(template.status || 'running').charAt(0).toUpperCase() + (template.status || 'running').slice(1)}
                                    </span>
                                  </div>
                                </div>
                                <div className="running-servers-card-metrics">
                                  <div className="running-servers-metric">
                                    <FontAwesomeIcon icon={faCloud} />
                                    <span className="running-servers-metric-label">Template:</span>
                                    <span className="running-servers-metric-value" style={{ 
                                      fontSize: '12px', 
                                      wordBreak: 'break-all',
                                      maxWidth: '200px'
                                    }}>
                                      {template.address}
                                    </span>
                                  </div>
                                  <div className="running-servers-metric">
                                    <FontAwesomeIcon icon={faCloud} />
                                    <span className="running-servers-metric-label">Copy ID:</span>
                                    <span className="running-servers-metric-value" style={{ 
                                      fontSize: '12px', 
                                      wordBreak: 'break-all',
                                      maxWidth: '200px'
                                    }}>
                                      {copyId}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              // Show create button
                              <div className="cloud-template-create-card">
                                <div className="cloud-template-icon">
                                  <FontAwesomeIcon icon={faCloud} />
                                </div>
                                <h3>{template.name}</h3>
                                <p>{template.description || 'Cloud MCP Server Template'}</p>
                                <button 
                                  className="cloud-template-create-button"
                                  onClick={async () => {
                                    await handleCreateTemplateCopy(templateId, template);
                                  }}
                                >
                                  <FontAwesomeIcon icon={faPlus} />
                                  <span>Create Server</span>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {!cloudLoading && !cloudError && !loadingCopies && cloudServers.length === 0 && (
                    <div className="empty-state">
                      <FontAwesomeIcon icon={faCloud} />
                      <h3>No Templates Available</h3>
                      <p>No cloud MCP server templates found.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RunningServersTabs;

