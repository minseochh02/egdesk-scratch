/**
 * DesktopRecorder
 *
 * Records and replays desktop interactions (mouse, keyboard, clipboard, app switching).
 * Works independently from BrowserRecorder initially, with potential for merging later.
 *
 * Phase 1: Basic class structure and stubs
 * Phase 2: Recording implementation (keyboard, clipboard, app monitoring)
 * Phase 3: Code generation and replay
 * Phase 4: UI integration
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { clipboard, systemPreferences } from 'electron';
import { uIOhook, UiohookKey } from 'uiohook-napi';
import activeWin from 'active-win';
import { ReplayOverlayWindow } from './replay-overlay-window';
import { ArduinoHIDManager } from './utils/arduino-hid-manager';

const execAsync = promisify(exec);

// Mouse button constants (uiohook-napi doesn't export these)
const MouseButton = {
  Left: 1,
  Right: 2,
  Middle: 3,
} as const;

// Browser app names (for detecting browser clicks)
const BROWSER_APPS = new Set([
  'Chrome',
  'Google Chrome',
  'firefox',
  'Firefox',
  'Safari',
  'Edge',
  'MicrosoftEdge',
  'msedge',
  'Brave',
  'Opera',
]);

// Apps to ignore during recording (don't record interactions with the recorder itself)
const IGNORED_APPS = new Set([
  'EGDesk',
  'egdesk',
  'Electron',
  'electron',
]);
import { DesktopAutomationManager } from './utils/desktop-automation-manager';

/**
 * Downloaded file information
 */
export interface DownloadedFileInfo {
  filename: string;
  filePath: string;
  fileSize: number;
  downloadedAt: string;
  timestamp: number;
}

/**
 * Recording file format
 */
export interface RecordingFile {
  version: '1.0';
  recordedAt: string;
  duration: number;
  platform: string;
  screenSize: { width: number; height: number };
  actions: DesktopAction[];
  metadata: {
    scriptName: string;
    actionCount: number;
    downloadedFiles?: DownloadedFileInfo[];
    downloadsFolder?: string; // Path to recording-specific downloads folder
  };
}

/**
 * Desktop action types
 */
export interface DesktopAction {
  type: 'mouseMove' | 'mouseClick' | 'mouseDoubleClick' | 'mouseRightClick' | 'mouseDrag' |
        'keyPress' | 'keyType' | 'keyCombo' |
        'clipboardCopy' | 'clipboardPaste' | 'clipboardRead' |
        'appSwitch' | 'appLaunch' | 'windowFocus' | 'windowResize' |
        'browserInteractionStart' | 'browserInteractionEnd' |
        'fileDownload' | 'uacPrompt';

  timestamp: number;

  // Mouse-specific
  coordinates?: { x: number; y: number };
  startCoordinates?: { x: number; y: number };
  endCoordinates?: { x: number; y: number };
  button?: 'left' | 'right' | 'middle';

  // Keyboard-specific
  key?: string;
  keys?: string[];  // For key combos: ['Command', 'C']
  text?: string;     // For typing
  modifiers?: ('Command' | 'Control' | 'Alt' | 'Shift')[];

  // Clipboard-specific
  clipboardContent?: string;

  // Window/App-specific
  appName?: string;
  appPath?: string; // Full executable path for reliable launching
  windowTitle?: string;
  windowId?: number;
  windowBounds?: { x: number; y: number; width: number; height: number };

  // File download-specific
  filename?: string;
  filePath?: string;
  fileSize?: number;

  // UAC-specific
  uacAction?: 'accept' | 'decline';
  uacPromptTitle?: string;
  requiresArduino?: boolean; // Flag indicating this action needs Arduino to replay
}

/**
 * DesktopRecorder class
 */
export class DesktopRecorder {
  private actions: DesktopAction[] = [];
  private desktopManager: DesktopAutomationManager;
  private isRecording: boolean = false;
  private isPaused: boolean = false;
  private startTime: number = 0;
  private outputFile: string = '';
  private updateCallback?: (code: string) => void;

  // Listeners for recording (Phase 2)
  private uiohookStarted: boolean = false;
  private clipboardCheckInterval: NodeJS.Timeout | null = null;
  private windowCheckInterval: NodeJS.Timeout | null = null;
  private lastClipboardContent: string = '';
  private lastActiveWindow: string = '';
  private lastMousePosition: { x: number; y: number } | null = null;
  private keySequenceBuffer: string[] = [];
  private keySequenceTimeout: NodeJS.Timeout | null = null;
  private seenApps: Set<string> = new Set();
  private windowMonitoringFailed: boolean = false;
  private windowMonitoringFailCount: number = 0;
  private pressedKeys: Set<number> = new Set(); // Track currently pressed keys
  private currentlyInBrowser: boolean = false; // Track if user is currently in a browser
  private controlWindow: any = null; // Reference to control window (if using one)

  // Download monitoring
  private downloadWatcher: fs.FSWatcher | null = null;
  private downloadedFiles: Map<string, DownloadedFileInfo> = new Map();
  private downloadsPath: string = '';
  private recordingDownloadsFolder: string = '';
  private mouseCheckInterval: NodeJS.Timeout | null = null;
  private mouseMonitoringFailed: boolean = false;
  private mouseMonitoringFailCount: number = 0;

  // Arduino HID for UAC handling
  private arduinoManager: ArduinoHIDManager | null = null;
  private arduinoPort: string | null = null;
  private uacDetectionEnabled: boolean = false;
  private lastUACDetection: number = 0;

  constructor() {
    this.desktopManager = new DesktopAutomationManager();
  }

  // ==================== Recording Methods ====================

  /**
   * Initialize the list of currently running apps before recording starts
   * This prevents false "app launch" detections for apps already running
   */
  private async initializeRunningApps(): Promise<void> {
    try {
      console.log('[DesktopRecorder] Scanning for already-running apps...');

      if (process.platform === 'win32') {
        // Windows: Use tasklist to get running processes
        const { stdout } = await execAsync('tasklist /FO CSV /NH');
        const lines = stdout.split('\n');

        for (const line of lines) {
          const match = line.match(/"([^"]+)\.exe"/);
          if (match) {
            const appName = match[1];
            // Add common app names (without .exe)
            if (appName && !appName.startsWith('svchost')) {
              this.seenApps.add(appName);
            }
          }
        }
      } else if (process.platform === 'darwin') {
        // macOS: Use ps to get running apps
        const { stdout } = await execAsync('ps -ax -o comm=');
        const lines = stdout.split('\n');

        for (const line of lines) {
          const appName = path.basename(line.trim()).replace('.app', '');
          if (appName && !appName.startsWith('.')) {
            this.seenApps.add(appName);
          }
        }
      }

      // Also get the current active window specifically
      const activeWindow = await activeWin();
      if (activeWindow) {
        this.seenApps.add(activeWindow.owner.name);
        this.lastActiveWindow = activeWindow.owner.name;
        console.log(`[DesktopRecorder] Currently active app: ${activeWindow.owner.name}`);
      }

      console.log(`[DesktopRecorder] Found ${this.seenApps.size} pre-existing apps (won't record as launches)`);
    } catch (error: any) {
      console.warn('[DesktopRecorder] Failed to scan running apps:', error.message);
      console.log('[DesktopRecorder] Continuing anyway - may record some false launches');
    }
  }

  /**
   * Start recording desktop actions
   */
  async startRecording(options?: { createVirtualDesktop?: boolean }): Promise<void> {
    if (this.isRecording) {
      console.warn('Desktop recording already in progress');
      return;
    }

    // Check permissions
    const hasPermissions = await this.desktopManager.checkAccessibilityPermissions();
    if (!hasPermissions) {
      throw new Error('Accessibility permissions not granted. Please enable in System Preferences.');
    }

    // Initialize desktop automation
    const initialized = await this.desktopManager.initialize();
    if (!initialized) {
      throw new Error('Failed to initialize desktop automation');
    }

    // Create and switch to new virtual desktop if requested (default: true)
    const shouldCreateDesktop = options?.createVirtualDesktop !== false;
    if (shouldCreateDesktop) {
      console.log('[DesktopRecorder] Creating new virtual desktop for recording...');
      const desktopCreated = await this.desktopManager.createAndSwitchToNewDesktop();
      if (desktopCreated) {
        console.log('[DesktopRecorder] ✅ Switched to new virtual desktop');
      } else {
        console.log('[DesktopRecorder] ⚠️  Could not create virtual desktop, recording on current desktop');
      }
    }

    this.isRecording = true;
    this.isPaused = false;
    this.startTime = Date.now();
    this.actions = [];

    // Initialize seenApps with currently running apps to avoid false "launches"
    await this.initializeRunningApps();

    // Setup event listeners
    this.setupGlobalKeyboardListener(); // This now also captures mouse clicks via uiohook
    this.setupClipboardMonitoring();
    this.setupWindowMonitoring();
    this.setupDownloadMonitoring();

    console.log('[DesktopRecorder] Recording started');
    if (this.uiohookStarted) {
      console.log('[DesktopRecorder] Mouse clicks and keyboard events are now being captured');
      console.log('[DesktopRecorder] Hotkeys: Cmd+Shift+P to pause, Cmd+Shift+S to stop');
    } else {
      console.log('[DesktopRecorder] Recording clipboard and window changes (keyboard/mouse capture unavailable in dev mode)');
    }
  }

  /**
   * Start recording with a control window (for external use)
   */
  async startRecordingWithControlWindow(): Promise<void> {
    console.log('[DesktopRecorder] ===== STARTING RECORDING WITH CONTROL WINDOW =====');
    
    // Create and switch to new virtual desktop first
    console.log('[DesktopRecorder] Creating new virtual desktop for recording...');
    const desktopCreated = await this.desktopManager.createAndSwitchToNewDesktop();
    if (desktopCreated) {
      console.log('[DesktopRecorder] ✅ Switched to new virtual desktop');
      // Wait for desktop switch to fully complete before creating window
      console.log('[DesktopRecorder] Waiting for desktop switch to complete...');
      await this.sleep(3000); // Increased to 3 seconds for better stability
      
      // Additional verification: try to trigger a focus event to ensure we're on the new desktop
      console.log('[DesktopRecorder] Verifying desktop switch...');
      await this.verifyDesktopSwitch();
    } else {
      console.log('[DesktopRecorder] ⚠️ Virtual desktop creation failed, continuing on current desktop');
    }

    // Import and create control window on the new desktop
    console.log('[DesktopRecorder] Creating control window...');
    try {
      const { RecorderControlWindow } = await import('./recorder-control-window');
      this.controlWindow = new RecorderControlWindow();
      console.log('[DesktopRecorder] RecorderControlWindow imported and instantiated');
      
      await this.controlWindow.create();
      console.log('[DesktopRecorder] Control window creation completed');
    } catch (error: any) {
      console.error('[DesktopRecorder] Failed to create control window:', error.message);
      console.error(error.stack);
    }

    // Start recording (skip virtual desktop creation since we already did it)
    console.log('[DesktopRecorder] Starting recording phase...');
    await this.startRecording({ createVirtualDesktop: false });

    console.log('[DesktopRecorder] ===== CONTROL WINDOW SETUP COMPLETE =====');
  }

  /**
   * Stop recording and save actions
   */
  async stopRecording(): Promise<string> {
    if (!this.isRecording) {
      console.warn('No active desktop recording');
      return '';
    }

    this.isRecording = false;
    this.isPaused = false;

    // Stop event listeners
    this.stopAllListeners();

    // Emergency key release to prevent stuck keys
    await this.emergencyKeyRelease();

    // Post-process actions to correlate clicks with app launches
    this.correlateAppLaunchClicks();

    // Generate code
    const code = this.generateTestCode();

    // Save to file if output path specified
    if (this.outputFile) {
      await this.saveToFile(code);

      // Also save recording data as JSON
      const jsonPath = this.outputFile.replace('.js', '.json');
      const recordingData: RecordingFile = {
        version: '1.0',
        recordedAt: new Date().toISOString(),
        duration: Date.now() - this.startTime,
        platform: process.platform,
        screenSize: await this.desktopManager.getScreenSize() || { width: 0, height: 0 },
        actions: this.actions,
        metadata: {
          scriptName: path.basename(this.outputFile, '.js'),
          actionCount: this.actions.length,
          downloadedFiles: Array.from(this.downloadedFiles.values()),
          downloadsFolder: this.recordingDownloadsFolder || undefined,
        },
      };

      fs.writeFileSync(jsonPath, JSON.stringify(recordingData, null, 2), 'utf-8');
      console.log(`[DesktopRecorder] Recording data saved to ${jsonPath}`);

      // Log downloaded files summary
      if (this.downloadedFiles.size > 0) {
        console.log(`[DesktopRecorder] 📥 Downloaded files tracked (${this.downloadedFiles.size}):`);
        for (const [filename, info] of this.downloadedFiles) {
          console.log(`[DesktopRecorder]    - ${filename} (${this.formatFileSize(info.fileSize)})`);
        }
        console.log(`[DesktopRecorder] 📂 Downloads folder: ${this.recordingDownloadsFolder}`);
      }
    }

    console.log(`[DesktopRecorder] Recording stopped. ${this.actions.length} actions recorded.`);

    // Close control window if it exists
    if (this.controlWindow && this.controlWindow.exists && this.controlWindow.exists()) {
      console.log('[DesktopRecorder] Closing control window...');
      this.controlWindow.close();
      this.controlWindow = null;
    }

    // Switch back to original desktop and clean up
    console.log('[DesktopRecorder] Switching back to original desktop...');
    try {
      await this.desktopManager.switchBackAndCleanup();
      console.log('[DesktopRecorder] ✅ Returned to original desktop');
    } catch (error: any) {
      console.warn('[DesktopRecorder] Failed to switch back:', error.message);
      console.log('[DesktopRecorder] You can manually switch back using:');
      if (process.platform === 'win32') {
        console.log('[DesktopRecorder]   Win+Ctrl+Left (switch back)');
        console.log('[DesktopRecorder]   Win+Ctrl+F4 (close recording desktop)');
      } else if (process.platform === 'darwin') {
        console.log('[DesktopRecorder]   Ctrl+Left (switch back)');
        console.log('[DesktopRecorder]   Mission Control → hover → click X (close space)');
      }
    }

    return this.outputFile;
  }

  /**
   * Pause recording
   */
  pauseRecording(): void {
    if (!this.isRecording) {
      console.warn('No active recording to pause');
      return;
    }

    this.isPaused = true;
    console.log('[DesktopRecorder] Recording paused');
  }

  /**
   * Resume recording
   */
  resumeRecording(): void {
    if (!this.isRecording || !this.isPaused) {
      console.warn('Cannot resume recording');
      return;
    }

    this.isPaused = false;
    console.log('[DesktopRecorder] Recording resumed');
  }

  // ==================== Playback Methods ====================

  /**
   * Replay desktop actions from a saved file
   */
  async replay(filePath: string, options?: { speed?: number }): Promise<void> {
    // Check permissions
    const hasPermissions = await this.desktopManager.checkAccessibilityPermissions();
    if (!hasPermissions) {
      throw new Error('Accessibility permissions required for replay');
    }

    // Load recording (try .json, fallback to .js companion)
    let recording: RecordingFile;
    const jsonPath = filePath.endsWith('.json') ? filePath : filePath.replace('.js', '.json');

    if (!fs.existsSync(jsonPath)) {
      throw new Error('Recording data (.json) not found');
    }

    recording = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    console.log(`[DesktopRecorder] Replaying ${recording.actions.length} actions...`);

    // Create and switch to new virtual desktop for isolated replay
    console.log('[DesktopRecorder] Creating new virtual desktop for replay...');
    const desktopCreated = await this.desktopManager.createAndSwitchToNewDesktop();
    if (desktopCreated) {
      console.log('[DesktopRecorder] ✅ Switched to replay desktop');
      console.log('[DesktopRecorder] You can switch back to EGDesk using:');
      if (process.platform === 'win32') {
        console.log('[DesktopRecorder]   Win+Ctrl+Left');
      } else if (process.platform === 'darwin') {
        console.log('[DesktopRecorder]   Ctrl+Left');
      }
    }

    // Create overlay window for visual feedback
    const overlay = new ReplayOverlayWindow();
    await overlay.create();

    try {
      // Replay actions with timing and visual feedback
      const speed = options?.speed || 1.0;
      let lastTimestamp = 0;

      for (let i = 0; i < recording.actions.length; i++) {
        const action = recording.actions[i];
        const delay = (action.timestamp - lastTimestamp) / speed;

        if (delay > 0) {
          await this.sleep(delay);
        }

        // Update overlay with current action
        const actionDescription = this.getActionDescription(action);
        overlay.updateProgress(i + 1, recording.actions.length, actionDescription);

        // Show mouse indicator for click actions
        if (action.coordinates && (action.type === 'mouseClick' || action.type === 'mouseDoubleClick' || action.type === 'mouseRightClick')) {
          overlay.showMouseIndicator(action.coordinates.x, action.coordinates.y);
        }

        await this.replayAction(action);
        lastTimestamp = action.timestamp;
      }

      console.log('[DesktopRecorder] Replay complete');
    } finally {
      // Always close overlay, even if replay fails
      await this.sleep(1000); // Show completion for 1 second
      overlay.close();

      // Switch back to original desktop and clean up
      console.log('[DesktopRecorder] Switching back to original desktop...');
      try {
        await this.desktopManager.switchBackAndCleanup();
        console.log('[DesktopRecorder] ✅ Returned to original desktop');
      } catch (error: any) {
        console.warn('[DesktopRecorder] Failed to auto-switch back:', error.message);
        console.log('[DesktopRecorder] Please manually switch back to EGDesk desktop');
      }
    }
  }

  /**
   * Sleep helper for replay timing
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Verify desktop switch by performing a small action to ensure we're on the correct desktop
   */
  private async verifyDesktopSwitch(): Promise<void> {
    try {
      // Perform a small mouse movement to trigger desktop focus
      const currentPos = await this.desktopManager.getMousePosition();
      if (currentPos) {
        await this.desktopManager.moveMouse(currentPos.x + 1, currentPos.y);
        await this.sleep(100);
        await this.desktopManager.moveMouse(currentPos.x, currentPos.y);
      }
      console.log('[DesktopRecorder] Desktop switch verification completed');
    } catch (error: any) {
      console.warn('[DesktopRecorder] Desktop switch verification failed:', error.message);
    }
  }

  /**
   * Emergency key release to prevent stuck modifier keys
   */
  private async emergencyKeyRelease(): Promise<void> {
    try {
      console.log('[DesktopRecorder] Performing emergency key release...');
      
      // Use the desktop manager's reset method if available
      if (this.desktopManager) {
        // Reset any rate limits to allow immediate key operations
        this.desktopManager.resetRateLimits();
      }
      
      // Wait a moment for any ongoing operations to complete
      await this.sleep(200);
      
      console.log('[DesktopRecorder] Emergency key release completed');
    } catch (error: any) {
      console.error('[DesktopRecorder] Emergency key release failed:', error.message);
    }
  }

  /**
   * Get human-readable description of an action for overlay display
   */
  private getActionDescription(action: DesktopAction): string {
    switch (action.type) {
      case 'mouseClick':
        return `🖱️ Click at (${action.coordinates?.x}, ${action.coordinates?.y})`;
      case 'mouseDoubleClick':
        return `🖱️ Double-click at (${action.coordinates?.x}, ${action.coordinates?.y})`;
      case 'mouseRightClick':
        return `🖱️ Right-click at (${action.coordinates?.x}, ${action.coordinates?.y})`;
      case 'keyCombo':
        return `⌨️ Press ${action.keys?.join('+')}`;
      case 'keyType':
        const preview = action.text ? action.text.substring(0, 30) : '';
        return `⌨️ Type: ${preview}${action.text && action.text.length > 30 ? '...' : ''}`;
      case 'appLaunch':
        return `🚀 Launch ${action.appName}`;
      case 'appSwitch':
        return `↔️ Switch to ${action.appName}`;
      case 'browserInteractionStart':
        return `🌐 Open ${action.appName || 'Browser'}`;
      case 'browserInteractionEnd':
        return `🌐 Close Browser`;
      case 'clipboardCopy':
        return `📋 Copy to clipboard`;
      case 'fileDownload':
        return `📥 Downloaded: ${action.filename}`;
      case 'uacPrompt':
        return `🛡️  UAC Prompt: ${action.uacAction === 'accept' ? 'Accept' : 'Decline'}`;
      default:
        return `${action.type}`;
    }
  }

  /**
   * Replay a single desktop action
   */
  async replayAction(action: DesktopAction): Promise<void> {
    switch (action.type) {
      case 'mouseMove':
        if (action.coordinates) {
          await this.desktopManager.moveMouse(action.coordinates.x, action.coordinates.y);
        }
        break;

      case 'mouseClick':
        // Skip clicks that triggered app launches (we use launch commands instead)
        if ((action as any).isAppLaunchClick) {
          console.log(`Skipping app launch click for: ${(action as any).launchedApp}`);
          break;
        }

        if (action.coordinates) {
          await this.desktopManager.clickMouse(action.coordinates.x, action.coordinates.y, action.button);
        }
        break;

      case 'mouseDoubleClick':
        if (action.coordinates) {
          await this.desktopManager.doubleClickMouse(action.coordinates.x, action.coordinates.y);
        }
        break;

      case 'mouseRightClick':
        if (action.coordinates) {
          await this.desktopManager.rightClickMouse(action.coordinates.x, action.coordinates.y);
        }
        break;

      case 'keyCombo':
        if (action.keys) {
          await this.desktopManager.pressKeyCombo(action.keys);
        }
        break;

      case 'keyType':
        if (action.text) {
          await this.desktopManager.typeText(action.text);
        }
        break;

      case 'clipboardCopy':
      case 'clipboardPaste':
        // Logged only (actual copy/paste happens via key combos)
        console.log(`Clipboard action: ${action.clipboardContent?.substring(0, 50)}...`);
        break;

      case 'appLaunch':
        console.log(`App launch: ${action.appName}${action.windowTitle ? ` - ${action.windowTitle}` : ''}`);
        await this.launchApp(action.appName, action.appPath, action.windowTitle);
        await this.sleep(2000); // Give time for app to launch
        break;

      case 'appSwitch':
        console.log(`App switch to: ${action.appName}`);
        await this.focusApp(action.appName);
        await this.sleep(1000); // Give time for switch
        break;

      case 'browserInteractionStart':
        console.log(`Browser interaction start: ${action.appName || 'Unknown browser'}`);
        console.log('⚠️  WARNING: Browser interactions should be recorded with BrowserRecorder');
        console.log('   BrowserRecorder captures CSS selectors, not coordinates, for reliable replay');
        break;

      case 'browserInteractionEnd':
        console.log('Browser interaction end');
        break;

      case 'uacPrompt':
        await this.handleUACPromptReplay(action);
        break;

      default:
        console.warn(`Action type "${action.type}" not supported in replay`);
    }
  }

  /**
   * Handle UAC prompt during replay
   */
  private async handleUACPromptReplay(action: DesktopAction): Promise<void> {
    console.log(`🛡️  UAC Prompt: "${action.uacPromptTitle}"`);
    console.log(`   Action: ${action.uacAction === 'accept' ? 'Accept (Right Arrow + Enter)' : 'Decline (Enter)'}`);

    if (this.arduinoPort && this.arduinoManager === null) {
      // Initialize Arduino if we have a port configured
      try {
        console.log(`[DesktopRecorder] Connecting to Arduino on ${this.arduinoPort}...`);
        this.arduinoManager = new ArduinoHIDManager(this.arduinoPort);
        await this.arduinoManager.connect();
        console.log(`[DesktopRecorder] Arduino connected successfully`);
      } catch (error: any) {
        console.error(`[DesktopRecorder] Failed to connect to Arduino: ${error.message}`);
        console.log(`[DesktopRecorder] Please handle UAC prompt manually`);
        this.arduinoManager = null;
      }
    }

    if (this.arduinoManager && this.arduinoManager.isConnected()) {
      // Use Arduino to navigate UAC
      console.log(`[DesktopRecorder] Using Arduino HID to navigate UAC...`);
      await this.sleep(1000); // Wait for UAC to fully appear

      if (action.uacAction === 'accept') {
        await this.arduinoManager.acceptUAC(500);
      } else {
        await this.arduinoManager.declineUAC(500);
      }

      console.log(`[DesktopRecorder] UAC handled via Arduino`);
    } else {
      // Manual intervention required
      console.log(`⚠️  MANUAL INTERVENTION REQUIRED:`);
      console.log(`   Please ${action.uacAction === 'accept' ? 'accept' : 'decline'} the UAC prompt manually`);
      console.log(`   Replay will pause for 10 seconds to allow manual handling...`);
      await this.sleep(10000); // Wait for user to handle UAC manually
    }
  }

  // ==================== Code Generation ====================

  /**
   * Generate executable test code from recorded actions
   */
  generateTestCode(): string {
    const timestamp = new Date().toISOString().split('T')[0];

    let code = `// Desktop Recording - ${timestamp}\n`;
    code += `// ${this.actions.length} actions recorded\n\n`;
    code += `const { keyboard, mouse, Key } = require('@nut-tree-fork/nut-js');\n\n`;
    code += `async function run() {\n`;
    code += `  console.log('Starting desktop automation...');\n\n`;

    // Generate code for each action
    for (let i = 0; i < this.actions.length; i++) {
      const action = this.actions[i];
      const delay = i > 0 ? action.timestamp - this.actions[i - 1].timestamp : 0;

      // Add delay if needed
      if (delay > 100) {
        code += `  await new Promise(resolve => setTimeout(resolve, ${delay}));\n`;
      }

      // Generate action code
      code += this.generateActionCode(action);
      code += '\n';
    }

    code += `  console.log('✅ Desktop recording playback complete');\n`;
    code += `}\n\n`;
    code += `run().catch(console.error);\n`;

    return code;
  }

  /**
   * Generate code for a single action
   */
  private generateActionCode(action: DesktopAction): string {
    let code = `  // ${action.type}\n`;

    switch (action.type) {
      case 'mouseClick':
        // Skip clicks that triggered app launches (we use launch commands instead)
        if ((action as any).isAppLaunchClick) {
          code += `  // Skipping click that launched: ${(action as any).launchedApp}\n`;
          break;
        }

        if (action.coordinates) {
          code += `  await mouse.setPosition({ x: ${action.coordinates.x}, y: ${action.coordinates.y} });\n`;
          code += `  await mouse.click();\n`;
        }
        break;

      case 'mouseDoubleClick':
        if (action.coordinates) {
          code += `  await mouse.setPosition({ x: ${action.coordinates.x}, y: ${action.coordinates.y} });\n`;
          code += `  await mouse.doubleClick();\n`;
        }
        break;

      case 'mouseRightClick':
        if (action.coordinates) {
          code += `  await mouse.setPosition({ x: ${action.coordinates.x}, y: ${action.coordinates.y} });\n`;
          code += `  await mouse.rightClick();\n`;
        }
        break;

      case 'keyCombo':
        if (action.keys && action.keys.length > 0) {
          const keys = action.keys.map(k => `Key.${k}`).join(', ');
          code += `  await keyboard.type(${keys});\n`;
        }
        break;

      case 'keyType':
        if (action.text) {
          const escapedText = action.text.replace(/'/g, "\\'");
          code += `  await keyboard.type('${escapedText}');\n`;
        }
        break;

      case 'clipboardCopy':
        code += `  // Clipboard copy detected\n`;
        break;

      case 'appLaunch':
        if (action.appName) {
          code += `  // App launched: ${action.appName}`;
          if (action.windowTitle) {
            code += ` - ${action.windowTitle}`;
          }
          code += '\n';

          // Generate platform-specific launch code using full path when available
          code += `  // Launch ${action.appName}\n`;
          if (action.appPath) {
            // Use full executable path for reliability
            const escapedPath = action.appPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            if (process.platform === 'win32') {
              code += `  require('child_process').execSync('start "" "${escapedPath}"');\n`;
            } else {
              code += `  require('child_process').execSync('open "${escapedPath}"');\n`;
            }
          } else {
            // Fallback to app name if no path
            const appCmd = this.getWindowsAppCommand(action.appName);
            code += `  require('child_process').execSync('${process.platform === 'win32' ? 'start ' + appCmd : 'open -a "' + action.appName + '"'}');\n`;
          }
          code += `  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for app to launch\n`;
        }
        break;

      case 'appSwitch':
        if (action.appName) {
          code += `  // App switch: ${action.appName}\n`;

          // Generate platform-specific focus code
          if (process.platform === 'win32') {
            code += `  // Focus app using PowerShell\n`;
            code += `  await require('child_process').execSync('powershell -Command "(New-Object -ComObject WScript.Shell).AppActivate(\\"${action.appName}\\")"');\n`;
          } else if (process.platform === 'darwin') {
            code += `  // Focus app using AppleScript\n`;
            code += `  await require('child_process').execSync('osascript -e \\'tell application "${action.appName}" to activate\\'');\n`;
          }
          code += `  await new Promise(resolve => setTimeout(resolve, 1000));\n`;
        }
        break;

      case 'browserInteractionStart':
        code += `\n  // ========================================\n`;
        code += `  // 🌐 Browser: ${action.appName || 'Browser'}\n`;
        code += `  // Note: Browser clicks use coordinates (may break if layout changes)\n`;
        code += `  // ========================================\n`;
        break;

      case 'browserInteractionEnd':
        code += `  // ========================================\n`;
        code += `  // End of browser interaction\n`;
        code += `  // ========================================\n\n`;
        break;

      case 'fileDownload':
        if (action.filename && action.filePath) {
          code += `  // File downloaded: ${action.filename}\n`;
          code += `  // Path: ${action.filePath}\n`;
          if (action.fileSize) {
            code += `  // Size: ${this.formatFileSize(action.fileSize)}\n`;
          }
        }
        break;

      default:
        code += `  // Unsupported action: ${action.type}\n`;
    }

    return code;
  }

  // ==================== Event Listeners (Phase 2) ====================

  /**
   * Setup global keyboard and mouse listener using uiohook
   */
  private setupGlobalKeyboardListener(): void {
    // Check accessibility permissions on macOS (skip in dev mode - it's unreliable)
    if (process.platform === 'darwin' && process.env.NODE_ENV !== 'development') {
      const isTrusted = systemPreferences.isTrustedAccessibilityClient(false);

      if (!isTrusted) {
        console.error('[DesktopRecorder] Accessibility permissions not granted!');
        console.error('[DesktopRecorder] This app needs Accessibility permissions to capture mouse and keyboard events.');
        console.error('[DesktopRecorder] Please:');
        console.error('[DesktopRecorder]   1. Open System Settings → Privacy & Security → Accessibility');
        console.error('[DesktopRecorder]   2. Add this application to the list');
        console.error('[DesktopRecorder]   3. Restart the application completely');

        throw new Error('Accessibility permissions not granted. Please enable in System Settings and restart the app.');
      }
    }

    // In development mode, we skip the permission check and let uiohook try to start
    // If it fails, the error will be more informative
    if (process.env.NODE_ENV === 'development') {
      console.log('[DesktopRecorder] Development mode: Skipping permission check, attempting to start uiohook...');
    }

    // Start uiohook if not already started
    if (!this.uiohookStarted) {
      try {
        // Note: uIOhook.start() doesn't return a status code due to a wrapper bug
        // The underlying native lib.start() returns a status, but the wrapper doesn't return it
        // Instead, we rely on exception handling - if start() throws, it failed
        uIOhook.start();

        this.uiohookStarted = true;
        console.log('[DesktopRecorder] uiohook started successfully');
      } catch (error) {
        console.error('[DesktopRecorder] Failed to start uiohook:', error);

        // On macOS in development mode, allow the app to continue
        if (process.platform === 'darwin' && process.env.NODE_ENV === 'development') {
          console.warn('[DesktopRecorder] Continuing in macOS development mode without uiohook...');
          console.warn('[DesktopRecorder] Mouse/keyboard capture unavailable in unsigned dev builds.');
          return;
        }

        throw error;
      }
    }

    // Setup mouse click listener
    uIOhook.on('click', async (e) => {
      try {
        if (!this.isRecording || this.isPaused) return;

        // Check if click is in EGDesk (skip recording our own app)
        const activeWindow = await activeWin();
        if (activeWindow && IGNORED_APPS.has(activeWindow.owner.name)) {
          // Skip clicks in EGDesk - we don't want to record the recorder UI
          return;
        }

        // Map button: 1 = left, 2 = right, 3 = middle
        const button = e.button === MouseButton.Left ? 'left' :
                       e.button === MouseButton.Right ? 'right' : 'middle';

        this.recordMouseClick(e.x, e.y, button);
      } catch (error) {
        console.error('[DesktopRecorder] Error in click handler:', error);
      }
    });

    // Setup keyboard key down listener
    uIOhook.on('keydown', (e) => {
      try {
        if (!this.isRecording || this.isPaused) return;

        this.pressedKeys.add(e.keycode);

        // Check if this is a modifier key
        const isModifier = [
          UiohookKey.Shift, UiohookKey.ShiftL, UiohookKey.ShiftR,
          UiohookKey.Ctrl, UiohookKey.CtrlL, UiohookKey.CtrlR,
          UiohookKey.Alt, UiohookKey.AltL, UiohookKey.AltR,
          UiohookKey.Meta, UiohookKey.MetaL, UiohookKey.MetaR,
        ].includes(e.keycode);

        // Don't record solo modifier presses
        if (isModifier) return;

        // Check for hotkey combinations
        const hasShift = this.hasModifier(UiohookKey.Shift, UiohookKey.ShiftL, UiohookKey.ShiftR);
        const hasCmd = this.hasModifier(UiohookKey.Meta, UiohookKey.MetaL, UiohookKey.MetaR);
        const hasCtrl = this.hasModifier(UiohookKey.Ctrl, UiohookKey.CtrlL, UiohookKey.CtrlR);
        const hasAlt = this.hasModifier(UiohookKey.Alt, UiohookKey.AltL, UiohookKey.AltR);

        // Check for recording hotkeys (Cmd+Shift+key) - these work regardless of active app
        if (hasCmd && hasShift) {
          if (e.keycode === UiohookKey.C) {
            // Cmd+Shift+C is no longer needed - we capture real clicks now
            return;
          } else if (e.keycode === UiohookKey.P) {
            this.handlePauseResumeHotkey();
            return;
          } else if (e.keycode === UiohookKey.S) {
            this.handleStopHotkey();
            return;
          }
        }

        // Skip recording keyboard events in EGDesk (after checking hotkeys)
        if (this.lastActiveWindow && IGNORED_APPS.has(this.lastActiveWindow)) {
          return;
        }

        // Record key combinations
        if (hasCmd || hasCtrl || hasAlt || hasShift) {
        const keys: string[] = [];
        if (hasShift) keys.push('Shift');
        if (hasCmd) keys.push('Meta');
        if (hasCtrl) keys.push('Ctrl');
        if (hasAlt) keys.push('Alt');
        keys.push(this.mapKeycodeToName(e.keycode));

        this.recordKeyCombo(keys);
      } else {
        // Regular key press - buffer for typing
        const char = this.mapKeycodeToCharacter(e.keycode);
        if (char) {
          this.bufferKeyPress(char);
        }
      }
      } catch (error) {
        console.error('[DesktopRecorder] Error in keydown handler:', error);
      }
    });

    // Setup key up listener to track released keys
    uIOhook.on('keyup', (e) => {
      try {
        this.pressedKeys.delete(e.keycode);
      } catch (error) {
        console.error('[DesktopRecorder] Error in keyup handler:', error);
      }
    });

    console.log('[DesktopRecorder] ✅ Global keyboard and mouse listener setup complete');
    console.log('[DesktopRecorder] ✅ Click event listener is active - clicks will be captured');
  }

  /**
   * Check if any of the given modifier keys are pressed
   */
  private hasModifier(...keycodes: number[]): boolean {
    return keycodes.some(code => this.pressedKeys.has(code));
  }

  /**
   * Map uiohook keycode to key name
   */
  private mapKeycodeToName(keycode: number): string {
    // Common keys mapping
    const keyMap: Record<number, string> = {
      [UiohookKey.A]: 'A', [UiohookKey.B]: 'B', [UiohookKey.C]: 'C',
      [UiohookKey.D]: 'D', [UiohookKey.E]: 'E', [UiohookKey.F]: 'F',
      [UiohookKey.G]: 'G', [UiohookKey.H]: 'H', [UiohookKey.I]: 'I',
      [UiohookKey.J]: 'J', [UiohookKey.K]: 'K', [UiohookKey.L]: 'L',
      [UiohookKey.M]: 'M', [UiohookKey.N]: 'N', [UiohookKey.O]: 'O',
      [UiohookKey.P]: 'P', [UiohookKey.Q]: 'Q', [UiohookKey.R]: 'R',
      [UiohookKey.S]: 'S', [UiohookKey.T]: 'T', [UiohookKey.U]: 'U',
      [UiohookKey.V]: 'V', [UiohookKey.W]: 'W', [UiohookKey.X]: 'X',
      [UiohookKey.Y]: 'Y', [UiohookKey.Z]: 'Z',
      [UiohookKey.Enter]: 'Enter', [UiohookKey.Space]: 'Space',
      [UiohookKey.Backspace]: 'Backspace', [UiohookKey.Tab]: 'Tab',
    };

    return keyMap[keycode] || `Key${keycode}`;
  }

  /**
   * Map uiohook keycode to character for typing
   */
  private mapKeycodeToCharacter(keycode: number): string | null {
    // A-Z
    if (keycode >= UiohookKey.A && keycode <= UiohookKey.Z) {
      const char = String.fromCharCode(65 + (keycode - UiohookKey.A));
      return this.hasModifier(UiohookKey.Shift, UiohookKey.ShiftL, UiohookKey.ShiftR)
        ? char.toUpperCase()
        : char.toLowerCase();
    }

    // Special keys
    if (keycode === UiohookKey.Space) return ' ';
    if (keycode === UiohookKey.Enter) return '\n';
    if (keycode === UiohookKey.Tab) return '\t';

    // Numbers (simplified - doesn't handle shift for symbols)
    if (keycode >= UiohookKey.Digit0 && keycode <= UiohookKey.Digit9) {
      return String.fromCharCode(48 + (keycode - UiohookKey.Digit0));
    }

    return null;
  }

  /**
   * Handle Cmd+Shift+P hotkey - pause/resume recording
   */
  private handlePauseResumeHotkey(): void {
    if (this.isPaused) {
      this.resumeRecording();
    } else {
      this.pauseRecording();
    }
  }

  /**
   * Handle Cmd+Shift+S hotkey - stop recording
   */
  private handleStopHotkey(): void {
    this.stopRecording();
  }

  /**
   * Buffer a key press for typing
   */
  private bufferKeyPress(char: string): void {
    this.keySequenceBuffer.push(char);

    // Clear existing timeout
    if (this.keySequenceTimeout) {
      clearTimeout(this.keySequenceTimeout);
    }

    // Set new timeout to flush buffer after 1 second of inactivity
    this.keySequenceTimeout = setTimeout(() => {
      this.flushKeyBuffer();
    }, 1000);
  }

  /**
   * Flush key buffer and record typing action
   */
  private flushKeyBuffer(): void {
    if (this.keySequenceBuffer.length === 0) return;

    const text = this.keySequenceBuffer.join('');
    this.recordTyping(text);
    this.keySequenceBuffer = [];
  }

  /**
   * Record typing action
   */
  private recordTyping(text: string): void {
    if (!this.isRecording || this.isPaused) return;

    const action: DesktopAction = {
      type: 'keyType',
      timestamp: Date.now() - this.startTime,
      text,
    };

    this.actions.push(action);
    this.notifyUpdate();
  }

  /**
   * Setup clipboard monitoring
   */
  private setupClipboardMonitoring(): void {
    // Poll clipboard every 500ms for changes
    this.clipboardCheckInterval = setInterval(() => {
      if (!this.isRecording || this.isPaused) return;

      const current = clipboard.readText();

      // Only record if content changed and is not empty
      if (current && current !== this.lastClipboardContent) {
        this.recordClipboardChange(current);
        this.lastClipboardContent = current;
      }
    }, 500);

    console.log('[DesktopRecorder] Clipboard monitoring setup complete');
  }

  /**
   * Setup window/app monitoring
   */
  private setupWindowMonitoring(): void {
    // Skip window monitoring in development mode on macOS only - it has permission issues
    // active-win doesn't work reliably in Electron dev mode on macOS
    if (process.env.NODE_ENV === 'development' && process.platform === 'darwin') {
      console.log('[DesktopRecorder] Window monitoring disabled in macOS development mode (permission limitations)');
      console.log('[DesktopRecorder] Window monitoring will work in production builds or on Windows');
      return;
    }

    // Reset failure tracking
    this.windowMonitoringFailed = false;
    this.windowMonitoringFailCount = 0;

    // Poll active window every 1000ms
    this.windowCheckInterval = setInterval(async () => {
      if (!this.isRecording || this.isPaused) return;

      // Stop trying if we've failed too many times
      if (this.windowMonitoringFailed) return;

      try {
        const activeWindow = await activeWin();
        if (!activeWindow) return;

        const appName = activeWindow.owner.name;

        // Reset fail count on success
        this.windowMonitoringFailCount = 0;

        // Skip recording interactions with EGDesk itself
        if (IGNORED_APPS.has(appName)) {
          this.lastActiveWindow = appName;
          return;
        }

        // Check if this is a browser app
        const isBrowser = BROWSER_APPS.has(appName);

        // Detect UAC prompts (Windows only)
        if (this.uacDetectionEnabled && process.platform === 'win32') {
          this.detectUACPrompt(activeWindow.title, appName);
        }

        // Detect app launches vs switches
        if (appName !== this.lastActiveWindow) {
          // Track browser interaction state changes
          if (isBrowser && !this.currentlyInBrowser) {
            // Switched TO a browser
            this.recordBrowserInteractionStart(appName, activeWindow.title);
            this.currentlyInBrowser = true;
          } else if (!isBrowser && this.currentlyInBrowser) {
            // Switched FROM a browser to non-browser app
            this.recordBrowserInteractionEnd();
            this.currentlyInBrowser = false;
          }

          if (!this.seenApps.has(appName)) {
            // First time seeing this app - it's a launch
            this.recordAppLaunch(appName, activeWindow.owner.path, activeWindow.title);
            this.seenApps.add(appName);
          } else if (this.lastActiveWindow !== '') {
            // Already seen this app - it's a switch
            this.recordAppSwitch(appName);
          }
        }

        this.lastActiveWindow = appName;
      } catch (error: any) {
        this.windowMonitoringFailCount++;

        // Only log the first few errors to avoid spam
        if (this.windowMonitoringFailCount === 1) {
          console.warn('[DesktopRecorder] Window monitoring failed - accessibility permissions may be required');
          console.warn('[DesktopRecorder] After granting permissions, restart the app completely');
        }

        // Stop trying after 3 failures
        if (this.windowMonitoringFailCount >= 3) {
          this.windowMonitoringFailed = true;
          console.warn('[DesktopRecorder] Window monitoring disabled due to repeated failures');

          // Clear the interval to stop trying
          if (this.windowCheckInterval) {
            clearInterval(this.windowCheckInterval);
            this.windowCheckInterval = null;
          }
        }
      }
    }, 1000);

    console.log('[DesktopRecorder] Window monitoring setup initiated (requires accessibility permissions)');
  }

  /**
   * Setup download monitoring for Excel/CSV files
   */
  private setupDownloadMonitoring(): void {
    // Create recording-specific downloads folder (similar to browser recorder)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const scriptName = `egdesk-desktop-recorder-${timestamp}`;
    const baseDownloadsPath = path.join(os.homedir(), 'Downloads', 'EGDesk-Desktop');
    this.recordingDownloadsFolder = path.join(baseDownloadsPath, scriptName);

    // Create the folder
    try {
      if (!fs.existsSync(baseDownloadsPath)) {
        fs.mkdirSync(baseDownloadsPath, { recursive: true });
      }
      if (!fs.existsSync(this.recordingDownloadsFolder)) {
        fs.mkdirSync(this.recordingDownloadsFolder, { recursive: true });
      }
      console.log(`[DesktopRecorder] Created downloads folder: ${this.recordingDownloadsFolder}`);
    } catch (error: any) {
      console.error('[DesktopRecorder] Failed to create downloads folder:', error.message);
    }

    // Monitor the user's Downloads folder
    this.downloadsPath = path.join(os.homedir(), 'Downloads');

    try {
      console.log(`[DesktopRecorder] Setting up download monitoring on: ${this.downloadsPath}`);

      this.downloadWatcher = fs.watch(this.downloadsPath, { recursive: false }, (eventType, filename) => {
        if (!filename) return;
        if (!this.isRecording || this.isPaused) return;

        // Only process Excel/CSV files
        if (this.isExcelOrCsvFile(filename)) {
          this.handlePotentialDownload(filename);
        }
      });

      console.log('[DesktopRecorder] Download monitoring setup complete');
    } catch (error: any) {
      console.warn('[DesktopRecorder] Failed to setup download monitoring:', error.message);
    }
  }

  /**
   * Handle a potential file download
   */
  private async handlePotentialDownload(filename: string): Promise<void> {
    const sourceFilePath = path.join(this.downloadsPath, filename);

    // Skip if we've already processed this file
    if (this.downloadedFiles.has(filename)) {
      return;
    }

    // Also check if there's already a pending check for this file
    const pendingKey = `pending_${filename}`;
    if ((this.downloadedFiles as any)[pendingKey]) {
      return;
    }

    // Mark as pending to prevent duplicate processing
    (this.downloadedFiles as any)[pendingKey] = true;

    console.log(`[DesktopRecorder] Detected potential download: ${filename}`);

    // Wait for file stability (same pattern as FileWatcherService)
    const isStable = await this.waitForFileStability(sourceFilePath, 5000);

    // Clear pending flag
    delete (this.downloadedFiles as any)[pendingKey];

    if (isStable) {
      // Double-check we haven't processed this file while waiting
      if (this.downloadedFiles.has(filename)) {
        return;
      }

      try {
        const stats = fs.statSync(sourceFilePath);

        // Move file to recording-specific folder
        const destinationFilePath = path.join(this.recordingDownloadsFolder, filename);

        console.log(`[DesktopRecorder] Moving file from ${sourceFilePath} to ${destinationFilePath}`);
        fs.renameSync(sourceFilePath, destinationFilePath);

        const fileInfo: DownloadedFileInfo = {
          filename,
          filePath: destinationFilePath, // Use new location
          fileSize: stats.size,
          downloadedAt: new Date().toISOString(),
          timestamp: Date.now() - this.startTime,
        };

        // Track this file
        this.downloadedFiles.set(filename, fileInfo);

        // Record the download action
        this.recordFileDownload(fileInfo);

        console.log(`[DesktopRecorder] 📥 Recorded and moved download: ${filename} (${this.formatFileSize(stats.size)})`);
        console.log(`[DesktopRecorder]    New location: ${destinationFilePath}`);
      } catch (error: any) {
        console.warn(`[DesktopRecorder] Failed to process downloaded file ${filename}:`, error.message);
      }
    }
  }

  /**
   * Wait for file to stabilize (file size consistent)
   */
  private async waitForFileStability(filePath: string, maxWaitMs: number = 5000): Promise<boolean> {
    const checkInterval = 500; // Check every 500ms
    const maxChecks = Math.floor(maxWaitMs / checkInterval);
    let lastSize = -1;
    let stableChecks = 0;
    const requiredStableChecks = 2; // File size must be stable for 2 consecutive checks

    for (let i = 0; i < maxChecks; i++) {
      try {
        if (!fs.existsSync(filePath)) {
          return false;
        }

        const stats = fs.statSync(filePath);
        const currentSize = stats.size;

        if (currentSize === lastSize && currentSize > 0) {
          stableChecks++;
          if (stableChecks >= requiredStableChecks) {
            return true;
          }
        } else {
          stableChecks = 0;
        }

        lastSize = currentSize;
        await this.sleep(checkInterval);
      } catch (error) {
        return false;
      }
    }

    return false;
  }

  /**
   * Check if file is Excel or CSV
   */
  private isExcelOrCsvFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return ['.xlsx', '.xls', '.xlsm', '.csv'].includes(ext);
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  /**
   * Record file download action
   */
  private recordFileDownload(fileInfo: DownloadedFileInfo): void {
    if (!this.isRecording || this.isPaused) return;

    const action: DesktopAction = {
      type: 'fileDownload',
      timestamp: fileInfo.timestamp,
      filename: fileInfo.filename,
      filePath: fileInfo.filePath,
      fileSize: fileInfo.fileSize,
    };

    this.actions.push(action);
    this.notifyUpdate();
  }

  /**
   * Stop download monitoring
   */
  private stopDownloadMonitoring(): void {
    if (this.downloadWatcher) {
      this.downloadWatcher.close();
      this.downloadWatcher = null;
      console.log('[DesktopRecorder] Download monitoring stopped');
    }
  }

  /**
   * Setup mouse monitoring (polling-based)
   */
  private setupMouseMonitoring(): void {
    // Reset failure tracking
    this.mouseMonitoringFailed = false;
    this.mouseMonitoringFailCount = 0;

    // Poll mouse position every 500ms
    this.mouseCheckInterval = setInterval(async () => {
      if (!this.isRecording || this.isPaused) return;

      // Stop trying if we've failed too many times
      if (this.mouseMonitoringFailed) return;

      try {
        const currentPosition = await this.desktopManager.getMousePosition();
        if (!currentPosition) return;

        // Reset fail count on success
        this.mouseMonitoringFailCount = 0;

        if (this.lastMousePosition) {
          // Calculate distance moved
          const dx = currentPosition.x - this.lastMousePosition.x;
          const dy = currentPosition.y - this.lastMousePosition.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Only record significant moves (>50 pixels)
          if (distance > 50) {
            this.recordMouseMove(currentPosition.x, currentPosition.y);
          }
        }

        this.lastMousePosition = currentPosition;
      } catch (error: any) {
        this.mouseMonitoringFailCount++;

        // Only log the first error to avoid spam
        if (this.mouseMonitoringFailCount === 1) {
          console.warn('[DesktopRecorder] Mouse monitoring failed - accessibility permissions may be required');
        }

        // Stop trying after 3 failures
        if (this.mouseMonitoringFailCount >= 3) {
          this.mouseMonitoringFailed = true;
          console.warn('[DesktopRecorder] Mouse monitoring disabled due to repeated failures (use Cmd+Shift+C hotkey to mark clicks)');

          // Clear the interval to stop trying
          if (this.mouseCheckInterval) {
            clearInterval(this.mouseCheckInterval);
            this.mouseCheckInterval = null;
          }
        }
      }
    }, 500);

    console.log('[DesktopRecorder] Mouse monitoring setup initiated (requires accessibility permissions)');
  }

  /**
   * Record a mouse move action
   */
  private recordMouseMove(x: number, y: number): void {
    if (!this.isRecording || this.isPaused) return;

    const action: DesktopAction = {
      type: 'mouseMove',
      timestamp: Date.now() - this.startTime,
      coordinates: { x, y },
    };

    this.actions.push(action);
    this.notifyUpdate();
  }

  /**
   * Stop all event listeners
   */
  private stopAllListeners(): void {
    // Stop uiohook
    if (this.uiohookStarted) {
      try {
        uIOhook.stop();
        this.uiohookStarted = false;
        console.log('[DesktopRecorder] uiohook stopped');
      } catch (error) {
        console.error('[DesktopRecorder] Error stopping uiohook:', error);
      }
    }

    // Clear key sequence timeout
    if (this.keySequenceTimeout) {
      clearTimeout(this.keySequenceTimeout);
      this.keySequenceTimeout = null;
    }

    // Flush any remaining buffered keys
    this.flushKeyBuffer();

    // Stop clipboard monitoring
    if (this.clipboardCheckInterval) {
      clearInterval(this.clipboardCheckInterval);
      this.clipboardCheckInterval = null;
    }

    // Stop window monitoring
    if (this.windowCheckInterval) {
      clearInterval(this.windowCheckInterval);
      this.windowCheckInterval = null;
    }

    // Stop download monitoring
    this.stopDownloadMonitoring();

    // Disconnect Arduino if connected
    if (this.arduinoManager) {
      this.arduinoManager.disconnect().catch((err) => {
        console.error('[DesktopRecorder] Error disconnecting Arduino:', err);
      });
      this.arduinoManager = null;
    }

    // Clear pressed keys tracking
    this.pressedKeys.clear();

    console.log('[DesktopRecorder] All listeners stopped');
  }

  // ==================== Recording Helpers (Phase 2) ====================

  /**
   * Record a mouse click action
   */
  private recordMouseClick(x: number, y: number, button: 'left' | 'right' | 'middle'): void {
    if (!this.isRecording || this.isPaused) return;

    console.log(`[DesktopRecorder] 🖱️  Recorded ${button} click at (${x}, ${y})`);

    const action: DesktopAction = {
      type: button === 'left' ? 'mouseClick' : 'mouseRightClick',
      timestamp: Date.now() - this.startTime,
      coordinates: { x, y },
      button,
    };

    this.actions.push(action);
    this.notifyUpdate();
  }

  /**
   * Record a key combination
   */
  private recordKeyCombo(keys: string[]): void {
    if (!this.isRecording || this.isPaused) return;

    const action: DesktopAction = {
      type: 'keyCombo',
      timestamp: Date.now() - this.startTime,
      keys,
    };

    this.actions.push(action);
    this.notifyUpdate();
  }

  /**
   * Record app launch
   */
  private recordAppLaunch(appName: string, appPath: string, windowTitle?: string): void {
    if (!this.isRecording || this.isPaused) return;

    console.log(`[DesktopRecorder] 🚀 App launched: "${appName}" - ${windowTitle || 'untitled'}`);
    console.log(`[DesktopRecorder]    Executable path: "${appPath}"`);
    console.log(`[DesktopRecorder]    Path will be used for reliable replay`);

    const action: DesktopAction = {
      type: 'appLaunch',
      timestamp: Date.now() - this.startTime,
      appName,
      appPath, // Store full executable path
      windowTitle,
    };

    this.actions.push(action);
    this.notifyUpdate();
  }

  /**
   * Record app switch
   */
  private recordAppSwitch(appName: string): void {
    if (!this.isRecording || this.isPaused) return;

    console.log(`[DesktopRecorder] ↔️  Switched to: ${appName}`);

    const action: DesktopAction = {
      type: 'appSwitch',
      timestamp: Date.now() - this.startTime,
      appName,
    };

    this.actions.push(action);
    this.notifyUpdate();
  }

  /**
   * Record clipboard change
   */
  private recordClipboardChange(content: string): void {
    if (!this.isRecording || this.isPaused) return;

    const action: DesktopAction = {
      type: 'clipboardCopy',
      timestamp: Date.now() - this.startTime,
      clipboardContent: content,
    };

    this.actions.push(action);
    this.notifyUpdate();
  }

  /**
   * Record when user switches to a browser
   */
  private recordBrowserInteractionStart(browserName: string, url?: string): void {
    if (!this.isRecording || this.isPaused) return;

    console.log(`[DesktopRecorder] 🌐 Browser interaction START: ${browserName}${url ? ` - ${url}` : ''}`);

    const action: DesktopAction = {
      type: 'browserInteractionStart',
      timestamp: Date.now() - this.startTime,
      appName: browserName,
      windowTitle: url,
    };

    this.actions.push(action);
    this.notifyUpdate();
  }

  /**
   * Record when user switches away from a browser
   */
  private recordBrowserInteractionEnd(): void {
    if (!this.isRecording || this.isPaused) return;

    console.log(`[DesktopRecorder] 🌐 Browser interaction END`);

    const action: DesktopAction = {
      type: 'browserInteractionEnd',
      timestamp: Date.now() - this.startTime,
    };

    this.actions.push(action);
    this.notifyUpdate();
  }

  /**
   * Detect UAC (User Account Control) prompt
   * UAC runs on a secure desktop that blocks input hooking, so we need Arduino for replay
   */
  private detectUACPrompt(windowTitle: string, appName: string): void {
    // Check for UAC indicators in window title or app name
    const uacIndicators = [
      'User Account Control',
      '사용자 계정 컨트롤', // Korean
      '使用者帳戶控制',     // Chinese Traditional
      '用户帐户控制',       // Chinese Simplified
      'Controle de Conta de Usuário', // Portuguese
      'Контроль учетных записей',      // Russian
      'この app がデバイスに変更を加えることを許可しますか', // Japanese
      'Allow this app to make changes',
      '이 앱이 디바이스를 변경할 수 있도록 허용하시겠어요',
    ];

    const isUAC = uacIndicators.some(indicator =>
      windowTitle.includes(indicator) || appName.includes('consent')
    );

    if (!isUAC) return;

    // Debounce: Only record one UAC event per 2 seconds
    const now = Date.now();
    if (now - this.lastUACDetection < 2000) return;
    this.lastUACDetection = now;

    console.log(`[DesktopRecorder] 🛡️  UAC PROMPT DETECTED: "${windowTitle}"`);
    console.log(`[DesktopRecorder] ⚠️  Note: UAC clicks cannot be recorded (secure desktop)` );
    console.log(`[DesktopRecorder] 💡 Replay will require Arduino HID or manual intervention`);

    this.recordUACPrompt(windowTitle);
  }

  /**
   * Record a UAC prompt
   */
  private recordUACPrompt(promptTitle: string): void {
    if (!this.isRecording || this.isPaused) return;

    const action: DesktopAction = {
      type: 'uacPrompt',
      timestamp: Date.now() - this.startTime,
      uacPromptTitle: promptTitle,
      uacAction: 'accept', // Default assumption: user accepted it
      requiresArduino: true,
    };

    this.actions.push(action);
    this.notifyUpdate();
  }

  // ==================== Utilities ====================

  /**
   * Get all recorded actions
   */
  getActions(): DesktopAction[] {
    return [...this.actions];
  }

  /**
   * Get all downloaded files during recording
   */
  getDownloadedFiles(): DownloadedFileInfo[] {
    return Array.from(this.downloadedFiles.values());
  }

  /**
   * Get the recording-specific downloads folder path
   */
  getDownloadsFolder(): string {
    return this.recordingDownloadsFolder;
  }

  /**
   * Delete an action by index
   */
  deleteAction(index: number): void {
    if (index >= 0 && index < this.actions.length) {
      this.actions.splice(index, 1);
      this.notifyUpdate();
    }
  }

  /**
   * Set output file path
   */
  setOutputFile(filePath: string): void {
    this.outputFile = filePath;
  }

  /**
   * Set update callback for real-time code updates
   */
  setUpdateCallback(callback: (code: string) => void): void {
    this.updateCallback = callback;
  }

  /**
   * Enable UAC detection and set Arduino port for secure desktop input
   */
  enableUACDetection(arduinoPort: string): void {
    this.uacDetectionEnabled = true;
    this.arduinoPort = arduinoPort;
    console.log(`[DesktopRecorder] UAC detection enabled with Arduino on ${arduinoPort}`);
  }

  /**
   * Disable UAC detection
   */
  disableUACDetection(): void {
    this.uacDetectionEnabled = false;
    this.arduinoPort = null;
    console.log(`[DesktopRecorder] UAC detection disabled`);
  }

  /**
   * Get recording status
   */
  getStatus(): { isRecording: boolean; isPaused: boolean; actionCount: number } {
    return {
      isRecording: this.isRecording,
      isPaused: this.isPaused,
      actionCount: this.actions.length,
    };
  }

  /**
   * Notify callback with updated code
   */
  private notifyUpdate(): void {
    if (this.updateCallback) {
      const code = this.generateTestCode();
      this.updateCallback(code);
    }
  }

  /**
   * Correlate clicks with app launches
   * Marks clicks that triggered app launches so they can be skipped during replay
   */
  private correlateAppLaunchClicks(): void {
    console.log('[DesktopRecorder] Correlating app launch clicks...');

    for (let i = 0; i < this.actions.length; i++) {
      const action = this.actions[i];

      // Look for appLaunch actions
      if (action.type === 'appLaunch') {
        // Look backwards up to 3 seconds for a click that might have triggered it
        for (let j = i - 1; j >= 0; j--) {
          const prevAction = this.actions[j];

          // Stop searching if we go back more than 3 seconds
          if (action.timestamp - prevAction.timestamp > 3000) {
            break;
          }

          // If we find a mouse click within 3 seconds before the launch
          if (prevAction.type === 'mouseClick') {
            console.log(`[DesktopRecorder] Correlated click at (${prevAction.coordinates?.x}, ${prevAction.coordinates?.y}) with launch of ${action.appName}`);

            // Mark this click as a launch trigger
            (prevAction as any).isAppLaunchClick = true;
            (prevAction as any).launchedApp = action.appName;
            break; // Found the triggering click, stop looking
          }
        }
      }
    }
  }

  /**
   * Get Windows command for launching an app
   */
  private getWindowsAppCommand(appName: string): string {
    // Normalize app name for case-insensitive matching
    const normalized = appName.toLowerCase().replace('.exe', '');

    const appCommands: Record<string, string> = {
      'notepad': 'notepad',
      'calculator': 'calc',
      'calc': 'calc',
      'excel': 'excel',
      'word': 'winword',
      'powerpoint': 'powerpnt',
      'chrome': 'chrome',
      'google chrome': 'chrome',
      'edge': 'msedge',
      'microsoftedge': 'msedge',
      'explorer': 'explorer',
      'file explorer': 'explorer',
      'cmd': 'cmd',
      'powershell': 'powershell',
      'windows terminal': 'wt',
      'windowsterminal': 'wt',
      'paint': 'mspaint',
      'snipping tool': 'snippingtool',
      'firefox': 'firefox',
      'brave': 'brave',
      'opera': 'opera',
    };

    const command = appCommands[normalized] || normalized;
    console.log(`[DesktopRecorder] App name "${appName}" → command "${command}"`);
    return command;
  }

  /**
   * Launch an application
   */
  private async launchApp(appName: string, appPath?: string, windowTitle?: string): Promise<void> {
    try {
      console.log(`[DesktopRecorder] Launching app: ${appName}${windowTitle ? ` (${windowTitle})` : ''}`);

      // Platform-specific app launching
      if (process.platform === 'win32') {
        // Prefer full executable path if available (more reliable)
        if (appPath) {
          console.log(`[DesktopRecorder] Using full path: "${appPath}"`);
          console.log(`[DesktopRecorder] Executing: start "" "${appPath}"`);

          // Use spawn instead of execAsync for better handling of paths with spaces
          // start "" ensures empty window title, then the path
          const result = await execAsync(`start "" "${appPath}"`);

          if (result.stderr) {
            console.warn(`[DesktopRecorder] Launch stderr: ${result.stderr}`);
          }
          if (result.stdout) {
            console.log(`[DesktopRecorder] Launch stdout: ${result.stdout}`);
          }
        } else {
          // Fallback to app name if no path available
          const command = this.getWindowsAppCommand(appName);
          console.log(`[DesktopRecorder] No path available, using app name: ${command}`);
          console.log(`[DesktopRecorder] Executing: start ${command}`);
          const result = await execAsync(`start ${command}`);

          if (result.stderr) {
            console.warn(`[DesktopRecorder] Launch stderr: ${result.stderr}`);
          }
          if (result.stdout) {
            console.log(`[DesktopRecorder] Launch stdout: ${result.stdout}`);
          }
        }

      } else if (process.platform === 'darwin') {
        // macOS - prefer path, fallback to name
        if (appPath) {
          console.log(`[DesktopRecorder] Executing: open "${appPath}"`);
          const result = await execAsync(`open "${appPath}"`);

          if (result.stderr) {
            console.warn(`[DesktopRecorder] Launch stderr: ${result.stderr}`);
          }
        } else {
          // Fallback to app name
          console.log(`[DesktopRecorder] Executing: open -a "${appName}"`);
          const result = await execAsync(`open -a "${appName}"`);

          if (result.stderr) {
            console.warn(`[DesktopRecorder] Launch stderr: ${result.stderr}`);
          }
        }

      } else {
        console.warn(`[DesktopRecorder] App launching not supported on ${process.platform}`);
        return;
      }

      console.log(`[DesktopRecorder] ✅ App launched: ${appName}`);
    } catch (error: any) {
      console.error(`[DesktopRecorder] ❌ Failed to launch app "${appName}":`, error.message);
      console.error(`[DesktopRecorder] Error details:`, error);
      console.warn(`[DesktopRecorder] Continuing replay despite launch failure...`);
      // Don't throw - continue with replay
    }
  }

  /**
   * Focus/switch to an application
   */
  private async focusApp(appName: string): Promise<void> {
    try {
      console.log(`[DesktopRecorder] Focusing app: ${appName}`);

      if (process.platform === 'win32') {
        // Windows - use PowerShell to activate window
        const psCommand = `(New-Object -ComObject WScript.Shell).AppActivate("${appName}")`;
        await execAsync(`powershell -Command "${psCommand}"`);

      } else if (process.platform === 'darwin') {
        // macOS - use AppleScript to activate app
        const script = `tell application "${appName}" to activate`;
        await execAsync(`osascript -e '${script}'`);

      } else {
        console.warn(`[DesktopRecorder] App focusing not supported on ${process.platform}`);
      }

      console.log(`[DesktopRecorder] ✅ App focused: ${appName}`);
    } catch (error: any) {
      console.error(`[DesktopRecorder] Failed to focus app ${appName}:`, error.message);
      // Don't throw - continue with replay
    }
  }

  /**
   * Save generated code to file
   */
  private async saveToFile(code: string): Promise<void> {
    try {
      const dir = path.dirname(this.outputFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.outputFile, code, 'utf-8');
      console.log(`[DesktopRecorder] Code saved to ${this.outputFile}`);
    } catch (error: any) {
      console.error('[DesktopRecorder] Failed to save file:', error.message);
      throw error;
    }
  }
}
