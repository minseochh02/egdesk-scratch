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
import { DesktopAutomationManager } from './utils/desktop-automation-manager';

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
  private keyboardListener: any = null;
  private clipboardCheckInterval: NodeJS.Timeout | null = null;
  private windowCheckInterval: NodeJS.Timeout | null = null;
  private lastClipboardContent: string = '';
  private lastActiveWindow: string = '';

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

    // TODO Phase 2: Setup event listeners
    // this.setupGlobalKeyboardListener();
    // this.setupClipboardMonitoring();
    // this.setupWindowMonitoring();

    console.log('[DesktopRecorder] Recording started');
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

    // TODO Phase 2: Stop event listeners
    // this.stopAllListeners();

    // Generate code
    const code = this.generateTestCode();

    // Save to file if output path specified
    if (this.outputFile) {
      await this.saveToFile(code);
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
  async replay(filePath: string): Promise<void> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Recording file not found: ${filePath}`);
    }

    // TODO Phase 3: Implement replay
    // - Read actions from file
    // - Execute each action with proper timing
    // - Handle errors gracefully

    console.log('[DesktopRecorder] Replay not yet implemented (Phase 3)');
    throw new Error('Replay functionality will be implemented in Phase 3');
  }

  /**
   * Replay a single desktop action
   */
  async replayAction(action: DesktopAction): Promise<void> {
    // TODO Phase 3: Implement action replay
    switch (action.type) {
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

      default:
        console.warn(`Action type "${action.type}" not yet supported in replay`);
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

      case 'appSwitch':
        if (action.appName) {
          code += `  // App switch: ${action.appName}\n`;
        }
        break;

      default:
        code += `  // Unsupported action: ${action.type}\n`;
    }

    return code;
  }

  // ==================== Event Listeners (Phase 2) ====================

  /**
   * Setup global keyboard listener
   * TODO Phase 2: Implement keyboard event monitoring
   */
  private setupGlobalKeyboardListener(): void {
    // Phase 2: Use node-global-key-listener or nut.js hooks
    console.log('[DesktopRecorder] Keyboard listener setup (Phase 2)');
  }

  /**
   * Setup clipboard monitoring
   * TODO Phase 2: Implement clipboard change detection
   */
  private setupClipboardMonitoring(): void {
    // Phase 2: Poll clipboard every 500ms for changes
    console.log('[DesktopRecorder] Clipboard monitoring setup (Phase 2)');
  }

  /**
   * Setup window/app monitoring
   * TODO Phase 2: Implement active window tracking
   */
  private setupWindowMonitoring(): void {
    // Phase 2: Poll active window every 1000ms
    console.log('[DesktopRecorder] Window monitoring setup (Phase 2)');
  }

  /**
   * Stop all event listeners
   */
  private stopAllListeners(): void {
    if (this.keyboardListener) {
      // TODO Phase 2: Stop keyboard listener
      this.keyboardListener = null;
    }

    if (this.clipboardCheckInterval) {
      clearInterval(this.clipboardCheckInterval);
      this.clipboardCheckInterval = null;
    }

    if (this.windowCheckInterval) {
      clearInterval(this.windowCheckInterval);
      this.windowCheckInterval = null;
    }
  }

  // ==================== Recording Helpers (Phase 2) ====================

  /**
   * Record a mouse click action
   */
  private recordMouseClick(x: number, y: number, button: 'left' | 'right' | 'middle'): void {
    if (!this.isRecording || this.isPaused) return;

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
   * Record app switch
   */
  private recordAppSwitch(appName: string): void {
    if (!this.isRecording || this.isPaused) return;

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
