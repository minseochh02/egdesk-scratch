# EGDesk Auto-Update System

This document explains how the EGDesk Electron.js application implements automatic updates using GitHub Releases and the `electron-updater` package.

## Overview

The auto-update system allows users to receive updates automatically when new versions are published to GitHub. The system:

1. **Checks for updates** on app startup (with a 5-second delay)
2. **Notifies users** when an update is available
3. **Downloads updates** with progress feedback
4. **Installs updates** with user confirmation

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GitHub Releases                                   │
│  (minseochh02/egdesk-scratch)                                               │
│  - latest.yml / latest-mac.yml                                              │
│  - EGDesk-Setup-x.x.x.exe                                                   │
│  - EGDesk-x.x.x.dmg                                                         │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               │ electron-updater checks
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Main Process (main.ts)                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     AppUpdater Class                                 │   │
│  │  - setupUpdateHandlers() - Event listeners                          │   │
│  │  - checkForUpdates() - Queries GitHub                               │   │
│  │  - downloadUpdate() - Downloads from GitHub                         │   │
│  │  - quitAndInstall() - Applies update                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               │ IPC Communication
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Renderer Process (React)                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                   UpdateDialog Component                             │   │
│  │  - Shows "Update Available" notification                            │   │
│  │  - Shows download progress bar                                      │   │
│  │  - Shows "Ready to Install" prompt                                  │   │
│  │  - Handles user actions (Download/Later/Restart)                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Package Configuration (`package.json`)

The `publish` configuration tells electron-builder where to upload/download releases:

```json
"build": {
  "publish": {
    "provider": "github",
    "owner": "minseochh02",
    "repo": "egdesk-scratch",
    "releaseType": "release"
  }
}
```

**Dependencies:**

```json
"dependencies": {
  "electron-updater": "^6.3.9",
  "electron-log": "^5.3.2"
}
```

### 2. Main Process - AppUpdater Class (`src/main/main.ts`)

```typescript
class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.autoDownload = false; // Wait for user confirmation
    
    // Check for updates 5 seconds after app launch
    setTimeout(() => {
      this.checkForUpdates();
    }, 5000);

    this.setupUpdateHandlers();
  }

  private setupUpdateHandlers(): void {
    // Update available - notify user
    autoUpdater.on('update-available', (info) => {
      log.info('Update available:', info.version);
      this.notifyUpdateAvailable(info);
    });

    // Update not available
    autoUpdater.on('update-not-available', (info) => {
      log.info('Update not available. Current version is latest.');
    });

    // Download progress
    autoUpdater.on('download-progress', (progressObj) => {
      const percent = Math.round(progressObj.percent);
      log.info(`Download progress: ${percent}%`);
      this.notifyDownloadProgress(progressObj);
    });

    // Update downloaded - ready to install
    autoUpdater.on('update-downloaded', (info) => {
      log.info('Update downloaded:', info.version);
      this.notifyUpdateDownloaded(info);
    });

    // Error handling
    autoUpdater.on('error', (error) => {
      log.error('Update error:', error);
      this.notifyUpdateError(error);
    });
  }

  public checkForUpdates(): void {
    if (!app.isPackaged) {
      log.info('Skipping update check in development mode');
      return;
    }
    
    log.info('Checking for updates...');
    autoUpdater.checkForUpdates().catch((error) => {
      log.error('Failed to check for updates:', error);
    });
  }

  public downloadUpdate(): void {
    log.info('Downloading update...');
    autoUpdater.downloadUpdate().catch((error) => {
      log.error('Failed to download update:', error);
      this.notifyUpdateError(error);
    });
  }

  public quitAndInstall(): void {
    log.info('Quitting and installing update...');
    // isSilent: false, isForceRunAfter: true (ensures app restarts after install)
    autoUpdater.quitAndInstall(false, true);
  }
}
```

### 3. IPC Handlers (Main Process)

The main process exposes update controls via IPC:

```typescript
// Initialize auto-updater
appUpdater = new AppUpdater();

// Register IPC handlers for update controls
ipcMain.handle('app-updater-download', async () => {
  if (appUpdater) {
    appUpdater.downloadUpdate();
    return { success: true };
  }
  return { success: false, error: 'Updater not initialized' };
});

ipcMain.handle('app-updater-quit-and-install', async () => {
  if (appUpdater) {
    appUpdater.quitAndInstall();
    return { success: true };
  }
  return { success: false, error: 'Updater not initialized' };
});

ipcMain.handle('app-updater-check', async () => {
  if (appUpdater) {
    appUpdater.checkForUpdates();
    return { success: true };
  }
  return { success: false, error: 'Updater not initialized' };
});
```

### 4. Preload Script (`src/main/preload.ts`)

The preload script exposes the updater API to the renderer:

```typescript
updater: {
  checkForUpdates: () => ipcRenderer.invoke('app-updater-check'),
  downloadUpdate: () => ipcRenderer.invoke('app-updater-download'),
  quitAndInstall: () => ipcRenderer.invoke('app-updater-quit-and-install'),
  
  onUpdateAvailable: (callback) => {
    const subscription = (_event, ...args) => callback(args[0]);
    ipcRenderer.on('update-available', subscription);
    return () => ipcRenderer.removeListener('update-available', subscription);
  },
  
  onDownloadProgress: (callback) => {
    const subscription = (_event, ...args) => callback(args[0]);
    ipcRenderer.on('update-download-progress', subscription);
    return () => ipcRenderer.removeListener('update-download-progress', subscription);
  },
  
  onUpdateDownloaded: (callback) => {
    const subscription = (_event, ...args) => callback(args[0]);
    ipcRenderer.on('update-downloaded', subscription);
    return () => ipcRenderer.removeListener('update-downloaded', subscription);
  },
  
  onUpdateError: (callback) => {
    const subscription = (_event, ...args) => callback(args[0]);
    ipcRenderer.on('update-error', subscription);
    return () => ipcRenderer.removeListener('update-error', subscription);
  },
},
```

### 5. Update Dialog Component (`src/renderer/components/UpdateDialog.tsx`)

A React component that displays update notifications:

**States:**
- `updateAvailable` - Shows "Update Available" dialog with version info
- `isDownloading` + `downloadProgress` - Shows download progress bar
- `updateDownloaded` - Shows "Ready to Install" dialog
- `error` - Shows error message

**User Actions:**
- "Download Update" - Triggers download
- "Later" - Dismisses dialog
- "Restart Now" - Applies update and restarts app

## GitHub Actions Workflow (`.github/workflows/publish.yml`)

Automatically builds and publishes releases when pushing to `main`:

```yaml
name: Publish

on:
  push:
    branches:
      - main

jobs:
  publish:
    runs-on: ${{ matrix.os }}
    timeout-minutes: 60

    strategy:
      matrix:
        os: [windows-latest]

    steps:
      - name: Checkout git repo
        uses: actions/checkout@v3

      - name: Install Node and NPM
        uses: actions/setup-node@v3
        with:
          node-version: 22
          cache: npm

      - name: Create .env.production from secrets
        run: |
          echo "SUPABASE_URL=${{ secrets.SUPABASE_URL }}" >> .env.production
          echo "SUPABASE_ANON_KEY=${{ secrets.SUPABASE_ANON_KEY }}" >> .env.production
        shell: bash

      - name: Install and build
        run: |
          npm install
          npm run postinstall
          npm run build

      - name: Publish releases
        env:
          GH_TOKEN: ${{ secrets.GH_TOKEN || secrets.GITHUB_TOKEN }}
        run: |
          npm exec electron-builder -- --publish always --win
```

## Update Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           User Opens App                                 │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼ (5 second delay)
┌──────────────────────────────────────────────────────────────────────────┐
│                      Check for Updates                                   │
│            autoUpdater.checkForUpdates()                                 │
│     Queries: github.com/minseochh02/egdesk-scratch/releases              │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              │                                     │
              ▼                                     ▼
┌─────────────────────────┐           ┌─────────────────────────┐
│   update-not-available  │           │    update-available     │
│   (silent, no UI)       │           │   Shows notification    │
└─────────────────────────┘           └───────────┬─────────────┘
                                                  │
                                    ┌─────────────┴─────────────┐
                                    │                           │
                                    ▼                           ▼
                          ┌─────────────────┐         ┌─────────────────┐
                          │  User: "Later"  │         │ User: "Download"│
                          │  (dismiss)      │         │                 │
                          └─────────────────┘         └────────┬────────┘
                                                               │
                                                               ▼
                                              ┌─────────────────────────────┐
                                              │      Downloading...         │
                                              │   Shows progress bar        │
                                              │   (percent, MB transferred) │
                                              └───────────────┬─────────────┘
                                                              │
                                                              ▼
                                              ┌─────────────────────────────┐
                                              │    Update Downloaded        │
                                              │  "Ready to Install" dialog  │
                                              └───────────────┬─────────────┘
                                                              │
                                                ┌─────────────┴─────────────┐
                                                │                           │
                                                ▼                           ▼
                                      ┌─────────────────┐         ┌─────────────────┐
                                      │  User: "Later"  │         │ User: "Restart" │
                                      │  (dismiss)      │         │                 │
                                      └─────────────────┘         └────────┬────────┘
                                                                           │
                                                                           ▼
                                                          ┌─────────────────────────────┐
                                                          │  App Quits & Installs       │
                                                          │  autoUpdater.quitAndInstall()│
                                                          │  App Restarts with new version
                                                          └─────────────────────────────┘
```

## Publishing a New Release

### Method 1: Via GitHub Actions (Automatic)

1. Update version in `package.json`:
   ```json
   "version": "1.0.3"
   ```

2. Commit and push to `main`:
   ```bash
   git add .
   git commit -m "Release v1.0.3"
   git push origin main
   ```

3. GitHub Actions automatically:
   - Builds the app
   - Creates a draft release (or updates existing)
   - Uploads installers and `latest.yml`

4. Go to GitHub Releases and publish the release

### Method 2: Manual Publishing

```bash
# Build and publish
npm run build
GH_TOKEN=your_github_token npm exec electron-builder -- --publish always
```

## Key Files

| File | Purpose |
|------|---------|
| `src/main/main.ts` | AppUpdater class, IPC handlers |
| `src/main/preload.ts` | Exposes updater API to renderer |
| `src/renderer/components/UpdateDialog.tsx` | UI component for updates |
| `src/renderer/components/UpdateDialog.css` | Styling for update dialogs |
| `package.json` | `build.publish` configuration |
| `.github/workflows/publish.yml` | CI/CD for automatic releases |

## Configuration Options

### autoUpdater Settings (in AppUpdater constructor)

```typescript
autoUpdater.autoDownload = false;  // Wait for user to click "Download"
autoUpdater.logger = log;          // Use electron-log for logging
```

### Build Configuration (package.json)

```json
"publish": {
  "provider": "github",        // Use GitHub Releases
  "owner": "minseochh02",      // GitHub username/org
  "repo": "egdesk-scratch",    // Repository name
  "releaseType": "release"     // Only published releases (not drafts)
}
```

## Troubleshooting

### Updates Not Working in Development

Updates only work in packaged apps (`app.isPackaged === true`). During development, update checks are skipped.

### GitHub Token Issues

Ensure `GH_TOKEN` is set with appropriate permissions:
- `repo` scope for private repos
- `public_repo` scope for public repos

### Version Not Detected

`electron-updater` compares versions from:
- `package.json` → `version` field
- GitHub Release → `latest.yml` file

Ensure version follows semver format (e.g., `1.0.0`, `1.0.1`).

### Logs Location

Update logs are written via `electron-log`:
- **Windows:** `%USERPROFILE%\AppData\Roaming\egdesk\logs\`
- **macOS:** `~/Library/Logs/egdesk/`
- **Linux:** `~/.config/egdesk/logs/`

