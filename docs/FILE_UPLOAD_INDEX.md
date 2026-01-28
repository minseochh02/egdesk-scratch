# File Upload Code Generation - Documentation Index

## 📚 Overview

This documentation package demonstrates and explains the file upload code generation feature in the EGDesk browser recorder system. The feature automatically generates Playwright test code for file upload operations, with special handling for "chained" uploads where files from previous download steps are automatically uploaded.

## 📖 Documentation Files

### 1. Quick Reference (Start Here!)
**File**: [`FILE_UPLOAD_QUICK_REFERENCE.md`](/Users/minseocha/Desktop/projects/Taesung/EGDesk-scratch/egdesk-scratch/FILE_UPLOAD_QUICK_REFERENCE.md)

Quick lookup for developers:
- ⚡ Code templates (chained & manual)
- ⚡ Implementation rules (DO's and DON'Ts)
- ⚡ Timing sequence diagram
- ⚡ Troubleshooting table
- ⚡ Testing checklist

**Best for**: Quick reference while coding, troubleshooting issues

---

### 2. Complete Summary
**File**: [`FILE_UPLOAD_SUMMARY.md`](/Users/minseocha/Desktop/projects/Taesung/EGDesk-scratch/egdesk-scratch/FILE_UPLOAD_SUMMARY.md)

Comprehensive overview:
- 📋 Overview of all documentation files
- 📋 End-to-end flow explanation
- 📋 Two upload patterns compared
- 📋 Common issues and solutions
- 📋 Future enhancement ideas

**Best for**: Understanding the big picture, onboarding new developers

---

### 3. Code Generation Demo
**File**: [`FILE_UPLOAD_CODE_GENERATION_DEMO.md`](/Users/minseocha/Desktop/projects/Taesung/EGDesk-scratch/egdesk-scratch/FILE_UPLOAD_CODE_GENERATION_DEMO.md)

Detailed demonstration:
- 🎯 Generated code patterns with examples
- 🎯 Real-world complete test file example
- 🎯 Recording action format
- 🎯 Implementation details with code excerpts
- 🎯 Important notes on timing and deduplication

**Best for**: Learning how the feature works, understanding generated code

---

### 4. Source Code Documentation
**File**: [`FILE_UPLOAD_CODE_GENERATION_SOURCE.md`](/Users/minseocha/Desktop/projects/Taesung/EGDesk-scratch/egdesk-scratch/FILE_UPLOAD_CODE_GENERATION_SOURCE.md)

Implementation details:
- 💻 Exact source code from browser-recorder.ts
- 💻 Code flow analysis
- 💻 Template string building explanation
- 💻 Related code sections (deduplication, recording)
- 💻 Action data structure

**Best for**: Modifying the implementation, debugging code generation

---

### 5. This Index
**File**: [`FILE_UPLOAD_INDEX.md`](/Users/minseocha/Desktop/projects/Taesung/EGDesk-scratch/egdesk-scratch/FILE_UPLOAD_INDEX.md)

You are here! Navigation hub for all documentation.

---

## 🎮 Runnable Demo

### Demonstration Test
**File**: [`test-file-upload-demo.js`](/Users/minseocha/Desktop/projects/Taesung/EGDesk-scratch/egdesk-scratch/test-file-upload-demo.js)

Interactive demonstration:
- ▶️ Launches browser and navigates to test page
- ▶️ Demonstrates chained file upload pattern
- ▶️ Demonstrates manual file upload pattern
- ▶️ Detailed console output explaining each step
- ▶️ Creates demo files for inspection

**To run**:
```bash
cd /Users/minseocha/Desktop/projects/Taesung/EGDesk-scratch/egdesk-scratch
node test-file-upload-demo.js
```

---

## 📂 Real Generated Examples

### Example 1: File Upload Test (Chain Mode)
**File**: [`output/browser-recorder-tests/egdesk-browser-recorder-2026-01-26T05-10-27-219Z.spec.js`](/Users/minseocha/Desktop/projects/Taesung/EGDesk-scratch/egdesk-scratch/output/browser-recorder-tests/egdesk-browser-recorder-2026-01-26T05-10-27-219Z.spec.js)

Real test that:
1. Logs into NAVER
2. Opens MYBOX upload page (new tab)
3. **Uploads a PDF file** from previous chain step
4. Verifies upload success

**Key section**: Lines 279-306 (file upload code)

### Example 2: Download Test (Chain Source)
**File**: [`output/browser-recorder-tests/egdesk-browser-recorder-2026-01-26T05-09-30-315Z.spec.js`](/Users/minseocha/Desktop/projects/Taesung/EGDesk-scratch/egdesk-scratch/output/browser-recorder-tests/egdesk-browser-recorder-2026-01-26T05-09-30-315Z.spec.js)

Downloads the file used in Example 1:
- Downloads `지명원_수정_최종_20220711.pdf`
- This file becomes available for upload in next chain step

---

## 🗂️ Source Code Locations

### Main Implementation
**File**: [`src/main/browser-recorder.ts`](/Users/minseocha/Desktop/projects/Taesung/EGDesk-scratch/egdesk-scratch/src/main/browser-recorder.ts)

| Feature | Lines | Description |
|---------|-------|-------------|
| RecordedAction interface | 8-46 | Type definition for file upload action |
| File chooser listener setup | 5299-5580 | Records upload during recording |
| Click deduplication | 6075-6088 | Removes duplicate clicks |
| Click skip logic | 6108-6111 | Skips clicks that trigger uploads |
| **File upload code generation** | **6227-6298** | **Main code generator** |

---

## 🎯 Usage Guide

### For New Developers

1. **Start with**: Quick Reference → Summary → Demo
2. **Run**: `test-file-upload-demo.js`
3. **Review**: Real examples in `output/browser-recorder-tests/`
4. **Deep dive**: Source Code Documentation

### For Debugging

1. **Check**: Quick Reference troubleshooting table
2. **Compare**: Your code vs templates in Quick Reference
3. **Review**: Source Code Documentation for implementation details
4. **Test**: Run demo to see working example

### For Modification

1. **Understand**: Complete Summary (end-to-end flow)
2. **Study**: Source Code Documentation
3. **Review**: Real examples to see current output
4. **Test**: Run demo and generated tests after changes

---

## 🔍 Quick Navigation

### I want to...

| Task | Go to |
|------|-------|
| **See generated code templates** | Quick Reference |
| **Understand how it works** | Complete Summary |
| **See a working example** | Run `test-file-upload-demo.js` |
| **View real generated tests** | `output/browser-recorder-tests/` |
| **Modify the implementation** | Source Code Documentation |
| **Fix a bug** | Quick Reference → Troubleshooting |
| **Learn the timing sequence** | Quick Reference → Timing Sequence |
| **Understand click deduplication** | Source Code Documentation |
| **See action data structure** | Quick Reference or Source Code Doc |

---

## 📊 File Upload Feature Summary

### What It Does
Automatically generates Playwright test code that:
- ✅ Sets up file chooser listener before clicking
- ✅ Handles file selection automatically
- ✅ Includes proper timing delays
- ✅ Provides selector fallbacks (CSS → XPath)
- ✅ Prevents click duplication
- ✅ References chained files from downloads folder
- ✅ Generates readable, maintainable code

### Two Patterns

**Chained Upload**:
- File from previous download step
- Path automatically determined
- Fully automated, no user action needed
- Example: Download from site A → Upload to site B

**Manual Upload**:
- User specifies file path
- Includes TODO comment for path
- Flexible - can upload any file
- Example: Upload local file to website

### Critical Implementation Points

1. **Listener BEFORE Click**: Set up file chooser listener before clicking
2. **100ms Delay**: Wait after listener setup to ensure registration
3. **1000ms Delay**: Wait after click for upload to complete
4. **Deduplication**: Remove click that triggers file chooser
5. **Scope Isolation**: Wrap in `{}` block to prevent variable conflicts

---

## 🧪 Testing

### Run Demo Test
```bash
node test-file-upload-demo.js
```

### Run Real Generated Test
```bash
node output/browser-recorder-tests/egdesk-browser-recorder-2026-01-26T05-10-27-219Z.spec.js
```

### Test Recording Feature
1. Start browser recorder in chain mode
2. Download a file from website A
3. Navigate to website B
4. Upload the downloaded file
5. Stop recording
6. Check generated test in `output/browser-recorder-tests/`
7. Run the generated test

---

## 📝 Documentation Metadata

- **Created**: 2026-01-26
- **Version**: 1.0.19
- **Feature**: File Upload Code Generation
- **System**: EGDesk Browser Recorder
- **Technology**: Playwright, TypeScript, Node.js

---

## 🤝 Contributing

When modifying this feature:

1. Update source code in `src/main/browser-recorder.ts`
2. Test with `test-file-upload-demo.js`
3. Generate new real examples with browser recorder
4. Update documentation files as needed
5. Update this index if adding new files

---

## 📞 Support

For questions or issues:

1. Check Quick Reference troubleshooting table
2. Review Complete Summary for common issues
3. Compare your code with demo examples
4. Review source code documentation

---

**Happy Testing! 🚀**
