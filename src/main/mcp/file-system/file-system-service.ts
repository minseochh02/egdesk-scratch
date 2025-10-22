/**
 * File System Service - Core file system operations
 * Implements all file system operations that will be exposed through MCP tools
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  isDirectory: boolean;
  isFile: boolean;
  permissions: string;
  modified: string;
  created: string;
  accessed: string;
}

export interface DirectoryEntry {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink' | 'other';
  size: number;
  modified: string;
}

export interface SearchResult {
  path: string;
  matches: number;
  lines?: Array<{
    lineNumber: number;
    content: string;
  }>;
}

export interface EditOperation {
  type: 'search_replace' | 'insert' | 'delete';
  search?: string;
  replace?: string;
  position?: number;
  content?: string;
  startLine?: number;
  endLine?: number;
}

/**
 * File System Service
 * Provides core file system operations for MCP tools
 */
export class FileSystemService {
  private allowedDirectories: string[];

  constructor(allowedDirectories: string[] = []) {
    this.allowedDirectories = allowedDirectories.length > 0 
      ? allowedDirectories 
      : [process.cwd()]; // Default to current working directory
  }

  /**
   * Check if a path is within allowed directories
   */
  private isPathAllowed(targetPath: string): boolean {
    const normalizedPath = path.resolve(targetPath);
    
    // If no restrictions, allow all paths
    if (this.allowedDirectories.length === 0) {
      return true;
    }

    return this.allowedDirectories.some(allowedDir => {
      const normalizedAllowedDir = path.resolve(allowedDir);
      return normalizedPath.startsWith(normalizedAllowedDir);
    });
  }

  /**
   * Validate and resolve a path
   */
  private validatePath(targetPath: string): string {
    const resolvedPath = path.resolve(targetPath);
    
    if (!this.isPathAllowed(resolvedPath)) {
      throw new Error(`Access denied: Path "${targetPath}" is outside allowed directories`);
    }

    return resolvedPath;
  }

  /**
   * Read file contents
   */
  async readFile(filePath: string, encoding: BufferEncoding = 'utf8'): Promise<string> {
    const validPath = this.validatePath(filePath);
    
    try {
      const content = await fs.readFile(validPath, encoding);
      return content;
    } catch (error) {
      throw new Error(`Failed to read file "${filePath}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Write file contents
   */
  async writeFile(filePath: string, content: string, encoding: BufferEncoding = 'utf8'): Promise<void> {
    const validPath = this.validatePath(filePath);
    
    try {
      // Ensure parent directory exists
      await fs.mkdir(path.dirname(validPath), { recursive: true });
      await fs.writeFile(validPath, content, encoding);
    } catch (error) {
      throw new Error(`Failed to write file "${filePath}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Edit file with targeted operations
   */
  async editFile(filePath: string, edits: EditOperation[]): Promise<void> {
    const validPath = this.validatePath(filePath);
    
    try {
      let content = await fs.readFile(validPath, 'utf8');
      
      for (const edit of edits) {
        switch (edit.type) {
          case 'search_replace': {
            if (!edit.search) {
              throw new Error('Search string is required for search_replace operation');
            }
            const searchStr = edit.search;
            const replaceStr = edit.replace || '';
            
            if (!content.includes(searchStr)) {
              throw new Error(`Search string not found: "${searchStr}"`);
            }
            
            content = content.replace(searchStr, replaceStr);
            break;
          }
          
          case 'insert': {
            if (edit.position === undefined || !edit.content) {
              throw new Error('Position and content are required for insert operation');
            }
            
            content = content.slice(0, edit.position) + edit.content + content.slice(edit.position);
            break;
          }
          
          case 'delete': {
            if (edit.startLine === undefined || edit.endLine === undefined) {
              throw new Error('Start and end lines are required for delete operation');
            }
            
            const lines = content.split('\n');
            lines.splice(edit.startLine - 1, edit.endLine - edit.startLine + 1);
            content = lines.join('\n');
            break;
          }
          
          default:
            throw new Error(`Unknown edit operation type: ${(edit as any).type}`);
        }
      }
      
      await fs.writeFile(validPath, content, 'utf8');
    } catch (error) {
      throw new Error(`Failed to edit file "${filePath}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List directory contents
   */
  async listDirectory(dirPath: string): Promise<DirectoryEntry[]> {
    const validPath = this.validatePath(dirPath);
    
    try {
      const entries = await fs.readdir(validPath, { withFileTypes: true });
      
      const result: DirectoryEntry[] = await Promise.all(
        entries.map(async (entry) => {
          const entryPath = path.join(validPath, entry.name);
          const stats = await fs.stat(entryPath);
          
          let type: 'file' | 'directory' | 'symlink' | 'other' = 'other';
          if (entry.isFile()) type = 'file';
          else if (entry.isDirectory()) type = 'directory';
          else if (entry.isSymbolicLink()) type = 'symlink';
          
          return {
            name: entry.name,
            path: entryPath,
            type,
            size: stats.size,
            modified: stats.mtime.toISOString()
          };
        })
      );
      
      return result;
    } catch (error) {
      throw new Error(`Failed to list directory "${dirPath}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create directory
   */
  async createDirectory(dirPath: string, recursive: boolean = true): Promise<void> {
    const validPath = this.validatePath(dirPath);
    
    try {
      await fs.mkdir(validPath, { recursive });
    } catch (error) {
      throw new Error(`Failed to create directory "${dirPath}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Move or rename file/directory
   */
  async moveFile(sourcePath: string, destPath: string): Promise<void> {
    const validSourcePath = this.validatePath(sourcePath);
    const validDestPath = this.validatePath(destPath);
    
    try {
      await fs.rename(validSourcePath, validDestPath);
    } catch (error) {
      throw new Error(`Failed to move "${sourcePath}" to "${destPath}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Copy file
   */
  async copyFile(sourcePath: string, destPath: string): Promise<void> {
    const validSourcePath = this.validatePath(sourcePath);
    const validDestPath = this.validatePath(destPath);
    
    try {
      await fs.copyFile(validSourcePath, validDestPath);
    } catch (error) {
      throw new Error(`Failed to copy "${sourcePath}" to "${destPath}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete file or directory
   */
  async deleteFile(filePath: string, recursive: boolean = false): Promise<void> {
    const validPath = this.validatePath(filePath);
    
    try {
      const stats = await fs.stat(validPath);
      
      if (stats.isDirectory()) {
        await fs.rm(validPath, { recursive, force: true });
      } else {
        await fs.unlink(validPath);
      }
    } catch (error) {
      throw new Error(`Failed to delete "${filePath}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search files by pattern
   */
  async searchFiles(
    basePath: string, 
    pattern: string, 
    options: {
      useRegex?: boolean;
      searchContent?: boolean;
      maxResults?: number;
    } = {}
  ): Promise<SearchResult[]> {
    const validPath = this.validatePath(basePath);
    
    try {
      const results: SearchResult[] = [];
      
      // Use glob to search for files by pattern
      const globPattern = path.join(validPath, pattern);
      const files = await glob(globPattern, { 
        nodir: false,
        absolute: true,
        maxDepth: 10
      });
      
      // Limit results
      const maxResults = options.maxResults || 1000;
      const limitedFiles = files.slice(0, maxResults);
      
      if (!options.searchContent) {
        // Just return file paths
        return limitedFiles.map(file => ({
          path: file,
          matches: 1
        }));
      }
      
      // Search file contents
      for (const file of limitedFiles) {
        try {
          const stats = await fs.stat(file);
          if (!stats.isFile()) continue;
          
          const content = await fs.readFile(file, 'utf8');
          const lines = content.split('\n');
          const matchingLines: Array<{ lineNumber: number; content: string }> = [];
          
          const searchPattern = options.useRegex ? new RegExp(pattern, 'gi') : pattern;
          
          lines.forEach((line, index) => {
            if (options.useRegex) {
              if ((searchPattern as RegExp).test(line)) {
                matchingLines.push({
                  lineNumber: index + 1,
                  content: line
                });
              }
            } else {
              if (line.includes(searchPattern as string)) {
                matchingLines.push({
                  lineNumber: index + 1,
                  content: line
                });
              }
            }
          });
          
          if (matchingLines.length > 0) {
            results.push({
              path: file,
              matches: matchingLines.length,
              lines: matchingLines.slice(0, 100) // Limit to 100 lines per file
            });
          }
        } catch (error) {
          // Skip files that can't be read
          console.warn(`Skipping file ${file}: ${error}`);
        }
      }
      
      return results;
    } catch (error) {
      throw new Error(`Failed to search files in "${basePath}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get file information
   */
  async getFileInfo(filePath: string): Promise<FileInfo> {
    const validPath = this.validatePath(filePath);
    
    try {
      const stats = await fs.stat(validPath);
      
      // Get permissions in octal format
      const permissions = (stats.mode & 0o777).toString(8);
      
      return {
        path: validPath,
        name: path.basename(validPath),
        size: stats.size,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        permissions: permissions,
        modified: stats.mtime.toISOString(),
        created: stats.birthtime.toISOString(),
        accessed: stats.atime.toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to get file info for "${filePath}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get directory tree
   */
  async getDirectoryTree(dirPath: string, maxDepth: number = 3): Promise<any> {
    const validPath = this.validatePath(dirPath);
    
    const buildTree = async (currentPath: string, depth: number): Promise<any> => {
      if (depth > maxDepth) {
        return null;
      }
      
      try {
        const stats = await fs.stat(currentPath);
        
        if (!stats.isDirectory()) {
          return {
            name: path.basename(currentPath),
            type: 'file',
            size: stats.size,
            path: currentPath
          };
        }
        
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        const children = await Promise.all(
          entries.map(async (entry) => {
            const childPath = path.join(currentPath, entry.name);
            return await buildTree(childPath, depth + 1);
          })
        );
        
        return {
          name: path.basename(currentPath),
          type: 'directory',
          path: currentPath,
          children: children.filter(child => child !== null)
        };
      } catch (error) {
        return null;
      }
    };
    
    return await buildTree(validPath, 0);
  }

  /**
   * List allowed directories
   */
  listAllowedDirectories(): string[] {
    return this.allowedDirectories.map(dir => path.resolve(dir));
  }

  /**
   * Add allowed directory
   */
  addAllowedDirectory(dirPath: string): void {
    const resolvedPath = path.resolve(dirPath);
    if (!this.allowedDirectories.includes(resolvedPath)) {
      this.allowedDirectories.push(resolvedPath);
    }
  }

  /**
   * Remove allowed directory
   */
  removeAllowedDirectory(dirPath: string): void {
    const resolvedPath = path.resolve(dirPath);
    const index = this.allowedDirectories.indexOf(resolvedPath);
    if (index > -1) {
      this.allowedDirectories.splice(index, 1);
    }
  }
}

// Export utility functions
export const createFileSystemService = (allowedDirectories: string[] = []): FileSystemService => {
  return new FileSystemService(allowedDirectories);
};

export const validateFilePath = (filePath: string): boolean => {
  try {
    path.resolve(filePath);
    return true;
  } catch {
    return false;
  }
};

