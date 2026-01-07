import { dialog, shell, app, Notification } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Checks if the app has Full Disk Access on macOS
 * @returns true if access is granted, false otherwise
 */
export async function checkFullDiskAccess(): Promise<boolean> {
  // Only check on macOS
  if (process.platform !== 'darwin') {
    return true;
  }

  // Test path in a protected location
  const testPath = path.join(os.homedir(), 'Library', 'Application Support', '.egdesk-test-write-access.tmp');
  
  try {
    // Try to write to a protected location
    fs.writeFileSync(testPath, 'test');
    fs.unlinkSync(testPath);
    return true; // We have access
  } catch (error) {
    console.log('[Full Disk Access] Test write failed:', error);
    return false;
  }
}

/**
 * Prompts the user to grant Full Disk Access
 * @returns true if user opened System Preferences, false if they chose "Later"
 */
export async function requestFullDiskAccess(): Promise<boolean> {
  const result = await dialog.showMessageBox({
    type: 'warning',
    title: 'Full Disk Access Required',
    message: 'EGDesk needs Full Disk Access to function properly.',
    detail: `To grant access:

1. Click "Open System Preferences"
2. Go to Privacy & Security > Full Disk Access
3. Click the lock icon to make changes
4. Add EGDesk to the list (or check the box if already present)
5. Restart EGDesk for changes to take effect

This permission is needed to:
• Save browser automation files
• Access browser profiles
• Create and manage output files
• Store financial data securely`,
    buttons: ['Open System Preferences', 'Later'],
    defaultId: 0,
    cancelId: 1
  });

  if (result.response === 0) {
    // Open System Preferences to the Privacy & Security pane
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles');
    return true;
  }
  
  return false;
}

/**
 * Shows a non-blocking notification about Full Disk Access
 */
export function showFullDiskAccessNotification(): void {
  const notification = new Notification({
    title: 'EGDesk - Permission Required',
    body: 'Some features may not work properly without Full Disk Access. Click here to grant access.',
    silent: true
  });

  notification.on('click', () => {
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles');
  });

  notification.show();
}

/**
 * Checks and handles Full Disk Access with different strategies
 * @param strategy 'blocking' shows dialog, 'notification' shows notification, 'silent' does nothing
 */
export async function handleFullDiskAccess(strategy: 'blocking' | 'notification' | 'silent' = 'notification'): Promise<boolean> {
  const hasAccess = await checkFullDiskAccess();
  
  if (!hasAccess) {
    console.log('[Full Disk Access] Access not granted, using strategy:', strategy);
    
    switch (strategy) {
      case 'blocking':
        await requestFullDiskAccess();
        break;
      case 'notification':
        showFullDiskAccessNotification();
        break;
      case 'silent':
        // Do nothing
        break;
    }
  }
  
  return hasAccess;
}

/**
 * Store the Full Disk Access check result to avoid repeated checks
 */
let cachedAccessStatus: boolean | null = null;

export async function getCachedFullDiskAccess(): Promise<boolean> {
  if (cachedAccessStatus === null) {
    cachedAccessStatus = await checkFullDiskAccess();
  }
  return cachedAccessStatus;
}

export function clearFullDiskAccessCache(): void {
  cachedAccessStatus = null;
}