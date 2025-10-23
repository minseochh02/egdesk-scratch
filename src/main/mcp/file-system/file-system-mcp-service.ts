/**
 * File System MCP Service
 * Implements the IMCPService interface for file system operations
 */

import { IMCPService, MCPTool, MCPServerInfo, MCPCapabilities, MCPToolResult } from '../types/mcp-service';
import { FileSystemService } from './file-system-service';
import { SecurityConfig } from './security-exclusions';

/**
 * File System MCP Service
 * Adapts FileSystemService to the IMCPService interface
 */
export class FileSystemMCPService implements IMCPService {
  private fsService: FileSystemService;
  private uploadedFiles: Array<{ uri: string; name: string; path: string; mimeType: string }> = [];

  constructor(securityConfig: SecurityConfig = {}) {
    this.fsService = new FileSystemService(securityConfig);
  }

  getServerInfo(): MCPServerInfo {
    return {
      name: 'filesystem-mcp-server',
      version: '1.0.0'
    };
  }

  getCapabilities(): MCPCapabilities {
    return {
      tools: {},
      resources: {
        listChanged: true
      }
    };
  }

  listTools(): MCPTool[] {
    return [
      {
        name: 'fs_read_file',
        description: 'Read file contents',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file to read'
            },
            encoding: {
              type: 'string',
              description: 'File encoding (default: utf8)',
              default: 'utf8'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'fs_write_file',
        description: 'Write or overwrite a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file to write'
            },
            content: {
              type: 'string',
              description: 'Content to write'
            },
            encoding: {
              type: 'string',
              description: 'File encoding (default: utf8)',
              default: 'utf8'
            }
          },
          required: ['path', 'content']
        }
      },
      {
        name: 'fs_edit_file',
        description: 'Make targeted edits to a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file to edit'
            },
            edits: {
              type: 'array',
              description: 'Array of edit operations',
              items: {
                type: 'object',
                properties: {
                  type: {
                    type: 'string',
                    enum: ['search_replace', 'insert', 'delete']
                  },
                  search: { type: 'string' },
                  replace: { type: 'string' },
                  position: { type: 'number' },
                  content: { type: 'string' },
                  startLine: { type: 'number' },
                  endLine: { type: 'number' }
                }
              }
            }
          },
          required: ['path', 'edits']
        }
      },
      {
        name: 'fs_list_directory',
        description: 'List directory contents',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the directory'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'fs_create_directory',
        description: 'Create a directory',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the directory to create'
            },
            recursive: {
              type: 'boolean',
              description: 'Create parent directories if they don\'t exist',
              default: true
            }
          },
          required: ['path']
        }
      },
      {
        name: 'fs_move_file',
        description: 'Move or rename a file or directory',
        inputSchema: {
          type: 'object',
          properties: {
            source: {
              type: 'string',
              description: 'Source path'
            },
            destination: {
              type: 'string',
              description: 'Destination path'
            }
          },
          required: ['source', 'destination']
        }
      },
      {
        name: 'fs_copy_file',
        description: 'Copy a file',
        inputSchema: {
          type: 'object',
          properties: {
            source: {
              type: 'string',
              description: 'Source file path'
            },
            destination: {
              type: 'string',
              description: 'Destination file path'
            }
          },
          required: ['source', 'destination']
        }
      },
      {
        name: 'fs_delete_file',
        description: 'Delete a file or directory',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to delete'
            },
            recursive: {
              type: 'boolean',
              description: 'Delete directories recursively',
              default: false
            }
          },
          required: ['path']
        }
      },
      {
        name: 'fs_search_files',
        description: 'Search for files matching a pattern',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Directory to search in'
            },
            pattern: {
              type: 'string',
              description: 'Search pattern (regex)'
            },
            searchContent: {
              type: 'boolean',
              description: 'Also search file contents',
              default: false
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of results',
              default: 100
            }
          },
          required: ['path', 'pattern']
        }
      },
      {
        name: 'fs_get_file_info',
        description: 'Get file metadata',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'fs_get_directory_tree',
        description: 'Get directory tree structure',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Root directory path'
            },
            maxDepth: {
              type: 'number',
              description: 'Maximum depth to traverse',
              default: 3
            }
          },
          required: ['path']
        }
      },
      {
        name: 'fs_download_file',
        description: 'Download a file (read as binary)',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file to download'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'fs_upload_file',
        description: 'Upload and save a file directly to the user\'s Downloads folder. Use this to save generated content (documents, images, code files, etc.) for easy user access. Supports both text files (utf8) and binary files (base64 encoded). Returns the full path where the file was saved.',
        inputSchema: {
          type: 'object',
          properties: {
            filename: {
              type: 'string',
              description: 'Name of the file to create (e.g., "report.pdf", "data.json", "image.png")'
            },
            content: {
              type: 'string',
              description: 'File content - plain text for text files, or base64-encoded string for binary files (images, PDFs, etc.)'
            },
            encoding: {
              type: 'string',
              description: 'Content encoding - use "utf8" for text files, "base64" for binary files',
              enum: ['utf8', 'base64'],
              default: 'utf8'
            }
          },
          required: ['filename', 'content']
        }
      }
    ];
  }

  async executeTool(name: string, args: Record<string, any>): Promise<MCPToolResult> {
    try {
      let result: any;

      switch (name) {
        case 'fs_read_file':
          result = await this.fsService.readFile(args.path, args.encoding || 'utf8');
          return {
            content: [{
              type: 'text',
              text: result
            }]
          };

        case 'fs_write_file':
          await this.fsService.writeFile(args.path, args.content, args.encoding || 'utf8');
          return {
            content: [{
              type: 'text',
              text: `File written successfully: ${args.path}`
            }]
          };

        case 'fs_edit_file':
          await this.fsService.editFile(args.path, args.edits);
          return {
            content: [{
              type: 'text',
              text: `File edited successfully: ${args.path}`
            }]
          };

        case 'fs_list_directory':
          result = await this.fsService.listDirectory(args.path);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }]
          };

        case 'fs_create_directory':
          await this.fsService.createDirectory(args.path, args.recursive ?? true);
          return {
            content: [{
              type: 'text',
              text: `Directory created successfully: ${args.path}`
            }]
          };

        case 'fs_move_file':
          await this.fsService.moveFile(args.source, args.destination);
          return {
            content: [{
              type: 'text',
              text: `Moved ${args.source} to ${args.destination}`
            }]
          };

        case 'fs_copy_file':
          await this.fsService.copyFile(args.source, args.destination);
          return {
            content: [{
              type: 'text',
              text: `Copied ${args.source} to ${args.destination}`
            }]
          };

        case 'fs_delete_file':
          await this.fsService.deleteFile(args.path, args.recursive ?? false);
          return {
            content: [{
              type: 'text',
              text: `Deleted: ${args.path}`
            }]
          };

        case 'fs_search_files':
          result = await this.fsService.searchFiles(
            args.path,
            args.pattern,
            args.searchContent ?? false,
            args.maxResults ?? 100
          );
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }]
          };

        case 'fs_get_file_info':
          result = await this.fsService.getFileInfo(args.path);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }]
          };

        case 'fs_get_directory_tree':
          result = await this.fsService.getDirectoryTree(args.path, args.maxDepth ?? 3);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }]
          };

        case 'fs_download_file':
          const buffer = await this.fsService.downloadFile(args.path);
          return {
            content: [{
              type: 'text',
              text: `File downloaded: ${args.path} (${buffer.length} bytes)`,
              data: buffer.toString('base64')
            }]
          };

        case 'fs_upload_file':
          const uploadedPath = await this.fsService.uploadFile(
            args.filename,
            args.content,
            args.encoding || 'utf8'
          );
          
          // Track uploaded file as a resource
          const mimeType = this.getMimeType(args.filename);
          const fileUri = `file://${uploadedPath}`;
          this.uploadedFiles.push({
            uri: fileUri,
            name: args.filename,
            path: uploadedPath,
            mimeType
          });
          
          return {
            content: [{
              type: 'text',
              text: `File uploaded successfully to: ${uploadedPath}\nResource URI: ${fileUri}`
            }]
          };

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      throw new Error(`Failed to execute ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the underlying file system service
   */
  getFileSystemService(): FileSystemService {
    return this.fsService;
  }

  /**
   * List available resources
   * Returns uploaded files and a template for accessing Downloads folder
   */
  listResources(): Array<{ uri: string; name: string; description?: string; mimeType?: string }> {
    const resources = [
      {
        uri: 'downloads://folder/info',
        name: 'Downloads Folder Info',
        description: 'Information about the Downloads folder and uploaded files',
        mimeType: 'application/json'
      },
      ...this.uploadedFiles.map(file => ({
        uri: file.uri,
        name: file.name,
        description: `Uploaded file: ${file.name}`,
        mimeType: file.mimeType
      }))
    ];
    
    return resources;
  }

  /**
   * Read a resource by URI
   */
  async readResource(uri: string): Promise<{ uri: string; mimeType?: string; text?: string; blob?: string }> {
    // Handle Downloads folder info resource
    if (uri === 'downloads://folder/info') {
      const homeDir = process.env.HOME || process.env.USERPROFILE || '';
      const downloadsPath = require('path').join(homeDir, 'Downloads');
      
      return {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          path: downloadsPath,
          uploadedFiles: this.uploadedFiles.length,
          files: this.uploadedFiles.map(f => ({
            name: f.name,
            uri: f.uri,
            mimeType: f.mimeType
          }))
        }, null, 2)
      };
    }

    // Handle uploaded file resources
    const uploadedFile = this.uploadedFiles.find(f => f.uri === uri);
    if (uploadedFile) {
      try {
        const content = await this.fsService.readFile(uploadedFile.path);
        
        // Check if it's a binary file type
        if (this.isBinaryMimeType(uploadedFile.mimeType)) {
          const buffer = await this.fsService.downloadFile(uploadedFile.path);
          return {
            uri,
            mimeType: uploadedFile.mimeType,
            blob: buffer.toString('base64')
          };
        } else {
          return {
            uri,
            mimeType: uploadedFile.mimeType,
            text: content
          };
        }
      } catch (error) {
        throw new Error(`Failed to read resource: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    throw new Error(`Resource not found: ${uri}`);
  }

  /**
   * Get MIME type from filename
   */
  private getMimeType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop() || '';
    const mimeTypes: Record<string, string> = {
      'txt': 'text/plain',
      'json': 'application/json',
      'xml': 'application/xml',
      'html': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'ts': 'application/typescript',
      'md': 'text/markdown',
      'pdf': 'application/pdf',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'webp': 'image/webp',
      'zip': 'application/zip',
      'csv': 'text/csv',
      'mp3': 'audio/mpeg',
      'mp4': 'video/mp4',
      'wav': 'audio/wav'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Check if MIME type is binary
   */
  private isBinaryMimeType(mimeType: string): boolean {
    return mimeType.startsWith('image/') || 
           mimeType.startsWith('audio/') || 
           mimeType.startsWith('video/') ||
           mimeType === 'application/pdf' ||
           mimeType === 'application/zip' ||
           mimeType === 'application/octet-stream';
  }
}

