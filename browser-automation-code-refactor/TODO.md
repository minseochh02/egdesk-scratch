# Browser Automation Refactor TODO

## 🎯 High Priority (Bundle Size Reduction)

### Switch to playwright-core
- [ ] Backup current implementation
- [ ] Run `npm uninstall playwright playwright-lighthouse`
- [ ] Run `npm install playwright-core`
- [ ] Update all imports in codebase
- [ ] Test all functionality still works
- [ ] Measure bundle size reduction

### Fix Import Locations
- [ ] `src/main/chrome-handlers.ts` - Update playwright imports
- [ ] Search for any other playwright imports in codebase
- [ ] Update require statements to use playwright-core

## 🔧 Medium Priority (Production Readiness)

### Browser Detection System
- [ ] Create `src/main/utils/browser-detector.ts`
- [ ] Implement Chrome path detection for all platforms
- [ ] Add Edge browser detection as fallback
- [ ] Create user-friendly error messages
- [ ] Add "Download Chrome" helper dialog

### Remove npm/npx Dependencies
- [ ] Research how to bundle codegen functionality
- [ ] Create fallback for when npx not available
- [ ] Test in production environment without Node.js

### Error Handling Improvements
- [ ] Add try-catch blocks for all browser operations
- [ ] Create specific error types for different failures
- [ ] Implement retry logic for browser launch
- [ ] Add logging for debugging

## 📈 Low Priority (Enhancements)

### UI/UX Improvements
- [ ] Add progress indicators for test replay
- [ ] Create test editing interface
- [ ] Add test organization features
- [ ] Implement search/filter for saved tests

### Additional Features
- [ ] Support for Edge browser
- [ ] Support for Firefox (if requested)
- [ ] Export to different formats
- [ ] Import existing Playwright tests
- [ ] Test scheduling system

## 📋 Testing Checklist

### Functionality Tests
- [ ] Playwright Codegen launches successfully
- [ ] Tests are saved correctly
- [ ] Replay works with saved tests
- [ ] Custom click recording still works
- [ ] Browser windows open with correct settings

### Production Build Tests
- [ ] Build production version
- [ ] Test on machine without Node.js
- [ ] Test on different OS platforms
- [ ] Verify bundle size reduction
- [ ] Check for any missing dependencies

### Edge Cases
- [ ] Chrome not installed
- [ ] Multiple Chrome versions
- [ ] Chrome in non-standard location
- [ ] Permissions issues
- [ ] Firewall/antivirus interference

## 📊 Metrics to Track

- [ ] Bundle size before: _____ MB
- [ ] Bundle size after: _____ MB  
- [ ] Startup time before: _____ ms
- [ ] Startup time after: _____ ms
- [ ] Memory usage reduction: _____ %

## 🚀 Deployment Plan

1. [ ] Complete all high priority items
2. [ ] Run full test suite
3. [ ] Create PR with detailed description
4. [ ] Get code review
5. [ ] Test in staging environment
6. [ ] Document any breaking changes
7. [ ] Create release notes
8. [ ] Deploy to production

## 📝 Documentation Updates

- [ ] Update README with new requirements
- [ ] Create troubleshooting guide
- [ ] Update user documentation
- [ ] Add inline code comments
- [ ] Create migration guide

## 🐛 Known Issues to Address

- [ ] Playwright test format vs script format confusion
- [ ] Temporary file cleanup on crash
- [ ] Click recording memory leak (if any)
- [ ] Race conditions in polling

## 💡 Future Ideas

- [ ] WebDriver BiDi support
- [ ] Record video along with clicks
- [ ] AI-powered test generation
- [ ] Visual regression testing
- [ ] Performance metrics recording