/**
 * SimpleRecorder
 *
 * A lightweight recorder that only captures mouse clicks (x, y coordinates).
 * No desktop switching, keyboard capture, or other complex features.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { systemPreferences } from 'electron';
import { DesktopAutomationManager } from './utils/desktop-automation-manager';

// Native dependencies
import { uIOhook, UiohookKey } from 'uiohook-napi';

// Mouse button constants
const MouseButton = {
  Left: 1,
  Right: 2,
  Middle: 3,
} as const;

/**
 * Click action type
 */
export interface ClickAction {
  type: 'click';
  timestamp: number;
  coordinates: { x: number; y: number };
  button: 'left' | 'right' | 'middle';
}

/**
 * Recording file format
 */
export interface SimpleRecordingFile {
  version: '1.0';
  recordedAt: string;
  duration: number;
  platform: string;
  clicks: ClickAction[];
  metadata: {
    scriptName: string;
    clickCount: number;
  };
}

/**
 * SimpleRecorder class
 */
export class SimpleRecorder {
  private clicks: ClickAction[] = [];
  private isRecording: boolean = false;
  private isPaused: boolean = false;
  private startTime: number = 0;
  private outputFile: string = '';
  private updateCallback?: (code: string) => void;

  // uiohook state
  private uiohookStarted: boolean = false;

  // Desktop automation manager for replay
  private desktopManager: DesktopAutomationManager;

  constructor() {
    this.desktopManager = new DesktopAutomationManager();
  }

  // ==================== Recording Methods ====================

  /**
   * Check accessibility permissions
   */
  async checkAccessibilityPermissions(): Promise<boolean> {
    if (process.platform === 'darwin') {
      return systemPreferences.isTrustedAccessibilityClient(false);
    }
    // Windows doesn't need explicit permissions check
    return true;
  }

  /**
   * Start recording clicks
   */
  async startRecording(): Promise<void> {
    if (this.isRecording) {
      console.warn('[SimpleRecorder] Recording already in progress');
      return;
    }

    // Check permissions
    const hasPermissions = await this.checkAccessibilityPermissions();
    if (!hasPermissions) {
      throw new Error('Accessibility permissions not granted. Please enable in System Settings.');
    }

    this.isRecording = true;
    this.isPaused = false;
    this.startTime = Date.now();
    this.clicks = [];

    // Setup click listener
    this.setupClickListener();

    console.log('[SimpleRecorder] Recording started - capturing clicks only');
  }

  /**
   * Stop recording and save clicks
   */
  async stopRecording(): Promise<string> {
    if (!this.isRecording) {
      console.warn('[SimpleRecorder] No active recording');
      return '';
    }

    this.isRecording = false;
    this.isPaused = false;

    // Stop listeners
    this.stopAllListeners();

    // Generate code
    const code = this.generateCode();

    // Save to file if output path specified
    if (this.outputFile) {
      await this.saveToFile(code);

      // Also save recording data as JSON
      const jsonPath = this.outputFile.replace('.js', '.json');
      const recordingData: SimpleRecordingFile = {
        version: '1.0',
        recordedAt: new Date().toISOString(),
        duration: Date.now() - this.startTime,
        platform: process.platform,
        clicks: this.clicks,
        metadata: {
          scriptName: path.basename(this.outputFile, '.js'),
          clickCount: this.clicks.length,
        },
      };

      fs.writeFileSync(jsonPath, JSON.stringify(recordingData, null, 2), 'utf-8');
      console.log(`[SimpleRecorder] Recording data saved to ${jsonPath}`);
    }

    console.log(`[SimpleRecorder] Recording stopped. ${this.clicks.length} clicks recorded.`);
    return this.outputFile;
  }

  /**
   * Pause recording
   */
  pauseRecording(): void {
    if (!this.isRecording) {
      console.warn('[SimpleRecorder] No active recording to pause');
      return;
    }

    this.isPaused = true;
    console.log('[SimpleRecorder] Recording paused');
  }

  /**
   * Resume recording
   */
  resumeRecording(): void {
    if (!this.isRecording || !this.isPaused) {
      console.warn('[SimpleRecorder] Cannot resume recording');
      return;
    }

    this.isPaused = false;
    console.log('[SimpleRecorder] Recording resumed');
  }

  // ==================== Event Listeners ====================

  /**
   * Setup click listener using uiohook
   */
  private setupClickListener(): void {
    // Check if uiohook is available
    if (!uIOhook || !UiohookKey) {
      console.log('[SimpleRecorder] ⚠️  uiohook-napi not available - click recording disabled');
      this.uiohookStarted = false;
      return;
    }

    // Check accessibility permissions on macOS
    if (process.platform === 'darwin' && process.env.NODE_ENV !== 'development') {
      const isTrusted = systemPreferences.isTrustedAccessibilityClient(false);

      if (!isTrusted) {
        console.error('[SimpleRecorder] Accessibility permissions not granted!');
        throw new Error('Accessibility permissions not granted. Please enable in System Settings and restart the app.');
      }
    }

    // Start uiohook if not already started
    if (!this.uiohookStarted) {
      try {
        uIOhook.start();
        this.uiohookStarted = true;
        console.log('[SimpleRecorder] uiohook started successfully');
      } catch (error) {
        console.error('[SimpleRecorder] Failed to start uiohook:', error);

        // On macOS in development mode, allow the app to continue
        if (process.platform === 'darwin' && process.env.NODE_ENV === 'development') {
          console.warn('[SimpleRecorder] Continuing in macOS development mode without uiohook...');
          return;
        }

        throw error;
      }
    }

    // Setup mouse click listener
    uIOhook.on('click', async (e) => {
      try {
        if (!this.isRecording || this.isPaused) return;

        // Map button: 1 = left, 2 = right, 3 = middle
        const button = e.button === MouseButton.Left ? 'left' :
                       e.button === MouseButton.Right ? 'right' : 'middle';

        this.recordClick(e.x, e.y, button);
      } catch (error) {
        console.error('[SimpleRecorder] Error in click handler:', error);
      }
    });

    console.log('[SimpleRecorder] ✅ Click listener active');
  }

  /**
   * Record a click
   */
  private recordClick(x: number, y: number, button: 'left' | 'right' | 'middle'): void {
    if (!this.isRecording || this.isPaused) return;

    console.log(`[SimpleRecorder] 🖱️  Recorded ${button} click at (${x}, ${y})`);

    const action: ClickAction = {
      type: 'click',
      timestamp: Date.now() - this.startTime,
      coordinates: { x, y },
      button,
    };

    this.clicks.push(action);
    this.notifyUpdate();
  }

  /**
   * Stop all listeners
   */
  private stopAllListeners(): void {
    if (this.uiohookStarted) {
      try {
        uIOhook.stop();
        this.uiohookStarted = false;
        console.log('[SimpleRecorder] uiohook stopped');
      } catch (error) {
        console.error('[SimpleRecorder] Error stopping uiohook:', error);
      }
    }

    console.log('[SimpleRecorder] All listeners stopped');
  }

  // ==================== Code Generation ====================

  /**
   * Generate executable code from recorded clicks
   */
  generateCode(): string {
    const timestamp = new Date().toISOString().split('T')[0];

    let code = `// Simple Click Recording - ${timestamp}\n`;
    code += `// ${this.clicks.length} clicks recorded\n\n`;
    code += `const { mouse } = require('@nut-tree-fork/nut-js');\n\n`;
    code += `async function run() {\n`;
    code += `  console.log('Starting click automation...');\n\n`;

    // Generate code for each click
    for (let i = 0; i < this.clicks.length; i++) {
      const click = this.clicks[i];
      const delay = i > 0 ? click.timestamp - this.clicks[i - 1].timestamp : 0;

      // Add delay if needed
      if (delay > 100) {
        code += `  await new Promise(resolve => setTimeout(resolve, ${delay}));\n`;
      }

      // Generate click code
      code += `  // Click ${i + 1}: ${click.button} button at (${click.coordinates.x}, ${click.coordinates.y})\n`;
      code += `  await mouse.setPosition({ x: ${click.coordinates.x}, y: ${click.coordinates.y} });\n`;

      if (click.button === 'right') {
        code += `  await mouse.rightClick();\n`;
      } else if (click.button === 'middle') {
        code += `  await mouse.click(mouse.Button.MIDDLE);\n`;
      } else {
        code += `  await mouse.click();\n`;
      }
      code += '\n';
    }

    code += `  console.log('✅ Click recording playback complete');\n`;
    code += `}\n\n`;
    code += `run().catch(console.error);\n`;

    return code;
  }

  // ==================== Utilities ====================

  /**
   * Get all recorded clicks
   */
  getClicks(): ClickAction[] {
    return [...this.clicks];
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
  getStatus(): { isRecording: boolean; isPaused: boolean; clickCount: number } {
    return {
      isRecording: this.isRecording,
      isPaused: this.isPaused,
      clickCount: this.clicks.length,
    };
  }

  /**
   * Notify callback with updated code
   */
  private notifyUpdate(): void {
    if (this.updateCallback) {
      const code = this.generateCode();
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
      console.log(`[SimpleRecorder] Code saved to ${this.outputFile}`);
    } catch (error: any) {
      console.error('[SimpleRecorder] Failed to save file:', error.message);
      throw error;
    }
  }

  /**
   * Replay clicks from a saved file
   */
  async replay(filePath: string, options?: { speed?: number }): Promise<void> {
    const jsonPath = filePath.endsWith('.json') ? filePath : filePath.replace('.js', '.json');

    if (!fs.existsSync(jsonPath)) {
      throw new Error('Recording data (.json) not found');
    }

    const recording: SimpleRecordingFile = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    console.log(`[SimpleRecorder] Replaying ${recording.clicks.length} clicks...`);

    // Initialize desktop automation
    const initialized = await this.desktopManager.initialize();
    if (!initialized) {
      throw new Error('Failed to initialize desktop automation for replay');
    }

    const speed = options?.speed || 1.0;
    let lastTimestamp = 0;

    for (const click of recording.clicks) {
      const delay = (click.timestamp - lastTimestamp) / speed;

      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Use DesktopAutomationManager to click
      if (click.button === 'right') {
        await this.desktopManager.rightClickMouse(click.coordinates.x, click.coordinates.y);
      } else if (click.button === 'middle') {
        // Middle click not directly supported, use regular click
        await this.desktopManager.clickMouse(click.coordinates.x, click.coordinates.y, 'middle');
      } else {
        await this.desktopManager.clickMouse(click.coordinates.x, click.coordinates.y, 'left');
      }

      lastTimestamp = click.timestamp;
    }

    console.log('[SimpleRecorder] Replay complete');
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
