/**
 * Write File Tool
 * Writes content to a file with support for relative and absolute paths
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ToolExecutor, ToolCallConfirmationDetails } from '../../types/ai-types';
import { projectContextBridge } from '../project-context-bridge';

export class WriteFileTool implements ToolExecutor {
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
