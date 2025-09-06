/**
 * Utility function to open localhost URL only if no existing browser windows are open
 */
export const openLocalhostIfNeeded = async (url: string = 'http://localhost:8000'): Promise<void> => {
  try {
    // Check if there are any existing browser windows
    if (window.electron && window.electron.browserWindow) {
      const result = await window.electron.browserWindow.getAllLocalhostWindows();
      if (result.success && result.windows && result.windows.length > 0) {
        console.log(`🔄 Found ${result.windows.length} existing browser window(s), refreshing instead of opening new one`);
        return; // Don't open a new window if existing ones are found
      }
    }
    
    // Only open new window if no existing browser windows found
    window.open(url, '_blank');
    console.log(`🌐 Opened ${url} to show applied changes`);
  } catch (error) {
    console.warn('⚠️ Could not check for existing browser windows, opening new one:', error);
    window.open(url, '_blank');
    console.log(`🌐 Opened ${url} to show applied changes`);
  }
};

/**
 * Function to refresh browser windows showing localhost
 */
export const refreshBrowserWindows = async (): Promise<void> => {
  try {
    console.log('🔄 Attempting to refresh browser windows showing localhost...');
    
    if (window.electron && window.electron.browserWindow) {
      // Try to refresh all browser windows showing localhost
      try {
        const refreshResult = await window.electron.browserWindow.refreshAllLocalhost();
        if (refreshResult.success) {
          console.log(`✅ Refreshed ${refreshResult.refreshedCount} localhost browser window(s)`);
        } else {
          console.warn('⚠️ Failed to refresh browser windows:', refreshResult.error);
        }
      } catch (error) {
        console.log('ℹ️ Browser window refresh method not available, using alternative approach');
      }
    }
    
    // Alternative approach: Use postMessage to refresh any localhost pages
    // This works for pages opened with window.open() from this app
    try {
      // Send refresh message to any child windows
      const refreshMessage = { type: 'REFRESH_LOCALHOST', timestamp: Date.now() };
      
      // Try to refresh via BroadcastChannel (works for same-origin pages)
      if (typeof BroadcastChannel !== 'undefined') {
        const refreshChannel = new BroadcastChannel('localhost-refresh');
        refreshChannel.postMessage(refreshMessage);
        console.log('📡 Sent refresh message via BroadcastChannel');
        
        // Close the channel after a short delay
        setTimeout(() => {
          refreshChannel.close();
        }, 1000);
      }
      
      // Also try localStorage approach for cross-tab communication
      localStorage.setItem('localhost-refresh-trigger', JSON.stringify(refreshMessage));
      // Remove it immediately to trigger storage event
      setTimeout(() => {
        localStorage.removeItem('localhost-refresh-trigger');
      }, 100);
      
    } catch (error) {
      console.log('ℹ️ Browser refresh alternatives not available:', error);
    }
    
  } catch (error) {
    console.error('❌ Error refreshing browser windows:', error);
  }
};

/**
 * Function to restart server after applying changes
 */
export const restartServer = async (
  projectContext?: { currentProject: any }
): Promise<{ success: boolean; url?: string; error?: string }> => {
  try {
    console.log('🔄 Attempting to restart server after applying changes...');
    
    if (window.electron && window.electron.wordpressServer) {
      // Stop the server first
      const stopResult = await window.electron.wordpressServer.stopServer();
      if (stopResult.success) {
        console.log('✅ Server stopped successfully');
        
        // Wait a moment before restarting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Start the server again
        const startResult = await window.electron.wordpressServer.startServer(
          projectContext?.currentProject?.path,
          8000
        );
        
        if (startResult.success) {
          console.log('✅ Server restarted successfully');
          
          // Refresh any existing browser windows showing localhost
          await refreshBrowserWindows();
          
          // Only open a new browser window if no existing browser windows are open
          const url = `http://localhost:${startResult.port || 8000}`;
          setTimeout(() => {
            openLocalhostIfNeeded(url);
          }, 2000); // Wait 2 seconds for server to fully start
          
          return { success: true, url };
        } else {
          console.warn('⚠️ Failed to restart server, but changes were applied');
          return { success: false, error: startResult.error };
        }
      } else {
        console.warn('⚠️ Failed to stop server, trying direct restart');
        return { success: false, error: stopResult.error };
      }
    } else {
      console.log('ℹ️ Not in Electron environment, checking for existing browser windows before opening new one');
      
      // Still try to refresh existing browser windows
      await refreshBrowserWindows();
      
      setTimeout(() => {
        openLocalhostIfNeeded('http://localhost:8000');
      }, 1000);
      return { success: true, url: 'http://localhost:8000' };
    }
  } catch (error) {
    console.error('❌ Error restarting server:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};
