/**
 * List Directory Tool for EGDesk AI Integration
 * Based on Gemini CLI's ls.ts implementation
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ipcMain } from 'electron';

/**
 * Parameters for the list directory tool
 */
export interface ListDirectoryParams {
  /**
   * The absolute path to the directory to list
   */
  directory_path: string;

  /**
   * Array of glob patterns to ignore (optional)
   */
  ignore_patterns?: string[];

  /**
   * Whether to show hidden files (files starting with .) (optional, defaults to false)
   */
  show_hidden?: boolean;

  /**
   * Whether to include file sizes and modification times (optional, defaults to true)
   */
  include_details?: boolean;
}

/**
 * File entry returned by list directory tool
 */
export interface FileEntry {
  /**
   * Name of the file or directory
   */
  name: string;

  /**
   * Absolute path to the file or directory
   */
  path: string;

  /**
   * Relative path from the requested directory
   */
  relative_path: string;

  /**
   * Whether this entry is a directory
   */
  is_directory: boolean;

  /**
   * Size of the file in bytes (0 for directories)
   */
  size?: number;

  /**
   * Last modified timestamp
   */
  modified_time?: Date;

  /**
   * File extension (if applicable)
   */
  extension?: string;
}

/**
 * Result of list directory operation
 */
export interface ListDirectoryResult {
  success: boolean;
  directory_path?: string;
  entries?: FileEntry[];
  total_files?: number;
  total_directories?: number;
  error?: string;
}

export class ListDirectoryTool {
  /**
   * Register IPC handlers for the list directory tool
   */
  static registerHandlers(): void {
    ipcMain.handle('list-directory', async (event, params: ListDirectoryParams): Promise<ListDirectoryResult> => {
      return this.listDirectory(params);
    });
  }

  /**
   * Checks if a filename matches any of the ignore patterns
   */
  private static shouldIgnore(filename: string, patterns?: string[]): boolean {
    if (!patterns || patterns.length === 0) {
      return false;
    }

    for (const pattern of patterns) {
      // Convert glob pattern to RegExp
      const regexPattern = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
        .replace(/\*/g, '.*') // Convert * to .*
        .replace(/\?/g, '.'); // Convert ? to .
      
      const regex = new RegExp(`^${regexPattern}$`);
      if (regex.test(filename)) {
        return true;
      }
    }
    return false;
  }

  /**
   * List directory contents
   */
  static async listDirectory(params: ListDirectoryParams): Promise<ListDirectoryResult> {
    try {
      const { directory_path, ignore_patterns, show_hidden = false, include_details = true } = params;

      // Validate directory path
      if (!directory_path) {
        return {
          success: false,
          error: 'Directory path is required'
        };
      }

      // Check if directory exists and is actually a directory
      let stats;
      try {
        stats = await fs.stat(directory_path);
      } catch (error) {
        return {
          success: false,
          error: `Directory not found or inaccessible: ${directory_path}`
        };
      }

      if (!stats.isDirectory()) {
        return {
          success: false,
          error: `Path is not a directory: ${directory_path}`
        };
      }

      // Read directory contents
      const files = await fs.readdir(directory_path);
      
      if (files.length === 0) {
        return {
          success: true,
          directory_path,
          entries: [],
          total_files: 0,
          total_directories: 0
        };
      }

      const entries: FileEntry[] = [];
      let totalFiles = 0;
      let totalDirectories = 0;

      for (const filename of files) {
        // Skip hidden files unless requested
        if (!show_hidden && filename.startsWith('.')) {
          continue;
        }

        // Check ignore patterns
        if (this.shouldIgnore(filename, ignore_patterns)) {
          continue;
        }

        const fullPath = path.join(directory_path, filename);
        const relativePath = path.relative(directory_path, fullPath);

        try {
          const fileStats = await fs.stat(fullPath);
          const isDirectory = fileStats.isDirectory();
          const extension = isDirectory ? undefined : path.extname(filename).toLowerCase();

          const entry: FileEntry = {
            name: filename,
            path: fullPath,
            relative_path: relativePath,
            is_directory: isDirectory,
            extension: extension || undefined
          };

          if (include_details) {
            entry.size = isDirectory ? 0 : fileStats.size;
            entry.modified_time = fileStats.mtime;
          }

          entries.push(entry);

          if (isDirectory) {
            totalDirectories++;
          } else {
            totalFiles++;
          }
        } catch (error) {
          // Skip files that can't be accessed (permissions, etc.)
          console.warn(`Skipping file due to access error: ${fullPath}`, error);
          continue;
        }
      }

      // Sort entries: directories first, then files, alphabetically within each group
      entries.sort((a, b) => {
        if (a.is_directory && !b.is_directory) return -1;
        if (!a.is_directory && b.is_directory) return 1;
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      });

      return {
        success: true,
        directory_path,
        entries,
        total_files: totalFiles,
        total_directories: totalDirectories
      };

    } catch (error) {
      console.error('List directory error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred while listing directory'
      };
    }
  }

  /**
   * Get a formatted string representation of directory contents (for AI context)
   */
  static formatDirectoryListing(result: ListDirectoryResult): string {
    if (!result.success || !result.entries) {
      return `Error: ${result.error}`;
    }

    if (result.entries.length === 0) {
      return `Directory ${result.directory_path} is empty.`;
    }

    let output = `Directory listing for: ${result.directory_path}\n`;
    output += `Total: ${result.total_directories} directories, ${result.total_files} files\n\n`;

    for (const entry of result.entries) {
      const type = entry.is_directory ? '[DIR]' : '[FILE]';
      const size = entry.size !== undefined ? ` (${entry.size} bytes)` : '';
      const ext = entry.extension ? ` .${entry.extension}` : '';
      output += `${type} ${entry.name}${ext}${size}\n`;
    }

    return output;
  }
}
