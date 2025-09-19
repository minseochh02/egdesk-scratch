/**
 * List Directory Tool
 * Lists files and directories in a path
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ToolExecutor } from '../../types/ai-types';
import { projectContextBridge } from '../project-context-bridge';

export class ListDirectoryTool implements ToolExecutor {
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
