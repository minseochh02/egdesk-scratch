# Current Browser Automation Implementation

## Architecture Overview

### 1. Click Recording System

**Location**: `src/main/browser-controller.ts`

**How it works**:
```javascript
// Injected into browser windows (lines 122-156)
window.__debugClickEvents = [];
document.addEventListener('click', function(event) {
  // Captures: timestamp, x, y, elementTag, elementId, elementClass, elementText, url
  window.__debugClickEvents.push(clickData);
}, true);
```

**Data Retrieval**: 
- IPC handler `browser-window-get-click-events` (lines 224-240)
- Executes `window.__debugClickEvents || []` in browser context
- Returns array of click events to renderer

**UI Integration**: `src/renderer/App.tsx`
- Polls every 1000ms for new events (lines 595-609)
- Displays in debug modal (lines 911-928)
- Export to JSON functionality

### 2. Playwright Codegen Integration

**Location**: `src/main/chrome-handlers.ts`

**Launch Handler** (lines 945-1003):
```javascript
ipcMain.handle('launch-playwright-codegen', async (event, { url }) => {
  const codegen = spawn('npx', [
    'playwright', 
    'codegen',
    '--browser=chromium',
    '--channel=chrome',
    '--output', outputFile,
    url
  ]);
});
```

**Key Features**:
- Uses system Chrome (`--channel=chrome`)
- Saves to timestamped files in output directory
- Notifies renderer when test is saved

### 3. Test Replay System

**Location**: `src/main/chrome-handlers.ts` (lines 1006-1060)

**Current Approach**:
1. Reads saved test file
2. Detects format (test vs script)
3. Converts test format to runnable script
4. Extracts `await page.*` commands
5. Wraps in async IIFE with browser setup/teardown
6. Runs with Node.js

**Issues**:
- Requires `@playwright/test` which might not exist
- Format conversion is brittle
- No error recovery

### 4. Test Storage

**Location**: Output directory
- Development: `./output/`
- Production: `userData/output/`

**File Format**: 
- `playwright-test-{ISO-timestamp}.spec.js`
- Standard Playwright test format

## Dependencies

### NPM Packages
- `playwright: ^1.55.1` (in dependencies)
- `playwright-lighthouse: ^4.0.0` (in devDependencies)

### External Requirements
- Node.js for running tests
- npx for codegen
- Chrome browser installed

## IPC Communication

### Handlers (Main Process)
1. `launch-chrome-with-url` - Opens Chrome with automation
2. `launch-playwright-codegen` - Starts recording
3. `run-playwright-test` - Replays saved test
4. `get-playwright-tests` - Lists saved tests
5. `browser-window-create` - Creates debug browser
6. `browser-window-get-click-events` - Retrieves clicks

### API Exposure (Preload)
```javascript
debug: {
  launchPlaywrightCodegen: (url) => {...},
  getPlaywrightTests: () => {...},
  runPlaywrightTest: (testFile) => {...}
}

browserWindow: {
  createWindow: (options) => {...},
  getClickEvents: (windowId) => {...}
}
```

## UI Components

### Debug Modal (`src/renderer/App.tsx`)
- Lines 556-2200+ (large component)
- Contains multiple debug sections
- Chrome URL Opener section (lines 703-935)
- Saved tests display (lines 1020-1077)

### Features
- URL input with protocol handling
- Record clicks checkbox
- Open with Playwright Codegen button
- View/replay saved tests
- Export click events to JSON

## File Structure
```
src/
├── main/
│   ├── browser-controller.ts    # Click recording
│   ├── chrome-handlers.ts       # Playwright integration
│   └── preload.ts              # API exposure
├── renderer/
│   ├── App.tsx                 # Debug modal UI
│   └── preload.d.ts            # TypeScript types
output/                         # Saved tests
```

## Performance Considerations

1. **Polling**: Click events polled every 1 second
2. **Memory**: Click events stored in browser window memory
3. **File I/O**: Tests saved/read from disk
4. **Process Spawning**: Each codegen/replay spawns new process

## Security Considerations

1. Script injection into browser windows
2. Arbitrary JavaScript execution in replay
3. File system access for test storage
4. No sandboxing of replayed tests