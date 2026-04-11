/**
 * Paths and validation for EGDesk browser recorder output (*.spec.js under browser-recorder-tests).
 */
import * as path from 'path';
import { app } from 'electron';

export function getBrowserRecorderTestsDir(): string {
  const baseDir = app.isPackaged
    ? path.join(app.getPath('userData'), 'output')
    : path.join(process.cwd(), 'output');
  return path.join(baseDir, 'browser-recorder-tests');
}

/**
 * Ensure testFile is a .spec.js under the browser-recorder-tests output directory (no path escape).
 */
export function assertAllowedBrowserRecordingSpecPath(testFile: string): string {
  const resolved = path.resolve(testFile);
  if (!resolved.toLowerCase().endsWith('.spec.js')) {
    throw new Error('testFile must end with .spec.js');
  }
  const root = path.resolve(getBrowserRecorderTestsDir());
  const rel = path.relative(root, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('testFile must be inside the EGDesk browser-recorder-tests output folder');
  }
  return resolved;
}

/**
 * Absolute path under the tests dir, or a bare filename only (e.g. `clients.spec.js` in that folder).
 */
export function resolveBrowserRecordingTestFileInput(testFile: string): string {
  const t = testFile.trim();
  if (!t) {
    throw new Error('testFile is required');
  }
  if (path.isAbsolute(t)) {
    return assertAllowedBrowserRecordingSpecPath(t);
  }
  if (t.includes('..')) {
    throw new Error('testFile must not contain ..');
  }
  if (path.basename(t) !== t) {
    throw new Error(
      'Use the absolute path from list_saved_tests, or a bare filename only (e.g. clients.spec.js)'
    );
  }
  const joined = path.join(getBrowserRecorderTestsDir(), t);
  return assertAllowedBrowserRecordingSpecPath(joined);
}
