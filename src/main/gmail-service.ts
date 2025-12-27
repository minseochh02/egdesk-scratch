// src/main/gmail-service.ts
import { google } from 'googleapis';
import * as fs from 'fs';
import { BrowserWindow } from 'electron';
import { getAuthService } from './auth/auth-service'; // Import AuthService

const SCOPES = ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/userinfo.email'];

// The tokenPath and setTokenPath are no longer needed as AuthService handles token persistence.
// Load saved token if exists (AuthService handles token persistence now)
// This function primarily checks if a token is available via AuthService.
export async function loadSavedToken(): Promise<boolean> {
  const authService = getAuthService();
  const token = await authService.getGoogleWorkspaceToken();
  return !!token?.access_token && !!token.expires_at && token.expires_at * 1000 > Date.now();
}

// Save token (now handled by AuthService)
function saveToken(_token: any) {
  console.warn('saveToken in gmail-service.ts is deprecated. Token saving is handled by AuthService.');
}

// Start OAuth flow
export async function authenticate(mainWindow: BrowserWindow): Promise<boolean> {
  const authService = getAuthService();
  const result = await authService.signInWithOAuth('google', SCOPES.join(' '));
  
  if (result.success) {
    // After successful sign-in, check the authentication status
    return await isAuthenticated(); 
  }
  return false;
}

// Check if authenticated
export async function isAuthenticated(): Promise<boolean> {
  const authService = getAuthService();
  const token = await authService.getGoogleWorkspaceToken();
  // Check for presence and expiry of access token
  return !!token?.access_token && !!token.expires_at && token.expires_at * 1000 > Date.now();
}

// Create email with attachments in MIME format
function createEmail(
  to: string,
  subject: string,
  body: string,
  attachments: { filename: string; path: string; mimeType: string }[]
): string {
  const boundary = `boundary_${Date.now()}`;
  
  let email = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    body,
  ];

  // Add attachments
  for (const attachment of attachments) {
    const fileContent = fs.readFileSync(attachment.path);
    const base64Content = fileContent.toString('base64');
    
    email.push(
      `--${boundary}`,
      `Content-Type: ${attachment.mimeType}`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      '',
      base64Content
    );
  }

  email.push(`--${boundary}--`);

  // Encode to base64url
  const rawEmail = email.join('\r\n');
  return Buffer.from(rawEmail)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Send email
export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  attachments: { filename: string; path: string; mimeType: string }[]
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const authService = getAuthService();
      const token = await authService.getGoogleWorkspaceToken();

      if (!token?.access_token) {
        return { success: false, error: 'Google access token not available. Please authenticate.' };
      }

      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expiry_date: token.expires_at ? token.expires_at * 1000 : undefined,
      });
      
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      
      const raw = createEmail(to, subject, body, attachments);
      
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw },
      });

      return { success: true, messageId: response.data.id || undefined };
    } catch (error: any) {
      console.error('Failed to send email:', error);
      return { success: false, error: error.message };
    }
  }

// Disconnect / logout
export function disconnect() {
  const authService = getAuthService();
  authService.signOut('google');
}