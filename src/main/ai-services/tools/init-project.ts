/**
 * Init Project Tool
 * Initializes a new project in the specified folder
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ToolExecutor } from '../../types/ai-types';

export class InitProjectTool implements ToolExecutor {
  name = 'init_project';
  description = 'Initialize a new project in the specified folder';
  dangerous = false;

  async execute(params: { folderPath: string }, signal?: AbortSignal, conversationId?: string): Promise<any> {
    const { folderPath } = params;
    
    if (!folderPath) {
      throw new Error('Folder path parameter is required');
    }

    try {
      // Check if .backup folder exists
      const backupPath = path.join(folderPath, '.backup');
      const backupExists = await this.checkBackupExists(backupPath);

      if (backupExists) {
        return {
          success: false,
          message: 'This project has already been initialized (`.backup` folder exists)',
          folderPath,
          alreadyInitialized: true
        };
      }

      // Create .backup folder
      await fs.promises.mkdir(backupPath, { recursive: true });

      return {
        success: true,
        message: 'Project initialized successfully (`.backup` folder created)',
        folderPath,
        backupPath
      };

    } catch (error) {
      throw new Error(`Failed to initialize project: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async checkBackupExists(backupPath: string): Promise<boolean> {
    try {
      const stats = await fs.promises.stat(backupPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }
}
