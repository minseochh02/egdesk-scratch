# AI Editor Testing Guide

## 🧪 Testing Steps to Debug AI Editor Issues

### Step 1: Check Browser Console
1. Open the EGDesk application
2. Press `F12` or `Cmd+Option+I` (Mac) to open DevTools
3. Go to Console tab
4. Look for any error messages, especially:
   - Conversation store errors
   - AI Editor component errors
   - File system errors

### Step 2: Test Conversation Store
1. In the console, type:
   ```javascript
   // Check if conversation store is working
   console.log('Conversation store state:', window.conversationStore);
   
   // Check localStorage for conversations
   console.log('LocalStorage conversations:', localStorage.getItem('ai_editor_conversations'));
   ```

### Step 3: Test AI Keys
1. In the console, type:
   ```javascript
   // Check if AI keys are loaded
   console.log('AI Keys:', window.aiKeysStore);
   
   // Check electron store
   console.log('Electron store keys:', await window.electron.store.get('ai-keys'));
   ```

### Step 4: Test File System API
1. In the console, type:
   ```javascript
   // Test file system operations
   console.log('File system API:', window.electron.fileSystem);
   
   // Test reading a file
   const result = await window.electron.fileSystem.readFile('/path/to/test/file');
   console.log('Read file result:', result);
   ```

### Step 5: Test AI Editor Component
1. Open a file in the CodeEditor
2. Click the AI Editor button (🤖)
3. Check if the AI Editor sidebar appears
4. Look for any error messages in the console

### Step 6: Test Conversation Creation
1. In the AI Editor, try to type a message
2. Check if a conversation is created
3. Look in localStorage for new conversation data

## 🔍 Expected Console Output

### Successful Load:
```
💬 Loaded X conversations from storage
🚀 File changed, clearing previous AI response
AI Editor: Project context changed: {...}
AI Editor: Loading project files from: /path/to/project
```

### Error Cases:
```
💬 Failed to load conversations: [error message]
💬 Conversation store error: [error message]
Could not check cache status: [error message]
```

## 🚨 Common Issues and Solutions

### Issue 1: "Conversation store error"
**Cause**: Failed to load conversations from localStorage
**Solution**: Check localStorage data format, clear and recreate

### Issue 2: "File system API not available"
**Cause**: Preload script not working properly
**Solution**: Restart the application, check main process logs

### Issue 3: "AI keys not loaded"
**Cause**: Electron store not working or no keys saved
**Solution**: Add AI keys through the AIKeysManager component

### Issue 4: "Component not rendering"
**Cause**: React component errors or missing dependencies
**Solution**: Check component props and state

## 📊 Debug Checklist

- [ ] Browser console shows no errors
- [ ] Conversation store loads successfully
- [ ] AI keys are available
- [ ] File system API works
- [ ] AI Editor component renders
- [ ] Conversations can be created
- [ ] File analysis works
- [ ] AI requests can be made

## 🎯 Next Steps After Testing

1. **If all tests pass**: AI Editor is working, issue was the constructor bug
2. **If some tests fail**: Apply the specific fixes needed
3. **If most tests fail**: There may be a deeper architectural issue

## 🔧 Manual Testing Commands

```javascript
// Test conversation store
const store = window.conversationStore;
console.log('Store state:', store.getStats());

// Test AI keys
const keys = await window.electron.store.get('ai-keys');
console.log('AI Keys:', keys);

// Test file system
const fs = window.electron.fileSystem;
const home = await fs.getHomeDirectory();
console.log('Home directory:', home);
```

---

**Note**: Run these tests in the browser console while the EGDesk application is running.
