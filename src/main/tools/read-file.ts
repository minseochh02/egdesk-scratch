import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ipcMain, dialog } from 'electron';

/**
 * Parameters for the ReadFile tool
 */
export interface ReadFileToolParams {
  /**
   * The absolute path to the file to read
   */
  absolute_path: string;

  /**
   * The line number to start reading from (optional)
   */
  offset?: number;

  /**
   * The number of lines to read (optional)
   */
  limit?: number;
}

/**
 * Result of file reading operation
 */
export interface ReadFileResult {
  success: boolean;
  content?: string;
  error?: string;
  isTruncated?: boolean;
  totalLines?: number;
  linesShown?: [number, number];
  mimetype?: string;
  fileSize?: number;
}

/**
 * Result of file info operation
 */
export interface FileInfoResult {
  exists: boolean;
  size?: number;
  isDirectory?: boolean;
  mimetype?: string;
  error?: string;
}

/**
 * ReadFile tool implementation for Electron.js Main Process
 * This runs in the Node.js environment and has full file system access
 */
export class ReadFileTool {
  static readonly Name: string = 'read_file';

  /**
   * Read file content with support for offset and limit
   */
  static async readFile(params: ReadFileToolParams): Promise<ReadFileResult> {
    try {
      // Validate parameters
      const validationError = this.validateParams(params);
      if (validationError) {
        return {
          success: false,
          error: validationError
        };
      }

      // Check if file exists
      if (!fs.existsSync(params.absolute_path)) {
        return {
          success: false,
          error: `File does not exist: ${params.absolute_path}`
        };
      }

      // Get file stats
      const stats = fs.statSync(params.absolute_path);
      if (stats.isDirectory()) {
        return {
          success: false,
          error: `Path is a directory, not a file: ${params.absolute_path}`
        };
      }

      // Read file content
      const content = fs.readFileSync(params.absolute_path, 'utf8');
      const lines = content.split('\n');
      const totalLines = lines.length;

      // Apply offset and limit if provided
      let finalContent = content;
      let isTruncated = false;
      let linesShown: [number, number] | undefined;

      if (params.offset !== undefined || params.limit !== undefined) {
        const startLine = params.offset || 0;
        const endLine = params.limit ? startLine + params.limit : totalLines;
        const actualEndLine = Math.min(endLine, totalLines);
        
        const selectedLines = lines.slice(startLine, actualEndLine);
        finalContent = selectedLines.join('\n');
        isTruncated = actualEndLine < totalLines;
        linesShown = [startLine + 1, actualEndLine]; // Convert to 1-based for display
      }

      // Get MIME type
      const mimetype = this.getMimeType(params.absolute_path);

      return {
        success: true,
        content: finalContent,
        isTruncated,
        totalLines,
        linesShown,
        mimetype,
        fileSize: stats.size
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get file info without reading content
   */
  static async getFileInfo(filePath: string): Promise<FileInfoResult> {
    try {
      const validationError = this.validateParams({ absolute_path: filePath });
      if (validationError) {
        return {
          exists: false,
          error: validationError
        };
      }

      if (!fs.existsSync(filePath)) {
        return {
          exists: false,
          error: `File does not exist: ${filePath}`
        };
      }

      const stats = fs.statSync(filePath);
      const mimetype = this.getMimeType(filePath);

      return {
        exists: true,
        size: stats.size,
        isDirectory: stats.isDirectory(),
        mimetype
      };
    } catch (error) {
      return {
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Validate read file parameters
   */
  private static validateParams(params: ReadFileToolParams): string | null {
    const filePath = params.absolute_path;
    
    if (!filePath || filePath.trim() === '') {
      return "The 'absolute_path' parameter must be non-empty.";
    }

    if (!path.isAbsolute(filePath)) {
      return `File path must be absolute, but was relative: ${filePath}. You must provide an absolute path.`;
    }

    if (params.offset !== undefined && params.offset < 0) {
      return 'Offset must be a non-negative number';
    }

    if (params.limit !== undefined && params.limit <= 0) {
      return 'Limit must be a positive number';
    }

    return null;
  }

  /**
   * Get MIME type for file based on extension
   */
  static getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    
    const mimeTypes: Record<string, string> = {
      '.txt': 'text/plain',
      '.js': 'application/javascript',
      '.ts': 'application/typescript',
      '.tsx': 'application/typescript',
      '.jsx': 'application/javascript',
      '.json': 'application/json',
      '.html': 'text/html',
      '.css': 'text/css',
      '.md': 'text/markdown',
      '.xml': 'application/xml',
      '.yaml': 'application/x-yaml',
      '.yml': 'application/x-yaml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.bmp': 'image/bmp',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf'
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Format file content for display
   */
  static formatContent(
    content: string, 
    isTruncated: boolean, 
    totalLines?: number, 
    linesShown?: [number, number]
  ): string {
    if (isTruncated && totalLines && linesShown) {
      const [start, end] = linesShown;
      return `IMPORTANT: The file content has been truncated.
Status: Showing lines ${start}-${end} of ${totalLines} total lines.
Action: To read more of the file, you can use the 'offset' and 'limit' parameters in a subsequent 'read_file' call.

--- FILE CONTENT (truncated) ---
${content}`;
    }

    return content;
  }

  /**
   * Register IPC handlers for the ReadFile tool
   */
  static registerHandlers(): void {
    // Read File Tool IPC handlers
    ipcMain.handle('read-file', async (event, params) => {
      try {
        return await ReadFileTool.readFile(params);
      } catch (error) {
        console.error('Error in read-file IPC handler:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
      }
    });

    ipcMain.handle('get-file-info', async (event, params) => {
      try {
        return await ReadFileTool.getFileInfo(params.absolute_path);
      } catch (error) {
        console.error('Error in get-file-info IPC handler:', error);
        return {
          exists: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
      }
    });

    // File system IPC handlers
    ipcMain.handle('fs-get-system-directories', async () => {
      const homeDir = os.homedir();
      const platform = os.platform();

      let systemDirs = [];

      if (platform === 'darwin') {
        // macOS
        systemDirs = [
          {
            name: '바탕화면',
            path: path.join(homeDir, 'Desktop'),
            icon: 'desktop',
          },
          { name: '문서', path: path.join(homeDir, 'Documents'), icon: 'folder' },
          {
            name: '다운로드',
            path: path.join(homeDir, 'Downloads'),
            icon: 'download',
          },
          { name: '사진', path: path.join(homeDir, 'Pictures'), icon: 'image' },
          { name: '음악', path: path.join(homeDir, 'Music'), icon: 'music' },
          { name: '영화', path: path.join(homeDir, 'Movies'), icon: 'video' },
          { name: '애플리케이션', path: '/Applications', icon: 'rocket' },
        ];
      } else if (platform === 'win32') {
        // Windows
        systemDirs = [
          {
            name: '바탕화면',
            path: path.join(homeDir, 'Desktop'),
            icon: 'desktop',
          },
          { name: '문서', path: path.join(homeDir, 'Documents'), icon: 'folder' },
          {
            name: '다운로드',
            path: path.join(homeDir, 'Downloads'),
            icon: 'download',
          },
          { name: '사진', path: path.join(homeDir, 'Pictures'), icon: 'image' },
          { name: '음악', path: path.join(homeDir, 'Music'), icon: 'music' },
          { name: '비디오', path: path.join(homeDir, 'Videos'), icon: 'video' },
        ];
      } else {
        // Linux
        systemDirs = [
          {
            name: '바탕화면',
            path: path.join(homeDir, 'Desktop'),
            icon: 'desktop',
          },
          { name: '문서', path: path.join(homeDir, 'Documents'), icon: 'folder' },
          {
            name: '다운로드',
            path: path.join(homeDir, 'Downloads'),
            icon: 'download',
          },
          { name: '사진', path: path.join(homeDir, 'Pictures'), icon: 'image' },
          { name: '음악', path: path.join(homeDir, 'Music'), icon: 'music' },
          { name: '비디오', path: path.join(homeDir, 'Videos'), icon: 'video' },
        ];
      }

      return systemDirs;
    });

    ipcMain.handle('fs-create-folder', async (event, folderPath: string) => {
      try {
        await fs.promises.mkdir(folderPath, { recursive: true });
        return { success: true };
      } catch (error) {
        console.error('Error creating folder:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    ipcMain.handle('fs-delete-item', async (event, itemPath: string) => {
      try {
        const stats = await fs.promises.stat(itemPath);
        if (stats.isDirectory()) {
          await fs.promises.rm(itemPath, { recursive: true, force: true });
        } else {
          await fs.promises.unlink(itemPath);
        }
        return { success: true };
      } catch (error) {
        console.error('Error deleting item:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    ipcMain.handle(
      'fs-rename-item',
      async (event, oldPath: string, newPath: string) => {
        try {
          await fs.promises.rename(oldPath, newPath);
          return { success: true };
        } catch (error) {
          console.error('Error renaming item:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
    );

    // Additional file system IPC handlers
    ipcMain.handle('fs-read-directory', async (event, dirPath: string) => {
      try {
        const items = await fs.promises.readdir(dirPath, { withFileTypes: true });

        console.log(`Reading directory: ${dirPath}`);
        console.log(`Total items found: ${items.length}`);

        // Hide ALL items that start with a dot (both files and folders)
        const fileItems = items
          .filter((item) => {
            const isHidden = item.name.startsWith('.');

            if (isHidden) {
              console.log(
                `✗ Hiding hidden item: ${item.name} (${item.isDirectory() ? 'folder' : 'file'})`,
              );
              return false;
            }

            console.log(
              `✓ Showing item: ${item.name} (${item.isDirectory() ? 'folder' : 'file'})`,
            );
            return true;
          })
          .map((item) => ({
            name: item.name,
            type: item.isDirectory() ? 'folder' : 'file',
            path: path.join(dirPath, item.name),
            isDirectory: item.isDirectory(),
            isFile: item.isFile(),
            isHidden: item.name.startsWith('.'),
            isSymlink: item.isSymbolicLink(),
          }));

        console.log(`Filtered items: ${fileItems.length}`);
        console.log(
          `Hidden items filtered out: ${items.filter((item) => item.name.startsWith('.')).length}`,
        );

        // Sort: folders first, then files, both alphabetically
        fileItems.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });

        return { success: true, items: fileItems };
      } catch (error) {
        console.error('Error reading directory:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Folder picker dialog
    ipcMain.handle('fs-pick-folder', async () => {
      try {
        const result = await dialog.showOpenDialog({
          properties: ['openDirectory', 'createDirectory'],
          title: '동기화할 폴더 선택',
          buttonLabel: '선택',
        });

        if (!result.canceled && result.filePaths.length > 0) {
          return { success: true, folderPath: result.filePaths[0] };
        }
        return { success: false, error: '폴더가 선택되지 않았습니다.' };
      } catch (error) {
        console.error('Error picking folder:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    ipcMain.handle('fs-get-file-info', async (event, filePath: string) => {
      try {
        const stats = await fs.promises.stat(filePath);
        const ext = path.extname(filePath).toLowerCase();

        return {
          success: true,
          info: {
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            accessed: stats.atime,
            isDirectory: stats.isDirectory(),
            isFile: stats.isFile(),
            extension: ext,
            permissions: stats.mode,
          },
        };
      } catch (error) {
        console.error('Error getting file info:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Read file content
    ipcMain.handle('fs-read-file', async (event, filePath: string) => {
      try {
        const content = await fs.promises.readFile(filePath, 'utf8');
        return { success: true, content };
      } catch (error) {
        console.error('Error reading file:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Write file content handler removed - now handled by WriteFileTool

    ipcMain.handle('fs-get-home-directory', async () => {
      return os.homedir();
    });
  }
}
