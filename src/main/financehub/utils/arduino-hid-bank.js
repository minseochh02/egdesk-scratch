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

const { readPhysicalCursorPos } = require('./windows-uia-native');

const MOVE_TOL = parseInt(process.env.SHINHAN_HID_MOVE_TOL || '2', 10);
const MOVE_CAP = parseInt(process.env.SHINHAN_HID_MOVE_CAP || '400', 10);

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
   * Type one character at a time with a configurable delay between each character.
   * Use this on retry attempts so the receiving program has enough time to register each keypress.
   * @param {string} text
   * @param {number} [delayBetweenCharsMs=700] delay in ms between each character
   */
  async typeCharByChar(text, delayBetweenCharsMs = 700) {
    if (!this.arduino || !this.arduino.isOpen) await this.connect();
    this.log(`Typing char-by-char via Arduino (${delayBetweenCharsMs}ms/char, ${text.length} chars)`);
    for (const char of text) {
      await new Promise((resolve, reject) => {
        this.arduino.write(`TYPE:${char}\n`, (err) => {
          if (err) return reject(err);
          setTimeout(() => resolve(), delayBetweenCharsMs);
        });
      });
    }
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
   * @param {string} cmd
   * @param {number} settleMs
   */
  _hidWrite(cmd, settleMs) {
    return new Promise((resolve, reject) => {
      this.arduino.write(`${cmd}\n`, (err) => {
        if (err) return reject(err);
        const done = () => setTimeout(resolve, settleMs);
        if (typeof this.arduino.drain === 'function') {
          this.arduino.drain(done);
        } else {
          done();
        }
      });
    });
  }

  /**
   * Chunked relative move (±100 per command) — same as shinhan-cert-hid-click.js.
   * @param {number} dx
   * @param {number} dy
   */
  async _moveRel(dx, dy) {
    while (dx !== 0 || dy !== 0) {
      const sx = Math.max(-100, Math.min(100, dx));
      const sy = Math.max(-100, Math.min(100, dy));
      const moveMs = Math.max(Math.abs(sx), Math.abs(sy)) + 70;
      await this._hidWrite(`MOUSE_MOVE:${sx},${sy}`, moveMs);
      dx -= sx;
      dy -= sy;
    }
  }

  /**
   * Closed-loop move to absolute physical (tx, ty). Corner-reset + one MOUSE_MOVE does not
   * land on target under pointer acceleration / multi-monitor clamping (see shinhan-cert-hid-click.js).
   * @param {number} tx
   * @param {number} ty
   * @param {string} [label]
   */
  _readCursorRetry(label, tries = 4) {
    for (let t = 0; t < tries; t++) {
      const cur = readPhysicalCursorPos();
      if (cur.ok) return cur;
      if (t < tries - 1) {
        this.warn(`[${label}] cursor read retry ${t + 1}/${tries}: ${cur.error}`);
      } else {
        this.warn(`[${label}] cursor read failed: ${cur.error}`);
      }
    }
    return { ok: false, error: 'cursor_read_failed' };
  }

  async moveTo(tx, ty, label = 'target') {
    if (!this.arduino || !this.arduino.isOpen) throw new Error('Arduino serial not open');
    this.log(`Arduino closed-loop move to (${tx},${ty}) [${label}]`);

    let stepScale = 0.5;
    let lastSign = { x: 0, y: 0 };
    let moved = false;

    for (let i = 1; i <= 28; i++) {
      const cur = this._readCursorRetry(label, i === 1 ? 4 : 2);
      if (!cur.ok) {
        if (!moved) {
          throw new Error(
            `[${label}] cannot move mouse: GetCursorPos failed (${cur.error}). ` +
              'Closed-loop HID requires cursor position (see shinhan-cert-hid-click.js).'
          );
        }
        break;
      }

      const dx = tx - cur.x;
      const dy = ty - cur.y;
      const err = Math.max(Math.abs(dx), Math.abs(dy));

      if (err <= MOVE_TOL) {
        this.log(`[${label}] locked at (${cur.x},${cur.y}), err=${err}px`);
        return { x: cur.x, y: cur.y };
      }

      const curSign = { x: Math.sign(dx), y: Math.sign(dy) };
      if (
        (lastSign.x !== 0 && curSign.x !== 0 && curSign.x !== lastSign.x) ||
        (lastSign.y !== 0 && curSign.y !== 0 && curSign.y !== lastSign.y)
      ) {
        stepScale = Math.max(0.03, stepScale * 0.5);
      }
      lastSign = curSign;

      let mvx;
      let mvy;
      if (err <= 20) {
        mvx = Math.max(-2, Math.min(2, dx));
        mvy = Math.max(-2, Math.min(2, dy));
      } else {
        mvx = Math.max(-MOVE_CAP, Math.min(MOVE_CAP, Math.round(dx * stepScale)));
        mvy = Math.max(-MOVE_CAP, Math.min(MOVE_CAP, Math.round(dy * stepScale)));
        if (mvx === 0 && dx !== 0) mvx = Math.sign(dx);
        if (mvy === 0 && dy !== 0) mvy = Math.sign(dy);
      }

      this.log(`[${label}] iter ${i}: cur=(${cur.x},${cur.y}) move(${mvx},${mvy})`);
      await this._moveRel(mvx, mvy);
      moved = true;
    }

    const final = readPhysicalCursorPos();
    if (final.ok) {
      const residual = `Δ=(${tx - final.x},${ty - final.y})`;
      this.warn(`[${label}] move finished at (${final.x},${final.y}), target (${tx},${ty}) ${residual}`);
      return { x: final.x, y: final.y };
    }
    return null;
  }

  /**
   * @param {string} button - left, right, middle
   */
  async click(button = 'left') {
    if (!this.arduino || !this.arduino.isOpen) throw new Error('Arduino serial not open');
    const btn = button === 'L' ? 'left' : button === 'R' ? 'right' : button;
    this.log(`Arduino MOUSE_CLICK:${btn}`);
    await this._hidWrite(`MOUSE_CLICK:${btn}`, 350);
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
