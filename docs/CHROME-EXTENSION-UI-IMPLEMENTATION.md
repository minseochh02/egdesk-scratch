# Chrome Extension UI Implementation Plan

**Feature:** Scan user's Chrome profiles and display installed extensions for browser recorder use.

**Last Updated:** 2026-01-22

---

## 🎯 IMPLEMENTATION PLAN

**Status:** ✅ APPROVED FOR IMPLEMENTATION

**Goal:** Create a UI that allows users to select Chrome extensions from their installed profiles, then pass those extension paths to `browser-recorder.ts` when launching Chromium via `launchPersistentContext`.

**Integration Point:** The selected extension paths will be passed as arguments to Chromium:
```typescript
const context = await chromium.launchPersistentContext(profileDir, {
  args: [
    `--disable-extensions-except=${extensionPaths.join(',')}`,
    `--load-extension=${extensionPaths.join(',')}`
  ]
});
```

---

## Overview

Create a UI that:
1. ✅ Scans all Chrome profiles on the user's system
2. ✅ Displays all installed extensions with icons and names
3. ✅ Allows users to select extensions for recording sessions
4. ✅ Saves extension preferences per user
5. ✅ Automatically loads selected extensions when recording
6. ✅ **Passes extension paths to browser-recorder's `launchPersistentContext`**

---

## Implementation Flow

```
User Action                  Frontend                Backend              Browser Recorder
──────────────────────────────────────────────────────────────────────────────────────────

1. Click "🧩 Select     →  Open Modal
   Extensions"

2. Modal opens          →  scanProfiles()    →  ChromeExtensionScanner
                                                  - Find Chrome dir
                                                  - Scan all profiles
                                                  - Parse manifests
                                                  - Load icons
                           ← Return profiles
                              with extensions

3. User selects         →  Update state
   extensions              selectedExtensions[]
   (checkboxes)

4. Click "Use Selected" →  savePreferences() →  electron-store.set()
                           ← Confirm saved

5. Click "Start         →  launchRecorder({
   Recording"                url,
                             extensionPaths   →  BrowserRecorder
                           })                     .setExtensions()

6. Browser launches                                chromium.launchPersistentContext({
                                                     args: [
                                                       '--load-extension=path1,path2,path3'
                                                     ]
                                                   })

7. Extensions loaded                               ✅ Extensions active in browser
   in browser
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend UI                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Extension Selector Modal                             │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ Profile: Default                                 │  │  │
│  │  │  ☑ uBlock Origin (1.52.0)                       │  │  │
│  │  │  ☐ React DevTools (4.28.0)                      │  │  │
│  │  │  ☑ JSON Formatter (0.7.0)                       │  │  │
│  │  │                                                  │  │  │
│  │  │ Profile: Work                                    │  │  │
│  │  │  ☑ Grammarly (14.1089.0)                        │  │  │
│  │  │  ☐ LastPass (4.120.0)                           │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │                                    [Select] [Cancel]  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      IPC Communication                       │
│  - chrome-extensions:scan-profiles                           │
│  - chrome-extensions:get-extension-icon                      │
│  - chrome-extensions:save-preferences                        │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Main Process)                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  ChromeExtensionScanner                               │  │
│  │  - findChromeUserDataDir()                            │  │
│  │  - getAllProfiles()                                   │  │
│  │  - scanExtensions(profilePath)                        │  │
│  │  - parseManifest(extensionPath)                       │  │
│  │  - getExtensionIcon(extensionPath)                    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Browser Recorder                          │
│  - Loads selected extensions when starting recording        │
│  - Uses --load-extension arg with extension paths           │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation

### 1. Backend: Chrome Extension Scanner

**File:** `src/main/chrome-extension-scanner.ts`

```typescript
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
        return null;
    }

    return fs.existsSync(chromeDir) ? chromeDir : null;
  }

  /**
   * Get all Chrome profiles
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

        const profilePath = path.join(userDataDir, entry.name);

        // Check if this is a valid profile (has Extensions folder)
        const extensionsPath = path.join(profilePath, 'Extensions');

        if (fs.existsSync(extensionsPath)) {
          const profileName = entry.name === 'Default' ? 'Default' : entry.name;
          const extensions = this.scanExtensions(extensionsPath, profileName);

          profiles.push({
            name: profileName,
            path: profilePath,
            extensions
          });
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
        const versionDirs = fs.readdirSync(extensionBasePath, { withFileTypes: true });

        for (const versionDir of versionDirs) {
          if (!versionDir.isDirectory()) continue;

          const extensionPath = path.join(extensionBasePath, versionDir.name);
          const manifestPath = path.join(extensionPath, 'manifest.json');

          if (fs.existsSync(manifestPath)) {
            try {
              const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

              // Find icon
              const iconPath = this.findExtensionIcon(extensionPath, manifest);

              extensions.push({
                id: extensionId,
                name: manifest.name || extensionId,
                version: manifest.version || versionDir.name,
                description: manifest.description || '',
                iconPath,
                manifestPath,
                extensionPath,
                profileName
              });

              // Only take the first (latest) version
              break;
            } catch (err) {
              console.warn(`Failed to parse manifest for ${extensionId}:`, err);
            }
          }
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
    const iconFolders = ['icons', 'images', ''];

    // Check manifest.icons first
    if (manifest.icons) {
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
    for (const folder of iconFolders) {
      for (const size of iconSizes) {
        const iconPath = path.join(extensionPath, folder, `icon${size}.png`);
        if (fs.existsSync(iconPath)) {
          return iconPath;
        }
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
      const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      console.error('Error reading icon:', error);
      return null;
    }
  }
}
```

---

### 2. Backend: IPC Handlers

**File:** `src/main/chrome-handlers.ts` (add to existing file)

```typescript
import { ChromeExtensionScanner, ChromeProfile, ChromeExtension } from './chrome-extension-scanner';

// Add these handlers to your existing chrome-handlers.ts file

/**
 * Scan all Chrome profiles and their extensions
 */
ipcMain.handle('chrome-extensions:scan-profiles', async () => {
  try {
    console.log('Scanning Chrome profiles for extensions...');
    const profiles = ChromeExtensionScanner.getAllProfiles();

    // Convert icon paths to data URLs for frontend display
    const profilesWithIcons = profiles.map(profile => ({
      ...profile,
      extensions: profile.extensions.map(ext => ({
        ...ext,
        iconDataUrl: ext.iconPath
          ? ChromeExtensionScanner.getExtensionIconDataUrl(ext.iconPath)
          : null
      }))
    }));

    return {
      success: true,
      profiles: profilesWithIcons
    };
  } catch (error) {
    console.error('Error scanning Chrome extensions:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      profiles: []
    };
  }
});

/**
 * Get Chrome user data directory path
 */
ipcMain.handle('chrome-extensions:get-user-data-dir', async () => {
  const dir = ChromeExtensionScanner.getChromeUserDataDir();
  return { success: !!dir, path: dir };
});

/**
 * Save selected extensions for future use
 */
ipcMain.handle('chrome-extensions:save-preferences', async (event, selectedExtensions: string[]) => {
  try {
    const Store = require('electron-store');
    const store = new Store();

    store.set('browser-recorder.selected-extensions', selectedExtensions);

    return { success: true };
  } catch (error) {
    console.error('Error saving extension preferences:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

/**
 * Get saved extension preferences
 */
ipcMain.handle('chrome-extensions:get-preferences', async () => {
  try {
    const Store = require('electron-store');
    const store = new Store();

    const selectedExtensions = store.get('browser-recorder.selected-extensions', []);

    return {
      success: true,
      selectedExtensions
    };
  } catch (error) {
    console.error('Error getting extension preferences:', error);
    return {
      success: false,
      selectedExtensions: []
    };
  }
});
```

---

### 3. Update Browser Recorder

**File:** `src/main/browser-recorder.ts`

> **⚠️ CRITICAL INTEGRATION POINT:**
> This is where we pass the selected extension paths to Chromium's `launchPersistentContext`.
> The extension paths come from the UI selection and are passed via `setExtensions()` before `start()` is called.

```typescript
export class BrowserRecorder {
  private extensionPaths: string[] = [];

  /**
   * Set extensions to load (called before start())
   */
  setExtensions(extensionPaths: string[]): void {
    this.extensionPaths = extensionPaths;
    console.log('Browser recorder will load extensions:', extensionPaths);
  }

  async start(url: string, onBrowserClosed?: () => void): Promise<void> {
    // ... existing code ...

    const args = [
      `--window-size=${browserWidth},${browserHeight}`,
      `--window-position=${browserX},${browserY}`,
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--allow-running-insecure-content',
      '--disable-features=PrivateNetworkAccessSendPreflights',
      '--disable-features=PrivateNetworkAccessRespectPreflightResults'
    ];

    // Add extension loading args
    if (this.extensionPaths.length > 0) {
      const extensionPathsStr = this.extensionPaths.join(',');
      args.push(`--disable-extensions-except=${extensionPathsStr}`);
      args.push(`--load-extension=${extensionPathsStr}`);
      console.log(`Loading ${this.extensionPaths.length} extensions`);
    }

    this.context = await chromium.launchPersistentContext(this.profileDir, {
      headless: false,
      channel: 'chrome',
      viewport: null,
      permissions: ['clipboard-read', 'clipboard-write'],
      acceptDownloads: true,
      downloadsPath: downloadsPath,
      args: args
    });

    // ... rest of code ...
  }
}
```

**File:** `src/main/chrome-handlers.ts` (update recorder launch)

```typescript
ipcMain.handle('launch-browser-recorder-enhanced', async (event, { url, extensionPaths }) => {
  try {
    console.log('🎭 Launching enhanced Playwright recorder for URL:', url);

    // ... existing recorder setup code ...

    activeRecorder = new BrowserRecorder();
    activeRecorder.setOutputFile(outputFile);
    activeRecorder.setScriptName(scriptName);

    // Load extensions if provided
    if (extensionPaths && extensionPaths.length > 0) {
      activeRecorder.setExtensions(extensionPaths);
    }

    await activeRecorder.start(url, async () => {
      // ... existing browser close handler ...
    });

    return {
      success: true,
      outputFile,
      timestamp
    };
  } catch (error) {
    // ... error handling ...
  }
});
```

---

### 4. Frontend: Preload API

**File:** `src/main/preload.ts`

```typescript
// Add to existing preload.ts

chromeExtensions: {
  scanProfiles: () => ipcRenderer.invoke('chrome-extensions:scan-profiles'),
  getUserDataDir: () => ipcRenderer.invoke('chrome-extensions:get-user-data-dir'),
  savePreferences: (selectedExtensions: string[]) =>
    ipcRenderer.invoke('chrome-extensions:save-preferences', selectedExtensions),
  getPreferences: () => ipcRenderer.invoke('chrome-extensions:get-preferences'),
},
```

---

### 5. Frontend: React Component

**File:** `src/renderer/components/ChromeExtensionSelector/ChromeExtensionSelector.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import './ChromeExtensionSelector.css';

interface ChromeExtension {
  id: string;
  name: string;
  version: string;
  description: string;
  iconDataUrl?: string | null;
  extensionPath: string;
  profileName: string;
}

interface ChromeProfile {
  name: string;
  path: string;
  extensions: ChromeExtension[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (extensionPaths: string[]) => void;
}

export const ChromeExtensionSelector: React.FC<Props> = ({ isOpen, onClose, onSelect }) => {
  const [profiles, setProfiles] = useState<ChromeProfile[]>([]);
  const [selectedExtensions, setSelectedExtensions] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadExtensions();
      loadSavedPreferences();
    }
  }, [isOpen]);

  const loadExtensions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electron.chromeExtensions.scanProfiles();

      if (result.success) {
        setProfiles(result.profiles || []);
      } else {
        setError(result.error || 'Failed to scan extensions');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSavedPreferences = async () => {
    try {
      const result = await window.electron.chromeExtensions.getPreferences();
      if (result.success && result.selectedExtensions) {
        setSelectedExtensions(new Set(result.selectedExtensions));
      }
    } catch (err) {
      console.error('Failed to load saved preferences:', err);
    }
  };

  const handleToggleExtension = (extensionPath: string) => {
    const newSelected = new Set(selectedExtensions);

    if (newSelected.has(extensionPath)) {
      newSelected.delete(extensionPath);
    } else {
      newSelected.add(extensionPath);
    }

    setSelectedExtensions(newSelected);
  };

  const handleSelectAll = (profile: ChromeProfile) => {
    const newSelected = new Set(selectedExtensions);
    profile.extensions.forEach(ext => newSelected.add(ext.extensionPath));
    setSelectedExtensions(newSelected);
  };

  const handleDeselectAll = (profile: ChromeProfile) => {
    const newSelected = new Set(selectedExtensions);
    profile.extensions.forEach(ext => newSelected.delete(ext.extensionPath));
    setSelectedExtensions(newSelected);
  };

  const handleConfirm = async () => {
    const extensionPaths = Array.from(selectedExtensions);

    // Save preferences
    await window.electron.chromeExtensions.savePreferences(extensionPaths);

    // Pass to parent
    onSelect(extensionPaths);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="extension-selector-overlay">
      <div className="extension-selector-modal">
        <div className="extension-selector-header">
          <h2>Select Chrome Extensions</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="extension-selector-body">
          {isLoading && (
            <div className="loading-message">
              <div className="spinner"></div>
              <p>Scanning Chrome profiles...</p>
            </div>
          )}

          {error && (
            <div className="error-message">
              <p>❌ {error}</p>
              <button onClick={loadExtensions}>Retry</button>
            </div>
          )}

          {!isLoading && !error && profiles.length === 0 && (
            <div className="empty-message">
              <p>No Chrome profiles with extensions found.</p>
              <p className="hint">Make sure Chrome is installed and has extensions.</p>
            </div>
          )}

          {!isLoading && !error && profiles.length > 0 && (
            <div className="profiles-list">
              {profiles.map(profile => (
                <div key={profile.name} className="profile-section">
                  <div className="profile-header">
                    <h3>📁 Profile: {profile.name}</h3>
                    <div className="profile-actions">
                      <button
                        className="text-btn"
                        onClick={() => handleSelectAll(profile)}
                      >
                        Select All
                      </button>
                      <button
                        className="text-btn"
                        onClick={() => handleDeselectAll(profile)}
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  <div className="extensions-list">
                    {profile.extensions.length === 0 && (
                      <p className="no-extensions">No extensions in this profile</p>
                    )}

                    {profile.extensions.map(extension => (
                      <div
                        key={extension.id}
                        className={`extension-item ${selectedExtensions.has(extension.extensionPath) ? 'selected' : ''}`}
                        onClick={() => handleToggleExtension(extension.extensionPath)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedExtensions.has(extension.extensionPath)}
                          onChange={() => handleToggleExtension(extension.extensionPath)}
                          onClick={(e) => e.stopPropagation()}
                        />

                        <div className="extension-icon">
                          {extension.iconDataUrl ? (
                            <img src={extension.iconDataUrl} alt={extension.name} />
                          ) : (
                            <div className="icon-placeholder">🧩</div>
                          )}
                        </div>

                        <div className="extension-info">
                          <div className="extension-name">{extension.name}</div>
                          <div className="extension-version">v{extension.version}</div>
                          {extension.description && (
                            <div className="extension-description">{extension.description}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="extension-selector-footer">
          <div className="selected-count">
            {selectedExtensions.size} extension{selectedExtensions.size !== 1 ? 's' : ''} selected
          </div>
          <div className="footer-actions">
            <button className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleConfirm}
              disabled={selectedExtensions.size === 0}
            >
              Use Selected Extensions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
```

---

### 6. Frontend: CSS Styles

**File:** `src/renderer/components/ChromeExtensionSelector/ChromeExtensionSelector.css`

```css
.extension-selector-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.extension-selector-modal {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.extension-selector-header {
  padding: 20px 24px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.extension-selector-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 28px;
  color: #666;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-btn:hover {
  background: #f0f0f0;
}

.extension-selector-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

.loading-message,
.error-message,
.empty-message {
  text-align: center;
  padding: 40px 20px;
}

.spinner {
  width: 40px;
  height: 40px;
  margin: 0 auto 16px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #2196F3;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.profile-section {
  margin-bottom: 24px;
}

.profile-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 2px solid #e0e0e0;
}

.profile-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.profile-actions {
  display: flex;
  gap: 12px;
}

.text-btn {
  background: none;
  border: none;
  color: #2196F3;
  cursor: pointer;
  font-size: 13px;
  padding: 4px 8px;
}

.text-btn:hover {
  text-decoration: underline;
}

.extensions-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.extension-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.extension-item:hover {
  background: #f8f8f8;
  border-color: #2196F3;
}

.extension-item.selected {
  background: #e3f2fd;
  border-color: #2196F3;
}

.extension-item input[type="checkbox"] {
  cursor: pointer;
  width: 18px;
  height: 18px;
}

.extension-icon {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
}

.extension-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.icon-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f0f0;
  border-radius: 4px;
  font-size: 20px;
}

.extension-info {
  flex: 1;
  min-width: 0;
}

.extension-name {
  font-weight: 500;
  font-size: 14px;
  color: #333;
  margin-bottom: 2px;
}

.extension-version {
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}

.extension-description {
  font-size: 12px;
  color: #888;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.extension-selector-footer {
  padding: 16px 24px;
  border-top: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.selected-count {
  font-size: 14px;
  color: #666;
}

.footer-actions {
  display: flex;
  gap: 12px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: #f0f0f0;
  color: #333;
}

.btn-secondary:hover {
  background: #e0e0e0;
}

.btn-primary {
  background: #2196F3;
  color: white;
}

.btn-primary:hover {
  background: #1976D2;
}

.btn-primary:disabled {
  background: #ccc;
  cursor: not-allowed;
}
```

---

### 7. Integration with Browser Recorder UI

**File:** `src/renderer/components/BrowserRecorder/BrowserRecorderControls.tsx` (or wherever you have recorder controls)

```tsx
import React, { useState } from 'react';
import { ChromeExtensionSelector } from '../ChromeExtensionSelector/ChromeExtensionSelector';

export const BrowserRecorderControls: React.FC = () => {
  const [showExtensionSelector, setShowExtensionSelector] = useState(false);
  const [selectedExtensionPaths, setSelectedExtensionPaths] = useState<string[]>([]);
  const [url, setUrl] = useState('');

  const handleStartRecording = async () => {
    try {
      const result = await window.electron.launchBrowserRecorderEnhanced({
        url,
        extensionPaths: selectedExtensionPaths
      });

      if (result.success) {
        console.log('Recording started with extensions:', selectedExtensionPaths);
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  return (
    <div className="recorder-controls">
      <input
        type="text"
        placeholder="Enter URL to record..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />

      <button onClick={() => setShowExtensionSelector(true)}>
        🧩 Select Extensions ({selectedExtensionPaths.length})
      </button>

      <button onClick={handleStartRecording} disabled={!url}>
        🎬 Start Recording
      </button>

      <ChromeExtensionSelector
        isOpen={showExtensionSelector}
        onClose={() => setShowExtensionSelector(false)}
        onSelect={(paths) => setSelectedExtensionPaths(paths)}
      />
    </div>
  );
};
```

---

## User Flow

```
1. User clicks "🧩 Select Extensions" button
   ↓
2. Modal opens, scanning Chrome profiles
   ↓
3. UI displays all profiles and their extensions
   - Default
     ☑ uBlock Origin (1.52.0)
     ☐ React DevTools (4.28.0)
   - Work
     ☑ Grammarly (14.1089.0)
   ↓
4. User checks desired extensions
   ↓
5. User clicks "Use Selected Extensions"
   ↓
6. Preferences saved to electron-store
   ↓
7. User starts recording
   ↓
8. Browser launches with selected extensions loaded
```

---

## Benefits

✅ **User-Friendly** - Visual selection instead of paths
✅ **Persistent** - Remembers selections across sessions
✅ **Cross-Profile** - Access extensions from all Chrome profiles
✅ **Visual Icons** - Easy to identify extensions
✅ **Batch Selection** - Select All / Deselect All per profile
✅ **Real-Time Scanning** - Always shows latest extensions

---

## Testing

```bash
# 1. Test scanning
npm start
# Click "Select Extensions" button
# Should show all Chrome profiles and extensions

# 2. Test selection
# Check/uncheck extensions
# Click "Use Selected Extensions"
# Verify saved in electron-store

# 3. Test recording
# Start recording with extensions selected
# Open chrome://extensions/ in recorder
# Verify extensions are loaded
```

---

## Future Enhancements

1. **Search/Filter** - Search extensions by name
2. **Categories** - Group by extension type (productivity, dev tools, etc.)
3. **Custom Extensions** - Upload unpacked extension folders
4. **Extension Settings** - Configure extension options before loading
5. **Recently Used** - Quick access to frequently used extensions
6. **Extension Updates** - Check for and install extension updates

---

## Complete Example

See full implementation in:
- `src/main/chrome-extension-scanner.ts` - Backend scanner
- `src/main/chrome-handlers.ts` - IPC handlers
- `src/main/browser-recorder.ts` - Extension loading
- `src/renderer/components/ChromeExtensionSelector/` - UI component

---

## 📋 Implementation Checklist

### Phase 1: Backend Scanner ⏳ NOT STARTED
- [ ] Create `src/main/chrome-extension-scanner.ts`
- [ ] Implement `getChromeUserDataDir()`
- [ ] Implement `getAllProfiles()`
- [ ] Implement `scanExtensions()`
- [ ] Implement `findExtensionIcon()`
- [ ] Test on macOS, Windows, Linux

### Phase 2: IPC Handlers ⏳ NOT STARTED
- [ ] Add handlers to `src/main/chrome-handlers.ts`
- [ ] `chrome-extensions:scan-profiles`
- [ ] `chrome-extensions:save-preferences`
- [ ] `chrome-extensions:get-preferences`
- [ ] Update `src/main/preload.ts` with API

### Phase 3: Browser Recorder Integration ⏳ NOT STARTED
- [ ] Add `setExtensions()` method to `BrowserRecorder` class
- [ ] Update `start()` to include extension args
- [ ] Update IPC handler `launch-browser-recorder-enhanced` to accept `extensionPaths`
- [ ] Test extension loading works

### Phase 4: Frontend UI ⏳ NOT STARTED
- [ ] Create `ChromeExtensionSelector` component
- [ ] Create CSS styles
- [ ] Add integration to recorder controls
- [ ] Test UI displays extensions correctly
- [ ] Test selection persistence

### Phase 5: Testing & Polish ⏳ NOT STARTED
- [ ] End-to-end test: Select extension → Launch recorder → Verify loaded
- [ ] Test with multiple extensions
- [ ] Test with no extensions
- [ ] Test profile scanning on all OS platforms
- [ ] Add loading states and error handling

---

## 🎯 Success Criteria

When complete, users should be able to:
1. ✅ Click "Select Extensions" button in browser recorder UI
2. ✅ See modal with all Chrome profiles and their extensions
3. ✅ Select desired extensions via checkboxes
4. ✅ Have selections saved automatically
5. ✅ Start recording and see extensions loaded in the browser
6. ✅ Access extension functionality during recording (e.g., ad blocker working)

---

## 🚀 PLANNED IMPLEMENTATION

**Decision:** This feature WILL be implemented to pass Chrome extensions to `browser-recorder.ts`'s `launchPersistentContext` call.

**Key Integration:**
```typescript
// In browser-recorder.ts
this.context = await chromium.launchPersistentContext(this.profileDir, {
  headless: false,
  channel: 'chrome',
  args: [
    // ... existing args ...
    `--disable-extensions-except=${this.extensionPaths.join(',')}`,  // ← Extension paths from UI
    `--load-extension=${this.extensionPaths.join(',')}`             // ← Extension paths from UI
  ]
});
```

**Expected Timeline:** TBD (ready to implement when needed)

**Priority:** Medium-High (significant UX improvement for power users)
