import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn, execSync } from 'child_process';

export interface PHPInfo {
  version: string;
  path: string;
  isBundled: boolean;
  isAvailable: boolean;
  error?: string;
}

export class PHPManager {
  private static instance: PHPManager;

  private bundledPHPPath: string | null = null;

  private systemPHPPath: string | null = null;

  private phpInfo: PHPInfo | null = null;

  private constructor() {}

  public static getInstance(): PHPManager {
    if (!PHPManager.instance) {
      PHPManager.instance = new PHPManager();
    }
    return PHPManager.instance;
  }

  /**
   * Initialize PHP manager and detect available PHP installations
   */
  public async initialize(): Promise<PHPInfo> {
    try {
      console.log('🔍 Initializing PHP Manager...');

      // First, try to find system PHP (prioritize system over bundled)
      console.log('Looking for system PHP...');
      const systemPHP = await this.findSystemPHP();
      if (systemPHP) {
        console.log(`✅ Found system PHP: ${systemPHP}`);
        this.systemPHPPath = systemPHP;
        this.phpInfo = await this.getPHPVersionInfo(systemPHP, false);
        if (this.phpInfo.isAvailable) {
          return this.phpInfo;
        }
        console.log('⚠️ System PHP found but not working, trying bundled...');
      }
      console.log('❌ No working system PHP found');

      // Fallback to bundled PHP
      console.log('Looking for bundled PHP...');
      const bundledPHP = await this.findBundledPHP();
      if (bundledPHP) {
        console.log(`✅ Found bundled PHP: ${bundledPHP}`);
        this.bundledPHPPath = bundledPHP;
        this.phpInfo = await this.getPHPVersionInfo(bundledPHP, true);
        if (this.phpInfo.isAvailable) {
          return this.phpInfo;
        }
        console.log('⚠️ Bundled PHP found but not working');
      }
      console.log('❌ No working bundled PHP found');

      // No PHP found
      console.log('❌ No working PHP installation found anywhere');
      this.phpInfo = {
        version: 'Not found',
        path: '',
        isBundled: false,
        isAvailable: false,
        error:
          'No working PHP installation found. Please install PHP or run "npm run php:download" to download bundled PHP.',
      };
      return this.phpInfo;
    } catch (error) {
      console.error('Error initializing PHP manager:', error);
      this.phpInfo = {
        version: 'Error',
        path: '',
        isBundled: false,
        isAvailable: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      return this.phpInfo;
    }
  }

  /**
   * Get the best available PHP path
   */
  public getPHPPath(): string | null {
    return this.bundledPHPPath || this.systemPHPPath;
  }

  /**
   * Get current PHP info
   */
  public getPHPInfo(): PHPInfo | null {
    return this.phpInfo;
  }

  /**
   * Check if PHP is available
   */
  public isPHPAvailable(): boolean {
    return this.phpInfo?.isAvailable || false;
  }

  /**
   * Check if using bundled PHP
   */
  public isUsingBundledPHP(): boolean {
    return this.bundledPHPPath !== null;
  }

  /**
   * Find bundled PHP executable (cross-platform)
   */
  private async findBundledPHP(): Promise<string | null> {
    const platform = os.platform();
    const arch = os.arch();

    console.log(`🔍 Detecting system: ${platform}-${arch}`);

    // Determine the correct PHP binary name and directory structure
    let phpBinaryName: string;
    let platformKey: string;
    let launcherName: string;

    if (platform === 'win32') {
      phpBinaryName = 'php.exe';
      platformKey = 'windows';
      launcherName = 'php.bat';
    } else if (platform === 'darwin') {
      phpBinaryName = 'php';
      platformKey = 'macos';
      launcherName = 'php-launcher';
    } else {
      phpBinaryName = 'php';
      platformKey = 'linux';
      launcherName = 'php-launcher';
    }

    // Determine architecture directory
    let archDir: string;
    if (arch === 'x64' || arch === 'amd64') {
      archDir = 'x64';
    } else if (arch === 'arm64' || arch === 'aarch64') {
      archDir = 'arm64';
    } else if (arch === 'x86' || arch === 'ia32') {
      archDir = 'x86';
    } else {
      archDir = 'x64'; // Default fallback
    }

    console.log(`📁 Looking for PHP in: ${platformKey}/${archDir}`);

    // Check production build path first
    const prodPhpDir = path.join(
      process.resourcesPath,
      'php-bundle',
      platformKey,
      archDir,
    );
    const prodPhpPath = path.join(prodPhpDir, phpBinaryName);
    const prodLauncher = path.join(prodPhpDir, launcherName);

    try {
      if (fs.existsSync(prodPhpPath)) {
        if (platform !== 'win32') {
          fs.chmodSync(prodPhpPath, 0o755);
        }
        console.log(`✅ Found production bundled PHP: ${prodPhpPath}`);
        return prodPhpPath;
      }

      if (fs.existsSync(prodLauncher)) {
        if (platform !== 'win32') {
          fs.chmodSync(prodLauncher, 0o755);
        }
        console.log(
          `✅ Found production bundled PHP launcher: ${prodLauncher}`,
        );
        return prodLauncher;
      }
    } catch (error) {
      console.warn('Error checking production PHP:', error);
    }

    // Check development directory
    const devPhpDir = path.join(
      __dirname,
      '..',
      '..',
      'php-bundle',
      platformKey,
      archDir,
    );
    const devPhpPath = path.join(devPhpDir, phpBinaryName);
    const devLauncher = path.join(devPhpDir, launcherName);

    try {
      if (fs.existsSync(devPhpPath)) {
        if (platform !== 'win32') {
          fs.chmodSync(devPhpPath, 0o755);
        }
        console.log(`✅ Found development bundled PHP: ${devPhpPath}`);
        return devPhpPath;
      }

      if (fs.existsSync(devLauncher)) {
        if (platform !== 'win32') {
          fs.chmodSync(devLauncher, 0o755);
        }
        console.log(
          `✅ Found development bundled PHP launcher: ${devLauncher}`,
        );
        return devLauncher;
      }
    } catch (error) {
      console.warn('Error checking development PHP:', error);
    }

    // Fallback to old structure (for backward compatibility)
    const oldDevPhpDir = path.join(__dirname, '..', '..', 'php-bundle');
    const oldDevPhpPath = path.join(oldDevPhpDir, 'php');
    const oldDevLauncher = path.join(oldDevPhpDir, 'php-launcher');

    try {
      if (fs.existsSync(oldDevPhpPath)) {
        if (platform !== 'win32') {
          fs.chmodSync(oldDevPhpPath, 0o755);
        }
        console.log(`✅ Found legacy bundled PHP: ${oldDevPhpPath}`);
        return oldDevPhpPath;
      }

      if (fs.existsSync(oldDevLauncher)) {
        if (platform !== 'win32') {
          fs.chmodSync(oldDevLauncher, 0o755);
        }
        console.log(`✅ Found legacy bundled PHP launcher: ${oldDevLauncher}`);
        return oldDevLauncher;
      }
    } catch (error) {
      console.warn('Error checking legacy PHP:', error);
    }

    console.log(`❌ No bundled PHP found for ${platformKey}/${archDir}`);
    return null;
  }

  /**
   * Find system PHP installation
   */
  private async findSystemPHP(): Promise<string | null> {
    const platform = os.platform();
    const possiblePaths = [];

    if (platform === 'win32') {
      // Use environment variables for better cross-platform compatibility
      const programFiles = process.env.PROGRAMFILES || 'C:\\Program Files';
      const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
      const systemDrive = process.env.SYSTEMDRIVE || 'C:';
      
      possiblePaths.push(
        path.join(systemDrive, 'php', 'php.exe'),
        path.join(systemDrive, 'xampp', 'php', 'php.exe'),
        path.join(systemDrive, 'wamp64', 'bin', 'php', 'php8.3.0', 'php.exe'),
        path.join(programFiles, 'PHP', 'php.exe'),
        path.join(programFilesX86, 'PHP', 'php.exe'),
        path.join(systemDrive, 'tools', 'php', 'php.exe'),
        // Additional common locations
        path.join(systemDrive, 'laragon', 'bin', 'php', 'php8.3.0', 'php.exe'),
        path.join(systemDrive, 'laragon', 'bin', 'php', 'php8.2.0', 'php.exe'),
        path.join(systemDrive, 'laragon', 'bin', 'php', 'php8.1.0', 'php.exe'),
        // More XAMPP/WAMP variations
        path.join(systemDrive, 'xampp', 'php', 'php8.3.0', 'php.exe'),
        path.join(systemDrive, 'xampp', 'php', 'php8.2.0', 'php.exe'),
        path.join(systemDrive, 'wamp64', 'bin', 'php', 'php8.2.0', 'php.exe'),
        path.join(systemDrive, 'wamp64', 'bin', 'php', 'php8.1.0', 'php.exe'),
      );
    } else if (platform === 'darwin') {
      possiblePaths.push(
        '/opt/homebrew/bin/php',
        '/usr/local/bin/php',
        '/usr/bin/php',
        '/Applications/XAMPP/xamppfiles/bin/php',
        '/Applications/MAMP/bin/php/php8.3.0/bin/php',
        '/opt/local/bin/php', // MacPorts
      );
    } else {
      possiblePaths.push(
        '/usr/bin/php',
        '/usr/local/bin/php',
        '/opt/php/bin/php',
        '/snap/bin/php',
        '/usr/bin/php8.3',
        '/usr/bin/php8.2',
        '/usr/bin/php8.1',
      );
    }

    // Try to find PHP in PATH first (most reliable)
    try {
      let phpPath: string;
      if (platform === 'win32') {
        // Use 'where' command on Windows
        phpPath = execSync('where php', { encoding: 'utf8' }).trim().split('\n')[0];
      } else {
        phpPath = execSync('which php', { encoding: 'utf8' }).trim();
      }
      
      if (phpPath && fs.existsSync(phpPath)) {
        console.log(`✅ Found PHP in PATH: ${phpPath}`);
        return phpPath;
      }
    } catch (error) {
      // PHP not in PATH
    }

    // Check common installation paths
    for (const phpPath of possiblePaths) {
      try {
        if (fs.existsSync(phpPath)) {
          // Test if it's executable with better error handling
          const result = execSync(`"${phpPath}" -v`, { 
            stdio: 'pipe',
            timeout: 5000, // 5 second timeout
            cwd: path.dirname(phpPath) // Run from PHP directory for DLL lookup
          });
          console.log(`✅ Found working PHP at: ${phpPath}`);
          return phpPath;
        }
      } catch (error) {
        // Continue to next path, but log the error for debugging
        console.log(`⚠️ PHP at ${phpPath} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log('❌ No system PHP found in common locations');
    return null;
  }

  /**
   * Get PHP version and info
   */
  private async getPHPVersionInfo(
    phpPath: string,
    isBundled: boolean,
  ): Promise<PHPInfo> {
    try {
      // On Windows, run from the PHP directory to help with DLL lookup
      const options: any = { 
        encoding: 'utf8',
        timeout: 10000, // 10 second timeout
        stdio: 'pipe'
      };
      
      if (os.platform() === 'win32') {
        options.cwd = path.dirname(phpPath);
      }
      
      const versionOutput = execSync(`"${phpPath}" -v`, options);
      const version = versionOutput.split('\n')[0] || 'Unknown version';

      return {
        version,
        path: phpPath,
        isBundled,
        isAvailable: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`❌ PHP version check failed for ${phpPath}: ${errorMessage}`);
      
      return {
        version: 'Error',
        path: phpPath,
        isBundled,
        isAvailable: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Spawn PHP server process
   */
  public spawnPHPServer(port: number, documentRoot: string): any {
    const phpPath = this.getPHPPath();
    if (!phpPath) {
      throw new Error('No PHP installation available');
    }

    console.log(`Starting PHP server with: ${phpPath}`);
    console.log(`Port: ${port}, Document root: ${documentRoot}`);

    const platform = os.platform();
    const args = ['-S', `localhost:${port}`, '-t', documentRoot];

    // Add a router script for WordPress and pretty URLs
    // Router will forward non-existent paths to index.php while serving real files directly
    const routerPath = this.createOrGetRouterScript(documentRoot);
    if (routerPath) {
      args.push(routerPath);
      console.log(`Using PHP router script: ${routerPath}`);
    }

    // Windows-specific configuration
    if (platform === 'win32') {
      // Use development configuration for better compatibility
      const phpIniPath = path.join(path.dirname(phpPath), 'php.ini-development');
      if (fs.existsSync(phpIniPath)) {
        args.push('-c', phpIniPath);
      }
    }

    // Use a clean environment; let PHP's built-in server set per-request variables
    const env = {
      ...process.env,
      DOCUMENT_ROOT: documentRoot,
    };

    // On Windows, set cwd to PHP directory for DLL lookup, otherwise use document root
    const spawnCwd = platform === 'win32' ? path.dirname(phpPath) : documentRoot;

    return spawn(phpPath, args, {
      env,
      cwd: spawnCwd,
    });
  }

  /**
   * Create or reuse a PHP router script for the built-in server.
   * Returns absolute path to router script if created/available, otherwise null.
   */
  private createOrGetRouterScript(documentRoot: string): string | null {
    try {
      // Only create a router if an index.php exists (typical WordPress or PHP front controller)
      const indexPhpPath = path.join(documentRoot, 'index.php');
      if (!fs.existsSync(indexPhpPath)) {
        return null;
      }

      const routerFileName = '.egdesk-router.php';
      const routerPath = path.join(documentRoot, routerFileName);

      const routerContents = `<?php\n` +
        `$uri = urldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH));\n` +
        `$root = getcwd();\n` +
        `if ($uri !== '/' && file_exists($root . $uri)) {\n` +
        `  return false; // Serve the requested resource as-is\n` +
        `}\n` +
        `if (file_exists($root . '/index.php')) {\n` +
        `  require $root . '/index.php';\n` +
        `  return true;\n` +
        `}\n` +
        `return false;\n`;

      // Create or update if missing/changed
      let shouldWrite = true;
      if (fs.existsSync(routerPath)) {
        try {
          const current = fs.readFileSync(routerPath, 'utf8');
          if (current === routerContents) {
            shouldWrite = false;
          }
        } catch {}
      }
      if (shouldWrite) {
        fs.writeFileSync(routerPath, routerContents, { encoding: 'utf8' });
        try {
          fs.chmodSync(routerPath, 0o644);
        } catch {}
      }
      return routerPath;
    } catch (err) {
      console.warn('Failed to prepare PHP router script:', err);
      return null;
    }
  }

  /**
   * Download PHP binaries (for development/setup)
   */
  public async downloadPHPBinaries(): Promise<void> {
    // This would be used during the build process
    // Implementation depends on your build system
    console.log('PHP binaries should be downloaded during build process');
  }

  /**
   * Debug method to test PHP detection
   */
  public async debugPHPDetection(): Promise<void> {
    console.log('🔍 Debugging PHP detection...');
    console.log(`Platform: ${os.platform()}`);
    console.log(`Architecture: ${os.arch()}`);
    
    // Test system PHP
    console.log('\n--- Testing System PHP ---');
    const systemPHP = await this.findSystemPHP();
    if (systemPHP) {
      console.log(`✅ System PHP found: ${systemPHP}`);
      const systemInfo = await this.getPHPVersionInfo(systemPHP, false);
      console.log(`System PHP info:`, systemInfo);
    } else {
      console.log('❌ No system PHP found');
    }
    
    // Test bundled PHP
    console.log('\n--- Testing Bundled PHP ---');
    const bundledPHP = await this.findBundledPHP();
    if (bundledPHP) {
      console.log(`✅ Bundled PHP found: ${bundledPHP}`);
      const bundledInfo = await this.getPHPVersionInfo(bundledPHP, true);
      console.log(`Bundled PHP info:`, bundledInfo);
    } else {
      console.log('❌ No bundled PHP found');
    }
  }
}
