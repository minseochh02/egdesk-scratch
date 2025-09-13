import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBug,
  faCheckCircle,
  faTimesCircle,
  faExclamationTriangle,
  faInfoCircle,
  faDownload,
  faCopy,
  faRefresh,
  faTrash,
  faFileAlt,
  faDatabase,
  faCog,
  faGlobe,
  faUser,
  faKey,
  faSave,
  faSpinner,
} from '../utils/fontAwesomeIcons';
import './WindowsTemplateDebugger.css';

interface DebugInfo {
  timestamp: string;
  platform: string;
  electronVersion: string;
  nodeVersion: string;
  chromeVersion: string;
  appVersion: string;
  userAgent: string;
  isPackaged: boolean;
  isWindows: boolean;
  isMac: boolean;
  isLinux: boolean;
  architecture: string;
  memoryUsage: any;
  cpuUsage: any;
  diskSpace: any;
  electronStore: {
    available: boolean;
    path: string;
    size: number;
    writable: boolean;
    error?: string;
  };
  wordpressConnections: {
    count: number;
    hasTemplates: boolean;
    templateCount: number;
    lastUpdated: string;
    errors: string[];
  };
  fileSystem: {
    tempDir: string;
    userDataDir: string;
    writable: boolean;
    error?: string;
  };
  templateSaveAttempts: Array<{
    timestamp: string;
    templateId: string;
    templateName: string;
    siteId: string;
    success: boolean;
    error?: string;
    stackTrace?: string;
  }>;
  recentErrors: Array<{
    timestamp: string;
    error: string;
    stackTrace: string;
    context: string;
  }>;
}

interface WindowsTemplateDebuggerProps {
  onClose?: () => void;
}

const WindowsTemplateDebugger: React.FC<WindowsTemplateDebuggerProps> = ({ onClose }) => {
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isElectron] = useState(!!(window as any).electron);

  const collectDebugInfo = async (): Promise<DebugInfo> => {
    const timestamp = new Date().toISOString();
    
    // Check if we're in an Electron environment
    const isElectron = !!(window as any).electron;
    
    // Basic system info - get from Electron APIs with fallbacks
    const electron = (window as any).electron;
    const platform = electron?.platform || navigator.platform || 'Unknown';
    const isWindows = platform === 'win32' || platform.includes('Win');
    const isMac = platform === 'darwin' || platform.includes('Mac');
    const isLinux = platform === 'linux' || platform.includes('Linux');
    
    // Electron and app info - get from window.electron with fallbacks
    const electronVersion = electron?.versions?.electron || 'Not available (not in Electron)';
    const nodeVersion = electron?.versions?.node || 'Not available (not in Electron)';
    const chromeVersion = electron?.versions?.chrome || 'Not available (not in Electron)';
    const appVersion = electron?.versions?.app || 'Not available (not in Electron)';
    const userAgent = navigator.userAgent;
    const isPackaged = electron?.isPackaged || false;
    
    // Architecture - get from Electron APIs with fallback
    const architecture = electron?.arch || 'Unknown';
    
    // Memory usage - use performance API
    const memoryUsage = (performance as any).memory ? {
      rss: (performance as any).memory.usedJSHeapSize,
      heapTotal: (performance as any).memory.totalJSHeapSize,
      heapUsed: (performance as any).memory.usedJSHeapSize,
      external: 0,
      arrayBuffers: 0
    } : null;
    
    // CPU usage - not available in renderer, will be null
    const cpuUsage = null;
    
    // Disk space (if available)
    let diskSpace = null;
    try {
      // Disk space info not available in current API
      console.log('Disk space info not available');
    } catch (e) {
      console.log('Disk space info not available');
    }
    
    // Electron Store status
    let electronStore = {
      available: false,
      path: '',
      size: 0,
      writable: false,
      error: undefined as string | undefined
    };
    
    try {
      // Store info not available in current API
      electronStore = {
        available: false,
        path: '',
        size: 0,
        writable: false,
        error: 'Store info not available in current API'
      };
    } catch (e) {
      electronStore.error = e instanceof Error ? e.message : 'Unknown error';
    }
    
    // WordPress connections and templates
    let wordpressConnections = {
      count: 0,
      hasTemplates: false,
      templateCount: 0,
      lastUpdated: '',
      errors: [] as string[]
    };
    
    try {
      const connectionsResult = await window.electron.wordpress.getConnections();
      if (connectionsResult.success && connectionsResult.connections) {
        const connections = connectionsResult.connections;
        wordpressConnections.count = connections.length;
        
        let totalTemplates = 0;
        let lastUpdated = '';
        
        for (const conn of connections) {
          const templates = (conn as any).blog_templates || [];
          totalTemplates += templates.length;
          
          if (conn.updatedAt && (!lastUpdated || conn.updatedAt > lastUpdated)) {
            lastUpdated = conn.updatedAt;
          }
        }
        
        wordpressConnections.hasTemplates = totalTemplates > 0;
        wordpressConnections.templateCount = totalTemplates;
        wordpressConnections.lastUpdated = lastUpdated;
      } else {
        wordpressConnections.errors.push(connectionsResult.error || 'Failed to get connections');
      }
    } catch (e) {
      wordpressConnections.errors.push(e instanceof Error ? e.message : 'Unknown error');
    }
    
    // File system status
    let fileSystem = {
      tempDir: '',
      userDataDir: '',
      writable: false,
      error: undefined as string | undefined
    };
    
    try {
      // File system info not available in current API
      fileSystem = {
        tempDir: '',
        userDataDir: '',
        writable: false,
        error: 'File system info not available in current API'
      };
    } catch (e) {
      fileSystem.error = e instanceof Error ? e.message : 'Unknown error';
    }
    
    // Template save attempts (from localStorage or sessionStorage)
    const templateSaveAttempts = JSON.parse(
      localStorage.getItem('templateSaveAttempts') || '[]'
    );
    
    // Recent errors (from localStorage)
    const recentErrors = JSON.parse(
      localStorage.getItem('recentErrors') || '[]'
    );
    
    return {
      timestamp,
      platform,
      electronVersion,
      nodeVersion,
      chromeVersion,
      appVersion,
      userAgent,
      isPackaged,
      isWindows,
      isMac,
      isLinux,
      architecture,
      memoryUsage,
      cpuUsage,
      diskSpace,
      electronStore,
      wordpressConnections,
      fileSystem,
      templateSaveAttempts,
      recentErrors
    };
  };

  const loadDebugInfo = async () => {
    try {
      setIsLoading(true);
      setError('');
      const info = await collectDebugInfo();
      setDebugInfo(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to collect debug info');
    } finally {
      setIsLoading(false);
    }
  };

  const runTemplateSaveTest = async () => {
    setIsRunningTest(true);
    setTestResults([]);
    
    const tests = [
      {
        name: 'Test WordPress Connection Update',
        test: async () => {
          try {
            const result = await window.electron.wordpress.updateConnection('test-connection-id', {
              blog_templates: [{
                id: 'test-template',
                name: 'Test Template',
                title: 'Test Title',
                content: 'Test content',
                status: 'draft',
                categories: [],
                tags: [],
                timestamp: new Date().toISOString()
              }]
            });
            return { success: result.success, error: result.error };
          } catch (e) {
            return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
          }
        }
      },
      {
        name: 'Test File System Write',
        test: async () => {
          try {
            const testPath = `/tmp/egdesk-debug-test.txt`;
            const testContent = `Debug test at ${new Date().toISOString()}`;
            const result = await window.electron.fileSystem.writeFile(testPath, testContent);
            return { success: result.success, error: result.error };
          } catch (e) {
            return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
          }
        }
      },
      {
        name: 'Test Electron Store Write',
        test: async () => {
          try {
            const result = await window.electron.preferences.set({
              debugTest: {
                timestamp: new Date().toISOString(),
                test: true
              }
            });
            return { success: result.success, error: result.error };
          } catch (e) {
            return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
          }
        }
      },
      {
        name: 'Test Template Save with Real Data',
        test: async () => {
          try {
            // Get first available connection
            const connectionsResult = await window.electron.wordpress.getConnections();
            if (!connectionsResult.success || !connectionsResult.connections?.length) {
              return { success: false, error: 'No WordPress connections available' };
            }
            
            const connection = connectionsResult.connections[0];
            const testTemplate = {
              id: `debug-test-${Date.now()}`,
              name: 'Debug Test Template',
              title: 'Debug Test Title',
              content: 'This is a debug test template',
              status: 'draft',
              categories: ['debug'],
              tags: ['test'],
              timestamp: new Date().toISOString()
            };
            
            const currentTemplates = (connection as any).blog_templates || [];
            const updatedTemplates = [...currentTemplates, testTemplate];
            
            const result = await window.electron.wordpress.updateConnection(connection.id!, {
              blog_templates: updatedTemplates
            });
            
            return { success: result.success, error: result.error };
          } catch (e) {
            return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
          }
        }
      }
    ];
    
    const results = [];
    for (const test of tests) {
      try {
        const result = await test.test();
        results.push({
          name: test.name,
          success: result.success,
          error: result.error,
          timestamp: new Date().toISOString()
        });
      } catch (e) {
        results.push({
          name: test.name,
          success: false,
          error: e instanceof Error ? e.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    setTestResults(results);
    setIsRunningTest(false);
  };

  const downloadDebugReport = () => {
    if (!debugInfo) return;
    
    const report = {
      ...debugInfo,
      testResults,
      generatedAt: new Date().toISOString(),
      generatedBy: 'EGDesk Windows Template Debugger'
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `egdesk-debug-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyDebugInfo = () => {
    if (!debugInfo) return;
    
    const report = {
      ...debugInfo,
      testResults,
      generatedAt: new Date().toISOString(),
      generatedBy: 'EGDesk Windows Template Debugger'
    };
    
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    alert('Debug information copied to clipboard!');
  };

  const clearDebugData = () => {
    if (window.confirm('Clear all debug data? This will remove template save attempts and error logs.')) {
      localStorage.removeItem('templateSaveAttempts');
      localStorage.removeItem('recentErrors');
      loadDebugInfo();
    }
  };

  useEffect(() => {
    loadDebugInfo();
  }, []);

  if (isLoading) {
    return (
      <div className="windows-template-debugger">
        <div className="debugger-header">
          <h2>
            <FontAwesomeIcon icon={faBug} />
            Windows Template Debugger
          </h2>
        </div>
        <div className="loading-container">
          <FontAwesomeIcon icon={faSpinner} spin />
          <p>Collecting debug information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="windows-template-debugger">
        <div className="debugger-header">
          <h2>
            <FontAwesomeIcon icon={faBug} />
            Windows Template Debugger
          </h2>
        </div>
        <div className="error-container">
          <FontAwesomeIcon icon={faTimesCircle} />
          <h3>Error collecting debug information</h3>
          <p>{error}</p>
          <button onClick={loadDebugInfo} className="retry-btn">
            <FontAwesomeIcon icon={faRefresh} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="windows-template-debugger">
      <div className="debugger-header">
        <h2>
          <FontAwesomeIcon icon={faBug} />
          Windows Template Debugger
        </h2>
        <div className="header-actions">
          <button onClick={loadDebugInfo} className="refresh-btn" title="Refresh debug info">
            <FontAwesomeIcon icon={faRefresh} />
          </button>
          <button onClick={downloadDebugReport} className="download-btn" title="Download debug report">
            <FontAwesomeIcon icon={faDownload} />
          </button>
          <button onClick={copyDebugInfo} className="copy-btn" title="Copy debug info">
            <FontAwesomeIcon icon={faCopy} />
          </button>
          <button onClick={clearDebugData} className="clear-btn" title="Clear debug data">
            <FontAwesomeIcon icon={faTrash} />
          </button>
          {onClose && (
            <button onClick={onClose} className="close-btn" title="Close debugger">
              ×
            </button>
          )}
        </div>
      </div>

      <div className="debugger-content">
        {/* System Information */}
        <div className="debug-section">
          <h3>
            <FontAwesomeIcon icon={faCog} />
            System Information
          </h3>
          {!isElectron && (
            <div className="warning-message">
              <FontAwesomeIcon icon={faExclamationTriangle} />
              <span>Warning: Not running in Electron environment. Some system information may not be available.</span>
            </div>
          )}
          <div className="info-grid">
            <div className="info-item">
              <span className="label">Platform:</span>
              <span className={`value ${debugInfo?.isWindows ? 'highlight' : ''}`}>
                {debugInfo?.platform} {debugInfo?.isWindows ? '(Windows)' : ''}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Architecture:</span>
              <span className="value">{debugInfo?.architecture}</span>
            </div>
            <div className="info-item">
              <span className="label">Electron Version:</span>
              <span className="value">{debugInfo?.electronVersion}</span>
            </div>
            <div className="info-item">
              <span className="label">Node Version:</span>
              <span className="value">{debugInfo?.nodeVersion}</span>
            </div>
            <div className="info-item">
              <span className="label">Chrome Version:</span>
              <span className="value">{debugInfo?.chromeVersion}</span>
            </div>
            <div className="info-item">
              <span className="label">App Version:</span>
              <span className="value">{debugInfo?.appVersion}</span>
            </div>
            <div className="info-item">
              <span className="label">Packaged:</span>
              <span className="value">{debugInfo?.isPackaged ? 'Yes' : 'No'}</span>
            </div>
          </div>
        </div>

        {/* Electron Store Status */}
        <div className="debug-section">
          <h3>
            <FontAwesomeIcon icon={faDatabase} />
            Electron Store Status
          </h3>
          <div className="status-grid">
            <div className="status-item">
              <span className="label">Available:</span>
              <span className={`value ${debugInfo?.electronStore.available ? 'success' : 'error'}`}>
                <FontAwesomeIcon icon={debugInfo?.electronStore.available ? faCheckCircle : faTimesCircle} />
                {debugInfo?.electronStore.available ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="status-item">
              <span className="label">Writable:</span>
              <span className={`value ${debugInfo?.electronStore.writable ? 'success' : 'error'}`}>
                <FontAwesomeIcon icon={debugInfo?.electronStore.writable ? faCheckCircle : faTimesCircle} />
                {debugInfo?.electronStore.writable ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="status-item">
              <span className="label">Path:</span>
              <span className="value">{debugInfo?.electronStore.path || 'Unknown'}</span>
            </div>
            <div className="status-item">
              <span className="label">Size:</span>
              <span className="value">{debugInfo?.electronStore.size ? `${debugInfo.electronStore.size} bytes` : 'Unknown'}</span>
            </div>
            {debugInfo?.electronStore.error && (
              <div className="status-item error">
                <span className="label">Error:</span>
                <span className="value">{debugInfo.electronStore.error}</span>
              </div>
            )}
          </div>
        </div>

        {/* WordPress Connections */}
        <div className="debug-section">
          <h3>
            <FontAwesomeIcon icon={faGlobe} />
            WordPress Connections
          </h3>
          <div className="status-grid">
            <div className="status-item">
              <span className="label">Connections:</span>
              <span className="value">{debugInfo?.wordpressConnections.count}</span>
            </div>
            <div className="status-item">
              <span className="label">Templates:</span>
              <span className="value">{debugInfo?.wordpressConnections.templateCount}</span>
            </div>
            <div className="status-item">
              <span className="label">Last Updated:</span>
              <span className="value">{debugInfo?.wordpressConnections.lastUpdated || 'Never'}</span>
            </div>
            {debugInfo?.wordpressConnections.errors && debugInfo.wordpressConnections.errors.length > 0 && (
              <div className="status-item error">
                <span className="label">Errors:</span>
                <div className="error-list">
                  {debugInfo.wordpressConnections.errors.map((error, index) => (
                    <div key={index} className="error-item">{error}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* File System Status */}
        <div className="debug-section">
          <h3>
            <FontAwesomeIcon icon={faFileAlt} />
            File System Status
          </h3>
          <div className="status-grid">
            <div className="status-item">
              <span className="label">Writable:</span>
              <span className={`value ${debugInfo?.fileSystem.writable ? 'success' : 'error'}`}>
                <FontAwesomeIcon icon={debugInfo?.fileSystem.writable ? faCheckCircle : faTimesCircle} />
                {debugInfo?.fileSystem.writable ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="status-item">
              <span className="label">Temp Dir:</span>
              <span className="value">{debugInfo?.fileSystem.tempDir || 'Unknown'}</span>
            </div>
            <div className="status-item">
              <span className="label">User Data Dir:</span>
              <span className="value">{debugInfo?.fileSystem.userDataDir || 'Unknown'}</span>
            </div>
            {debugInfo?.fileSystem.error && (
              <div className="status-item error">
                <span className="label">Error:</span>
                <span className="value">{debugInfo.fileSystem.error}</span>
              </div>
            )}
          </div>
        </div>

        {/* Template Save Attempts */}
        {debugInfo?.templateSaveAttempts && debugInfo.templateSaveAttempts.length > 0 && (
          <div className="debug-section">
            <h3>
              <FontAwesomeIcon icon={faSave} />
              Recent Template Save Attempts
            </h3>
            <div className="attempts-list">
              {debugInfo.templateSaveAttempts.slice(-10).map((attempt, index) => (
                <div key={index} className={`attempt-item ${attempt.success ? 'success' : 'error'}`}>
                  <div className="attempt-header">
                    <span className="attempt-time">{new Date(attempt.timestamp).toLocaleString()}</span>
                    <span className={`attempt-status ${attempt.success ? 'success' : 'error'}`}>
                      <FontAwesomeIcon icon={attempt.success ? faCheckCircle : faTimesCircle} />
                      {attempt.success ? 'Success' : 'Failed'}
                    </span>
                  </div>
                  <div className="attempt-details">
                    <div className="attempt-name">{attempt.templateName}</div>
                    <div className="attempt-site">Site ID: {attempt.siteId}</div>
                    {attempt.error && (
                      <div className="attempt-error">Error: {attempt.error}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Errors */}
        {debugInfo?.recentErrors && debugInfo.recentErrors.length > 0 && (
          <div className="debug-section">
            <h3>
              <FontAwesomeIcon icon={faExclamationTriangle} />
              Recent Errors
            </h3>
            <div className="errors-list">
              {debugInfo.recentErrors.slice(-5).map((error, index) => (
                <div key={index} className="error-item">
                  <div className="error-header">
                    <span className="error-time">{new Date(error.timestamp).toLocaleString()}</span>
                    <span className="error-context">{error.context}</span>
                  </div>
                  <div className="error-message">{error.error}</div>
                  {error.stackTrace && (
                    <details className="error-stack">
                      <summary>Stack Trace</summary>
                      <pre>{error.stackTrace}</pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Test Results */}
        {testResults.length > 0 && (
          <div className="debug-section">
            <h3>
              <FontAwesomeIcon icon={faCog} />
              Test Results
            </h3>
            <div className="test-results">
              {testResults.map((result, index) => (
                <div key={index} className={`test-result ${result.success ? 'success' : 'error'}`}>
                  <div className="test-header">
                    <span className="test-name">{result.name}</span>
                    <span className={`test-status ${result.success ? 'success' : 'error'}`}>
                      <FontAwesomeIcon icon={result.success ? faCheckCircle : faTimesCircle} />
                      {result.success ? 'Passed' : 'Failed'}
                    </span>
                  </div>
                  {result.error && (
                    <div className="test-error">Error: {result.error}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="debug-actions">
          <button 
            onClick={runTemplateSaveTest} 
            className="test-btn"
            disabled={isRunningTest}
          >
            {isRunningTest ? (
              <>
                <FontAwesomeIcon icon={faSpinner} spin />
                Running Tests...
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faCog} />
                Run Template Save Tests
              </>
            )}
          </button>
          
          <button 
            onClick={() => setShowAdvanced(!showAdvanced)} 
            className="advanced-btn"
          >
            <FontAwesomeIcon icon={faInfoCircle} />
            {showAdvanced ? 'Hide' : 'Show'} Advanced Info
          </button>
        </div>

        {/* Advanced Information */}
        {showAdvanced && debugInfo && (
          <div className="debug-section advanced">
            <h3>
              <FontAwesomeIcon icon={faInfoCircle} />
              Advanced Information
            </h3>
            <div className="advanced-content">
              <div className="advanced-item">
                <h4>Memory Usage</h4>
                <pre>{JSON.stringify(debugInfo.memoryUsage, null, 2)}</pre>
              </div>
              <div className="advanced-item">
                <h4>User Agent</h4>
                <pre>{debugInfo.userAgent}</pre>
              </div>
              <div className="advanced-item">
                <h4>CPU Usage</h4>
                <pre>{JSON.stringify(debugInfo.cpuUsage, null, 2)}</pre>
              </div>
              {debugInfo.diskSpace && (
                <div className="advanced-item">
                  <h4>Disk Space</h4>
                  <pre>{JSON.stringify(debugInfo.diskSpace, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WindowsTemplateDebugger;
