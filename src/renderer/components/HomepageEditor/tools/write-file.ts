/**
 * WriteFile tool client for Electron.js Renderer Process
 * This is a simple wrapper that calls the main process via IPC
 * All actual file operations happen in the main process for security
 * Follows Gemini CLI conventions for tool naming and structure
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
 * WriteFile tool client for Electron.js Renderer Process
 * This is a simple wrapper that calls the main process via IPC
 * All actual file operations happen in the main process for security
 */
export class WriteFileTool {
  static readonly Name: string = 'write_file';

  /**
   * Write file content using Electron IPC
   */
  static async writeFile(params: WriteFileToolParams): Promise<WriteFileResult> {
    try {
      // Call main process via IPC through the preload script
      const result = await window.electron.fileSystem.writeFileWithParams(params);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Write file content with simple parameters (backward compatibility)
   */
  static async writeFileSimple(filePath: string, content: string): Promise<WriteFileResult> {
    try {
      const result = await window.electron.fileSystem.writeFileSimple(filePath, content);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}
