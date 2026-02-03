/**
 * Profile directory lifecycle management
 * Handles creation, cleanup, and organization of browser profiles
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { app } from 'electron';
import { ProfileOptions } from './types';

/**
 * Get the base directory for storing browser profiles
 * Uses {userData}/chrome-profiles with fallback to system temp
 */
export function getProfilesDirectory(): string {
  try {
    const userDataPath = app.getPath('userData');
    const profilesDir = path.join(userDataPath, 'chrome-profiles');

    // Ensure directory exists
    if (!fs.existsSync(profilesDir)) {
      fs.mkdirSync(profilesDir, { recursive: true });
    }

    return profilesDir;
  } catch (error) {
    console.warn('Failed to create profiles directory in userData, using tmpdir:', error);
    const fallbackDir = path.join(os.tmpdir(), 'egdesk-chrome-profiles');

    if (!fs.existsSync(fallbackDir)) {
      fs.mkdirSync(fallbackDir, { recursive: true });
    }

    return fallbackDir;
  }
}

/**
 * Create a unique profile directory
 *
 * @param options Profile options
 * @returns Absolute path to profile directory
 *
 * @example
 * const profileDir = createProfileDirectory({ profilePrefix: 'youtube-login' });
 * // Returns: /path/to/chrome-profiles/youtube-login-XXXXXX
 */
export function createProfileDirectory(options: ProfileOptions | string): string {
  let profilePrefix: string;
  let baseDir: string;
  let persistent: boolean;

  if (typeof options === 'string') {
    // Simple string prefix
    profilePrefix = options;
    baseDir = getProfilesDirectory();
    persistent = false;
  } else {
    // Full options object
    profilePrefix = options.profilePrefix;
    baseDir = options.baseDir || getProfilesDirectory();
    persistent = options.persistent || false;
  }

  try {
    // Ensure base directory exists
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }

    if (persistent) {
      // Persistent profile: use fixed directory name
      const profileDir = path.join(baseDir, profilePrefix);
      if (!fs.existsSync(profileDir)) {
        fs.mkdirSync(profileDir, { recursive: true });
      }
      return profileDir;
    } else {
      // Temporary profile: use unique temp directory
      const profileDir = fs.mkdtempSync(path.join(baseDir, `${profilePrefix}-`));
      return profileDir;
    }
  } catch (error) {
    console.error(`Failed to create profile directory with prefix ${profilePrefix}:`, error);
    throw error;
  }
}

/**
 * Clean up a profile directory
 * Removes the directory and all its contents
 *
 * @param profileDir Profile directory path
 * @param options Cleanup options
 */
export async function cleanupProfile(
  profileDir: string,
  options?: { force?: boolean }
): Promise<void> {
  const force = options?.force ?? true;

  try {
    if (fs.existsSync(profileDir)) {
      fs.rmSync(profileDir, { recursive: true, force });
      console.log(`✅ Cleaned up profile: ${profileDir}`);
    }
  } catch (error) {
    if (force) {
      console.warn(`⚠️ Failed to cleanup profile ${profileDir}:`, error);
    } else {
      throw error;
    }
  }
}

/**
 * Clean up old profiles that are older than specified time
 * Useful for periodic cleanup of orphaned profiles
 *
 * @param olderThanMs Age threshold in milliseconds
 * @param baseDir Base directory to scan (defaults to profiles directory)
 * @returns Number of profiles cleaned up
 */
export function cleanupOldProfiles(
  olderThanMs: number = 24 * 60 * 60 * 1000, // 24 hours default
  baseDir?: string
): number {
  const profilesDir = baseDir || getProfilesDirectory();
  let cleanedCount = 0;

  try {
    if (!fs.existsSync(profilesDir)) {
      return 0;
    }

    const entries = fs.readdirSync(profilesDir, { withFileTypes: true });
    const now = Date.now();

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const profilePath = path.join(profilesDir, entry.name);

        try {
          const stats = fs.statSync(profilePath);
          const age = now - stats.mtimeMs;

          if (age > olderThanMs) {
            fs.rmSync(profilePath, { recursive: true, force: true });
            cleanedCount++;
            console.log(`🗑️ Removed old profile: ${entry.name} (age: ${Math.round(age / 1000 / 60)} minutes)`);
          }
        } catch (error) {
          console.warn(`Failed to check/remove profile ${entry.name}:`, error);
        }
      }
    }

    if (cleanedCount > 0) {
      console.log(`✅ Cleaned up ${cleanedCount} old profile(s)`);
    }
  } catch (error) {
    console.error('Failed to cleanup old profiles:', error);
  }

  return cleanedCount;
}

/**
 * Get disk usage of profiles directory
 *
 * @param baseDir Base directory to check
 * @returns Size in bytes
 */
export function getProfilesDiskUsage(baseDir?: string): number {
  const profilesDir = baseDir || getProfilesDirectory();
  let totalSize = 0;

  try {
    if (!fs.existsSync(profilesDir)) {
      return 0;
    }

    const calculateDirSize = (dirPath: string): number => {
      let size = 0;
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        try {
          if (entry.isDirectory()) {
            size += calculateDirSize(entryPath);
          } else {
            const stats = fs.statSync(entryPath);
            size += stats.size;
          }
        } catch (error) {
          // Skip files/dirs we can't access
        }
      }

      return size;
    };

    totalSize = calculateDirSize(profilesDir);
  } catch (error) {
    console.error('Failed to calculate profiles disk usage:', error);
  }

  return totalSize;
}

/**
 * List all profiles in the profiles directory
 *
 * @param baseDir Base directory to list
 * @returns Array of profile info
 */
export function listProfiles(baseDir?: string): Array<{
  name: string;
  path: string;
  sizeBytes: number;
  createdAt: Date;
  modifiedAt: Date;
}> {
  const profilesDir = baseDir || getProfilesDirectory();
  const profiles: Array<{
    name: string;
    path: string;
    sizeBytes: number;
    createdAt: Date;
    modifiedAt: Date;
  }> = [];

  try {
    if (!fs.existsSync(profilesDir)) {
      return profiles;
    }

    const entries = fs.readdirSync(profilesDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const profilePath = path.join(profilesDir, entry.name);

        try {
          const stats = fs.statSync(profilePath);
          profiles.push({
            name: entry.name,
            path: profilePath,
            sizeBytes: 0, // Could calculate if needed
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
          });
        } catch (error) {
          console.warn(`Failed to stat profile ${entry.name}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Failed to list profiles:', error);
  }

  return profiles;
}
