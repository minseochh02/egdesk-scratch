// src/main/gmail-ipc.ts
import { ipcMain, BrowserWindow } from 'electron';
import * as GmailService from './gmail-service';

export function registerGmailHandlers(mainWindow: BrowserWindow) {
  // Load token on startup (AuthService handles persistence now)
  // This ensures the GmailService is initialized with any existing token.
  GmailService.loadSavedToken();

  // Check auth status
  ipcMain.handle('gmail-is-authenticated', async () => {
    return await GmailService.isAuthenticated();
  });

  // Authenticate
  ipcMain.handle('gmail-authenticate', async () => {
    return await GmailService.authenticate(mainWindow);
  });

  // Send email with attachments
  ipcMain.handle('gmail-send', async (_, { to, subject, body, attachments }) => {
    if (!(await GmailService.isAuthenticated())) {
      return { success: false, error: 'Not authenticated' };
    }
    return await GmailService.sendEmail(to, subject, body, attachments);
  });

  // Disconnect
  ipcMain.handle('gmail-disconnect', () => {
    GmailService.disconnect();
    return { success: true };
  });

  // Load token on startup
  GmailService.loadSavedToken();
}