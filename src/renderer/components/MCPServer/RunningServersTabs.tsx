import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faServer,
  faCloud,
  faSpinner,
  faCopy,
  faCode
} from '../../utils/fontAwesomeIcons';
import { faPlus, faSync, faTrash } from '@fortawesome/free-solid-svg-icons';
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
  
  // Script editor navigation
  onOpenScriptEditor?: (copyId?: string) => void;
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
  loadCloudServers,
  onOpenScriptEditor
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('local');
  const [hasValidOAuthToken, setHasValidOAuthToken] = useState<boolean>(false);
  const [checkingOAuthToken, setCheckingOAuthToken] = useState<boolean>(true);
  const [existingCopies, setExistingCopies] = useState<Map<string, string>>(new Map()); // templateId -> copyId
  const [loadingCopies, setLoadingCopies] = useState<boolean>(true);
  const [copiesWithScript, setCopiesWithScript] = useState<Map<string, string>>(new Map()); // templateId -> copyId (only copies with script content)
  const [creatingCopyId, setCreatingCopyId] = useState<string | null>(null);

  // Check if OAuth token exists and has required scopes
  const checkOAuthToken = async () => {
    try {
      setCheckingOAuthToken(true);
      console.log('🔍 RunningServersTabs: Starting OAuth token check...');
      
      // First, check Supabase session (from GoogleOAuthSignIn component)
      const sessionResult = await window.electron.auth.getSession();
      console.log('🔍 RunningServersTabs: Supabase session result:', {
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
          console.log('✅ RunningServersTabs: Google OAuth session found via Supabase');
          // User is authenticated with Google via Supabase
          // Check if we also have the token in electron-store with scopes
          const tokenResult = await window.electron.auth.getGoogleWorkspaceToken();
          
          if (tokenResult.success && tokenResult.token) {
            const token = tokenResult.token;
            console.log('📦 RunningServersTabs: Token from store:', {
              hasAccessToken: !!token.access_token,
              hasScopes: !!token.scopes,
              scopesType: typeof token.scopes
            });
            
            // First check if token has access_token (required for Google API calls)
            if (!token.access_token) {
              console.log('⚠️ RunningServersTabs: Token exists but no access_token - cannot use for API calls');
              setHasValidOAuthToken(false);
              return;
            }
            
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
                console.log('✅ RunningServersTabs: All required scopes present in token');
                setHasValidOAuthToken(true);
                return;
              } else {
                console.log('⚠️ RunningServersTabs: Token exists but missing some required scopes');
                // Still allow access since user has access_token, but log warning
                setHasValidOAuthToken(true);
                return;
              }
            } else {
              // Token exists with access_token but no scopes - allow access
              console.log('⚠️ RunningServersTabs: Token exists with access_token but no scopes stored - allowing access');
              setHasValidOAuthToken(true);
              return;
            }
          } else {
            // No token in store, but user is authenticated via Supabase
            console.log('⚠️ RunningServersTabs: Google authenticated via Supabase but no Google OAuth token found in store');
            console.log('⚠️ RunningServersTabs: User needs to sign in with Google to get OAuth token for API access');
            setHasValidOAuthToken(false);
            return;
          }
        } else {
            console.log('⚠️ RunningServersTabs: User is signed in but NOT with Google');
        }
      } else {
          console.log('❌ RunningServersTabs: No active Supabase session found');
      }
      
      // Fallback: Check electron-store token directly
      const tokenResult = await window.electron.auth.getGoogleWorkspaceToken();
      console.log('🔍 RunningServersTabs: Checking electron-store token directly:', tokenResult);
      
      if (tokenResult.success && tokenResult.token) {
        const token = tokenResult.token;
        
        // Check if token has access_token (required for Google API calls)
        if (token.access_token) {
          console.log('✅ RunningServersTabs: Google OAuth token found in electron-store (fallback)');
            setHasValidOAuthToken(true);
            return;
        }
      }
      
      console.log('❌ RunningServersTabs: No valid OAuth token or session found (final check)');
      setHasValidOAuthToken(false);
    } catch (err) {
      console.error('Error checking OAuth token:', err);
      setHasValidOAuthToken(false);
    } finally {
      setCheckingOAuthToken(false);
    }
  };

  // Load existing copies from electron-store and database
  const loadExistingCopies = async () => {
    try {
      setLoadingCopies(true);
      
      // Load from electron-store (legacy) - merge with database
      const copies = await window.electron.store.get('cloud_mcp_server_copies');
      const copiesMap = new Map<string, string>();
      if (copies && Array.isArray(copies)) {
        copies.forEach((copy: { templateId: string; copyId: string }) => {
          if (copy.templateId && copy.copyId) {
            copiesMap.set(copy.templateId, copy.copyId);
          }
        });
        console.log('📦 Loaded existing copies from store:', copiesMap);
      }
      
      // Load from database - this is the primary source now
      const dbResult = await window.electron.templateCopies.getAll(100, 0);
      if (dbResult.success && dbResult.data) {
        const scriptCopiesMap = new Map<string, string>();
        dbResult.data.forEach((copy: any) => {
          // Add all copies to existingCopies map (templateId -> copyId)
          if (copy.templateId && copy.id) {
            copiesMap.set(copy.templateId, copy.id);
          }
          
          // Check if copy has script content
          if (copy.scriptContent && copy.scriptContent.files && copy.scriptContent.files.length > 0) {
            scriptCopiesMap.set(copy.templateId, copy.id);
          }
        });
        setCopiesWithScript(scriptCopiesMap);
        console.log('📦 Loaded copies with script content:', scriptCopiesMap);
      }
      
      // Update existingCopies with all copies (from both store and database)
      setExistingCopies(copiesMap);
      console.log('📦 Total existing copies loaded:', copiesMap.size);
    } catch (error) {
      console.error('Error loading existing copies:', error);
    } finally {
      setLoadingCopies(false);
    }
  };

        // Create template copy by calling Edge Function
        const handleCreateTemplateCopy = async (templateId: string, template: RunningMCPServer) => {
          try {
            setCreatingCopyId(templateId);
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

      // Get scriptID from template if available
      const scriptID = (template as any).scriptID;
      console.log('📜 Script ID from template:', scriptID || 'not provided');

      // Call Edge Function via main process to avoid CORS issues
      const result = await window.electron.auth.callEdgeFunction({
        url: edgeFunctionUrl,
        method: 'POST',
        body: {
          templateId: templateId,
          ...(scriptID ? { scriptId: scriptID } : {}), // Include scriptId if available
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
        console.log('✅ Template content summary:', {
          spreadsheetId: data.content.spreadsheetId,
          title: data.content.properties?.title,
          sheetsCount: data.content.sheets?.length || 0,
          hasAppsScript: !!data.content.appsScript,
          appsScriptScriptId: data.content.appsScript?.scriptId,
          appsScriptFilesCount: data.content.appsScript?.files?.length || 0,
          appsScriptFiles: data.content.appsScript?.files?.map((f: any) => ({
            name: f.name,
            type: f.type,
            hasSource: !!f.source,
            sourceLength: f.source?.length || 0,
            hasFunctionSet: !!f.functionSet,
          })) || [],
        });
        
        // Create spreadsheet with template content using user's Google OAuth token
        console.log('📋 Creating new spreadsheet with template content...');
        const copyResult = await window.electron.workspace.copyTemplateContent(data.content);
        
        if (!copyResult.success) {
          throw new Error(copyResult.error || 'Failed to create spreadsheet copy');
        }
        
        // Check for Apps Script error and prompt user
        if (copyResult.data?.appsScriptError) {
          const error = copyResult.data.appsScriptError;
          console.warn('⚠️ Apps Script copy failed:', error);
          
          if (error.code === 'APPS_SCRIPT_API_DISABLED') {
            const shouldOpenSettings = confirm(
              `⚠️ ${error.message}\n\n` +
              `This is required to create the server logic. You need to enable it in your Google Account settings.\n\n` +
              `Click OK to open the settings page:\n${error.url}\n\n` +
              `After enabling it, try creating the server again.`
            );
            
            if (shouldOpenSettings && error.url) {
              window.open(error.url, '_blank');
            }
            
            // We don't save the incomplete copy to the database so user can retry
            return;
          } else {
            // Show generic warning but proceed
            alert(`⚠️ Warning: Apps Script could not be copied.\n\nError: ${error.message}\n\nThe server may not function correctly without its script logic.`);
          }
        }
        
        console.log('✅ Spreadsheet copy created:', copyResult.data);
        
        if (!copyResult.data) {
          throw new Error('No data returned from copy operation');
        }
        
        // Save template copy to database
        try {
          const saveResult = await window.electron.templateCopies.create({
            templateId: templateId,
            templateScriptId: scriptID || undefined,
            spreadsheetId: copyResult.data.spreadsheetId,
            spreadsheetUrl: copyResult.data.spreadsheetUrl,
            scriptId: copyResult.data.scriptId,
            scriptContent: data.content.appsScript || undefined,
            metadata: {
              serverName: template.name,
            },
          });
          
          if (saveResult.success) {
            console.log('✅ Template copy saved to database:', saveResult.data);
          } else {
            console.warn('⚠️ Failed to save template copy to database:', saveResult.error);
          }
        } catch (saveError) {
          console.error('❌ Error saving template copy to database:', saveError);
          // Don't throw - continue even if save fails
        }
        
        // Show success message with link
        const message = `Template copied successfully!\n\n` +
          `Title: ${data.content.properties.title}\n` +
          `Sheets: ${data.content.sheets.length}\n` +
          `Apps Script: ${data.content.appsScript ? 'Yes' : 'No'}\n\n` +
          `New Spreadsheet ID: ${copyResult.data.spreadsheetId}\n` +
          `URL: ${copyResult.data.spreadsheetUrl}`;
        
        alert(message);
        
        // Reload copies to update UI
        await loadExistingCopies();
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('❌ Error creating template copy:', error);
      alert(`Failed to create template copy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setCreatingCopyId(null);
    }
  };

  // Handle delete template copy
  const handleDeleteTemplateCopy = async (copyId: string, templateId: string) => {
    if (!confirm('Are you sure you want to delete this template copy? This action cannot be undone.')) {
      return;
    }

    try {
      console.log('🗑️ Deleting template copy:', copyId);
      
      const result = await window.electron.templateCopies.delete(copyId);
      
      if (result.success) {
        console.log('✅ Template copy deleted successfully');
        // Reload copies to update UI
        await loadExistingCopies();
      } else {
        throw new Error(result.error || 'Failed to delete template copy');
      }
    } catch (error) {
      console.error('❌ Error deleting template copy:', error);
      alert(`Failed to delete template copy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Handle re-sign in to update scopes
  const handleReSignIn = async () => {
    try {
      // Sign out first to clear existing token
      await window.electron.auth.signOut();
      
      // Then sign in again with updated scopes
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
        // Google Sheets and Drive scopes (required for template copying)
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
      ].join(' ');

      const result = await window.electron.auth.signInWithGoogle(scopes);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to sign in with Google');
      }
      
      // Wait a moment for the OAuth flow to complete
      setTimeout(async () => {
        await checkOAuthToken();
      }, 2000);
    } catch (error) {
      console.error('Error re-signing in:', error);
      alert(`Failed to re-sign in: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
                    <p>
                      {hasValidOAuthToken === false && (window.electron as any)?.auth?.user 
                        ? "Additional permissions needed for Cloud MCP Servers." 
                        : "Sign in with Google to access cloud MCP servers"}
                    </p>
                  </div>
                  
                  {/* If user is already signed in but missing token, show Re-Sign In button instead of generic sign in */}
                  <div className="cloud-oauth-login-container">
                     <button
                      onClick={handleReSignIn}
                      className="btn btn-primary google-signin-btn"
                      style={{ padding: '0.75rem 1.5rem', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', margin: '0 auto' }}
                    >
                      <FontAwesomeIcon icon={faSync} />
                      {hasValidOAuthToken === false ? "Authorize Google Workspace" : "Sign in with Google"}
                    </button>
                    <p className="oauth-help-text" style={{ marginTop: '1rem', color: '#888', fontSize: '0.9rem' }}>
                      This will open a browser window to authorize access to Google Sheets and Apps Script.
                    </p>
                  </div>
                </div>
              )}

              {!checkingOAuthToken && hasValidOAuthToken && (
                <>
                  <div className="cloud-oauth-actions" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <button
                      onClick={handleReSignIn}
                      className="btn btn-secondary"
                      style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                      title="Re-sign in to update Google OAuth scopes (required for creating spreadsheet copies)"
                    >
                      <FontAwesomeIcon icon={faSync} style={{ marginRight: '0.5rem' }} />
                      Re-sign in to Update Scopes
                    </button>
                  </div>

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
                        const hasScriptContent = copiesWithScript.has(templateId);
                        const scriptCopyId = copiesWithScript.get(templateId);

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
                                <div className="running-servers-card-metrics cloud-server-metrics">
                                  <div className="running-servers-metric cloud-server-metric">
                                    <FontAwesomeIcon icon={faCloud} />
                                    <div className="cloud-metric-content">
                                      <span className="running-servers-metric-label">Template:</span>
                                      <span className="running-servers-metric-value cloud-metric-value">
                                        {template.address}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="running-servers-metric cloud-server-metric">
                                    <FontAwesomeIcon icon={faCloud} />
                                    <div className="cloud-metric-content">
                                      <span className="running-servers-metric-label">Copy ID:</span>
                                      <span className="running-servers-metric-value cloud-metric-value">
                                        {copyId}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="running-servers-card-actions">
                                  {hasScriptContent && scriptCopyId && (
                                    <button
                                      className="view-script-button"
                                      onClick={() => {
                                        if (onOpenScriptEditor) {
                                          onOpenScriptEditor(scriptCopyId);
                                        }
                                      }}
                                      title="View script content in editor"
                                    >
                                      <FontAwesomeIcon icon={faCode} />
                                      <span>View Script</span>
                                    </button>
                                  )}
                                  {copyId && (
                                    <button
                                      className="delete-copy-button"
                                      onClick={() => handleDeleteTemplateCopy(copyId, templateId)}
                                      title="Delete this template copy (debug)"
                                    >
                                      <FontAwesomeIcon icon={faTrash} />
                                      <span>Delete</span>
                                    </button>
                                  )}
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
                                  disabled={creatingCopyId === templateId}
                                  onClick={async () => {
                                    await handleCreateTemplateCopy(templateId, template);
                                  }}
                                >
                                  {creatingCopyId === templateId ? (
                                    <>
                                      <FontAwesomeIcon icon={faSpinner} spin />
                                      <span>Creating...</span>
                                    </>
                                  ) : (
                                    <>
                                  <FontAwesomeIcon icon={faPlus} />
                                  <span>Create Server</span>
                                    </>
                                  )}
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

