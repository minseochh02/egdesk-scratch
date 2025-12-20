import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Checks if Git is installed and available in the system PATH.
 */
export async function isGitInstalled(): Promise<boolean> {
  try {
    // Attempt to run git --version to verify availability
    await execAsync('git --version');
    return true;
  } catch {
    return false;
  }
}

/**
 * Standardized Git-related error codes
 */
export const GitError = {
  GIT_NOT_INSTALLED: 'GIT_NOT_INSTALLED',
  CLONE_FAILED: 'CLONE_FAILED',
  INVALID_URL: 'INVALID_URL',
} as const;

