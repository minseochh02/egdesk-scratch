# Action Chain Feature - Design Documentation

**Feature:** Action Chain for Browser Recorder
**Purpose:** Streamlined download → upload workflow automation
**Status:** 🚧 Planned Implementation
**Last Updated:** 2026-01-24

---

## Quick Summary

**What it does:**
After recording a browser automation that downloads a file, users can immediately chain a second recording to upload that file to another destination - completely hands-free.

**User Experience:**
1. Record workflow that downloads a file
2. Click "Stop Recording"
3. See: "Upload the downloaded file to: [URL input]"
4. Enter destination URL and click "Start Upload Recording"
5. When user clicks file upload button, the downloaded file is auto-selected
6. Complete upload workflow and stop recording
7. Entire chain can now be replayed with one click

**Key Innovation:** No modal dialogs, no file browsing - just enter a URL and go!

---

## Table of Contents
1. [Overview](#overview)
2. [User Flow](#user-flow)
3. [UI Changes](#ui-changes)
4. [Architecture](#architecture)
5. [Implementation Guide](#implementation-guide)
6. [Data Structures](#data-structures)
7. [Code Examples](#code-examples)
8. [Future Enhancements](#future-enhancements)

---

## Overview

### What is Action Chain?

Action Chain is a streamlined feature that allows users to create download-to-upload workflows. After recording a browser automation that downloads a file, users can immediately start a second recording to upload that file to another destination - without any manual file selection.

**Key Benefits:**
- 🎯 **Simple & Focused**: One clear use case - download then upload
- ⚡ **No Manual Steps**: Downloaded file is automatically selected in upload step
- 🔗 **Seamless Flow**: Stop recording → Enter upload URL → Start recording
- 🤖 **Full Automation**: Entire workflow can be replayed with one click

### Core Concept

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Recording 1   │      │   Recording 2   │      │   Recording 3   │
│  Download File  │─────▶│   Upload File   │─────▶│  Verify Upload  │
└─────────────────┘      └─────────────────┘      └─────────────────┘
         │                        │                        │
         │                        │                        │
    file.pdf              Uses file.pdf              Checks result
```

### Use Cases

1. **Invoice Processing**
   - Download invoice from billing portal
   - Upload to accounting system
   - Submit for approval

2. **Document Verification**
   - Download ID document from system A
   - Upload to verification portal
   - Complete KYC process

3. **Report Distribution**
   - Generate and download report
   - Upload to cloud storage
   - Share via upload form

4. **File Migration**
   - Download files from old system
   - Upload to new system
   - Verify transfer completion

5. **Compliance Documentation**
   - Download compliance certificates
   - Upload to regulatory portal
   - Submit filing

---

## User Flow

### Step 1: Record Initial Action (Download)
```
1. User enters URL (e.g., https://invoices.example.com)
2. User clicks "Start Recording"
3. User logs in and downloads invoice.pdf
4. User clicks "Stop Recording"
5. Test is saved automatically
```

### Step 2: Chain Next Action
```
6. ✨ NEW: "Upload to..." section appears below "Stop Recording"
7. Shows: "✅ File downloaded: invoice.pdf"
8. Input field: "Upload the downloaded file to..."
9. User enters destination URL (e.g., https://upload.example.com)
10. User clicks "Start Upload Recording"
```

### Step 3: Record Upload Action
```
11. New browser window launches at destination URL
12. User navigates to file upload area
13. User clicks file input → File picker auto-selects invoice.pdf
14. User completes upload process
15. User clicks "Stop Recording"
16. Chain is complete and saved!
```

### Step 4: Save & Execute Chain
```
17. System generates combined test file or linked tests
18. User can replay entire chain with one click
19. System handles file transfer between steps automatically
```

---

## Visual Mockup

Here's what the user will see after stopping a recording with a download:

```
┌─────────────────────────────────────────────────────────────────┐
│                       Browser Recorder                          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Record New Test                                                 │
├─────────────────────────────────────────────────────────────────┤
│ URL: https://invoices.example.com                               │
│ [🎹 Start Recording]  [🧩 Extensions (0)]                       │
└─────────────────────────────────────────────────────────────────┘

        ↓ User records download, clicks Stop Recording ↓

┌─────────────────────────────────────────────────────────────────┐
│ ✅ File downloaded: invoice-2024-01.pdf                         │
├─────────────────────────────────────────────────────────────────┤
│ Upload the downloaded file to:                                  │
│                                                                  │
│ [https://accounting.example.com/upload                        ] │
│                                                                  │
│ [🎥 Start Upload Recording]  [✅ Done]                          │
└─────────────────────────────────────────────────────────────────┘

        ↓ User enters URL and clicks Start Upload Recording ↓

┌─────────────────────────────────────────────────────────────────┐
│ 🔗 Action Chain in Progress                                     │
├─────────────────────────────────────────────────────────────────┤
│ Step 1: Download invoice-2024-01.pdf              ✅ Complete   │
│ Step 2: Upload to accounting.example.com          ⏳ Recording  │
├─────────────────────────────────────────────────────────────────┤
│ [⏹️ Stop Recording]                                              │
└─────────────────────────────────────────────────────────────────┘

        ↓ User completes upload, clicks Stop Recording ↓

┌─────────────────────────────────────────────────────────────────┐
│ ✅ Action Chain Saved Successfully!                              │
├─────────────────────────────────────────────────────────────────┤
│ Workflow: Download invoice → Upload to accounting               │
│ Test saved: invoice-upload-chain.spec.ts                        │
│                                                                  │
│ This chain can now be replayed with one click!                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## UI Changes

### 1. Recording Controls Section (BrowserRecorderPage.tsx)

**Current State:**
```tsx
{!isRecordingEnhanced ? (
  <button onClick={startRecording}>🎹 Start Recording</button>
) : (
  <button onClick={stopRecording}>⏹️ Stop Recording</button>
)}
```

**New State:**
```tsx
{!isRecordingEnhanced ? (
  <button onClick={startRecording}>🎹 Start Recording</button>
) : (
  <button onClick={stopRecording}>⏹️ Stop Recording</button>
)}

{/* NEW: Show after recording stops if download detected */}
{justStoppedRecording && lastRecordingHadDownload && (
  <div className="action-chain-upload">
    <div className="chain-download-info">
      <span className="success-icon">✅</span>
      <span className="download-message">
        File downloaded: <strong>{lastDownloadedFile}</strong>
      </span>
    </div>

    <div className="chain-upload-form">
      <label className="chain-upload-label">
        Upload the downloaded file to:
      </label>
      <div className="chain-upload-controls">
        <input
          type="url"
          placeholder="https://upload.example.com"
          value={uploadDestinationUrl}
          onChange={(e) => setUploadDestinationUrl(e.target.value)}
          className="browser-recorder-url-input"
        />
        <button
          onClick={startUploadRecording}
          className="browser-recorder-btn browser-recorder-btn-primary"
          disabled={!uploadDestinationUrl}
        >
          🎥 Start Upload Recording
        </button>
        <button
          onClick={finishWithoutChain}
          className="browser-recorder-btn browser-recorder-btn-secondary"
        >
          ✅ Done
        </button>
      </div>
    </div>
  </div>
)}
```

### 2. Chain Status Indicator

```tsx
{/* NEW: Action Chain Progress Indicator */}
{isInActionChain && (
  <div className="action-chain-progress">
    <h3>🔗 Action Chain Progress</h3>
    <div className="chain-steps">
      {chainSteps.map((step, idx) => (
        <div
          key={idx}
          className={`chain-step ${step.completed ? 'completed' : 'pending'}`}
        >
          <span className="step-number">{idx + 1}</span>
          <span className="step-name">{step.name}</span>
          <span className="step-status">
            {step.completed ? '✅' : '⏳'}
          </span>
        </div>
      ))}
    </div>
  </div>
)}
```

### 3. CSS Styling for Upload Section

```css
/* NEW: Action Chain Upload Section */
.action-chain-upload {
  margin-top: 20px;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.chain-download-info {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  color: white;
}

.success-icon {
  font-size: 24px;
}

.download-message {
  font-size: 16px;
}

.download-message strong {
  font-weight: 600;
  text-decoration: underline;
}

.chain-upload-label {
  display: block;
  color: white;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
}

.chain-upload-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.chain-upload-controls input {
  flex: 1;
  background: white;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.chain-upload-controls input:focus {
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}
```

### 4. Chain Test Display

```tsx
{/* NEW: Display chained tests differently in saved tests list */}
{test.isChain && (
  <div className="chain-test-item">
    <div className="chain-header">
      <strong>🔗 {test.name}</strong>
      <span className="chain-badge">{test.chainSteps.length} steps</span>
    </div>

    <div className="chain-steps-preview">
      {test.chainSteps.map((step, idx) => (
        <div key={idx} className="chain-step-preview">
          <span className="step-icon">{getStepIcon(step.type)}</span>
          <span className="step-desc">{step.description}</span>
        </div>
      ))}
    </div>

    <div className="chain-actions">
      <button onClick={() => viewChain(test)}>👁️ View Chain</button>
      <button onClick={() => runChain(test)}>▶️ Run Chain</button>
      <button onClick={() => editChain(test)}>✏️ Edit</button>
    </div>
  </div>
)}
```

---

## Architecture

### System Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                    Browser Recorder Main Process                  │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              Action Chain Manager (NEW)                     │  │
│  │  - Track current chain state                                │  │
│  │  - Store downloaded file paths                              │  │
│  │  - Link recording sessions                                  │  │
│  │  - Generate combined test code                              │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│                              │                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              Existing Browser Recorder                      │  │
│  │  - Recording sessions                                       │  │
│  │  - Download tracking                                        │  │
│  │  - Code generation                                          │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              │ IPC Events
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                         Renderer Process                          │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │         BrowserRecorderPage (MODIFIED)                      │  │
│  │  - Show "Next Action" button                                │  │
│  │  - Display chain progress                                   │  │
│  │  - Handle chain configuration                               │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### State Management

**New State Variables:**
```typescript
// In BrowserRecorderPage.tsx
const [isInActionChain, setIsInActionChain] = useState(false);
const [chainSteps, setChainSteps] = useState<ChainStep[]>([]);
const [lastDownloadedFile, setLastDownloadedFile] = useState<string>('');
const [lastRecordingHadDownload, setLastRecordingHadDownload] = useState(false);
const [justStoppedRecording, setJustStoppedRecording] = useState(false);
const [uploadDestinationUrl, setUploadDestinationUrl] = useState('');
const [currentChainId, setCurrentChainId] = useState<string | null>(null);
```

**In browser-recorder.ts:**
```typescript
class ActionChainManager {
  private currentChain: ActionChain | null = null;
  private downloadedFiles: Map<string, string> = new Map(); // sessionId -> filePath

  startChain(chainId: string): void;
  addRecordingToChain(sessionId: string, actions: RecordedAction[]): void;
  linkDownloadToNextSession(downloadPath: string): void;
  generateChainedTestCode(): string;
  endChain(): ActionChain;
}
```

---

## Implementation Guide

### Phase 1: Basic Chain Support

#### 1.1 Detect Downloads in Recording
```typescript
// In stopBrowserRecorderEnhanced()
const downloadActions = this.actions.filter(a => a.type === 'download');
const hasDownloads = downloadActions.length > 0;
const lastDownload = hasDownloads ? downloadActions[downloadActions.length - 1] : null;

// Emit event with download info
this.mainWindow?.webContents.send('playwright-test-saved', {
  filePath: this.currentTestPath,
  hasDownloads,
  lastDownloadedFile: lastDownload?.value, // filename
  lastDownloadPath: lastDownload?.url, // full path
});
```

#### 1.2 Add Chain State to Recording Session
```typescript
interface RecordingSession {
  id: string;
  testPath: string;
  actions: RecordedAction[];
  startTime: number;
  endTime?: number;
  downloads: DownloadInfo[];
  chainId?: string; // NEW
  chainPosition?: number; // NEW: 0, 1, 2... position in chain
  previousSessionFile?: string; // NEW: file from previous step
}

interface DownloadInfo {
  filename: string;
  path: string;
  timestamp: number;
}
```

#### 1.3 Create ActionChainManager Class
```typescript
// New file: src/main/action-chain-manager.ts
export class ActionChainManager {
  private chains: Map<string, ActionChain> = new Map();

  createChain(firstSessionId: string): string {
    const chainId = `chain-${Date.now()}`;
    const chain: ActionChain = {
      id: chainId,
      sessions: [firstSessionId],
      downloadedFiles: [],
      createdAt: new Date(),
      status: 'in-progress',
    };
    this.chains.set(chainId, chain);
    return chainId;
  }

  addSessionToChain(chainId: string, sessionId: string): void {
    const chain = this.chains.get(chainId);
    if (!chain) throw new Error('Chain not found');
    chain.sessions.push(sessionId);
  }

  registerDownload(chainId: string, downloadPath: string): void {
    const chain = this.chains.get(chainId);
    if (!chain) throw new Error('Chain not found');
    chain.downloadedFiles.push(downloadPath);
  }

  completeChain(chainId: string): ActionChain {
    const chain = this.chains.get(chainId);
    if (!chain) throw new Error('Chain not found');
    chain.status = 'completed';
    chain.completedAt = new Date();
    return chain;
  }
}
```

### Phase 2: UI Integration

#### 2.1 Show Next Action Button
```typescript
// In BrowserRecorderPage.tsx
useEffect(() => {
  const handleTestSaved = (data: any) => {
    if (data && data.filePath) {
      addDebugLog(`📁 Test saved: ${data.filePath}`);

      // NEW: Check if downloads were detected
      if (data.hasDownloads) {
        setLastDownloadedFile(data.lastDownloadedFile || 'unknown file');
        setLastRecordingHadDownload(true);
        setJustStoppedRecording(true);

        // Auto-hide after 60 seconds
        setTimeout(() => {
          setJustStoppedRecording(false);
        }, 60000);
      }
    }

    // Refresh test list
    loadTests();
  };

  const unsubscribe = window.electron.ipcRenderer.on(
    'playwright-test-saved',
    handleTestSaved
  );

  return () => unsubscribe();
}, []);
```

#### 2.2 Handle Upload Recording Start
```typescript
const startUploadRecording = async () => {
  if (!uploadDestinationUrl) {
    addDebugLog('⚠️ Please enter a destination URL');
    return;
  }

  try {
    addDebugLog(`🔗 Starting upload recording for ${lastDownloadedFile}...`);
    addDebugLog(`📍 Destination: ${uploadDestinationUrl}`);

    // Start new recording as part of chain
    const result = await window.electron.debug.launchBrowserRecorderEnhanced({
      url: uploadDestinationUrl.startsWith('http')
        ? uploadDestinationUrl
        : `https://${uploadDestinationUrl}`,
      chainId: currentChainId || undefined,
      previousDownload: lastDownloadedFile,
      extensionPaths: selectedExtensionPaths,
    });

    if (result?.success) {
      setIsInActionChain(true);

      // Create chain ID if this is the first chained action
      if (!currentChainId) {
        setCurrentChainId(result.chainId);
        addDebugLog(`🔗 Chain created: ${result.chainId}`);
      }

      // Add step to chain visualization
      setChainSteps([
        ...chainSteps,
        {
          name: `Upload ${lastDownloadedFile}`,
          completed: false,
          type: 'upload',
        }
      ]);

      setIsRecordingEnhanced(true);
      setJustStoppedRecording(false);
      setUploadDestinationUrl(''); // Clear input

      addDebugLog('✅ Upload recording started');
      addDebugLog('📌 File inputs will auto-select your downloaded file');
    } else {
      addDebugLog(`❌ Failed to start upload recording: ${result?.error}`);
    }
  } catch (error) {
    console.error('Error starting upload recording:', error);
    addDebugLog(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

const finishWithoutChain = () => {
  addDebugLog('✅ Recording complete (no upload)');
  setJustStoppedRecording(false);
  setLastRecordingHadDownload(false);
  setLastDownloadedFile('');
  setUploadDestinationUrl('');
};
```

### Phase 3: Auto-Fill Upload Inputs

#### 3.1 Inject File Upload Helper
```typescript
// In browser-recorder.ts - inject into page context
async injectFileUploadHelper(page: Page, filePath: string) {
  await page.addInitScript((downloadedFile) => {
    // Override file input behavior to auto-select our file
    const originalClick = HTMLInputElement.prototype.click;

    HTMLInputElement.prototype.click = function() {
      if (this.type === 'file') {
        // Store reference for our recorder to handle
        (window as any).__pendingFileUpload = {
          element: this,
          expectedFile: downloadedFile,
        };
      }
      return originalClick.apply(this, arguments as any);
    };
  }, filePath);
}
```

#### 3.2 Handle File Upload Actions
```typescript
// Listen for file chooser events
page.on('filechooser', async (fileChooser) => {
  const pendingUpload = await page.evaluate(() =>
    (window as any).__pendingFileUpload
  );

  if (pendingUpload && this.chainDownloadPath) {
    // Auto-select the downloaded file
    await fileChooser.setFiles(this.chainDownloadPath);

    // Record as chained upload action
    this.actions.push({
      type: 'uploadChainedFile',
      selector: await this.getSelector(pendingUpload.element),
      value: path.basename(this.chainDownloadPath),
      chainedFrom: this.chainId,
      timestamp: Date.now() - this.recordingStartTime,
    });
  }
});
```

### Phase 4: Code Generation

#### 4.1 Generate Combined Test
```typescript
generateChainedTestCode(chain: ActionChain): string {
  const sessions = chain.sessions.map(id => this.getSession(id));

  const imports = [
    "import { test, expect } from '@playwright/test';",
    "import * as path from 'path';",
    "import * as os from 'os';",
    "",
  ];

  const testCode = [
    `test('chained-test-${chain.id}', async ({ page, context }) => {`,
    `  // Action Chain: ${sessions.length} steps`,
    `  console.log('🔗 Starting action chain...');`,
    ``,
  ];

  sessions.forEach((session, idx) => {
    testCode.push(`  // ========== Step ${idx + 1}: ${session.name} ==========`);

    if (idx > 0 && session.previousSessionFile) {
      testCode.push(`  // Using file from previous step: ${session.previousSessionFile}`);
      testCode.push(`  const uploadFilePath = path.join(os.homedir(), 'Downloads', 'EGDesk-Browser', '${session.previousSessionFile}');`);
      testCode.push(``);
    }

    // Generate actions for this session
    session.actions.forEach(action => {
      testCode.push(...this.generateActionCode(action, idx));
    });

    testCode.push(``);
  });

  testCode.push(`  console.log('✅ Action chain completed!');`);
  testCode.push(`});`);

  return [...imports, ...testCode].join('\n');
}
```

#### 4.2 Handle Upload Action Code
```typescript
private generateActionCode(action: RecordedAction, stepIndex: number): string[] {
  switch (action.type) {
    case 'uploadChainedFile':
      return [
        `  // Upload file from previous chain step`,
        `  await page.locator('${action.selector}').setInputFiles(uploadFilePath);`,
        `  console.log('📤 File uploaded:', uploadFilePath);`,
      ];

    // ... other action types
  }
}
```

### Phase 5: IPC Methods

```typescript
// In main.ts - add new IPC handlers
ipcMain.handle('browser-recorder:start-chain', async () => {
  const chainId = browserRecorder.actionChainManager.createChain();
  return { success: true, chainId };
});

ipcMain.handle('browser-recorder:add-to-chain', async (event, { chainId, sessionId }) => {
  browserRecorder.actionChainManager.addSessionToChain(chainId, sessionId);
  return { success: true };
});

ipcMain.handle('browser-recorder:complete-chain', async (event, { chainId }) => {
  const chain = browserRecorder.actionChainManager.completeChain(chainId);
  const testCode = browserRecorder.generateChainedTestCode(chain);

  // Save combined test
  const testPath = await browserRecorder.saveChainedTest(chainId, testCode);

  return { success: true, testPath, chain };
});

ipcMain.handle('browser-recorder:get-chains', async () => {
  const chains = browserRecorder.actionChainManager.getAllChains();
  return { success: true, chains };
});
```

---

## Data Structures

### ActionChain Interface
```typescript
interface ActionChain {
  id: string;
  name?: string;
  sessions: string[]; // Array of session IDs
  downloadedFiles: string[]; // Paths to files downloaded during chain
  createdAt: Date;
  completedAt?: Date;
  status: 'in-progress' | 'completed' | 'failed';
  metadata?: {
    totalActions: number;
    totalDuration: number;
    filesTransferred: number;
  };
}
```

### ChainStep Interface
```typescript
interface ChainStep {
  id: string;
  name: string; // e.g., "Download Invoice", "Upload to Portal"
  type: 'download' | 'upload' | 'navigate' | 'custom';
  completed: boolean;
  sessionId?: string;
  testPath?: string;
  downloadedFile?: string;
  uploadedFile?: string;
  startTime?: Date;
  endTime?: Date;
  error?: string;
}
```

### Extended RecordedAction
```typescript
interface RecordedAction {
  // ... existing fields ...

  // NEW: Chain-related fields
  chainId?: string;
  chainPosition?: number;
  isChainedUpload?: boolean;
  chainedFileSource?: string; // Path to file from previous step
}
```

---

## Code Examples

### Example 1: Simple Download → Upload Chain

**Step 1 Recording (Download):**
```typescript
const actions1 = [
  { type: 'navigate', url: 'https://invoices.example.com' },
  { type: 'fill', selector: '#username', value: 'user@example.com' },
  { type: 'fill', selector: '#password', value: 'password123' },
  { type: 'keypress', key: 'Enter' },
  { type: 'click', selector: '#download-invoice' },
  { type: 'download', value: 'invoice-2024-01.pdf', url: '/path/to/invoice.pdf' },
];
```

**Step 2 Recording (Upload):**
```typescript
const actions2 = [
  { type: 'navigate', url: 'https://accounting.example.com' },
  { type: 'click', selector: '#upload-invoice-btn' },
  { type: 'uploadChainedFile', selector: 'input[type="file"]', chainedFileSource: 'invoice-2024-01.pdf' },
  { type: 'click', selector: '#submit-btn' },
  { type: 'waitForElement', selector: '.success-message' },
];
```

**Generated Combined Test:**
```typescript
import { test } from '@playwright/test';
import * as path from 'path';
import * as os from 'os';

test('invoice-download-upload-chain', async ({ page }) => {
  console.log('🔗 Starting action chain...');

  // ========== Step 1: Download Invoice ==========
  await page.goto('https://invoices.example.com');
  await page.locator('#username').fill('user@example.com');
  await page.locator('#password').fill('password123');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);

  // Setup download handler
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#download-invoice').click();
  const download = await downloadPromise;

  const downloadsPath = path.join(os.homedir(), 'Downloads', 'EGDesk-Browser', 'invoice-workflow');
  const downloadPath = path.join(downloadsPath, 'invoice-2024-01.pdf');
  await download.saveAs(downloadPath);
  console.log('✅ Download completed:', downloadPath);

  // ========== Step 2: Upload Invoice ==========
  await page.goto('https://accounting.example.com');
  await page.waitForTimeout(2000);
  await page.locator('#upload-invoice-btn').click();
  await page.waitForTimeout(1000);

  // Upload file from previous step
  await page.locator('input[type="file"]').setInputFiles(downloadPath);
  console.log('📤 File uploaded:', downloadPath);

  await page.locator('#submit-btn').click();
  await page.locator('.success-message').waitFor({ state: 'visible' });

  console.log('✅ Action chain completed!');
});
```

### Example 2: Multi-Step Data Flow

```typescript
// Chain: Extract data → Download report → Upload to storage → Send email

// Step 1: Extract data
await page.goto('https://analytics.example.com');
const data = await page.locator('.metrics').textContent();
await page.locator('#export-btn').click();
// ... download report.csv

// Step 2: Upload to storage
await page.goto('https://storage.example.com');
await page.locator('input[type="file"]').setInputFiles(reportPath);
// ... submit

// Step 3: Send notification
await page.goto('https://mail.example.com');
await page.locator('#compose').click();
await page.locator('#attach').click();
// ... attach file and send
```

---

## Future Enhancements

### 1. Multiple File Selection
Handle multiple downloaded files:
```typescript
// When multiple files are downloaded:
"✅ Files downloaded:"
- invoice-2024-01.pdf
- receipt-2024-01.pdf

"Which file would you like to upload?"
[Select file dropdown]
```

### 2. Upload Destination Suggestions
Learn from user patterns and suggest destinations:
```typescript
// After uploading to same site 3+ times:
"Quick upload to:"
[accounting.example.com] [storage.example.com] [Enter new URL...]
```

### 3. File Preview Before Upload
Show preview of file before starting upload recording:
```typescript
"Preview of invoice-2024-01.pdf"
[PDF thumbnail/preview]
"File size: 2.3 MB | Downloaded: 2 min ago"
"Upload to: [URL]"
[Start Upload Recording]
```

### 4. Parallel Chains
Run multiple chains simultaneously:
```typescript
// Chain A: Download invoices → Upload to accounting
// Chain B: Download reports → Upload to analytics
// Run both in parallel
```

### 5. Custom Chain Naming
Name chains for easy identification:
```typescript
// After completing upload recording:
"Name this workflow:"
[Invoice Download → Accounting Upload]

"Save as template for future use?"
[Yes] [No]
```

### 6. Chain Templates Library
Pre-built templates for common download→upload scenarios:
```typescript
Templates:
- "Invoice Processing" - Download invoice → Upload to accounting portal
- "Document Verification" - Download ID → Upload to KYC system
- "Report Distribution" - Download report → Upload to cloud storage
- "Tax Filing" - Download tax forms → Upload to e-filing portal
```

### 7. Upload Progress Indicator
Real-time feedback during upload:
```typescript
"📤 Uploading invoice-2024-01.pdf"
Progress: ████████░░ 47% (2.3 MB / 4.8 MB)
Estimated time: 12 seconds remaining
```

### 8. Chain Scheduling
Schedule entire chains to run automatically:
```typescript
{
  chain: "invoice-workflow",
  schedule: "daily at 9:00 AM",
  enabled: true,
}
```

### 9. Error Recovery
Retry failed steps or rollback:
```typescript
if (step2Failed) {
  // Retry step 2 up to 3 times
  // Or rollback step 1
  // Or notify user
}
```

### 10. Chain Analytics
Track chain performance:
```typescript
{
  chainId: "invoice-workflow",
  totalRuns: 145,
  successRate: 94.5%,
  avgDuration: "2m 34s",
  failureReasons: {
    "File not found": 4,
    "Upload timeout": 3,
  }
}
```

---

## Implementation Checklist

### Backend (browser-recorder.ts)
- [ ] Create `ActionChainManager` class
- [ ] Add `chainId` to recording sessions
- [ ] Track downloaded files in chain context
- [ ] Implement file upload auto-detection
- [ ] Generate combined test code
- [ ] Add IPC handlers for chain operations
- [ ] Save chain metadata to database

### Frontend (BrowserRecorderPage.tsx)
- [ ] Add "Next Action" button UI
- [ ] Create Next Action modal
- [ ] Add chain progress indicator
- [ ] Show chain status in test list
- [ ] Handle chain replay
- [ ] Display chain steps
- [ ] Add finish chain button

### Database
- [ ] Create `action_chains` table
- [ ] Create `chain_steps` table
- [ ] Add foreign keys to link chains and sessions
- [ ] Store chain metadata

### Testing
- [ ] Test download detection
- [ ] Test chain creation
- [ ] Test file upload auto-fill
- [ ] Test combined code generation
- [ ] Test chain replay
- [ ] Test error handling

### Documentation
- [x] Create this README
- [ ] Update main BROWSER_RECORDER_README.md
- [ ] Add chain examples
- [ ] Create tutorial video
- [ ] Update user guide

---

## Technical Considerations

### 1. File Path Management
- Downloaded files stored in: `~/Downloads/EGDesk-Browser/{scriptName}/`
- Need to track file paths between sessions
- Handle file naming conflicts
- Clean up old files

### 2. Session Persistence
- Store chain state in memory during recording
- Persist to database on completion
- Handle app crashes/restarts

### 3. Browser Context
- Each step gets fresh browser context
- Or reuse context for performance?
- Handle cookies/localStorage between steps

### 4. Security
- Validate file paths
- Prevent directory traversal
- Sandbox file operations
- Encrypt sensitive data in chains

### 5. Performance
- Large files may slow down chain
- Consider streaming uploads
- Optimize code generation
- Cache intermediate results

### 6. Error Handling
- What if download fails?
- What if file doesn't exist in step 2?
- Retry logic for network errors
- User notification strategy

---

## Example Database Schema

```sql
-- Action Chains Table
CREATE TABLE action_chains (
  id TEXT PRIMARY KEY,
  name TEXT,
  status TEXT CHECK(status IN ('in-progress', 'completed', 'failed')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  total_steps INTEGER DEFAULT 0,
  total_duration INTEGER, -- milliseconds
  metadata TEXT -- JSON
);

-- Chain Steps Table
CREATE TABLE chain_steps (
  id TEXT PRIMARY KEY,
  chain_id TEXT NOT NULL,
  position INTEGER NOT NULL, -- 0, 1, 2...
  name TEXT NOT NULL,
  type TEXT CHECK(type IN ('download', 'upload', 'navigate', 'custom')),
  session_id TEXT,
  test_path TEXT,
  downloaded_file TEXT,
  uploaded_file TEXT,
  completed BOOLEAN DEFAULT 0,
  start_time DATETIME,
  end_time DATETIME,
  error TEXT,
  FOREIGN KEY (chain_id) REFERENCES action_chains(id) ON DELETE CASCADE
);

-- Index for faster queries
CREATE INDEX idx_chain_steps_chain_id ON chain_steps(chain_id);
CREATE INDEX idx_chain_steps_position ON chain_steps(chain_id, position);
```

---

## API Reference

### New IPC Methods

```typescript
// Start a new action chain
window.electron.debug.startActionChain(): Promise<{
  success: boolean;
  chainId: string;
}>

// Add recording to existing chain
window.electron.debug.addRecordingToChain(chainId: string, sessionId: string): Promise<{
  success: boolean;
}>

// Complete and save chain
window.electron.debug.completeActionChain(chainId: string): Promise<{
  success: boolean;
  testPath: string;
  chain: ActionChain;
}>

// Get all saved chains
window.electron.debug.getActionChains(): Promise<{
  success: boolean;
  chains: ActionChain[];
}>

// Run a saved chain
window.electron.debug.runActionChain(chainId: string): Promise<{
  success: boolean;
  error?: string;
}>

// Delete a chain
window.electron.debug.deleteActionChain(chainId: string): Promise<{
  success: boolean;
}>
```

### New IPC Events

```typescript
// Chain step completed
'action-chain:step-completed': (data: {
  chainId: string;
  stepIndex: number;
  stepName: string;
}) => void

// Chain completed
'action-chain:completed': (data: {
  chainId: string;
  totalSteps: number;
  duration: number;
}) => void

// Chain failed
'action-chain:failed': (data: {
  chainId: string;
  stepIndex: number;
  error: string;
}) => void
```

---

## Best Practices

1. **Keep chains focused** - Each chain should accomplish one business workflow
2. **Name steps clearly** - Use descriptive names like "Download Invoice" not "Step 1"
3. **Handle errors gracefully** - Add retry logic for network-dependent steps
4. **Clean up files** - Delete temporary downloads after chain completes
5. **Test chains thoroughly** - Run chains multiple times to ensure reliability
6. **Document chains** - Add comments explaining what each step does
7. **Version chains** - Track changes to chain logic over time
8. **Monitor performance** - Track chain execution time and optimize slow steps

---

## Conclusion

The Action Chain feature transforms the Browser Recorder from a single-step automation tool into a powerful workflow orchestration system. By allowing users to chain multiple recordings together, especially download-then-upload scenarios, we unlock significantly more complex automation possibilities.

The implementation is designed to be:
- **User-friendly** - Simple UI with clear progression
- **Flexible** - Support various chain types beyond download/upload
- **Reliable** - Error handling and retry logic
- **Scalable** - Architecture supports complex multi-step chains

**Next Steps:**
1. Review this design document
2. Get feedback from stakeholders
3. Begin Phase 1 implementation (download detection)
4. Iterate based on user testing

---

**Questions or Feedback?**
Please update this document with any improvements or suggestions!

**Last Updated:** 2026-01-24
