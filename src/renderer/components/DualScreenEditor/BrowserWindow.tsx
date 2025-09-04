import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faTimes, 
  faMinus, 
  faSquare, 
  faRefresh, 
  faExternalLinkAlt,
  faGlobe,
  faExpand,
  faCompress,
  faChevronDown,
  faCircle,
  faSquare as faSquareIcon,
  faCode,
  faEye
} from '@fortawesome/free-solid-svg-icons';
import LocalServer from '../LocalServer';
import { URLFileViewer } from './URLFileViewer';
import './BrowserWindow.css';

interface BrowserWindowProps {
  isVisible: boolean;
  onClose: () => void;
  initialUrl?: string;
  title?: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  embedded?: boolean;
  onUrlChange?: (url: string) => void;
  serverStatus?: any;
  onServerStatusChange?: (status: any) => void;
  halfScreenPosition?: 'left' | 'right' | 'custom'; // 'left' = left half, 'right' = right half, 'custom' = use width/height/x/y props
  resizeMainWindow?: boolean; // Whether to resize the main window for split-screen setup
  showFileViewer?: boolean; // Whether to show file viewer instead of browser controls
  filesToOpen?: string[]; // Files to display in the file viewer
  onToggleView?: () => void; // Callback to toggle between browser and file viewer
  diffData?: {
    filePath: string;
    diff: { before: string; after: string; lineNumber: number };
  } | null; // Diff data to highlight in the file viewer
}

export const BrowserWindow: React.FC<BrowserWindowProps> = ({
  isVisible,
  onClose,
  initialUrl = 'https://www.google.com',
  title = 'Browser Window',
  width = 1200,
  height = 800,
  x = 100,
  y = 100,
  embedded = false,
  onUrlChange,
  serverStatus,
  onServerStatusChange,
  halfScreenPosition = 'right',
  resizeMainWindow = true,
  showFileViewer = false,
  filesToOpen = [],
  onToggleView,
  diffData
}) => {
  const [url, setUrl] = useState(initialUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [browserWindowId, setBrowserWindowId] = useState<number | null>(null);
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [serverUrl, setServerUrl] = useState(initialUrl);
  const [selectedBrowser, setSelectedBrowser] = useState<string>('electron');
  const [externalBrowserProcess, setExternalBrowserProcess] = useState<any>(null);
  const [showBrowserDropdown, setShowBrowserDropdown] = useState(false);
  
  const windowRef = useRef<HTMLDivElement>(null);

  // Calculate half-screen dimensions and position
  const getHalfScreenDimensions = () => {
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    
    // Calculate half-screen dimensions
    const halfWidth = Math.floor(screenWidth / 2);
    
    let x = 0;
    let y = 0;
    
    // Position based on halfScreenPosition prop
    switch (halfScreenPosition) {
      case 'left':
        x = 0;
        y = 0;
        break;
      case 'right':
        x = halfWidth;
        y = 0;
        break;
      case 'custom':
      default:
        // Use provided dimensions or defaults
        return {
          width: width,
          height: height,
          x: x,
          y: y
        };
    }
    
    return {
      width: halfWidth,
      height: screenHeight, // Full height for better browsing experience
      x: x,
      y: y
    };
  };

  // Resize main window for split-screen setup
  const resizeMainWindowForSplitScreen = async () => {
    try {
      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;
      const halfWidth = Math.floor(screenWidth / 2);
      
      let mainWindowBounds;
      
      // Position main window on the opposite side
      switch (halfScreenPosition) {
        case 'left':
          // Browser on left, main window on right
          mainWindowBounds = {
            x: halfWidth,
            y: 0,
            width: halfWidth,
            height: screenHeight
          };
          break;
        case 'right':
          // Browser on right, main window on left
          mainWindowBounds = {
            x: 0,
            y: 0,
            width: halfWidth,
            height: screenHeight
          };
          break;
        default:
          return; // Don't resize for custom positioning
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[BrowserWindow] Resizing main window for split-screen:', mainWindowBounds);
      }
      
      await (window as any).electron?.mainWindow?.setBounds?.(mainWindowBounds);
    } catch (error) {
      console.error('Failed to resize main window for split-screen:', error);
    }
  };

  // Create native Electron BrowserWindow
  const createBrowserWindow = async () => {
    try {
      setIsLoading(true);
      
      // Get half-screen dimensions for better positioning
      const halfScreenDims = getHalfScreenDimensions();
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[BrowserWindow] Creating browser window with dimensions:', halfScreenDims);
        console.log('[BrowserWindow] Screen size:', { width: window.screen.width, height: window.screen.height });
      }
      
      // Resize main window for split-screen setup (only for half-screen positioning and if enabled)
      if (halfScreenPosition !== 'custom' && resizeMainWindow) {
        await resizeMainWindowForSplitScreen();
      }
      
      // Call main process to create browser window
      const result = await (window as any).electron?.browserWindow?.createWindow?.({
        url: initialUrl,
        title: title,
        width: halfScreenDims.width,
        height: halfScreenDims.height,
        x: halfScreenDims.x,
        y: halfScreenDims.y,
        show: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: true
        }
      });

      if (result && result.success && result.windowId) {
        setBrowserWindowId(result.windowId);
        setCurrentUrl(initialUrl);
        
        // Listen for URL changes
        (window as any).electron?.browserWindow?.onUrlChanged?.(result.windowId, (newUrl: string) => {
          setCurrentUrl(newUrl);
          setUrl(newUrl);
          // Notify parent component of URL change
          if (onUrlChange) {
            onUrlChange(newUrl);
          }
        });

        // Listen for window close
        (window as any).electron?.browserWindow?.onClosed?.(result.windowId, () => {
          setBrowserWindowId(null);
          onClose();
        });
      }
    } catch (error) {
      console.error('Failed to create browser window:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Close the native browser window
  const closeBrowserWindow = async () => {
    if (browserWindowId) {
      try {
        await (window as any).electron?.browserWindow?.closeWindow?.(browserWindowId);
        setBrowserWindowId(null);
        
        // Restore main window to original size when browser is closed (if resize was enabled)
        if (resizeMainWindow) {
          await restoreMainWindow();
        }
        
        onClose();
      } catch (error) {
        console.error('Failed to close browser window:', error);
      }
    }
  };

  // Restore main window to original size
  const restoreMainWindow = async () => {
    try {
      // Get current screen dimensions
      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;
      
      // Restore to a reasonable default size (e.g., 80% of screen)
      const defaultWidth = Math.floor(screenWidth * 0.8);
      const defaultHeight = Math.floor(screenHeight * 0.8);
      const defaultX = Math.floor((screenWidth - defaultWidth) / 2);
      const defaultY = Math.floor((screenHeight - defaultHeight) / 2);
      
      const restoreBounds = {
        x: defaultX,
        y: defaultY,
        width: defaultWidth,
        height: defaultHeight
      };
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[BrowserWindow] Restoring main window to:', restoreBounds);
      }
      
      await (window as any).electron?.mainWindow?.setBounds?.(restoreBounds);
    } catch (error) {
      console.error('Failed to restore main window:', error);
    }
  };

  // Navigate to a new URL
  const navigateToUrl = async (newUrl: string) => {
    if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
      newUrl = 'https://' + newUrl;
    }
    
    if (browserWindowId) {
      try {
        await (window as any).electron?.browserWindow?.loadURL?.(browserWindowId, newUrl);
        setUrl(newUrl);
        setCurrentUrl(newUrl);
        // Notify parent component of URL change
        if (onUrlChange) {
          onUrlChange(newUrl);
        }
      } catch (error) {
        console.error('Failed to navigate to URL:', error);
      }
    } else {
      // If no browser window exists, create one with the new URL
      setUrl(newUrl);
      await createBrowserWindow();
    }
  };

  // Handle server status changes
  const handleServerStatusChange = (status: any) => {
    // Update local state
    if (status?.url && status.url !== serverUrl) {
      setServerUrl(status.url);
      setUrl(status.url);
      // If browser is open, navigate to the new server URL
      if (browserWindowId) {
        navigateToUrl(status.url);
      } else if (externalBrowserProcess) {
        navigateExternalBrowser(status.url);
      }
    } else if (status?.port) {
      const newServerUrl = `http://localhost:${status.port}`;
      if (newServerUrl !== serverUrl) {
        setServerUrl(newServerUrl);
        setUrl(newServerUrl);
        // If browser is open, navigate to the new server URL
        if (browserWindowId) {
          navigateToUrl(newServerUrl);
        } else if (externalBrowserProcess) {
          navigateExternalBrowser(newServerUrl);
        }
      }
    }
    
    // Forward to parent component
    if (onServerStatusChange) {
      onServerStatusChange(status);
    }
  };

  // Refresh the current page
  const refreshPage = async () => {
    if (browserWindowId) {
      try {
        await (window as any).electron?.browserWindow?.reload?.(browserWindowId);
      } catch (error) {
        console.error('Failed to refresh page:', error);
      }
    }
  };

  // Open in external browser
  const openInExternalBrowser = () => {
    window.open(currentUrl, '_blank');
  };

  // Launch external browser with control
  const launchExternalBrowser = async (browserType: string, url: string) => {
    try {
      setIsLoading(true);
      
      const result = await (window as any).electron?.browserWindow?.launchExternalBrowser?.(browserType, url);
      
      if (result && result.success) {
        setExternalBrowserProcess(result.process);
        setCurrentUrl(url);
        setUrl(url);
      } else {
        console.error('Failed to launch external browser:', result?.error);
      }
    } catch (error) {
      console.error('Failed to launch external browser:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Close external browser
  const closeExternalBrowser = async () => {
    if (externalBrowserProcess) {
      try {
        await (window as any).electron?.browserWindow?.closeExternalBrowser?.(externalBrowserProcess.pid);
        setExternalBrowserProcess(null);
      } catch (error) {
        console.error('Failed to close external browser:', error);
      }
    }
  };

  // Navigate external browser to new URL
  const navigateExternalBrowser = async (newUrl: string) => {
    if (externalBrowserProcess) {
      try {
        await (window as any).electron?.browserWindow?.navigateExternalBrowser?.(externalBrowserProcess.pid, newUrl);
        setCurrentUrl(newUrl);
        setUrl(newUrl);
      } catch (error) {
        console.error('Failed to navigate external browser:', error);
      }
    }
  };

  // Get browser icon
  const getBrowserIcon = (browserType: string) => {
    switch (browserType) {
      case 'chrome': return faCircle; // Using circle as Chrome icon
      case 'firefox': return faSquareIcon; // Using square as Firefox icon
      case 'safari': return faCircle; // Using circle as Safari icon
      case 'edge': return faSquareIcon; // Using square as Edge icon
      default: return faGlobe;
    }
  };

  // Get browser display name
  const getBrowserName = (browserType: string) => {
    switch (browserType) {
      case 'chrome': return 'Chrome';
      case 'firefox': return 'Firefox';
      case 'safari': return 'Safari';
      case 'edge': return 'Edge';
      case 'electron': return 'Electron';
      default: return 'Browser';
    }
  };

  // Handle URL form submission
  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedBrowser === 'electron') {
      navigateToUrl(url);
    } else {
      navigateExternalBrowser(url);
    }
  };

  // Create browser window when component becomes visible
  useEffect(() => {
    if (isVisible && !browserWindowId) {
      createBrowserWindow();
    }
  }, [isVisible]);

  // Update URL when server status changes from parent
  useEffect(() => {
    if (serverStatus?.url && serverStatus.url !== url) {
      setUrl(serverStatus.url);
      setCurrentUrl(serverStatus.url);
      setServerUrl(serverStatus.url);
    } else if (serverStatus?.port) {
      const newServerUrl = `http://localhost:${serverStatus.port}`;
      if (newServerUrl !== url) {
        setUrl(newServerUrl);
        setCurrentUrl(newServerUrl);
        setServerUrl(newServerUrl);
      }
    }
  }, [serverStatus]);

  // Cleanup when component unmounts
  useEffect(() => {
    return () => {
      if (browserWindowId) {
        (window as any).electron?.browserWindow?.closeWindow?.(browserWindowId);
      }
    };
  }, [browserWindowId]);

  if (!isVisible) return null;

  // For embedded mode, show controls but the actual browser window will be separate
  if (embedded) {
    // Debug logging for server status
    if (process.env.NODE_ENV === 'development') {
      console.log('[BrowserWindow] Server status check:', {
        serverStatus,
        isRunning: serverStatus?.isRunning,
        isVisible,
        embedded
      });
    }
    
    // Show server status if not ready
    // Check multiple conditions to determine if server is ready
    const isServerReady = serverStatus?.isRunning === true || 
                         (serverStatus && serverStatus.port && serverStatus.url);
    
    if (!isServerReady) {
      return (
        <div className="browser-window embedded">
          <div className="server-waiting">
            <div className="waiting-content">
              <div className="waiting-spinner">
                <FontAwesomeIcon icon={faCircle} className="spinning" />
              </div>
              <h3>🚀 Managing Server...</h3>
              <p>Checking for existing servers and starting up the development server.</p>
              <div className="server-status">
                <span className="status-indicator">⏳ Initializing</span>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div ref={windowRef} className="browser-window embedded">
        {showFileViewer ? (
          /* File Viewer Mode */
          <div className="file-viewer-mode">
            <div className="file-viewer-header">
              <div className="file-viewer-controls">
                <h3>
                  <FontAwesomeIcon icon={faCode} />
                  Route Files
                </h3>
                <div className="file-viewer-actions">
                  <button
                    className="view-toggle-btn"
                    onClick={() => {
                      if (onToggleView) {
                        onToggleView();
                      }
                    }}
                    title="Switch to Browser View"
                  >
                    <FontAwesomeIcon icon={faGlobe} />
                    Browser View
                  </button>
                </div>
              </div>
            </div>
            <div className="file-viewer-content">
              <URLFileViewer 
                filesToOpen={filesToOpen}
                instanceId="browser-embedded"
                diffData={diffData}
              />
            </div>
          </div>
        ) : (
          /* Browser Controls Mode */
          <>
            {/* Server Controls Section */}
            <div className="server-controls-section">
              <div className="controls-header">
                <h3>🚀 Server Controls</h3>
                <div className="control-buttons">
                  {/* Browser Selection Dropdown */}
                  <div className="browser-selector">
                    <button
                      className="browser-select-btn"
                      onClick={() => setShowBrowserDropdown(!showBrowserDropdown)}
                      title="Select browser type"
                    >
                      <FontAwesomeIcon icon={getBrowserIcon(selectedBrowser)} />
                      <span>{getBrowserName(selectedBrowser)}</span>
                      <FontAwesomeIcon icon={faChevronDown} />
                    </button>
                    {showBrowserDropdown && (
                      <div className="browser-dropdown">
                        <button
                          className={`browser-option ${selectedBrowser === 'electron' ? 'active' : ''}`}
                          onClick={() => {
                            setSelectedBrowser('electron');
                            setShowBrowserDropdown(false);
                          }}
                        >
                          <FontAwesomeIcon icon={faGlobe} />
                          <span>Electron</span>
                        </button>
                        <button
                          className={`browser-option ${selectedBrowser === 'chrome' ? 'active' : ''}`}
                          onClick={() => {
                            setSelectedBrowser('chrome');
                            setShowBrowserDropdown(false);
                          }}
                        >
                          <FontAwesomeIcon icon={faCircle} />
                          <span>Chrome</span>
                        </button>
                        <button
                          className={`browser-option ${selectedBrowser === 'firefox' ? 'active' : ''}`}
                          onClick={() => {
                            setSelectedBrowser('firefox');
                            setShowBrowserDropdown(false);
                          }}
                        >
                          <FontAwesomeIcon icon={faSquareIcon} />
                          <span>Firefox</span>
                        </button>
                        <button
                          className={`browser-option ${selectedBrowser === 'safari' ? 'active' : ''}`}
                          onClick={() => {
                            setSelectedBrowser('safari');
                            setShowBrowserDropdown(false);
                          }}
                        >
                          <FontAwesomeIcon icon={faCircle} />
                          <span>Safari</span>
                        </button>
                        <button
                          className={`browser-option ${selectedBrowser === 'edge' ? 'active' : ''}`}
                          onClick={() => {
                            setSelectedBrowser('edge');
                            setShowBrowserDropdown(false);
                          }}
                        >
                          <FontAwesomeIcon icon={faSquareIcon} />
                          <span>Edge</span>
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <button
                    className="browser-toggle-btn"
                    onClick={() => {
                      if (selectedBrowser === 'electron') {
                        browserWindowId ? closeBrowserWindow() : createBrowserWindow();
                      } else {
                        externalBrowserProcess ? closeExternalBrowser() : launchExternalBrowser(selectedBrowser, url);
                      }
                    }}
                    title={browserWindowId || externalBrowserProcess ? 'Close Browser & Restore Main Window' : `Open Browser (${halfScreenPosition} half-screen + resize main window)`}
                  >
                    {browserWindowId || externalBrowserProcess ? <><FontAwesomeIcon icon={faTimes} /> Close Browser</> : <><FontAwesomeIcon icon={faGlobe} /> Open Browser</>}
                  </button>
                  <button
                    className="refresh-btn"
                    onClick={refreshPage}
                    title="Refresh browser"
                    disabled={!browserWindowId && !externalBrowserProcess}
                  >
                    <FontAwesomeIcon icon={faRefresh} /> Refresh
                  </button>
                  <button
                    className="external-btn"
                    onClick={openInExternalBrowser}
                    title="Open in system default browser"
                  >
                    <FontAwesomeIcon icon={faExternalLinkAlt} /> System
                  </button>
                  <button
                    className="file-viewer-btn"
                    onClick={() => {
                      if (onToggleView) {
                        onToggleView();
                      }
                    }}
                    title="Switch to File Viewer"
                  >
                    <FontAwesomeIcon icon={faCode} />
                    View Files
                  </button>
                </div>
              </div>
              
              {/* Compact LocalServer component */}
              <div className="compact-server">
                <LocalServer onStatusChange={handleServerStatusChange} />
              </div>
            </div>

            {/* Browser Navigation Section */}
            <div className="browser-nav-section">
              <div className="browser-nav-bar">
                <div className="nav-controls">
                  <button className="nav-btn" onClick={refreshPage} title="Refresh" disabled={!browserWindowId}>
                    <FontAwesomeIcon icon={faRefresh} />
                  </button>
                </div>
                <form onSubmit={handleUrlSubmit} className="url-bar-form">
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="url-input"
                    placeholder="Enter URL..."
                  />
                  <button type="submit" className="go-btn">Go</button>
                </form>
              </div>
            </div>

            {/* Status Area */}
            <div className="browser-status">
              {isLoading && (
                <div className="loading-status">
                  <FontAwesomeIcon icon={faGlobe} spin />
                  <span>Loading...</span>
                </div>
              )}
              {browserWindowId && (
                <div className="browser-status-info">
                  <span className="status-text">
                    <FontAwesomeIcon icon={faGlobe} />
                    Electron browser window is open
                  </span>
                  <span className="current-url">{currentUrl}</span>
                </div>
              )}
              {externalBrowserProcess && (
                <div className="browser-status-info">
                  <span className="status-text">
                    <FontAwesomeIcon icon={getBrowserIcon(selectedBrowser)} />
                    {getBrowserName(selectedBrowser)} browser is open (PID: {externalBrowserProcess.pid})
                  </span>
                  <span className="current-url">{currentUrl}</span>
                </div>
              )}
              {!browserWindowId && !externalBrowserProcess && !isLoading && (
                <div className="browser-status-info">
                  <span className="status-text">Click "Open Browser" to launch {getBrowserName(selectedBrowser)} browser</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // For overlay mode, show a placeholder since the actual window is separate
  return (
    <div className="browser-window-overlay">
      <div className="browser-window">
        <div className="browser-title-bar">
          <div className="title-bar-left">
            <div className="window-controls">
              <button className="window-control close" onClick={closeBrowserWindow}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div className="window-title">
              <FontAwesomeIcon icon={faGlobe} />
              <span>{title}</span>
            </div>
          </div>
        </div>
        <div className="browser-content">
          <div className="browser-placeholder">
            <FontAwesomeIcon icon={faGlobe} size="3x" />
            <h3>Native Browser Window</h3>
            <p>A separate native browser window has been opened.</p>
            <p>Current URL: {currentUrl}</p>
            <button onClick={closeBrowserWindow} className="close-browser-btn">
              Close Browser Window
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};