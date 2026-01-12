/// <reference types="./preload" />
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  HashRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
  Navigate,
} from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGlobe,
  faRobot,
  faHome,
  faShieldAlt,
  faCog,
  faServer,
  faQuestion,
  faShare,
  faDocker,
  faDesktop,
  faFingerprint,
  faComments,
  faChevronDown,
  faChevronUp,
  faChartBar,
  faWrench,
  faLaptopCode,
} from './utils/fontAwesomeIcons';
import LandingPage from './components/LandingPage';
import { AIKeysManager } from './components/AIKeysManager';
import { HomepageEditor } from './components/HomepageEditor';
import SSLAnalyzer from './components/SSLAnalyzer/SSLAnalyzer';
import CompanyResearchPage from './components/CompanyResearchPage/CompanyResearchPage';
import URLFileViewerPage from './components/HomepageEditor/URLFileViewerPage';
import ErrorBoundary from './components/ErrorBoundary';
import { EGBlogging } from './components/EGBlog';
import { EGSocialMedia } from './components/EGSocialMedia';
import MCPServer from './components/MCPServer/MCPServer';
import EGDesktopControl from './components/EGDesktop/EGDesktopControl';
import SignInPage from './components/Auth/SignInPage';
import AuthButton from './components/Auth/AuthButton';
import UserProfile from './components/Auth/UserProfile';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import './App.css';
import EGSEOAnalyzer from './components/EG SEO Analyzer/EGSEOAnalyzer';
import EGChatting from './components/EGChatting';
import EGBusinessIdentity from './components/EGBusinessIdentity';
import BusinessIdentityTab from './components/EGBusinessIdentity/BusinessIdentityTab';
import FinanceHub from './components/FinanceHub/FinanceHub';
import { UpdateDialog } from './components/UpdateDialog';
import { DockerManager } from './components/DockerManager';

const GEMMA_MODEL_ID = 'gemma3:4b';

function SupportModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logFilter, setLogFilter] = useState<{ type?: string; status?: string }>({});
  const [showLogViewer, setShowLogViewer] = useState(false);

  // Fetch activity logs
  const fetchActivityLogs = async () => {
    if (!window.electron?.invoke) return;
    
    setIsLoadingLogs(true);
    try {
      const result = await window.electron.invoke('sqlite-activity-get-recent', 100, 0, logFilter);
      if (result?.success && result?.data) {
        setActivityLogs(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch activity logs:', error);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // Load logs when modal opens and log viewer is shown
  useEffect(() => {
    if (isOpen && showLogViewer) {
      fetchActivityLogs();
    }
  }, [isOpen, showLogViewer, logFilter]);

  if (!isOpen) return null;

  // Detect platform and get appropriate download link
  const platform = typeof window !== 'undefined' && window.electron?.platform ? window.electron.platform : 'unknown';
  const downloadUrl = platform === 'win32' 
    ? 'https://www.distantdesktop.com/download/distant-desktop.exe'
    : platform === 'darwin'
    ? 'https://www.distantdesktop.com/download/macos/DistantDesktop.dmg'
    : null;
  const downloadLabel = platform === 'win32' 
    ? 'Download for Windows'
    : platform === 'darwin'
    ? 'Download for macOS'
    : 'Download';

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#1e1e1e',
        border: '1px solid #333',
        borderRadius: '8px',
        padding: '30px',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '80vh',
        overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ color: '#fff', margin: 0 }}>Support & Help</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#888',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Download Section */}
          {downloadUrl && (
            <div>
              <h3 style={{ color: '#FF5722', marginBottom: '10px', fontSize: '18px' }}>⬇️ Download</h3>
              <button
                onClick={() => window.open(downloadUrl, '_blank')}
                style={{
                  padding: '12px 20px',
                  backgroundColor: '#FF5722',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  width: '100%',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#E64A19'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FF5722'}
              >
                {downloadLabel}
              </button>
            </div>
          )}

          {/* Contact Information */}
          <div>
            <h3 style={{ color: '#4CAF50', marginBottom: '10px', fontSize: '18px' }}>📧 Contact</h3>
            <div style={{ color: '#ccc', lineHeight: '1.6' }}>
              <p style={{ margin: '8px 0' }}>Email: support@egdesk.com</p>
              <p style={{ margin: '8px 0' }}>Phone: 02-1234-5678</p>
              <p style={{ margin: '8px 0' }}>Hours: Weekdays 09:00 - 18:00</p>
            </div>
          </div>

          {/* Documentation */}
          <div>
            <h3 style={{ color: '#2196F3', marginBottom: '10px', fontSize: '18px' }}>📚 Documentation & Guides</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={() => window.open('https://docs.egdesk.com', '_blank')}
                style={{
                  padding: '10px 15px',
                  backgroundColor: '#2a2a2a',
                  color: '#fff',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2a2a2a'}
              >
                📖 User Guide
              </button>
              <button
                onClick={() => window.open('https://docs.egdesk.com/api', '_blank')}
                style={{
                  padding: '10px 15px',
                  backgroundColor: '#2a2a2a',
                  color: '#fff',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2a2a2a'}
              >
                🔌 API Documentation
              </button>
              <button
                onClick={() => window.open('https://docs.egdesk.com/faq', '_blank')}
                style={{
                  padding: '10px 15px',
                  backgroundColor: '#2a2a2a',
                  color: '#fff',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2a2a2a'}
              >
                ❓ Frequently Asked Questions
              </button>
            </div>
          </div>

          {/* Community */}
          <div>
            <h3 style={{ color: '#FF9800', marginBottom: '10px', fontSize: '18px' }}>💬 Community</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={() => window.open('https://community.egdesk.com', '_blank')}
                style={{
                  padding: '10px 15px',
                  backgroundColor: '#2a2a2a',
                  color: '#fff',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2a2a2a'}
              >
                🌐 Community Forum
              </button>
              <button
                onClick={() => window.open('https://github.com/egdesk', '_blank')}
                style={{
                  padding: '10px 15px',
                  backgroundColor: '#2a2a2a',
                  color: '#fff',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2a2a2a'}
              >
                💻 GitHub Issues
              </button>
            </div>
          </div>

          {/* Version Info */}
          <div>
            <h3 style={{ color: '#9C27B0', marginBottom: '10px', fontSize: '18px' }}>ℹ️ Version Info</h3>
            <div style={{ 
              backgroundColor: '#2a2a2a', 
              padding: '12px', 
              borderRadius: '4px',
              border: '1px solid #444',
              color: '#ccc',
              fontSize: '14px'
            }}>
              <p style={{ margin: '4px 0' }}>EGDesk Version: 1.0.4</p>
              <p style={{ margin: '4px 0' }}>Build: 2025.10.30</p>
            </div>
          </div>

          {/* Activity Log Viewer */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ color: '#00BCD4', margin: 0, fontSize: '18px' }}>📋 Activity Logs</h3>
              <button
                onClick={() => {
                  setShowLogViewer(!showLogViewer);
                  if (!showLogViewer) {
                    fetchActivityLogs();
                  }
                }}
                style={{
                  padding: '6px 12px',
                  backgroundColor: showLogViewer ? '#00BCD4' : '#2a2a2a',
                  color: '#fff',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => !showLogViewer && (e.currentTarget.style.backgroundColor = '#333')}
                onMouseLeave={(e) => !showLogViewer && (e.currentTarget.style.backgroundColor = '#2a2a2a')}
              >
                {showLogViewer ? 'Hide Logs' : 'View Logs'}
              </button>
            </div>

            {showLogViewer && (
              <div style={{
                backgroundColor: '#1a1a1a',
                border: '1px solid #444',
                borderRadius: '4px',
                padding: '15px',
                maxHeight: '400px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                {/* Filters */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <select
                    value={logFilter.type || ''}
                    onChange={(e) => setLogFilter({ ...logFilter, type: e.target.value || undefined })}
                    style={{
                      padding: '6px 10px',
                      backgroundColor: '#2a2a2a',
                      color: '#fff',
                      border: '1px solid #444',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      flex: 1,
                      minWidth: '120px'
                    }}
                  >
                    <option value="">All Types</option>
                    <option value="user">User</option>
                    <option value="system">System</option>
                    <option value="error">Error</option>
                    <option value="audit">Audit</option>
                  </select>
                  <select
                    value={logFilter.status || ''}
                    onChange={(e) => setLogFilter({ ...logFilter, status: e.target.value || undefined })}
                    style={{
                      padding: '6px 10px',
                      backgroundColor: '#2a2a2a',
                      color: '#fff',
                      border: '1px solid #444',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      flex: 1,
                      minWidth: '120px'
                    }}
                  >
                    <option value="">All Status</option>
                    <option value="success">Success</option>
                    <option value="failure">Failure</option>
                    <option value="pending">Pending</option>
                    <option value="info">Info</option>
                  </select>
                  <button
                    onClick={fetchActivityLogs}
                    disabled={isLoadingLogs}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#4CAF50',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: isLoadingLogs ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      opacity: isLoadingLogs ? 0.6 : 1
                    }}
                  >
                    {isLoadingLogs ? 'Loading...' : 'Refresh'}
                  </button>
                </div>

                {/* Logs List */}
                <div style={{
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #333',
                  borderRadius: '4px',
                  padding: '10px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  fontSize: '11px',
                  fontFamily: 'monospace'
                }}>
                  {isLoadingLogs ? (
                    <div style={{ color: '#888', textAlign: 'center', padding: '20px' }}>
                      Loading logs...
                    </div>
                  ) : activityLogs.length === 0 ? (
                    <div style={{ color: '#888', textAlign: 'center', padding: '20px' }}>
                      No activity logs found
                    </div>
                  ) : (
                    activityLogs.map((log, index) => {
                      // Debug: log the structure on first render (remove in production)
                      if (index === 0 && activityLogs.length > 0) {
                        console.log('Sample activity log structure:', log);
                      }

                      const statusColor = 
                        log.status === 'success' ? '#4CAF50' :
                        log.status === 'failure' ? '#F44336' :
                        log.status === 'pending' ? '#FF9800' :
                        '#2196F3';
                      
                      const typeColor =
                        log.type === 'error' ? '#F44336' :
                        log.type === 'user' ? '#2196F3' :
                        log.type === 'system' ? '#9C27B0' :
                        '#00BCD4';

                      // Parse timestamp - activity manager returns createdAt (camelCase) as ISO string
                      const dateValue = log.createdAt || log.created_at;
                      let timestamp = 'Unknown';
                      
                      if (dateValue) {
                        try {
                          const date = new Date(dateValue);
                          if (!isNaN(date.getTime())) {
                            timestamp = date.toLocaleString();
                          } else {
                            // If direct parsing fails, show raw value for debugging
                            timestamp = String(dateValue);
                          }
                        } catch (e) {
                          // Fallback: show raw value
                          timestamp = String(dateValue);
                        }
                      }

                      return (
                        <div
                          key={log.id || index}
                          style={{
                            marginBottom: '12px',
                            padding: '10px',
                            backgroundColor: '#1a1a1a',
                            border: '1px solid #333',
                            borderRadius: '4px',
                            borderLeft: `3px solid ${statusColor}`
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '6px' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{
                                padding: '2px 6px',
                                backgroundColor: typeColor,
                                color: '#fff',
                                borderRadius: '3px',
                                fontSize: '10px',
                                fontWeight: 'bold'
                              }}>
                                {log.type || 'unknown'}
                              </span>
                              <span style={{
                                padding: '2px 6px',
                                backgroundColor: statusColor,
                                color: '#fff',
                                borderRadius: '3px',
                                fontSize: '10px',
                                fontWeight: 'bold'
                              }}>
                                {log.status || 'unknown'}
                              </span>
                              <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '12px' }}>
                                {log.action || 'unknown action'}
                              </span>
                            </div>
                            <span style={{ color: '#888', fontSize: '10px', whiteSpace: 'nowrap' }}>
                              {timestamp}
                            </span>
                          </div>
                          
                          {log.target && (
                            <div style={{ color: '#ccc', marginBottom: '4px', fontSize: '11px' }}>
                              <strong>Target:</strong> {log.target}
                            </div>
                          )}
                          
                          {log.errorMessage && (
                            <div style={{
                              color: '#F44336',
                              marginBottom: '4px',
                              padding: '6px',
                              backgroundColor: '#2a1a1a',
                              borderRadius: '3px',
                              fontSize: '11px'
                            }}>
                              <strong>Error:</strong> {log.errorMessage}
                            </div>
                          )}
                          
                          {log.details && typeof log.details === 'object' && Object.keys(log.details).length > 0 && (
                            <details style={{ marginTop: '6px' }}>
                              <summary style={{ color: '#888', cursor: 'pointer', fontSize: '11px' }}>
                                Details ({Object.keys(log.details).length} fields)
                              </summary>
                              <div style={{
                                marginTop: '6px',
                                padding: '8px',
                                backgroundColor: '#0a0a0a',
                                borderRadius: '3px',
                                fontSize: '10px',
                                color: '#ccc',
                                maxHeight: '150px',
                                overflowY: 'auto'
                              }}>
                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
                              </div>
                            </details>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Log Count */}
                {!isLoadingLogs && activityLogs.length > 0 && (
                  <div style={{ color: '#888', fontSize: '11px', textAlign: 'right' }}>
                    Showing {activityLogs.length} log{activityLogs.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DebugModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [wooriId, setWooriId] = useState('');
  const [wooriPassword, setWooriPassword] = useState('');
  const [wooriProxy, setWooriProxy] = useState('');
  const [wooriGeminiKey, setWooriGeminiKey] = useState('');
  const [chromeUrl, setChromeUrl] = useState('');
  const [chromeProxy, setChromeProxy] = useState('');
  const [openDevTools, setOpenDevTools] = useState(false);
  const [runLighthouse, setRunLighthouse] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [crawlerResults, setCrawlerResults] = useState<any>(null);
  const [homepageCrawlUrl, setHomepageCrawlUrl] = useState('');
  const [homepageCrawlResults, setHomepageCrawlResults] = useState<any>(null);
  const [multiPageCrawlUrl, setMultiPageCrawlUrl] = useState('');
  const [multiPageCrawlResults, setMultiPageCrawlResults] = useState<any>(null);
  const [maxPages, setMaxPages] = useState(5);
  const [youtubeUsername, setYoutubeUsername] = useState('');
  const [youtubePassword, setYoutubePassword] = useState('');
  const [youtubeVideoPath, setYoutubeVideoPath] = useState('');
  const [youtubeTitle, setYoutubeTitle] = useState('');
  const [youtubeDescription, setYoutubeDescription] = useState('');
  const [youtubeTags, setYoutubeTags] = useState('');
  const [youtubeVisibility, setYoutubeVisibility] = useState<'public' | 'unlisted' | 'private'>('public');
  const [youtubeChromeUserDataDir, setYoutubeChromeUserDataDir] = useState('');
  const [youtubeChromeExecutablePath, setYoutubeChromeExecutablePath] = useState('');
  const [youtubeUseChromeProfile, setYoutubeUseChromeProfile] = useState(false);
  const [facebookUsername, setFacebookUsername] = useState('');
  const [facebookPassword, setFacebookPassword] = useState('');
  const [facebookImagePath, setFacebookImagePath] = useState('');
  const [facebookText, setFacebookText] = useState('');
  const [savedTests, setSavedTests] = useState<any[]>([]);
  const [showSavedTests, setShowSavedTests] = useState(false);
  const [isRecordingEnhanced, setIsRecordingEnhanced] = useState(false);
  const [currentTestCode, setCurrentTestCode] = useState<string>('');
  const [playwrightDownloads, setPlaywrightDownloads] = useState<any[]>([]);

  // Load saved tests when modal opens
  useEffect(() => {
    if (isOpen) {
      (async () => {
        const result = await (window as any).electron.debug.getPlaywrightTests();
        if (result.success) {
          setSavedTests(result.tests);
        }
      })();
    }
  }, [isOpen]);

  // Define addDebugLog function at the component level
  const addDebugLog = (message: string) => {
    setDebugLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  // Helper functions for Playwright downloads
  const loadPlaywrightDownloads = async () => {
    try {
      const result = await (window as any).electron.debug.getPlaywrightDownloads();
      if (result.success) {
        setPlaywrightDownloads(result.files || []);
      }
    } catch (error) {
      console.error('[DebugModal] Failed to load playwright downloads:', error);
    }
  };

  const handleOpenDownload = async (filePath: string) => {
    try {
      await (window as any).electron.debug.openPlaywrightDownload(filePath);
    } catch (error) {
      console.error('[DebugModal] Failed to open download:', error);
      alert('Failed to open file');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Load playwright downloads when modal opens
  useEffect(() => {
    if (isOpen) {
      loadPlaywrightDownloads();
    }
  }, [isOpen]);

  // Listen for Playwright test saved events
  useEffect(() => {
    const handleTestSaved = (event: any, data: any) => {
      addDebugLog(`📁 Test saved: ${data.filePath}`);
      // Refresh test list
      (async () => {
        const result = await (window as any).electron.debug.getPlaywrightTests();
        if (result.success) {
          setSavedTests(result.tests);
        }
      })();
    };

    (window as any).electron.ipcRenderer.on('playwright-test-saved', handleTestSaved);

    return () => {
      (window as any).electron.ipcRenderer.removeListener('playwright-test-saved', handleTestSaved);
    };
  }, []);

  // Listen for real-time test updates
  useEffect(() => {
    const handleTestUpdate = (event: any, data: any) => {
      setCurrentTestCode(data.code);
    };

    (window as any).electron.ipcRenderer.on('playwright-test-update', handleTestUpdate);

    return () => {
      (window as any).electron.ipcRenderer.removeListener('playwright-test-update', handleTestUpdate);
    };
  }, []);

  // Listen for auto-stop events
  useEffect(() => {
    const handleAutoStop = (event: any, data: any) => {
      addDebugLog(`🔌 Recording auto-stopped: ${data.reason}`);
      setIsRecordingEnhanced(false);
      setCurrentTestCode('');
      
      // Refresh test list
      (async () => {
        const result = await (window as any).electron.debug.getPlaywrightTests();
        if (result.success) {
          setSavedTests(result.tests);
        }
      })();
    };

    (window as any).electron.ipcRenderer.on('recorder-auto-stopped', handleAutoStop);

    return () => {
      (window as any).electron.ipcRenderer.removeListener('recorder-auto-stopped', handleAutoStop);
    };
  }, []);

  // Listen for Playwright test errors
  useEffect(() => {
    const handleTestError = (event: any, data: any) => {
      console.error('Playwright test error:', data);
      addDebugLog(`❌ Test error: ${data.error}`);
      
      // Show user-friendly alert if it's a user-friendly error
      if (data.userFriendly) {
        alert(data.error);
        
        // Log technical details to console for debugging
        if (data.details || data.technicalDetails) {
          console.log('Technical details:', data.details || data.technicalDetails);
        }
      }
    };

    const handleTestInfo = (event: any, data: any) => {
      console.log('Playwright test info:', data);
      addDebugLog(`ℹ️ ${data.message}`);
    };

    const handleTestCompleted = (event: any, data: any) => {
      if (data.success) {
        addDebugLog(`✅ Test completed successfully`);
      } else {
        addDebugLog(`❌ Test failed: ${data.error || 'Unknown error'}`);
        
        // Show alert for test failures
        alert(`Test replay failed: ${data.error || 'Unknown error'}`);
        
        // Log details for debugging
        if (data.details) {
          console.log('Test failure details:', data.details);
        }
      }
    };

    (window as any).electron.ipcRenderer.on('playwright-test-error', handleTestError);
    (window as any).electron.ipcRenderer.on('playwright-test-info', handleTestInfo);
    (window as any).electron.ipcRenderer.on('playwright-test-completed', handleTestCompleted);

    return () => {
      (window as any).electron.ipcRenderer.removeListener('playwright-test-error', handleTestError);
      (window as any).electron.ipcRenderer.removeListener('playwright-test-info', handleTestInfo);
      (window as any).electron.ipcRenderer.removeListener('playwright-test-completed', handleTestCompleted);
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#1e1e1e',
        border: '1px solid #333',
        borderRadius: '8px',
        padding: '20px',
        maxWidth: '800px',
        width: '90%',
        maxHeight: '80vh',
        overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ color: '#fff', margin: 0 }}>Debug Panel</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#888',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Woori Section */}
          <div>
            <h3 style={{ color: '#FF5A4A', marginBottom: '10px' }}>Woori Bank Automation</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <input
                type="text"
                placeholder="Woori ID"
                value={wooriId}
                onChange={(e) => setWooriId(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }}
              />
              <input
                type="password"
                placeholder="Woori Password"
                value={wooriPassword}
                onChange={(e) => setWooriPassword(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <input
                type="text"
                placeholder="Proxy (optional)"
                value={wooriProxy}
                onChange={(e) => setWooriProxy(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }}
              />
              <input
                type="password"
                placeholder="Gemini API Key (optional)"
                value={wooriGeminiKey}
                onChange={(e) => setWooriGeminiKey(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }}
              />
            </div>
            <button
              onClick={async () => {
                try {
                  const result = await (window as any).electron.debug.startWooriAutomation(
                    wooriId || undefined,
                    wooriPassword || undefined,
                    wooriProxy || undefined,
                    wooriGeminiKey || undefined
                  );
                  if (!result?.success) {
                    console.error('Woori automation failed:', result?.error);
                    alert(`Woori automation failed${result?.error ? `: ${result.error}` : ''}`);
                  } else {
                    console.log('Woori automation result:', result);
                    alert('Woori automation completed successfully. Check console for AI analysis details.');
                  }
                } catch (e: any) {
                  console.error('Woori automation error:', e);
                  alert(`Woori automation error: ${e?.message || e}`);
                }
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: '#FF5A4A',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Start Woori Bank Automation
            </button>
          </div>

          {/* Chrome URL Opener Section */}
          <div>
            <h3 style={{ color: '#4CAF50', marginBottom: '10px' }}>Chrome URL Opener</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '10px' }}>
              <input
                type="url"
                placeholder="Enter URL to open in Chrome (e.g., https://example.com)"
                value={chromeUrl}
                onChange={(e) => setChromeUrl(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }}
              />
              <input
                type="text"
                placeholder="Proxy (optional, e.g., http://proxy:port)"
                value={chromeProxy}
                onChange={(e) => setChromeProxy(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }}
              />
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={openDevTools}
                    onChange={(e) => setOpenDevTools(e.target.checked)}
                    style={{ transform: 'scale(1.2)' }}
                  />
                  <span>Open DevTools</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={runLighthouse}
                    onChange={(e) => setRunLighthouse(e.target.checked)}
                    style={{ transform: 'scale(1.2)' }}
                  />
                  <span>Run Lighthouse</span>
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={async () => {
                if (!chromeUrl.trim()) {
                  alert('Please enter a URL');
                  return;
                }
                
                // Clear previous debug logs
                setDebugLogs([]);
                
                // Add initial debug log
                addDebugLog('Starting Chrome launch process...');
                
                try {
                  addDebugLog('🚀 Launching Chrome with enhanced Lighthouse integration...');
                  
                  const result = await (window as any).electron.debug.launchChromeWithUrl(
                    chromeUrl.trim(),
                    chromeProxy.trim() || undefined,
                    openDevTools,
                    runLighthouse
                  );
                  
                  if (!result?.success) {
                    addDebugLog(`❌ Chrome launch failed: ${result?.error || 'Unknown error'}`);
                    console.error('Chrome launch failed:', result?.error);
                    alert(`Chrome launch failed${result?.error ? `: ${result.error}` : ''}`);
                  } else {
                    addDebugLog('✅ Chrome launched successfully');
                    console.log('Chrome launched successfully:', result);
                    
                    const features = [];
                    if (openDevTools) features.push('DevTools');
                    if (runLighthouse) {
                      features.push('Lighthouse (playwright-lighthouse)');
                      addDebugLog('🔍 Lighthouse audit will run automatically using playwright-lighthouse');
                      addDebugLog('📊 Reports will be saved to ./output/ directory');
                      addDebugLog('📄 PDF with expanded sections will be generated automatically');
                      addDebugLog('⚠️ If Lighthouse fails, manual instructions will be provided');
                    }
                    
                    const message = features.length > 0 
                      ? `Chrome launched successfully with ${features.join(' and ')}!`
                      : 'Chrome launched successfully!';
                    
                    addDebugLog(`🎉 ${message}`);
                    alert(message);
                  }
                } catch (e: any) {
                  addDebugLog(`❌ Chrome launch error: ${e?.message || e}`);
                  console.error('Chrome launch error:', e);
                  alert(`Chrome launch error: ${e?.message || e}`);
                }
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Open URL in Chrome
            </button>
            <button
              onClick={async () => {
                try {
                  if (!chromeUrl) {
                    addDebugLog('⚠️ Please enter a URL first');
                    return;
                  }
                  
                  addDebugLog('🚀 Launching enhanced Playwright recorder with keyboard tracking...');
                  
                  const result = await (window as any).electron.debug.launchPlaywrightRecorderEnhanced(
                    chromeUrl.startsWith('http') ? chromeUrl : `https://${chromeUrl}`
                  );
                  
                  if (result?.success) {
                  addDebugLog('✅ Enhanced recorder launched successfully');
                  addDebugLog('📝 All keyboard events including Enter will be captured');
                  addDebugLog(`📁 Test file: ${result.filePath}`);
                  addDebugLog('🖥️ Code viewer window opened - watch it update in real-time!');
                  addDebugLog('⏰ Click "Stop Recording" button or close browser when done');
                  setIsRecordingEnhanced(true);
                  } else {
                    addDebugLog(`❌ Failed to launch enhanced recorder: ${result?.error}`);
                  }
                } catch (error) {
                  console.error('Error launching recorder:', error);
                  addDebugLog(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: '#9C27B0',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              🎹 Record with Keyboard Tracking
            </button>
            {isRecordingEnhanced && (
              <button
                onClick={async () => {
                  addDebugLog('⏹️ Stopping enhanced recorder...');
                  
                  const result = await (window as any).electron.debug.stopPlaywrightRecorderEnhanced();
                  
                  if (result?.success) {
                    addDebugLog('✅ Recording saved successfully');
                    addDebugLog(`📁 Test saved to: ${result.filePath}`);
                    setIsRecordingEnhanced(false);
                    setCurrentTestCode(''); // Clear the code viewer
                    
                    // Refresh test list
                    const testsResult = await (window as any).electron.debug.getPlaywrightTests();
                    if (testsResult.success) {
                      setSavedTests(testsResult.tests);
                    }
                  } else {
                    addDebugLog(`❌ Failed to stop recorder: ${result?.error}`);
                  }
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                ⏹️ Stop Recording
              </button>
            )}
            <button
              onClick={async () => {
                const result = await (window as any).electron.debug.getPlaywrightTests();
                if (result.success) {
                  setSavedTests(result.tests);
                  setShowSavedTests(!showSavedTests);
                }
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: '#607D8B',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              View Saved Tests ({savedTests.length})
            </button>
            </div>
            
            {/* Real-time Test Code Display */}
            {isRecordingEnhanced && currentTestCode && (
              <div style={{ 
                marginTop: '20px', 
                padding: '15px', 
                backgroundColor: '#1a1a1a', 
                borderRadius: '4px',
                border: '1px solid #444'
              }}>
                <h4 style={{ color: '#fff', margin: '0 0 10px 0' }}>
                  📝 Generated Test Code (Real-time)
                </h4>
                <pre style={{
                  backgroundColor: '#0d0d0d',
                  padding: '15px',
                  borderRadius: '4px',
                  overflow: 'auto',
                  maxHeight: '400px',
                  color: '#e0e0e0',
                  fontSize: '12px',
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                  lineHeight: '1.5',
                  margin: 0
                }}>
                  <code>{currentTestCode}</code>
                </pre>
              </div>
            )}
            
            {/* Saved Tests Display */}
            {showSavedTests && savedTests.length > 0 && (
              <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#2a2a2a', borderRadius: '4px' }}>
                <h4 style={{ color: '#fff', margin: '0 0 15px 0' }}>Saved Playwright Tests</h4>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {savedTests
                    .filter(test => !test.name.includes('.timed.spec.js')) // Hide timed versions from UI
                    .map((test, index) => {
                    
                    return (
                      <div key={index} style={{ 
                        padding: '10px', 
                        marginBottom: '10px', 
                        backgroundColor: '#1e1e1e', 
                        borderRadius: '4px',
                        border: '1px solid #333'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <strong style={{ color: '#fff', fontSize: '14px' }}>{test.name}</strong>
                              <span style={{ 
                                fontSize: '11px', 
                                color: '#4CAF50',
                                backgroundColor: 'rgba(76, 175, 80, 0.2)',
                                padding: '2px 6px',
                                borderRadius: '3px',
                                border: '1px solid #4CAF50'
                              }}>
                                ⏱️ Auto-Timed
                              </span>
                            </div>
                            <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                              Created: {new Date(test.createdAt).toLocaleString()} | Size: {test.size} bytes
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={async () => {
                                const result = await (window as any).electron.debug.viewPlaywrightTest(test.path);
                                if (result.success) {
                                  console.log(`👁️ Viewing test: ${test.name}`);
                                  setDebugLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: 👁️ Opened test in code viewer: ${test.name}`]);
                                } else {
                                  alert(`Failed to view test: ${result.error}`);
                                }
                              }}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#2196F3',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                              title="View code"
                            >
                              👁️ View
                            </button>
                            <button
                              onClick={async () => {
                                const result = await (window as any).electron.debug.runPlaywrightTest(test.path);
                                if (result.success) {
                                  console.log(`🎬 Running test with timing: ${test.name}`);
                                  setDebugLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: 🎬⏱️ Running test with timing: ${test.name}`]);
                                } else {
                                  alert(`Failed to run test: ${result.error}`);
                                }
                              }}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#4CAF50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                            >
                              ▶️ Replay
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm(`Are you sure you want to delete "${test.name}"?`)) {
                                  const result = await (window as any).electron.debug.deletePlaywrightTest(test.path);
                                  if (result.success) {
                                    // Refresh the test list
                                    const refreshResult = await (window as any).electron.debug.getPlaywrightTests();
                                    if (refreshResult.success) {
                                      setSavedTests(refreshResult.tests);
                                    }
                                    setDebugLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: 🗑️ Deleted test: ${test.name}`]);
                                  } else {
                                    alert(`Failed to delete test: ${result.error}`);
                                  }
                                }
                              }}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#f44336',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                              title="Delete test"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                        <div style={{ 
                          fontSize: '11px', 
                          color: '#aaa', 
                          fontFamily: 'monospace',
                          backgroundColor: '#0a0a0a',
                          padding: '8px',
                          borderRadius: '4px',
                          overflow: 'hidden',
                          whiteSpace: 'pre-wrap'
                        }}>
                          {test.preview}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Web Crawler Section */}
          <div>
            <h3 style={{ color: '#9C27B0', marginBottom: '10px' }}>Web Crawler</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '10px' }}>
              <input
                type="url"
                placeholder="Enter URL to crawl (e.g., https://example.com)"
                value={chromeUrl}
                onChange={(e) => setChromeUrl(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }}
              />
              <input
                type="text"
                placeholder="Proxy (optional, e.g., http://proxy:port)"
                value={chromeProxy}
                onChange={(e) => setChromeProxy(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }}
              />
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={openDevTools}
                    onChange={(e) => setOpenDevTools(e.target.checked)}
                    style={{ transform: 'scale(1.2)' }}
                  />
                  <span>Open DevTools</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={runLighthouse}
                    onChange={(e) => setRunLighthouse(e.target.checked)}
                    style={{ transform: 'scale(1.2)' }}
                  />
                  <span>Run Lighthouse</span>
                </label>
              </div>
            </div>
            <button
              onClick={async () => {
                if (!chromeUrl.trim()) {
                  alert('Please enter a URL');
                  return;
                }
                
                // Clear previous debug logs
                setDebugLogs([]);
                
                // Add initial debug log
                addDebugLog('Starting web crawler...');
                
                try {
                  addDebugLog('🕷️ Launching Playwright crawler...');
                  
                  const result = await (window as any).electron.debug.crawlWebsite(
                    chromeUrl.trim(),
                    chromeProxy.trim() || undefined,
                    openDevTools
                  );
                  
                  if (!result?.success) {
                    addDebugLog(`❌ Crawler failed: ${result?.error || 'Unknown error'}`);
                    console.error('Crawler failed:', result?.error);
                    alert(`Crawler failed${result?.error ? `: ${result.error}` : ''}`);
                    setCrawlerResults(null);
                  } else {
                    addDebugLog('✅ Crawler completed successfully');
                    console.log('Crawler result:', result);
                    
                    const stats = result.data?.stats || {};
                    const message = `Crawler found ${stats.totalLinks || 0} links (${stats.internalLinks || 0} internal, ${stats.externalLinks || 0} external)`;
                    
                    addDebugLog(`📊 ${message}`);
                    addDebugLog(`🔗 Internal links: ${stats.internalLinks || 0}`);
                    addDebugLog(`🌐 External links: ${stats.externalLinks || 0}`);
                    addDebugLog(`📄 Forms found: ${stats.forms || 0}`);
                    addDebugLog(`🖼️ Images found: ${stats.images || 0}`);
                    addDebugLog(`💾 Results saved to: ${result.filepath || 'N/A'}`);
                    
                    setCrawlerResults(result.data);
                    alert(message);
                  }
                } catch (e: any) {
                  addDebugLog(`❌ Crawler error: ${e?.message || e}`);
                  console.error('Crawler error:', e);
                  alert(`Crawler error: ${e?.message || e}`);
                }
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: '#9C27B0',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Crawl Website
            </button>
          </div>

          {/* Homepage Crawler for Business Identity */}
          <div>
            <h3 style={{ color: '#00BCD4', marginBottom: '10px' }}>Homepage Crawler (Business Identity)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '10px' }}>
              <input
                type="url"
                placeholder="Enter URL to crawl homepage (e.g., https://example.com)"
                value={homepageCrawlUrl}
                onChange={(e) => setHomepageCrawlUrl(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }}
              />
            </div>
            <button
              onClick={async () => {
                if (!homepageCrawlUrl.trim()) {
                  alert('Please enter a URL');
                  return;
                }
                
                addDebugLog('Starting homepage crawl for business identity...');
                setHomepageCrawlResults(null);
                
                try {
                  addDebugLog(`🕷️ Crawling homepage: ${homepageCrawlUrl}`);
                  
                  const result = await (window as any).electron.web.crawlHomepage(homepageCrawlUrl.trim());
                  
                  if (!result?.success) {
                    addDebugLog(`❌ Homepage crawl failed: ${result?.error || 'Unknown error'}`);
                    console.error('Homepage crawl failed:', result?.error);
                    alert(`Homepage crawl failed${result?.error ? `: ${result.error}` : ''}`);
                    setHomepageCrawlResults(null);
                  } else {
                    addDebugLog('✅ Homepage crawl completed successfully');
                    console.log('Homepage crawl result:', result);
                    
                    const nav = result.navigation || {};
                    const pages = result.discoveredPages || {};
                    const message = `Found ${nav.main?.length || 0} main nav links, ${nav.footer?.length || 0} footer links, and ${Object.keys(pages).length} important pages`;
                    
                    addDebugLog(`📊 ${message}`);
                    addDebugLog(`🔗 Main navigation: ${nav.main?.length || 0} links`);
                    addDebugLog(`🔗 Footer navigation: ${nav.footer?.length || 0} links`);
                    addDebugLog(`📄 Discovered pages: ${Object.keys(pages).join(', ') || 'none'}`);
                    addDebugLog(`🌐 Total internal links: ${result.allInternalLinks?.length || 0}`);
                    
                    setHomepageCrawlResults(result);
                    alert(message);
                  }
                } catch (e: any) {
                  addDebugLog(`❌ Homepage crawl error: ${e?.message || e}`);
                  console.error('Homepage crawl error:', e);
                  alert(`Homepage crawl error: ${e?.message || e}`);
                }
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: '#00BCD4',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Crawl Homepage for Business Identity
            </button>
          </div>

          {/* Multi-Page Crawler for Business Identity */}
          <div>
            <h3 style={{ color: '#FF9800', marginBottom: '10px' }}>Multi-Page Crawler (Business Identity)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '10px' }}>
              <input
                type="url"
                placeholder="Enter URL to crawl multiple pages (e.g., https://example.com)"
                value={multiPageCrawlUrl}
                onChange={(e) => setMultiPageCrawlUrl(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label style={{ color: '#fff', fontSize: '12px' }}>Max Pages:</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={maxPages}
                  onChange={(e) => setMaxPages(Math.max(1, Math.min(10, parseInt(e.target.value) || 5)))}
                  style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff', width: '60px' }}
                />
              </div>
            </div>
            <button
              onClick={async () => {
                if (!multiPageCrawlUrl.trim()) {
                  alert('Please enter a URL');
                  return;
                }
                
                addDebugLog('Starting multi-page crawl for business identity...');
                setMultiPageCrawlResults(null);
                
                try {
                  addDebugLog(`🕷️ Crawling multiple pages: ${multiPageCrawlUrl} (max ${maxPages} pages)`);
                  
                  const result = await (window as any).electron.web.crawlMultiplePages(multiPageCrawlUrl.trim(), { maxPages });
                  
                  if (!result?.success) {
                    addDebugLog(`❌ Multi-page crawl failed: ${result?.error || 'Unknown error'}`);
                    console.error('Multi-page crawl failed:', result?.error);
                    alert(`Multi-page crawl failed${result?.error ? `: ${result.error}` : ''}`);
                    setMultiPageCrawlResults(null);
                  } else {
                    addDebugLog('✅ Multi-page crawl completed successfully');
                    console.log('Multi-page crawl result:', result);
                    
                    const message = `Crawled ${result.pagesCrawled || 0} pages with ${result.combinedContent?.totalWordCount || 0} total words`;
                    
                    addDebugLog(`📊 ${message}`);
                    addDebugLog(`📄 Pages crawled: ${result.pages?.map((p: any) => p.pageType).join(', ') || 'none'}`);
                    addDebugLog(`📝 Combined content: ${result.combinedContent?.totalWordCount || 0} words`);
                    
                    setMultiPageCrawlResults(result);
                    alert(message);
                  }
                } catch (e: any) {
                  addDebugLog(`❌ Multi-page crawl error: ${e?.message || e}`);
                  console.error('Multi-page crawl error:', e);
                  alert(`Multi-page crawl error: ${e?.message || e}`);
                }
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: '#FF9800',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Crawl Multiple Pages for Business Identity
            </button>
          </div>

          {/* Multi-Page Crawl Results Section */}
          {multiPageCrawlResults && (
            <div>
              <h3 style={{ color: '#FF9800', marginBottom: '10px' }}>Multi-Page Crawl Results</h3>
              
              {/* Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                <div style={{ backgroundColor: '#2a2a2a', padding: '10px', borderRadius: '4px', textAlign: 'center' }}>
                  <div style={{ color: '#4CAF50', fontSize: '16px', fontWeight: 'bold' }}>{multiPageCrawlResults.pagesCrawled || 0}</div>
                  <div style={{ color: '#888', fontSize: '12px' }}>Pages Crawled</div>
                </div>
                <div style={{ backgroundColor: '#2a2a2a', padding: '10px', borderRadius: '4px', textAlign: 'center' }}>
                  <div style={{ color: '#2196F3', fontSize: '16px', fontWeight: 'bold' }}>{multiPageCrawlResults.combinedContent?.totalWordCount || 0}</div>
                  <div style={{ color: '#888', fontSize: '12px' }}>Total Words</div>
                </div>
                <div style={{ backgroundColor: '#2a2a2a', padding: '10px', borderRadius: '4px', textAlign: 'center' }}>
                  <div style={{ color: '#FF9800', fontSize: '16px', fontWeight: 'bold' }}>{multiPageCrawlResults.siteStructure?.navigation?.main || 0}</div>
                  <div style={{ color: '#888', fontSize: '12px' }}>Nav Links</div>
                </div>
              </div>

              {/* Crawled Pages List */}
              {multiPageCrawlResults.pages && multiPageCrawlResults.pages.length > 0 && (
                <div style={{ marginBottom: '15px' }}>
                  <h4 style={{ color: '#fff', marginBottom: '8px', fontSize: '14px' }}>📄 Crawled Pages:</h4>
                  <div style={{
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    padding: '10px',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    fontSize: '12px'
                  }}>
                    {multiPageCrawlResults.pages.map((page: any, index: number) => (
                      <div key={index} style={{ marginBottom: '12px', padding: '8px', backgroundColor: '#2a2a2a', borderRadius: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <div style={{ color: '#FF9800', fontWeight: 'bold', textTransform: 'capitalize' }}>
                            {page.pageType} ({page.priority})
                          </div>
                          <div style={{ color: '#888', fontSize: '11px' }}>{page.content?.wordCount || 0} words</div>
                        </div>
                        {page.title && (
                          <div style={{ color: '#4CAF50', marginBottom: '2px', fontSize: '11px' }}>Title: {page.title}</div>
                        )}
                        <div style={{ color: '#fff', marginTop: '4px', wordBreak: 'break-all', fontSize: '11px' }}>{page.url}</div>
                        {page.description && (
                          <div style={{ color: '#ccc', marginTop: '4px', fontSize: '11px', fontStyle: 'italic' }}>
                            {page.description.substring(0, 100)}...
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Combined Content Preview */}
              {multiPageCrawlResults.combinedContent?.text && (
                <div style={{ marginBottom: '15px' }}>
                  <h4 style={{ color: '#fff', marginBottom: '8px', fontSize: '14px' }}>📝 Combined Content Preview (first 500 chars):</h4>
                  <div style={{
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    padding: '10px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    color: '#ccc',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {multiPageCrawlResults.combinedContent.text.substring(0, 500)}...
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(multiPageCrawlResults, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `multi-page-crawl-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#FF9800',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Download JSON
                </button>
                <button
                  onClick={() => {
                    if (multiPageCrawlResults.combinedContent?.text) {
                      const blob = new Blob([multiPageCrawlResults.combinedContent.text], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `combined-content-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Download Combined Text
                </button>
                <button
                  onClick={() => setMultiPageCrawlResults(null)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#666',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Clear Results
                </button>
              </div>
            </div>
          )}

          {/* Homepage Crawl Results Section */}
          {homepageCrawlResults && (
            <div>
              <h3 style={{ color: '#00BCD4', marginBottom: '10px' }}>Homepage Crawl Results</h3>
              
              {/* Discovered Pages */}
              {homepageCrawlResults.discoveredPages && Object.keys(homepageCrawlResults.discoveredPages).length > 0 && (
                <div style={{ marginBottom: '15px' }}>
                  <h4 style={{ color: '#fff', marginBottom: '8px', fontSize: '14px' }}>📍 Discovered Important Pages:</h4>
                  <div style={{
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    padding: '10px',
                    fontSize: '12px'
                  }}>
                    {Object.entries(homepageCrawlResults.discoveredPages).map(([key, url]: [string, any]) => (
                      <div key={key} style={{ marginBottom: '8px', padding: '4px', backgroundColor: '#2a2a2a', borderRadius: '2px' }}>
                        <div style={{ color: '#00BCD4', fontWeight: 'bold', textTransform: 'capitalize' }}>{key}:</div>
                        <div style={{ color: '#fff', marginTop: '2px', wordBreak: 'break-all' }}>{url}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Navigation Links */}
              {homepageCrawlResults.navigation && (
                <div style={{ marginBottom: '15px' }}>
                  <h4 style={{ color: '#fff', marginBottom: '8px', fontSize: '14px' }}>🔗 Navigation Links:</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                    <div style={{ backgroundColor: '#2a2a2a', padding: '10px', borderRadius: '4px', textAlign: 'center' }}>
                      <div style={{ color: '#4CAF50', fontSize: '16px', fontWeight: 'bold' }}>{homepageCrawlResults.navigation.main?.length || 0}</div>
                      <div style={{ color: '#888', fontSize: '12px' }}>Main Nav</div>
                    </div>
                    <div style={{ backgroundColor: '#2a2a2a', padding: '10px', borderRadius: '4px', textAlign: 'center' }}>
                      <div style={{ color: '#2196F3', fontSize: '16px', fontWeight: 'bold' }}>{homepageCrawlResults.navigation.footer?.length || 0}</div>
                      <div style={{ color: '#888', fontSize: '12px' }}>Footer</div>
                    </div>
                  </div>

                  {/* Sample Main Nav Links */}
                  {homepageCrawlResults.navigation.main && homepageCrawlResults.navigation.main.length > 0 && (
                    <div style={{ marginBottom: '10px' }}>
                      <h5 style={{ color: '#4CAF50', marginBottom: '6px', fontSize: '12px' }}>Main Navigation (first 10):</h5>
                      <div style={{
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #444',
                        borderRadius: '4px',
                        padding: '10px',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        fontSize: '12px'
                      }}>
                        {homepageCrawlResults.navigation.main.slice(0, 10).map((link: any, index: number) => (
                          <div key={index} style={{ marginBottom: '8px', padding: '4px', backgroundColor: '#2a2a2a', borderRadius: '2px' }}>
                            <div style={{ color: '#4CAF50', fontWeight: 'bold' }}>{link.text || '(no text)'}</div>
                            <div style={{ color: '#fff', marginTop: '2px', wordBreak: 'break-all', fontSize: '11px' }}>{link.normalizedUrl || link.href}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sample Footer Links */}
                  {homepageCrawlResults.navigation.footer && homepageCrawlResults.navigation.footer.length > 0 && (
                    <div>
                      <h5 style={{ color: '#2196F3', marginBottom: '6px', fontSize: '12px' }}>Footer Links (first 10):</h5>
                      <div style={{
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #444',
                        borderRadius: '4px',
                        padding: '10px',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        fontSize: '12px'
                      }}>
                        {homepageCrawlResults.navigation.footer.slice(0, 10).map((link: any, index: number) => (
                          <div key={index} style={{ marginBottom: '8px', padding: '4px', backgroundColor: '#2a2a2a', borderRadius: '2px' }}>
                            <div style={{ color: '#2196F3', fontWeight: 'bold' }}>{link.text || '(no text)'}</div>
                            <div style={{ color: '#fff', marginTop: '2px', wordBreak: 'break-all', fontSize: '11px' }}>{link.normalizedUrl || link.href}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* All Internal Links Count */}
              {homepageCrawlResults.allInternalLinks && (
                <div style={{ marginBottom: '15px' }}>
                  <div style={{ backgroundColor: '#2a2a2a', padding: '10px', borderRadius: '4px', textAlign: 'center' }}>
                    <div style={{ color: '#FF9800', fontSize: '16px', fontWeight: 'bold' }}>{homepageCrawlResults.allInternalLinks.length}</div>
                    <div style={{ color: '#888', fontSize: '12px' }}>Total Internal Links</div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(homepageCrawlResults, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `homepage-crawl-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#00BCD4',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Download JSON
                </button>
                <button
                  onClick={() => setHomepageCrawlResults(null)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#666',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Clear Results
                </button>
              </div>
            </div>
          )}

          {/* Crawler Results Section */}
          {crawlerResults && (
            <div>
              <h3 style={{ color: '#9C27B0', marginBottom: '10px' }}>Crawler Results</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                <div style={{ backgroundColor: '#2a2a2a', padding: '10px', borderRadius: '4px', textAlign: 'center' }}>
                  <div style={{ color: '#4CAF50', fontSize: '18px', fontWeight: 'bold' }}>{crawlerResults.stats?.totalLinks || 0}</div>
                  <div style={{ color: '#888', fontSize: '12px' }}>Total Links</div>
                </div>
                <div style={{ backgroundColor: '#2a2a2a', padding: '10px', borderRadius: '4px', textAlign: 'center' }}>
                  <div style={{ color: '#2196F3', fontSize: '18px', fontWeight: 'bold' }}>{crawlerResults.stats?.internalLinks || 0}</div>
                  <div style={{ color: '#888', fontSize: '12px' }}>Internal</div>
                </div>
                <div style={{ backgroundColor: '#2a2a2a', padding: '10px', borderRadius: '4px', textAlign: 'center' }}>
                  <div style={{ color: '#FF9800', fontSize: '18px', fontWeight: 'bold' }}>{crawlerResults.stats?.externalLinks || 0}</div>
                  <div style={{ color: '#888', fontSize: '12px' }}>External</div>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                <div style={{ backgroundColor: '#2a2a2a', padding: '10px', borderRadius: '4px', textAlign: 'center' }}>
                  <div style={{ color: '#E91E63', fontSize: '16px', fontWeight: 'bold' }}>{crawlerResults.stats?.forms || 0}</div>
                  <div style={{ color: '#888', fontSize: '12px' }}>Forms</div>
                </div>
                <div style={{ backgroundColor: '#2a2a2a', padding: '10px', borderRadius: '4px', textAlign: 'center' }}>
                  <div style={{ color: '#9C27B0', fontSize: '16px', fontWeight: 'bold' }}>{crawlerResults.stats?.images || 0}</div>
                  <div style={{ color: '#888', fontSize: '12px' }}>Images</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                <button
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(crawlerResults, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `crawler-results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Download JSON
                </button>
                <button
                  onClick={() => setCrawlerResults(null)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#666',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Clear Results
                </button>
              </div>

              {/* Links Preview */}
              <div style={{ marginBottom: '15px' }}>
                <h4 style={{ color: '#fff', marginBottom: '8px', fontSize: '14px' }}>Sample Links (first 10):</h4>
                <div style={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  padding: '10px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  fontSize: '12px'
                }}>
                  {crawlerResults.links?.all?.slice(0, 10).map((link: any, index: number) => (
                    <div key={index} style={{ marginBottom: '8px', padding: '4px', backgroundColor: '#2a2a2a', borderRadius: '2px' }}>
                      <div style={{ color: '#4CAF50', fontWeight: 'bold' }}>{link.href}</div>
                      {link.text && <div style={{ color: '#fff', marginTop: '2px' }}>"{link.text}"</div>}
                      {link.title && <div style={{ color: '#888', fontSize: '10px' }}>Title: {link.title}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* YouTube Video Upload Test Section */}
          <div>
            <h3 style={{ color: '#FF0000', marginBottom: '10px' }}>YouTube Video Upload Test</h3>
            
            {/* Authentication Method Toggle */}
            <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#2a2a2a', borderRadius: '4px', border: '1px solid #444' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fff', cursor: 'pointer', marginBottom: '10px' }}>
                <input
                  type="checkbox"
                  checked={youtubeUseChromeProfile}
                  onChange={(e) => setYoutubeUseChromeProfile(e.target.checked)}
                  style={{ transform: 'scale(1.2)' }}
                />
                <span style={{ fontWeight: 'bold' }}>Use Chrome Profile (Recommended - avoids CAPTCHA/2FA)</span>
              </label>
              <p style={{ color: '#888', fontSize: '12px', margin: '5px 0 0 0', paddingLeft: '28px' }}>
                {youtubeUseChromeProfile 
                  ? 'Use an existing Chrome profile that is already logged into Google/YouTube. More reliable and avoids authentication issues.'
                  : 'Use username/password for automated login (may encounter CAPTCHA or 2FA).'}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '10px' }}>
              {youtubeUseChromeProfile ? (
                <>
                  {/* Chrome Profile Paths */}
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Chrome User Data Directory (e.g., C:\\Users\\User\\AppData\\Local\\Google\\Chrome\\User Data)"
                      value={youtubeChromeUserDataDir}
                      onChange={(e) => setYoutubeChromeUserDataDir(e.target.value)}
                      style={{ 
                        padding: '8px', 
                        borderRadius: '4px', 
                        border: '1px solid #444', 
                        backgroundColor: '#2a2a2a', 
                        color: '#fff',
                        flex: 1
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Chrome Executable Path (e.g., C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe)"
                      value={youtubeChromeExecutablePath}
                      onChange={(e) => setYoutubeChromeExecutablePath(e.target.value)}
                      style={{ 
                        padding: '8px', 
                        borderRadius: '4px', 
                        border: '1px solid #444', 
                        backgroundColor: '#2a2a2a', 
                        color: '#fff',
                        flex: 1
                      }}
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* Username/Password */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <input
                      type="text"
                      placeholder="YouTube Username/Email"
                      value={youtubeUsername}
                      onChange={(e) => setYoutubeUsername(e.target.value)}
                      style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }}
                    />
                    <input
                      type="password"
                      placeholder="YouTube Password"
                      value={youtubePassword}
                      onChange={(e) => setYoutubePassword(e.target.value)}
                      style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }}
                    />
                  </div>
                </>
              )}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Video File Path (click Browse to select)"
                  value={youtubeVideoPath}
                  onChange={(e) => setYoutubeVideoPath(e.target.value)}
                  readOnly
                  style={{ 
                    padding: '8px', 
                    borderRadius: '4px', 
                    border: '1px solid #444', 
                    backgroundColor: '#2a2a2a', 
                    color: '#fff',
                    flex: 1,
                    cursor: 'not-allowed'
                  }}
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const result = await (window as any).electron.debug.pickVideoFile();
                      if (result?.success && result?.filePath) {
                        setYoutubeVideoPath(result.filePath);
                        addDebugLog(`📁 Selected video file: ${result.filePath}`);
                      }
                    } catch (error) {
                      console.error('Failed to pick video file:', error);
                      alert(`Failed to pick video file: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: '500',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Browse
                </button>
              </div>
              <input
                type="text"
                placeholder="Video Title"
                value={youtubeTitle}
                onChange={(e) => setYoutubeTitle(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }}
              />
              <textarea
                placeholder="Video Description (optional)"
                value={youtubeDescription}
                onChange={(e) => setYoutubeDescription(e.target.value)}
                rows={3}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff', resize: 'vertical' }}
              />
              <input
                type="text"
                placeholder="Tags (comma-separated, optional)"
                value={youtubeTags}
                onChange={(e) => setYoutubeTags(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }}
              />
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <label style={{ color: '#fff', fontSize: '12px' }}>Visibility:</label>
                <select
                  value={youtubeVisibility}
                  onChange={(e) => setYoutubeVisibility(e.target.value as 'public' | 'unlisted' | 'private')}
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff', flex: 1 }}
                >
                  <option value="public">Public</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="private">Private</option>
                </select>
              </div>
            </div>
            <button
              onClick={async () => {
                // Validation based on authentication method
                if (youtubeUseChromeProfile) {
                  if (!youtubeChromeUserDataDir.trim() || !youtubeChromeExecutablePath.trim()) {
                    alert('Please enter Chrome user data directory and executable path');
                    return;
                  }
                } else {
                  if (!youtubeUsername.trim() || !youtubePassword.trim()) {
                    alert('Please enter YouTube username and password');
                    return;
                  }
                }
                
                if (!youtubeVideoPath.trim()) {
                  alert('Please enter video file path');
                  return;
                }
                if (!youtubeTitle.trim()) {
                  alert('Please enter video title');
                  return;
                }

                addDebugLog('Starting YouTube video upload test...');
                
                try {
                  addDebugLog('🎬 Launching YouTube video upload automation...');
                  
                  const tagsArray = youtubeTags.trim() 
                    ? youtubeTags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
                    : undefined;

                  const uploadOptions: any = {
                    videoPath: youtubeVideoPath.trim(),
                    title: youtubeTitle.trim(),
                    description: youtubeDescription.trim() || undefined,
                    tags: tagsArray,
                    visibility: youtubeVisibility,
                  };

                  // Add authentication method
                  if (youtubeUseChromeProfile) {
                    addDebugLog('🔐 Using Chrome profile authentication (recommended)...');
                    uploadOptions.chromeUserDataDir = youtubeChromeUserDataDir.trim();
                    uploadOptions.chromeExecutablePath = youtubeChromeExecutablePath.trim();
                  } else {
                    addDebugLog('🔐 Using username/password authentication...');
                    uploadOptions.username = youtubeUsername.trim();
                    uploadOptions.password = youtubePassword.trim();
                  }

                  const result = await (window as any).electron.debug.testYouTubeUpload(uploadOptions);
                  
                  if (!result?.success) {
                    addDebugLog(`❌ YouTube upload failed: ${result?.error || 'Unknown error'}`);
                    console.error('YouTube upload failed:', result?.error);
                    alert(`YouTube upload failed${result?.error ? `: ${result.error}` : ''}`);
                  } else {
                    addDebugLog('✅ YouTube upload automation launched successfully');
                    console.log('YouTube upload result:', result);
                    alert('YouTube upload automation launched. Check the Playwright window to review the upload process.');
                  }
                } catch (e: any) {
                  addDebugLog(`❌ YouTube upload error: ${e?.message || e}`);
                  console.error('YouTube upload error:', e);
                  alert(`YouTube upload error: ${e?.message || e}`);
                }
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: '#FF0000',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Test YouTube Video Upload
            </button>
          </div>

          {/* Facebook Post Test Section */}
          <div>
            <h3 style={{ color: '#1877F2', marginBottom: '10px' }}>Facebook Post Test</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="Facebook Email/Phone/Username"
                  value={facebookUsername}
                  onChange={(e) => setFacebookUsername(e.target.value)}
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }}
                />
                <input
                  type="password"
                  placeholder="Facebook Password"
                  value={facebookPassword}
                  onChange={(e) => setFacebookPassword(e.target.value)}
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Image File Path (optional, click Browse to select)"
                  value={facebookImagePath}
                  onChange={(e) => setFacebookImagePath(e.target.value)}
                  readOnly
                  style={{ 
                    padding: '8px', 
                    borderRadius: '4px', 
                    border: '1px solid #444', 
                    backgroundColor: '#2a2a2a', 
                    color: '#fff',
                    flex: 1,
                    cursor: 'not-allowed'
                  }}
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const result = await (window as any).electron.debug.pickImageFile();
                      if (result?.success && result?.filePath) {
                        setFacebookImagePath(result.filePath);
                        addDebugLog(`📁 Selected image file: ${result.filePath}`);
                      }
                    } catch (error) {
                      console.error('Failed to pick image file:', error);
                      alert(`Failed to pick image file: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: '500',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Browse
                </button>
              </div>
              <textarea
                placeholder="Post Text (optional)"
                value={facebookText}
                onChange={(e) => setFacebookText(e.target.value)}
                rows={4}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff', resize: 'vertical' }}
              />
            </div>
            <button
              onClick={async () => {
                if (!facebookUsername.trim() || !facebookPassword.trim()) {
                  alert('Please enter Facebook username and password');
                  return;
                }
                if (!facebookText.trim() && !facebookImagePath.trim()) {
                  alert('Please enter post text or select an image');
                  return;
                }

                addDebugLog('Starting Facebook post test...');
                
                try {
                  addDebugLog('📘 Launching Facebook post automation...');
                  
                  const result = await (window as any).electron.debug.testFacebookPost({
                    username: facebookUsername.trim(),
                    password: facebookPassword.trim(),
                    imagePath: facebookImagePath.trim() || undefined,
                    text: facebookText.trim() || undefined,
                  });
                  
                  if (!result?.success) {
                    addDebugLog(`❌ Facebook post failed: ${result?.error || 'Unknown error'}`);
                    console.error('Facebook post failed:', result?.error);
                    alert(`Facebook post failed${result?.error ? `: ${result.error}` : ''}`);
                  } else {
                    addDebugLog('✅ Facebook post automation launched successfully');
                    console.log('Facebook post result:', result);
                    alert('Facebook post automation launched. Check the Playwright window to review the post process.');
                  }
                } catch (e: any) {
                  addDebugLog(`❌ Facebook post error: ${e?.message || e}`);
                  console.error('Facebook post error:', e);
                  alert(`Facebook post error: ${e?.message || e}`);
                }
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: '#1877F2',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Test Facebook Post
            </button>
          </div>

          {/* Playwright Downloads Section */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ color: '#9C27B0', margin: 0 }}>📥 Playwright Downloads</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={async () => {
                    try {
                      await (window as any).electron.debug.openPlaywrightDownloadsFolder();
                    } catch (error) {
                      console.error('Failed to open folder:', error);
                      alert('Failed to open folder');
                    }
                  }}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#666',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Open Folder
                </button>
                <button
                  onClick={loadPlaywrightDownloads}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#9C27B0',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Refresh
                </button>
              </div>
            </div>
            {playwrightDownloads.length === 0 ? (
              <p style={{ color: '#888', fontSize: '14px', margin: '8px 0' }}>No downloaded files yet.</p>
            ) : (
              <div style={{
                backgroundColor: '#1a1a1a',
                border: '1px solid #444',
                borderRadius: '4px',
                padding: '10px',
                maxHeight: '300px',
                overflowY: 'auto'
              }}>
                {playwrightDownloads.map((file, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '12px',
                      background: '#2a2a2a',
                      borderRadius: '6px',
                      marginBottom: '8px',
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                      border: '1px solid #444'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#333'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#2a2a2a'}
                    onClick={() => handleOpenDownload(file.path)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '500', fontSize: '14px', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#fff' }}>
                          📄 {file.name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#888' }}>
                          {formatFileSize(file.size)} • {new Date(file.modified).toLocaleString()}
                        </div>
                      </div>
                      <div style={{ marginLeft: '12px', fontSize: '12px', color: '#9C27B0', whiteSpace: 'nowrap' }}>
                        Open →
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Debug Console Section */}
          {debugLogs.length > 0 && (
            <div>
              <h3 style={{ color: '#FF9800', marginBottom: '10px' }}>Debug Console</h3>
              <div style={{
                backgroundColor: '#1a1a1a',
                border: '1px solid #444',
                borderRadius: '4px',
                padding: '10px',
                maxHeight: '200px',
                overflowY: 'auto',
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#fff'
              }}>
                {debugLogs.map((log, index) => (
                  <div key={index} style={{ marginBottom: '4px' }}>
                    {log}
                  </div>
                ))}
              </div>
              <button
                onClick={() => setDebugLogs([])}
                style={{
                  marginTop: '8px',
                  padding: '4px 8px',
                  backgroundColor: '#666',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Clear Logs
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function NavDropdown({ 
  title, 
  icon, 
  children, 
  isActive,
  isNarrow
}: { 
  title: string; 
  icon: any; 
  children: React.ReactNode; 
  isActive: boolean;
  isNarrow: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="nav-dropdown" ref={dropdownRef}>
      <button 
        className={`nav-link nav-dropdown-trigger ${isActive ? 'active' : ''}`} 
        onClick={() => setIsOpen(!isOpen)}
        title={title}
      >
        <FontAwesomeIcon icon={icon} />
        {!isNarrow && (
          <>
            <span>{title}</span>
            <FontAwesomeIcon icon={isOpen ? faChevronUp : faChevronDown} style={{ fontSize: '10px', marginLeft: '4px' }} />
          </>
        )}
      </button>
      {isOpen && (
        <div className="nav-dropdown-menu">
          {children}
        </div>
      )}
    </div>
  );
}

function NavigationBar({ 
  showDebugModal, 
  setShowDebugModal,
  showSupportModal,
  setShowSupportModal
}: { 
  showDebugModal: boolean; 
  setShowDebugModal: (show: boolean) => void;
  showSupportModal: boolean;
  setShowSupportModal: (show: boolean) => void;
}) {
  const location = useLocation();
  const [isNarrow, setIsNarrow] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const checkWidth = () => {
      setIsNarrow(window.innerWidth < 800); // Increased threshold since we have more items but grouping helps
    };
    
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  const isDevelopmentActive = [
    '/homepage-editor',
    '/egchatting'
  ].some(path => location.pathname.startsWith(path));

  const isMarketingActive = [
    '/egbusiness-identity', 
    '/blog-connector', 
    '/social-media', 
    '/seo-analyzer',
    '/ssl-analyzer',
    '/company-research'
  ].some(path => location.pathname.startsWith(path));

  const isSystemActive = [
    '/mcp-server',
    '/docker',
    '/egdesktop',
    '/ai-keys'
  ].some(path => location.pathname.startsWith(path));

  const isOperationsActive = [
    '/finance-hub'
  ].some(path => location.pathname.startsWith(path));

  // Check environment
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <div className={`navigation-bar ${isNarrow ? 'narrow' : ''}`}>
      <div className="nav-links-wrapper">
        <nav className="nav-links">
          {/* Main Items */}
          <Link
            to="/"
            className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
            title="Home"
          >
            <FontAwesomeIcon icon={faHome} />
            {!isNarrow && <span>Home</span>}
          </Link>

          {/* Development Group */}
          <NavDropdown 
            title="Development" 
            icon={faLaptopCode} 
            isActive={isDevelopmentActive}
            isNarrow={isNarrow}
          >
            <Link
              to="/homepage-editor"
              className={`nav-dropdown-item ${location.pathname === '/homepage-editor' ? 'active' : ''}`}
            >
              <FontAwesomeIcon icon={faCog} fixedWidth />
              <span>Coding</span>
            </Link>
            <Link
              to="/egchatting"
              className={`nav-dropdown-item ${location.pathname === '/egchatting' ? 'active' : ''}`}
            >
              <FontAwesomeIcon icon={faComments} fixedWidth />
              <span>Chatting</span>
            </Link>
          </NavDropdown>

          {/* Marketing Group */}
          <NavDropdown 
            title="Marketing" 
            icon={faChartBar} 
            isActive={isMarketingActive}
            isNarrow={isNarrow}
          >
            <Link to="/egbusiness-identity" className={`nav-dropdown-item ${location.pathname.startsWith('/egbusiness-identity') ? 'active' : ''}`}>
              <FontAwesomeIcon icon={faFingerprint} fixedWidth />
              <span>Business ID</span>
            </Link>
            <Link to="/blog-connector" className={`nav-dropdown-item ${location.pathname.startsWith('/blog-connector') ? 'active' : ''}`}>
              <FontAwesomeIcon icon={faGlobe} fixedWidth />
              <span>Blogging</span>
            </Link>
            <Link to="/social-media" className={`nav-dropdown-item ${location.pathname.startsWith('/social-media') ? 'active' : ''}`}>
              <FontAwesomeIcon icon={faShare} fixedWidth />
              <span>SNS Manager</span>
            </Link>
            <Link to="/seo-analyzer" className={`nav-dropdown-item ${location.pathname.startsWith('/seo-analyzer') ? 'active' : ''}`}>
              <FontAwesomeIcon icon={faGlobe} fixedWidth />
              <span>SEO-Analyzer</span>
            </Link>
            <Link to="/ssl-analyzer" className={`nav-dropdown-item ${location.pathname.startsWith('/ssl-analyzer') ? 'active' : ''}`}>
              <FontAwesomeIcon icon={faShieldAlt} fixedWidth />
              <span>SSL-Checker</span>
            </Link>
            <Link to="/company-research" className={`nav-dropdown-item ${location.pathname.startsWith('/company-research') ? 'active' : ''}`}>
              <FontAwesomeIcon icon={faChartBar} fixedWidth />
              <span>Company Research</span>
            </Link>
          </NavDropdown>

          {/* System Group */}
          <NavDropdown 
            title="System" 
            icon={faWrench} 
            isActive={isSystemActive}
            isNarrow={isNarrow}
          >
            <Link to="/mcp-server" className={`nav-dropdown-item ${location.pathname.startsWith('/mcp-server') ? 'active' : ''}`}>
              <FontAwesomeIcon icon={faServer} fixedWidth />
              <span>MCP Server</span>
            </Link>
            <Link to="/docker" className={`nav-dropdown-item ${location.pathname.startsWith('/docker') ? 'active' : ''}`}>
              <FontAwesomeIcon icon={faDocker} fixedWidth />
              <span>Docker</span>
            </Link>
            <Link to="/egdesktop" className={`nav-dropdown-item ${location.pathname.startsWith('/egdesktop') ? 'active' : ''}`}>
              <FontAwesomeIcon icon={faDesktop} fixedWidth />
              <span>Desktop</span>
            </Link>
            <Link to="/ai-keys" className={`nav-dropdown-item ${location.pathname.startsWith('/ai-keys') ? 'active' : ''}`}>
              <FontAwesomeIcon icon={faRobot} fixedWidth />
              <span>API Keys</span>
            </Link>
          </NavDropdown>

          {/* Operations Group */}
          <NavDropdown 
            title="Operations" 
            icon={faChartBar} 
            isActive={isOperationsActive}
            isNarrow={isNarrow}
          >
            <Link to="/finance-hub" className={`nav-dropdown-item ${location.pathname.startsWith('/finance-hub') ? 'active' : ''}`}>
              <FontAwesomeIcon icon={faChartBar} fixedWidth />
              <span>Finance Hub</span>
            </Link>
          </NavDropdown>

          {/* Help & Tools - Kept as icons/buttons */}
          <button
            className="nav-link"
            onClick={() => setShowDebugModal(true)}
            style={{ cursor: 'pointer' }}
            title="Open Debug Panel"
          >
            <FontAwesomeIcon icon={faRobot} />
            {!isNarrow && <span>Debug</span>}
          </button>
          <button
            className="nav-link"
            onClick={() => setShowSupportModal(true)}
            style={{ cursor: 'pointer' }}
            title="Support & Help"
          >
            <FontAwesomeIcon icon={faQuestion} />
            {!isNarrow && <span>Support</span>}
          </button>

        </nav>
      </div>
      <div className="nav-auth">
        <AuthButton />
      </div>
    </div>
  );
}

function RouteWindowBoundsManager() {
  const location = useLocation();
  const originalBoundsRef = useRef<any | null>(null);
  const wasInHomepageEditorRef = useRef<boolean>(false);
  const warnedMainWindowBridgeRef = useRef(false);
  const warnedBrowserWindowBridgeRef = useRef(false);

  useEffect(() => {
    let isUnmounted = false;

    (async () => {
      const electronBridge = (window as any)?.electron;
      const mainWindowBridge = electronBridge?.mainWindow;

      if (!mainWindowBridge?.getBounds || !mainWindowBridge?.setBounds) {
        if (!warnedMainWindowBridgeRef.current) {
          console.warn(
            '[RouteWindowBoundsManager] mainWindow bridge unavailable; window resizing will be skipped.',
          );
          warnedMainWindowBridgeRef.current = true;
        }
        return;
      }

      const isInHomepageEditor = location.pathname.startsWith('/homepage-editor');
      if (isInHomepageEditor && !wasInHomepageEditorRef.current) {
        try {
          const result = await mainWindowBridge.getBounds();
          if (!isUnmounted && result?.success && result.bounds) {
            originalBoundsRef.current = result.bounds;
          }
        } catch (e) {
          console.warn('Failed to capture main window bounds on enter:', e);
        }
        if (!isUnmounted) {
          wasInHomepageEditorRef.current = true;
        }
      }

      if (!isInHomepageEditor && wasInHomepageEditorRef.current) {
        try {
          const browserWindowBridge = electronBridge?.browserWindow;
          if (browserWindowBridge?.getAllLocalhostWindows && browserWindowBridge?.closeWindow) {
            try {
              const list = await browserWindowBridge.getAllLocalhostWindows();
              if (list?.success && Array.isArray(list.windows)) {
                for (const win of list.windows) {
                  try {
                    await browserWindowBridge.closeWindow(win.windowId);
                  } catch (e) {
                    console.warn('Failed to close localhost window:', e);
                  }
                }
              }
            } catch (e) {
              console.warn('Failed to enumerate localhost windows:', e);
            }
          } else if (!warnedBrowserWindowBridgeRef.current) {
            console.warn(
              '[RouteWindowBoundsManager] browserWindow bridge unavailable; preview windows may stay open.',
            );
            warnedBrowserWindowBridgeRef.current = true;
          }

          const bounds = originalBoundsRef.current;
          if (bounds) {
            await mainWindowBridge.setBounds(bounds);
          }
        } catch (e) {
          console.warn('Failed to restore main window bounds on leave:', e);
        }
        if (!isUnmounted) {
          wasInHomepageEditorRef.current = false;
          originalBoundsRef.current = null;
        }
      }
    })();

    return () => {
      isUnmounted = true;
    };
  }, [location.pathname]);

  return null;
}

function AppContent() {
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const { user, loading } = useAuth();
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'installed' | 'not_installed' | 'error'>('checking');
  const [ollamaMessage, setOllamaMessage] = useState<string | null>(null);
  const [isEnsuringOllama, setIsEnsuringOllama] = useState(false);
  const [gemmaStatus, setGemmaStatus] = useState<'idle' | 'checking' | 'pulling' | 'ready' | 'error'>('idle');
  const [gemmaMessage, setGemmaMessage] = useState<string | null>(null);

  const checkOllamaStatus = useCallback(async () => {
    if (!(window as any)?.electron?.ollama?.checkInstalled) {
      setOllamaStatus('error');
      setOllamaMessage('Ollama management bridge unavailable.');
      return;
    }

    setOllamaStatus((status) => (status === 'installed' ? status : 'checking'));

    try {
      const result = await (window as any).electron.ollama.checkInstalled();

      if (result.success && result.installed) {
        setOllamaStatus('installed');
        setOllamaMessage(null);
      } else {
        setOllamaStatus('not_installed');
        setOllamaMessage(result.error || result.message || null);
      }
    } catch (error: any) {
      setOllamaStatus('error');
      setOllamaMessage(error?.message || 'Failed to check Ollama status.');
    }
  }, []);

  useEffect(() => {
    checkOllamaStatus();
  }, [checkOllamaStatus]);

  const ensureGemmaModel = useCallback(async () => {
    const electron = (window as any)?.electron;
    if (!electron?.ollama?.ensure || !electron?.ollama?.hasModel || !electron?.ollama?.pullModel) {
      setGemmaStatus('error');
      setGemmaMessage('Gemma model management bridge unavailable.');
      return;
    }

    setGemmaStatus((status) => (status === 'pulling' ? status : 'checking'));
    setGemmaMessage(null);

    try {
      const ensureResult = await electron.ollama.ensure();
      if (!ensureResult?.success || !ensureResult?.installed) {
        setGemmaStatus('error');
        setGemmaMessage(ensureResult?.error || ensureResult?.message || 'Ollama is not ready.');
        return;
      }

      const hasModelResult = await electron.ollama.hasModel(GEMMA_MODEL_ID);
      if (hasModelResult?.success && hasModelResult?.exists) {
        setGemmaStatus('ready');
        setGemmaMessage(null);
        return;
      }

      setGemmaStatus('pulling');
      const pullResult = await electron.ollama.pullModel(GEMMA_MODEL_ID);
      if (!pullResult?.success) {
        setGemmaStatus('error');
        setGemmaMessage(pullResult?.error || pullResult?.message || 'Failed to download Gemma 4GB model.');
        return;
      }

      const verifyResult = await electron.ollama.hasModel(GEMMA_MODEL_ID);
      if (verifyResult?.success && verifyResult?.exists) {
        setGemmaStatus('ready');
        setGemmaMessage(null);
      } else {
        setGemmaStatus('error');
        setGemmaMessage('Gemma 4GB download finished but verification failed.');
      }
    } catch (error: any) {
      setGemmaStatus('error');
      setGemmaMessage(error?.message || 'Failed to prepare Gemma 4GB model.');
    }
  }, []);

  useEffect(() => {
    if (ollamaStatus === 'installed') {
      ensureGemmaModel();
    } else {
      setGemmaStatus('idle');
      setGemmaMessage(null);
    }
  }, [ollamaStatus, ensureGemmaModel]);

  const handleEnsureGemma = useCallback(async () => {
    await ensureGemmaModel();
  }, [ensureGemmaModel]);

  const handleEnsureOllama = useCallback(async () => {
    if (!(window as any)?.electron?.ollama?.ensure) {
      setOllamaStatus('error');
      setOllamaMessage('Ollama management bridge unavailable.');
      return;
    }

    setIsEnsuringOllama(true);
    setOllamaStatus('checking');
    setOllamaMessage(null);

    try {
      const result = await (window as any).electron.ollama.ensure();

      if (!result.success || !result.installed) {
        setOllamaMessage(result.error || result.message || 'Ollama is not ready yet.');
      } else {
        await ensureGemmaModel();
      }
    } catch (error: any) {
      setOllamaStatus('error');
      setOllamaMessage(error?.message || 'Failed to install or start Ollama.');
    } finally {
      setIsEnsuringOllama(false);
      await checkOllamaStatus();
    }
  }, [checkOllamaStatus, ensureGemmaModel]);

  // Show loading screen while checking authentication
  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  // Show sign-in page if not authenticated
  if (!user) {
    return <SignInPage />;
  }

  return (
    <>
      <RouteWindowBoundsManager />
      <div className="app-container">
        <NavigationBar 
          showDebugModal={showDebugModal} 
          setShowDebugModal={setShowDebugModal}
          showSupportModal={showSupportModal}
          setShowSupportModal={setShowSupportModal}
        />
        {(ollamaStatus === 'not_installed' || ollamaStatus === 'error') && (
          <div className={`ollama-banner ${ollamaStatus}`}>
            <div className="ollama-banner__text">
              {ollamaStatus === 'error'
                ? 'Unable to communicate with the local Ollama manager.'
                : 'Ollama is not installed or not running. Install it to enable local AI features.'}
              {ollamaMessage ? ` ${ollamaMessage}` : ''}
            </div>
            <div className="ollama-banner__actions">
              <button
                type="button"
                onClick={handleEnsureOllama}
                disabled={isEnsuringOllama}
              >
                {isEnsuringOllama ? 'Preparing Ollama...' : 'Install / Start Ollama'}
              </button>
              <button
                type="button"
                onClick={() => checkOllamaStatus()}
                disabled={isEnsuringOllama}
                className="ollama-banner__refresh"
              >
                Recheck
              </button>
            </div>
          </div>
        )}
        {ollamaStatus === 'installed' && gemmaStatus !== 'ready' && (
          <div className={`ollama-banner gemma ${gemmaStatus === 'error' ? 'error' : gemmaStatus}`}>
            <div className="ollama-banner__text">
              {gemmaStatus === 'pulling'
                ? 'Downloading Gemma 4GB model... This may take a few minutes depending on your network speed.'
                : gemmaStatus === 'error'
                  ? `Unable to prepare Gemma 4GB model.${gemmaMessage ? ` ${gemmaMessage}` : ''}`
                  : 'Gemma 4GB model is not available locally. Download it to enable local AI conversations.'}
              {gemmaStatus !== 'error' && gemmaMessage ? ` ${gemmaMessage}` : ''}
            </div>
            <div className="ollama-banner__actions">
              <button
                type="button"
                onClick={handleEnsureGemma}
                disabled={gemmaStatus === 'pulling' || gemmaStatus === 'checking'}
              >
                {gemmaStatus === 'pulling' ? 'Downloading Gemma 4GB…' : 'Install Gemma 4GB'}
              </button>
              <button
                type="button"
                onClick={handleEnsureGemma}
                disabled={gemmaStatus === 'pulling'}
                className="ollama-banner__refresh"
              >
                {gemmaStatus === 'pulling' ? 'In Progress' : 'Retry'}
              </button>
            </div>
          </div>
        )}
        <SupportModal isOpen={showSupportModal} onClose={() => setShowSupportModal(false)} />
        <DebugModal isOpen={showDebugModal} onClose={() => setShowDebugModal(false)} />
        <UpdateDialog />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/index.html" element={<LandingPage />} />
            <Route path="/profile" element={<UserProfile />} />
            <Route path="/viewer" element={<URLFileViewerPage />} />
            <Route path="/egdesktop" element={<EGDesktopControl />} />
            <Route 
              path="/blog-connector" 
              element={
                <ErrorBoundary>
                  <EGBlogging />
                </ErrorBoundary>
              } 
            />
            <Route 
              path="/social-media" 
              element={
                <ErrorBoundary>
                  <EGSocialMedia />
                </ErrorBoundary>
              } 
            />
            <Route path="/ai-keys" element={<AIKeysManager />} />
            <Route path="/homepage-editor" element={<HomepageEditor />} />
            <Route path="/ssl-analyzer" element={<SSLAnalyzer />} />
            <Route path="/company-research" element={<CompanyResearchPage />} />
            <Route path="/seo-analyzer" element={<EGSEOAnalyzer />} />
            <Route path="/mcp-server" element={<MCPServer />} />
            <Route path="/egchatting" element={<EGChatting />} />
            <Route path="/egbusiness-identity" element={<EGBusinessIdentity />} />
            <Route path="/egbusiness-identity/preview" element={<BusinessIdentityTab />} />
            <Route path="/finance-hub" element={<FinanceHub />} />
            <Route path="/docker" element={<DockerManager />} />
            
            {/* Fallback to home for unknown routes */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}
