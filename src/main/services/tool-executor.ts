/**
 * Tool Execution System
 * Handles tool registration, validation, and execution
 * Based on Gemini CLI patterns but simplified for EGDesk
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type { 
  ToolDefinition, 
  ToolCallRequestInfo, 
  ToolCallResponseInfo,
  ToolCallConfirmationDetails 
} from '../types/ai-types';
import { projectContextBridge } from './project-context-bridge';

export interface ToolExecutor {
  name: string;
  description: string;
  dangerous?: boolean;
  requiresConfirmation?: boolean;
  execute(parameters: Record<string, any>, signal?: AbortSignal): Promise<any>;
  shouldConfirm?(parameters: Record<string, any>): Promise<ToolCallConfirmationDetails | false>;
}

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

      // Check if confirmation is needed
      if (tool.requiresConfirmation && tool.shouldConfirm) {
        const confirmationDetails = await tool.shouldConfirm(mappedParams);
        if (confirmationDetails) {
          // Store for confirmation UI
          this.pendingConfirmations.set(request.id, request);
          return {
            id: request.id,
            success: false,
            error: 'Tool execution requires user confirmation',
            executionTime: Date.now() - startTime,
            timestamp: new Date()
          };
        }
      }

      // Execute the tool with mapped parameters
      const result = await tool.execute(mappedParams, signal);
      
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
      'project_path': 'projectPath'
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
    
    // Shell Tools
    this.registerTool(new ShellCommandTool());
    
    // Project Tools
    this.registerTool(new AnalyzeProjectTool());
  }
}

/**
 * Built-in Tool Implementations
 */

class ReadFileTool implements ToolExecutor {
  name = 'read_file';
  description = 'Read the contents of a file. Supports relative paths (resolved against current project directory) and absolute paths.';
  dangerous = false;

  async execute(params: { filePath: string }): Promise<string> {
    if (!params.filePath) {
      throw new Error('filePath parameter is required');
    }

    // Resolve relative paths against project directory
    let resolvedPath = params.filePath;
    if (!path.isAbsolute(params.filePath)) {
      const projectPath = projectContextBridge.getCurrentProjectPath();
      const hasProject = projectContextBridge.hasCurrentProject();
      
      console.log(`📖 Reading relative file: ${params.filePath}. Project available: ${hasProject}, Project path: ${projectPath}`);
      
      if (hasProject && projectPath && projectPath !== process.cwd()) {
        resolvedPath = path.resolve(projectPath, params.filePath);
        console.log(`✅ Resolved to project file: ${resolvedPath}`);
      } else {
        resolvedPath = path.resolve(process.cwd(), params.filePath);
        console.log(`⚠️ Resolved to cwd file: ${resolvedPath}`);
      }
    }

    try {
      const content = await fs.promises.readFile(resolvedPath, 'utf-8');
      console.log(`📖 Successfully read file: ${resolvedPath} (${content.length} characters)`);
      return content;
    } catch (error) {
      const errorMsg = `Failed to read file '${resolvedPath}': ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}

class WriteFileTool implements ToolExecutor {
  name = 'write_file';
  description = 'Write content to a file. Supports relative paths (resolved against current project directory) and absolute paths.';
  dangerous = true;
  requiresConfirmation = false;

  async execute(params: { filePath: string; content: string }): Promise<string> {
    if (!params.filePath || params.content === undefined) {
      throw new Error('filePath and content parameters are required');
    }

    // Resolve relative paths against project directory
    let resolvedPath = params.filePath;
    if (!path.isAbsolute(params.filePath)) {
      const projectPath = projectContextBridge.getCurrentProjectPath();
      const hasProject = projectContextBridge.hasCurrentProject();
      
      console.log(`📝 Writing relative file: ${params.filePath}. Project available: ${hasProject}, Project path: ${projectPath}`);
      
      if (hasProject && projectPath && projectPath !== process.cwd()) {
        resolvedPath = path.resolve(projectPath, params.filePath);
        console.log(`✅ Resolved to project file: ${resolvedPath}`);
      } else {
        resolvedPath = path.resolve(process.cwd(), params.filePath);
        console.log(`⚠️ Resolved to cwd file: ${resolvedPath}`);
      }
    }

    try {
      // Ensure directory exists
      const dir = path.dirname(resolvedPath);
      await fs.promises.mkdir(dir, { recursive: true });
      
      // Write file
      await fs.promises.writeFile(resolvedPath, params.content, 'utf-8');
      const result = `Successfully wrote ${params.content.length} characters to ${resolvedPath}`;
      console.log(`📝 ${result}`);
      return result;
    } catch (error) {
      const errorMsg = `Failed to write file '${resolvedPath}': ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  async shouldConfirm(params: { filePath: string; content: string }): Promise<ToolCallConfirmationDetails | false> {
    // Resolve path the same way as execute method
    let resolvedPath = params.filePath;
    if (!path.isAbsolute(params.filePath)) {
      const projectPath = projectContextBridge.getCurrentProjectPath();
      const hasProject = projectContextBridge.hasCurrentProject();
      
      if (hasProject && projectPath && projectPath !== process.cwd()) {
        resolvedPath = path.resolve(projectPath, params.filePath);
      } else {
        resolvedPath = path.resolve(process.cwd(), params.filePath);
      }
    }

    // Check if file exists
    const exists = await fs.promises.access(resolvedPath).then(() => true).catch(() => false);
    
    return {
      toolName: this.name,
      parameters: params,
      description: exists 
        ? `Overwrite existing file: ${resolvedPath}`
        : `Create new file: ${resolvedPath}`,
      risks: exists 
        ? ['Will overwrite existing file content', 'Original content will be lost']
        : ['Will create a new file on disk'],
      autoApprove: false
    };
  }
}

class ListDirectoryTool implements ToolExecutor {
  name = 'list_directory';
  description = 'List files and directories in a path. If no path is provided, lists the current project directory.';
  dangerous = false;

  async execute(params: { dirPath?: string }): Promise<Array<{name: string; type: string; path: string}>> {
    // Use provided dirPath or fall back to current project directory
    let targetPath = params.dirPath;
    
    if (!targetPath) {
      // Try to get current project path from context
      const projectPath = projectContextBridge.getCurrentProjectPath();
      const hasProject = projectContextBridge.hasCurrentProject();
      
      console.log(`🔍 No dirPath provided. Project available: ${hasProject}, Project path: ${projectPath}, CWD: ${process.cwd()}`);
      
      targetPath = projectPath;
      if (!targetPath || targetPath === process.cwd()) {
        // Fall back to current working directory if no project context
        targetPath = process.cwd();
        console.log(`⚠️ Using fallback directory: ${targetPath}`);
      } else {
        console.log(`✅ Using project directory: ${targetPath}`);
      }
    }

    try {
      const items = await fs.promises.readdir(targetPath, { withFileTypes: true });
      return items.map(item => ({
        name: item.name,
        type: item.isDirectory() ? 'directory' : 'file',
        path: path.join(targetPath, item.name)
      }));
    } catch (error) {
      throw new Error(`Failed to list directory '${targetPath}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

class ShellCommandTool implements ToolExecutor {
  name = 'shell_command';
  description = 'Execute a shell command';
  dangerous = true;
  requiresConfirmation = false;

  async execute(params: { command: string; cwd?: string }, signal?: AbortSignal): Promise<string> {
    if (!params.command) {
      throw new Error('command parameter is required');
    }

    return new Promise((resolve, reject) => {
      const child = spawn('sh', ['-c', params.command], {
        cwd: params.cwd || process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout || 'Command executed successfully');
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr || stdout}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });

      // Handle cancellation
      signal?.addEventListener('abort', () => {
        child.kill();
        reject(new Error('Command cancelled by user'));
      });
    });
  }

  async shouldConfirm(params: { command: string }): Promise<ToolCallConfirmationDetails> {
    const dangerous = /rm|del|format|sudo|chmod|chown/.test(params.command);
    
    return {
      toolName: this.name,
      parameters: params,
      description: `Execute shell command: ${params.command}`,
      risks: dangerous 
        ? ['Could modify or delete files', 'Could affect system security', 'Could cause data loss']
        : ['Will execute system command', 'Could affect files in current directory'],
      autoApprove: !dangerous
    };
  }
}

class AnalyzeProjectTool implements ToolExecutor {
  name = 'analyze_project';
  description = 'Analyze project structure and provide insights';
  dangerous = false;

  async execute(params: { projectPath?: string }): Promise<any> {
    const projectPath = params.projectPath || process.cwd();
    
    try {
      // Get project structure
      const structure = await this.getProjectStructure(projectPath);
      
      // Analyze package.json if exists
      let packageInfo = null;
      const packagePath = path.join(projectPath, 'package.json');
      try {
        const packageContent = await fs.promises.readFile(packagePath, 'utf-8');
        packageInfo = JSON.parse(packageContent);
      } catch {
        // No package.json or invalid JSON
      }

      return {
        projectPath,
        structure,
        packageInfo,
        analysis: {
          totalFiles: structure.files,
          totalDirectories: structure.directories,
          hasPackageJson: !!packageInfo,
          projectType: this.detectProjectType(packageInfo, structure),
          mainLanguages: this.detectLanguages(structure)
        }
      };
    } catch (error) {
      throw new Error(`Failed to analyze project: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async getProjectStructure(dirPath: string, depth = 0): Promise<any> {
    if (depth > 3) return null; // Limit recursion

    try {
      const items = await fs.promises.readdir(dirPath, { withFileTypes: true });
      const structure = {
        files: 0,
        directories: 0,
        children: {} as Record<string, any>
      };

      for (const item of items) {
        if (item.name.startsWith('.')) continue; // Skip hidden files
        
        const itemPath = path.join(dirPath, item.name);
        
        if (item.isDirectory()) {
          structure.directories++;
          if (depth < 2) {
            structure.children[item.name] = await this.getProjectStructure(itemPath, depth + 1);
          }
        } else {
          structure.files++;
          structure.children[item.name] = { type: 'file' };
        }
      }

      return structure;
    } catch {
      return null;
    }
  }

  private detectProjectType(packageInfo: any, structure: any): string {
    if (packageInfo) {
      if (packageInfo.dependencies?.react || packageInfo.devDependencies?.react) return 'React';
      if (packageInfo.dependencies?.vue || packageInfo.devDependencies?.vue) return 'Vue';
      if (packageInfo.dependencies?.angular || packageInfo.devDependencies?.angular) return 'Angular';
      if (packageInfo.dependencies?.electron || packageInfo.devDependencies?.electron) return 'Electron';
      if (packageInfo.dependencies?.express) return 'Express/Node.js';
      return 'Node.js';
    }

    // Check for other project types
    if (structure.children?.['Cargo.toml']) return 'Rust';
    if (structure.children?.['go.mod']) return 'Go';
    if (structure.children?.['requirements.txt'] || structure.children?.['pyproject.toml']) return 'Python';
    
    return 'Unknown';
  }

  private detectLanguages(structure: any): string[] {
    const languages = new Set<string>();
    this.collectLanguages(structure, languages);
    return Array.from(languages);
  }

  private collectLanguages(node: any, languages: Set<string>): void {
    if (!node?.children) return;

    for (const [name, child] of Object.entries(node.children)) {
      if (typeof child === 'object' && child !== null && (child as any).type === 'file') {
        const ext = path.extname(name).toLowerCase();
        switch (ext) {
          case '.js': case '.jsx': languages.add('JavaScript'); break;
          case '.ts': case '.tsx': languages.add('TypeScript'); break;
          case '.py': languages.add('Python'); break;
          case '.rs': languages.add('Rust'); break;
          case '.go': languages.add('Go'); break;
          case '.java': languages.add('Java'); break;
          case '.cpp': case '.cc': case '.cxx': languages.add('C++'); break;
          case '.c': languages.add('C'); break;
          case '.php': languages.add('PHP'); break;
          case '.rb': languages.add('Ruby'); break;
        }
      } else if (typeof child === 'object') {
        this.collectLanguages(child, languages);
      }
    }
  }
}

// Export singleton instance
export const toolRegistry = new ToolRegistry();
