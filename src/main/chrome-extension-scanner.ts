import path from 'path';
import fs from 'fs';
import os from 'os';

export interface ChromeExtension {
  id: string;
  name: string;
  version: string;
  description: string;
  iconPath?: string;
  manifestPath: string;
  extensionPath: string;
  profileName: string;
}

export interface ChromeProfile {
  name: string;
  path: string;
  extensions: ChromeExtension[];
}

export class ChromeExtensionScanner {
  /**
   * Get Chrome user data directory based on OS
   */
  static getChromeUserDataDir(): string | null {
    let chromeDir: string;

    switch (process.platform) {
      case 'darwin':
        chromeDir = path.join(os.homedir(), 'Library/Application Support/Google/Chrome');
        break;
      case 'win32':
        chromeDir = path.join(os.homedir(), 'AppData/Local/Google/Chrome/User Data');
        break;
      case 'linux':
        chromeDir = path.join(os.homedir(), '.config/google-chrome');
        break;
      default:
        console.warn('Unsupported platform for Chrome detection:', process.platform);
        return null;
    }

    if (fs.existsSync(chromeDir)) {
      console.log('Found Chrome user data directory:', chromeDir);
      return chromeDir;
    }

    console.warn('Chrome user data directory not found:', chromeDir);
    return null;
  }

  /**
   * Get all Chrome profiles with their extensions
   */
  static getAllProfiles(): ChromeProfile[] {
    const userDataDir = this.getChromeUserDataDir();
    if (!userDataDir) {
      console.log('Chrome user data directory not found');
      return [];
    }

    const profiles: ChromeProfile[] = [];

    try {
      const entries = fs.readdirSync(userDataDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        // Skip non-profile directories
        if (entry.name.startsWith('.') ||
            entry.name === 'Crashpad' ||
            entry.name === 'ShaderCache' ||
            entry.name === 'GrShaderCache') {
          continue;
        }

        const profilePath = path.join(userDataDir, entry.name);

        // Check if this is a valid profile (has Extensions folder)
        const extensionsPath = path.join(profilePath, 'Extensions');

        if (fs.existsSync(extensionsPath)) {
          const profileName = entry.name === 'Default' ? 'Default' : entry.name;
          const extensions = this.scanExtensions(extensionsPath, profileName);

          if (extensions.length > 0) {
            profiles.push({
              name: profileName,
              path: profilePath,
              extensions
            });
          }
        }
      }

      console.log(`Found ${profiles.length} Chrome profiles with extensions`);
      return profiles;
    } catch (error) {
      console.error('Error scanning Chrome profiles:', error);
      return [];
    }
  }

  /**
   * Scan extensions in a profile's Extensions folder
   */
  static scanExtensions(extensionsPath: string, profileName: string): ChromeExtension[] {
    const extensions: ChromeExtension[] = [];

    try {
      const extensionDirs = fs.readdirSync(extensionsPath, { withFileTypes: true });

      for (const extensionDir of extensionDirs) {
        if (!extensionDir.isDirectory()) continue;

        const extensionId = extensionDir.name;
        const extensionBasePath = path.join(extensionsPath, extensionId);

        // Extensions have version folders inside
        try {
          const versionDirs = fs.readdirSync(extensionBasePath, { withFileTypes: true });

          // Sort version directories to get the latest one
          const sortedVersions = versionDirs
            .filter(dir => dir.isDirectory())
            .sort((a, b) => b.name.localeCompare(a.name));

          if (sortedVersions.length === 0) continue;

          // Use the latest version
          const latestVersion = sortedVersions[0];
          const extensionPath = path.join(extensionBasePath, latestVersion.name);
          const manifestPath = path.join(extensionPath, 'manifest.json');

          if (fs.existsSync(manifestPath)) {
            try {
              const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
              const manifest = JSON.parse(manifestContent);

              // Skip system/internal extensions
              if (manifest.name?.startsWith('__')) continue;

              // Find icon
              const iconPath = this.findExtensionIcon(extensionPath, manifest);

              extensions.push({
                id: extensionId,
                name: manifest.name || extensionId,
                version: manifest.version || latestVersion.name,
                description: manifest.description || '',
                iconPath,
                manifestPath,
                extensionPath,
                profileName
              });
            } catch (err) {
              console.warn(`Failed to parse manifest for ${extensionId}:`, err);
            }
          }
        } catch (err) {
          console.warn(`Error scanning extension ${extensionId}:`, err);
        }
      }

      console.log(`Found ${extensions.length} extensions in profile: ${profileName}`);
      return extensions;
    } catch (error) {
      console.error('Error scanning extensions:', error);
      return [];
    }
  }

  /**
   * Find the best icon for an extension
   */
  static findExtensionIcon(extensionPath: string, manifest: any): string | undefined {
    // Try different icon sizes (prefer larger icons)
    const iconSizes = ['128', '48', '32', '16'];

    // Check manifest.icons first
    if (manifest.icons && typeof manifest.icons === 'object') {
      for (const size of iconSizes) {
        if (manifest.icons[size]) {
          const iconPath = path.join(extensionPath, manifest.icons[size]);
          if (fs.existsSync(iconPath)) {
            return iconPath;
          }
        }
      }
    }

    // Check manifest.action or browser_action icons
    const actionIcon = manifest.action?.default_icon || manifest.browser_action?.default_icon;
    if (actionIcon) {
      if (typeof actionIcon === 'string') {
        const iconPath = path.join(extensionPath, actionIcon);
        if (fs.existsSync(iconPath)) {
          return iconPath;
        }
      } else if (typeof actionIcon === 'object') {
        for (const size of iconSizes) {
          if (actionIcon[size]) {
            const iconPath = path.join(extensionPath, actionIcon[size]);
            if (fs.existsSync(iconPath)) {
              return iconPath;
            }
          }
        }
      }
    }

    // Fallback: search common icon locations
    const commonPaths = [
      'icons/icon128.png',
      'icons/icon48.png',
      'icons/icon32.png',
      'icons/icon16.png',
      'images/icon128.png',
      'images/icon48.png',
      'icon128.png',
      'icon48.png',
      'icon.png'
    ];

    for (const commonPath of commonPaths) {
      const iconPath = path.join(extensionPath, commonPath);
      if (fs.existsSync(iconPath)) {
        return iconPath;
      }
    }

    return undefined;
  }

  /**
   * Get extension icon as base64 data URL
   */
  static getExtensionIconDataUrl(iconPath: string): string | null {
    try {
      if (!fs.existsSync(iconPath)) {
        return null;
      }

      const buffer = fs.readFileSync(iconPath);
      const base64 = buffer.toString('base64');
      const ext = path.extname(iconPath).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';

      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      console.error('Error reading icon:', error);
      return null;
    }
  }
}
