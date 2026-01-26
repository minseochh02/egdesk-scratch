# File Upload Code Generation - Quick Reference

## Generated Code Templates

### Chained File Upload
```javascript
// File Upload
{
  const uploadFilePath = path.join(downloadsPath, 'filename.pdf');
  console.log('📤 Uploading file from chain:', uploadFilePath);

  page.once('filechooser', async (fileChooser) => {
    await fileChooser.setFiles(uploadFilePath);
  });

  await page.waitForTimeout(100);
  await page.locator('#fileInput').click();
  await page.waitForTimeout(1000);
}
```

### Manual File Upload
```javascript
// File Upload
{
  const uploadFilePath = '/path/to/your/file'; // TODO: Update
  console.log('📤 Uploading file:', uploadFilePath);

  page.once('filechooser', async (fileChooser) => {
    await fileChooser.setFiles(uploadFilePath);
  });

  await page.waitForTimeout(100);
  await page.locator('#fileInput').click();
  await page.waitForTimeout(1000);
}
```

## Critical Implementation Rules

### ✅ DO

1. **Set up listener BEFORE click**
   ```javascript
   page.once('filechooser', handler);  // First
   await page.waitForTimeout(100);     // Then
   await page.locator('#input').click(); // Then
   ```

2. **Use 100ms delay before click**
   ```javascript
   page.once('filechooser', ...);
   await page.waitForTimeout(100); // ← REQUIRED
   ```

3. **Wait 1000ms after click**
   ```javascript
   await page.locator('#input').click();
   await page.waitForTimeout(1000); // ← REQUIRED
   ```

4. **Wrap in block scope**
   ```javascript
   {
     const uploadFilePath = ...;
     // ... upload code ...
   }
   ```

### ❌ DON'T

1. **Don't click before setting up listener**
   ```javascript
   // ❌ WRONG - listener set up after click
   await page.locator('#input').click();
   page.once('filechooser', handler);
   ```

2. **Don't skip timing delays**
   ```javascript
   // ❌ WRONG - no delay before click
   page.once('filechooser', handler);
   await page.locator('#input').click(); // Too fast!
   ```

3. **Don't include the trigger click separately**
   ```javascript
   // ❌ WRONG - click will happen twice
   await page.locator('#input').click();

   {
     page.once('filechooser', ...);
     await page.locator('#input').click(); // Duplicate!
   }
   ```

## File Locations

### Source Code
- **Main implementation**: `src/main/browser-recorder.ts`
  - Recording: Lines 5299-5580
  - Deduplication: Lines 6075-6088
  - Code generation: Lines 6227-6298

### Documentation
- **Complete demo**: `FILE_UPLOAD_CODE_GENERATION_DEMO.md`
- **Source code docs**: `FILE_UPLOAD_CODE_GENERATION_SOURCE.md`
- **Summary**: `FILE_UPLOAD_SUMMARY.md`
- **Quick reference**: `FILE_UPLOAD_QUICK_REFERENCE.md` (this file)

### Examples
- **Demo script**: `test-file-upload-demo.js` (runnable)
- **Real test 1**: `output/browser-recorder-tests/egdesk-browser-recorder-2026-01-26T05-10-27-219Z.spec.js`
- **Real test 2**: `output/browser-recorder-tests/egdesk-browser-recorder-2026-01-26T05-09-30-315Z.spec.js`

## Action Data Structure

```typescript
{
  type: 'fileUpload',
  selector: '#fileInput',              // CSS selector
  xpath: '//*[@id="fileInput"]',       // XPath fallback
  filePath: '/full/path/to/file.pdf',  // Uploaded file path
  fileName: 'file.pdf',                // File name only
  isChainedFile: true,                 // From previous download?
  timestamp: 48917                     // When action occurred
}
```

## Timing Sequence

```
┌─────────────────────────────────────────────────┐
│ 1. Set up file chooser listener                │
│    page.once('filechooser', ...)                │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 2. Wait 100ms                                   │
│    await page.waitForTimeout(100)               │
│    [Ensures listener is registered]             │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 3. Click file input element                     │
│    await page.locator('#input').click()         │
│    [Triggers file chooser]                      │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 4. File chooser event fires                     │
│    [Listener automatically handles it]          │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 5. Wait 1000ms                                  │
│    await page.waitForTimeout(1000)              │
│    [Allows upload to complete]                  │
└─────────────────────────────────────────────────┘
```

## Code Generation Logic

```typescript
if (action.type === 'fileUpload') {
  if (action.isChainedFile && action.fileName) {
    // Chained: Use file from downloads folder
    generate("const uploadFilePath = path.join(downloadsPath, 'file.pdf');");
  } else {
    // Manual: User must specify path
    generate("const uploadFilePath = '/path/to/your/file'; // TODO");
  }

  // Common code for both patterns
  generate("page.once('filechooser', async (fileChooser) => {");
  generate("  await fileChooser.setFiles(uploadFilePath);");
  generate("});");
  generate("await page.waitForTimeout(100);");
  generate("await page.locator(selector).click();");
  generate("await page.waitForTimeout(1000);");
}
```

## Click Deduplication

The file input click is recorded in TWO places:
1. ✅ **Keep**: File upload action (includes the click)
2. ❌ **Remove**: Regular click action (triggers file chooser)

```typescript
// Pre-scan to find and mark duplicate clicks
const fileUploadClickIndices = new Set<number>();
for (let i = 0; i < actions.length; i++) {
  if (actions[i].type === 'fileUpload') {
    // Find previous click
    for (let j = i - 1; j >= 0; j--) {
      if (actions[j].type === 'click') {
        fileUploadClickIndices.add(j); // Mark for removal
        break;
      }
    }
  }
}

// Later, during code generation
if (action.type === 'click') {
  if (fileUploadClickIndices.has(i)) {
    continue; // Skip this click
  }
  // ... generate click code ...
}
```

## Testing Checklist

- [ ] File chooser listener set up BEFORE click
- [ ] 100ms delay after listener setup
- [ ] 1000ms delay after click
- [ ] Code wrapped in `{}` block
- [ ] For chained upload: file path uses `path.join(downloadsPath, filename)`
- [ ] For manual upload: includes TODO comment
- [ ] Selector fallback (CSS → XPath) included
- [ ] No duplicate clicks in generated code
- [ ] Console logging at each step

## Common Patterns

### With Selector Fallback
```javascript
try {
  await page.locator('#fileInput').click({ timeout: 10000 });
} catch (error) {
  console.log('⚠️ CSS selector failed, trying XPath...');
  await page.locator('xpath=//*[@id="fileInput"]').click();
}
```

### With Error Handling
```javascript
page.once('filechooser', async (fileChooser) => {
  try {
    await fileChooser.setFiles(uploadFilePath);
    console.log('✅ File uploaded:', uploadFilePath);
  } catch (error) {
    console.error('❌ Upload failed:', error);
    throw error;
  }
});
```

### Multiple Files (Future)
```javascript
// Not currently supported, but pattern would be:
const uploadFilePaths = [
  path.join(downloadsPath, 'file1.pdf'),
  path.join(downloadsPath, 'file2.pdf')
];
await fileChooser.setFiles(uploadFilePaths);
```

## Run Demo

```bash
# Run demonstration test
node test-file-upload-demo.js

# Run actual generated test
node output/browser-recorder-tests/egdesk-browser-recorder-2026-01-26T05-10-27-219Z.spec.js
```

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| Test hangs at upload | Listener not set up before click | Add 100ms delay after listener setup |
| File not found | File path wrong | Check `downloadsPath` variable |
| Click happens twice | Duplicate click not removed | Check deduplication logic (lines 6075-6088) |
| Element not found | Selector changed | Use XPath fallback (generated automatically) |
| Upload too fast | No wait after click | Add 1000ms delay after click |

## Key Files to Review

1. **Implementation**: `src/main/browser-recorder.ts` (lines 6227-6298)
2. **Demo**: `test-file-upload-demo.js`
3. **Real example**: `output/browser-recorder-tests/egdesk-browser-recorder-2026-01-26T05-10-27-219Z.spec.js`

---

**Last Updated**: 2026-01-26
**Version**: 1.0.18
