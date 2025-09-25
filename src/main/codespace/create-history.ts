/**
 * Create History Utility
 * Creates a history file at the specified path with backup functionality
 */

import * as fs from 'fs';
import * as path from 'path';
import { projectContextBridge } from '../ai-code/project-context-bridge';

export interface CreateHistoryParams {
  path: string;
  isInit: boolean;
  conversationId?: string;
}

export class CreateHistoryManager {
  async createHistory(params: CreateHistoryParams): Promise<string> {
    if (!params.path) {
      throw new Error('path parameter is required');
    }

    // Find .backup folder of the current project
    const projectPath = projectContextBridge.getCurrentProjectPath();
    const hasProject = projectContextBridge.hasCurrentProject();
    
    let backupPath: string | null = null;
    if (hasProject && projectPath) {
      backupPath = path.join(projectPath, '.backup');
      try {
        const backupExists = await fs.promises.access(backupPath).then(() => true).catch(() => false);
        if (!backupExists) {
          backupPath = null;
        }
      } catch (error) {
        backupPath = null;
      }
    }

    // Resolve relative paths against project directory
    let resolvedPath = params.path;
    if (!path.isAbsolute(params.path)) {
      console.log(`📝 Creating history file: ${params.path}. Project available: ${hasProject}, Project path: ${projectPath}`);
      
      if (hasProject && projectPath && projectPath !== process.cwd()) {
        resolvedPath = path.resolve(projectPath, params.path);
        console.log(`✅ Resolved to project file: ${resolvedPath}`);
      } else {
        resolvedPath = path.resolve(process.cwd(), params.path);
        console.log(`⚠️ Resolved to cwd file: ${resolvedPath}`);
      }
    }

    // Log backup folder information
    if (backupPath) {
      console.log(`📁 Found .backup folder: ${backupPath}`);
    } else {
      console.log(`⚠️ No .backup folder found in project`);
    }

    // Create conversation-based backup folder
    const backupFolderName = params.conversationId 
      ? `conversation-${params.conversationId}-backup`
      : `timestamp-${new Date().toISOString().replace(/[:.]/g, '-')}-backup`;
    const conversationBackupPath = path.join(projectPath || process.cwd(), backupFolderName);
    
    try {
      await fs.promises.mkdir(conversationBackupPath, { recursive: true });
      console.log(`📁 Created conversation backup folder: ${conversationBackupPath}`);
      
      // Create the same file structure under the conversation backup folder
      let backupFilePath = path.join(conversationBackupPath, params.path);
      
      // If isInit is true, add .init extension to mark this as an initial creation
      if (params.isInit) {
        backupFilePath += '.init';
      }
      
      const backupDir = path.dirname(backupFilePath);
      
      // Ensure backup directory exists
      await fs.promises.mkdir(backupDir, { recursive: true });
      
      if (params.isInit) {
        // Create empty file in backup location for initial creation
        await fs.promises.writeFile(backupFilePath, '', 'utf-8');
        console.log(`📝 Created empty backup file: ${backupFilePath}`);
      } else {
        // Copy actual file content to backup location
        try {
          const fileContent = await fs.promises.readFile(resolvedPath, 'utf-8');
          await fs.promises.writeFile(backupFilePath, fileContent, 'utf-8');
          console.log(`📝 Copied file content to backup: ${backupFilePath}`);
        } catch (error) {
          console.error(`❌ Failed to copy file content: ${error instanceof Error ? error.message : String(error)}`);
          // Fallback to empty file if copy fails
          await fs.promises.writeFile(backupFilePath, '', 'utf-8');
          console.log(`📝 Created empty backup file as fallback: ${backupFilePath}`);
        }
      }
      
    } catch (error) {
      console.error(`❌ Failed to create conversation backup folder: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      // Ensure directory exists
      const dir = path.dirname(resolvedPath);
      await fs.promises.mkdir(dir, { recursive: true });
      
      // Create empty history file
      await fs.promises.writeFile(resolvedPath, '', 'utf-8');
      const result = `Successfully created history file at ${resolvedPath}`;
      console.log(`📝 ${result}`);
      return result;
    } catch (error) {
      const errorMsg = `Failed to create history file '${resolvedPath}': ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}
