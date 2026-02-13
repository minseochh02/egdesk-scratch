/**
 * DesktopAutomationManager
 *
 * Comprehensive wrapper around nut.js for safe desktop automation.
 * Provides mouse, keyboard, clipboard, and window management with safety features.
 *
 * Safety Features:
 * - Rate limiting to prevent runaway automation
 * - Protected screen zones (menu bar, system tray)
 * - Application whitelist
 * - Input sanitization
 * - Cross-platform compatibility
 */

import { mouse, keyboard, screen, straightTo, Point, Key, Button } from '@nut-tree-fork/nut-js';

interface SafetyConfig {
  maxActionsPerMinute: number;
  maxMouseMovesPerSecond: number;
  maxClicksPerSecond: number;
  maxKeyPressesPerSecond: number;
  cooldownAfterDangerousAction: number; // milliseconds
  enableProtectedZones: boolean;
  enableWhitelist: boolean;
}

interface ProtectedZone {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
}

interface ActionTimestamp {
  type: 'mouse' | 'click' | 'key' | 'general';
  timestamp: number;
}

export class DesktopAutomationManager {
  private config: SafetyConfig;
  private actionHistory: ActionTimestamp[] = [];
  private protectedZones: ProtectedZone[] = [];
  private whitelistedApps: string[] = [];
  private isInitialized: boolean = false;

  constructor(config?: Partial<SafetyConfig>) {
    this.config = {
      maxActionsPerMinute: 100,
      maxMouseMovesPerSecond: 10,
      maxClicksPerSecond: 5,
      maxKeyPressesPerSecond: 20,
      cooldownAfterDangerousAction: 2000,
      enableProtectedZones: true,
      enableWhitelist: false,
      ...config,
    };

    this.initializeDefaultProtectedZones();
    this.initializeDefaultWhitelist();
    this.configureMouse();
  }

  /**
   * Initialize nut.js and check permissions
   */
  async initialize(): Promise<boolean> {
    try {
      // Redirect stderr temporarily to suppress nut.js warnings
      const originalStderr = process.stderr.write;

      process.stderr.write = (chunk: any) => {
        const message = chunk.toString();
        // Suppress nut.js accessibility warnings
        if (message.includes('WARNING!') || message.includes('nut-tree/nut.js')) {
          return true;
        }
        return originalStderr.call(process.stderr, chunk);
      };

      try {
        // Test if we can access screen (requires Accessibility permissions on macOS)
        const screenSize = await screen.width();
        if (screenSize > 0) {
          this.isInitialized = true;
          return true;
        }
        return false;
      } finally {
        // Restore stderr
        process.stderr.write = originalStderr;
      }
    } catch (error: any) {
      console.error('Desktop automation initialization failed:', error.message);
      if (process.platform === 'darwin') {
        console.error('macOS requires Accessibility permissions. Please enable in System Preferences.');
      }
      return false;
    }
  }

  /**
   * Check if macOS Accessibility permissions are granted
   * Note: This will print nut.js warnings if permissions are not granted
   */
  async checkAccessibilityPermissions(): Promise<boolean> {
    if (process.platform !== 'darwin') {
      return true; // Only macOS requires Accessibility permissions
    }

    try {
      // Redirect stderr temporarily to suppress nut.js warnings
      const originalStderr = process.stderr.write;
      const suppressedMessages: string[] = [];

      process.stderr.write = (chunk: any) => {
        const message = chunk.toString();
        // Suppress nut.js accessibility warnings
        if (message.includes('WARNING!') || message.includes('nut-tree/nut.js')) {
          suppressedMessages.push(message);
          return true;
        }
        return originalStderr.call(process.stderr, chunk);
      };

      try {
        await screen.width();
        return true;
      } finally {
        // Restore stderr
        process.stderr.write = originalStderr;
      }
    } catch {
      return false;
    }
  }

  // ==================== Mouse Control ====================

  /**
   * Configure mouse settings for smoother movement
   */
  private configureMouse(): void {
    try {
      mouse.config.mouseSpeed = 1000; // pixels per second
      mouse.config.autoDelayMs = 100; // delay between actions
    } catch (error) {
      console.warn('Failed to configure mouse:', error);
    }
  }

  /**
   * Move mouse to coordinates
   */
  async moveMouse(x: number, y: number): Promise<boolean> {
    try {
      if (!this.canPerformAction('mouse')) {
        console.warn('Rate limit exceeded for mouse movement');
        return false;
      }

      if (this.isInProtectedZone(x, y)) {
        console.warn(`Coordinates (${x}, ${y}) are in a protected zone`);
        return false;
      }

      await mouse.setPosition(new Point(x, y));
      this.recordAction('mouse');
      return true;
    } catch (error: any) {
      console.error('Failed to move mouse:', error.message);
      return false;
    }
  }

  /**
   * Click mouse at current position or specified coordinates
   */
  async clickMouse(x?: number, y?: number, button: 'left' | 'right' | 'middle' = 'left'): Promise<boolean> {
    try {
      if (!this.canPerformAction('click')) {
        console.warn('Rate limit exceeded for mouse clicks');
        return false;
      }

      // Move to position if coordinates provided
      if (x !== undefined && y !== undefined) {
        const moveSuccess = await this.moveMouse(x, y);
        if (!moveSuccess) {
          return false;
        }
        // Small delay to ensure mouse is in position
        await this.sleep(50);
      }

      // Determine button
      let nutButton: Button;
      switch (button) {
        case 'left':
          nutButton = Button.LEFT;
          break;
        case 'right':
          nutButton = Button.RIGHT;
          break;
        case 'middle':
          nutButton = Button.MIDDLE;
          break;
        default:
          nutButton = Button.LEFT;
      }

      await mouse.click(nutButton);
      this.recordAction('click');
      return true;
    } catch (error: any) {
      console.error('Failed to click mouse:', error.message);
      return false;
    }
  }

  /**
   * Double-click mouse
   */
  async doubleClickMouse(x?: number, y?: number): Promise<boolean> {
    try {
      if (!this.canPerformAction('click')) {
        console.warn('Rate limit exceeded for mouse clicks');
        return false;
      }

      if (x !== undefined && y !== undefined) {
        const moveSuccess = await this.moveMouse(x, y);
        if (!moveSuccess) {
          return false;
        }
        await this.sleep(50);
      }

      await mouse.doubleClick(Button.LEFT);
      this.recordAction('click');
      return true;
    } catch (error: any) {
      console.error('Failed to double-click mouse:', error.message);
      return false;
    }
  }

  /**
   * Right-click mouse
   */
  async rightClickMouse(x?: number, y?: number): Promise<boolean> {
    return this.clickMouse(x, y, 'right');
  }

  /**
   * Drag mouse from start to end coordinates
   */
  async dragAndDrop(startX: number, startY: number, endX: number, endY: number): Promise<boolean> {
    try {
      if (!this.canPerformAction('mouse')) {
        console.warn('Rate limit exceeded for mouse actions');
        return false;
      }

      // Move to start position
      await this.moveMouse(startX, startY);
      await this.sleep(100);

      // Press and hold
      await mouse.pressButton(Button.LEFT);
      await this.sleep(100);

      // Drag to end position
      await mouse.setPosition(new Point(endX, endY));
      await this.sleep(100);

      // Release
      await mouse.releaseButton(Button.LEFT);

      this.recordAction('mouse');
      return true;
    } catch (error: any) {
      console.error('Failed to drag and drop:', error.message);
      return false;
    }
  }

  /**
   * Scroll mouse wheel
   */
  async scrollMouse(amount: number): Promise<boolean> {
    try {
      if (!this.canPerformAction('mouse')) {
        console.warn('Rate limit exceeded for mouse actions');
        return false;
      }

      await mouse.scrollUp(amount);
      this.recordAction('mouse');
      return true;
    } catch (error: any) {
      console.error('Failed to scroll mouse:', error.message);
      return false;
    }
  }

  // ==================== Keyboard Control ====================

  /**
   * Type text with optional delay between characters
   */
  async typeText(text: string, delayMs: number = 50): Promise<boolean> {
    try {
      if (!this.canPerformAction('key')) {
        console.warn('Rate limit exceeded for keyboard actions');
        return false;
      }

      // Sanitize input (remove control characters except newlines)
      const sanitized = text.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

      await keyboard.type(sanitized);
      this.recordAction('key');
      return true;
    } catch (error: any) {
      console.error('Failed to type text:', error.message);
      return false;
    }
  }

  /**
   * Press a single key
   */
  async pressKey(key: string): Promise<boolean> {
    try {
      if (!this.canPerformAction('key')) {
        console.warn('Rate limit exceeded for keyboard actions');
        return false;
      }

      const nutKey = this.mapKeyToNutJs(key);
      if (!nutKey) {
        console.warn(`Key "${key}" not supported`);
        return false;
      }

      await keyboard.type(nutKey);
      this.recordAction('key');
      return true;
    } catch (error: any) {
      console.error('Failed to press key:', error.message);
      return false;
    }
  }

  /**
   * Press key combination (e.g., Cmd+C, Ctrl+V)
   */
  async pressKeyCombo(keys: string[]): Promise<boolean> {
    try {
      if (!this.canPerformAction('key')) {
        console.warn('Rate limit exceeded for keyboard actions');
        return false;
      }

      const nutKeys = keys.map(k => this.mapKeyToNutJs(k)).filter(k => k !== null) as any[];
      if (nutKeys.length !== keys.length) {
        console.warn('Some keys in combo are not supported');
        return false;
      }

      await keyboard.type(...nutKeys);
      this.recordAction('key');
      return true;
    } catch (error: any) {
      console.error('Failed to press key combo:', error.message);
      return false;
    }
  }

  /**
   * Map key name to nut.js Key enum
   */
  private mapKeyToNutJs(keyName: string): any | null {
    const keyMap: Record<string, any> = {
      // Modifiers
      'Command': Key.LeftCmd,
      'Control': Key.LeftControl,
      'Alt': Key.LeftAlt,
      'Shift': Key.LeftShift,
      'Super': Key.LeftSuper,
      'Meta': Key.LeftCmd,

      // Special keys
      'Enter': Key.Enter,
      'Return': Key.Enter,
      'Tab': Key.Tab,
      'Space': Key.Space,
      'Backspace': Key.Backspace,
      'Delete': Key.Delete,
      'Escape': Key.Escape,
      'Esc': Key.Escape,

      // Function keys
      'F1': Key.F1, 'F2': Key.F2, 'F3': Key.F3, 'F4': Key.F4,
      'F5': Key.F5, 'F6': Key.F6, 'F7': Key.F7, 'F8': Key.F8,
      'F9': Key.F9, 'F10': Key.F10, 'F11': Key.F11, 'F12': Key.F12,

      // Arrow keys
      'Up': Key.Up,
      'Down': Key.Down,
      'Left': Key.Left,
      'Right': Key.Right,

      // Single characters (a-z, 0-9)
      'A': Key.A, 'B': Key.B, 'C': Key.C, 'D': Key.D, 'E': Key.E,
      'F': Key.F, 'G': Key.G, 'H': Key.H, 'I': Key.I, 'J': Key.J,
      'K': Key.K, 'L': Key.L, 'M': Key.M, 'N': Key.N, 'O': Key.O,
      'P': Key.P, 'Q': Key.Q, 'R': Key.R, 'S': Key.S, 'T': Key.T,
      'U': Key.U, 'V': Key.V, 'W': Key.W, 'X': Key.X, 'Y': Key.Y,
      'Z': Key.Z,
    };

    return keyMap[keyName] || null;
  }

  // ==================== Safety Features ====================

  /**
   * Check if action can be performed based on rate limits
   */
  private canPerformAction(type: 'mouse' | 'click' | 'key' | 'general'): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const oneSecondAgo = now - 1000;

    // Clean up old actions
    this.actionHistory = this.actionHistory.filter(a => a.timestamp > oneMinuteAgo);

    // Check general rate limit (actions per minute)
    if (this.actionHistory.length >= this.config.maxActionsPerMinute) {
      return false;
    }

    // Check specific rate limits (actions per second)
    const recentActions = this.actionHistory.filter(a => a.timestamp > oneSecondAgo && a.type === type);

    switch (type) {
      case 'mouse':
        return recentActions.length < this.config.maxMouseMovesPerSecond;
      case 'click':
        return recentActions.length < this.config.maxClicksPerSecond;
      case 'key':
        return recentActions.length < this.config.maxKeyPressesPerSecond;
      default:
        return true;
    }
  }

  /**
   * Record an action for rate limiting
   */
  private recordAction(type: 'mouse' | 'click' | 'key' | 'general'): void {
    this.actionHistory.push({
      type,
      timestamp: Date.now(),
    });
  }

  /**
   * Check if coordinates are in a protected zone
   */
  private isInProtectedZone(x: number, y: number): boolean {
    if (!this.config.enableProtectedZones) {
      return false;
    }

    return this.protectedZones.some(zone => {
      return x >= zone.x &&
             x <= zone.x + zone.width &&
             y >= zone.y &&
             y <= zone.y + zone.height;
    });
  }

  /**
   * Initialize default protected zones (menu bar, corners, etc.)
   */
  private initializeDefaultProtectedZones(): void {
    if (process.platform === 'darwin') {
      // macOS menu bar
      this.protectedZones.push({
        x: 0,
        y: 0,
        width: 9999,
        height: 25,
        name: 'Menu Bar',
      });

      // Top-right corner (notification center)
      this.protectedZones.push({
        x: 9900,
        y: 0,
        width: 100,
        height: 100,
        name: 'Notification Center',
      });
    }
  }

  /**
   * Initialize default application whitelist
   */
  private initializeDefaultWhitelist(): void {
    this.whitelistedApps = [
      // macOS
      'TextEdit', 'Notes', 'Calculator', 'Terminal', 'iTerm',
      // Windows
      'notepad.exe', 'calc.exe', 'cmd.exe',
      // Cross-platform
      'Code', 'Visual Studio Code', 'Chrome', 'Firefox', 'Safari',
    ];
  }

  /**
   * Add application to whitelist
   */
  addToWhitelist(appName: string): void {
    if (!this.whitelistedApps.includes(appName)) {
      this.whitelistedApps.push(appName);
    }
  }

  /**
   * Check if application is whitelisted
   */
  isAppWhitelisted(appName: string): boolean {
    if (!this.config.enableWhitelist) {
      return true;
    }
    return this.whitelistedApps.some(app =>
      appName.toLowerCase().includes(app.toLowerCase())
    );
  }

  // ==================== Utility Methods ====================

  /**
   * Sleep for specified milliseconds
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Safely execute key combinations with proper press/release sequencing
   * This prevents keys from getting stuck
   */
  private async safeKeyCombo(keys: any[]): Promise<void> {
    try {
      // Press all keys in sequence
      for (const key of keys) {
        await keyboard.pressKey(key);
        await this.sleep(10); // Small delay between key presses
      }
      
      // Small delay while keys are held
      await this.sleep(50);
      
      // Release all keys in reverse order
      for (let i = keys.length - 1; i >= 0; i--) {
        await keyboard.releaseKey(keys[i]);
        await this.sleep(10); // Small delay between key releases
      }
      
      // Additional safety delay to ensure all keys are released
      await this.sleep(100);
      
    } catch (error: any) {
      console.error('[DesktopAutomation] Error in safeKeyCombo, attempting emergency key release:', error.message);
      
      // Emergency release - try to release all common modifier keys
      try {
        await keyboard.releaseKey(Key.LeftWin);
        await keyboard.releaseKey(Key.LeftControl);
        await keyboard.releaseKey(Key.LeftAlt);
        await keyboard.releaseKey(Key.LeftShift);
        await this.sleep(100);
      } catch (releaseError: any) {
        console.error('[DesktopAutomation] Emergency key release failed:', releaseError.message);
      }
      
      throw error;
    }
  }

  /**
   * Get current mouse position
   */
  async getMousePosition(): Promise<{ x: number; y: number } | null> {
    // Redirect stderr temporarily to suppress nut.js warnings
    const originalStderr = process.stderr.write;

    process.stderr.write = (chunk: any) => {
      const message = chunk.toString();
      // Suppress nut.js accessibility warnings
      if (message.includes('WARNING!') || message.includes('nut-tree/nut.js')) {
        return true;
      }
      return originalStderr.call(process.stderr, chunk);
    };

    try {
      const position = await mouse.getPosition();
      return { x: position.x, y: position.y };
    } catch (error: any) {
      console.error('Failed to get mouse position:', error.message);
      return null;
    } finally {
      // Restore stderr
      process.stderr.write = originalStderr;
    }
  }

  /**
   * Get screen size
   */
  async getScreenSize(): Promise<{ width: number; height: number } | null> {
    // Redirect stderr temporarily to suppress nut.js warnings
    const originalStderr = process.stderr.write;

    process.stderr.write = (chunk: any) => {
      const message = chunk.toString();
      // Suppress nut.js accessibility warnings
      if (message.includes('WARNING!') || message.includes('nut-tree/nut.js')) {
        return true;
      }
      return originalStderr.call(process.stderr, chunk);
    };

    try {
      const width = await screen.width();
      const height = await screen.height();
      return { width, height };
    } catch (error: any) {
      console.error('Failed to get screen size:', error.message);
      return null;
    } finally {
      // Restore stderr
      process.stderr.write = originalStderr;
    }
  }

  /**
   * Reset rate limiting history
   */
  resetRateLimits(): void {
    this.actionHistory = [];
  }

  /**
   * Get configuration
   */
  getConfig(): SafetyConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SafetyConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ==================== Virtual Desktop Control (Windows) ====================

  /**
   * Create a new virtual desktop
   * Windows: Win+Ctrl+D
   * macOS: Ctrl+Up → Click + button
   */
  async createVirtualDesktop(): Promise<boolean> {
    try {
      if (process.platform === 'win32') {
        // Use safer key combo approach with explicit delays
        await this.safeKeyCombo([Key.LeftWin, Key.LeftControl, Key.D]);
        console.log('[DesktopAutomation] Created new virtual desktop (Windows)');
        return true;
      } else if (process.platform === 'darwin') {
        console.log('[DesktopAutomation] Creating new Space via Mission Control...');

        // Step 1: Open Mission Control (Ctrl + Up)
        await this.safeKeyCombo([Key.LeftControl, Key.Up]);

        // Wait for Mission Control to open
        await new Promise(resolve => setTimeout(resolve, 800));

        // Step 2: Get screen dimensions
        const screenSize = await screen.width().then(async (width) => {
          const height = await screen.height();
          return { width, height };
        });

        // Step 3: Move mouse to top-right corner where + button appears
        // The + button is usually at about 95% of screen width, 5% of screen height
        const plusButtonX = Math.floor(screenSize.width * 0.95);
        const plusButtonY = Math.floor(screenSize.height * 0.05);

        console.log(`[DesktopAutomation] Moving mouse to + button at (${plusButtonX}, ${plusButtonY})`);
        await mouse.setPosition(new Point(plusButtonX, plusButtonY));

        // Wait a moment for button to appear
        await new Promise(resolve => setTimeout(resolve, 300));

        // Step 4: Click the + button
        await mouse.click(Button.LEFT);

        // Wait for new Space to be created and switched to
        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log('[DesktopAutomation] Created new Space (macOS)');
        return true;
      } else {
        console.warn('Virtual desktop creation only supported on Windows and macOS');
        return false;
      }
    } catch (error: any) {
      console.error('Failed to create virtual desktop:', error.message);
      return false;
    }
  }

  /**
   * Switch to next virtual desktop
   * Windows: Win+Ctrl+Right
   * macOS: Ctrl+Right
   */
  async switchToNextDesktop(): Promise<boolean> {
    try {
      if (process.platform === 'win32') {
        await this.safeKeyCombo([Key.LeftWin, Key.LeftControl, Key.Right]);
        console.log('[DesktopAutomation] Switched to next virtual desktop (Windows)');
        return true;
      } else if (process.platform === 'darwin') {
        await this.safeKeyCombo([Key.LeftControl, Key.Right]);
        console.log('[DesktopAutomation] Switched to next virtual desktop (macOS)');
        return true;
      } else {
        console.warn('Virtual desktop switching not supported on this platform');
        return false;
      }
    } catch (error: any) {
      console.error('Failed to switch to next desktop:', error.message);
      return false;
    }
  }

  /**
   * Switch to previous virtual desktop
   * Windows: Win+Ctrl+Left
   * macOS: Ctrl+Left
   */
  async switchToPreviousDesktop(): Promise<boolean> {
    try {
      if (process.platform === 'win32') {
        await this.safeKeyCombo([Key.LeftWin, Key.LeftControl, Key.Left]);
        console.log('[DesktopAutomation] Switched to previous virtual desktop (Windows)');
        return true;
      } else if (process.platform === 'darwin') {
        await this.safeKeyCombo([Key.LeftControl, Key.Left]);
        console.log('[DesktopAutomation] Switched to previous virtual desktop (macOS)');
        return true;
      } else {
        console.warn('Virtual desktop switching not supported on this platform');
        return false;
      }
    } catch (error: any) {
      console.error('Failed to switch to previous desktop:', error.message);
      return false;
    }
  }

  /**
   * Close current virtual desktop
   * Windows: Win+Ctrl+F4
   * macOS: Mission Control → Hover → Click X
   */
  async closeCurrentDesktop(): Promise<boolean> {
    try {
      if (process.platform === 'win32') {
        await this.safeKeyCombo([Key.LeftWin, Key.LeftControl, Key.F4]);
        console.log('[DesktopAutomation] Closed current virtual desktop (Windows)');
        return true;
      } else if (process.platform === 'darwin') {
        console.log('[DesktopAutomation] Closing current Space via Mission Control...');

        // Step 1: Open Mission Control (Ctrl + Up)
        await this.safeKeyCombo([Key.LeftControl, Key.Up]);

        // Wait for Mission Control to open
        await new Promise(resolve => setTimeout(resolve, 800));

        // Step 2: Get screen dimensions
        const screenSize = await screen.width().then(async (width) => {
          const height = await screen.height();
          return { width, height };
        });

        // Step 3: The current Space is typically highlighted in the center top area
        // Hover over it to make the X button appear
        // Spaces are shown in a row at the top, current one is usually centered
        const centerX = Math.floor(screenSize.width * 0.5);
        const spacesY = Math.floor(screenSize.height * 0.1); // Top 10% of screen

        console.log(`[DesktopAutomation] Hovering over current Space at (${centerX}, ${spacesY})`);
        await mouse.setPosition(new Point(centerX, spacesY));

        // Wait for X button to appear
        await new Promise(resolve => setTimeout(resolve, 500));

        // Step 4: The X button appears in the top-left corner of the hovered space
        // Usually about 20-30px to the left and slightly up from center
        const xButtonX = centerX - 80; // X is to the left of the space thumbnail
        const xButtonY = spacesY - 20; // X is above the space thumbnail

        console.log(`[DesktopAutomation] Clicking X button at (${xButtonX}, ${xButtonY})`);
        await mouse.setPosition(new Point(xButtonX, xButtonY));

        await new Promise(resolve => setTimeout(resolve, 200));
        await mouse.click(Button.LEFT);

        // Wait for Space to close
        await new Promise(resolve => setTimeout(resolve, 800));

        console.log('[DesktopAutomation] Closed current Space (macOS)');
        return true;
      } else {
        console.warn('Virtual desktop closing not supported on this platform');
        return false;
      }
    } catch (error: any) {
      console.error('Failed to close current desktop:', error.message);
      return false;
    }
  }

  /**
   * Open Task View to see all virtual desktops (Windows: Win+Tab)
   */
  async openTaskView(): Promise<boolean> {
    try {
      if (process.platform !== 'win32') {
        console.warn('Task View only supported on Windows');
        return false;
      }

      await this.safeKeyCombo([Key.LeftWin, Key.Tab]);
      console.log('[DesktopAutomation] Opened Task View');
      return true;
    } catch (error: any) {
      console.error('Failed to open Task View:', error.message);
      return false;
    }
  }

  /**
   * Move a window to a virtual desktop using PowerShell COM API (Windows only)
   * Note: This uses undocumented Windows APIs and may break in future Windows versions
   */
  async moveWindowToDesktop(windowTitle: string, desktopNumber: number): Promise<boolean> {
    try {
      if (process.platform !== 'win32') {
        console.warn('Moving windows between desktops only supported on Windows');
        return false;
      }

      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      // PowerShell script using IVirtualDesktopManager COM interface
      const psScript = `
        Add-Type @"
          using System;
          using System.Runtime.InteropServices;
          public class VirtualDesktopHelper {
            [DllImport("user32.dll")]
            public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

            [ComImport, Guid("a5cd92ff-29be-454c-8d04-d82879fb3f1b")]
            [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
            public interface IVirtualDesktopManager {
              bool IsWindowOnCurrentVirtualDesktop(IntPtr topLevelWindow);
              Guid GetWindowDesktopId(IntPtr topLevelWindow);
              void MoveWindowToDesktop(IntPtr topLevelWindow, ref Guid desktopId);
            }
          }
"@

        # This is a simplified version - full implementation would require desktop enumeration
        Write-Host "Note: Full window movement requires additional COM interfaces not exposed here"
        Write-Host "Consider using the 'spawn on new desktop' approach instead"
      `;

      await execAsync(`powershell -Command "${psScript.replace(/"/g, '\\"')}"`);

      console.log('[DesktopAutomation] Note: Direct window movement not fully supported');
      console.log('[DesktopAutomation] Recommendation: Create windows after switching to target desktop');
      return false;
    } catch (error: any) {
      console.error('Failed to move window to desktop:', error.message);
      return false;
    }
  }

  /**
   * Helper: Create new desktop and switch to it, ready for spawning windows
   */
  async createAndSwitchToNewDesktop(): Promise<boolean> {
    try {
      // Use the createVirtualDesktop method which now supports both platforms
      const success = await this.createVirtualDesktop();

      if (success) {
        console.log('[DesktopAutomation] New windows will spawn on this desktop');
      }

      return success;
    } catch (error: any) {
      console.error('Failed to create and switch to new desktop:', error.message);
      return false;
    }
  }

  /**
   * Helper: Switch back to original desktop and close the recording desktop
   * This prevents accumulation of unused virtual desktops
   */
  async switchBackAndCleanup(): Promise<boolean> {
    try {
      console.log('[DesktopAutomation] Switching back to original desktop and cleaning up');

      // Step 1: Switch back to previous desktop
      await this.switchToPreviousDesktop();

      // Wait for switch animation
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 2: Close the recording desktop
      if (process.platform === 'win32') {
        // Switch to next (recording) desktop temporarily
        await this.switchToNextDesktop();
        await new Promise(resolve => setTimeout(resolve, 300));

        // Close it
        await this.closeCurrentDesktop();

        console.log('[DesktopAutomation] Cleaned up recording desktop (Windows)');
      } else if (process.platform === 'darwin') {
        // Switch to next (recording) Space temporarily
        await this.switchToNextDesktop();
        await new Promise(resolve => setTimeout(resolve, 500));

        // Close it using Mission Control
        await this.closeCurrentDesktop();

        console.log('[DesktopAutomation] Cleaned up recording Space (macOS)');
      }

      return true;
    } catch (error: any) {
      console.error('Failed to switch back and cleanup:', error.message);
      return false;
    }
  }
}
