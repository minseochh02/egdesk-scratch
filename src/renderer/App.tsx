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
} from './utils/fontAwesomeIcons';
import LandingPage from './components/LandingPage';
import { AIKeysManager } from './components/AIKeysManager';
import { HomepageEditor } from './components/HomepageEditor';
import SSLAnalyzer from './components/SSLAnalyzer/SSLAnalyzer';
import URLFileViewerPage from './components/HomepageEditor/URLFileViewerPage';
import ErrorBoundary from './components/ErrorBoundary';
import { EGBlogging } from './components/EGBlog';
import MCPServer from './components/MCPServer/MCPServer';
import './App.css';

function DebugModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [wooriId, setWooriId] = useState('');
  const [wooriPassword, setWooriPassword] = useState('');
  const [wooriProxy, setWooriProxy] = useState('');
  const [wooriGeminiKey, setWooriGeminiKey] = useState('');

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

        </div>
      </div>
    </div>
  );
}

function NavigationBar({ showDebugModal, setShowDebugModal }: { showDebugModal: boolean; setShowDebugModal: (show: boolean) => void }) {
  const location = useLocation();
  const [isNarrow, setIsNarrow] = useState(false);

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
          to="/ai-keys"
          className={`nav-link ${location.pathname === '/ai-keys' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faRobot} />
          {!isNarrow && <span>API 키 관리</span>}
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

export default function App() {
  const [showDebugModal, setShowDebugModal] = useState(false);

  return (
    <Router>
      <RouteWindowBoundsManager />
      <div className="app-container">
        <NavigationBar showDebugModal={showDebugModal} setShowDebugModal={setShowDebugModal} />
        <DebugModal isOpen={showDebugModal} onClose={() => setShowDebugModal(false)} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/index.html" element={<LandingPage />} />
            <Route path="/viewer" element={<URLFileViewerPage />} />
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
            <Route path="/mcp-server" element={<MCPServer />} />
            
            {/* Fallback to home for unknown routes */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
