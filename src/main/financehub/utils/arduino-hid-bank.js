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
   */
  async typeViaNaturalTiming(text) {
    if (!this.arduino || !this.arduino.isOpen) await this.connect();
    this.log(`Typing via Arduino TYPE: command`);
    await new Promise((resolve, reject) => {
      this.arduino.write(`TYPE:${text}\n`, (err) => {
        if (err) return reject(err);
        // TYPE 명령은 내부적으로 지연시간이 있으므로 충분히 기다림
        setTimeout(() => resolve(), text.length * 500 + 1000);
      });
    });
  }

  /**
   * @param {string} keyName e.g. ENTER, TAB, ESC
   */
  async sendKey(keyName) {
    if (!this.arduino || !this.arduino.isOpen) throw new Error('Arduino serial not open');
    this.log(`Arduino KEY:${keyName}`);
    await new Promise((resolve, reject) => {
      this.arduino.write(`KEY:${keyName}\n`, (err) => {
        if (err) return reject(err);
        setTimeout(() => resolve(), 600);
      });
    });
  }

  /**
   * @param {number} x - Target screen X
   * @param {number} y - Target screen Y
   */
  async moveTo(x, y) {
    if (!this.arduino || !this.arduino.isOpen) throw new Error('Arduino serial not open');
    this.log(`Arduino Absolute Move to ${x},${y}`);
    
    // 1. 원점(0,0)으로 이동 (충분히 큰 음수 값을 여러 번 보내 구석으로 보냄)
    for (let i = 0; i < 4; i++) {
      await new Promise(r => this.arduino.write(`MOUSE_MOVE:-3000,-3000\n`, () => setTimeout(r, 100)));
    }
    
    // 2. 목적지 좌표만큼 상대 이동
    await new Promise((resolve, reject) => {
      this.arduino.write(`MOUSE_MOVE:${x},${y}\n`, (err) => {
        if (err) return reject(err);
        setTimeout(() => resolve(), 1000);
      });
    });
  }

  /**
   * @param {string} button - left, right, middle
   */
  async click(button = 'left') {
    if (!this.arduino || !this.arduino.isOpen) throw new Error('Arduino serial not open');
    const btn = button === 'L' ? 'left' : (button === 'R' ? 'right' : button);
    this.log(`Arduino MOUSE_CLICK:${btn}`);
    await new Promise((resolve, reject) => {
      this.arduino.write(`MOUSE_CLICK:${btn}\n`, (err) => {
        if (err) return reject(err);
        setTimeout(() => resolve(), 500);
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
