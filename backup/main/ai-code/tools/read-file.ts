/**
 * Read File Tool
 * Reads the contents of a file with support for relative and absolute paths
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ToolExecutor, ToolCallConfirmationDetails } from '../../types/ai-types';
import { projectContextBridge } from '../project-context-bridge';

export class ReadFileTool implements ToolExecutor {
  name = 'read_file';
  description = 'Read the contents of a file. Supports relative paths (resolved against current project directory) and absolute paths.';
  dangerous = false;

  async execute(params: { filePath: string }, signal?: AbortSignal, conversationId?: string): Promise<string> {
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
