import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { PHPManager } from './php-manager';

export interface FolderInfo {
  path: string;
  exists: boolean;
  hasWordPress: boolean;
  hasIndexPhp: boolean;
  hasWpContent: boolean;
  hasWpAdmin: boolean;
  hasWpIncludes: boolean;
  hasHtmlFiles: boolean;
  htmlFileCount: number;
  phpFileCount: number;
  folderType: 'www' | 'wordpress' | 'mixed' | 'unknown';
  detectedRoot?: string;
  availableFiles?: string[];
  phpVersion?: string;
}

export interface ServerStatus {
  isRunning: boolean;
  port: number;
  url: string;
  pid?: number;
  folderPath?: string;
  error?: string;
}

export interface PHPInfo {
  version: string;
  path: string;
  isBundled: boolean;
  isAvailable: boolean;
  error?: string;
}

export class LocalServerManager {
  private mainWindow: BrowserWindow | null;
  private wordpressServerProcess: any = null;
  private wordpressServerPort = 8000;
  private wordpressServerFolder = '';
  private phpManager: PHPManager | null = null;

  constructor(mainWindow: BrowserWindow | null) {
    this.mainWindow = mainWindow;
  }

  /**
   * Initialize the local server manager
   */
  public async initialize(): Promise<void> {
    // Initialize PHP manager if not already done
    if (!this.phpManager) {
      this.phpManager = PHPManager.getInstance();
      await this.phpManager.initialize();
    }
  }

  /**
   * Register all server-related IPC handlers
   */
  public registerHandlers(): void {
    this.registerServerHandlers();
  }

  /**
   * Register WordPress server management handlers
   */
  private registerServerHandlers(): void {
    // Analyze WordPress folder
    ipcMain.handle('wp-server-analyze-folder', async (event, folderPath) => {
      try {
        if (!fs.existsSync(folderPath)) {
          return { success: false, error: 'Folder does not exist' };
        }

        // Detect the best serving root
        const actualServingRoot = this.detectBestServingRoot(folderPath);

        // Analyze the actual serving root
        const hasIndexPhp = fs.existsSync(
          path.join(actualServingRoot, 'index.php'),
        );
        const hasWpContent = fs.existsSync(
          path.join(actualServingRoot, 'wp-content'),
        );
        const hasWpAdmin = fs.existsSync(path.join(actualServingRoot, 'wp-admin'));
        const hasWpIncludes = fs.existsSync(
          path.join(actualServingRoot, 'wp-includes'),
        );

        // Get file counts from the serving root
        const files = fs.readdirSync(actualServingRoot);
        const htmlFiles = files.filter(
          (file) => file.endsWith('.html') || file.endsWith('.htm'),
        );
        const phpFiles = files.filter((file) => file.endsWith('.php'));

        const htmlFileCount = htmlFiles.length;
        const phpFileCount = phpFiles.length;
        const hasHtmlFiles = htmlFileCount > 0;

        // Determine folder type and server compatibility
        let folderType: 'www' | 'wordpress' | 'mixed' | 'unknown' = 'unknown';
        let hasWordPress = false;
        const detectedRoot: string | undefined = actualServingRoot;

        // Traditional WordPress detection
        const isTraditionalWordPress =
          hasIndexPhp && hasWpContent && (hasWpAdmin || hasWpIncludes);

        // www folder detection (HTML files present)
        const isWwwFolder = actualServingRoot.includes('www') && htmlFileCount > 0;

        // Any folder with files can be served by PHP server
        const hasAnyServeableFiles =
          htmlFileCount > 0 || phpFileCount > 0 || files.length > 0;

        if (isTraditionalWordPress && hasHtmlFiles) {
          folderType = 'mixed';
          hasWordPress = true;
        } else if (isTraditionalWordPress) {
          folderType = 'wordpress';
          hasWordPress = true;
        } else if (isWwwFolder || hasHtmlFiles) {
          folderType = 'www';
          hasWordPress = true; // www folders are valid for PHP server
        } else if (hasAnyServeableFiles) {
          folderType = 'unknown';
          hasWordPress = true; // Any folder with files can be served
        } else {
          folderType = 'unknown';
          hasWordPress = false;
        }

        // Check PHP version if available
        let phpVersion: string | undefined;
        try {
          const { execSync } = require('child_process');
          const version = execSync('/opt/homebrew/bin/php -v', {
            encoding: 'utf8',
          });
          phpVersion = version.split('\n')[0];
        } catch (error) {
          phpVersion = 'PHP not available';
        }

        return {
          success: true,
          info: {
            path: folderPath,
            exists: true,
            hasWordPress,
            hasIndexPhp,
            hasWpContent,
            hasWpAdmin,
            hasWpIncludes,
            hasHtmlFiles,
            htmlFileCount,
            phpFileCount,
            folderType,
            detectedRoot,
            availableFiles: htmlFiles.concat(phpFiles).slice(0, 10), // Limit to first 10 files
            phpVersion,
          },
        };
      } catch (error) {
        console.error('Error analyzing WordPress folder:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Start WordPress server
    ipcMain.handle('wp-server-start', async (event, folderPath, port = 8000) => {
      try {
        if (this.wordpressServerProcess) {
          return { success: false, error: 'Server is already running' };
        }

        if (!fs.existsSync(folderPath)) {
          return { success: false, error: 'Folder does not exist' };
        }

        // Initialize PHP manager if not already done
        if (!this.phpManager) {
          this.phpManager = PHPManager.getInstance();
          await this.phpManager.initialize();
        }

        // Check if PHP is available
        if (!this.phpManager.isPHPAvailable()) {
          const phpInfo = this.phpManager.getPHPInfo();
          return {
            success: false,
            error: `PHP not available: ${phpInfo?.error || 'Unknown error'}`,
          };
        }

        // Detect the best serving root (like wordpress-server.js does)
        const actualServingRoot = this.detectBestServingRoot(folderPath);
        const phpInfo = this.phpManager.getPHPInfo();

        // Check what we're serving (similar to wordpress-server.js logic)
        const files = fs.readdirSync(actualServingRoot);
        const htmlFiles = files.filter(
          (f) => f.endsWith('.html') || f.endsWith('.htm'),
        );
        const phpFiles = files.filter((f) => f.endsWith('.php'));
        const folders = files.filter((f) =>
          fs.statSync(path.join(actualServingRoot, f)).isDirectory(),
        );

        // Use PHP manager to spawn the server
        this.wordpressServerProcess = this.phpManager.spawnPHPServer(port, actualServingRoot);

        this.wordpressServerPort = port;
        this.wordpressServerFolder = actualServingRoot;

        this.wordpressServerProcess.stdout.on('data', (data: Buffer) => {
          console.log('WordPress Server:', data.toString());
        });

        this.wordpressServerProcess.stderr.on('data', (data: Buffer) => {
          const text = data.toString();
          // Classify stderr output: PHP engine errors vs. normal access logs
          const isPhpError = /(PHP\s+(Warning|Fatal error|Parse error|Notice|Deprecated|Recoverable fatal error))/i.test(text);
          // Built-in PHP server access logs look like: "[::1]:60550 [200]: GET /path"
          // Only treat 4xx/5xx as errors
          const isHttpErrorStatus = /\[(4\d{2}|5\d{2})\]:/.test(text);

          if (isPhpError || isHttpErrorStatus) {
            console.error('WordPress Server Error:', text);
          } else {
            // Suppress non-error stderr lines (e.g., 2xx/3xx access logs)
            return;
          }
        });

        this.wordpressServerProcess.on('close', (code: number) => {
          console.log(`WordPress Server stopped with code ${code}`);
          this.wordpressServerProcess = null;
        });

        this.wordpressServerProcess.on('error', (error: Error) => {
          console.error('WordPress Server spawn error:', error);
          this.wordpressServerProcess = null;
        });

        // Wait a bit for server to start
        await new Promise((resolve) => setTimeout(resolve, 1000));

        return {
          success: true,
          port,
          phpInfo: {
            version: phpInfo?.version,
            isBundled: phpInfo?.isBundled,
            path: phpInfo?.path,
          },
        };
      } catch (error) {
        console.error('Error starting WordPress server:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Stop WordPress server
    ipcMain.handle('wp-server-stop', async (event) => {
      try {
        if (this.wordpressServerProcess) {
          this.wordpressServerProcess.kill();
          this.wordpressServerProcess = null;
          return { success: true };
        }
        return { success: false, error: 'No server running' };
      } catch (error) {
        console.error('Error stopping WordPress server:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Get WordPress server status
    ipcMain.handle('wp-server-status', async (event) => {
      try {
        return {
          success: true,
          status: {
            isRunning: !!this.wordpressServerProcess,
            port: this.wordpressServerPort,
            url: `http://localhost:${this.wordpressServerPort}`,
            folderPath: this.wordpressServerFolder,
            pid: this.wordpressServerProcess?.pid,
          },
        };
      } catch (error) {
        console.error('Error getting WordPress server status:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Get PHP information
    ipcMain.handle('wp-server-php-info', async (event) => {
      try {
        // Initialize PHP manager if not already done
        if (!this.phpManager) {
          this.phpManager = PHPManager.getInstance();
          await this.phpManager.initialize();
        }

        const phpInfo = this.phpManager.getPHPInfo();
        return {
          success: true,
          phpInfo: phpInfo || {
            version: 'Not initialized',
            path: '',
            isBundled: false,
            isAvailable: false,
            error: 'PHP manager not initialized',
          },
        };
      } catch (error) {
        console.error('Error getting PHP info:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Debug PHP detection
    ipcMain.handle('wp-server-debug-php', async (event) => {
      try {
        if (!this.phpManager) {
          this.phpManager = PHPManager.getInstance();
        }
        
        await this.phpManager.debugPHPDetection();
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Pick WordPress folder
    ipcMain.handle('wp-server-pick-folder', async (event) => {
      try {
        const result = await dialog.showOpenDialog(this.mainWindow!, {
          properties: ['openDirectory'],
          title: 'Select WordPress Folder',
        });

        if (!result.canceled && result.filePaths.length > 0) {
          return { success: true, folderPath: result.filePaths[0] };
        }
        return { success: false, error: 'No folder selected' };
      } catch (error) {
        console.error('Error picking WordPress folder:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });
  }

  /**
   * Helper function to detect the best serving root
   */
  private detectBestServingRoot(selectedPath: string): string {
    // Check if the selected path itself is a good serving root
    if (this.isGoodServingRoot(selectedPath)) {
      return selectedPath;
    }

    // Look for common subdirectories that should be served instead
    const possibleRoots = [
      path.join(selectedPath, 'www'), // Your FTP structure
      path.join(selectedPath, 'wordpress'), // Standard WordPress folder
      path.join(selectedPath, 'public_html'), // Common hosting structure
      path.join(selectedPath, 'public'), // Alternative hosting structure
      path.join(selectedPath, 'htdocs'), // XAMPP structure
      selectedPath, // Fallback to selected directory
    ];

    for (const root of possibleRoots) {
      if (this.isGoodServingRoot(root)) {
        console.log(`Detected best serving root: ${root}`);
        return root;
      }
    }

    // Default fallback to selected path
    console.log('No better serving root detected, using selected path');
    return selectedPath;
  }

  /**
   * Check if a directory is a good serving root
   */
  private isGoodServingRoot(dirPath: string): boolean {
    if (!fs.existsSync(dirPath)) {
      return false;
    }

    try {
      const files = fs.readdirSync(dirPath);

      // Check for WordPress core files
      const wordpressFiles = [
        'wp-config.php',
        'wp-config-sample.php',
        'wp-load.php',
        'wp-blog-header.php',
        'index.php',
      ];

      // Check for WordPress directories
      const wordpressDirs = ['wp-admin', 'wp-content', 'wp-includes'];

      // Check for HTML files (www folder structure)
      const htmlFiles = files.filter(
        (file) => file.endsWith('.html') || file.endsWith('.htm'),
      );

      // If it's a www folder with HTML files, it's likely your structure
      if (dirPath.includes('www') && htmlFiles.length > 0) {
        console.log(`Found www folder with ${htmlFiles.length} HTML files`);
        return true;
      }

      // Check for WordPress core files
      const hasWordPressFiles = wordpressFiles.some((file) =>
        fs.existsSync(path.join(dirPath, file)),
      );

      // Check for WordPress directories
      const hasWordPressDirs = wordpressDirs.some((dir) =>
        fs.existsSync(path.join(dirPath, dir)),
      );

      return hasWordPressFiles || hasWordPressDirs || htmlFiles.length > 0;
    } catch (error) {
      console.error('Error checking serving root:', error);
      return false;
    }
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    if (this.wordpressServerProcess) {
      this.wordpressServerProcess.kill();
      this.wordpressServerProcess = null;
    }
  }
}
