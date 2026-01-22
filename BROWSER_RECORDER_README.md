# Browser Recorder - Comprehensive Reference

**Last Updated:** 2026-01-22
**Version:** 1.0
**Status:** Production

---

## Table of Contents
1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [File Structure](#file-structure)
5. [API Reference](#api-reference)
6. [Usage Guide](#usage-guide)
7. [Technical Details](#technical-details)
8. [Update Log](#update-log)
9. [Future Roadmap](#future-roadmap)

---

## Overview

The Browser Recorder is a sophisticated Playwright-based browser automation and testing tool integrated into EGDesk. It allows users to:
- Record browser interactions with enhanced keyboard tracking
- Generate executable Playwright test code in real-time
- Save, manage, and replay tests with auto-timing
- Schedule automated test runs (daily, weekly, monthly, custom intervals)
- Handle complex scenarios (iframes, downloads, date pickers, multi-tab flows)

**Key Technology Stack:**
- Playwright-core for browser automation
- Electron IPC for main/renderer communication
- TypeScript for type safety
- React for UI components

---

## Features

### 🎥 Core Recording Features
| Feature | Description | Status |
|---------|-------------|--------|
| Enhanced Recording | Records all browser interactions including keyboard events (Enter, Tab, etc.) | ✅ Active |
| Real-time Code Generation | Shows generated Playwright test code as you record | ✅ Active |
| Auto-timed Replay | Captures timing between actions for accurate replay | ✅ Active |
| Multiple Selector Strategies | ID, CSS, XPath, role-based selectors with fallbacks | ✅ Active |
| Iframe Support | Automatically detects and records interactions inside iframes | ✅ Active |
| Download Handling | Captures and manages file downloads during recording/replay | ✅ Active |

### 🎬 Supported Action Types
1. **navigate** - URL navigation
2. **click** - Element clicks (with coordinate-based fallback)
3. **fill** - Text input in form fields
4. **keypress** - Keyboard events (Enter, Tab, Escape, etc.)
5. **screenshot** - Capture screenshots during test execution
6. **waitForElement** - Wait for elements (visible/hidden/enabled/disabled)
7. **datePickerGroup** - Complex date picker components (year/month/day)
8. **captureTable** - Extract table data (headers, rows)
9. **newTab** - Handle popup windows and new tabs
10. **closeTab** - Track tab closure and switch back to previous page
11. **print** - Handle print dialogs
12. **clickUntilGone** - Repeatedly click until element disappears (pagination, load more)
13. **download** - File download tracking

### 📁 Test Management
| Feature | Description | Implementation |
|---------|-------------|----------------|
| Save Tests | Persist as `.spec.ts` files | `savePlaywrightTest()` |
| View Tests | Open in code viewer window | `viewPlaywrightTest()` |
| Rename Tests | Rename test files | `renamePlaywrightTest()` |
| Delete Tests | Remove saved tests | `deletePlaywrightTest()` |
| Run/Replay Tests | Execute with auto-timing | `runPlaywrightTest()` |
| Test Library | Browse with metadata (date, size, preview) | `getPlaywrightTests()` |

### ⏰ Scheduling System
| Feature | Frequency | Details |
|---------|-----------|---------|
| Daily Scheduling | Every day | Run at specific time (e.g., 09:00) |
| Weekly Scheduling | Specific day of week | Sunday-Saturday selection |
| Monthly Scheduling | Specific day of month | Days 1-31 |
| Custom Interval | Every N days | User-defined interval |
| Enable/Disable | Toggle on/off | Preserve schedule without deletion |
| Schedule Statistics | Track runs | Run count, success count, failure count |
| Next Run Calculation | Auto-computed | Shows next execution time |

**Schedule IPC Methods:**
- `createPlaywrightSchedule(scheduleData)`
- `updatePlaywrightSchedule(id, scheduleData)`
- `deletePlaywrightSchedule(id)`
- `togglePlaywrightSchedule(id, enabled)`
- `getPlaywrightSchedules()`
- `getPlaywrightScheduleByPath(testPath)`

### 🚀 Advanced Features

#### Date Marking Mode
Interactive mode to mark complex date picker components:
1. User activates "Mark Date Picker" mode
2. Clicks year selector → marks year component
3. Clicks month selector → marks month component
4. Clicks day selector → marks day component
5. System generates `datePickerGroup` action with:
   - Element types (select/button/input)
   - Selectors for each component
   - Optional dropdown selectors
   - Date offset (days from today)

#### Click Until Gone Mode
For scenarios requiring repeated clicks (pagination, "Load More" buttons):
- Max iterations: Safety limit to prevent infinite loops
- Check conditions: `gone`, `hidden`, `disabled`
- Wait between clicks: Configurable delay
- Auto-stops when element disappears

#### Multi-Tab/Page Management
- **Page Stack**: Maintains history of pages for back navigation
- **Auto-switching**: Switches to new tabs automatically
- **Close Tracking**: Records when tabs close, switches back to previous
- **Event Listeners**: Automatically injects listeners into new pages

#### Coordinate-Based Clicking
Fallback for elements without good selectors:
- Captures x/y coordinates relative to element
- Useful for canvas elements, dynamic content
- Generated code includes coordinate-based click as alternative

### 🛠️ Developer Experience

#### Controller UI (In-Browser)
Injected floating panel in the browser with:
- Stop Recording button
- Take Screenshot button
- Mark Date Picker button
- Click Until Gone toggle
- Coordinate Mode toggle
- Wait Settings (multiplier, max delay)
- Action List with delete functionality

#### Debug Console
Real-time logging panel showing:
- Recording events (clicks, fills, navigation)
- Test saved/loaded events
- Schedule operations
- Error messages
- Test execution status

#### Code Viewer
- Syntax-highlighted display
- Real-time updates during recording
- Separate window for viewing saved tests
- Shows complete Playwright test code

### 🔒 Security & Permissions
- Clipboard access (read/write)
- Download permissions (auto-accept)
- Dialog auto-accept (alerts/confirms)
- Local network access support
- Web security bypass for internal apps
- Persistent browser profiles (isolated testing)

### 🛡️ Error Handling & Reliability
- User-friendly error messages with technical details in console
- Test completion status tracking (success/failure)
- Browser fallback: Chrome → Bundled Chromium
- Iframe retry logic (periodic re-injection)
- Controller recovery (auto re-injection if missing)
- OS-level automation for native dialogs (macOS automation)

---

## Architecture

### System Diagram
```
┌─────────────────────────────────────────────────────────────┐
│                      Electron Main Process                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │          browser-recorder.ts (BrowserRecorder)         │ │
│  │  - Playwright automation                               │ │
│  │  - Action recording & code generation                  │ │
│  │  - Test file management                                │ │
│  │  - Scheduling logic                                    │ │
│  └────────────────────────────────────────────────────────┘ │
│                            │                                 │
│                    IPC Communication                         │
│                            │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │
┌────────────────────────────┼─────────────────────────────────┐
│                      Electron Renderer                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │   BrowserRecorderPage.tsx (React Component)            │ │
│  │  - UI for recording controls                           │ │
│  │  - Test list display                                   │ │
│  │  - Schedule management UI                              │ │
│  │  - Debug console                                       │ │
│  │  - Downloads browser                                   │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                             │
                             │ Launches
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                  Playwright Browser (Chrome)                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │         Injected Controller UI & Listeners             │ │
│  │  - Keyboard event capture                              │ │
│  │  - Click/fill tracking                                 │ │
│  │  - Iframe detection                                    │ │
│  │  - Mode controls (date picker, coordinate, etc.)       │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

#### Recording Flow
```
1. User enters URL → Click "Start Recording"
2. Main process launches Playwright browser
3. Injects controller UI + keyboard listeners
4. User interacts with browser
5. Events captured → Converted to RecordedAction[]
6. Code generated in real-time
7. User clicks "Stop Recording"
8. Test saved as .spec.ts file
9. Test added to library
```

#### Replay Flow
```
1. User selects test → Click "Replay"
2. Main process loads test file
3. Playwright executes actions with auto-timing
4. Events emitted for status updates
5. Downloads saved to EGDesk-Playwright folder
6. Test completion status returned
```

#### Scheduling Flow
```
1. User sets schedule for test (time, frequency)
2. Schedule saved to database
3. Scheduler checks every minute for due tests
4. When time matches, triggers test replay
5. Results logged (success/failure count)
6. Next run time calculated and saved
```

---

## File Structure

```
egdesk-scratch/
├── src/
│   ├── main/
│   │   ├── browser-recorder.ts          # Main recorder class (5554 lines)
│   │   │   ├── BrowserRecorder class
│   │   │   ├── RecordedAction interface
│   │   │   ├── Recording logic
│   │   │   ├── Code generation
│   │   │   └── Test execution
│   │   │
│   │   ├── utils/
│   │   │   └── osAutomation.ts          # OS-level automation for dialogs
│   │   │
│   │   └── ipc-handlers/                # IPC endpoint handlers
│   │       ├── launchBrowserRecorderEnhanced
│   │       ├── stopBrowserRecorderEnhanced
│   │       ├── getPlaywrightTests
│   │       ├── viewPlaywrightTest
│   │       ├── runPlaywrightTest
│   │       ├── deletePlaywrightTest
│   │       ├── renamePlaywrightTest
│   │       ├── getPlaywrightDownloads
│   │       ├── openPlaywrightDownload
│   │       └── [schedule methods...]
│   │
│   └── renderer/
│       └── components/
│           └── BrowserRecorder/
│               ├── BrowserRecorderPage.tsx      # Main UI component (897 lines)
│               ├── BrowserRecorderPage.css      # Styling
│               └── [modals, forms, etc.]
│
├── playwright-tests/                    # Saved test files directory
│   ├── test-1.spec.ts
│   ├── test-2.spec.ts
│   └── ...
│
├── Downloads/
│   └── EGDesk-Playwright/              # Download destination folder
│       ├── file1.pdf
│       ├── file2.xlsx
│       └── ...
│
└── chrome-profiles/                     # Temporary browser profiles
    ├── playwright-recording-abc123/
    └── ...
```

---

## API Reference

### IPC Methods (window.electron.debug.*)

#### Recording Control
```typescript
// Launch enhanced recorder with keyboard tracking
launchBrowserRecorderEnhanced(url: string): Promise<{
  success: boolean;
  filePath?: string;
  error?: string;
}>

// Stop recording and save test
stopBrowserRecorderEnhanced(): Promise<{
  success: boolean;
  filePath?: string;
  error?: string;
}>
```

#### Test Management
```typescript
// Get all saved tests
getPlaywrightTests(): Promise<{
  success: boolean;
  tests: Array<{
    name: string;
    path: string;
    createdAt: Date;
    size: number;
    preview: string;
  }>;
}>

// View test in code viewer
viewPlaywrightTest(testPath: string): Promise<{
  success: boolean;
  error?: string;
}>

// Run/replay a test
runPlaywrightTest(testPath: string): Promise<{
  success: boolean;
  error?: string;
}>

// Delete a test
deletePlaywrightTest(testPath: string): Promise<{
  success: boolean;
  error?: string;
}>

// Rename a test
renamePlaywrightTest(oldPath: string, newName: string): Promise<{
  success: boolean;
  newPath?: string;
  error?: string;
}>
```

#### Schedule Management
```typescript
// Create new schedule
createPlaywrightSchedule(scheduleData: {
  testPath: string;
  testName: string;
  scheduledTime: string;        // HH:MM format
  frequencyType: 'daily' | 'weekly' | 'monthly' | 'custom';
  dayOfWeek?: number;           // 0-6 (Sunday-Saturday)
  dayOfMonth?: number;          // 1-31
  customIntervalDays?: number;  // For custom frequency
}): Promise<{
  success: boolean;
  schedule?: Schedule;
  error?: string;
}>

// Update existing schedule
updatePlaywrightSchedule(id: string, scheduleData: {...}): Promise<{...}>

// Delete schedule
deletePlaywrightSchedule(id: string): Promise<{...}>

// Toggle schedule on/off
togglePlaywrightSchedule(id: string, enabled: boolean): Promise<{...}>

// Get all schedules
getPlaywrightSchedules(): Promise<{
  success: boolean;
  data: Schedule[];
}>

// Get schedule by test path
getPlaywrightScheduleByPath(testPath: string): Promise<{
  success: boolean;
  data?: Schedule;
}>
```

#### Download Management
```typescript
// Get list of downloaded files
getPlaywrightDownloads(): Promise<{
  success: boolean;
  files: Array<{
    name: string;
    path: string;
    size: number;
    modified: Date;
  }>;
}>

// Open a downloaded file
openPlaywrightDownload(filePath: string): Promise<void>

// Open downloads folder
openPlaywrightDownloadsFolder(): Promise<void>
```

### IPC Events (window.electron.ipcRenderer.on)

```typescript
// Test saved event
'playwright-test-saved': (data: { filePath: string }) => void

// Real-time test code update during recording
'playwright-test-update': (data: { code: string }) => void

// Recording auto-stopped (browser closed)
'recorder-auto-stopped': (data: { reason: string }) => void

// Test execution error
'playwright-test-error': (data: {
  error: string;
  userFriendly: boolean;
  details?: any;
  technicalDetails?: any;
}) => void

// Test execution info
'playwright-test-info': (data: { message: string }) => void

// Test execution completed
'playwright-test-completed': (data: {
  success: boolean;
  error?: string;
  details?: any;
}) => void
```

---

## Usage Guide

### Recording Your First Test

1. **Navigate to Browser Recorder page** in EGDesk
2. **Enter URL** to record (e.g., `https://example.com`)
3. **Click "Start Recording"** - Browser launches on right side of screen
4. **Interact with the website**:
   - Clicks are automatically recorded
   - Text input is captured
   - Keyboard events (Enter, Tab) are tracked
   - Downloads are handled
   - Navigation is tracked
5. **Watch real-time code generation** in the code viewer panel
6. **Click "Stop Recording"** when done
7. **Test is automatically saved** to `playwright-tests/` directory

### Working with Complex Elements

#### Date Pickers
1. Click "Mark Date Picker" in controller UI
2. Click the year dropdown/button
3. Click the month dropdown/button
4. Click the day dropdown/button
5. Set date offset (0 = today, 1 = tomorrow, -1 = yesterday)
6. System generates smart date picker action

#### Tables
1. Click "Capture Table" (if implemented)
2. Select table on page
3. System extracts headers and sample rows
4. Generated code includes table data extraction

#### Pagination/Load More
1. Toggle "Click Until Gone" mode
2. Click the element to repeat (e.g., "Load More" button)
3. System records click with iteration logic
4. Replays until element disappears

### Scheduling Tests

1. **View saved tests** → Click test's "📅" button
2. **Configure schedule**:
   - Enable/disable schedule
   - Choose frequency (daily/weekly/monthly/custom)
   - Set time (HH:MM format)
   - Select day of week/month if applicable
3. **Click "Save Schedule"**
4. **Test runs automatically** at scheduled time
5. **View statistics** (run count, success/failure)

### Managing Downloads

1. **Downloads during recording** → Saved to `Downloads/EGDesk-Playwright/`
2. **View downloads** → Navigate to "Playwright Downloads" section
3. **Click file** → Opens file in default application
4. **Click "Open Folder"** → Opens download directory in Finder/Explorer

---

## Technical Details

### RecordedAction Interface
```typescript
interface RecordedAction {
  type: 'navigate' | 'click' | 'fill' | 'keypress' | 'screenshot' |
        'waitForElement' | 'download' | 'datePickerGroup' | 'captureTable' |
        'newTab' | 'print' | 'clickUntilGone' | 'closeTab';
  selector?: string;           // CSS selector
  xpath?: string;              // XPath fallback
  value?: string;              // Input value or key
  key?: string;                // Keyboard key
  url?: string;                // Navigation URL
  waitCondition?: 'visible' | 'hidden' | 'enabled' | 'disabled';
  timeout?: number;            // Wait timeout
  timestamp: number;           // Milliseconds since recording start
  coordinates?: { x: number; y: number };  // For coordinate clicks
  frameSelector?: string;      // Iframe selector

  // Date picker fields
  dateComponents?: {
    year: { selector: string; elementType: 'select' | 'button' | 'input'; dropdownSelector?: string };
    month: { selector: string; elementType: 'select' | 'button' | 'input'; dropdownSelector?: string };
    day: { selector: string; elementType: 'select' | 'button' | 'input'; dropdownSelector?: string };
  };
  dateOffset?: number;         // Days from today

  // Table capture fields
  tables?: Array<{
    xpath: string;
    cssSelector: string;
    headers: string[];
    sampleRow: string[];
    rowCount: number;
  }>;

  // Multi-tab fields
  newTabUrl?: string;          // URL of new tab
  closedTabUrl?: string;       // URL of closed tab

  // Click until gone fields
  maxIterations?: number;      // Safety limit
  checkCondition?: 'gone' | 'hidden' | 'disabled';
  waitBetweenClicks?: number;  // Milliseconds between clicks
}
```

### Schedule Interface
```typescript
interface Schedule {
  id: string;
  testPath: string;
  testName: string;
  enabled: boolean;
  frequencyType: 'daily' | 'weekly' | 'monthly' | 'custom';
  dayLabel: string;            // Human-readable frequency (e.g., "Every Monday")
  scheduledTime: string;       // HH:MM format
  dayOfWeek?: number;          // 0-6 (Sunday-Saturday)
  dayOfMonth?: number;         // 1-31
  customIntervalDays?: number; // For custom frequency
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  successCount: number;
  failureCount: number;
}
```

### Code Generation Logic

The `generateTestCode()` method creates Playwright test code from recorded actions:

1. **Imports and setup** - Playwright test framework imports
2. **Test wrapper** - `test('recorded test', async ({ page }) => { ... })`
3. **Action conversion**:
   - `navigate` → `await page.goto(url)`
   - `click` → `await page.locator(selector).click()`
   - `fill` → `await page.locator(selector).fill(value)`
   - `keypress` → `await page.keyboard.press(key)`
   - `datePickerGroup` → Dynamic date calculation + fills
   - `clickUntilGone` → While loop with safety counter
   - `newTab` → `const newPage = await context.waitForEvent('page')`
4. **Timing** - Automatic `waitForTimeout()` between actions based on recorded delays
5. **Wait settings** - Multiplier and max delay applied to all waits

### Browser Launch Configuration

```javascript
chromium.launchPersistentContext(profileDir, {
  headless: false,
  channel: 'chrome',                    // Use system Chrome
  viewport: null,                       // Responsive viewport
  permissions: ['clipboard-read', 'clipboard-write'],
  acceptDownloads: true,
  downloadsPath: 'Downloads/EGDesk-Playwright',
  args: [
    '--window-size=1200,900',
    '--window-position=800,0',          // Right side of screen
    '--no-default-browser-check',
    '--disable-blink-features=AutomationControlled',
    '--disable-web-security',           // For localhost testing
    '--disable-features=IsolateOrigins,site-per-process',
  ]
})
```

### Iframe Injection Strategy

1. **Initial injection** - After page load, wait 2 seconds
2. **Periodic re-injection** - Every 2 seconds via `setInterval`
3. **Detection** - Find all `iframe` elements in DOM
4. **Listener setup** - Inject click/keyboard listeners into each iframe's content
5. **Event forwarding** - Iframe events bubbled to main frame via `postMessage`

---

## Update Log

### [UPDATE HERE] - Latest Changes

**Date:** 2026-01-22
**Changes:**
- Initial comprehensive documentation created
- All 57+ features documented
- Architecture diagrams added
- Complete API reference included

---

### Version History

**v1.0** (Current)
- ✅ Enhanced recording with keyboard tracking
- ✅ Auto-timed test replay
- ✅ Scheduling system (daily/weekly/monthly/custom)
- ✅ Date picker handling
- ✅ Click until gone mode
- ✅ Multi-tab/page support
- ✅ Download management
- ✅ Iframe support
- ✅ Real-time code generation
- ✅ Test library with CRUD operations

---

## Future Roadmap

### Planned Features
- [ ] **Test Assertions** - Add expect() statements for validation
- [ ] **Variable Extraction** - Extract data from page to use later in test
- [ ] **API Mocking** - Intercept and mock network requests
- [ ] **Screenshot Comparison** - Visual regression testing
- [ ] **Test Parameterization** - Run same test with different data sets
- [ ] **Test Suites** - Group related tests together
- [ ] **CI/CD Integration** - Export tests for GitHub Actions, Jenkins, etc.
- [ ] **Performance Metrics** - Track page load times, network requests
- [ ] **Mobile Recording** - Record interactions on mobile viewports
- [ ] **Cross-browser Testing** - Firefox, Safari support
- [ ] **Collaboration** - Share tests with team members
- [ ] **Test Reports** - HTML reports with screenshots, videos
- [ ] **Smart Selectors** - AI-powered selector generation
- [ ] **Test Maintenance** - Auto-fix broken selectors
- [ ] **Parallel Execution** - Run multiple tests simultaneously

### Enhancement Ideas
- [ ] Export to other testing frameworks (Cypress, Selenium)
- [ ] Record browser console errors during test
- [ ] Network traffic recording (HAR files)
- [ ] Test debugger with step-through execution
- [ ] Conditional logic in tests (if/else)
- [ ] Loop constructs for repeated actions
- [ ] Custom JavaScript execution during test
- [ ] Test templates/snippets library
- [ ] Keyboard shortcuts for common actions
- [ ] Dark mode for code viewer

---

## Troubleshooting

### Common Issues

**Issue:** Browser doesn't launch
**Solution:** Ensure Chrome is installed, or allow Playwright to download Chromium

**Issue:** Iframe interactions not recorded
**Solution:** Wait 2-3 seconds after page load for iframe injection

**Issue:** Selectors break when replaying
**Solution:** Use coordinate mode for dynamic elements, or mark stable elements

**Issue:** Downloads not saving
**Solution:** Check permissions for `Downloads/EGDesk-Playwright/` folder

**Issue:** Scheduled tests not running
**Solution:** Verify schedule is enabled, check system time, restart application

**Issue:** Real-time code not updating
**Solution:** Check IPC connection, restart recording

---

## Best Practices

1. **Wait for page loads** - Give pages 2-3 seconds to fully load before interacting
2. **Use stable selectors** - Prefer IDs and data attributes over generated classes
3. **Test in isolation** - Use private/incognito mode or clean profiles
4. **Keep tests focused** - One test per user flow
5. **Use descriptive names** - Name tests clearly (e.g., "login-with-valid-credentials")
6. **Schedule regression tests** - Run critical flows daily
7. **Review generated code** - Verify code before relying on test
8. **Handle dynamic data** - Use date offsets, not hardcoded dates
9. **Monitor test health** - Check success/failure rates regularly
10. **Clean up downloads** - Periodically clear download folder

---

## Contributing

When adding features to Browser Recorder:

1. **Update this README** in the [UPDATE HERE] section
2. **Add to Feature table** with status indicator
3. **Document API changes** in API Reference section
4. **Update architecture diagrams** if needed
5. **Add to Future Roadmap** if planning enhancements
6. **Include troubleshooting** for common issues
7. **Update version history** with changes

---

## License & Credits

**Part of:** EGDesk
**Powered by:** Playwright, Electron, React
**Maintained by:** EGDesk Development Team

---

**End of Document**
*For questions or suggestions, update the [UPDATE HERE] section above.*
