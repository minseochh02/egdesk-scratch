import React, { useState, useEffect, useRef } from 'react';
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
} from './utils/fontAwesomeIcons';
import LandingPage from './components/LandingPage';
import { AIKeysManager } from './components/AIKeysManager';
import { HomepageEditor } from './components/HomepageEditor';
import SSLAnalyzer from './components/SSLAnalyzer/SSLAnalyzer';
import URLFileViewerPage from './components/HomepageEditor/URLFileViewerPage';
import ErrorBoundary from './components/ErrorBoundary';
import { EGBlogging } from './components/EGBlog';
import MCPServer from './components/MCPServer/MCPServer';
import EGDesktopControl from './components/EGDesktop/EGDesktopControl';
import SignInPage from './components/Auth/SignInPage';
import AuthButton from './components/Auth/AuthButton';
import UserProfile from './components/Auth/UserProfile';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import './App.css';
import EGSEOAnalyzer from './components/EG SEO Analyzer/EGSEOAnalyzer';

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
                const addDebugLog = (message: string) => {
                  setDebugLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
                };
                
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
                const addDebugLog = (message: string) => {
                  setDebugLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
                };
                
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

function NavigationBar({ showDebugModal, setShowDebugModal }: { showDebugModal: boolean; setShowDebugModal: (show: boolean) => void }) {
  const location = useLocation();
  const [isNarrow, setIsNarrow] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const checkWidth = () => {
      setIsNarrow(window.innerWidth < 600);
    };
    
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  return (
    <div className={`navigation-bar ${isNarrow ? 'narrow' : ''}`}>
      <nav className="nav-links">
        <Link
          to="/"
          className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faHome} />
          {!isNarrow && <span>홈</span>}
        </Link>
        <Link
          to="/homepage-editor"
          className={`nav-link ${location.pathname === '/homepage-editor' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faCog} />
          {!isNarrow && <span>EG Coding</span>}
        </Link>
        {/* Legacy BlogManager navigation - replaced by Blog Connector */}
        {/* <Link
          to="/blog-manager"
          className={`nav-link ${location.pathname === '/blog-manager' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faGlobe} />
          {!isNarrow && <span>EG Blogging</span>}
        </Link> */}
        <Link
          to="/blog-connector"
          className={`nav-link ${location.pathname === '/blog-connector' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faGlobe} />
          {!isNarrow && <span>EG Blogging</span>}
        </Link>
        <Link
          to="/ssl-analyzer"
          className={`nav-link ${location.pathname === '/ssl-analyzer' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faShieldAlt} />
          {!isNarrow && <span>EG SSL-Checker</span>}
        </Link>
        <Link
          to="/seo-analyzer"
          className={`nav-link ${location.pathname === '/seo-analyzer' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faGlobe} />
          {!isNarrow && <span>EG SEO-Analyzer</span>}
        </Link>
        <Link
          to="/ai-keys"
          className={`nav-link ${location.pathname === '/ai-keys' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faRobot} />
          {!isNarrow && <span>API 키 관리</span>}
        </Link>
        <Link
          to="/mcp-server"
          className={`nav-link ${location.pathname === '/mcp-server' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faServer} />
          {!isNarrow && <span>EG MCP Server</span>}
        </Link>
        <button
          className="nav-link"
          onClick={() => setShowDebugModal(true)}
          style={{ cursor: 'pointer' }}
          title="Open Debug Panel"
        >
          <FontAwesomeIcon icon={faRobot} />
          {!isNarrow && <span>Debug</span>}
        </button>

      </nav>
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

  useEffect(() => {
    (async () => {
      const isInHomepageEditor = location.pathname.startsWith('/homepage-editor');
      if (isInHomepageEditor && !wasInHomepageEditorRef.current) {
        try {
          const result = await window.electron.mainWindow.getBounds();
          if (result?.success && result.bounds) {
            originalBoundsRef.current = result.bounds;
          }
        } catch (e) {
          console.warn('Failed to capture main window bounds on enter:', e);
        }
        wasInHomepageEditorRef.current = true;
      }

      if (!isInHomepageEditor && wasInHomepageEditorRef.current) {
        try {
          // Close any localhost preview windows opened by AI Chat
          try {
            const list = await (window as any).electron.browserWindow.getAllLocalhostWindows();
            if (list?.success && Array.isArray(list.windows)) {
              for (const win of list.windows) {
                try {
                  await (window as any).electron.browserWindow.closeWindow(win.windowId);
                } catch (e) {
                  console.warn('Failed to close localhost window:', e);
                }
              }
            }
          } catch (e) {
            console.warn('Failed to enumerate localhost windows:', e);
          }

          const bounds = originalBoundsRef.current;
          if (bounds) {
            await window.electron.mainWindow.setBounds(bounds);
          }
        } catch (e) {
          console.warn('Failed to restore main window bounds on leave:', e);
        }
        wasInHomepageEditorRef.current = false;
        originalBoundsRef.current = null;
      }
    })();
  }, [location.pathname]);

  return null;
}

function AppContent() {
  const [showDebugModal, setShowDebugModal] = useState(false);
  const { user, loading } = useAuth();

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
        <NavigationBar showDebugModal={showDebugModal} setShowDebugModal={setShowDebugModal} />
        <DebugModal isOpen={showDebugModal} onClose={() => setShowDebugModal(false)} />
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
            <Route path="/ai-keys" element={<AIKeysManager />} />
            <Route path="/homepage-editor" element={<HomepageEditor />} />
            <Route path="/ssl-analyzer" element={<SSLAnalyzer />} />
            <Route path="/seo-analyzer" element={<EGSEOAnalyzer />} />
            <Route path="/mcp-server" element={<MCPServer />} />
            
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
