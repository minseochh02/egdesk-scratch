/**
 * Simple Tool Registry for EGDesk AI Integration
 * Provides file tools to Gemini AI for function calling
 */

import type { FunctionDeclaration, Tool } from '@google/generative-ai';
import { ReadFileTool } from '../tools/read-file';
import { WriteFileTool } from '../tools/write-file';
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
   * Get current working directory
   */
  getWorkingDirectory(): string {
    return this.currentWorkingDirectory;
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
          // Convert relative paths to absolute based on working directory
          const absolutePath = path.isAbsolute(params.file_path) 
            ? params.file_path 
            : path.resolve(this.currentWorkingDirectory, params.file_path);

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
          // Convert relative paths to absolute based on working directory  
          const absolutePath = path.isAbsolute(params.file_path)
            ? params.file_path
            : path.resolve(this.currentWorkingDirectory, params.file_path);

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
              relative_path: path.relative(this.currentWorkingDirectory, absolutePath),
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
