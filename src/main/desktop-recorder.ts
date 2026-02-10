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
import { clipboard, systemPreferences } from 'electron';
import { uIOhook, UiohookKey } from 'uiohook-napi';
import activeWin from 'active-win';

// Mouse button constants (uiohook-napi doesn't export these)
const MouseButton = {
  Left: 1,
  Right: 2,
  Middle: 3,
} as const;
import { DesktopAutomationManager } from './utils/desktop-automation-manager';

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
  };
}

/**
 * Desktop action types
 */
export interface DesktopAction {
  type: 'mouseMove' | 'mouseClick' | 'mouseDoubleClick' | 'mouseRightClick' | 'mouseDrag' |
        'keyPress' | 'keyType' | 'keyCombo' |
        'clipboardCopy' | 'clipboardPaste' | 'clipboardRead' |
        'appSwitch' | 'appLaunch' | 'windowFocus' | 'windowResize';

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
  windowTitle?: string;
  windowId?: number;
  windowBounds?: { x: number; y: number; width: number; height: number };
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

  constructor() {
    this.desktopManager = new DesktopAutomationManager();
  }

  // ==================== Recording Methods ====================

  /**
   * Start recording desktop actions
   */
  async startRecording(): Promise<void> {
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

    this.isRecording = true;
    this.isPaused = false;
    this.startTime = Date.now();
    this.actions = [];

    // Setup event listeners
    this.setupGlobalKeyboardListener(); // This now also captures mouse clicks via uiohook
    this.setupClipboardMonitoring();
    this.setupWindowMonitoring();

    console.log('[DesktopRecorder] Recording started');
    if (this.uiohookStarted) {
      console.log('[DesktopRecorder] Mouse clicks and keyboard events are now being captured');
      console.log('[DesktopRecorder] Hotkeys: Cmd+Shift+P to pause, Cmd+Shift+S to stop');
    } else {
      console.log('[DesktopRecorder] Recording clipboard and window changes (keyboard/mouse capture unavailable in dev mode)');
    }
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
        },
      };

      fs.writeFileSync(jsonPath, JSON.stringify(recordingData, null, 2), 'utf-8');
      console.log(`[DesktopRecorder] Recording data saved to ${jsonPath}`);
    }

    console.log(`[DesktopRecorder] Recording stopped. ${this.actions.length} actions recorded.`);
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

    // Replay actions with timing
    const speed = options?.speed || 1.0;
    let lastTimestamp = 0;

    for (let i = 0; i < recording.actions.length; i++) {
      const action = recording.actions[i];
      const delay = (action.timestamp - lastTimestamp) / speed;

      if (delay > 0) {
        await this.sleep(delay);
      }

      await this.replayAction(action);
      lastTimestamp = action.timestamp;
    }

    console.log('[DesktopRecorder] Replay complete');
  }

  /**
   * Sleep helper for replay timing
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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
        // TODO: Implement app launching via AppleScript (macOS) or shell commands (Windows)
        await this.sleep(2000); // Give time for app to launch
        break;

      case 'appSwitch':
        console.log(`App switch to: ${action.appName}`);
        await this.sleep(1000); // Give time for switch
        break;

      default:
        console.warn(`Action type "${action.type}" not supported in replay`);
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
          code += `  // TODO: Implement app launching logic\n`;
        }
        break;

      case 'appSwitch':
        if (action.appName) {
          code += `  // App switch: ${action.appName}\n`;
          code += `  // TODO: Focus the app window\n`;
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
    uIOhook.on('click', (e) => {
      try {
        if (!this.isRecording || this.isPaused) return;

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

      // Check for recording hotkeys (Cmd+Shift+key)
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

        // Detect app launches vs switches
        if (appName !== this.lastActiveWindow) {
          if (!this.seenApps.has(appName)) {
            // First time seeing this app - it's a launch
            this.recordAppLaunch(appName, activeWindow.title);
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
  private recordAppLaunch(appName: string, windowTitle?: string): void {
    if (!this.isRecording || this.isPaused) return;

    console.log(`[DesktopRecorder] 🚀 App launched: ${appName} - ${windowTitle || 'untitled'}`);

    const action: DesktopAction = {
      type: 'appLaunch',
      timestamp: Date.now() - this.startTime,
      appName,
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

  // ==================== Utilities ====================

  /**
   * Get all recorded actions
   */
  getActions(): DesktopAction[] {
    return [...this.actions];
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
