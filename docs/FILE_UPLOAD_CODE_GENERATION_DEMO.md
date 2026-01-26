# File Upload Code Generation Demonstration

This document demonstrates the current file upload code generation implementation in the browser-recorder.ts system.

## Overview

The browser recorder automatically generates Playwright test code for file upload operations, with special handling for chained recordings where files from previous steps are automatically uploaded.

## Code Generation Location

The file upload code generation is implemented in `/Users/minseocha/Desktop/projects/Taesung/EGDesk-scratch/egdesk-scratch/src/main/browser-recorder.ts` around lines 6227-6279 and 6811-6832.

## Generated Code Patterns

### 1. Chained File Upload (Automated)

When a file from a previous download step is uploaded, the generated code automatically references the downloaded file:

```javascript
// File Upload
{
  // Upload file from previous chain step
  const uploadFilePath = path.join(downloadsPath, '지명원_수정_최종_20220711.pdf');
  console.log('📤 Uploading file from chain:', uploadFilePath);

  // IMPORTANT: Set up file chooser handler BEFORE clicking
  let fileChooserResolved = false;
  page.once('filechooser', async (fileChooser) => {
    console.log('🔍 File chooser detected, handling...');
    await fileChooser.setFiles(uploadFilePath);
    console.log('✅ File uploaded:', uploadFilePath);
  });

  // Small delay to ensure listener is registered
  await page.waitForTimeout(100);

  // Try CSS selector first, fallback to XPath if it fails
  try {
    await page.locator('#fileInput').click({ timeout: 10000 });
  } catch (error) {
    console.log('⚠️ CSS selector failed, trying XPath fallback...');
    await page.locator('xpath=//*[@id="fileInput"]').click();
  }

  // Wait a moment for file chooser to be handled
  await page.waitForTimeout(1000);
}
```

### 2. Manual File Upload (User-specified path)

When a file upload occurs without a previous download, the generated code includes a placeholder for the user to specify the file path:

```javascript
// File Upload
{
  // Manual file upload - you'll need to specify the file path
  // Replace '/path/to/your/file' with the actual file path
  const uploadFilePath = '/path/to/your/file'; // TODO: Update this path
  console.log('📤 Uploading file:', uploadFilePath);

  // IMPORTANT: Set up file chooser handler BEFORE clicking
  page.once('filechooser', async (fileChooser) => {
    console.log('🔍 File chooser detected, handling...');
    await fileChooser.setFiles(uploadFilePath);
    console.log('✅ File uploaded');
  });

  // Small delay to ensure listener is registered
  await page.waitForTimeout(100);

  // Click the file input to trigger file chooser
  try {
    await page.locator('#fileInput').click({ timeout: 10000 });
  } catch (error) {
    console.log('⚠️ CSS selector failed, trying XPath fallback...');
    await page.locator('xpath=//*[@id="fileInput"]').click();
  }

  // Wait a moment for file chooser to be handled
  await page.waitForTimeout(1000);
}
```

## Real-World Example

Here's a complete example from an actual generated test file (`egdesk-browser-recorder-2026-01-26T05-10-27-219Z.spec.js`):

### Complete Test File Structure

```javascript
const { chromium } = require('playwright-core');
const path = require('path');
const os = require('os');
const fs = require('fs');

(async () => {
  console.log('🎬 Starting test replay...');

  // Create downloads directory in system Downloads folder (grouped under EGDesk-Browser)
  const downloadsPath = path.join(os.homedir(), 'Downloads', 'EGDesk-Browser', 'egdesk-browser-recorder-2026-01-26T05-10-27-219Z');
  if (!fs.existsSync(downloadsPath)) {
    fs.mkdirSync(downloadsPath, { recursive: true });
  }
  console.log('📥 Downloads will be saved to:', downloadsPath);

  // Create temporary profile directory
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-profile-'));
  console.log('📁 Using profile directory:', profileDir);

  // Launch browser with persistent context
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    channel: 'chrome',
    viewport: null,
    permissions: ['clipboard-read', 'clipboard-write'],
    acceptDownloads: true,
    downloadsPath: downloadsPath,
    args: [
      '--window-size=907,871',
      '--window-position=605,0',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--allow-running-insecure-content'
    ]
  });

  const pages = context.pages();
  let page = pages.length > 0 ? pages[0] : await context.newPage();
  const pageStack = [];

  // Set up dialog handling
  page.on('dialog', async (dialog) => {
    console.log(`🔔 Dialog detected: ${dialog.type()} - "${dialog.message()}"`);
    await dialog.accept();
    console.log('✅ Dialog accepted');
  });

  try {
    // Navigate to NAVER
    await page.goto('https://www.naver.com/');
    await page.waitForTimeout(3000);

    // Login flow...
    await page.locator('a:has-text("NAVER로그인")').click({ timeout: 10000 });
    await page.waitForTimeout(3000);

    // ... more login steps ...

    // Open MYBOX and navigate to upload page (opens new tab)
    const newPagePromise = context.waitForEvent('page');
    await page.locator('a:has-text("올리기")').click({ timeout: 10000 });

    // Switch to new tab
    const newPage = await newPagePromise;
    await newPage.waitForLoadState('domcontentloaded');
    pageStack.push(page);
    page = newPage;

    // Set up dialog handling for new page
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    // File Upload - THIS IS THE KEY PART
    {
      // Upload file from previous chain step
      const uploadFilePath = path.join(downloadsPath, '지명원_수정_최종_20220711.pdf');
      console.log('📤 Uploading file from chain:', uploadFilePath);

      // IMPORTANT: Set up file chooser handler BEFORE clicking
      let fileChooserResolved = false;
      page.once('filechooser', async (fileChooser) => {
        console.log('🔍 File chooser detected, handling...');
        await fileChooser.setFiles(uploadFilePath);
        console.log('✅ File uploaded:', uploadFilePath);
      });

      // Small delay to ensure listener is registered
      await page.waitForTimeout(100);

      // Try CSS selector first, fallback to XPath if it fails
      try {
        await page.locator('#fileInput').click({ timeout: 10000 });
      } catch (error) {
        console.log('⚠️ CSS selector failed, trying XPath fallback...');
        await page.locator('xpath=//*[@id="fileInput"]').click();
      }

      // Wait a moment for file chooser to be handled
      await page.waitForTimeout(1000);
    }

    // Wait for upload confirmation element
    await page.waitForSelector('.upload_info_area > h1:nth-child(1)', { state: 'visible', timeout: 5000 });

    // Close tab and switch back
    await page.waitForEvent('close', { timeout: 5000 }).catch(() => {});
    const previousPage = pageStack.pop();
    if (previousPage) {
      page = previousPage;
    }

  } finally {
    await context.close();
    // Clean up profile directory
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch (e) {
      console.warn('Failed to clean up profile directory:', e);
    }
  }
})().catch(console.error);
```

## Recording Action Format

The file upload action is recorded with the following structure:

```javascript
{
  type: 'fileUpload',
  selector: '#fileInput',
  xpath: '//*[@id="fileInput"]',
  filePath: '/Users/minseocha/Downloads/EGDesk-Browser/egdesk-browser-recorder-2026-01-26T05-09-30-315Z/지명원_수정_최종_20220711.pdf',
  fileName: '지명원_수정_최종_20220711.pdf',
  isChainedFile: true,
  timestamp: 48917
}
```

## Key Implementation Details

### 1. File Chooser Listener Setup (Lines 5299-5580 in browser-recorder.ts)

The recorder sets up a file chooser listener during chain mode recording:

```typescript
// Handle file chooser for uploads (ONLY in chain mode)
if (this.isChainedRecording && this.chainDownloadPath) {
  console.log('🔗 Setting up file chooser listener for chain mode');
  console.log('📂 Will auto-select:', this.chainDownloadPath);

  this.page.on('filechooser', async (fileChooser) => {
    console.log('🔍 DEBUG: FILECHOOSER CALLBACK FIRED!!!');

    try {
      // Verify file exists
      if (!fs.existsSync(this.chainDownloadPath!)) {
        console.error('❌ File not found at path:', this.chainDownloadPath);
        throw new Error(`Downloaded file not found: ${this.chainDownloadPath}`);
      }

      // Set the file
      await fileChooser.setFiles(this.chainDownloadPath!);

      const uploadedFilePath = this.chainDownloadPath!;
      const uploadedFileName = this.chainDownloadName || path.basename(this.chainDownloadPath!);

      // Get selector information
      const element = fileChooser.element();
      let selector = '';
      let xpath = '';

      try {
        // Try to get a selector for the file input element
        // ... selector generation logic ...
      } catch (err) {
        // Fallback to generic selector
        selector = 'input[type="file"]';
      }

      // Record the upload action
      this.actions.push({
        type: 'fileUpload',
        selector: selector,
        xpath: xpath,
        filePath: uploadedFilePath,
        fileName: uploadedFileName,
        isChainedFile: true,
        timestamp: Date.now() - this.startTime,
      });

      console.log('📝 Recorded file upload action:', {
        selector,
        fileName: uploadedFileName,
        isChained: true
      });

      // Show visual notification in browser
      // ... notification code ...

    } catch (error) {
      console.error('❌ File upload error:', error);
      // ... error notification ...
    }
  });
}
```

### 2. Click Deduplication (Lines 6075-6088)

The code generator scans for file uploads and removes the redundant click action:

```typescript
// Pre-scan for file uploads to identify which clicks should be skipped
const fileUploadClickIndices = new Set<number>();
for (let i = 0; i < this.actions.length; i++) {
  if (this.actions[i].type === 'fileUpload') {
    // Find the most recent click before this file upload
    // That click triggered the file chooser, so we'll handle it in the fileUpload block
    for (let j = i - 1; j >= 0; j--) {
      if (this.actions[j].type === 'click') {
        fileUploadClickIndices.add(j);
        break;
      }
    }
  }
}
```

### 3. Code Generation (Lines 6227-6279)

The file upload code is generated with proper file chooser setup:

```typescript
case 'fileUpload':
  lines.push(`    // File Upload`);
  if (action.isChainedFile && action.fileName) {
    // For chained files, reference the file from previous download
    lines.push(`    {`);
    lines.push(`      // Upload file from previous chain step`);
    lines.push(`      const uploadFilePath = path.join(downloadsPath, '${action.fileName}');`);
    lines.push(`      console.log('📤 Uploading file from chain:', uploadFilePath);`);
    lines.push(`      `);
    lines.push(`      // IMPORTANT: Set up file chooser handler BEFORE clicking`);
    lines.push(`      let fileChooserResolved = false;`);
    lines.push(`      page.once('filechooser', async (fileChooser) => {`);
    lines.push(`        console.log('🔍 File chooser detected, handling...');`);
    lines.push(`        await fileChooser.setFiles(uploadFilePath);`);
    lines.push(`        console.log('✅ File uploaded:', uploadFilePath);`);
    lines.push(`      });`);
    lines.push(`      `);
    lines.push(`      // Small delay to ensure listener is registered`);
    lines.push(`      await page.waitForTimeout(100);`);
    // ... click code generation ...
    lines.push(`      // Wait a moment for file chooser to be handled`);
    lines.push(`      await page.waitForTimeout(1000);`);
    lines.push(`    }`);
  } else {
    // For manual file uploads, add a comment explaining user needs to handle this
    lines.push(`    {`);
    lines.push(`      // Manual file upload - you'll need to specify the file path`);
    lines.push(`      const uploadFilePath = '/path/to/your/file'; // TODO: Update this path`);
    // ... similar code structure ...
    lines.push(`    }`);
  }
  break;
```

## Important Notes

1. **File Chooser Setup Timing**: The file chooser listener MUST be set up BEFORE clicking the file input element
2. **100ms Delay**: A small delay ensures the listener is properly registered before the click
3. **1000ms Wait**: After clicking, wait for the file chooser to be handled
4. **Click Deduplication**: The click that triggers the file chooser is automatically removed from the generated code to avoid duplication
5. **Chained vs Manual**: The code automatically detects if the file came from a previous download step and generates appropriate code
6. **Selector Fallback**: Both CSS and XPath selectors are preserved for robustness

## Testing the Generated Code

To test the generated code:

1. Run a recording that downloads a file
2. In the same recording session (chain mode), upload that downloaded file
3. Stop the recording
4. Check the generated `.spec.js` file in the `output/browser-recorder-tests/` directory
5. Run the generated test with: `node output/browser-recorder-tests/[filename].spec.js`

## Example Files

Real examples can be found at:
- `/Users/minseocha/Desktop/projects/Taesung/EGDesk-scratch/egdesk-scratch/output/browser-recorder-tests/egdesk-browser-recorder-2026-01-26T05-10-27-219Z.spec.js` (with file upload)
- `/Users/minseocha/Desktop/projects/Taesung/EGDesk-scratch/egdesk-scratch/output/browser-recorder-tests/egdesk-browser-recorder-2026-01-26T05-09-30-315Z.spec.js` (download only)
