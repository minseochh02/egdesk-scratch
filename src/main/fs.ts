/**
 * File System IPC Handlers
 * Handles file system operations for the renderer process
 */

import { ipcMain, dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export function registerFileSystemHandlers(): void {
  console.log('📁 Registering file system IPC handlers...');

  // Pick folder dialog
  ipcMain.handle('fs-pick-folder', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select Project Folder'
      });

      if (result.canceled || result.filePaths.length === 0) {
        return {
          success: false,
          error: 'No folder selected'
        };
      }

      return {
        success: true,
        folderPath: result.filePaths[0]
      };
    } catch (error) {
      console.error('Error picking folder:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Read directory
  ipcMain.handle('fs-read-directory', async (event, dirPath: string) => {
    try {
      const items = await fs.promises.readdir(dirPath, { withFileTypes: true });
      const fileSystemItems = items.map(item => ({
        name: item.name,
        type: item.isDirectory() ? 'folder' : 'file',
        path: path.join(dirPath, item.name),
        isDirectory: item.isDirectory(),
        isFile: item.isFile(),
        isHidden: item.name.startsWith('.'),
        isSymlink: item.isSymbolicLink()
      }));

      return {
        success: true,
        items: fileSystemItems
      };
    } catch (error) {
      console.error('Error reading directory:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Get file info
  ipcMain.handle('fs-get-file-info', async (event, filePath: string) => {
    try {
      const stats = await fs.promises.stat(filePath);
      return {
        success: true,
        info: {
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          accessed: stats.atime,
          isDirectory: stats.isDirectory(),
          isFile: stats.isFile(),
          extension: path.extname(filePath),
          permissions: stats.mode
        }
      };
    } catch (error) {
      console.error('Error getting file info:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Get home directory
  ipcMain.handle('fs-get-home-directory', async () => {
    try {
      return os.homedir();
    } catch (error) {
      console.error('Error getting home directory:', error);
      throw error;
    }
  });

  // Get system directories
  ipcMain.handle('fs-get-system-directories', async () => {
    try {
      const homeDir = os.homedir();
      const systemDirs = [
        { name: 'Home', path: homeDir, icon: '🏠' },
        { name: 'Desktop', path: path.join(homeDir, 'Desktop'), icon: '🖥️' },
        { name: 'Documents', path: path.join(homeDir, 'Documents'), icon: '📄' },
        { name: 'Downloads', path: path.join(homeDir, 'Downloads'), icon: '⬇️' },
        { name: 'Pictures', path: path.join(homeDir, 'Pictures'), icon: '🖼️' },
        { name: 'Music', path: path.join(homeDir, 'Music'), icon: '🎵' },
        { name: 'Videos', path: path.join(homeDir, 'Videos'), icon: '🎬' }
      ];

      // Filter out directories that don't exist
      const existingDirs = systemDirs.filter(dir => {
        try {
          return fs.existsSync(dir.path);
        } catch {
          return false;
        }
      });

      return existingDirs;
    } catch (error) {
      console.error('Error getting system directories:', error);
      return [];
    }
  });

  // Create folder
  ipcMain.handle('fs-create-folder', async (event, folderPath: string) => {
    try {
      await fs.promises.mkdir(folderPath, { recursive: true });
      return {
        success: true
      };
    } catch (error) {
      console.error('Error creating folder:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Delete item
  ipcMain.handle('fs-delete-item', async (event, itemPath: string) => {
    try {
      const stats = await fs.promises.stat(itemPath);
      if (stats.isDirectory()) {
        await fs.promises.rmdir(itemPath, { recursive: true });
      } else {
        await fs.promises.unlink(itemPath);
      }
      return {
        success: true
      };
    } catch (error) {
      console.error('Error deleting item:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Rename item
  ipcMain.handle('fs-rename-item', async (event, oldPath: string, newPath: string) => {
    try {
      await fs.promises.rename(oldPath, newPath);
      return {
        success: true
      };
    } catch (error) {
      console.error('Error renaming item:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Read file
  ipcMain.handle('fs-read-file', async (event, filePath: string) => {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return {
        success: true,
        content
      };
    } catch (error) {
      console.error('Error reading file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Write file
  ipcMain.handle('fs-write-file', async (event, filePath: string, content: string) => {
    try {
      await fs.promises.writeFile(filePath, content, 'utf-8');
      return {
        success: true
      };
    } catch (error) {
      console.error('Error writing file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  console.log('✅ File system IPC handlers registered');
}
