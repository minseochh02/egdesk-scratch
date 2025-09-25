/**
 * Tool Execution System
 * Handles tool registration, validation, and execution
 * Based on Gemini CLI patterns but simplified for EGDesk
 */

import type { 
  ToolDefinition, 
  ToolCallRequestInfo, 
  ToolCallResponseInfo,
  ToolCallConfirmationDetails,
  ToolExecutor
} from '../types/ai-types';
import { 
  ReadFileTool,
  WriteFileTool,
  ListDirectoryTool,
  ShellCommandTool,
  AnalyzeProjectTool,
  InitProjectTool,
  PartialEditTool,
  MoveFileTool
} from './tools';


export class ToolRegistry {
  private tools = new Map<string, ToolExecutor>();
  private pendingConfirmations = new Map<string, ToolCallRequestInfo>();

  constructor() {
    this.registerBuiltinTools();
  }

  /**
   * Register a tool executor
   */
  registerTool(tool: ToolExecutor): void {
    this.tools.set(tool.name, tool);
    console.log(`🔧 Registered tool: ${tool.name}`);
  }

  /**
   * Get all registered tools as definitions for AI
   */
  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: this.getParameterSchema(tool.name),
      dangerous: tool.dangerous,
      requiresConfirmation: tool.requiresConfirmation
    }));
  }

  /**
   * Get parameter schema for a specific tool
   */
  private getParameterSchema(toolName: string): any {
    switch (toolName) {
      case 'read_file':
        return {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'The path to the file to read. Can be relative to current directory or absolute path.'
            }
          },
          required: ['file_path']
        };
      
      case 'write_file':
        return {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'The path where to create/write the file. Can be relative to current directory or absolute path.'
            },
            content: {
              type: 'string',
              description: 'The content to write to the file'
            }
          },
          required: ['file_path', 'content']
        };
      
      case 'list_directory':
        return {
          type: 'object',
          properties: {
            dir_path: {
              type: 'string',
              description: 'The path to the directory to list. If not provided, lists the current project directory.'
            }
          },
          required: []
        };
      
      case 'shell_command':
        return {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'The shell command to execute'
            },
            cwd: {
              type: 'string',
              description: 'Optional: Working directory for the command'
            }
          },
          required: ['command']
        };
      
      case 'analyze_project':
        return {
          type: 'object',
          properties: {
            project_path: {
              type: 'string',
              description: 'Optional: Path to the project to analyze. Defaults to current directory.'
            }
          },
          required: []
        };
      
      case 'init_project':
        return {
          type: 'object',
          properties: {
            folder_path: {
              type: 'string',
              description: 'The folder path where to initialize the new project'
            }
          },
          required: ['folder_path']
        };
      
      case 'partial_edit':
        return {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'The path to the file to edit. Can be relative to current directory or absolute path.'
            },
            old_string: {
              type: 'string',
              description: 'The exact text to replace. Must match exactly including whitespace and indentation.'
            },
            new_string: {
              type: 'string',
              description: 'The text to replace old_string with.'
            },
            expected_replacements: {
              type: 'number',
              description: 'Number of occurrences to replace. Defaults to 1 if not specified.'
            },
            instruction: {
              type: 'string',
              description: 'Optional instruction describing what needs to be changed for better context.'
            },
            flexible_matching: {
              type: 'boolean',
              description: 'Whether to use flexible matching that tolerates whitespace differences. Defaults to true.'
            }
          },
          required: ['file_path', 'old_string', 'new_string']
        };
      
      default:
        return {
          type: 'object',
          properties: {},
          required: []
        };
    }
  }

  /**
   * Execute a tool call
   */
  async executeToolCall(request: ToolCallRequestInfo, signal?: AbortSignal): Promise<ToolCallResponseInfo> {
    const startTime = Date.now();
    const tool = this.tools.get(request.name);

    if (!tool) {
      return {
        id: request.id,
        success: false,
        error: `Tool '${request.name}' not found`,
        executionTime: Date.now() - startTime,
        timestamp: new Date()
      };
    }

    try {
      // Convert snake_case parameters to camelCase for backward compatibility with internal tools
      const mappedParams = this.mapParameterNames(request.parameters);

      // Auto-approve: bypass user confirmation and proceed to execute
      // Previously, this block would require user confirmation and return early.
      // Now, we intentionally skip creating pending confirmations and continue.
      if (tool.requiresConfirmation && tool.shouldConfirm) {
        try {
          await tool.shouldConfirm(mappedParams);
        } catch {}
      }

      // Execute the tool with mapped parameters
      const result = await tool.execute(mappedParams, signal, request.conversationId);
      
      return {
        id: request.id,
        success: true,
        result,
        executionTime: Date.now() - startTime,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        id: request.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
        timestamp: new Date()
      };
    }
  }

  /**
   * Confirm a pending tool execution
   */
  async confirmToolExecution(requestId: string, approved: boolean): Promise<ToolCallResponseInfo | null> {
    const request = this.pendingConfirmations.get(requestId);
    if (!request) return null;

    this.pendingConfirmations.delete(requestId);

    if (!approved) {
      return {
        id: request.id,
        success: false,
        error: 'Tool execution cancelled by user',
        executionTime: 0,
        timestamp: new Date()
      };
    }

    // Execute the approved tool
    return this.executeToolCall(request);
  }

  /**
   * Map parameter names from snake_case (Gemini) to camelCase (internal tools)
   */
  private mapParameterNames(params: Record<string, any>): Record<string, any> {
    const mappedParams: Record<string, any> = {};
    
    // Specific parameter mappings for known tools
    const parameterMappings: Record<string, string> = {
      'file_path': 'filePath',
      'dir_path': 'dirPath',
      'project_path': 'projectPath',
      'folder_path': 'folderPath',
      'old_string': 'oldString',
      'new_string': 'newString',
      'expected_replacements': 'expectedReplacements',
      'flexible_matching': 'flexibleMatching'
    };
    
    for (const [key, value] of Object.entries(params)) {
      // Use specific mapping if available
      if (parameterMappings[key]) {
        mappedParams[parameterMappings[key]] = value;
      } else {
        // Convert snake_case to camelCase as fallback
        const camelCaseKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        mappedParams[camelCaseKey] = value;
      }
      
      // Also keep original key for backward compatibility
      mappedParams[key] = value;
    }
    
    return mappedParams;
  }

  /**
   * Register built-in tools
   */
  private registerBuiltinTools(): void {
    // File System Tools
    this.registerTool(new ReadFileTool());
    this.registerTool(new WriteFileTool());
    this.registerTool(new ListDirectoryTool());
    this.registerTool(new MoveFileTool());
    this.registerTool(new PartialEditTool());
    
    // Shell Tools
    this.registerTool(new ShellCommandTool());
    
    // Project Tools
    this.registerTool(new AnalyzeProjectTool());
    this.registerTool(new InitProjectTool());
  }
}


// Export singleton instance
export const toolRegistry = new ToolRegistry();
