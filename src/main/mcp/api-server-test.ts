import { spawn, ChildProcess, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { getGoogleAuthHandler } from './google-auth-handler';

/**
 * Simple PHP Server Test
 * Finds PHP executable and starts a server with /hello endpoint
 */
export class SimplePHPServerTest {
  private phpServer: ChildProcess | null = null;
  private port: number = 8080;
  private publicDir: string = './public/mcp';
  private googleAuthHandler = getGoogleAuthHandler();

  constructor(port: number = 8080) {
    this.port = port;
  }

  /**
   * Find PHP executable path
   */
  private findPHP(): string | null {
    const possiblePaths = [
      '/opt/homebrew/bin/php',
      '/usr/bin/php',
      '/usr/local/bin/php',
      'php' // System PATH
    ];

    for (const phpPath of possiblePaths) {
      try {
        execSync(`${phpPath} -v`, { stdio: 'ignore' });
        console.log(`✅ Found PHP at: ${phpPath}`);
        return phpPath;
      } catch (error) {
        // Continue to next path
      }
    }

    console.error('❌ PHP not found in common locations');
    return null;
  }

  /**
   * Check if public directory exists and contains required files
   */
  private checkPublicDir(): boolean {
    if (!fs.existsSync(this.publicDir)) {
      console.error(`❌ Public directory not found: ${this.publicDir}`);
      return false;
    }

    const requiredFiles = ['hello.php', 'gmail.php'];
    for (const file of requiredFiles) {
      const filePath = path.join(this.publicDir, file);
      if (!fs.existsSync(filePath)) {
        console.error(`❌ Required file not found: ${filePath}`);
        return false;
      }
    }

    console.log(`✅ Public directory and required files found: ${this.publicDir}`);
    return true;
  }

  /**
   * Handle Gmail API requests
   */
  public async handleGmailRequest(): Promise<any> {
    try {
      console.log('📧 Handling Gmail API request...');
      
      // Check if user is signed in
      if (!this.googleAuthHandler.isSignedIn()) {
        return {
          success: false,
          error: 'User not authenticated. Please sign in with Google first.',
          message: 'Use the Electron app to sign in with Google before accessing Gmail API'
        };
      }

      // Fetch 10 Gmail messages
      const result = await this.googleAuthHandler.listMessages(10);
      
      if (result.success) {
        return {
          success: true,
          message: 'Gmail messages fetched successfully',
          data: {
            messages: result.messages,
            totalMessages: result.resultSizeEstimate,
            count: result.messages?.length || 0
          },
          timestamp: new Date().toISOString()
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to fetch Gmail messages',
          timestamp: new Date().toISOString()
        };
      }
    } catch (error: any) {
      console.error('❌ Gmail API request error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error occurred',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Start PHP server
   */
  public async startServer(): Promise<boolean> {
    try {
      const phpPath = this.findPHP();
      if (!phpPath) {
        throw new Error('PHP executable not found');
      }

      if (!this.checkPublicDir()) {
        throw new Error('Public directory or required files not found');
      }

      console.log(`🚀 Starting PHP server on port ${this.port}...`);

      // Start PHP server bound to all network interfaces
      this.phpServer = spawn(phpPath, [
        '-S', `0.0.0.0:${this.port}`,  // This makes it accessible on the network
        '-t', this.publicDir
      ]);

      this.phpServer.stdout?.on('data', (data) => {
        console.log(`PHP Server: ${data}`);
      });

      this.phpServer.stderr?.on('data', (data) => {
        console.error(`PHP Server Error: ${data}`);
      });

      this.phpServer.on('close', (code) => {
        console.log(`PHP Server stopped with code ${code}`);
        this.phpServer = null;
      });

      this.phpServer.on('error', (error) => {
        console.error('PHP Server spawn error:', error);
        this.phpServer = null;
      });

      // Wait a bit for server to start
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log(`✅ PHP server started successfully!`);
      console.log(`🌐 Server URL: http://localhost:${this.port}`);
      console.log(`🔗 Hello endpoint: http://localhost:${this.port}/hello.php`);
      console.log(`📧 Gmail endpoint: http://localhost:${this.port}/gmail.php (calls Electron app)`);

      return true;
    } catch (error) {
      console.error('❌ Failed to start PHP server:', error);
      return false;
    }
  }

  /**
   * Stop PHP server
   */
  public stopServer(): void {
    if (this.phpServer) {
      console.log('🛑 Stopping PHP server...');
      this.phpServer.kill();
      this.phpServer = null;
      console.log('✅ PHP server stopped');
    }
  }

  /**
   * Test the /hello endpoint
   */
  public async testHelloEndpoint(): Promise<boolean> {
    try {
      const response = await fetch(`http://localhost:${this.port}/hello.php`);
      const data = await response.json();
      
      console.log('📡 Hello endpoint response:', data);
      
      if (data.message && data.timestamp) {
        console.log('✅ Hello endpoint test passed');
        return true;
      } else {
        console.log('❌ Hello endpoint test failed - invalid response');
        return false;
      }
    } catch (error) {
      console.error('❌ Hello endpoint test failed:', error);
      return false;
    }
  }

  /**
   * Get local IP address
   */
  public async getLocalIP(): Promise<string> {
    try {
      const os = require('os');
      const interfaces = os.networkInterfaces();
      for (let iface of Object.values(interfaces) as any[]) {
        for (let alias of iface) {
          if (alias.family === 'IPv4' && !alias.internal) {
            return alias.address; // e.g., 192.168.1.105
          }
        }
      }
      return 'localhost';
    } catch (error) {
      console.error('❌ Failed to get local IP:', error);
      return 'localhost';
    }
  }

  /**
   * Run complete test
   */
  public async runTest(): Promise<boolean> {
    console.log('🧪 Starting Simple PHP Server Test...');
    
    const started = await this.startServer();
    if (!started) {
      return false;
    }

    // Wait a bit for server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    const testPassed = await this.testHelloEndpoint();
    
    this.stopServer();
    
    return testPassed;
  }
}

/**
 * Quick test function
 */
export async function quickPHPServerTest(): Promise<boolean> {
  const test = new SimplePHPServerTest();
  return await test.runTest();
}

// Export for use in other modules
export default SimplePHPServerTest;
