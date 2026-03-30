/**
 * IPC handlers for Simple Recorder
 *
 * Handles communication between renderer process and simple recorder.
 * Manages simple click recording sessions, playback, and recordings management.
 */

import { ipcMain, app } from 'electron';
import path from 'path';
import fs from 'fs';
import { SimpleRecorder } from './simple-recorder';

// Module-level active recorder
let activeSimpleRecorder: SimpleRecorder | null = null;

/**
 * Get output directory for simple recordings
 */
function getSimpleRecordingOutputDir(): string {
  const baseDir = app.isPackaged
    ? path.join(app.getPath('userData'), 'output')
    : path.join(process.cwd(), 'output');

  // Simple recordings go in their own subdirectory
  const outputDir = path.join(baseDir, 'simple-recordings');

  // Ensure directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  return outputDir;
}

/**
 * Register all simple recorder IPC handlers
 */
export function registerSimpleRecorderHandlers(): void {
  console.log('[SimpleRecorder] Registering IPC handlers');

  // ==================== Check Permissions ====================

  ipcMain.handle('simple-recorder:check-permissions', async () => {
    try {
      const recorder = new SimpleRecorder();
      const hasPermissions = await recorder.checkAccessibilityPermissions();

      return {
        success: true,
        hasPermissions,
      };
    } catch (error: any) {
      console.error('[SimpleRecorder] Permission check error:', error.message);
      return {
        success: false,
        hasPermissions: false,
        error: error.message,
      };
    }
  });

  // ==================== Start Recording ====================

  ipcMain.handle('simple-recorder:start', async (event) => {
    try {
      console.log('[SimpleRecorder] Starting recording');

      // Clean up existing recorder if any
      if (activeSimpleRecorder) {
        console.log('[SimpleRecorder] Stopping previous recorder');
        try {
          await activeSimpleRecorder.stopRecording();
        } catch (err) {
          console.error('[SimpleRecorder] Error stopping previous recorder:', err);
        }
      }

      // Generate output file path
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const scriptName = `simple-recording-${timestamp}`;
      const outputFile = path.join(getSimpleRecordingOutputDir(), `${scriptName}.js`);

      // Create new recorder
      activeSimpleRecorder = new SimpleRecorder();
      activeSimpleRecorder.setOutputFile(outputFile);

      // Set up real-time updates
      activeSimpleRecorder.setUpdateCallback((code) => {
        event.sender.send('simple-recorder:update', {
          filePath: outputFile,
          code: code,
          timestamp,
        });
      });

      // Start recording
      await activeSimpleRecorder.startRecording();

      console.log('[SimpleRecorder] Recording started successfully');
      return {
        success: true,
        outputFile,
        scriptName,
      };
    } catch (error: any) {
      console.error('[SimpleRecorder] Failed to start recording:', error.message);

      // Check for permission error
      if (error.message.includes('Accessibility permissions')) {
        return {
          success: false,
          error: 'PERMISSION_DENIED',
          message: 'Accessibility permissions not granted. Please enable in System Settings.',
        };
      }

      return {
        success: false,
        error: error.message,
      };
    }
  });

  // ==================== Stop Recording ====================

  ipcMain.handle('simple-recorder:stop', async () => {
    try {
      console.log('[SimpleRecorder] Stopping recording');

      if (!activeSimpleRecorder) {
        return {
          success: false,
          error: 'No active recording session',
        };
      }

      const filePath = await activeSimpleRecorder.stopRecording();

      console.log('[SimpleRecorder] Recording stopped successfully');
      return {
        success: true,
        filePath,
      };
    } catch (error: any) {
      console.error('[SimpleRecorder] Failed to stop recording:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // ==================== Pause Recording ====================

  ipcMain.handle('simple-recorder:pause', async () => {
    try {
      if (!activeSimpleRecorder) {
        return {
          success: false,
          error: 'No active recording session',
        };
      }

      activeSimpleRecorder.pauseRecording();

      return {
        success: true,
      };
    } catch (error: any) {
      console.error('[SimpleRecorder] Failed to pause recording:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // ==================== Resume Recording ====================

  ipcMain.handle('simple-recorder:resume', async () => {
    try {
      if (!activeSimpleRecorder) {
        return {
          success: false,
          error: 'No active recording session',
        };
      }

      activeSimpleRecorder.resumeRecording();

      return {
        success: true,
      };
    } catch (error: any) {
      console.error('[SimpleRecorder] Failed to resume recording:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // ==================== Get Status ====================

  ipcMain.handle('simple-recorder:get-status', async () => {
    try {
      if (!activeSimpleRecorder) {
        return {
          success: true,
          status: {
            isRecording: false,
            isPaused: false,
            clickCount: 0,
          },
        };
      }

      const status = activeSimpleRecorder.getStatus();

      return {
        success: true,
        status,
      };
    } catch (error: any) {
      console.error('[SimpleRecorder] Failed to get status:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // ==================== Get Saved Recordings ====================

  ipcMain.handle('simple-recorder:get-recordings', async () => {
    try {
      const outputDir = getSimpleRecordingOutputDir();

      // List all .json files in the directory
      const files = fs.readdirSync(outputDir)
        .filter(file => file.endsWith('.json'))
        .map(file => {
          const filePath = path.join(outputDir, file);
          const stats = fs.statSync(filePath);

          // Read the JSON file to get metadata
          let clickCount = 0;
          try {
            const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            clickCount = content.clicks?.length || 0;
          } catch (err) {
            console.warn(`[SimpleRecorder] Could not read recording metadata: ${file}`);
          }

          return {
            path: filePath.replace('.json', '.js'), // Return .js path for compatibility
            name: file.replace('.json', ''),
            createdAt: stats.birthtime,
            clickCount,
          };
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return {
        success: true,
        recordings: files,
      };
    } catch (error: any) {
      console.error('[SimpleRecorder] Failed to get recordings:', error.message);
      return {
        success: false,
        error: error.message,
        recordings: [],
      };
    }
  });

  // ==================== Replay Recording ====================

  ipcMain.handle('simple-recorder:replay', async (event, { filePath, speed }) => {
    try {
      console.log(`[SimpleRecorder] Replaying recording: ${filePath} at ${speed}x speed`);

      const recorder = new SimpleRecorder();
      await recorder.replay(filePath, { speed });

      console.log('[SimpleRecorder] Replay completed successfully');
      return {
        success: true,
      };
    } catch (error: any) {
      console.error('[SimpleRecorder] Failed to replay recording:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // ==================== Delete Recording ====================

  ipcMain.handle('simple-recorder:delete-recording', async (event, { filePath }) => {
    try {
      console.log(`[SimpleRecorder] Deleting recording: ${filePath}`);

      // Delete both .js and .json files
      const jsPath = filePath.endsWith('.js') ? filePath : filePath + '.js';
      const jsonPath = filePath.endsWith('.json') ? filePath : filePath.replace('.js', '.json');

      if (fs.existsSync(jsPath)) {
        fs.unlinkSync(jsPath);
      }

      if (fs.existsSync(jsonPath)) {
        fs.unlinkSync(jsonPath);
      }

      console.log('[SimpleRecorder] Recording deleted successfully');
      return {
        success: true,
      };
    } catch (error: any) {
      console.error('[SimpleRecorder] Failed to delete recording:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  console.log('[SimpleRecorder] IPC handlers registered successfully');
}
