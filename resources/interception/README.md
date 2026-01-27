# Interception Driver Setup

This folder contains the Interception keyboard driver files needed for Korean banking automation.

## Download Driver Files

**IMPORTANT:** You need to download the Interception driver files and place them in this directory before building for production.

### Step 1: Download Interception

1. Go to: https://github.com/oblitum/Interception/releases
2. Download `Interception.zip` (latest release)
3. Extract the ZIP file

### Step 2: Copy Files to This Directory

Copy these files from the extracted `Interception` folder to this directory:

```
resources/interception/
├── install-interception.exe    ← Copy this
├── interception.dll            ← Copy this
├── command-line/               ← Copy entire folder (optional)
└── library/                    ← Copy entire folder (optional)
```

**Required files:**
- `install-interception.exe` - The installer (REQUIRED)
- `interception.dll` - The driver library (REQUIRED)

**Optional files:**
- `command-line/` - Command-line tools (optional)
- `library/` - Development headers (optional)

### Step 3: Verify Files

After copying, this directory should contain:
- ✅ `install-interception.exe` (installer)
- ✅ `interception.dll` (driver DLL)
- ✅ `README.md` (this file)

## What Gets Bundled

When you run `npm run package`, Electron Builder will:
1. Copy all files from `resources/interception/` to the app bundle
2. Make them available at runtime via `process.resourcesPath`
3. The installer will be available for auto-installation on first run

## User Experience

When users run your app on Windows:

**First Run:**
1. App detects driver not installed
2. Shows dialog: "Keyboard driver required for banking automation"
3. User clicks "Install"
4. UAC prompt (admin rights)
5. Driver installs
6. Prompt to restart computer

**After Restart:**
- App works normally
- Driver loads automatically
- No more prompts

## License

The Interception driver is licensed separately. Please review the license terms at:
https://github.com/oblitum/Interception

## Troubleshooting

If driver installation fails:
- Check Windows Event Viewer for driver errors
- Ensure app has admin rights
- Check antivirus isn't blocking installation
- Verify files copied correctly

## Alternative: Manual Installation

Users can also install the driver manually:
1. Run `install-interception.exe /install` as Administrator
2. Restart computer
3. Launch your app

The app will detect the driver is already installed and skip the installation flow.
