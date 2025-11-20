import { ipcMain, BrowserWindow } from 'electron';
import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import Store from 'electron-store';

interface StoredSession {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
  user: User;
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
    };
    this.store.set('session', storedSession);
    this.currentSession = session;
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

    // Check if session is expired
    if (storedSession.expires_at && storedSession.expires_at < Date.now() / 1000) {
      // Try to refresh the session
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: storedSession.refresh_token,
      });

      if (error || !data.session) {
        this.clearSession();
        return null;
      }

      this.saveSession(data.session);
      return data.session;
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
  private clearSession(): void {
    this.store.delete('session');
    this.currentSession = null;
  }

  /**
   * Get current session
   */
  async getSession(): Promise<{ session: Session | null; user: User | null }> {
    if (this.currentSession) {
      return { session: this.currentSession, user: this.currentSession.user };
    }

    const session = await this.loadSession();
    return { session, user: session?.user || null };
  }

  /**
   * Sign in with OAuth provider
   */
  async signInWithOAuth(provider: 'google' | 'github'): Promise<{ success: boolean; error?: string }> {
    const supabase = this.getSupabase();
    if (!supabase) {
      return { success: false, error: 'Supabase not initialized. Check environment variables.' };
    }

    try {
      // Use custom redirect URL for Electron
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          skipBrowserRedirect: false,
          redirectTo: 'egdesk://auth/callback',
        },
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
  async signOut(): Promise<{ success: boolean; error?: string }> {
    const supabase = this.getSupabase();
    
    if (supabase && this.currentSession) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Sign out error:', error);
      }
    }

    this.clearSession();
    return { success: true };
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
    ipcMain.handle('auth:sign-in-google', async () => {
      return await this.signInWithOAuth('google');
    });

    // Sign in with GitHub
    ipcMain.handle('auth:sign-in-github', async () => {
      return await this.signInWithOAuth('github');
    });

    // Sign out
    ipcMain.handle('auth:sign-out', async () => {
      return await this.signOut();
    });

    // Handle OAuth callback
    ipcMain.handle('auth:handle-callback', async (_, url: string) => {
      return await this.handleOAuthCallback(url);
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

