import { promises as fs, Dirent } from 'fs';
import path from 'path';

/**
 * BucketManager
 *
 * Filesystem-backed bucket for binary payload operations.
 * Keeps all pathing, atomic writes, and directory traversal logic centralized.
 */
export class BucketManager {
  constructor(
    private baseDir: string,
    private useHashedDirectories: boolean = true
  ) {}

  /**
   * Initialize bucket directory.
   */
  async initialize(): Promise<void> {
    await this.ensureDirectoryExists(this.baseDir);
  }

  /**
   * Write payload atomically and return final absolute path.
   */
  async put(fileId: string, data: Buffer): Promise<string> {
    const filePath = await this.resolveFilePath(fileId);

    // Atomic write: write to temp file, then rename.
    const tempPath = `${filePath}.tmp`;
    await fs.writeFile(tempPath, data);
    await fs.rename(tempPath, filePath);

    return filePath;
  }

  /**
   * Read payload bytes from bucket path.
   */
  async get(filePath: string): Promise<Buffer> {
    return fs.readFile(filePath);
  }

  /**
   * Delete payload from bucket path.
   */
  async delete(filePath: string): Promise<void> {
    await fs.unlink(filePath);
  }

  /**
   * List all file payload paths in the bucket.
   */
  async listAllFiles(): Promise<string[]> {
    const files: string[] = [];

    const walk = async (dirPath: string): Promise<void> => {
      let entries: Dirent[];
      try {
        entries = await fs.readdir(dirPath, { withFileTypes: true });
      } catch (error) {
        // Bucket directory may not exist yet in some runtime paths.
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return;
        }
        throw error;
      }

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    };

    await walk(this.baseDir);
    return files;
  }

  private async resolveFilePath(fileId: string): Promise<string> {
    if (!this.useHashedDirectories) {
      await this.ensureDirectoryExists(this.baseDir);
      return path.join(this.baseDir, fileId);
    }

    // Use first 4 chars of UUID for subdirectory (ab/cd/abcd1234...)
    const hash = fileId.replace(/-/g, '').substring(0, 4);
    const dir1 = hash.substring(0, 2);
    const dir2 = hash.substring(2, 4);
    const dirPath = path.join(this.baseDir, dir1, dir2);
    await this.ensureDirectoryExists(dirPath);
    return path.join(dirPath, fileId);
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }
}
