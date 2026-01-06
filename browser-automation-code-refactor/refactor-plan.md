
# Browser Automation Code Refactor Plan

## Overview
This document outlines the plan to refactor EGDesk's browser automation capabilities to use `playwright-core` instead of the full `playwright` package, making the application more production-ready and reducing bundle size.

## Current State

### What We Have Now
1. **Full Playwright Package** (`playwright` - ~50MB)
   - Includes bundled browser binaries we don't use
   - Located in regular dependencies in `package.json`
   
2. **Two Recording Approaches**
   - Custom click recording via browser window injection
   - Playwright Codegen integration (requires npx)

3. **Click Recording Implementation**
   - Injects JavaScript into browser windows (`browser-controller.ts`)
   - Stores events in `window.__debugClickEvents`
   - Polls for events from the renderer process

4. **Playwright Codegen Integration**
   - Launches via `npx playwright codegen`
   - Saves generated tests to output directory
   - Replay functionality that converts test format to runnable scripts

## Goals

### Phase 1: Switch to playwright-core
- [ ] Replace `playwright` with `playwright-core` in dependencies
- [ ] Update all imports from `playwright` to `playwright-core`
- [ ] Ensure all functionality uses system Chrome (`channel: 'chrome'`)
- [ ] Test that codegen and replay still work

### Phase 2: Production-Ready Codegen
- [ ] Check if Chrome/Chromium is installed on user's system
- [ ] Provide clear error messages if browser not found
- [ ] Create fallback for when `npx` is not available
- [ ] Bundle necessary codegen scripts with the app

### Phase 3: Unified Recording System
- [ ] Evaluate if we need both recording systems
- [ ] Consider enhancing custom click recorder to generate Playwright code
- [ ] Create a consistent UI/UX for recording and replay
- [ ] Add ability to edit recorded scripts

### Phase 4: Enhanced Features
- [ ] Add support for other browsers (Edge, Firefox)
- [ ] Implement test organization (folders, tags, search)
- [ ] Add test scheduling/automation capabilities
- [ ] Export tests in different formats (Playwright, Puppeteer, Selenium)

## Technical Details

### Files to Modify

1. **Package Dependencies**
   - `package.json` - Replace playwright with playwright-core

2. **Import Statements**
   - `src/main/chrome-handlers.ts`
   - Any other files importing playwright

3. **Browser Launch Code**
   - Ensure all instances use `channel: 'chrome'`
   - Add browser detection logic

4. **Codegen Implementation**
   - `src/main/chrome-handlers.ts` - `launch-playwright-codegen` handler
   - Consider bundling codegen or creating our own

### Bundle Size Impact
- Current: `playwright` (~50MB with browsers)
- Target: `playwright-core` (~10MB without browsers)
- Savings: ~40MB reduction in app size

### Production Considerations

1. **Browser Detection**
   ```javascript
   const getChromePath = () => {
     if (process.platform === 'darwin') {
       return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
     } else if (process.platform === 'win32') {
       return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
     } else {
       return '/usr/bin/google-chrome';
     }
   };
   ```

2. **Error Handling**
   - Check if browser exists before launching
   - Provide download links if not found
   - Support multiple browser options

3. **User Experience**
   - Clear instructions for first-time users
   - Automatic browser detection
   - Graceful fallbacks

## Implementation Steps

### Step 1: Create Feature Branch
```bash
git checkout -b feature/playwright-core-refactor
```

### Step 2: Update Dependencies
```bash
npm uninstall playwright playwright-lighthouse
npm install playwright-core
```

### Step 3: Update Imports
Search and replace all instances of:
- `require('playwright')` → `require('playwright-core')`
- `from 'playwright'` → `from 'playwright-core'`

### Step 4: Test Everything
- [ ] Test Playwright Codegen launch
- [ ] Test saving recorded tests
- [ ] Test replay functionality
- [ ] Test custom click recording
- [ ] Test in production build

### Step 5: Add Browser Detection
- [ ] Implement browser path detection
- [ ] Add user-friendly error messages
- [ ] Create browser installation guide

## Success Criteria

1. **Reduced Bundle Size**: App size reduced by ~40MB
2. **Production Ready**: Works on machines without Node.js/npm
3. **User Friendly**: Clear errors and instructions
4. **Feature Parity**: All current features still work
5. **Better Performance**: Faster startup and execution

## Future Enhancements

1. **Custom Codegen**: Build our own recorder that doesn't require external tools
2. **Visual Recorder**: Show user what's being recorded with highlights
3. **Test Library**: Pre-built test templates for common scenarios
4. **CI/CD Integration**: Export tests for use in CI pipelines
5. **Cloud Sync**: Sync recorded tests across devices

## Notes

- Keep backward compatibility during migration
- Document all breaking changes
- Create migration guide for existing users
- Consider keeping both options (with feature flag) during transition