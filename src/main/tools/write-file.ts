/**
 * WriteFile tool implementation for Electron.js Main Process
 * This runs in the Node.js environment and has full file system access
 * Follows Gemini CLI conventions for tool naming and structure
 */

import fs from 'fs';
import path from 'path';
import { ipcMain } from 'electron';

/**
 * Parameters for the WriteFile tool
 */
export interface WriteFileToolParams {
  /**
   * The absolute path to the file to write to
   */
  file_path: string;

  /**
   * The content to write to the file
   */
  content: string;

  /**
   * Whether the proposed content was modified by the user
   */
  modified_by_user?: boolean;

  /**
   * Initially proposed content
   */
  ai_proposed_content?: string;
}

/**
 * Result of a write file operation
 */
export interface WriteFileResult {
  success: boolean;
  content?: string;
  filePath?: string;
  isNewFile?: boolean;
  error?: string;
  fileSize?: number;
  linesWritten?: number;
}

/**
 * WriteFile tool implementation for Electron.js Main Process
 * This runs in the Node.js environment and has full file system access
 */
export class WriteFileTool {
  static readonly Name: string = 'write_file';

  /**
   * Write content to a file with support for creating directories
   */
  static async writeFile(params: WriteFileToolParams): Promise<WriteFileResult> {
    try {
      // Debug logging
      console.log('WriteFileTool.writeFile called with params:', {
        file_path: params.file_path,
        content: params.content,
        contentType: typeof params.content,
        contentLength: params.content?.length,
        modified_by_user: params.modified_by_user,
        ai_proposed_content: params.ai_proposed_content
      });

      // Validate parameters
      const validationError = WriteFileTool.validateParams(params);
      if (validationError) {
        console.log('Validation error:', validationError);
        return {
          success: false,
          error: validationError
        };
      }

      const { file_path, content } = params;

      // Additional safety check for content
      if (content === undefined || content === null) {
        return {
          success: false,
          error: 'Content is undefined or null after validation'
        };
      }

      // Ensure content is a string
      const contentString = String(content);

      // Ensure directory exists
      const dirName = path.dirname(file_path);
      if (!fs.existsSync(dirName)) {
        fs.mkdirSync(dirName, { recursive: true });
      }

      // Check if file exists
      const fileExists = fs.existsSync(file_path);
      
      // Write content to file
      fs.writeFileSync(file_path, contentString, 'utf8');

      // Get file stats for response
      const stats = fs.statSync(file_path);
      const linesWritten = contentString.split('\n').length;

      return {
        success: true,
        content: contentString,
        filePath: file_path,
        isNewFile: !fileExists,
        fileSize: stats.size,
        linesWritten: linesWritten
      };

    } catch (error) {
      let errorMessage = 'Unknown error occurred';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Handle specific Node.js errors
        if ('code' in error) {
          const nodeError = error as NodeJS.ErrnoException;
          switch (nodeError.code) {
            case 'EACCES':
              errorMessage = `Permission denied writing to file: ${params.file_path}`;
              break;
            case 'ENOSPC':
              errorMessage = `No space left on device: ${params.file_path}`;
              break;
            case 'EISDIR':
              errorMessage = `Target is a directory, not a file: ${params.file_path}`;
              break;
            case 'ENOENT':
              errorMessage = `Parent directory does not exist: ${path.dirname(params.file_path)}`;
              break;
            default:
              errorMessage = `Error writing to file '${params.file_path}': ${error.message} (${nodeError.code})`;
          }
        }
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Validate write file parameters
   */
  private static validateParams(params: WriteFileToolParams): string | null {
    if (!params.file_path || params.file_path.trim() === '') {
      return 'File path is required and cannot be empty';
    }

    if (!path.isAbsolute(params.file_path)) {
      return `File path must be absolute, but was relative: ${params.file_path}`;
    }

    if (params.content === undefined || params.content === null) {
      return 'Content is required';
    }

    // Ensure content is a string
    if (typeof params.content !== 'string') {
      return `Content must be a string, received: ${typeof params.content}`;
    }

    // Check if path is a directory
    try {
      if (fs.existsSync(params.file_path)) {
        const stats = fs.lstatSync(params.file_path);
        if (stats.isDirectory()) {
          return `Path is a directory, not a file: ${params.file_path}`;
        }
      }
    } catch (error) {
      // If we can't check the path, that's okay - we'll handle it during write
    }

    return null;
  }

  /**
   * Register IPC handlers for the WriteFile tool
   */
  static registerHandlers(): void {
    // Handler for writing file with parameters
    ipcMain.handle('fs-write-file', async (event, params: WriteFileToolParams) => {
      console.log('IPC handler fs-write-file called with params:', params);
      return await WriteFileTool.writeFile(params);
    });

    // Handler for simple file writing (backward compatibility)
    ipcMain.handle('fs-write-file-simple', async (event, filePath: string, content: string) => {
      console.log('IPC handler fs-write-file-simple called with:', { filePath, content });
      return await WriteFileTool.writeFile({
        file_path: filePath,
        content: content
      });
    });

    console.log('✅ WriteFile tool IPC handlers registered');
  }

  /**
   * Unregister IPC handlers
   */
  static unregisterHandlers(): void {
    ipcMain.removeHandler('fs-write-file');
    ipcMain.removeHandler('fs-write-file-simple');
    console.log('✅ WriteFile tool IPC handlers unregistered');
  }
}
