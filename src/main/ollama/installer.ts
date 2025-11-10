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
      // If fetch fails, try checking if binary exists
      try {
        await execAsync('ollama --version');
        return true;
      } catch {
        return false;
      }
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
    
    try {
      // Download the installer
      const downloadPath = '/tmp/Ollama.zip';
      await execAsync(
        `curl -L https://ollama.com/download/Ollama-darwin.zip -o ${downloadPath}`
      );
      
      // Unzip
      await execAsync(`unzip -o ${downloadPath} -d /tmp`);
      
      // Move to Applications (requires password)
      await execAsync(
        `osascript -e 'do shell script "cp -R /tmp/Ollama.app /Applications/" with administrator privileges'`
      );
      
      // Start Ollama
      await execAsync('open /Applications/Ollama.app');
      
      // Clean up
      await execAsync(`rm ${downloadPath}`);
      
      console.log('macOS installation complete');
      return true;
    } catch (error) {
      console.error('macOS installation failed:', error);
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
    // 1. Check if already installed
    const isInstalled = await this.checkInstalled();
    
    if (isInstalled) {
      console.log('✅ Ollama is already installed and running');
      return true;
    }

    console.log('Ollama not found, need to install...');

    // 2. Ask user permission
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

    // 3. Install
    const installed = await this.install();

    if (!installed) {
      await dialog.showErrorBox(
        'Installation Failed',
        'Failed to install Ollama. Please install it manually from https://ollama.com'
      );
      return false;
    }

    // 4. Wait for Ollama to start and verify
    console.log('Waiting for Ollama to start...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const isRunning = await this.checkInstalled();
    
    if (isRunning) {
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
        await execAsync('open /Applications/Ollama.app');
      } else if (platform === 'win32') {
        await execAsync('start ollama');
      } else if (platform === 'linux') {
        await execAsync('ollama serve &');
      }
      
      // Wait for server to start
      await new Promise(resolve => setTimeout(resolve, 2000));
      return await this.checkInstalled();
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