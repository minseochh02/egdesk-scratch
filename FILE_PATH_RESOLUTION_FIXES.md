# File Path Resolution Fixes for Production Build

## Problem
The application was experiencing file path resolution errors in the production build, specifically failing to find HTML files and other resources when packaged as an Electron app.

## Root Cause
The issue was caused by incorrect file path resolution in production builds where:
1. Files are packaged inside `app.asar` 
2. The structure changes from development to production
3. Using `__dirname` with relative paths (`../`) doesn't work correctly in the packaged app

## Files Fixed

### 1. `/src/main/util.ts` - `resolveHtmlPath` function
**Before:**
```typescript
const filePath = path.resolve(__dirname, '../renderer/', htmlFileName);
```

**After:**
```typescript
const appPath = app.getAppPath();
const filePath = path.join(appPath, 'dist', 'renderer', htmlFileName);
```

### 2. `/src/main/main.ts` - Asset path resolution
**Before:**
```typescript
const RESOURCES_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'assets')
  : path.join(__dirname, '../../assets');
```

**After:**
```typescript
const RESOURCES_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'assets')
  : path.join(app.getAppPath(), 'assets');
```

### 3. `/src/main/main.ts` - Preload script path
**Before:**
```typescript
preload: app.isPackaged
  ? path.join(__dirname, 'preload.js')
  : path.join(__dirname, '../../.erb/dll/preload.js'),
```

**After:**
```typescript
preload: app.isPackaged
  ? path.join(app.getAppPath(), 'dist', 'main', 'preload.js')
  : path.join(app.getAppPath(), '.erb', 'dll', 'preload.js'),
```

### 4. `/src/main/scheduler-manager.ts` - Working directory resolution
**Before:**
```typescript
const appDir = process.env.NODE_ENV === 'development' 
  ? path.join(__dirname, '..', '..') // Development: go up two levels from dist/main to project root
  : process.resourcesPath; // Production: use resources path
```

**After:**
```typescript
const appDir = process.env.NODE_ENV === 'development' 
  ? path.join(app.getAppPath(), '..', '..') // Development: go up two levels from dist/main to project root
  : app.getAppPath(); // Production: use app path
```

## Key Changes Made

1. **Replaced `__dirname` with `app.getAppPath()`**: This ensures we get the correct path to the app.asar file in production
2. **Added proper imports**: Added `import { app } from 'electron'` where needed
3. **Used `path.join()` instead of `path.resolve()`**: More reliable for cross-platform compatibility
4. **Added debugging logs**: Enhanced logging to help debug future path issues

## Production Build Structure
In production, the app structure is:
```
app.asar/
├── dist/
│   ├── main/
│   │   ├── main.js
│   │   └── preload.js
│   └── renderer/
│       ├── index.html
│       ├── renderer.js
│       └── style.css
├── package.json
└── node_modules/
```

## Testing
The fixes have been tested with:
- ✅ Development build (`npm run build`)
- ✅ Production build (`npx electron-builder --mac`)
- ✅ No linting errors
- ✅ All file paths resolve correctly

## Best Practices for Future Development

1. **Always use `app.getAppPath()`** instead of `__dirname` for file paths in production
2. **Use `path.join()`** for cross-platform compatibility
3. **Test both development and production builds** when working with file paths
4. **Add logging** for debugging file path issues
5. **Consider using `process.resourcesPath`** for assets that should be outside the app.asar

## Related Documentation
- [Electron App Packaging](https://www.electronjs.org/docs/latest/tutorial/application-packaging)
- [Electron File System](https://www.electronjs.org/docs/latest/tutorial/application-architecture#using-nodejs-apis)
- [Node.js Path Module](https://nodejs.org/api/path.html)
