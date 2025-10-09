import { BrowserWindow } from 'electron';
import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

// Use OAuth2Client from googleapis for compatibility
type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

export interface GoogleAuthResult {
  success: boolean;
  error?: string;
  user?: {
    email: string;
    name: string;
    picture?: string;
    id: string;
  };
  tokens?: {
    access_token: string;
    refresh_token?: string;
    expiry_date?: number;
  };
}

export class GoogleAuthHandler {
  private oauth2Client: OAuth2Client | null = null;
  private credentials: any = null;

  constructor() {
    this.loadCredentials();
  }

  /**
   * Load Google OAuth credentials from the client_secret JSON file
   */
  private loadCredentials(): void {
    try {
      // Get the app root path
      const appPath = process.cwd();
      const credentialsPath = path.join(
        appPath,
        'client_secret_862784563181-30ua334k8egt3ufiivo273ldmbi9pqbb.apps.googleusercontent.com.json'
      );

      if (!fs.existsSync(credentialsPath)) {
        console.error('Google OAuth credentials file not found at:', credentialsPath);
        return;
      }

      const credentialsContent = fs.readFileSync(credentialsPath, 'utf8');
      this.credentials = JSON.parse(credentialsContent);
      console.log('✅ Google OAuth credentials loaded successfully');
    } catch (error) {
      console.error('Failed to load Google OAuth credentials:', error);
    }
  }

  /**
   * Initialize OAuth2 client with credentials
   */
  private initializeOAuth2Client(): OAuth2Client {
    if (!this.credentials || !this.credentials.installed) {
      throw new Error('Google OAuth credentials not loaded');
    }

    const { client_id, client_secret, redirect_uris } = this.credentials.installed;

    // Use the first redirect URI or default to localhost
    const redirectUri = redirect_uris[0] || 'http://localhost';

    // Use google.auth.OAuth2 from googleapis for full compatibility
    this.oauth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirectUri
    );

    return this.oauth2Client;
  }

  /**
   * Start the Google OAuth sign-in flow
   */
  async signIn(): Promise<GoogleAuthResult> {
    try {
      if (!this.credentials) {
        return {
          success: false,
          error: 'Google OAuth credentials not loaded',
        };
      }

      const oauth2Client = this.initializeOAuth2Client();

      // Generate authorization URL
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/userinfo.email',
          'openid',
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/gmail.compose',
          'https://www.googleapis.com/auth/gmail.modify',
        ],
        prompt: 'consent', // Force consent screen to get refresh token
      });

      // Create a new browser window for OAuth
      const authWindow = new BrowserWindow({
        width: 600,
        height: 800,
        show: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      authWindow.loadURL(authUrl);

      // Wait for the redirect
      return new Promise((resolve) => {
        // Handle the redirect URL
        authWindow.webContents.on('will-redirect', async (event, url) => {
          if (url.startsWith('http://localhost')) {
            event.preventDefault();
            
            try {
              // Extract the authorization code from the URL
              const urlObj = new URL(url);
              const code = urlObj.searchParams.get('code');

              if (!code) {
                authWindow.close();
                resolve({
                  success: false,
                  error: 'Authorization code not found in redirect URL',
                });
                return;
              }

              // Exchange the authorization code for tokens
              const { tokens } = await oauth2Client.getToken(code);
              oauth2Client.setCredentials(tokens);

              // Get user info using the oauth2Client directly
              const response = await oauth2Client.request({
                url: 'https://www.googleapis.com/oauth2/v2/userinfo',
              });

              const userInfo = response.data as any;

              // Store the authenticated client for future API calls
              this.oauth2Client = oauth2Client;
              
              console.log('✅ Google OAuth sign-in successful');
              console.log('✅ Stored OAuth2Client with scopes:', tokens.scope);
              console.log('✅ Access token present:', !!tokens.access_token);

              authWindow.close();

              resolve({
                success: true,
                user: {
                  email: userInfo.email || '',
                  name: userInfo.name || '',
                  picture: userInfo.picture || undefined,
                  id: userInfo.id || '',
                },
                tokens: {
                  access_token: tokens.access_token || '',
                  refresh_token: tokens.refresh_token || undefined,
                  expiry_date: tokens.expiry_date || undefined,
                },
              });
            } catch (error: any) {
              authWindow.close();
              resolve({
                success: false,
                error: `Failed to exchange code for tokens: ${error.message}`,
              });
            }
          }
        });

        // Handle window close
        authWindow.on('closed', () => {
          resolve({
            success: false,
            error: 'Authentication window was closed by user',
          });
        });

        // Handle navigation errors
        authWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
          console.error('Auth window failed to load:', errorCode, errorDescription);
        });
      });
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error during Google sign-in',
      };
    }
  }

  /**
   * Sign out and clear stored credentials
   */
  async signOut(): Promise<{ success: boolean; error?: string }> {
    try {
      if (this.oauth2Client) {
        // Revoke the token
        await this.oauth2Client.revokeCredentials();
        this.oauth2Client = null;
      }

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error during sign out',
      };
    }
  }

  /**
   * Check if user is currently signed in
   */
  isSignedIn(): boolean {
    return this.oauth2Client !== null && this.oauth2Client.credentials.access_token !== undefined;
  }

  /**
   * Get the current OAuth2 client
   */
  getOAuth2Client(): OAuth2Client | null {
    return this.oauth2Client;
  }

  /**
   * Get Gmail API client
   */
  getGmailClient() {
    if (!this.oauth2Client) {
      throw new Error('User not authenticated. Please sign in first.');
    }

    console.log('🔑 Getting Gmail client...');
    console.log('🔑 OAuth2Client credentials:', {
      access_token: this.oauth2Client.credentials.access_token?.substring(0, 20) + '...',
      refresh_token: !!this.oauth2Client.credentials.refresh_token,
      expiry_date: this.oauth2Client.credentials.expiry_date,
    });

    // Now using the correct OAuth2Client from googleapis, no type assertion needed
    return google.gmail({
      version: 'v1',
      auth: this.oauth2Client,
    });
  }

  /**
   * List Gmail messages with full content
   */
  async listMessages(maxResults: number = 10): Promise<any> {
    try {
      console.log('📧 Listing Gmail messages with content...');
      console.log('📧 OAuth2Client exists?', !!this.oauth2Client);
      console.log('📧 Has access token?', !!this.oauth2Client?.credentials?.access_token);
      
      const gmail = this.getGmailClient();
      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults,
      });

      console.log('📧 Successfully fetched message IDs:', response.data.messages?.length || 0);

      // If no messages, return empty array
      if (!response.data.messages || response.data.messages.length === 0) {
        return {
          success: true,
          messages: [],
          resultSizeEstimate: response.data.resultSizeEstimate,
        };
      }

      // Fetch full message details for each message
      const messagePromises = response.data.messages.map(async (message) => {
        try {
          const messageResponse = await gmail.users.messages.get({
            userId: 'me',
            id: message.id!,
            format: 'full',
          });
          // Extract readable content from the message
          return this.extractMessageContent(messageResponse.data);
        } catch (error: any) {
          console.error(`❌ Failed to fetch message ${message.id}:`, error.message);
          return {
            id: message.id,
            error: error.message || 'Failed to fetch message content',
          };
        }
      });

      // Wait for all messages to be fetched
      const messages = await Promise.all(messagePromises);

      console.log('📧 Successfully fetched full message content for:', messages.length);

      return {
        success: true,
        messages: messages,
        resultSizeEstimate: response.data.resultSizeEstimate,
      };
    } catch (error: any) {
      console.error('❌ Gmail list messages error:', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        status: error.status,
      });
      return {
        success: false,
        error: error.message || 'Failed to list Gmail messages',
      };
    }
  }

  /**
   * Extract readable content from Gmail message
   */
  private extractMessageContent(message: any): any {
    try {
      const headers = message.payload?.headers || [];
      const getHeader = (name: string) => 
        headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const subject = getHeader('Subject');
      const from = getHeader('From');
      const to = getHeader('To');
      const date = getHeader('Date');
      const snippet = message.snippet || '';

      // Extract body content
      let bodyText = '';
      let bodyHtml = '';

      const extractBody = (part: any) => {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
        } else if (part.mimeType === 'text/html' && part.body?.data) {
          bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
        } else if (part.parts) {
          part.parts.forEach(extractBody);
        }
      };

      if (message.payload) {
        extractBody(message.payload);
      }

      return {
        id: message.id,
        threadId: message.threadId,
        subject,
        from,
        to,
        date,
        snippet,
        bodyText: bodyText || snippet,
        bodyHtml,
        labels: message.labelIds || [],
        sizeEstimate: message.sizeEstimate,
        historyId: message.historyId,
        internalDate: message.internalDate,
      };
    } catch (error: any) {
      console.error('❌ Error extracting message content:', error);
      return {
        id: message.id,
        error: 'Failed to extract message content',
        snippet: message.snippet || '',
      };
    }
  }

  /**
   * List Gmail messages with just basic info (faster than full content)
   */
  async listMessagesBasic(maxResults: number = 10): Promise<any> {
    try {
      console.log('📧 Listing Gmail messages (basic info)...');
      
      const gmail = this.getGmailClient();
      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults,
      });

      console.log('📧 Successfully fetched message IDs:', response.data.messages?.length || 0);

      // If no messages, return empty array
      if (!response.data.messages || response.data.messages.length === 0) {
        return {
          success: true,
          messages: [],
          resultSizeEstimate: response.data.resultSizeEstimate,
        };
      }

      // Fetch basic message details (metadata only, no body content)
      const messagePromises = response.data.messages.map(async (message) => {
        try {
          const messageResponse = await gmail.users.messages.get({
            userId: 'me',
            id: message.id!,
            format: 'metadata',
            metadataHeaders: ['Subject', 'From', 'To', 'Date'],
          });
          
          const headers = messageResponse.data.payload?.headers || [];
          const getHeader = (name: string) => 
            headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

          return {
            id: message.id,
            threadId: messageResponse.data.threadId,
            subject: getHeader('Subject'),
            from: getHeader('From'),
            to: getHeader('To'),
            date: getHeader('Date'),
            snippet: messageResponse.data.snippet || '',
            labels: messageResponse.data.labelIds || [],
            sizeEstimate: messageResponse.data.sizeEstimate,
          };
        } catch (error: any) {
          console.error(`❌ Failed to fetch message ${message.id}:`, error.message);
          return {
            id: message.id,
            error: error.message || 'Failed to fetch message content',
          };
        }
      });

      // Wait for all messages to be fetched
      const messages = await Promise.all(messagePromises);

      console.log('📧 Successfully fetched basic message info for:', messages.length);

      return {
        success: true,
        messages: messages,
        resultSizeEstimate: response.data.resultSizeEstimate,
      };
    } catch (error: any) {
      console.error('❌ Gmail list messages error:', error);
      return {
        success: false,
        error: error.message || 'Failed to list Gmail messages',
      };
    }
  }

  /**
   * Get a specific Gmail message
   */
  async getMessage(messageId: string): Promise<any> {
    try {
      const gmail = this.getGmailClient();
      const response = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      return {
        success: true,
        message: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to get Gmail message',
      };
    }
  }

  /**
   * Send an email via Gmail
   */
  async sendEmail(to: string, subject: string, body: string): Promise<any> {
    try {
      const gmail = this.getGmailClient();

      // Create email in RFC 2822 format
      const email = [
        `To: ${to}`,
        'Content-Type: text/plain; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${subject}`,
        '',
        body,
      ].join('\n');

      // Encode email to base64url
      const encodedEmail = Buffer.from(email)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedEmail,
        },
      });

      return {
        success: true,
        messageId: response.data.id,
        threadId: response.data.threadId,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to send email',
      };
    }
  }
}

// Export singleton instance
let googleAuthHandlerInstance: GoogleAuthHandler | null = null;

export function getGoogleAuthHandler(): GoogleAuthHandler {
  if (!googleAuthHandlerInstance) {
    googleAuthHandlerInstance = new GoogleAuthHandler();
  }
  return googleAuthHandlerInstance;
}

