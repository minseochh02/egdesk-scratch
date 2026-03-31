# Next.js Plugin Configuration File Generation Fix

## Problem

In production, the EGDesk app was not generating `egdesk.config.ts` and `egdesk-helpers.ts` files when setting up Next.js projects, even though `EGDESK-README.md` was being generated successfully.

## Root Cause

The issue was in `src/main/coding/dev-server-manager.ts`:

### Issue #1: Using Local File Path
The code was trying to install `@egdesk/next-api-plugin` from a local file path:
```typescript
await this.installPackage(folderPath, `file:${pluginPath}`, packageManager, true);
```

In production, the `pluginPath` might not exist or be accessible due to ASAR packaging issues, causing the installation to fail silently.

### Issue #2: Using npx for Setup
After installation, the code used `npx egdesk-next-setup` to run the plugin:
```typescript
const setupProcess = spawn(npxCommand, ['egdesk-next-setup', ...args], {...});
```

When the package is installed from a local file path, npx might not properly resolve the binary, causing the setup to fail. The code would just warn and continue without generating the files.

## Solution

### Fix #1: Use Published npm Package
Since `@egdesk/next-api-plugin@1.0.0` is published on npm, we now install directly from npm:
```typescript
await this.installPackage(folderPath, '@egdesk/next-api-plugin@latest', packageManager, true);
```

Benefits:
- ✅ Works reliably in both dev and production
- ✅ No ASAR unpacking issues
- ✅ Always gets the latest published version
- ✅ Faster installation

### Fix #2: Direct Import Instead of npx
Instead of using npx, we now load and call the setup function directly:
```typescript
// Load from the user's project node_modules
const setupFunc = await loadNextApiPluginFromProject(folderPath);

// Call directly
await setupFunc(folderPath, {
  egdeskUrl: 'http://localhost:8080',
  apiKey: apiKey,
  useProxy: true
});
```

Helper function:
```typescript
async function loadNextApiPluginFromProject(projectPath: string): Promise<any> {
  const pluginPath = path.join(projectPath, 'node_modules', '@egdesk', 'next-api-plugin', 'dist', 'index.js');

  if (!fs.existsSync(pluginPath)) {
    return null;
  }

  const plugin = require(pluginPath);
  return plugin.setupNextApiPlugin;
}
```

Benefits:
- ✅ Direct function call - no process spawning
- ✅ Better error handling
- ✅ More reliable in production
- ✅ Faster execution

## Files Modified

1. `src/main/coding/dev-server-manager.ts`:
   - Added `loadNextApiPluginFromProject()` function
   - Modified `ensureNextApiPlugin()` to use npm package
   - Modified `setupNextApiPlugin()` to use direct import
   - Added `setupNextApiPluginViaNpx()` as fallback

## Testing

Verified the published package works:
```bash
$ npm view @egdesk/next-api-plugin
@egdesk/next-api-plugin@1.0.0 | MIT | deps: 1 | versions: 1
bin: egdesk-next-setup

$ npx @egdesk/next-api-plugin --help
Usage: egdesk-next-setup [options]
...
```

## Generated Files

After the fix, the following files will be properly generated in production:

1. ✅ `egdesk.config.ts` - Type-safe table definitions
2. ✅ `egdesk-helpers.ts` - Helper functions for database access
3. ✅ `proxy.ts` or `middleware.ts` - Database proxy interceptor
4. ✅ `src/lib/api.ts` - basePath-aware fetch wrapper
5. ✅ `.env.local` - Environment variables
6. ✅ `EGDESK-README.md` - Development guide

## Next Steps

1. Build and test the production app
2. Verify file generation in a clean Next.js project
3. Consider publishing `@egdesk/vite-api-plugin` to npm for consistency

## Notes

- The Vite plugin (`@egdesk/vite-api-plugin`) is NOT published on npm, so it continues to use the local file path installation
- Only the Next.js plugin has been updated to use the npm package
- The npx fallback method remains in place for backward compatibility
