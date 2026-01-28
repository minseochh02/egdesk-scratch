import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import { app, BrowserWindow } from 'electron';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import * as crypto from 'crypto';

const execAsync = promisify(exec);

interface PHPInstaller {
  checkDownloaded(): Promise<boolean>;
  downloadPHP(mainWindow: BrowserWindow | null): Promise<boolean>;
  ensurePHP(mainWindow: BrowserWindow | null): Promise<boolean>;
}

interface DownloadProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

interface PlatformInfo {
  platform: string;
  arch: string;
  downloadUrl: string;
  archiveName: string;
  extractedFolder: string;
}

export class PHPDownloadManager implements PHPInstaller {
  private static instance: PHPDownloadManager;
  private downloadInProgress = false;
  private currentDownload: https.ClientRequest | null = null;

  // GitHub release configuration
  private readonly GITHUB_OWNER = 'minseochh02';
  private readonly GITHUB_REPO = 'egdesk-scratch';
  private readonly PHP_VERSION = 'v1.0.0-php'; // Tag for PHP binaries release

  private constructor() {}

  public static getInstance(): PHPDownloadManager {
    if (!PHPDownloadManager.instance) {
      PHPDownloadManager.instance = new PHPDownloadManager();
    }
    return PHPDownloadManager.instance;
  }

  /**
   * Get the download directory path in userData
   */
  private getDownloadDir(): string {
    return path.join(app.getPath('userData'), 'php-downloads');
  }

  /**
   * Get platform-specific info for PHP download
   */
  private getPlatformInfo(): PlatformInfo {
    const platform = os.platform();
    const arch = os.arch();

    let platformKey: string;
    let archKey: string;
    let extension: string;

    if (platform === 'darwin') {
      platformKey = 'macos';
      archKey = arch === 'arm64' ? 'arm64' : 'x64';
      extension = 'tar.gz';
    } else if (platform === 'win32') {
      platformKey = 'windows';
      archKey = arch === 'x64' ? 'x64' : 'x86';
      extension = 'zip';
    } else if (platform === 'linux') {
      platformKey = 'linux';
      archKey = arch === 'arm64' || arch === 'aarch64' ? 'arm64' : 'x64';
      extension = 'tar.gz';
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    const archiveName = `php-${platformKey}-${archKey}.${extension}`;
    const downloadUrl = `https://github.com/${this.GITHUB_OWNER}/${this.GITHUB_REPO}/releases/download/${this.PHP_VERSION}/${archiveName}`;
    const extractedFolder = `${platformKey}-${archKey}`;

    return {
      platform: platformKey,
      arch: archKey,
      downloadUrl,
      archiveName,
      extractedFolder,
    };
  }

  /**
   * Get the PHP binary path for the downloaded PHP
   */
  public getDownloadedPHPPath(): string | null {
    try {
      const platformInfo = this.getPlatformInfo();
      const downloadDir = this.getDownloadDir();
      const phpDir = path.join(downloadDir, platformInfo.extractedFolder);

      const binaryName = os.platform() === 'win32' ? 'php.exe' : 'php';
      const phpPath = path.join(phpDir, binaryName);

      if (fs.existsSync(phpPath)) {
        return phpPath;
      }

      // Also check for php-launcher (Unix systems)
      if (os.platform() !== 'win32') {
        const launcherPath = path.join(phpDir, 'php-launcher');
        if (fs.existsSync(launcherPath)) {
          return launcherPath;
        }
      }

      return null;
    } catch (error) {
      console.error('Error getting downloaded PHP path:', error);
      return null;
    }
  }

  /**
   * Check if PHP is already downloaded
   */
  async checkDownloaded(): Promise<boolean> {
    const phpPath = this.getDownloadedPHPPath();
    if (!phpPath || !fs.existsSync(phpPath)) {
      return false;
    }

    // Verify PHP works
    try {
      if (os.platform() !== 'win32') {
        // Ensure executable permission
        fs.chmodSync(phpPath, 0o755);
      }

      const { stdout } = await execAsync(`"${phpPath}" -v`, {
        timeout: 5000,
        cwd: path.dirname(phpPath),
      });

      return stdout.includes('PHP');
    } catch (error) {
      console.error('Downloaded PHP verification failed:', error);
      return false;
    }
  }

  /**
   * Download PHP from GitHub releases
   */
  async downloadPHP(mainWindow: BrowserWindow | null): Promise<boolean> {
    if (this.downloadInProgress) {
      console.log('Download already in progress');
      return false;
    }

    this.downloadInProgress = true;

    try {
      const platformInfo = this.getPlatformInfo();
      const downloadDir = this.getDownloadDir();

      // Create download directory if it doesn't exist
      if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir, { recursive: true });
      }

      const archivePath = path.join(downloadDir, platformInfo.archiveName);
      const extractPath = path.join(downloadDir, platformInfo.extractedFolder);

      // Check if already extracted
      if (await this.checkDownloaded()) {
        console.log('PHP already downloaded and verified');
        this.downloadInProgress = false;
        return true;
      }

      // Download archive
      console.log(`Downloading PHP from: ${platformInfo.downloadUrl}`);
      const downloadSuccess = await this.downloadFile(
        platformInfo.downloadUrl,
        archivePath,
        mainWindow
      );

      if (!downloadSuccess) {
        this.downloadInProgress = false;
        return false;
      }

      // Extract archive
      console.log(`Extracting PHP to: ${extractPath}`);
      await this.extractArchive(archivePath, downloadDir, platformInfo);

      // Clean up archive
      if (fs.existsSync(archivePath)) {
        fs.unlinkSync(archivePath);
      }

      // Verify extraction
      const phpPath = this.getDownloadedPHPPath();
      if (!phpPath || !fs.existsSync(phpPath)) {
        throw new Error('PHP binary not found after extraction');
      }

      // Set executable permissions on Unix
      if (os.platform() !== 'win32') {
        this.setExecutablePermissions(extractPath);
      }

      // Verify PHP works
      const verified = await this.checkDownloaded();
      if (!verified) {
        throw new Error('Downloaded PHP verification failed');
      }

      console.log('PHP downloaded and verified successfully');

      // Notify completion
      if (mainWindow) {
        mainWindow.webContents.send('php:download-complete', {
          success: true,
          path: phpPath,
        });
      }

      this.downloadInProgress = false;
      return true;
    } catch (error) {
      console.error('PHP download failed:', error);

      if (mainWindow) {
        mainWindow.webContents.send('php:download-error', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      this.downloadInProgress = false;
      return false;
    }
  }

  /**
   * Download file with progress tracking
   */
  private downloadFile(
    url: string,
    destination: string,
    mainWindow: BrowserWindow | null
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destination);
      let downloadedBytes = 0;
      let totalBytes = 0;
      let lastProgressTime = Date.now();
      let lastDownloadedBytes = 0;

      this.currentDownload = https.get(url, (response) => {
        // Handle redirects
        if (response.statusCode === 302 || response.statusCode === 301) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            file.close();
            resolve(this.downloadFile(redirectUrl, destination, mainWindow));
            return;
          }
        }

        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(destination);
          reject(new Error(`Download failed with status code: ${response.statusCode}`));
          return;
        }

        totalBytes = parseInt(response.headers['content-length'] || '0', 10);

        response.on('data', (chunk: Buffer) => {
          downloadedBytes += chunk.length;
          file.write(chunk);

          // Emit progress every 500ms
          const now = Date.now();
          if (now - lastProgressTime >= 500) {
            const bytesPerSecond = (downloadedBytes - lastDownloadedBytes) / ((now - lastProgressTime) / 1000);
            const percent = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0;

            if (mainWindow) {
              mainWindow.webContents.send('php:download-progress', {
                percent,
                transferred: downloadedBytes,
                total: totalBytes,
                bytesPerSecond,
              });
            }

            lastProgressTime = now;
            lastDownloadedBytes = downloadedBytes;
          }
        });

        response.on('end', () => {
          file.end();

          // Send final progress
          if (mainWindow) {
            mainWindow.webContents.send('php:download-progress', {
              percent: 100,
              transferred: totalBytes,
              total: totalBytes,
              bytesPerSecond: 0,
            });
          }

          resolve(true);
        });

        response.on('error', (err) => {
          file.close();
          if (fs.existsSync(destination)) {
            fs.unlinkSync(destination);
          }
          reject(err);
        });
      });

      this.currentDownload.on('error', (err) => {
        file.close();
        if (fs.existsSync(destination)) {
          fs.unlinkSync(destination);
        }
        reject(err);
      });

      file.on('error', (err) => {
        file.close();
        if (fs.existsSync(destination)) {
          fs.unlinkSync(destination);
        }
        reject(err);
      });
    });
  }

  /**
   * Extract archive (tar.gz or zip)
   */
  private async extractArchive(
    archivePath: string,
    extractBase: string,
    platformInfo: PlatformInfo
  ): Promise<void> {
    const platform = os.platform();
    const extractPath = path.join(extractBase, platformInfo.extractedFolder);

    // Create extract directory
    if (!fs.existsSync(extractPath)) {
      fs.mkdirSync(extractPath, { recursive: true });
    }

    if (platform === 'win32') {
      // Windows: Use PowerShell to extract zip
      await execAsync(
        `powershell -command "Expand-Archive -Path '${archivePath}' -DestinationPath '${extractPath}' -Force"`
      );
    } else {
      // Unix: Use tar
      await execAsync(`tar -xzf "${archivePath}" -C "${extractPath}" --strip-components=1`);
    }
  }

  /**
   * Set executable permissions for PHP binary and dependencies
   */
  private setExecutablePermissions(phpDir: string): void {
    try {
      // Set permissions on PHP binary
      const phpPath = path.join(phpDir, 'php');
      if (fs.existsSync(phpPath)) {
        fs.chmodSync(phpPath, 0o755);
      }

      // Set permissions on launcher
      const launcherPath = path.join(phpDir, 'php-launcher');
      if (fs.existsSync(launcherPath)) {
        fs.chmodSync(launcherPath, 0o755);
      }

      // Set permissions on lib directory (for dynamic libraries on macOS)
      const libDir = path.join(phpDir, 'lib');
      if (fs.existsSync(libDir)) {
        const files = fs.readdirSync(libDir);
        files.forEach((file) => {
          const filePath = path.join(libDir, file);
          if (fs.statSync(filePath).isFile()) {
            fs.chmodSync(filePath, 0o755);
          }
        });
      }
    } catch (error) {
      console.error('Error setting executable permissions:', error);
    }
  }

  /**
   * Ensure PHP is available (check or download)
   */
  async ensurePHP(mainWindow: BrowserWindow | null): Promise<boolean> {
    const isDownloaded = await this.checkDownloaded();
    if (isDownloaded) {
      return true;
    }

    return await this.downloadPHP(mainWindow);
  }

  /**
   * Cancel ongoing download
   */
  cancelDownload(): void {
    if (this.currentDownload) {
      this.currentDownload.destroy();
      this.currentDownload = null;
    }
    this.downloadInProgress = false;
  }

  /**
   * Check if download is in progress
   */
  isDownloading(): boolean {
    return this.downloadInProgress;
  }

  /**
   * Get download directory for external access
   */
  getDownloadDirectory(): string {
    return this.getDownloadDir();
  }
}
