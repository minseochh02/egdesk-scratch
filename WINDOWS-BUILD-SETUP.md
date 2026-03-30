# Windows Build Setup Guide

This guide explains how to set up the Windows development environment for EGDesk, which requires native Node.js modules.

## Why This Is Needed

EGDesk uses several native Node.js modules that require compilation:
- **uiohook-napi**: Mouse and keyboard event capture
- **active-win**: Active window detection
- **serialport**: Arduino HID communication for UAC bypass

These modules require C++ compilation tools to build on Windows.

## Prerequisites

### 1. Install Visual Studio Build Tools

**Option A: Visual Studio 2022 Build Tools (Recommended)**

1. Download [Visual Studio Build Tools 2022](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022)
2. Run the installer
3. Select **"Desktop development with C++"** workload
4. Ensure these components are checked:
   - MSVC v143 - VS 2022 C++ x64/x86 build tools
   - Windows 10 SDK (or Windows 11 SDK)
   - C++ CMake tools for Windows
5. Install (requires ~7GB disk space)

**Option B: Visual Studio 2022 Community (Full IDE)**

If you prefer the full Visual Studio IDE:
1. Download [Visual Studio 2022 Community](https://visualstudio.microsoft.com/vs/community/)
2. During installation, select **"Desktop development with C++"**
3. Install

### 2. Install Python (Required by node-gyp)

1. Download [Python 3.11](https://www.python.org/downloads/) or later
2. During installation, check **"Add Python to PATH"**
3. Verify installation:
   ```cmd
   python --version
   ```

### 3. Configure npm to Use Build Tools

After installing Visual Studio Build Tools, configure npm:

```cmd
npm config set msvs_version 2022
```

If you have Visual Studio 2019 instead:
```cmd
npm config set msvs_version 2019
```

## Installation Steps

### 1. Clean Install

Remove existing node_modules and rebuild:

```cmd
# Remove old modules
rd /s /q node_modules
rd /s /q release\app\node_modules

# Clean npm cache
npm cache clean --force

# Install dependencies
npm install

# Rebuild native modules
npm run rebuild
```

### 2. Verify Native Modules

Check if native modules built successfully:

```cmd
# Check if uiohook-napi works
node -e "require('uiohook-napi'); console.log('uiohook-napi: OK')"

# Check if active-win works
node -e "require('active-win'); console.log('active-win: OK')"

# Check if serialport works
node -e "require('serialport'); console.log('serialport: OK')"
```

All three should print "OK" without errors.

## Troubleshooting

### Error: "MSBuild is not available"

**Solution**: Install Visual Studio Build Tools (see Prerequisites #1)

### Error: "Python not found"

**Solution**:
1. Install Python 3.11+ (see Prerequisites #2)
2. Ensure Python is in PATH
3. Configure npm to use the correct Python:
   ```cmd
   npm config set python "C:\Python311\python.exe"
   ```

### Error: "gyp ERR! find VS"

**Solution**:
```cmd
npm config set msvs_version 2022
npm install --force
```

### Error: "Cannot find module '@serialport/bindings-cpp'"

**Solution**: Rebuild serialport specifically:
```cmd
cd release\app\node_modules\serialport
npm run rebuild
cd ..\..\..\..
```

### Permission Errors During Build

**Solution**: Run Command Prompt or PowerShell as Administrator

### Still Having Issues?

1. **Check Node.js version**: Ensure you're using Node.js 18.x or later
   ```cmd
   node --version
   ```

2. **Clear all caches**:
   ```cmd
   npm cache clean --force
   rd /s /q node_modules
   rd /s /q release\app\node_modules
   rd /s /q %APPDATA%\npm-cache
   ```

3. **Reinstall with verbose logging**:
   ```cmd
   npm install --verbose
   ```
   This will show detailed error messages

4. **Check Windows SDK**: Ensure Windows 10/11 SDK is installed via Visual Studio Installer

## Post-Installation

After successful installation:

```cmd
# Start development server
npm start

# Build production app
npm run package:win
```

## Platform-Specific Notes

### Why These Tools Are Required on Windows

- **macOS**: Ships with Xcode Command Line Tools (includes clang compiler)
- **Linux**: Usually has gcc/g++ pre-installed or easily installable
- **Windows**: Requires Visual Studio Build Tools for MSVC compiler

### Cross-Platform Development

If you're developing on both Windows and macOS:

1. **Don't commit `node_modules/`** (already in .gitignore)
2. **Don't commit `release/app/node_modules/`**
3. After pulling code, always run `npm install` on each platform
4. Native modules will rebuild for the current platform

## Arduino Setup (Optional)

If you want to use Arduino HID for UAC bypass:

1. Follow this build guide first
2. Then see `/src/main/desktop-recorder/arduino-hid-sketch/README.md`
3. Install Arduino IDE and flash the HID sketch
4. `npm install serialport` will already be done from the build steps above

## Need Help?

If you encounter issues not covered here:

1. Check the [node-gyp documentation](https://github.com/nodejs/node-gyp#on-windows)
2. Check the [electron-rebuild documentation](https://github.com/electron/rebuild)
3. Open an issue on GitHub with:
   - Full error message
   - Node.js version (`node --version`)
   - npm version (`npm --version`)
   - Python version (`python --version`)
   - Visual Studio version
