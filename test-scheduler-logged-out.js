/**
 * Test Script: Scheduler Service Account Token (Logged Out)
 *
 * Purpose: Test if scheduler can get service account tokens when user is completely logged out
 *
 * Run this while the app is running but logged out:
 * node test-scheduler-logged-out.js
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');

// Connect to running Electron app
const electronPath = require('electron');

async function testSchedulerLoggedOut() {
  console.log('🧪 Testing Scheduler Service Account Token (Logged Out)...\n');

  // Use Node.js native module to connect to Electron IPC
  const { ipcRenderer } = require('electron');

  try {
    console.log('1️⃣ Triggering scheduler manual sync...');
    console.log('   (This should use service account token, not user OAuth)\n');

    // Trigger manual sync
    const result = await ipcRenderer.invoke('finance-hub:scheduler:sync-now');

    console.log('✅ Scheduler sync completed!');
    console.log('Result:', result);

  } catch (error) {
    console.error('❌ Scheduler sync failed:', error.message);
    console.error('\nError details:', error);
  }

  console.log('\n📋 Check the app console logs to see if service account token was used');
  console.log('    Look for: "🔑 Requesting service account token from edge function..."');
  console.log('              "✅ Service account token obtained, expires: ..."');
}

// Since we can't directly run this in Node.js (needs Electron context),
// let's create a simpler approach using the devtools console

console.log(`
╔════════════════════════════════════════════════════════════════╗
║  Test Scheduler Service Account Token (Logged Out)            ║
╚════════════════════════════════════════════════════════════════╝

Since this needs Electron's renderer context, run this in the app's DevTools console:

1. Open DevTools in the running app (Cmd+Option+I or Ctrl+Shift+I)
2. Make sure you're COMPLETELY LOGGED OUT
3. Paste this into the console:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

(async () => {
  console.log('🧪 Testing Scheduler Service Account Token (Logged Out)...\\n');

  try {
    console.log('1️⃣ Triggering scheduler manual sync...');
    console.log('   (This should use service account token, not user OAuth)\\n');

    const result = await window.electron.financeHubScheduler.syncNow();

    console.log('✅ Scheduler sync completed!');
    console.log('Result:', result);

  } catch (error) {
    console.error('❌ Scheduler sync failed:', error.message);
    console.error('\\nError details:', error);
  }

  console.log('\\n📋 Check the main process logs for:');
  console.log('    "🔑 Requesting service account token from edge function..."');
  console.log('    "✅ Service account token obtained, expires: ..."');
  console.log('\\n📊 If you see these messages, service account is working!');
})();

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Alternative: Trigger Recovery (Retry Failed Tasks)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

(async () => {
  console.log('🧪 Testing Scheduler Recovery (Logged Out)...\\n');

  try {
    console.log('1️⃣ Checking for missed executions...');

    const missed = await window.electron.ipcRenderer.invoke('scheduler-recovery-get-missed', {
      schedulerType: 'financehub'
    });

    console.log(\`Found \${missed.length} missed execution(s):\`, missed);

    if (missed.length > 0) {
      console.log('\\n2️⃣ Triggering recovery for missed executions...');

      const result = await window.electron.ipcRenderer.invoke('scheduler-recovery-execute', {
        schedulerType: 'financehub'
      });

      console.log('✅ Recovery completed!');
      console.log('Result:', result);
    } else {
      console.log('\\n✅ No missed executions to recover');
    }

  } catch (error) {
    console.error('❌ Recovery failed:', error.message);
    console.error('\\nError details:', error);
  }

  console.log('\\n📋 Check the main process logs for service account token messages');
})();

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What to Look For:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ SUCCESS indicators (in main process logs):
  🔑 Requesting service account token from edge function...
  ✅ Service account token obtained, expires: ...
  ✅ Using service account token for spreadsheet operations
  📊 Updating spreadsheet data...
  ✅ Unified spreadsheet sync completed

❌ FAILURE indicators (means service account didn't work):
  📋 Using personal OAuth token for spreadsheet operations
  ❌ No refresh token available - cannot refresh
  💡 User needs to sign in with Google
  Error: No Google OAuth token available. Please sign in with Google.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
