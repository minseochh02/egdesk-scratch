import { ipcMain, BrowserWindow } from 'electron';
import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import Store from 'electron-store';

interface StoredSession {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
  user: User;
  provider_token?: string; // Google OAuth provider token for API calls
  provider_refresh_token?: string; // Google OAuth provider refresh token
}

export class AuthService {
  private supabase: SupabaseClient | null = null;
  private store: Store;
  private authWindow: BrowserWindow | null = null;
  private currentSession: Session | null = null;
  private oauthWindow: BrowserWindow | null = null;

  constructor() {
    this.store = new Store({
      name: 'egdesk-auth',
      encryptionKey: 'egdesk-auth-encryption-key'
    });
  }

  /**
   * Initialize Supabase client with environment variables
   */
  private initializeSupabase(): boolean {
    const supabaseUrl = process.env.SUPABASE_URL || 'https://cbptgzaubhcclkmvkiua.supabase.co';
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase environment variables');
      return false;
    }

    try {
      this.supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: false, // We'll handle persistence ourselves
          detectSessionInUrl: true,
        },
      });
      return true;
    } catch (error) {
      console.error('Failed to initialize Supabase client:', error);
      return false;
    }
  }

  /**
   * Get the Supabase client, initializing if needed
   */
  private getSupabase(): SupabaseClient | null {
    if (!this.supabase) {
      this.initializeSupabase();
    }
    return this.supabase;
  }

  /**
   * Save session to encrypted store
   */
  private saveSession(session: Session): void {
    const storedSession: StoredSession = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      expires_in: session.expires_in,
      user: session.user,
      // Save Google provider token if available (for Google API calls)
      provider_token: (session as any).provider_token,
      provider_refresh_token: (session as any).provider_refresh_token,
    };
    
    // Store session with user ID as key for multi-account support
    const userId = session.user?.id;
    if (userId) {
      const accounts = this.store.get('accounts', {}) as Record<string, StoredSession>;
      accounts[userId] = storedSession;
      this.store.set('accounts', accounts);
      console.log(`💾 Saved session for account: ${session.user?.email} (${userId})`);
    }
    
    // Also save as 'session' for backward compatibility (current active session)
    this.store.set('session', storedSession);
    this.currentSession = session;
    
    // Also save Google OAuth token separately if it's a Google provider token
    // Check if user signed in with Google (either through provider_token or user metadata)
    const isGoogleAuth = (session as any).provider_token || 
                         session.user?.app_metadata?.provider === 'google' ||
                         session.user?.identities?.some((id: any) => id.provider === 'google');
    
    if (isGoogleAuth) {
      // Try to get provider token from various sources
      const providerToken = (session as any).provider_token || 
                           session.user?.identities?.find((id: any) => id.provider === 'google')?.identity_data?.access_token;
      
      if (providerToken) {
        const googleToken = {
          access_token: providerToken,
          refresh_token: (session as any).provider_refresh_token || 
                        session.user?.identities?.find((id: any) => id.provider === 'google')?.identity_data?.refresh_token,
          expires_at: session.expires_at,
          scopes: (session as any).provider_scopes || [],
          saved_at: Date.now(),
        };
        this.store.set('google_workspace_token', googleToken);
        console.log('💾 Saved Google Workspace OAuth token to electron-store');
      } else {
        // Even without provider token, save session info for Google auth
        // The Supabase access token can be used to get provider token via Supabase API
        const googleToken = {
          supabase_session: true,
          expires_at: session.expires_at,
          user_id: session.user?.id,
          saved_at: Date.now(),
        };
        this.store.set('google_workspace_token', googleToken);
        console.log('💾 Saved Google Workspace session info to electron-store (provider token will be retrieved via Supabase)');
      }
    }
  }

  /**
   * Load session from store
   */
  private async loadSession(): Promise<Session | null> {
    const storedSession = this.store.get('session') as StoredSession | undefined;
    
    if (!storedSession) {
      return null;
    }

    const supabase = this.getSupabase();
    if (!supabase) {
      return null;
    }

    const now = Date.now() / 1000;
    const buffer = 5 * 60; // 5 minutes buffer to refresh before actual expiration
    
    // Check if session is expired or about to expire
    if (!storedSession.expires_at || storedSession.expires_at < now + buffer) {
      console.log('🔄 Session expired or about to expire, refreshing...', {
        expiresAt: storedSession.expires_at,
        now: now,
        expired: storedSession.expires_at ? storedSession.expires_at < now : 'no expiry',
      });
      
      // Try to refresh the session
      try {
        const { data, error } = await supabase.auth.refreshSession({
          refresh_token: storedSession.refresh_token,
        });

        if (error) {
          console.error('❌ Failed to refresh session:', error);
          // If refresh fails, clear session
          this.clearSession();
          return null;
        }

        if (!data.session) {
          console.error('❌ Refresh returned no session');
          this.clearSession();
          return null;
        }

        console.log('✅ Session refreshed successfully');
        // Save refreshed session (this will also update google_workspace_token if it's Google auth)
        this.saveSession(data.session);
        return data.session;
      } catch (error) {
        console.error('❌ Exception during session refresh:', error);
        this.clearSession();
        return null;
      }
    }

    // Session is still valid
    const session: Session = {
      access_token: storedSession.access_token,
      refresh_token: storedSession.refresh_token,
      expires_at: storedSession.expires_at,
      expires_in: storedSession.expires_in,
      user: storedSession.user,
      token_type: 'bearer',
    };

    this.currentSession = session;
    return session;
  }

  /**
   * Clear session from store
   */
  private clearSession(userId?: string): void {
    if (userId) {
      // Remove specific account
      const accounts = this.store.get('accounts', {}) as Record<string, StoredSession>;
      delete accounts[userId];
      this.store.set('accounts', accounts);
      console.log(`🗑️ Removed account: ${userId}`);
    }
    
    // Clear current session
    this.store.delete('session');
    this.currentSession = null;
  }

  /**
   * Get all stored accounts
   */
  getAllAccounts(): Array<{ userId: string; email: string; user: User }> {
    const accounts = this.store.get('accounts', {}) as Record<string, StoredSession>;
    return Object.entries(accounts).map(([userId, session]) => ({
      userId,
      email: session.user?.email || 'Unknown',
      user: session.user,
    }));
  }

  /**
   * Switch to a different account
   */
  async switchAccount(userId: string): Promise<{ success: boolean; error?: string; session?: Session }> {
    try {
      const accounts = this.store.get('accounts', {}) as Record<string, StoredSession>;
      const accountSession = accounts[userId];
      
      if (!accountSession) {
        return { success: false, error: 'Account not found' };
      }

      // Set this account as the current session
      this.store.set('session', accountSession);
      
      // Load and refresh the session if needed
      const supabase = this.getSupabase();
      if (!supabase) {
        return { success: false, error: 'Supabase not initialized' };
      }

      // Check if session needs refresh
      const now = Date.now() / 1000;
      const buffer = 5 * 60;
      
      if (!accountSession.expires_at || accountSession.expires_at < now + buffer) {
        // Refresh the session
        const { data, error } = await supabase.auth.refreshSession({
          refresh_token: accountSession.refresh_token,
        });

        if (error || !data.session) {
          return { success: false, error: error?.message || 'Failed to refresh session' };
        }

        this.saveSession(data.session);
        this.currentSession = data.session;
        return { success: true, session: data.session };
      }

      // Session is still valid
      const session: Session = {
        access_token: accountSession.access_token,
        refresh_token: accountSession.refresh_token,
        expires_at: accountSession.expires_at,
        expires_in: accountSession.expires_in,
        user: accountSession.user,
        token_type: 'bearer',
      };

      this.currentSession = session;
      return { success: true, session };
    } catch (error: any) {
      console.error('Error switching account:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current session
   */
  async getSession(): Promise<{ session: Session | null; user: User | null }> {
    // Check if cached session exists and is still valid
    if (this.currentSession) {
      // Check if session is expired (with 5 minute buffer to refresh before actual expiration)
      const now = Date.now() / 1000;
      const expiresAt = this.currentSession.expires_at || 0;
      const buffer = 5 * 60; // 5 minutes buffer
      
      // If session expires within the buffer time, refresh it
      if (expiresAt > now + buffer) {
        // Session is still valid, return it
        return { session: this.currentSession, user: this.currentSession.user };
      } else {
        // Session is expired or about to expire, clear cache and reload
        console.log('🔄 Cached session expired or about to expire, refreshing...');
        this.currentSession = null;
      }
    }

    // Load session (will refresh if expired)
    const session = await this.loadSession();
    return { session, user: session?.user || null };
  }

  /**
   * Sign in with OAuth provider
   */
  async signInWithOAuth(provider: 'google' | 'github', scopes?: string): Promise<{ success: boolean; error?: string }> {
    const supabase = this.getSupabase();
    if (!supabase) {
      return { success: false, error: 'Supabase not initialized. Check environment variables.' };
    }

    try {
      // Use custom redirect URL for Electron
      const options: any = {
        skipBrowserRedirect: false,
        redirectTo: 'egdesk://auth/callback',
        queryParams: {
          // Use 'select_account' to allow users to choose an account, but don't force it if they're already signed in
          // This allows keeping the current session active in the browser if desired, 
          // while still showing the account chooser when initiating a new sign-in flow.
          prompt: 'select_account',
          access_type: 'offline', // Request refresh token to keep session alive
        },
      };

      // Add custom scopes if provided
      if (scopes) {
        options.scopes = scopes;
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options,
      });

      if (error) {
        console.error('OAuth error:', error);
        return { success: false, error: error.message };
      }

      // Open OAuth URL in a controlled BrowserWindow so we can close it after auth
      if (data.url) {
        this.openOAuthWindow(data.url);
        return { success: true };
      }

      return { success: false, error: 'No OAuth URL generated' };
    } catch (error: any) {
      console.error('Sign in error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Open OAuth URL in a controlled browser window
   */
  private openOAuthWindow(url: string): void {
    // Close existing OAuth window if any
    if (this.oauthWindow && !this.oauthWindow.isDestroyed()) {
      this.oauthWindow.close();
    }

    // Create a new browser window for OAuth
    this.oauthWindow = new BrowserWindow({
      width: 600,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
      title: 'Sign In',
      autoHideMenuBar: true,
    });

    // Listen for navigation to detect OAuth callback
    this.oauthWindow.webContents.on('will-navigate', (event, navigationUrl) => {
      console.log('OAuth window navigating to:', navigationUrl);
      
      if (navigationUrl.startsWith('egdesk://auth/callback')) {
        event.preventDefault();
        console.log('Intercepted OAuth callback, handling and closing window...');
        // Close window immediately
        this.closeOAuthWindow();
        // Handle callback (protocol handler will also catch it)
        this.handleOAuthCallback(navigationUrl).then((result) => {
          console.log('OAuth callback handled:', result);
        });
      }
    });

    // Also listen for redirects that don't trigger will-navigate
    this.oauthWindow.webContents.on('did-navigate', (event, navigationUrl) => {
      console.log('OAuth window navigated to:', navigationUrl);
      
      if (navigationUrl.startsWith('egdesk://auth/callback')) {
        console.log('Detected OAuth callback in did-navigate, handling and closing window...');
        // Close window immediately
        this.closeOAuthWindow();
        // Handle callback (protocol handler will also catch it)
        this.handleOAuthCallback(navigationUrl).then((result) => {
          console.log('OAuth callback handled:', result);
        });
      }
    });

    // Listen for page title updates (Google shows "approved" in title)
    this.oauthWindow.webContents.on('page-title-updated', async (event, title) => {
      console.log('OAuth window title updated:', title);
      
      // Check if we're on a callback page by checking the URL
      const currentUrl = this.oauthWindow?.webContents.getURL();
      if (currentUrl && currentUrl.includes('egdesk://auth/callback')) {
        console.log('Detected callback in title update, handling and closing window...');
        // Close window immediately
        this.closeOAuthWindow();
        // Handle callback (protocol handler will also catch it)
        const result = await this.handleOAuthCallback(currentUrl);
        console.log('OAuth callback handled:', result);
      } else if (title.toLowerCase().includes('approved') || title.toLowerCase().includes('success')) {
        // If title shows "approved" but URL hasn't changed yet, check URL after a short delay
        setTimeout(() => {
          const url = this.oauthWindow?.webContents.getURL();
          if (url && url.includes('egdesk://auth/callback')) {
            console.log('Detected callback after title update, handling and closing window...');
            this.closeOAuthWindow();
            this.handleOAuthCallback(url).then((result) => {
              console.log('OAuth callback handled:', result);
            });
          }
        }, 500);
      }
    });

    // Load the OAuth URL
    this.oauthWindow.loadURL(url);

    // Clean up reference when window is closed
    this.oauthWindow.on('closed', () => {
      this.oauthWindow = null;
    });

    console.log('✅ OAuth window opened');
  }

  /**
   * Close the OAuth window
   */
  closeOAuthWindow(): void {
    if (this.oauthWindow && !this.oauthWindow.isDestroyed()) {
      console.log('🔒 Closing OAuth window');
      this.oauthWindow.close();
      this.oauthWindow = null;
    }
  }

  /**
   * Handle OAuth callback
   */
  async handleOAuthCallback(url: string): Promise<{ success: boolean; error?: string }> {
    const supabase = this.getSupabase();
    if (!supabase) {
      return { success: false, error: 'Supabase not initialized' };
    }

    try {
      console.log('Processing OAuth callback URL:', url);

      // Parse the URL - tokens might be in hash (implicit flow) or query params (PKCE flow)
      const urlObj = new URL(url);
      
      // Check for hash fragment (implicit flow: #access_token=...&refresh_token=...)
      const hash = urlObj.hash.substring(1); // Remove leading #
      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      if (accessToken) {
        console.log('Found access token in hash (implicit flow)');
        
        // Use setSession to set the tokens directly
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        });

        if (error) {
          console.error('Session setup error:', error);
          return { success: false, error: error.message };
        }

      if (data.session) {
        console.log('✅ Session established from implicit flow');
        
        // Extract provider token from URL if available (for Google OAuth)
        const providerToken = hashParams.get('provider_token') || accessToken;
        if (providerToken && providerToken !== accessToken) {
          // Store provider token in session metadata
          (data.session as any).provider_token = providerToken;
          (data.session as any).provider_refresh_token = hashParams.get('provider_refresh_token') || refreshToken;
        }
        
        this.saveSession(data.session);
        
        // Close the OAuth window after successful auth
        this.closeOAuthWindow();
        
        return { success: true };
      }

        return { success: false, error: 'No session returned from setSession' };
      }

      // Check for code (PKCE flow: ?code=...)
      const code = urlObj.searchParams.get('code');

      if (code) {
        console.log('Found authorization code (PKCE flow)');
        
        // Exchange code for session
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          console.error('Code exchange error:', error);
          return { success: false, error: error.message };
        }

      if (data.session) {
        console.log('✅ Session established from PKCE flow');
        
        // Try to get provider token from user's identity
        // Supabase stores provider tokens in user.identities
        if (data.user?.identities && data.user.identities.length > 0) {
          const googleIdentity = data.user.identities.find((id: any) => id.provider === 'google');
          if (googleIdentity) {
            // Provider token might be in identity metadata
            (data.session as any).provider_token = googleIdentity.identity_data?.access_token;
            (data.session as any).provider_refresh_token = googleIdentity.identity_data?.refresh_token;
          }
        }
        
        this.saveSession(data.session);
        
        // Close the OAuth window after successful auth
        this.closeOAuthWindow();
        
        return { success: true };
      }

        return { success: false, error: 'No session returned from code exchange' };
      }

      // No valid auth data found
      console.error('No authorization code or access token found in callback URL');
      return { success: false, error: 'No authorization data found in callback' };
    } catch (error: any) {
      console.error('Callback handling error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sign out
   */
  async signOut(userId?: string): Promise<{ success: boolean; error?: string }> {
    // If signing out a specific account, just remove it from storage
    if (userId) {
      this.clearSession(userId);
      return { success: true };
    }

    // Sign out current session
    const supabase = this.getSupabase();
    
    if (supabase && this.currentSession) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Sign out error:', error);
      }
    }

    this.clearSession();
    // Also clear Google Workspace token
    this.store.delete('google_workspace_token');
    return { success: true };
  }

  /**
   * Get Google Workspace OAuth token from store
   * Automatically refreshes if expired by checking Supabase session
   */
  async getGoogleWorkspaceToken(): Promise<{ access_token?: string; refresh_token?: string; expires_at?: number; scopes?: string[] } | null> {
    const token = this.store.get('google_workspace_token') as any;
    
    if (!token) {
      return null;
    }

    // Check if token is expired
    const isExpired = token.expires_at && token.expires_at * 1000 < Date.now();
    
    if (isExpired) {
      console.log('🔄 Google OAuth token expired, attempting to refresh via Supabase session...');
      
      try {
        // Get a fresh session (this will auto-refresh if needed)
        const { session, user } = await this.getSession();
        
        if (!session) {
          console.error('❌ No Supabase session available for Google token refresh');
          return null; // Can't refresh without a session
        }
        
        // Check if this is a Google auth session
        const isGoogleAuth = 
          session.user?.app_metadata?.provider === 'google' ||
          session.user?.identities?.some((id: any) => id.provider === 'google');
        
        if (!isGoogleAuth) {
          console.error('❌ Current session is not a Google auth session');
          return null;
        }
        
        // Try to get provider token from various sources
        const providerToken = (session as any).provider_token || 
                             session.user?.identities?.find((id: any) => id.provider === 'google')?.identity_data?.access_token;
        
        if (!providerToken) {
          console.error('❌ No provider token found in refreshed session');
          return null;
        }
        
        // Update token with new provider token from refreshed session
        const updatedToken = {
          ...token,
          access_token: providerToken,
          refresh_token: (session as any).provider_refresh_token || 
                        session.user?.identities?.find((id: any) => id.provider === 'google')?.identity_data?.refresh_token || 
                        token.refresh_token,
          expires_at: session.expires_at,
          scopes: (session as any).provider_scopes || token.scopes || [],
          saved_at: Date.now(),
        };
        this.store.set('google_workspace_token', updatedToken);
        console.log('✅ Google OAuth token refreshed via Supabase session');
        return updatedToken;
      } catch (error) {
        console.error('❌ Error refreshing Google OAuth token:', error);
        return null; // Return null instead of expired token
      }
    }

    return token;
  }

  /**
   * Register IPC handlers for authentication
   */
  registerHandlers(): void {
    // Get current session
    ipcMain.handle('auth:get-session', async () => {
      try {
        const { session, user } = await this.getSession();
        return {
          success: true,
          session,
          user,
        };
      } catch (error: any) {
        console.error('Get session error:', error);
        return {
          success: false,
          error: error.message,
          session: null,
          user: null,
        };
      }
    });

    // Sign in with Google
    ipcMain.handle('auth:sign-in-google', async (_, scopes?: string) => {
      return await this.signInWithOAuth('google', scopes);
    });

    // Sign in with GitHub
    ipcMain.handle('auth:sign-in-github', async () => {
      return await this.signInWithOAuth('github');
    });

    // Sign out
    ipcMain.handle('auth:sign-out', async (_, userId?: string) => {
      return await this.signOut(userId);
    });

    // Get all accounts
    ipcMain.handle('auth:get-all-accounts', async () => {
      try {
        const accounts = this.getAllAccounts();
        return { success: true, accounts };
      } catch (error: any) {
        console.error('Error getting accounts:', error);
        return { success: false, error: error.message, accounts: [] };
      }
    });

    // Switch account
    ipcMain.handle('auth:switch-account', async (_, userId: string) => {
      return await this.switchAccount(userId);
    });

    // Handle OAuth callback
    ipcMain.handle('auth:handle-callback', async (_, url: string) => {
      return await this.handleOAuthCallback(url);
    });

    // Save session from renderer (for Supabase direct auth)
    ipcMain.handle('auth:save-session', async (_, session: Session) => {
      try {
        this.saveSession(session);
        return { success: true };
      } catch (error: any) {
        console.error('Error saving session:', error);
        return { success: false, error: error.message };
      }
    });

    // Get Google Workspace token
    ipcMain.handle('auth:get-google-workspace-token', async () => {
      const token = await this.getGoogleWorkspaceToken();
      return {
        success: true,
        token,
      };
    });

    // Call Supabase Edge Function (from main process to avoid CORS)
    ipcMain.handle('auth:call-edge-function', async (_, { url, method = 'POST', body, headers = {} }) => {
      try {
        console.log('📡 callEdgeFunction called:', { url, method, hasBody: !!body, headersKeys: Object.keys(headers) });
        
        const { session } = await this.getSession();
        if (!session) {
          console.error('❌ No session found in callEdgeFunction');
          return {
            success: false,
            error: 'No session found. Please sign in first.',
          };
        }

        console.log('✅ Session found:', {
          hasAccessToken: !!session.access_token,
          tokenLength: session.access_token.length,
          tokenPrefix: session.access_token.substring(0, 30) + '...',
        });

        // Add user's JWT token to headers
        const requestHeaders = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          ...headers, // This includes 'apikey' from the renderer
        };

        console.log('📤 Request headers:', {
          hasAuthorization: !!requestHeaders.Authorization,
          hasApikey: !!requestHeaders.apikey,
          authorizationLength: requestHeaders.Authorization?.length,
          apikeyLength: requestHeaders.apikey?.length,
        });

        console.log('📤 Making fetch request to:', url);
        
        // Debug: Print exact curl command to replicate this request
        const bodyString = body ? JSON.stringify(body) : '';
        const curlCommand = `curl -X ${method} "${url}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${session.access_token}" \\
  -H "apikey: ${requestHeaders.apikey}" \\
  ${bodyString ? `-d '${bodyString}'` : ''}`;
        console.log('📋 CURL command to replicate this request:');
        console.log(curlCommand);
        
        const response = await fetch(url, {
          method,
          headers: requestHeaders,
          body: body ? JSON.stringify(body) : undefined,
        });

        console.log('📥 Response received:', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
        });

        const responseText = await response.text();
        
        let data;
        try {
          data = JSON.parse(responseText);
          console.log('📥 Response body (parsed):', JSON.stringify(data).substring(0, 500));
        } catch {
          data = { raw: responseText };
          console.log('⚠️ Could not parse response as JSON');
        }

        return {
          success: response.ok,
          status: response.status,
          statusText: response.statusText,
          data,
          error: !response.ok ? (data.error || data.details?.message || response.statusText) : null,
        };
      } catch (error: any) {
        console.error('❌ Error calling edge function:', error);
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
        });
        return {
          success: false,
          error: error.message || 'Unknown error',
        };
      }
    });

    console.log('✅ Auth service handlers registered');
  }

  /**
   * Setup deep link handler for OAuth callbacks
   */
  setupDeepLinkHandler(getMainWindow: () => BrowserWindow | null): void {
    // Handle the protocol URL when app is already running
    const handleUrl = async (url: string) => {
      console.log('Deep link received:', url);
      
      if (url.startsWith('egdesk://auth/callback')) {
        const result = await this.handleOAuthCallback(url);
        
        console.log('OAuth callback result:', result);
        
        // Get the current main window
        const mainWindow = getMainWindow();
        
        // Notify renderer about auth state change
        if (mainWindow && !mainWindow.isDestroyed()) {
          console.log('Sending auth:state-changed event to renderer...');
          
          const authData = {
            success: result.success,
            session: this.currentSession,
            user: this.currentSession?.user || null,
          };
          
          console.log('Auth data being sent:', { 
            success: authData.success, 
            hasSession: !!authData.session,
            hasUser: !!authData.user 
          });
          
          mainWindow.webContents.send('auth:state-changed', authData);
          
          console.log('✅ Auth state change event sent to renderer');
        } else {
          console.error('❌ Main window not available to send auth state change');
        }
      }
    };

    // Platform-specific protocol handling
    if (process.platform === 'darwin') {
      // macOS
      const { app } = require('electron');
      app.on('open-url', (event, url) => {
        event.preventDefault();
        handleUrl(url);
      });
    } else if (process.platform === 'win32') {
      // Windows - handled via second-instance
      const { app } = require('electron');
      const gotTheLock = app.requestSingleInstanceLock();

      if (!gotTheLock) {
        app.quit();
      } else {
        app.on('second-instance', (event, commandLine) => {
          // Protocol URL is in command line on Windows
          const url = commandLine.find(arg => arg.startsWith('egdesk://'));
          if (url) {
            handleUrl(url);
          }

          // Focus the window
          const mainWindow = getMainWindow();
          if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
          }
        });
      }
    }
  }
}

// Singleton instance
let authServiceInstance: AuthService | null = null;

export function getAuthService(): AuthService {
  if (!authServiceInstance) {
    authServiceInstance = new AuthService();
  }
  return authServiceInstance;
}

