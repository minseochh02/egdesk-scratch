/**
 * ArduinoHIDManager
 *
 * Manages communication with Arduino Leonardo/Pro Micro for HID keyboard input.
 * Used to bypass secure desktop restrictions (e.g., UAC prompts on Windows).
 *
 * Hardware Requirements:
 *   - Arduino Leonardo or Pro Micro (ATmega32U4)
 *   - Flash with arduino-hid-sketch.ino
 *   - Install: npm install serialport
 *
 * Usage:
 *   const manager = new ArduinoHIDManager('COM3');
 *   await manager.connect();
 *   await manager.typeText('password123');
 *   await manager.pressKey('RIGHT_ARROW');
 *   await manager.pressKey('ENTER');
 *   await manager.disconnect();
 */

// Optional dependency - gracefully degrade if not available
let SerialPort: any = null;
try {
  SerialPort = require('serialport').SerialPort;
} catch (error) {
  console.warn('[ArduinoHIDManager] serialport not available - Arduino features disabled');
  console.warn('[ArduinoHIDManager] To enable: npm install serialport && npm run rebuild');
}

export interface ArduinoHIDOptions {
  port: string;
  baudRate?: number;
  connectTimeout?: number;
}

export class ArduinoHIDManager {
  private port: string;
  private baudRate: number;
  private arduino: SerialPort | null = null;
  private connected: boolean = false;
  private connectTimeout: number;

  constructor(options: ArduinoHIDOptions | string) {
    if (typeof options === 'string') {
      this.port = options;
      this.baudRate = 9600;
      this.connectTimeout = 3000;
    } else {
      this.port = options.port;
      this.baudRate = options.baudRate || 9600;
      this.connectTimeout = options.connectTimeout || 3000;
    }
  }

  /**
   * List available serial ports
   */
  static async listPorts(): Promise<Array<{ path: string; manufacturer?: string }>> {
    if (!SerialPort) {
      throw new Error('serialport module not available. Install with: npm install serialport && npm run rebuild');
    }
    const ports = await SerialPort.list();
    return ports.map(p => ({
      path: p.path,
      manufacturer: p.manufacturer,
    }));
  }

  /**
   * Connect to Arduino
   */
  async connect(): Promise<void> {
    if (!SerialPort) {
      throw new Error('serialport module not available. Install with: npm install serialport && npm run rebuild');
    }

    if (this.connected) {
      console.log('[ArduinoHID] Already connected');
      return;
    }

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        reject(new Error(`Arduino connection timeout on ${this.port}`));
      }, this.connectTimeout);

      this.arduino = new SerialPort({ path: this.port, baudRate: this.baudRate });

      this.arduino.on('open', () => {
        console.log(`[ArduinoHID] Connected on ${this.port}`);
        // Give Arduino time to initialize after serial open
        setTimeout(() => {
          clearTimeout(timeoutHandle);
          this.connected = true;
          resolve();
        }, 2000);
      });

      this.arduino.on('error', (err) => {
        clearTimeout(timeoutHandle);
        reject(err);
      });

      this.arduino.on('data', (data) => {
        console.log(`[ArduinoHID] ${data.toString().trim()}`);
      });
    });
  }

  /**
   * Disconnect from Arduino
   */
  async disconnect(): Promise<void> {
    if (!this.arduino || !this.connected) return;

    return new Promise((resolve) => {
      this.arduino!.close(() => {
        console.log('[ArduinoHID] Disconnected');
        this.arduino = null;
        this.connected = false;
        resolve();
      });
    });
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected && this.arduino !== null && this.arduino.isOpen;
  }

  /**
   * Type text with natural timing
   */
  async typeText(text: string): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Arduino not connected. Call connect() first.');
    }

    return new Promise((resolve, reject) => {
      this.arduino!.write(`TYPE:${text}\n`, (err) => {
        if (err) return reject(err);
        console.log(`[ArduinoHID] Sent ${text.length} chars to type`);
        // ~603ms per char (247ms press + 356ms release) + buffer
        const typingTime = text.length * 700 + 500;
        setTimeout(() => resolve(), typingTime);
      });
    });
  }

  /**
   * Press a special key
   * Supported keys: RIGHT_ARROW, LEFT_ARROW, UP_ARROW, DOWN_ARROW, ENTER, TAB, ESC, BACKSPACE, DELETE
   */
  async pressKey(key: string): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Arduino not connected. Call connect() first.');
    }

    return new Promise((resolve, reject) => {
      this.arduino!.write(`KEY:${key}\n`, (err) => {
        if (err) return reject(err);
        console.log(`[ArduinoHID] Sent key: ${key}`);
        // Wait for Arduino to finish (press + release + buffer)
        setTimeout(() => resolve(), 400);
      });
    });
  }

  /**
   * Press a key combination
   * Examples: "CTRL+C", "ALT+F4", "CTRL+SHIFT+ESC"
   */
  async pressCombo(combo: string): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Arduino not connected. Call connect() first.');
    }

    return new Promise((resolve, reject) => {
      this.arduino!.write(`COMBO:${combo}\n`, (err) => {
        if (err) return reject(err);
        console.log(`[ArduinoHID] Sent combo: ${combo}`);
        // Wait for Arduino to finish
        setTimeout(() => resolve(), 500);
      });
    });
  }

  /**
   * Navigate UAC prompt (Right Arrow + Enter)
   * This is a common pattern to accept UAC on Windows
   */
  async acceptUAC(delay: number = 500): Promise<void> {
    console.log('[ArduinoHID] Navigating UAC prompt...');
    await this.pressKey('RIGHT_ARROW');
    await new Promise(resolve => setTimeout(resolve, delay));
    await this.pressKey('ENTER');
    console.log('[ArduinoHID] UAC accepted');
  }

  /**
   * Decline UAC prompt (Tab + Enter or just Enter on "No")
   */
  async declineUAC(delay: number = 500): Promise<void> {
    console.log('[ArduinoHID] Declining UAC prompt...');
    await this.pressKey('LEFT_ARROW'); // Move to "No"
    await new Promise(resolve => setTimeout(resolve, delay));
    await this.pressKey('ENTER');
    console.log('[ArduinoHID] UAC declined');
  }

  /**
   * Send raw command to Arduino
   */
  async sendRaw(command: string): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Arduino not connected. Call connect() first.');
    }

    return new Promise((resolve, reject) => {
      this.arduino!.write(command + '\n', (err) => {
        if (err) return reject(err);
        console.log(`[ArduinoHID] Sent raw: ${command}`);
        setTimeout(() => resolve(), 300);
      });
    });
  }
}
