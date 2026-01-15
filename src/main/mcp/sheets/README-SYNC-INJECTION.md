# Apps Script Sync Injection

Automatic sync endpoint injection for Google Apps Script projects to enable bidirectional sync between Google Sheets and SQLite.

## Overview

When you create or copy an Apps Script project, the system can automatically inject sync logic that enables:

1. **Sheet → SQLite sync** (pull changes from Google Sheets)
2. **SQLite → Sheet sync** (push changes to Google Sheets)
3. **Change tracking** with automatic onEdit triggers
4. **Multiple sync modes**: manual, periodic, and realtime

## Architecture

### Components

1. **AppsScriptSyncInjector** (`apps-script-sync-injector.ts`)
   - Generates and injects Apps Script code
   - Creates: `SyncEndpoints.gs`, `ChangelogManager.gs`, `SyncConfig.gs`
   - Updates `appsscript.json` manifest with required permissions

2. **AutoSyncSetup** (`auto-sync-setup.ts`)
   - High-level orchestration
   - Manages setup flow: check → inject → configure → push
   - Handles tunnel URL resolution

3. **IPC Handlers** (`sync-setup-handlers.ts`)
   - Exposes functionality to renderer process
   - Channels: `sync-setup:setup`, `sync-setup:update-tunnel-url`, etc.

### Generated Apps Script Files

#### SyncEndpoints.gs
Main sync logic with functions:
- `onEdit(e)` - Tracks cell changes automatically
- `getUnsynced()` - Returns unsynced changes for SQLite to pull
- `markSynced(changeIds)` - Marks changes as processed
- `getColumnHeaders(sheetName)` - Returns column mappings
- `batchUpdateCells(updates)` - Applies SQLite changes to sheet
- `setSyncMode(mode)` - Configure sync behavior
- `setTunnelUrl(url)` - Set webhook endpoint
- `doPost(e)` - Webhook handler for realtime mode

#### ChangelogManager.gs
Change tracking system:
- Maintains hidden `_sync_changelog` sheet
- Tracks: sheet, row, col, old value, new value, timestamp
- Automatic cleanup of old entries

#### SyncConfig.gs
Configuration management:
- Stores sync mode, tunnel URL, intervals
- Uses Script Properties for persistence

## Usage

### From Code

```typescript
import { setupSyncOnProjectCreation } from './mcp/sheets/auto-sync-setup';

// After creating an Apps Script project
const result = await setupSyncOnProjectCreation(projectId, {
  autoInject: true,
  syncMode: 'manual', // or 'periodic', 'realtime'
  serverName: 'my-mcp-server', // optional, uses active tunnel
  tunnelUrl: 'https://my-tunnel.com', // optional
  periodicIntervalMs: 60000 // 1 minute
});

if (result.success) {
  console.log(`Sync injected! Files: ${result.filesCreated.join(', ')}`);
}
```

### From Renderer (via IPC)

```typescript
// Setup sync for a project
const result = await window.electron.ipcRenderer.invoke('sync-setup:setup', projectId, {
  autoInject: true,
  syncMode: 'periodic',
  serverName: 'my-server'
});

// Update tunnel URL later
await window.electron.ipcRenderer.invoke('sync-setup:update-tunnel-url', projectId, newTunnelUrl);

// Check if project has sync
const status = await window.electron.ipcRenderer.invoke('sync-setup:check-status', projectId);
console.log(`Has sync: ${status.hasSync}`, status.config);

// Remove sync from project
await window.electron.ipcRenderer.invoke('sync-setup:remove', projectId);
```

## Sync Modes

### Manual Mode
- Changes are tracked but not automatically synced
- SQLite client must explicitly call `getUnsynced()` to pull changes
- Best for: Low-frequency updates, user-controlled sync

### Periodic Mode
- Changes automatically pushed every N milliseconds (default: 60s)
- Uses time-based Apps Script trigger
- Best for: Regular background sync, moderate update frequency

### Realtime Mode
- Changes pushed immediately via webhook when cells are edited
- Requires tunnel URL to be configured
- Uses `doPost()` webhook handler
- Best for: Collaborative editing, instant updates

## Integration with Sheet Sync Controller

The injected Apps Script code works seamlessly with `SheetSyncController`:

```typescript
import { createBidirectionalSync } from './mcp/sheets/sheet-sync-controller';

const syncController = createBidirectionalSync({
  db: database,
  spreadsheetId: 'your-spreadsheet-id',
  tunnelUrl: 'https://your-tunnel.com',
  schemaManager: schemaManager
});

// Set mode (calls Apps Script's setSyncMode)
await syncController.setMode('realtime');

// Pull changes (calls Apps Script's getUnsynced)
const result = await syncController.pull();

// Push changes (calls Apps Script's batchUpdateCells)
await syncController.push();
```

## Automatic Injection on Project Creation

To enable automatic injection, modify your project creation flow:

```typescript
// In your project creation handler
async function createAppsScriptProject(name: string) {
  // 1. Create the project
  const project = await appsScriptService.createProject(name);

  // 2. Automatically inject sync endpoints
  const syncResult = await setupSyncOnProjectCreation(project.id, {
    autoInject: true,
    syncMode: 'manual' // Start with manual, user can change later
  });

  if (!syncResult.success) {
    console.warn('Failed to inject sync:', syncResult.error);
  }

  return project;
}
```

## Permissions

The manifest is automatically updated with required OAuth scopes:
- `https://www.googleapis.com/auth/spreadsheets` - Read/write spreadsheet data
- `https://www.googleapis.com/auth/script.external_request` - Make HTTP requests (for webhooks)
- `https://www.googleapis.com/auth/script.scriptapp` - Manage triggers

## Deployment

For sync to work, the Apps Script must be deployed as a web app:

```typescript
// Create deployment with webhook access
const deployment = await appsScriptService.createDeployment(projectId, {
  access: 'ANYONE_ANONYMOUS', // For webhook access
  executeAs: 'USER_DEPLOYING',
  description: 'Sync Endpoints'
});

// The webhook URL is: deployment.webAppUrl
```

## Testing

Use the built-in test function in Apps Script:

```javascript
// In Apps Script editor, run:
testSync()

// Check logs for:
// - Config values
// - Unsynced changes count
// - Column headers
```

## Troubleshooting

### Sync not working
1. Check if sync endpoints are installed: `sync-setup:check-status`
2. Verify tunnel URL is correct
3. Check Apps Script logs (View → Executions)
4. Ensure project is deployed as web app

### Changes not tracked
1. Verify `onEdit` trigger is active (Apps Script → Triggers)
2. Check `_sync_changelog` sheet exists
3. Look for errors in Apps Script execution logs

### Webhook errors
1. Verify tunnel is running: `getTunnelInfo(serverName)`
2. Check tunnel URL format (must include http/https)
3. Test webhook manually: `curl -X POST [webhookUrl]`

## Example: Full Workflow

```typescript
// 1. Create Apps Script project
const project = await createProject('My Finance Tracker');

// 2. Auto-inject sync endpoints
const syncSetup = await setupSyncOnProjectCreation(project.id, {
  syncMode: 'periodic',
  serverName: 'finance-tracker-server'
});

// 3. Deploy as web app
const deployment = await appsScriptService.createDeployment(project.id);

// 4. Configure bidirectional sync
const sync = createBidirectionalSync({
  db: myDatabase,
  spreadsheetId: project.spreadsheetId,
  tunnelUrl: deployment.webAppUrl
});

// 5. Start syncing
await sync.setMode('periodic');
const result = await sync.syncBidirectional();
console.log(`Synced: ${result.pulled.applied} changes from sheet, ${result.pushed.pushed} to sheet`);
```

## Future Enhancements

- [ ] Conflict resolution UI
- [ ] Batch operation support
- [ ] Column type validation
- [ ] Change history viewer
- [ ] Sync performance metrics
- [ ] Custom trigger conditions
- [ ] Multi-sheet support optimization
