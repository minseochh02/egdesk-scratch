import { exec } from 'child_process';
import { promisify } from 'util';
import { dialog } from 'electron';

const execAsync = promisify(exec);

interface OllamaInstaller {
  checkInstalled(): Promise<boolean>;
  install(): Promise<boolean>;
  ensureOllama(): Promise<boolean>;
}

class OllamaManager implements OllamaInstaller {
  
  /**
   * Check if Ollama is installed and running
   */
  async checkInstalled(): Promise<boolean> {
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      return response.ok;
    } catch {
      // Server not responding, return false (even if app is installed)
      return false;
    }
  }

  /**
   * Check if Ollama app is installed (but not necessarily running)
   */
  async isOllamaAppInstalled(): Promise<boolean> {
    const platform = process.platform;
    
    try {
      if (platform === 'darwin') {
        // Check for macOS app
        await execAsync('test -d /Applications/Ollama.app');
        return true;
      } else if (platform === 'linux' || platform === 'win32') {
        // Check for CLI binary
        await execAsync('ollama --version');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Install Ollama based on platform
   */
  async install(): Promise<boolean> {
    const platform = process.platform;

    try {
      if (platform === 'linux') {
        return await this.installLinux();
      } else if (platform === 'darwin') {
        return await this.installMacOS();
      } else if (platform === 'win32') {
        return await this.installWindows();
      } else {
        throw new Error(`Unsupported platform: ${platform}`);
      }
    } catch (error) {
      console.error('Installation failed:', error);
      return false;
    }
  }

  /**
   * Install on Linux using official script
   */
  private async installLinux(): Promise<boolean> {
    console.log('Installing Ollama on Linux...');
    
    // Try with sudo first
    try {
      const { stdout, stderr } = await execAsync(
        'curl -fsSL https://ollama.com/install.sh | sudo sh'
      );
      console.log('Installation output:', stdout);
      if (stderr) console.error('Installation stderr:', stderr);
      return true;
    } catch (error) {
      console.error('Linux installation failed:', error);
      return false;
    }
  }

  /**
   * Install on macOS
   */
  private async installMacOS(): Promise<boolean> {
    console.log('Installing Ollama on macOS...');
    
    // Check macOS version first
    let macOSVersion = '0.0.0';
    try {
      const { stdout } = await execAsync('sw_vers -productVersion');
      macOSVersion = stdout.trim();
      console.log('macOS version:', macOSVersion);
      
      const [major, minor] = macOSVersion.split('.').map(Number);
      const isMacOS14Plus = major >= 14 || (major === 13); // macOS 13+ might work
      const isOldMacOS = major < 12; // macOS 11 or older
      
      if (isOldMacOS) {
        console.log('⚠️  Detected older macOS version. Ollama.app requires macOS 14+, will try Homebrew CLI instead.');
      }
    } catch (error) {
      console.warn('Could not detect macOS version:', error);
    }

    // Method 1: Try Homebrew (most reliable, especially for older macOS)
    try {
      console.log('Attempting to install via Homebrew...');
      const { stdout: brewCheck } = await execAsync('which brew');
      if (brewCheck.trim()) {
        console.log('Homebrew found, installing Ollama CLI...');
        
        // Fix Homebrew issues first if needed
        try {
          console.log('Checking Homebrew health...');
          await execAsync('brew --version');
        } catch (brewError) {
          console.warn('Homebrew might need repair, attempting to fix...');
          // Skip the fix for now, just try to install
        }
        
        const { stdout, stderr } = await execAsync('brew install ollama', { timeout: 300000 }); // 5 min timeout
        console.log('Homebrew installation output:', stdout);
        if (stderr) console.warn('Homebrew stderr:', stderr);
        
        // Start Ollama service
        console.log('Starting Ollama service...');
        try {
          await execAsync('brew services start ollama');
          console.log('Ollama service started via Homebrew');
          // Wait for service to start
          await new Promise(resolve => setTimeout(resolve, 3000));
          return true;
        } catch (serviceError) {
          console.warn('Could not start Ollama service automatically:', serviceError);
          // Try to start it manually in background
          try {
            await execAsync('nohup ollama serve > /dev/null 2>&1 &');
            console.log('Started Ollama manually in background');
            await new Promise(resolve => setTimeout(resolve, 3000));
            return true;
          } catch (manualError) {
            console.error('Could not start Ollama manually:', manualError);
          }
        }
        
        return true;
      }
    } catch (error: any) {
      console.log('Homebrew installation failed:', error?.message || error);
      // Continue to fallback method
    }
    
    // Method 2: Download and install .dmg file (official method)
    try {
      console.log('Attempting to download Ollama .dmg installer...');
      const downloadPath = '/tmp/Ollama.dmg';
      
      // Download the .dmg file
      console.log('Downloading from https://ollama.com/download/mac...');
      const { stdout: curlOutput, stderr: curlError } = await execAsync(
        `curl -L -f --progress-bar https://ollama.com/download/mac -o ${downloadPath} 2>&1 || curl -L -f --progress-bar https://ollama.com/download/Ollama-darwin.dmg -o ${downloadPath} 2>&1`
      );
      
      if (curlError && !curlError.includes('progress')) {
        console.error('Download error:', curlError);
      }
      
      // Check if file was downloaded
      try {
        await execAsync(`test -f ${downloadPath}`);
      } catch {
        throw new Error('Downloaded file not found. The download URL may have changed.');
      }
      
      // Mount the .dmg (let hdiutil auto-mount to avoid permission issues)
      console.log('Mounting .dmg file...');
      const { stdout: mountOutput } = await execAsync(
        `hdiutil attach ${downloadPath} -nobrowse`
      );
      
      // Parse mount path from hdiutil output
      // Output format: /dev/diskXsY   Apple_HFS   /Volumes/Ollama
      const lines = mountOutput.trim().split('\n');
      const mountLine = lines.find(line => line.includes('/Volumes/'));
      if (!mountLine) {
        throw new Error('Could not find mount point in hdiutil output');
      }
      
      const mountPath = mountLine.split('\t').pop()?.trim();
      if (!mountPath) {
        throw new Error('Could not parse mount path from hdiutil output');
      }
      
      console.log('Mounted at:', mountPath);
      
      // Copy to Applications (requires admin password via osascript)
      console.log('Copying Ollama.app to Applications (admin password required)...');
      await execAsync(
        `osascript -e 'do shell script "cp -R ${mountPath.replace(/"/g, '\\"')}/Ollama.app /Applications/" with administrator privileges'`
      );
      console.log('Copy completed successfully');
      
      // Unmount the .dmg
      console.log('Unmounting .dmg...');
      await execAsync(`hdiutil detach "${mountPath}" -quiet || true`);
      
      // Clean up downloaded file
      await execAsync(`rm -f ${downloadPath}`);
      
      // Start Ollama
      console.log('Starting Ollama.app...');
      await execAsync('open /Applications/Ollama.app');
      
      // Wait a moment for the app to start
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('macOS installation complete');
      return true;
    } catch (error: any) {
      console.error('macOS installation failed:', error);
      console.error('Error details:', {
        message: error?.message,
        stdout: error?.stdout,
        stderr: error?.stderr,
        code: error?.code,
      });
      
      // Provide helpful error message
      if (error?.message?.includes('password') || error?.code === 1) {
        console.error('Installation may have been cancelled or password was incorrect');
      }
      
      return false;
    }
  }

  /**
   * Install on Windows (no admin required)
   */
  private async installWindows(): Promise<boolean> {
    console.log('Installing Ollama on Windows...');
    
    try {
      const installerPath = 'C:\\temp\\OllamaSetup.exe';
      
      // Create temp directory if it doesn't exist
      try {
        await execAsync('mkdir C:\\temp');
      } catch {
        // Directory might already exist
      }
      
      // Download installer
      await execAsync(
        `curl -L https://ollama.com/download/OllamaSetup.exe -o ${installerPath}`
      );
      
      // Run installer silently (no admin needed)
      await execAsync(`"${installerPath}" /S`);
      
      // Wait a bit for installation to complete
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Clean up
      await execAsync(`del ${installerPath}`);
      
      console.log('Windows installation complete');
      return true;
    } catch (error) {
      console.error('Windows installation failed:', error);
      return false;
    }
  }

  /**
   * Main function: Check if installed, if not, ask user and install
   */
  async ensureOllama(): Promise<boolean> {
    // 1. Check if already running
    const isRunning = await this.checkInstalled();
    
    if (isRunning) {
      console.log('✅ Ollama is already installed and running');
      return true;
    }

    // 2. Check if Ollama is installed but just not running
    const appInstalled = await this.isOllamaAppInstalled();
    
    if (appInstalled) {
      console.log('Ollama is installed but not running. Attempting to start...');
      
      const started = await this.startOllama();
      if (started) {
        console.log('✅ Ollama started successfully');
        return true;
      }
      
      // If start failed, ask user what to do
      const result = await dialog.showMessageBox({
        type: 'warning',
        buttons: ['Try to Start Again', 'Reinstall', 'Cancel'],
        defaultId: 0,
        title: 'Ollama Not Running',
        message: 'Ollama is installed but could not be started.',
        detail: 'Would you like to try starting it again, or reinstall?',
      });
      
      if (result.response === 0) {
        // Try to start again
        return await this.startOllama();
      } else if (result.response === 2) {
        // User cancelled
        return false;
      }
      // Fall through to reinstall (response === 1)
    }

    console.log('Ollama not found, need to install...');

    // 3. Ask user permission to install
    const result = await dialog.showMessageBox({
      type: 'question',
      buttons: ['Install Ollama', 'Cancel'],
      defaultId: 0,
      title: 'Install Ollama',
      message: 'This app needs Ollama to run AI models locally.',
      detail: 'Ollama will be installed on your system. You may be prompted for your password.',
    });

    if (result.response !== 0) {
      console.log('User cancelled installation');
      return false;
    }

    // 4. Install
    const installed = await this.install();

    if (!installed) {
      await dialog.showErrorBox(
        'Installation Failed',
        'Failed to install Ollama. Please install it manually from https://ollama.com'
      );
      return false;
    }

    // 5. Wait for Ollama to start and verify
    console.log('Waiting for Ollama to start...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const finalCheck = await this.checkInstalled();
    
    if (finalCheck) {
      await dialog.showMessageBox({
        type: 'info',
        title: 'Success',
        message: 'Ollama installed successfully!',
        detail: 'You can now use AI models locally.',
      });
      return true;
    } else {
      await dialog.showMessageBox({
        type: 'warning',
        title: 'Installation Complete',
        message: 'Ollama was installed, but may need a manual start.',
        detail: 'Please restart your app or start Ollama manually.',
      });
      return false;
    }
  }

  /**
   * Start Ollama server if installed but not running
   */
  async startOllama(): Promise<boolean> {
    const platform = process.platform;
    
    try {
      if (platform === 'darwin') {
        // Try Homebrew service first (works on any macOS version)
        try {
          console.log('Attempting to start Ollama via Homebrew service...');
          await execAsync('brew services start ollama');
          console.log('Started Ollama via Homebrew service');
        } catch (brewError) {
          console.log('Homebrew service not available, trying other methods...');
          
          // Try CLI in background
          try {
            console.log('Attempting to start Ollama CLI in background...');
            await execAsync('nohup ollama serve > /tmp/ollama.log 2>&1 &');
            console.log('Started Ollama CLI in background');
          } catch (cliError) {
            // Try opening the app (only works on macOS 14+)
            console.log('Attempting to open Ollama.app...');
            await execAsync('open /Applications/Ollama.app');
          }
        }
      } else if (platform === 'win32') {
        await execAsync('start ollama');
      } else if (platform === 'linux') {
        await execAsync('nohup ollama serve > /tmp/ollama.log 2>&1 &');
      }
      
      // Wait for server to start
      console.log('Waiting for Ollama server to become ready...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const isReady = await this.checkInstalled();
      if (isReady) {
        console.log('✅ Ollama server is now ready');
      } else {
        console.warn('⚠️  Ollama may still be starting up...');
      }
      
      return isReady;
    } catch (error) {
      console.error('Failed to start Ollama:', error);
      return false;
    }
  }

  /**
   * Pull an Ollama model by name (e.g. gemma:2b)
   */
  async pullModel(model: string): Promise<boolean> {
    if (!model) {
      throw new Error('Model name is required to pull from Ollama.');
    }

    try {
      console.log(`⬇️  Pulling Ollama model: ${model}`);
      const { stdout, stderr } = await execAsync(`ollama pull ${model}`);
      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);
      return true;
    } catch (error) {
      console.error(`❌ Failed to pull Ollama model "${model}":`, error);
      return false;
    }
  }

  /**
   * List models currently installed in Ollama
   */
  async listModels(): Promise<string[]> {
    // Try HTTP API first (requires running server)
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data?.models)) {
          return data.models
            .map((model: any) => model?.name)
            .filter((name: any): name is string => typeof name === 'string' && name.length > 0);
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to list models via API, falling back to CLI:', error);
    }

    // Fallback to CLI command
    try {
      const { stdout } = await execAsync('ollama list --json');
      return stdout
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => {
          try {
            const parsed = JSON.parse(line);
            return typeof parsed?.name === 'string' ? parsed.name : null;
          } catch {
            return null;
          }
        })
        .filter((name): name is string => typeof name === 'string' && name.length > 0);
    } catch (error) {
      console.error('❌ Failed to list Ollama models:', error);
      return [];
    }
  }

  /**
   * Check whether a specific model exists locally
   */
  async hasModel(model: string): Promise<boolean> {
    if (!model) return false;
    try {
      const models = await this.listModels();
      const target = model.trim().toLowerCase();
      return models.some((name) => name.trim().toLowerCase() === target);
    } catch (error) {
      console.error(`❌ Failed to verify Ollama model "${model}":`, error);
      return false;
    }
  }
}

// Export singleton instance
export const ollamaManager = new OllamaManager();

// Usage example:
// import { ollamaManager } from './installer';
// 
// app.on('ready', async () => {
//   const ready = await ollamaManager.ensureOllama();
//   if (ready) {
//     console.log('Ollama is ready!');
//     // Start your app
//   }
// });