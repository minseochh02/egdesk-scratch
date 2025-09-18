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
 * ReadFile tool client for Electron.js Renderer Process
 * This is a simple wrapper that calls the main process via IPC
 * All actual file operations happen in the main process for security
 */
export class ReadFileTool {
  static readonly Name: string = 'read_file';

  /**
   * Read file content using Electron IPC
   */
  static async readFile(params: ReadFileToolParams): Promise<ReadFileResult> {
    try {
      // Call main process via IPC through the preload script
      const result = await window.electron.fileSystem.readFileWithParams(params);
      return result;
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
      const result = await window.electron.fileSystem.getFileInfoOnly(filePath);
      return result;
    } catch (error) {
      return {
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}