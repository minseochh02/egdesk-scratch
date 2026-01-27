// ============================================================================
// INTERCEPTION DRIVER INSTALLER
// ============================================================================
// Handles installation and verification of Interception keyboard driver
// Required for bypassing Korean banking security (TouchEn nxKey, etc.)

const { exec, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * Checks if running on Windows
 * @returns {boolean}
 */
function isWindows() {
  return os.platform() === 'win32';
}

/**
 * Gets path to bundled Interception driver installer
 * @returns {string} Path to install-interception.exe
 */
function getDriverInstallerPath() {
  // In production, driver is bundled in resources/interception
  if (process.env.NODE_ENV === 'production') {
    return path.join(process.resourcesPath, 'interception', 'install-interception.exe');
  }

  // In development, use local resources folder
  return path.join(__dirname, '../../resources/interception/install-interception.exe');
}

/**
 * Checks if Interception driver is installed
 * @returns {Promise<boolean>}
 */
async function isDriverInstalled() {
  if (!isWindows()) {
    console.log('[Interception] Not on Windows, skipping driver check');
    return false;
  }

  try {
    // Check if driver service exists
    const output = execSync('sc query interception', { encoding: 'utf8' }).toString();

    // Driver is installed if service exists
    const isInstalled = output.includes('SERVICE_NAME: interception');
    console.log('[Interception] Driver installed:', isInstalled);
    return isInstalled;
  } catch (error) {
    // Service doesn't exist
    console.log('[Interception] Driver not found');
    return false;
  }
}

/**
 * Installs Interception driver with admin rights
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} { success, error, needsReboot }
 */
async function installDriver(onProgress = console.log) {
  if (!isWindows()) {
    return { success: false, error: 'Not on Windows platform' };
  }

  try {
    const installerPath = getDriverInstallerPath();

    // Check if installer exists
    if (!fs.existsSync(installerPath)) {
      return {
        success: false,
        error: `Installer not found at: ${installerPath}`,
        needsReboot: false
      };
    }

    onProgress('Starting Interception driver installation...');

    // Use sudo-prompt for elevation
    const sudo = require('sudo-prompt');
    const options = {
      name: 'EGDesk Banking Automation',
      icns: '/Applications/Electron.app/Contents/Resources/electron.icns', // Optional
    };

    return new Promise((resolve, reject) => {
      // Run installer with /install flag
      const command = `"${installerPath}" /install`;

      onProgress('Requesting administrator privileges...');

      sudo.exec(command, options, (error, stdout, stderr) => {
        if (error) {
          console.error('[Interception] Installation failed:', error);
          resolve({
            success: false,
            error: error.message,
            needsReboot: false
          });
          return;
        }

        onProgress('Driver installed successfully');
        console.log('[Interception] Installation output:', stdout);

        resolve({
          success: true,
          needsReboot: true,
          message: 'Driver installed. Please restart your computer for changes to take effect.'
        });
      });
    });

  } catch (error) {
    console.error('[Interception] Installation error:', error);
    return {
      success: false,
      error: error.message,
      needsReboot: false
    };
  }
}

/**
 * Uninstalls Interception driver
 * @returns {Promise<Object>}
 */
async function uninstallDriver() {
  if (!isWindows()) {
    return { success: false, error: 'Not on Windows platform' };
  }

  try {
    const installerPath = getDriverInstallerPath();
    const sudo = require('sudo-prompt');
    const options = { name: 'EGDesk Banking Automation' };

    return new Promise((resolve, reject) => {
      const command = `"${installerPath}" /uninstall`;

      sudo.exec(command, options, (error, stdout, stderr) => {
        if (error) {
          resolve({ success: false, error: error.message });
          return;
        }

        resolve({
          success: true,
          needsReboot: true,
          message: 'Driver uninstalled. Please restart your computer.'
        });
      });
    });

  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Shows installation dialog to user
 * @param {Object} mainWindow - Electron BrowserWindow
 * @returns {Promise<boolean>} True if user wants to install
 */
async function promptUserForInstallation(mainWindow) {
  const { dialog } = require('electron');

  const result = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Install Now', 'Cancel'],
    defaultId: 0,
    title: 'Keyboard Driver Required',
    message: 'Banking Automation Driver Installation',
    detail: 'This app requires a keyboard driver to securely automate Korean banking websites.\n\n' +
            'The driver creates a virtual keyboard that bypasses security restrictions.\n\n' +
            '⚠️ Administrator rights required\n' +
            '⚠️ Computer restart required after installation\n\n' +
            'Install now?',
  });

  return result.response === 0; // True if "Install Now" clicked
}

/**
 * Shows reboot prompt to user
 * @param {Object} mainWindow - Electron BrowserWindow
 * @returns {Promise<boolean>} True if user wants to reboot now
 */
async function promptUserForReboot(mainWindow) {
  const { dialog } = require('electron');

  const result = await dialog.showMessageBox(mainWindow, {
    type: 'info',
    buttons: ['Restart Now', 'Restart Later'],
    defaultId: 0,
    title: 'Restart Required',
    message: 'Driver Installation Complete',
    detail: 'The keyboard driver has been installed successfully.\n\n' +
            'Your computer must restart for the driver to take effect.\n\n' +
            'Restart now?',
  });

  if (result.response === 0) {
    // User wants to restart now
    const { app } = require('electron');
    app.relaunch();
    app.exit(0);
    return true;
  }

  return false;
}

/**
 * Complete installation flow with user prompts
 * @param {Object} mainWindow - Electron BrowserWindow
 * @returns {Promise<Object>}
 */
async function runInstallationFlow(mainWindow) {
  try {
    // Check if already installed
    const installed = await isDriverInstalled();
    if (installed) {
      return { success: true, alreadyInstalled: true };
    }

    // Prompt user
    const userWantsInstall = await promptUserForInstallation(mainWindow);
    if (!userWantsInstall) {
      return { success: false, error: 'User cancelled installation' };
    }

    // Install driver
    const result = await installDriver((msg) => {
      console.log('[Interception]', msg);
      // You can send IPC message to renderer to show progress
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('driver-install-progress', msg);
      }
    });

    if (!result.success) {
      return result;
    }

    // Prompt for reboot
    if (result.needsReboot) {
      await promptUserForReboot(mainWindow);
    }

    return result;

  } catch (error) {
    console.error('[Interception] Installation flow error:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  isWindows,
  isDriverInstalled,
  installDriver,
  uninstallDriver,
  promptUserForInstallation,
  promptUserForReboot,
  runInstallationFlow,
};
