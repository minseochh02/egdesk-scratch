/**
 * OS-Level Automation Utility
 *
 * Provides OS-level keyboard automation for handling native dialogs
 * that are outside of browser control (print dialogs, save dialogs, etc.)
 *
 * Uses @nut-tree-fork/nut-js for cross-platform support
 */

export class OSAutomation {
  private isAvailable: boolean = false;
  private actionsThisMinute: number = 0;
  private lastMinuteReset: number = Date.now();
  private nutjs: any = null; // Lazy-loaded nut.js module

  // Safety settings
  private readonly safetyChecks = {
    maxActionsPerMinute: 20, // Prevent runaway automation
    requireDialogContext: true, // Only act when dialog is expected
  };

  // Whitelisted keys that are safe to press
  private readonly safeKeys = ['Enter', 'Escape', 'Tab', 'Space', 'Left', 'Right', 'Up', 'Down'];

  constructor() {
    this.checkAvailability();
  }

  /**
   * Lazy load nut.js module
   */
  private async loadNutJS(): Promise<boolean> {
    if (this.nutjs) return true;

    try {
      this.nutjs = await import('@nut-tree-fork/nut-js');
      return true;
    } catch (error: any) {
      console.warn('⚠️ Failed to load nut.js:', error?.message || error);
      return false;
    }
  }

  /**
   * Check if OS automation is available
   */
  private async checkAvailability(): Promise<void> {
    try {
      // Try to lazy load nut.js
      const loaded = await this.loadNutJS();
      if (!loaded) {
        this.isAvailable = false;
        return;
      }

      // Test if library works
      if (this.nutjs && this.nutjs.keyboard) {
        this.isAvailable = true;
        console.log('✅ OS-level automation available');
      } else {
        this.isAvailable = false;
        console.warn('⚠️ nut.js loaded but keyboard module not available');
      }
    } catch (error: any) {
      this.isAvailable = false;
      console.warn('⚠️ OS-level automation not available:', error?.message || error);
    }
  }

  /**
   * Get availability status
   */
  public getAvailability(): boolean {
    return this.isAvailable;
  }

  /**
   * Reset rate limiting counter
   */
  private resetRateLimitIfNeeded(): void {
    const now = Date.now();
    if (now - this.lastMinuteReset > 60000) {
      this.actionsThisMinute = 0;
      this.lastMinuteReset = now;
    }
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(): boolean {
    this.resetRateLimitIfNeeded();
    return this.actionsThisMinute < this.safetyChecks.maxActionsPerMinute;
  }

  /**
   * Increment action counter
   */
  private incrementActionCounter(): void {
    this.actionsThisMinute++;
  }

  /**
   * Press a key on the OS level
   * @param key - Key name (e.g., 'Enter', 'Escape')
   * @param delayMs - Delay before pressing (wait for dialog to appear)
   * @returns Success status
   */
  async pressKey(key: string, delayMs: number = 500): Promise<boolean> {
    if (!this.isAvailable) {
      console.warn('⚠️ OS automation not available, skipping key press:', key);
      return false;
    }

    // Ensure nut.js is loaded
    const loaded = await this.loadNutJS();
    if (!loaded || !this.nutjs) {
      console.warn('⚠️ nut.js not loaded, skipping key press:', key);
      return false;
    }

    // Safety check: Only allow whitelisted keys
    if (!this.safeKeys.includes(key)) {
      console.warn('⚠️ Blocked unsafe key:', key);
      return false;
    }

    // Rate limiting
    if (!this.checkRateLimit()) {
      console.warn('⚠️ Rate limit exceeded, pausing OS automation');
      return false;
    }

    try {
      // Wait for dialog to fully appear
      await this.sleep(delayMs);

      // Map common keys to nut.js Key constants
      const { Key } = this.nutjs;
      const keyMap: Record<string, any> = {
        'Enter': Key.Enter,
        'Escape': Key.Escape,
        'Tab': Key.Tab,
        'Space': Key.Space,
        'Left': Key.Left,
        'Right': Key.Right,
        'Up': Key.Up,
        'Down': Key.Down,
      };

      const nutKey = keyMap[key];
      if (!nutKey) {
        throw new Error(`Unknown key mapping: ${key}`);
      }

      await this.nutjs.keyboard.type(nutKey);
      this.incrementActionCounter();
      console.log(`✅ OS key pressed: ${key}`);
      return true;
    } catch (error: any) {
      console.error('❌ Failed to press OS key:', error?.message || error);
      return false;
    }
  }

  /**
   * Type text on the OS level
   * @param text - Text to type
   * @param delayMs - Delay before typing
   * @returns Success status
   */
  async typeText(text: string, delayMs: number = 500): Promise<boolean> {
    if (!this.isAvailable) {
      console.warn('⚠️ OS automation not available, skipping text input:', text);
      return false;
    }

    // Ensure nut.js is loaded
    const loaded = await this.loadNutJS();
    if (!loaded || !this.nutjs) {
      console.warn('⚠️ nut.js not loaded, skipping text input:', text);
      return false;
    }

    // Rate limiting
    if (!this.checkRateLimit()) {
      console.warn('⚠️ Rate limit exceeded, pausing OS automation');
      return false;
    }

    try {
      await this.sleep(delayMs);
      await this.nutjs.keyboard.type(text);
      this.incrementActionCounter();
      console.log(`✅ OS text typed: ${text}`);
      return true;
    } catch (error: any) {
      console.error('❌ Failed to type text:', error?.message || error);
      return false;
    }
  }

  /**
   * Handle print dialog
   * Default action: Press Enter to confirm print
   * @param action - 'confirm' to press Enter, 'cancel' to press Escape
   * @param delayMs - Wait time before acting (default 1000ms)
   * @returns Success status
   */
  async handlePrintDialog(action: 'confirm' | 'cancel' = 'confirm', delayMs: number = 1000): Promise<boolean> {
    console.log(`🖨️ Handling print dialog: ${action}`);
    const key = action === 'confirm' ? 'Enter' : 'Escape';
    return await this.pressKey(key, delayMs);
  }

  /**
   * Handle save dialog
   * @param filename - Optional filename to type before saving
   * @param delayMs - Wait time before acting (default 1000ms)
   * @returns Success status
   */
  async handleSaveDialog(filename?: string, delayMs: number = 1000): Promise<boolean> {
    console.log(`💾 Handling save dialog${filename ? ` with filename: ${filename}` : ''}`);

    if (filename) {
      // Type filename
      const typeSuccess = await this.typeText(filename, delayMs);
      if (!typeSuccess) return false;

      // Wait a bit before pressing Enter
      await this.sleep(200);
    }

    // Press Enter to save
    return await this.pressKey('Enter', filename ? 500 : delayMs);
  }

  /**
   * Utility sleep function
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get statistics about OS automation usage
   */
  public getStats(): { available: boolean; actionsThisMinute: number; maxActions: number } {
    return {
      available: this.isAvailable,
      actionsThisMinute: this.actionsThisMinute,
      maxActions: this.safetyChecks.maxActionsPerMinute,
    };
  }
}
