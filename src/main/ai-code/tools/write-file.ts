/**
 * Write File Tool
 * Writes content to a file with support for relative and absolute paths
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ToolExecutor, ToolCallConfirmationDetails } from '../../types/ai-types';
import { projectContextBridge } from '../project-context-bridge';
import { CreateHistoryManager } from '../../codespace/create-history';

export class WriteFileTool implements ToolExecutor {
  name = 'write_file';
  description = 'Write content to a file. Supports relative paths (resolved against current project directory) and absolute paths.';
  dangerous = true;
  requiresConfirmation = false;

  async execute(params: { filePath: string; content: string }, signal?: AbortSignal, conversationId?: string): Promise<string> {
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
      // Check if file exists to determine backup strategy
      const fileExists = await fs.promises.access(resolvedPath).then(() => true).catch(() => false);
      
      // ALWAYS create backup before writing (no conditions)
      await this.createBackup(resolvedPath, fileExists, conversationId);
      console.log(`📚 Created backup for ${fileExists ? 'file modification' : 'file creation'}`);

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

  /**
   * Create a backup of the file before writing
   * This method ALWAYS creates a backup, regardless of project setup
   */
  private async createBackup(filePath: string, fileExists: boolean, conversationId?: string): Promise<void> {
    try {
      const projectPath = projectContextBridge.getCurrentProjectPath();
      const hasProject = projectContextBridge.hasCurrentProject();
      
      // Create backup directory in project root or current working directory
      const backupBaseDir = hasProject && projectPath 
        ? path.join(projectPath, '.backup') 
        : path.join(process.cwd(), '.backup');
      
      // Ensure backup directory exists
      await fs.promises.mkdir(backupBaseDir, { recursive: true });
      
      // Create conversation-based backup folder
      const backupFolderName = conversationId 
        ? `conversation-${conversationId}-backup`
        : `timestamp-${new Date().toISOString().replace(/[:.]/g, '-')}-backup`;
      const conversationBackupDir = path.join(backupBaseDir, backupFolderName);
      await fs.promises.mkdir(conversationBackupDir, { recursive: true });
      
      // Calculate relative path from project root for backup structure
      const relativePath = hasProject && projectPath 
        ? path.relative(projectPath, filePath)
        : path.relative(process.cwd(), filePath);
      
      const backupFilePath = path.join(conversationBackupDir, relativePath);
      const backupDir = path.dirname(backupFilePath);
      
      // Ensure backup directory structure exists
      await fs.promises.mkdir(backupDir, { recursive: true });
      
      if (fileExists) {
        // Copy existing file content to backup
        try {
          const fileContent = await fs.promises.readFile(filePath, 'utf-8');
          await fs.promises.writeFile(backupFilePath, fileContent, 'utf-8');
          console.log(`📚 Backed up existing file: ${filePath} -> ${backupFilePath}`);
        } catch (readError) {
          console.warn(`⚠️ Failed to read file for backup: ${readError instanceof Error ? readError.message : String(readError)}`);
          // Create empty backup file as fallback
          await fs.promises.writeFile(backupFilePath, '', 'utf-8');
          console.log(`📚 Created empty backup file as fallback: ${backupFilePath}`);
        }
      } else {
        // Create empty backup file for new file creation
        await fs.promises.writeFile(backupFilePath + '.init', '', 'utf-8');
        console.log(`📚 Created backup marker for new file: ${backupFilePath}.init`);
      }
      
      console.log(`✅ Backup created successfully in: ${conversationBackupDir}`);
      
    } catch (error) {
      // Log backup error but don't fail the write operation
      console.error(`❌ Failed to create backup: ${error instanceof Error ? error.message : String(error)}`);
      console.warn(`⚠️ Continuing with file write despite backup failure`);
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
