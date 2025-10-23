/**
 * File System Service
 * Core file system operations with security controls
 * 
 * This service provides all file system operations for the MCP server,
 * with built-in security checks using the security-exclusions rules.
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { isPathBlockedWithConfig, SecurityConfig } from './security-exclusions';

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  isDirectory: boolean;
  isFile: boolean;
  created: Date;
  modified: Date;
  accessed: Date;
  extension?: string;
  permissions?: string;
}

export interface DirectoryEntry {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink' | 'other';
  size?: number;
  modified?: Date;
}

export interface DirectoryTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: DirectoryTreeNode[];
  size?: number;
}

export interface SearchResult {
  path: string;
  name: string;
  type: 'file' | 'directory';
  matches?: string[];
  score?: number;
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
 * Handles all file system operations with security checks
 */
export class FileSystemService {
  private securityConfig: SecurityConfig;

  constructor(securityConfig: SecurityConfig = {}) {
    this.securityConfig = securityConfig;
  }

  /**
   * Validate path against security rules
   */
  private validatePath(filePath: string): void {
    const absolutePath = path.resolve(filePath);
    const check = isPathBlockedWithConfig(absolutePath, this.securityConfig);
    
    if (check.blocked) {
      throw new Error(`Access denied: ${check.reason}`);
    }
  }

  /**
   * Read file contents
   */
  async readFile(filePath: string, encoding: BufferEncoding = 'utf8'): Promise<string> {
    this.validatePath(filePath);
    
    try {
      const absolutePath = path.resolve(filePath);
      const content = await fs.readFile(absolutePath, encoding);
      return content;
    } catch (error) {
      throw new Error(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Write file contents (creates or overwrites)
   */
  async writeFile(
    filePath: string,
    content: string,
    encoding: BufferEncoding = 'utf8'
  ): Promise<void> {
    this.validatePath(filePath);
    
    try {
      const absolutePath = path.resolve(filePath);
      
      // Ensure directory exists
      const dir = path.dirname(absolutePath);
      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(absolutePath, content, encoding);
    } catch (error) {
      throw new Error(`Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Edit file with targeted operations
   */
  async editFile(filePath: string, edits: EditOperation[]): Promise<void> {
    this.validatePath(filePath);
    
    try {
      const absolutePath = path.resolve(filePath);
      let content = await fs.readFile(absolutePath, 'utf8');
      
      for (const edit of edits) {
        switch (edit.type) {
          case 'search_replace':
            if (edit.search !== undefined && edit.replace !== undefined) {
              content = content.replace(new RegExp(edit.search, 'g'), edit.replace);
            }
            break;
            
          case 'insert':
            if (edit.position !== undefined && edit.content !== undefined) {
              content = content.slice(0, edit.position) + edit.content + content.slice(edit.position);
            }
            break;
            
          case 'delete':
            if (edit.startLine !== undefined && edit.endLine !== undefined) {
              const lines = content.split('\n');
              lines.splice(edit.startLine - 1, edit.endLine - edit.startLine + 1);
              content = lines.join('\n');
            }
            break;
        }
      }
      
      await fs.writeFile(absolutePath, content, 'utf8');
    } catch (error) {
      throw new Error(`Failed to edit file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List directory contents
   */
  async listDirectory(dirPath: string): Promise<DirectoryEntry[]> {
    this.validatePath(dirPath);
    
    try {
      const absolutePath = path.resolve(dirPath);
      const entries = await fs.readdir(absolutePath, { withFileTypes: true });
      
      const result: DirectoryEntry[] = [];
      
      for (const entry of entries) {
        const entryPath = path.join(absolutePath, entry.name);
        
        // Skip blocked paths silently
        const check = isPathBlockedWithConfig(entryPath, this.securityConfig);
        if (check.blocked) {
          continue;
        }
        
        let type: 'file' | 'directory' | 'symlink' | 'other' = 'other';
        if (entry.isFile()) type = 'file';
        else if (entry.isDirectory()) type = 'directory';
        else if (entry.isSymbolicLink()) type = 'symlink';
        
        const stats = await fs.stat(entryPath).catch(() => null);
        
        result.push({
          name: entry.name,
          path: entryPath,
          type,
          size: stats?.size,
          modified: stats?.mtime,
        });
      }
      
      return result;
    } catch (error) {
      throw new Error(`Failed to list directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create directory (with recursive option)
   */
  async createDirectory(dirPath: string, recursive: boolean = true): Promise<void> {
    this.validatePath(dirPath);
    
    try {
      const absolutePath = path.resolve(dirPath);
      await fs.mkdir(absolutePath, { recursive });
    } catch (error) {
      throw new Error(`Failed to create directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Move file or directory
   */
  async moveFile(sourcePath: string, destinationPath: string): Promise<void> {
    this.validatePath(sourcePath);
    this.validatePath(destinationPath);
    
    try {
      const absoluteSource = path.resolve(sourcePath);
      const absoluteDestination = path.resolve(destinationPath);
      
      // Ensure destination directory exists
      const destDir = path.dirname(absoluteDestination);
      await fs.mkdir(destDir, { recursive: true });
      
      await fs.rename(absoluteSource, absoluteDestination);
    } catch (error) {
      throw new Error(`Failed to move file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Copy file
   */
  async copyFile(sourcePath: string, destinationPath: string): Promise<void> {
    this.validatePath(sourcePath);
    this.validatePath(destinationPath);
    
    try {
      const absoluteSource = path.resolve(sourcePath);
      const absoluteDestination = path.resolve(destinationPath);
      
      // Ensure destination directory exists
      const destDir = path.dirname(absoluteDestination);
      await fs.mkdir(destDir, { recursive: true });
      
      await fs.copyFile(absoluteSource, absoluteDestination);
    } catch (error) {
      throw new Error(`Failed to copy file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete file or directory
   */
  async deleteFile(filePath: string, recursive: boolean = false): Promise<void> {
    this.validatePath(filePath);
    
    try {
      const absolutePath = path.resolve(filePath);
      const stats = await fs.stat(absolutePath);
      
      if (stats.isDirectory()) {
        await fs.rm(absolutePath, { recursive, force: true });
      } else {
        await fs.unlink(absolutePath);
      }
    } catch (error) {
      throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search for files matching pattern
   */
  async searchFiles(
    searchPath: string,
    pattern: string,
    searchContent: boolean = false,
    maxResults: number = 100
  ): Promise<SearchResult[]> {
    this.validatePath(searchPath);
    
    try {
      const absolutePath = path.resolve(searchPath);
      const results: SearchResult[] = [];
      const regex = new RegExp(pattern, 'i');
      
      await this.searchRecursive(absolutePath, regex, searchContent, results, maxResults);
      
      return results;
    } catch (error) {
      throw new Error(`Failed to search files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Recursive search helper
   */
  private async searchRecursive(
    dirPath: string,
    regex: RegExp,
    searchContent: boolean,
    results: SearchResult[],
    maxResults: number,
    depth: number = 0
  ): Promise<void> {
    if (results.length >= maxResults || depth > 10) {
      return;
    }
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (results.length >= maxResults) break;
        
        const entryPath = path.join(dirPath, entry.name);
        
        // Skip blocked paths
        const check = isPathBlockedWithConfig(entryPath, this.securityConfig);
        if (check.blocked) {
          continue;
        }
        
        // Check filename match
        if (regex.test(entry.name)) {
          results.push({
            path: entryPath,
            name: entry.name,
            type: entry.isDirectory() ? 'directory' : 'file',
          });
        }
        
        // Search content if requested
        if (searchContent && entry.isFile()) {
          try {
            const content = await fs.readFile(entryPath, 'utf8');
            const matches = content.match(regex);
            if (matches && matches.length > 0) {
              results.push({
                path: entryPath,
                name: entry.name,
                type: 'file',
                matches: matches.slice(0, 5), // Limit to 5 matches per file
              });
            }
          } catch {
            // Skip files that can't be read
          }
        }
        
        // Recurse into directories
        if (entry.isDirectory()) {
          await this.searchRecursive(entryPath, regex, searchContent, results, maxResults, depth + 1);
        }
      }
    } catch {
      // Skip directories that can't be read
    }
  }

  /**
   * Get file information
   */
  async getFileInfo(filePath: string): Promise<FileInfo> {
    this.validatePath(filePath);
    
    try {
      const absolutePath = path.resolve(filePath);
      const stats = await fs.stat(absolutePath);
      const name = path.basename(absolutePath);
      const ext = path.extname(name);
      
      return {
        path: absolutePath,
        name,
        size: stats.size,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
        extension: ext || undefined,
        permissions: stats.mode.toString(8),
      };
    } catch (error) {
      throw new Error(`Failed to get file info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get directory tree structure
   */
  async getDirectoryTree(dirPath: string, maxDepth: number = 3): Promise<DirectoryTreeNode> {
    this.validatePath(dirPath);
    
    try {
      const absolutePath = path.resolve(dirPath);
      return await this.buildTreeRecursive(absolutePath, maxDepth, 0);
    } catch (error) {
      throw new Error(`Failed to get directory tree: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Recursive tree builder
   */
  private async buildTreeRecursive(
    dirPath: string,
    maxDepth: number,
    currentDepth: number
  ): Promise<DirectoryTreeNode> {
    const stats = await fs.stat(dirPath);
    const name = path.basename(dirPath);
    
    const node: DirectoryTreeNode = {
      name,
      path: dirPath,
      type: stats.isDirectory() ? 'directory' : 'file',
    };
    
    if (stats.isFile()) {
      node.size = stats.size;
      return node;
    }
    
    if (currentDepth >= maxDepth) {
      return node;
    }
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      node.children = [];
      
      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        
        // Skip blocked paths
        const check = isPathBlockedWithConfig(entryPath, this.securityConfig);
        if (check.blocked) {
          continue;
        }
        
        const childNode = await this.buildTreeRecursive(entryPath, maxDepth, currentDepth + 1);
        node.children.push(childNode);
      }
    } catch {
      // Skip directories that can't be read
    }
    
    return node;
  }

  /**
   * Download file (read as binary buffer)
   */
  async downloadFile(filePath: string): Promise<Buffer> {
    this.validatePath(filePath);
    
    try {
      const absolutePath = path.resolve(filePath);
      const buffer = await fs.readFile(absolutePath);
      return buffer;
    } catch (error) {
      throw new Error(`Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload file to Downloads folder
   */
  async uploadFile(filename: string, content: string, encoding: 'utf8' | 'base64' = 'utf8'): Promise<string> {
    try {
      // Get user's home directory
      const homeDir = process.env.HOME || process.env.USERPROFILE || '';
      if (!homeDir) {
        throw new Error('Could not determine user home directory');
      }
      
      // Construct Downloads path
      const downloadsPath = path.join(homeDir, 'Downloads');
      
      // Ensure Downloads directory exists
      await fs.mkdir(downloadsPath, { recursive: true });
      
      // Sanitize filename to prevent path traversal
      const sanitizedFilename = path.basename(filename);
      const targetPath = path.join(downloadsPath, sanitizedFilename);
      
      // Validate the target path
      this.validatePath(targetPath);
      
      // Write the file
      if (encoding === 'base64') {
        const buffer = Buffer.from(content, 'base64');
        await fs.writeFile(targetPath, buffer);
      } else {
        await fs.writeFile(targetPath, content, 'utf8');
      }
      
      return targetPath;
    } catch (error) {
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if path exists
   */
  async exists(filePath: string): Promise<boolean> {
    try {
      const absolutePath = path.resolve(filePath);
      await fs.access(absolutePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Update security configuration
   */
  updateSecurityConfig(config: SecurityConfig): void {
    this.securityConfig = { ...this.securityConfig, ...config };
  }

  /**
   * Get current security configuration
   */
  getSecurityConfig(): SecurityConfig {
    return { ...this.securityConfig };
  }
}

