/**
 * Arduino Leonardo HID session for bank native certificate dialogs (per-char + KEY: protocol).
 * Matches arduino-hid-sketch.ino (TYPE/KEY lines).
 */

let SerialPort = null;
try {
  ({ SerialPort } = require('serialport'));
} catch (e) {
  /* optional dependency */
}

class ArduinoHidBankSession {
  /**
   * @param {{ portPath: string, baudRate?: number, log?: (msg: string) => void, warn?: (msg: string) => void }} opts
   */
  constructor(opts) {
    this.portPath = opts.portPath;
    this.baudRate = opts.baudRate ?? 9600;
    this.log = opts.log || (() => {});
    this.warn = opts.warn || (() => {});
    /** @type {import('serialport').SerialPort | null} */
    this.arduino = null;
  }

  async connect() {
    if (!SerialPort) {
      throw new Error('serialport module not available. Install serialport and rebuild native deps.');
    }
    if (!this.portPath) {
      throw new Error('Arduino port not configured (financeHub.arduinoPort).');
    }
    return new Promise((resolve, reject) => {
      this.arduino = new SerialPort({ path: this.portPath, baudRate: this.baudRate });
      this.arduino.on('open', () => {
        this.log(`Arduino connected on ${this.portPath}`);
        setTimeout(() => resolve(), 2000);
      });
      this.arduino.on('error', (err) => reject(err));
      this.arduino.on('data', (data) => {
        this.log(`[Arduino] ${data.toString().trim()}`);
      });
    });
  }

  /**
   * @param {string} text
   * @param {{ minDelay?: number, maxDelay?: number }} [options]
   */
  async typeViaNaturalTiming(text, options = {}) {
    const { minDelay = 80, maxDelay = 200 } = options;
    if (!this.arduino) await this.connect();
    this.log(`Typing ${text.length} chars via Arduino HID`);
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      await new Promise((resolve, reject) => {
        this.arduino.write(char + '\n', (err) => {
          if (err) return reject(err);
          setTimeout(() => resolve(), 950);
        });
      });
      if (i < text.length - 1) {
        const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  /**
   * @param {string} keyName e.g. ENTER, TAB, ESC
   */
  async sendKey(keyName) {
    if (!this.arduino || !this.arduino.isOpen) {
      throw new Error('Arduino serial not open');
    }
    this.log(`Arduino KEY:${keyName}`);
    await new Promise((resolve, reject) => {
      this.arduino.write(`KEY:${keyName}\n`, (err) => {
        if (err) return reject(err);
        setTimeout(() => resolve(), 550);
      });
    });
  }

  async disconnect() {
    if (this.arduino && this.arduino.isOpen) {
      return new Promise((resolve) => {
        this.arduino.close(() => {
          this.log('Arduino disconnected');
          this.arduino = null;
          resolve();
        });
      });
    }
    this.arduino = null;
  }
}

module.exports = {
  ArduinoHidBankSession,
  SerialPortAvailable: () => !!SerialPort,
};
