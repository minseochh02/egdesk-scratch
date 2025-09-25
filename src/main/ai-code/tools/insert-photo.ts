import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';

/**
 * Move an uploaded photo into the project for later access.
 *
 * Accepts an absolute path to the uploaded photo file (source) and the
 * absolute destination file path where it should be placed. Ensures the
 * destination directory exists. Uses rename when possible, falls back to
 * copy+unlink on cross-device moves.
 */
export async function insertPhoto(sourceFilePath: string, destinationFilePath: string): Promise<{ destinationPath: string }>
{
  if (!sourceFilePath || !destinationFilePath) {
    throw new Error('Both sourceFilePath and destinationFilePath are required');
  }

  const resolvedSource = path.resolve(sourceFilePath);
  const resolvedDest = path.resolve(destinationFilePath);

  // Ensure destination directory exists
  const destDir = path.dirname(resolvedDest);
  await fsp.mkdir(destDir, { recursive: true });

  // Attempt to atomically move; fall back to copy+unlink if EXDEV
  try {
    await fsp.rename(resolvedSource, resolvedDest);
  } catch (err: any) {
    if (err && err.code === 'EXDEV') {
      // Cross-device: copy then unlink
      await new Promise<void>((resolve, reject) => {
        const read = fs.createReadStream(resolvedSource);
        const write = fs.createWriteStream(resolvedDest);
        read.on('error', reject);
        write.on('error', reject);
        write.on('close', async () => {
          try {
            await fsp.unlink(resolvedSource);
            resolve();
          } catch (unlinkErr) {
            reject(unlinkErr);
          }
        });
        read.pipe(write);
      });
    } else {
      throw err;
    }
  }

  return { destinationPath: resolvedDest };
}

/**
 * Delete a previously inserted photo by absolute file path.
 */
export async function removePhoto(filePath: string): Promise<{ success: true }>
{
  if (!filePath) {
    throw new Error('filePath is required');
  }

  const resolved = path.resolve(filePath);
  try {
    await fsp.unlink(resolved);
  } catch (err: any) {
    // If already gone, treat as success
    if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) {
      return { success: true };
    }
    throw err;
  }
  return { success: true };
}


