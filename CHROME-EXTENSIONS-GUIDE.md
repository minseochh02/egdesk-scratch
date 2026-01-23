# Chrome Extensions with Playwright - Complete Guide

This guide shows how to launch Chrome with extensions in EGDesk using Playwright.

**Last Updated:** 2026-01-22

---

## Quick Answer

✅ **YES, it's possible!** You can load Chrome extensions in two ways:

1. **Using `launchPersistentContext`** (Recommended) - Load unpacked extensions
2. **Using user's Chrome profile** - Load already-installed extensions from user's Chrome

---

## Method 1: Load Unpacked Extensions (Recommended)

### Basic Example

```typescript
import { chromium } from 'playwright-core';
import path from 'path';

const extensionPath = path.join(__dirname, 'extensions', 'my-extension');

const context = await chromium.launchPersistentContext('', {
  headless: false,
  channel: 'chrome',
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`
  ]
});

const page = await context.newPage();
```

### Multiple Extensions

```typescript
const extensionPaths = [
  path.join(__dirname, 'extensions', 'extension1'),
  path.join(__dirname, 'extensions', 'extension2'),
  path.join(__dirname, 'extensions', 'extension3')
];

const context = await chromium.launchPersistentContext('', {
  headless: false,
  channel: 'chrome',
  args: [
    `--disable-extensions-except=${extensionPaths.join(',)}`,
    `--load-extension=${extensionPaths.join(',')}`
  ]
});
```

---

## Method 2: Use Existing Chrome Profile (With Installed Extensions)

If you want to use extensions already installed in the user's Chrome:

```typescript
import { chromium } from 'playwright-core';
import path from 'path';
import os from 'os';

// Get Chrome user data directory
const getChromeUserDataDir = () => {
  switch (process.platform) {
    case 'darwin':
      return path.join(os.homedir(), 'Library/Application Support/Google/Chrome');
    case 'win32':
      return path.join(os.homedir(), 'AppData/Local/Google/Chrome/User Data');
    case 'linux':
      return path.join(os.homedir(), '.config/google-chrome');
    default:
      throw new Error('Unsupported platform');
  }
};

const userDataDir = getChromeUserDataDir();

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  channel: 'chrome',
  args: [
    '--profile-directory=Default' // or 'Profile 1', 'Profile 2', etc.
  ]
});
```

**⚠️ Important:** You must close all Chrome instances before using this method, as Playwright needs exclusive access to the profile.

---

## Integration Examples for EGDesk

### Example 1: Browser Recorder with Extensions

**File:** `src/main/browser-recorder.ts`

```typescript
export class BrowserRecorder {
  private extensionPaths: string[] = [];

  setExtensions(paths: string[]): void {
    this.extensionPaths = paths;
  }

  async start(url: string, onBrowserClosed?: () => void): Promise<void> {
    // ... existing code ...

    const args = [
      `--window-size=${browserWidth},${browserHeight}`,
      `--window-position=${browserX},${browserY}`,
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      '--no-first-run'
    ];

    // Add extension args if provided
    if (this.extensionPaths.length > 0) {
      const extPaths = this.extensionPaths.join(',');
      args.push(`--disable-extensions-except=${extPaths}`);
      args.push(`--load-extension=${extPaths}`);
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

**Usage:**
```typescript
const recorder = new BrowserRecorder();
recorder.setExtensions([
  '/path/to/extension1',
  '/path/to/extension2'
]);
await recorder.start('https://example.com');
```

### Example 2: Bank Automator with Extensions

**File:** `src/main/financehub/core/BaseBankAutomator.js`

```javascript
async setupBrowser(proxyUrl = '', extensionPaths = []) {
  const args = [
    '--disable-blink-features=AutomationControlled',
    '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process'
  ];

  // Add extensions
  if (extensionPaths.length > 0) {
    const extPaths = extensionPaths.join(',');
    args.push(`--disable-extensions-except=${extPaths}`);
    args.push(`--load-extension=${extPaths}`);
  }

  this.context = await chromium.launchPersistentContext(profileDir, {
    headless: this.config.headless,
    channel: 'chrome',
    viewport: null,
    acceptDownloads: true,
    args: args
  });
}
```

### Example 3: IPC Handler for Extension Management

**File:** `src/main/chrome-handlers.ts`

```typescript
// Add this to chrome-handlers.ts
ipcMain.handle('browser-recorder-with-extensions', async (event, { url, extensionPaths }) => {
  try {
    console.log('🎭 Launching browser recorder with extensions:', extensionPaths);

    const recorder = new BrowserRecorder();

    if (extensionPaths && extensionPaths.length > 0) {
      recorder.setExtensions(extensionPaths);
    }

    await recorder.start(url);

    return { success: true };
  } catch (error) {
    console.error('Error launching recorder with extensions:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});
```

**Frontend usage:**
```typescript
// From renderer process
await window.electron.launchRecorderWithExtensions({
  url: 'https://example.com',
  extensionPaths: [
    '/Users/you/Downloads/my-extension',
    '/Users/you/Downloads/another-extension'
  ]
});
```

---

## Extension Directory Structure

Extensions must be **unpacked** (source code, not .crx files):

```
extensions/
├── my-extension/
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   ├── popup.html
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
└── another-extension/
    ├── manifest.json
    └── ...
```

---

## Common Extensions for Automation

### 1. Proxy Extensions

```typescript
// Create a simple proxy extension programmatically
function createProxyExtension(proxyHost: string, proxyPort: number): string {
  const manifest = {
    version: "1.0.0",
    manifest_version: 2,
    name: "Proxy Extension",
    permissions: ["proxy", "tabs", "unlimitedStorage", "storage", "<all_urls>"],
    background: {
      scripts: ["background.js"]
    }
  };

  const background = `
    var config = {
      mode: "fixed_servers",
      rules: {
        singleProxy: {
          scheme: "http",
          host: "${proxyHost}",
          port: ${proxyPort}
        },
        bypassList: ["localhost"]
      }
    };
    chrome.proxy.settings.set({value: config, scope: "regular"}, function() {});
  `;

  const extensionDir = path.join(os.tmpdir(), 'proxy-extension');
  if (!fs.existsSync(extensionDir)) {
    fs.mkdirSync(extensionDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(extensionDir, 'manifest.json'),
    JSON.stringify(manifest)
  );
  fs.writeFileSync(
    path.join(extensionDir, 'background.js'),
    background
  );

  return extensionDir;
}

// Usage
const proxyExtPath = createProxyExtension('proxy.example.com', 8080);
const context = await chromium.launchPersistentContext('', {
  args: [
    `--disable-extensions-except=${proxyExtPath}`,
    `--load-extension=${proxyExtPath}`
  ]
});
```

### 2. User-Agent Switcher

Useful for bypassing bot detection.

### 3. Cookie Manager

For managing authentication across sessions.

### 4. Ad Blocker

Speeds up automation by blocking ads.

---

## Limitations & Gotchas

### ❌ Cannot Use with Headless Mode

```typescript
// This will NOT work
const context = await chromium.launchPersistentContext('', {
  headless: true,  // ❌ Extensions don't work in headless mode
  args: ['--load-extension=...']
});
```

**Workaround:** Use `headless: false` or use `--headless=new` (experimental).

### ❌ Cannot Load .crx Files Directly

```typescript
// This will NOT work
args: ['--load-extension=/path/to/extension.crx']  // ❌
```

**Solution:** Extract the .crx to a folder first:
```bash
# On macOS/Linux
unzip extension.crx -d extension-folder

# Then use
args: ['--load-extension=/path/to/extension-folder']  // ✅
```

### ⚠️ Extension Popups May Interfere

Some extensions show popups on first load. You may need to:
- Disable the extension's "welcome" page
- Close popups programmatically
- Use the extension's API to configure it

### ⚠️ Manifest V3 Considerations

Chrome is moving to Manifest V3. Ensure your extensions support it:
```json
{
  "manifest_version": 3,
  // ... rest of manifest
}
```

---

## Testing Extensions Work

```typescript
// After launching context with extensions
const page = await context.newPage();

// Check loaded extensions
const extensions = await page.evaluate(() => {
  return (window as any).chrome?.runtime ? 'Extensions loaded' : 'No extensions';
});

console.log(extensions);

// Get extension IDs
await page.goto('chrome://extensions/');
await page.screenshot({ path: 'extensions-loaded.png' });
```

---

## Real-World Use Cases

### 1. Captcha Solvers

Load a captcha solver extension for automation:
```typescript
const captchaSolverPath = '/path/to/captcha-solver-extension';
await chromium.launchPersistentContext('', {
  args: [`--load-extension=${captchaSolverPath}`]
});
```

### 2. Session Recording

Load session replay extensions for debugging:
```typescript
const sessionRecorderPath = '/path/to/session-recorder';
```

### 3. Network Interceptors

Modify requests/responses on the fly.

---

## Complete Working Example

```typescript
import { chromium } from 'playwright-core';
import path from 'path';
import fs from 'fs';
import os from 'os';

async function launchWithExtensions() {
  // Create a simple test extension
  const extensionDir = path.join(os.tmpdir(), 'test-extension');

  if (!fs.existsSync(extensionDir)) {
    fs.mkdirSync(extensionDir, { recursive: true });
  }

  // Create manifest.json
  const manifest = {
    manifest_version: 3,
    name: 'Test Extension',
    version: '1.0',
    action: {
      default_popup: 'popup.html'
    },
    permissions: ['activeTab']
  };

  fs.writeFileSync(
    path.join(extensionDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  // Create popup.html
  fs.writeFileSync(
    path.join(extensionDir, 'popup.html'),
    '<html><body><h1>Hello from extension!</h1></body></html>'
  );

  // Launch Chrome with extension
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    channel: 'chrome',
    args: [
      `--disable-extensions-except=${extensionDir}`,
      `--load-extension=${extensionDir}`
    ]
  });

  const page = await context.newPage();
  await page.goto('https://example.com');

  console.log('✅ Chrome launched with extension!');
  console.log('Extension location:', extensionDir);

  // Keep browser open for inspection
  await new Promise(resolve => setTimeout(resolve, 60000));

  await context.close();
}

launchWithExtensions().catch(console.error);
```

---

## Recommended Approach for EGDesk

1. **Store extensions in:** `{userData}/chrome-extensions/`
2. **Create UI for extension management:**
   - Upload extension folders
   - Enable/disable extensions per automation
   - Show loaded extensions in recorder
3. **Persist extension preferences** in electron-store
4. **Generate code with extension paths** in browser recorder

---

## Summary

| Aspect | Solution |
|--------|----------|
| **Can load extensions?** | ✅ Yes |
| **Headless support?** | ❌ No (use headless: false) |
| **File format** | Unpacked folder (not .crx) |
| **Launch method** | `launchPersistentContext` with `--load-extension` |
| **Multiple extensions** | ✅ Yes (comma-separated paths) |
| **User's Chrome extensions** | ✅ Yes (use user's profile path) |
| **Programmatic extensions** | ✅ Yes (create manifest.json dynamically) |

**Best Practice:** Create extensions programmatically for specific needs (proxy, cookies) rather than loading external .crx files.
