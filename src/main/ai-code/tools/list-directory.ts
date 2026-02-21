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

  async execute(params: { dirPath?: string }, signal?: AbortSignal, conversationId?: string): Promise<Array<{name: string; type: string; path: string}>> {
    // Get project path from context
    const projectPath = projectContextBridge.getCurrentProjectPath();
    const hasProject = projectContextBridge.hasCurrentProject();

    let targetPath: string;

    if (!params.dirPath) {
      // No dirPath provided - use project directory
      console.log(`🔍 No dirPath provided. Project available: ${hasProject}, Project path: ${projectPath}`);
      targetPath = hasProject && projectPath ? projectPath : process.cwd();
      console.log(`✅ Using directory: ${targetPath}`);
    } else {
      // dirPath provided - resolve it against project path if relative
      if (path.isAbsolute(params.dirPath)) {
        targetPath = params.dirPath;
        console.log(`📂 Using absolute dirPath: ${targetPath}`);
      } else {
        // Relative path - resolve against project directory
        const basePath = hasProject && projectPath ? projectPath : process.cwd();
        targetPath = path.resolve(basePath, params.dirPath);
        console.log(`📂 Resolved relative dirPath "${params.dirPath}" to: ${targetPath} (base: ${basePath})`);
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
