# File Upload Code Generation - Source Code Documentation

This document shows the exact source code from browser-recorder.ts that generates file upload test code.

## Location in Source Code

File: `/Users/minseocha/Desktop/projects/Taesung/EGDesk-scratch/egdesk-scratch/src/main/browser-recorder.ts`

Lines: 6227-6298 (Code generation for file upload actions)

## Source Code: File Upload Code Generation

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
    lines.push(`      `);
    if (action.xpath) {
      lines.push(`      // Try CSS selector first, fallback to XPath if it fails`);
      lines.push(`      try {`);
      lines.push(`        await page.locator('${action.selector}').click({ timeout: 10000 });`);
      lines.push(`      } catch (error) {`);
      lines.push(`        console.log('⚠️ CSS selector failed, trying XPath fallback...');`);
      lines.push(`        await page.locator('xpath=${action.xpath}').click();`);
      lines.push(`      }`);
    } else {
      lines.push(`      await page.locator('${action.selector}').click();`);
    }
    lines.push(`      `);
    lines.push(`      // Wait a moment for file chooser to be handled`);
    lines.push(`      await page.waitForTimeout(1000);`);
    lines.push(`    }`);
  } else {
    // For manual file uploads, add a comment explaining user needs to handle this
    lines.push(`    {`);
    lines.push(`      // Manual file upload - you'll need to specify the file path`);
    lines.push(`      // Replace '/path/to/your/file' with the actual file path`);
    lines.push(`      const uploadFilePath = '/path/to/your/file'; // TODO: Update this path`);
    lines.push(`      console.log('📤 Uploading file:', uploadFilePath);`);
    lines.push(`      `);
    lines.push(`      // IMPORTANT: Set up file chooser handler BEFORE clicking`);
    lines.push(`      page.once('filechooser', async (fileChooser) => {`);
    lines.push(`        console.log('🔍 File chooser detected, handling...');`);
    lines.push(`        await fileChooser.setFiles(uploadFilePath);`);
    lines.push(`        console.log('✅ File uploaded');`);
    lines.push(`      });`);
    lines.push(`      `);
    lines.push(`      // Small delay to ensure listener is registered`);
    lines.push(`      await page.waitForTimeout(100);`);
    lines.push(`      `);
    if (action.xpath) {
      lines.push(`      // Try CSS selector first, fallback to XPath if it fails`);
      lines.push(`      try {`);
      lines.push(`        await page.locator('${action.selector}').click({ timeout: 10000 });`);
      lines.push(`      } catch (error) {`);
      lines.push(`        console.log('⚠️ CSS selector failed, trying XPath fallback...');`);
      lines.push(`        await page.locator('xpath=${action.xpath}').click();`);
      lines.push(`      }`);
    } else {
      lines.push(`      await page.locator('${action.selector}').click();`);
    }
    lines.push(`      `);
    lines.push(`      // Wait a moment for file chooser to be handled`);
    lines.push(`      await page.waitForTimeout(1000);`);
    lines.push(`    }`);
  }
  break;
```

## What This Code Does

This switch case handles the `fileUpload` action type and generates JavaScript code that will be written to the `.spec.js` test file.

### Two Branches:

#### 1. Chained File Upload (`action.isChainedFile && action.fileName`)
When a file from a previous download step is being uploaded:

**Generated code:**
```javascript
// File Upload
{
  // Upload file from previous chain step
  const uploadFilePath = path.join(downloadsPath, 'filename.pdf');
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

#### 2. Manual File Upload (no chained file)
When a file upload occurs but there's no previous download:

**Generated code:**
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

  // Click the file input (with selector fallback)
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

## Code Flow Analysis

### Template String Building
The code uses `lines.push()` to build an array of code lines that will be written to the test file:

```typescript
lines.push(`    // File Upload`);  // Adds: "    // File Upload"
```

### Variable Interpolation
Action properties are interpolated into the generated code:

```typescript
lines.push(`      const uploadFilePath = path.join(downloadsPath, '${action.fileName}');`);
// If action.fileName = "document.pdf", generates:
//   const uploadFilePath = path.join(downloadsPath, 'document.pdf');
```

### Conditional Code Generation
Different code is generated based on:

1. **Chained vs Manual**: `if (action.isChainedFile && action.fileName)`
2. **Selector Type**: `if (action.xpath)` - determines if XPath fallback is needed

### Key Features of Generated Code

1. **Scope Isolation**: Wraps in `{}` block to prevent variable conflicts
2. **Event Listener First**: Sets up file chooser listener BEFORE clicking
3. **Timing Controls**:
   - 100ms delay before click (ensures listener registration)
   - 1000ms delay after click (allows file chooser handling)
4. **Selector Fallback**: Tries CSS selector first, falls back to XPath
5. **Console Logging**: Extensive logging for debugging
6. **TODO Comments**: For manual uploads, includes TODO for user action

## Related Code: Click Deduplication

Lines: 6075-6088

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

This scans all actions and identifies clicks that trigger file uploads. These clicks are then skipped during code generation (line 6109-6111) to avoid duplication, since the file upload block includes its own click.

## Related Code: File Chooser Recording

Lines: 5299-5580 (simplified excerpt)

```typescript
// Handle file chooser for uploads (ONLY in chain mode)
if (this.isChainedRecording && this.chainDownloadPath) {
  this.page.on('filechooser', async (fileChooser) => {
    try {
      // Set the file from previous download
      await fileChooser.setFiles(this.chainDownloadPath!);

      const uploadedFilePath = this.chainDownloadPath!;
      const uploadedFileName = this.chainDownloadName || path.basename(this.chainDownloadPath!);

      // Get selector for file input
      const element = fileChooser.element();
      let selector = '';
      let xpath = '';
      // ... selector extraction logic ...

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

    } catch (error) {
      console.error('❌ File upload error:', error);
    }
  });
}
```

This records the file upload action when it happens during recording, which is then used by the code generator.

## Action Data Structure

```typescript
interface RecordedAction {
  type: 'fileUpload';
  selector?: string;       // CSS selector for file input
  xpath?: string;          // XPath as fallback selector
  filePath?: string;       // Full path to uploaded file
  fileName?: string;       // Name of file for display
  isChainedFile?: boolean; // Whether from previous chain step
  timestamp?: number;      // When action occurred
}
```

## Summary

The file upload code generation system:

1. Detects file upload actions during recording
2. Stores action metadata (selector, file path, chained status)
3. Pre-scans actions to deduplicate clicks
4. Generates appropriate code based on chained vs manual upload
5. Includes proper timing, error handling, and selector fallbacks
6. Wraps in isolated scope with comprehensive logging

The generated code is production-ready and handles edge cases like selector failures and timing issues.
