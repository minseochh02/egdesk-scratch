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
  MoveFileTool,
  AppsScriptListFilesTool,
  AppsScriptReadFileTool,
  AppsScriptWriteFileTool,
  AppsScriptPartialEditTool,
  AppsScriptRenameFileTool,
  AppsScriptDeleteFileTool,
  AppsScriptDocsTool,
  AppsScriptDocsListTool,
  AppsScriptPushToDevTool,
  AppsScriptPullFromDevTool,
  AppsScriptPushDevToProdTool,
  AppsScriptPullProdToDevTool
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
      
      case 'apps_script_list_files':
        return {
          type: 'object',
          properties: {
            script_id: {
              type: 'string',
              description: 'The AppsScript project ID (stored in cloudmcp.db SQLite database)'
            }
          },
          required: ['script_id']
        };
      
      case 'apps_script_read_file':
        return {
          type: 'object',
          properties: {
            script_id: {
              type: 'string',
              description: 'The AppsScript project ID (stored in cloudmcp.db SQLite database)'
            },
            file_name: {
              type: 'string',
              description: 'The name of the file to read (e.g., "Code.gs", "MyFunction.gs")'
            }
          },
          required: ['script_id', 'file_name']
        };
      
      case 'apps_script_write_file':
        return {
          type: 'object',
          properties: {
            script_id: {
              type: 'string',
              description: 'The AppsScript project ID (stored in cloudmcp.db SQLite database)'
            },
            file_name: {
              type: 'string',
              description: 'The name of the file to write'
            },
            content: {
              type: 'string',
              description: 'The content to write to the file'
            },
            file_type: {
              type: 'string',
              description: 'Optional: File type (default: "SERVER_JS")'
            }
          },
          required: ['script_id', 'file_name', 'content']
        };
      
      case 'apps_script_partial_edit':
        return {
          type: 'object',
          properties: {
            script_id: {
              type: 'string',
              description: 'The AppsScript project ID (stored in cloudmcp.db SQLite database)'
            },
            file_name: {
              type: 'string',
              description: 'The name of the file to edit'
            },
            old_string: {
              type: 'string',
              description: 'The exact text to replace'
            },
            new_string: {
              type: 'string',
              description: 'The text to replace old_string with'
            },
            expected_replacements: {
              type: 'number',
              description: 'Number of occurrences to replace (default: 1)'
            },
            flexible_matching: {
              type: 'boolean',
              description: 'Whether to use flexible matching (default: true)'
            }
          },
          required: ['script_id', 'file_name', 'old_string', 'new_string']
        };
      
      case 'apps_script_rename_file':
        return {
          type: 'object',
          properties: {
            script_id: {
              type: 'string',
              description: 'The AppsScript project ID (stored in cloudmcp.db SQLite database)'
            },
            old_file_name: {
              type: 'string',
              description: 'The current name of the file'
            },
            new_file_name: {
              type: 'string',
              description: 'The new name for the file'
            }
          },
          required: ['script_id', 'old_file_name', 'new_file_name']
        };
      
      case 'apps_script_delete_file':
        return {
          type: 'object',
          properties: {
            script_id: {
              type: 'string',
              description: 'The AppsScript project ID (stored in cloudmcp.db SQLite database)'
            },
            file_name: {
              type: 'string',
              description: 'The name of the file to delete'
            }
          },
          required: ['script_id', 'file_name']
        };
      
      case 'apps_script_docs':
        return {
          type: 'object',
          properties: {
            service: {
              type: 'string',
              description: 'The Apps Script service name (e.g., "spreadsheet", "document", "drive", "gmail", "calendar")'
            },
            class_name: {
              type: 'string',
              description: 'The class name to get documentation for (e.g., "Spreadsheet", "Sheet", "Range", "Document")'
            },
            method_filter: {
              type: 'string',
              description: 'Optional: Filter methods by name pattern (e.g., "getValue*" or "set*"). Supports wildcards.'
            }
          },
          required: ['service', 'class_name']
        };
      
      case 'apps_script_docs_list':
        return {
          type: 'object',
          properties: {
            service: {
              type: 'string',
              description: 'Optional: The Apps Script service name to list classes for. If not provided, lists all available documentation.'
            }
          },
          required: []
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
    
    // AppsScript Tools
    this.registerTool(new AppsScriptListFilesTool());
    this.registerTool(new AppsScriptReadFileTool());
    this.registerTool(new AppsScriptWriteFileTool());
    this.registerTool(new AppsScriptPartialEditTool());
    this.registerTool(new AppsScriptRenameFileTool());
    this.registerTool(new AppsScriptDeleteFileTool());
    
    // AppsScript Documentation Tools
    this.registerTool(new AppsScriptDocsTool());
    this.registerTool(new AppsScriptDocsListTool());
    
    // AppsScript Push/Pull Tools (DEV/PROD workflow)
    this.registerTool(new AppsScriptPushToDevTool());
    this.registerTool(new AppsScriptPullFromDevTool());
    this.registerTool(new AppsScriptPushDevToProdTool());
    this.registerTool(new AppsScriptPullProdToDevTool());
  }
}


// Export singleton instance
export const toolRegistry = new ToolRegistry();

/**
 * Get filesystem tools for local file operations
 */
export function getFilesystemTools(): ToolExecutor[] {
  return [
    new ReadFileTool(),
    new WriteFileTool(),
    new ListDirectoryTool(),
    new MoveFileTool(),
    new PartialEditTool(),
    new ShellCommandTool(),
    new AnalyzeProjectTool(),
    new InitProjectTool(),
  ];
}

/**
 * Get Apps Script tools for database operations
 */
export function getAppsScriptTools(): ToolExecutor[] {
  return [
    new AppsScriptListFilesTool(),
    new AppsScriptReadFileTool(),
    new AppsScriptWriteFileTool(),
    new AppsScriptPartialEditTool(),
    new AppsScriptRenameFileTool(),
    new AppsScriptDeleteFileTool(),
    new AppsScriptDocsTool(),
    new AppsScriptDocsListTool(),
    new AppsScriptPushToDevTool(),
    new AppsScriptPullFromDevTool(),
    new AppsScriptPushDevToProdTool(),
    new AppsScriptPullProdToDevTool(),
  ];
}

/**
 * Get tool names for a specific context
 */
export function getToolNamesForContext(context: 'filesystem' | 'apps-script' | 'all'): string[] {
  switch (context) {
    case 'filesystem':
      return getFilesystemTools().map(t => t.name);
    case 'apps-script':
      return getAppsScriptTools().map(t => t.name);
    case 'all':
    default:
      return Array.from(toolRegistry['tools'].keys());
  }
}

/**
 * Register IPC handlers for AppsScript tools
 */
export function registerAppsScriptToolHandlers(): void {
  const { ipcMain } = require('electron');
  
  // Import tools
  const { AppsScriptListFilesTool } = require('./tools/apps-script-list-files');
  const { AppsScriptReadFileTool } = require('./tools/apps-script-read-file');
  const { AppsScriptWriteFileTool } = require('./tools/apps-script-write-file');
  const { AppsScriptPartialEditTool } = require('./tools/apps-script-partial-edit');
  const { AppsScriptRenameFileTool } = require('./tools/apps-script-rename-file');
  const { AppsScriptDeleteFileTool } = require('./tools/apps-script-delete-file');
  
  const listFilesTool = new AppsScriptListFilesTool();
  const readFileTool = new AppsScriptReadFileTool();
  const writeFileTool = new AppsScriptWriteFileTool();
  const partialEditTool = new AppsScriptPartialEditTool();
  const renameFileTool = new AppsScriptRenameFileTool();
  const deleteFileTool = new AppsScriptDeleteFileTool();
  
  // List AppsScript files
  ipcMain.handle('apps-script-list-files', async (event, scriptId: string) => {
    try {
      const result = await listFilesTool.execute({ scriptId });
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Read AppsScript file
  ipcMain.handle('apps-script-read-file', async (event, scriptId: string, fileName: string) => {
    try {
      const result = await readFileTool.execute({ scriptId, fileName });
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Write AppsScript file
  ipcMain.handle('apps-script-write-file', async (event, scriptId: string, fileName: string, content: string, fileType?: string, conversationId?: string) => {
    try {
      const result = await writeFileTool.execute({ scriptId, fileName, content, fileType }, undefined, conversationId);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Partial edit AppsScript file
  ipcMain.handle('apps-script-partial-edit', async (event, scriptId: string, fileName: string, oldString: string, newString: string, expectedReplacements?: number, flexibleMatching?: boolean, conversationId?: string) => {
    try {
      const result = await partialEditTool.execute({ scriptId, fileName, oldString, newString, expectedReplacements, flexibleMatching }, undefined, conversationId);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Rename AppsScript file
  ipcMain.handle('apps-script-rename-file', async (event, scriptId: string, oldFileName: string, newFileName: string, conversationId?: string) => {
    try {
      const result = await renameFileTool.execute({ scriptId, oldFileName, newFileName }, undefined, conversationId);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Delete AppsScript file
  ipcMain.handle('apps-script-delete-file', async (event, scriptId: string, fileName: string, conversationId?: string) => {
    try {
      const result = await deleteFileTool.execute({ scriptId, fileName }, undefined, conversationId);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Push to Google Apps Script
  ipcMain.handle('apps-script-push-to-google', async (event, projectId: string, createVersion?: boolean, versionDescription?: string) => {
    try {
      const { AppsScriptService } = require('../mcp/apps-script/apps-script-service');
      const service = AppsScriptService.getInstance();
      const result = await service.pushToGoogle(projectId, createVersion, versionDescription);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Pull from Google Apps Script
  ipcMain.handle('apps-script-pull-from-google', async (event, projectId: string) => {
    try {
      const { AppsScriptService } = require('../mcp/apps-script/apps-script-service');
      const service = AppsScriptService.getInstance();
      const result = await service.pullFromGoogle(projectId);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // List versions of a script
  ipcMain.handle('apps-script-list-versions', async (event, projectId: string) => {
    try {
      const { AppsScriptService } = require('../mcp/apps-script/apps-script-service');
      const service = AppsScriptService.getInstance();
      const result = await service.listVersions(projectId);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Get content at a specific version
  ipcMain.handle('apps-script-get-version-content', async (event, projectId: string, versionNumber: number) => {
    try {
      const { AppsScriptService } = require('../mcp/apps-script/apps-script-service');
      const service = AppsScriptService.getInstance();
      const result = await service.getVersionContent(projectId, versionNumber);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Run a function in the Apps Script project
  ipcMain.handle('apps-script-run-function', async (event, scriptId: string, functionName: string, parameters?: any[]) => {
    try {
      const { AppsScriptService } = require('../mcp/apps-script/apps-script-service');
      const service = AppsScriptService.getInstance();
      const result = await service.runFunction(scriptId, functionName, parameters);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // List triggers for a script
  ipcMain.handle('apps-script-list-triggers', async (event, projectId: string) => {
    try {
      const { AppsScriptService } = require('../mcp/apps-script/apps-script-service');
      const service = AppsScriptService.getInstance();
      const result = await service.listTriggers(projectId);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Clone script to create dev environment
  ipcMain.handle('apps-script-clone-for-dev', async (event, projectId: string) => {
    try {
      const { AppsScriptService } = require('../mcp/apps-script/apps-script-service');
      const service = AppsScriptService.getInstance();
      const result = await service.cloneScriptForDev(projectId);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Push to Dev Apps Script (Local → Dev)
  ipcMain.handle('apps-script-push-to-dev', async (event, projectId: string, createVersion?: boolean, versionDescription?: string) => {
    try {
      const { AppsScriptService } = require('../mcp/apps-script/apps-script-service');
      const service = AppsScriptService.getInstance();
      const result = await service.pushToDev(projectId, createVersion, versionDescription);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Pull from Dev Apps Script (Dev → Local)
  ipcMain.handle('apps-script-pull-from-dev', async (event, projectId: string) => {
    try {
      const { AppsScriptService } = require('../mcp/apps-script/apps-script-service');
      const service = AppsScriptService.getInstance();
      const result = await service.pullFromDev(projectId);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Push Dev to Production (Dev → Prod) - DANGEROUS
  ipcMain.handle('apps-script-push-dev-to-prod', async (event, projectId: string, createVersion?: boolean, versionDescription?: string) => {
    try {
      const { AppsScriptService } = require('../mcp/apps-script/apps-script-service');
      const service = AppsScriptService.getInstance();
      const result = await service.pushDevToProd(projectId, createVersion, versionDescription);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Pull Production to Dev (Prod → Dev)
  ipcMain.handle('apps-script-pull-prod-to-dev', async (event, projectId: string) => {
    try {
      const { AppsScriptService } = require('../mcp/apps-script/apps-script-service');
      const service = AppsScriptService.getInstance();
      const result = await service.pullProdToDev(projectId);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Apps Script Documentation lookup
  ipcMain.handle('apps-script-docs', async (event, service: string, className: string, methodFilter?: string) => {
    try {
      const { AppsScriptDocsTool } = require('./tools/apps-script-docs');
      const docsTool = new AppsScriptDocsTool();
      const result = await docsTool.execute({ service, className, methodFilter });
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Apps Script Documentation list
  ipcMain.handle('apps-script-docs-list', async (event, service?: string) => {
    try {
      const { AppsScriptDocsListTool } = require('./tools/apps-script-docs');
      const docsListTool = new AppsScriptDocsListTool();
      const result = await docsListTool.execute({ service });
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  console.log('✅ AppsScript tool IPC handlers registered');
}
