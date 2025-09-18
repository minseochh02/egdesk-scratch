/**
 * Simple Tool Registry for EGDesk AI Integration
 * Provides file tools to Gemini AI for function calling
 */

import type { FunctionDeclaration, Tool } from '@google/generative-ai';
import { ReadFileTool } from '../tools/read-file';
import { WriteFileTool } from '../tools/write-file';
import { ListDirectoryTool } from '../tools/list-directory';
import { EditFileTool } from '../tools/edit-file';
import { projectContextBridge } from './project-context-bridge';
import * as path from 'path';
import * as os from 'os';

export interface ToolDefinition {
  name: string;
  description: string;
  functionDeclaration: FunctionDeclaration;
  execute: (params: any) => Promise<any>;
}

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private currentWorkingDirectory: string = process.cwd();

  constructor() {
    this.registerDefaultTools();
  }

  /**
   * Set the current working directory for file operations
   */
  setWorkingDirectory(directory: string): void {
    this.currentWorkingDirectory = directory;
    console.log(`📁 Tool registry working directory set to: ${directory}`);
  }

  /**
   * Get current working directory (project-aware)
   */
  getWorkingDirectory(): string {
    // Use project context if available, otherwise fall back to set directory
    const projectPath = projectContextBridge.getCurrentProjectPath();
    if (projectPath !== process.cwd()) {
      return projectPath;
    }
    return this.currentWorkingDirectory;
  }

  /**
   * Get project context for AI
   */
  getProjectContext(): string {
    return projectContextBridge.getProjectContextString();
  }

  /**
   * Register default file tools
   */
  private registerDefaultTools(): void {
    // Register read file tool
    this.registerTool({
      name: 'read_file',
      description: 'Read the contents of a file',
      functionDeclaration: {
        name: 'read_file',
        description: 'Read and return the contents of a file. Can read any text file including HTML, CSS, JavaScript, etc.',
        parameters: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'The path to the file to read. Can be relative to current directory or absolute path.'
            },
            offset: {
              type: 'integer',
              description: 'Optional: Line number to start reading from (1-based)'
            },
            limit: {
              type: 'integer', 
              description: 'Optional: Maximum number of lines to read'
            }
          },
          required: ['file_path']
        }
      },
      execute: async (params: { file_path: string; offset?: number; limit?: number }) => {
        try {
          // Convert relative paths to absolute based on current working directory (project-aware)
          const workingDir = this.getWorkingDirectory();
          const absolutePath = path.isAbsolute(params.file_path) 
            ? params.file_path 
            : path.resolve(workingDir, params.file_path);

          const result = await ReadFileTool.readFile({
            absolute_path: absolutePath,
            offset: params.offset,
            limit: params.limit
          });

          if (result.success) {
            return {
              success: true,
              content: result.content,
              file_path: absolutePath,
              lines_read: result.linesShown,
              total_lines: result.totalLines,
              is_truncated: result.isTruncated
            };
          } else {
            return {
              success: false,
              error: result.error,
              file_path: absolutePath
            };
          }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            file_path: params.file_path
          };
        }
      }
    });

    // Register write file tool
    this.registerTool({
      name: 'write_file',
      description: 'Create or overwrite a file with content',
      functionDeclaration: {
        name: 'write_file',
        description: 'Create a new file or overwrite an existing file with the provided content. Perfect for creating HTML, CSS, JavaScript files, etc.',
        parameters: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'The path where to create/write the file. Can be relative to current directory or absolute path.'
            },
            content: {
              type: 'string',
              description: 'The content to write to the file'
            },
            description: {
              type: 'string',
              description: 'Optional: A brief description of what this file contains or does'
            }
          },
          required: ['file_path', 'content']
        }
      },
      execute: async (params: { file_path: string; content: string; description?: string }) => {
        try {
          // Convert relative paths to absolute based on current working directory (project-aware)
          const workingDir = this.getWorkingDirectory();
          const absolutePath = path.isAbsolute(params.file_path)
            ? params.file_path
            : path.resolve(workingDir, params.file_path);

          const result = await WriteFileTool.writeFile({
            file_path: absolutePath,
            content: params.content,
            modified_by_user: false,
            ai_proposed_content: params.description
          });

          if (result.success) {
            return {
              success: true,
              file_path: absolutePath,
              relative_path: path.relative(workingDir, absolutePath),
              content_length: params.content.length,
              lines_written: result.linesWritten,
              file_size: result.fileSize,
              is_new_file: result.isNewFile,
              description: params.description
            };
          } else {
            return {
              success: false,
              error: result.error,
              file_path: absolutePath
            };
          }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            file_path: params.file_path
          };
        }
      }
    });

    // Register list directory tool
    this.registerTool({
      name: 'list_directory',
      description: 'List the contents of a directory',
      functionDeclaration: {
        name: 'list_directory',
        description: 'List files and directories in a specified directory. Returns information about each entry including type, size, and modification time.',
        parameters: {
          type: 'object',
          properties: {
            directory_path: {
              type: 'string',
              description: 'The path to the directory to list. Can be relative to current directory or absolute path.'
            },
            show_hidden: {
              type: 'boolean',
              description: 'Optional: Whether to show hidden files (files starting with .). Defaults to false.'
            },
            ignore_patterns: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional: Array of glob patterns to ignore (e.g., ["*.tmp", "node_modules"])'
            },
            include_details: {
              type: 'boolean',
              description: 'Optional: Whether to include file sizes and modification times. Defaults to true.'
            }
          },
          required: ['directory_path']
        }
      },
      execute: async (params: { directory_path: string; show_hidden?: boolean; ignore_patterns?: string[]; include_details?: boolean }) => {
        try {
          // Convert relative paths to absolute based on current working directory (project-aware)
          const workingDir = this.getWorkingDirectory();
          const absolutePath = path.isAbsolute(params.directory_path) 
            ? params.directory_path 
            : path.resolve(workingDir, params.directory_path);

          const result = await ListDirectoryTool.listDirectory({
            directory_path: absolutePath,
            show_hidden: params.show_hidden,
            ignore_patterns: params.ignore_patterns,
            include_details: params.include_details
          });

          if (result.success) {
            return {
              success: true,
              directory_path: absolutePath,
              relative_path: path.relative(workingDir, absolutePath),
              entries: result.entries,
              total_files: result.total_files,
              total_directories: result.total_directories
            };
          } else {
            return {
              success: false,
              error: result.error,
              directory_path: absolutePath
            };
          }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            directory_path: params.directory_path
          };
        }
      }
    });

    // Register edit file tool
    this.registerTool({
      name: 'edit_file',
      description: 'Edit a file by replacing specific text',
      functionDeclaration: {
        name: 'edit_file',
        description: 'Edit a file by replacing old text with new text. Can also create new files by using empty old_string. More precise than write_file for making specific changes.',
        parameters: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'The path to the file to edit. Can be relative to current directory or absolute path.'
            },
            old_string: {
              type: 'string',
              description: 'The exact text to replace. Use empty string to create a new file. Must match exactly including whitespace and line breaks.'
            },
            new_string: {
              type: 'string',
              description: 'The text to replace the old_string with.'
            },
            expected_replacements: {
              type: 'integer',
              description: 'Optional: Number of replacements expected. Defaults to 1. Use when replacing multiple occurrences.'
            },
            description: {
              type: 'string',
              description: 'Optional: Description of what this edit accomplishes.'
            }
          },
          required: ['file_path', 'old_string', 'new_string']
        }
      },
      execute: async (params: { file_path: string; old_string: string; new_string: string; expected_replacements?: number; description?: string }) => {
        try {
          // Convert relative paths to absolute based on current working directory (project-aware)
          const workingDir = this.getWorkingDirectory();
          const absolutePath = path.isAbsolute(params.file_path) 
            ? params.file_path 
            : path.resolve(workingDir, params.file_path);

          const result = await EditFileTool.editFile({
            file_path: absolutePath,
            old_string: params.old_string,
            new_string: params.new_string,
            expected_replacements: params.expected_replacements,
            description: params.description
          });

          if (result.success) {
            return {
              success: true,
              file_path: absolutePath,
              relative_path: path.relative(workingDir, absolutePath),
              is_new_file: result.is_new_file,
              content_preview: result.content_preview,
              lines_changed: result.lines_changed,
              replacements_made: result.replacements_made,
              file_size: result.file_size
            };
          } else {
            return {
              success: false,
              error: result.error,
              file_path: absolutePath
            };
          }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            file_path: params.file_path
          };
        }
      }
    });
  }

  /**
   * Register a new tool
   */
  registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
    console.log(`🔧 Registered tool: ${tool.name}`);
  }

  /**
   * Get all tools as Gemini Tool format
   */
  getGeminiTools(): Tool[] {
    const functionDeclarations = Array.from(this.tools.values()).map(tool => tool.functionDeclaration);
    
    return [{
      functionDeclarations
    }];
  }

  /**
   * Execute a tool by name
   */
  async executeTool(toolName: string, params: any): Promise<any> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found`);
    }

    console.log(`🔧 Executing tool: ${toolName} with params:`, params);
    const result = await tool.execute(params);
    console.log(`✅ Tool '${toolName}' completed:`, result.success ? 'SUCCESS' : 'FAILED');
    
    return result;
  }

  /**
   * Get list of available tool names
   */
  getAvailableTools(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get tool definition by name
   */
  getTool(toolName: string): ToolDefinition | undefined {
    return this.tools.get(toolName);
  }
}

// Export singleton instance
export const toolRegistry = new ToolRegistry();
