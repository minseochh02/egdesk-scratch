# Windows Production Build Fixes

## Problem
Next.js setup files were not being created in Windows production builds, while dev builds worked fine.

## Root Causes

### 1. **Line Ending Issues (CRLF vs LF)**
Config files were written with Unix line endings (`\n`) only, causing issues on Windows which expects CRLF (`\r\n`).

### 2. **Windows Command Execution**
npm/npx commands on Windows are `.cmd` batch files, not executables. Spawn calls need to use `.cmd` extension explicitly.

### 3. **ASAR Production Path Resolution**
In production, `__dirname` points inside the read-only ASAR archive. The `packages` folder was not:
- Included in the build
- Unpacked from ASAR
- Accessible to plugin installation code

## Fixes Applied

### 1. Line Endings Fix

**Files Modified:**
- `src/main/coding/dev-server-manager.ts`
- `src/main/coding/node-runtime-manager.ts`
- `packages/next-api-plugin/src/generate-middleware.ts`
- `packages/next-api-plugin/src/generate-helpers.ts`
- `packages/next-api-plugin/src/generate-api-wrapper.ts`
- `packages/next-api-plugin/src/generate-proxy.ts`
- `packages/next-api-plugin/src/setup-userdata.ts`
- `packages/vite-api-plugin/src/setup-userdata.ts`

**Changes:**
- Added `import * as os from 'os'`
- Added `normalizeLineEndings()` helper in dev-server-manager
- All `fs.writeFileSync()` calls now use `content.replace(/\r?\n/g, os.EOL)` before writing

### 2. Windows Command Execution Fix

**Files Modified:**
- `src/main/coding/dev-server-manager.ts`

**Changes:**
- npx → `npx.cmd` on Windows
- npm → `npm.cmd` on Windows
- yarn → `yarn.cmd` on Windows
- pnpm → `pnpm.cmd` on Windows

**Code Pattern:**
```typescript
const command = process.platform === 'win32' ? `${packageManager}.cmd` : packageManager;
```

### 3. Production Path Resolution Fix

**Files Modified:**
- `src/main/coding/dev-server-manager.ts` - Added `getPluginPath()` method
- `package.json` - Updated electron-builder config

**Changes in dev-server-manager.ts:**
```typescript
// Added app import
import { ipcMain, app } from 'electron';

// Added getPluginPath() method that checks multiple locations:
// 1. app.asar.unpacked/packages/[plugin]
// 2. app.asar/packages/[plugin]
// 3. resources/packages/[plugin]
```

**Changes in package.json:**
```json
"asarUnpack": [
  "scripts/**",
  "packages/**",  // <- Added
  "**\\*.{node,dll,js}",
  "node_modules/@google/genai/**",
  "node_modules/mime-types/**"
],
"files": [
  "dist",
  "node_modules",
  "package.json",
  "scripts/**",
  "resources/**",
  "packages/**"  // <- Added
],
```

## Testing Checklist

### Before Rebuilding Production:
- [x] All TypeScript changes compile without errors
- [x] Plugins rebuilt: `npm run build` in both plugin folders
- [x] package.json updated with packages folder

### After Building Production (Windows):
- [ ] Next.js project initializes successfully
- [ ] Config files created with CRLF line endings
- [ ] Plugin files generated correctly
- [ ] Dev server starts without errors
- [ ] Check file encoding with `file -b [filename]` or text editor

### Verification Commands (Windows):
```powershell
# Check if packages folder exists in production
dir "C:\Program Files\EGDesk\resources\app.asar.unpacked\packages"

# Check line endings (PowerShell)
Get-Content next.config.js -Raw | Format-Hex | Select-String "0D 0A"
# Should show CRLF (0D 0A) not just LF (0A)
```

## Build Commands

```bash
# Rebuild plugins
cd packages/next-api-plugin && npm run build
cd ../vite-api-plugin && npm run build
cd ../..

# Build production Windows version
npm run package:win
```

## Notes

- The fix ensures plugins are unpacked and accessible in production
- Line endings are now platform-specific automatically
- Windows commands use .cmd extension explicitly
- Dev mode continues to work as before
