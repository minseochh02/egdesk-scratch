import * as fs from 'fs';

/**
 * Non-blocking append to a log file (avoids appendFileSync on the Electron main thread).
 */
export default class AsyncDebugFileLogger {
  private readonly stream: fs.WriteStream;

  constructor(filePath: string) {
    this.stream = fs.createWriteStream(filePath, { flags: 'a' });
    this.stream.on('error', (err) => console.error('[AsyncDebugFileLogger]', err));
  }

  writeLine(message: string): void {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${message}\n`;
    if (!this.stream.write(line)) {
      this.stream.once('drain', () => {});
    }
  }

  end(): void {
    try {
      this.stream.end();
    } catch {
      /* ignore */
    }
  }
}
