/**
 * IPC handlers for Desktop Recorder
 *
 * Handles communication between renderer process and desktop recorder.
 * Manages desktop recording sessions, playback, and action management.
 */

import { ipcMain, app } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { DesktopRecorder } from './desktop-recorder';
import { RecorderControlWindow } from './recorder-control-window';
import { readExcelPreview, generateExcelHTML, getExcelFileInfo } from './rookie/thumbnail-handler';

// Module-level active recorder (similar to chrome-handlers.ts pattern)
let activeDesktopRecorder: DesktopRecorder | null = null;
let recorderControlWindow: RecorderControlWindow | null = null;
let createdVirtualDesktop: boolean = false; // Track if we created a new virtual desktop

/**
 * Get output directory for desktop recordings
 */
function getDesktopRecordingOutputDir(): string {
  const baseDir = app.isPackaged
    ? path.join(app.getPath('userData'), 'output')
    : path.join(process.cwd(), 'output');

  // Desktop recordings go in their own subdirectory
  const outputDir = path.join(baseDir, 'desktop-recordings');

  // Ensure directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  return outputDir;
}

/**
 * Register all desktop recorder IPC handlers
 */
export function registerDesktopRecorderHandlers(): void {
  console.log('[DesktopRecorder] Registering IPC handlers');

  // ==================== Start Recording ====================

  ipcMain.handle('desktop-recorder:start', async (event) => {
    try {
      console.log('[DesktopRecorder] Starting desktop recording');

      // Clean up existing recorder if any
      if (activeDesktopRecorder) {
        console.log('[DesktopRecorder] Stopping previous recorder');
        try {
          await activeDesktopRecorder.stopRecording();
        } catch (err) {
          console.error('[DesktopRecorder] Error stopping previous recorder:', err);
        }
      }

      // Generate output file path
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const scriptName = `desktop-recording-${timestamp}`;
      const outputFile = path.join(getDesktopRecordingOutputDir(), `${scriptName}.js`);

      // Create new recorder
      activeDesktopRecorder = new DesktopRecorder();
      activeDesktopRecorder.setOutputFile(outputFile);

      // Set up real-time updates
      activeDesktopRecorder.setUpdateCallback((code) => {
        event.sender.send('desktop-recorder:update', {
          filePath: outputFile,
          code: code,
          timestamp,
        });
      });

      // Start recording
      await activeDesktopRecorder.startRecording();

      console.log('[DesktopRecorder] Recording started successfully');
      return {
        success: true,
        outputFile,
        scriptName,
      };
    } catch (error: any) {
      console.error('[DesktopRecorder] Failed to start recording:', error.message);

      // Check for permission error
      if (error.message.includes('Accessibility permissions')) {
        return {
          success: false,
          error: 'PERMISSION_DENIED',
          message: 'Accessibility permissions not granted. Please enable in System Preferences > Security & Privacy > Accessibility.',
        };
      }

      return {
        success: false,
        error: 'START_FAILED',
        message: error.message,
      };
    }
  });

  // ==================== Stop Recording ====================

  ipcMain.handle('desktop-recorder:stop', async () => {
    try {
      if (!activeDesktopRecorder) {
        console.warn('[DesktopRecorder] No active recorder to stop');
        return {
          success: false,
          error: 'NO_ACTIVE_RECORDER',
          message: 'No active recording session',
        };
      }

      console.log('[DesktopRecorder] Stopping recording');
      const filePath = await activeDesktopRecorder.stopRecording();

      const status = activeDesktopRecorder.getStatus();

      console.log(`[DesktopRecorder] Recording stopped. ${status.actionCount} actions recorded.`);

      // If we created a virtual desktop for this recording, switch back and clean up
      if (createdVirtualDesktop) {
        console.log('[DesktopRecorder] Cleaning up virtual desktop...');
        try {
          await activeDesktopRecorder['desktopManager'].switchBackAndCleanup();
          createdVirtualDesktop = false;
        } catch (error: any) {
          console.warn('[DesktopRecorder] Failed to clean up virtual desktop:', error.message);
          // Don't fail the stop operation if cleanup fails
        }
      }

      // Close control window if exists
      if (recorderControlWindow) {
        try {
          recorderControlWindow.close();
          recorderControlWindow = null;
        } catch (error: any) {
          console.warn('[DesktopRecorder] Failed to close control window:', error.message);
        }
      }

      return {
        success: true,
        filePath,
        actionCount: status.actionCount,
      };
    } catch (error: any) {
      console.error('[DesktopRecorder] Failed to stop recording:', error.message);
      return {
        success: false,
        error: 'STOP_FAILED',
        message: error.message,
      };
    }
  });

  // ==================== Pause Recording ====================

  ipcMain.handle('desktop-recorder:pause', async () => {
    try {
      if (!activeDesktopRecorder) {
        return {
          success: false,
          error: 'NO_ACTIVE_RECORDER',
        };
      }

      activeDesktopRecorder.pauseRecording();

      console.log('[DesktopRecorder] Recording paused');
      return { success: true };
    } catch (error: any) {
      console.error('[DesktopRecorder] Failed to pause recording:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // ==================== Resume Recording ====================

  ipcMain.handle('desktop-recorder:resume', async () => {
    try {
      if (!activeDesktopRecorder) {
        return {
          success: false,
          error: 'NO_ACTIVE_RECORDER',
        };
      }

      activeDesktopRecorder.resumeRecording();

      console.log('[DesktopRecorder] Recording resumed');
      return { success: true };
    } catch (error: any) {
      console.error('[DesktopRecorder] Failed to resume recording:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // ==================== Get Status ====================

  ipcMain.handle('desktop-recorder:get-status', async () => {
    try {
      if (!activeDesktopRecorder) {
        return {
          success: true,
          status: {
            isRecording: false,
            isPaused: false,
            actionCount: 0,
          },
        };
      }

      const status = activeDesktopRecorder.getStatus();
      return {
        success: true,
        status,
      };
    } catch (error: any) {
      console.error('[DesktopRecorder] Failed to get status:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // ==================== Get Actions ====================

  ipcMain.handle('desktop-recorder:get-actions', async () => {
    try {
      if (!activeDesktopRecorder) {
        return {
          success: false,
          error: 'NO_ACTIVE_RECORDER',
          actions: [],
        };
      }

      const actions = activeDesktopRecorder.getActions();
      return {
        success: true,
        actions,
      };
    } catch (error: any) {
      console.error('[DesktopRecorder] Failed to get actions:', error.message);
      return {
        success: false,
        error: error.message,
        actions: [],
      };
    }
  });

  // ==================== Delete Action ====================

  ipcMain.handle('desktop-recorder:delete-action', async (event, { index }) => {
    try {
      if (!activeDesktopRecorder) {
        return {
          success: false,
          error: 'NO_ACTIVE_RECORDER',
        };
      }

      activeDesktopRecorder.deleteAction(index);

      console.log(`[DesktopRecorder] Deleted action at index ${index}`);
      return { success: true };
    } catch (error: any) {
      console.error('[DesktopRecorder] Failed to delete action:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // ==================== Replay Recording ====================

  ipcMain.handle('desktop-recorder:replay', async (event, { filePath, speed }) => {
    try {
      console.log(`[DesktopRecorder] Replaying recording from ${filePath} at ${speed || 1.0}x speed`);

      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          error: 'FILE_NOT_FOUND',
          message: `Recording file not found: ${filePath}`,
        };
      }

      // Create new recorder for playback
      const recorder = new DesktopRecorder();
      await recorder.replay(filePath, { speed: speed || 1.0 });

      console.log('[DesktopRecorder] Replay completed successfully');
      return { success: true };
    } catch (error: any) {
      console.error('[DesktopRecorder] Failed to replay recording:', error.message);

      // Check for not implemented error
      if (error.message.includes('Phase 3')) {
        return {
          success: false,
          error: 'NOT_IMPLEMENTED',
          message: 'Replay functionality will be implemented in Phase 3',
        };
      }

      return {
        success: false,
        error: 'REPLAY_FAILED',
        message: error.message,
      };
    }
  });

  // ==================== Get Recordings List ====================

  ipcMain.handle('desktop-recorder:get-recordings', async () => {
    try {
      const outputDir = getDesktopRecordingOutputDir();

      if (!fs.existsSync(outputDir)) {
        return {
          success: true,
          recordings: [],
        };
      }

      const files = fs.readdirSync(outputDir)
        .filter(file => file.endsWith('.js'))
        .map(file => {
          const filePath = path.join(outputDir, file);
          const stats = fs.statSync(filePath);

          // Try to read JSON file to get action count
          let actionCount = 0;
          const jsonPath = filePath.replace('.js', '.json');
          if (fs.existsSync(jsonPath)) {
            try {
              const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
              actionCount = jsonData.metadata?.actionCount || jsonData.actions?.length || 0;
            } catch (err) {
              console.warn(`Failed to read action count from ${jsonPath}`);
            }
          }

          return {
            name: file,
            path: filePath,
            size: stats.size,
            createdAt: stats.birthtime,
            modified: stats.mtime,
            actionCount,
          };
        })
        .sort((a, b) => b.modified.getTime() - a.modified.getTime()); // Most recent first

      console.log(`[DesktopRecorder] Found ${files.length} recordings`);
      return {
        success: true,
        recordings: files,
      };
    } catch (error: any) {
      console.error('[DesktopRecorder] Failed to get recordings:', error.message);
      return {
        success: false,
        error: error.message,
        recordings: [],
      };
    }
  });

  // ==================== Delete Recording ====================

  ipcMain.handle('desktop-recorder:delete-recording', async (event, { filePath }) => {
    try {
      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          error: 'FILE_NOT_FOUND',
        };
      }

      fs.unlinkSync(filePath);

      console.log(`[DesktopRecorder] Deleted recording: ${filePath}`);
      return { success: true };
    } catch (error: any) {
      console.error('[DesktopRecorder] Failed to delete recording:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // ==================== View Recording Code ====================

  ipcMain.handle('desktop-recorder:view-recording', async (event, { filePath }) => {
    try {
      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          error: 'FILE_NOT_FOUND',
        };
      }

      const code = fs.readFileSync(filePath, 'utf-8');

      console.log(`[DesktopRecorder] Loaded recording code: ${filePath}`);
      return {
        success: true,
        code,
      };
    } catch (error: any) {
      console.error('[DesktopRecorder] Failed to view recording:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // ==================== Check Permissions ====================

  ipcMain.handle('desktop-recorder:check-permissions', async () => {
    try {
      const tempRecorder = new DesktopRecorder();
      const hasPermissions = await tempRecorder['desktopManager'].checkAccessibilityPermissions();

      console.log(`[DesktopRecorder] Accessibility permissions: ${hasPermissions ? 'granted' : 'not granted'}`);
      return {
        success: true,
        hasPermissions,
        platform: process.platform,
      };
    } catch (error: any) {
      console.error('[DesktopRecorder] Failed to check permissions:', error.message);
      return {
        success: false,
        error: error.message,
        hasPermissions: false,
        platform: process.platform,
      };
    }
  });

  // ==================== Generate Excel Thumbnail ====================

  ipcMain.handle('rookie:generate-excel-thumbnail', async (event, { filePath }) => {
    try {
      console.log(`[Rookie] Generating Excel thumbnail for ${filePath}`);

      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          error: 'FILE_NOT_FOUND',
          message: `File not found: ${filePath}`,
        };
      }

      // Read Excel sheet with size limits for thumbnail
      const previewData = await readExcelPreview(filePath, {
        maxRows: 30,  // Limit to first 30 rows to keep PNG size reasonable
        maxColumns: 15,  // Limit to first 15 columns
        includeHeaders: true,
      });

      // Generate HTML representation
      const html = generateExcelHTML(previewData);

      // Get file info
      const fileInfo = getExcelFileInfo(filePath);

      console.log(`[Rookie] Excel thumbnail data generated successfully`);
      return {
        success: true,
        previewData,
        html,
        fileInfo,
      };
    } catch (error: any) {
      console.error('[Rookie] Failed to generate Excel thumbnail:', error.message);
      return {
        success: false,
        error: 'THUMBNAIL_GENERATION_FAILED',
        message: error.message,
      };
    }
  });

  // ==================== Virtual Desktop Control (Windows) ====================

  ipcMain.handle('desktop-recorder:create-virtual-desktop', async () => {
    try {
      if (!activeDesktopRecorder) {
        return {
          success: false,
          error: 'NO_ACTIVE_RECORDER',
          message: 'No active desktop recorder',
        };
      }

      const success = await activeDesktopRecorder['desktopManager'].createVirtualDesktop();
      return { success };
    } catch (error: any) {
      console.error('[DesktopRecorder] Failed to create virtual desktop:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  ipcMain.handle('desktop-recorder:switch-virtual-desktop', async (event, { direction }) => {
    try {
      if (!activeDesktopRecorder) {
        return {
          success: false,
          error: 'NO_ACTIVE_RECORDER',
          message: 'No active desktop recorder',
        };
      }

      const success = direction === 'next'
        ? await activeDesktopRecorder['desktopManager'].switchToNextDesktop()
        : await activeDesktopRecorder['desktopManager'].switchToPreviousDesktop();

      return { success };
    } catch (error: any) {
      console.error('[DesktopRecorder] Failed to switch virtual desktop:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  ipcMain.handle('desktop-recorder:close-virtual-desktop', async () => {
    try {
      if (!activeDesktopRecorder) {
        return {
          success: false,
          error: 'NO_ACTIVE_RECORDER',
          message: 'No active desktop recorder',
        };
      }

      const success = await activeDesktopRecorder['desktopManager'].closeCurrentDesktop();
      return { success };
    } catch (error: any) {
      console.error('[DesktopRecorder] Failed to close virtual desktop:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  ipcMain.handle('desktop-recorder:open-task-view', async () => {
    try {
      if (!activeDesktopRecorder) {
        return {
          success: false,
          error: 'NO_ACTIVE_RECORDER',
          message: 'No active desktop recorder',
        };
      }

      const success = await activeDesktopRecorder['desktopManager'].openTaskView();
      return { success };
    } catch (error: any) {
      console.error('[DesktopRecorder] Failed to open task view:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // ==================== Recorder Control Window ====================

  ipcMain.handle('desktop-recorder:start-with-control-window', async (event) => {
    try {
      console.log('[DesktopRecorder] Starting recording with control window on new virtual desktop');

      // Clean up existing recorder if any
      if (activeDesktopRecorder) {
        console.log('[DesktopRecorder] Stopping previous recorder');
        try {
          await activeDesktopRecorder.stopRecording();
        } catch (err) {
          console.error('[DesktopRecorder] Error stopping previous recorder:', err);
        }
      }

      // Generate output file path
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const scriptName = `desktop-recording-${timestamp}`;
      const outputFile = path.join(getDesktopRecordingOutputDir(), `${scriptName}.js`);

      // Create new recorder
      activeDesktopRecorder = new DesktopRecorder();
      activeDesktopRecorder.setOutputFile(outputFile);

      // Set up real-time updates
      activeDesktopRecorder.setUpdateCallback((code) => {
        event.sender.send('desktop-recorder:update', {
          filePath: outputFile,
          code: code,
          timestamp,
        });
      });

      // Start recording with control window (creates desktop, shows control window, starts recording)
      await activeDesktopRecorder.startRecordingWithControlWindow();

      createdVirtualDesktop = true; // Mark that we created a virtual desktop

      console.log('[DesktopRecorder] Recording started with control window');
      return {
        success: true,
        outputFile,
        scriptName,
        controlWindowCreated: true,
      };
    } catch (error: any) {
      console.error('[DesktopRecorder] Failed to start recording with control window:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  ipcMain.handle('desktop-recorder:close-control-window', async () => {
    try {
      if (recorderControlWindow) {
        recorderControlWindow.close();
        recorderControlWindow = null;
      }
      return { success: true };
    } catch (error: any) {
      console.error('[DesktopRecorder] Failed to close control window:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // ==================== Downloaded Files Management ====================

  /**
   * Get list of downloaded files from the current/last recording
   */
  ipcMain.handle('desktop-recorder:get-downloaded-files', async (event, { recordingPath }) => {
    try {
      // If recording path provided, load from JSON
      if (recordingPath) {
        const jsonPath = recordingPath.replace('.js', '.json');
        if (fs.existsSync(jsonPath)) {
          const recordingData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
          return {
            success: true,
            files: recordingData.metadata?.downloadedFiles || [],
          };
        }
      }

      // Otherwise, get from active recorder
      if (activeDesktopRecorder) {
        const status = activeDesktopRecorder.getStatus();
        if (status.isRecording) {
          return {
            success: true,
            files: activeDesktopRecorder.getDownloadedFiles(),
            message: 'Recording in progress',
          };
        }
      }

      return {
        success: false,
        error: 'No active recording or recording path provided',
      };
    } catch (error: any) {
      console.error('[DesktopRecorder] Failed to get downloaded files:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Parse a downloaded Excel/CSV file with preview
   */
  ipcMain.handle('desktop-recorder:parse-downloaded-file', async (event, { filePath }) => {
    try {
      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          error: 'File not found',
        };
      }

      // Use existing Excel parsing utilities
      const previewData = await readExcelPreview(filePath, {
        maxRows: 30,
        maxColumns: 15,
        includeHeaders: true,
      });

      const html = generateExcelHTML(previewData);
      const fileInfo = getExcelFileInfo(filePath);

      return {
        success: true,
        previewData,
        html,
        fileInfo,
      };
    } catch (error: any) {
      console.error('[DesktopRecorder] Failed to parse downloaded file:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Get downloaded files from a specific recording JSON
   */
  ipcMain.handle('desktop-recorder:load-downloaded-files-from-json', async (event, { jsonPath }) => {
    try {
      if (!fs.existsSync(jsonPath)) {
        return {
          success: false,
          error: 'Recording JSON file not found',
        };
      }

      const recordingData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

      return {
        success: true,
        files: recordingData.metadata?.downloadedFiles || [],
        recordingInfo: {
          recordedAt: recordingData.recordedAt,
          duration: recordingData.duration,
          platform: recordingData.platform,
          actionCount: recordingData.metadata.actionCount,
        },
      };
    } catch (error: any) {
      console.error('[DesktopRecorder] Failed to load downloaded files from JSON:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Get all desktop recording download folders (for sync setup)
   */
  ipcMain.handle('desktop-recorder:get-download-folders', async () => {
    try {
      const downloadsBasePath = path.join(os.homedir(), 'Downloads', 'EGDesk-Desktop');

      if (!fs.existsSync(downloadsBasePath)) {
        return { success: true, folders: [] };
      }

      const folders = fs.readdirSync(downloadsBasePath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => {
          const folderPath = path.join(downloadsBasePath, dirent.name);
          const stats = fs.statSync(folderPath);
          const files = fs.readdirSync(folderPath);
          const excelFiles = files.filter(f => /\.(xlsx|xls|xlsm|csv)$/i.test(f));

          // Calculate folder size
          let size = 0;
          try {
            files.forEach(file => {
              const filePath = path.join(folderPath, file);
              if (fs.statSync(filePath).isFile()) {
                size += fs.statSync(filePath).size;
              }
            });
          } catch (err) {
            // Ignore errors
          }

          return {
            scriptName: dirent.name.replace(/^egdesk-desktop-recorder-/, 'Desktop Recording '),
            folderName: dirent.name,
            path: folderPath,
            fileCount: files.length,
            excelFileCount: excelFiles.length,
            lastModified: stats.mtime,
            size,
          };
        })
        .filter(folder => folder.excelFileCount > 0) // Only show folders with Excel files
        .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime()); // Most recent first

      return { success: true, folders };
    } catch (error: any) {
      console.error('[DesktopRecorder] Failed to get download folders:', error.message);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get files in a specific folder
   */
  ipcMain.handle('desktop-recorder:get-folder-files', async (event, { folderPath }) => {
    try {
      if (!fs.existsSync(folderPath)) {
        return { success: false, error: 'Folder not found' };
      }

      const files = fs.readdirSync(folderPath)
        .filter(filename => {
          const filePath = path.join(folderPath, filename);
          return fs.statSync(filePath).isFile();
        })
        .map(filename => {
          const filePath = path.join(folderPath, filename);
          const stats = fs.statSync(filePath);

          return {
            name: filename,
            path: filePath,
            size: stats.size,
            modified: stats.mtime,
          };
        })
        .sort((a, b) => b.modified.getTime() - a.modified.getTime()); // Most recent first

      return { success: true, files };
    } catch (error: any) {
      console.error('[DesktopRecorder] Failed to get folder files:', error.message);
      return { success: false, error: error.message };
    }
  });

  console.log('[DesktopRecorder] IPC handlers registered successfully');
}

/**
 * Cleanup function to stop active recorder on app quit
 */
export async function cleanupDesktopRecorder(): Promise<void> {
  if (activeDesktopRecorder) {
    try {
      console.log('[DesktopRecorder] Cleaning up active recorder');
      await activeDesktopRecorder.stopRecording();
      activeDesktopRecorder = null;
    } catch (error) {
      console.error('[DesktopRecorder] Error during cleanup:', error);
    }
  }

  if (recorderControlWindow) {
    try {
      console.log('[DesktopRecorder] Closing control window');
      recorderControlWindow.close();
      recorderControlWindow = null;
    } catch (error) {
      console.error('[DesktopRecorder] Error closing control window:', error);
    }
  }
}
