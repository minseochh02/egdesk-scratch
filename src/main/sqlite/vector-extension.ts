import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';

/**
 * Load the sqlite-vec extension into a database instance
 * @param db - Better-sqlite3 database instance
 * @returns true if loaded successfully, false otherwise
 */
export function loadVectorExtension(db: Database.Database): boolean {
  try {
    const loadablePath = sqliteVec.getLoadablePath();
    db.loadExtension(loadablePath);
    const version = getVectorVersion(db);
    console.log(`[Vector] ✅ sqlite-vec loaded v${version}`);
    return true;
  } catch (error) {
    console.error('[Vector] ❌ Failed to load sqlite-vec:', error);
    return false;
  }
}

/**
 * Check if vector extension is loaded and functional
 * @param db - Better-sqlite3 database instance
 * @returns true if vector support is available
 */
export function isVectorSupported(db: Database.Database): boolean {
  try {
    const result = db.prepare('SELECT vec_version()').get() as { 'vec_version()': string } | undefined;
    return !!result;
  } catch (error) {
    return false;
  }
}

/**
 * Get the version of the loaded sqlite-vec extension
 * @param db - Better-sqlite3 database instance
 * @returns version string or 'unknown'
 */
export function getVectorVersion(db: Database.Database): string {
  try {
    const result = db.prepare('SELECT vec_version()').get() as { 'vec_version()': string } | undefined;
    return result?.['vec_version()'] || 'unknown';
  } catch (error) {
    return 'unknown';
  }
}
