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
import './App.css';

function NavigationBar() {
  const location = useLocation();
  const [isNarrow, setIsNarrow] = useState(false);
  const [showDebugForm, setShowDebugForm] = useState(false);
  const [debugId, setDebugId] = useState('');
  const [debugPw, setDebugPw] = useState('');
  const [debugProxy, setDebugProxy] = useState('');
  const [wooriId, setWooriId] = useState('');
  const [wooriPassword, setWooriPassword] = useState('');
  const [wooriProxy, setWooriProxy] = useState('');
  const [wooriGeminiKey, setWooriGeminiKey] = useState('');

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
          onClick={async () => {
            setShowDebugForm((v) => !v);
          }}
          style={{ cursor: 'pointer' }}
          title="Run Playwright automation"
        >
          <FontAwesomeIcon icon={faRobot} />
          {!isNarrow && <span>Debug</span>}
        </button>

      </nav>
      {showDebugForm && (
        <div style={{ padding: '8px', background: '#1e1e1e', borderTop: '1px solid #333', display: 'flex', gap: '8px', alignItems: 'center' }}>
          {!isNarrow && <span style={{ color: '#ddd' }}>Naver Login:</span>}
          <input
            type="text"
            placeholder="ID"
            value={debugId}
            onChange={(e) => setDebugId(e.target.value)}
            style={{ padding: '4px 8px' }}
          />
          <input
            type="password"
            placeholder="PW"
            value={debugPw}
            onChange={(e) => setDebugPw(e.target.value)}
            style={{ padding: '4px 8px' }}
          />
          <input
            type="text"
            placeholder="Proxy (e.g. http://user:pass@host:port)"
            value={debugProxy}
            onChange={(e) => setDebugProxy(e.target.value)}
            style={{ padding: '4px 8px', minWidth: '320px' }}
          />
          <button
            onClick={async () => {
              try {
                const result = await (window as any).electron.debug.startAutomation(
                  debugId || undefined,
                  debugPw || undefined,
                  debugProxy || undefined
                );
                if (!result?.success) {
                  console.error('Debug automation failed:', result?.error);
                  alert(`Automation failed${result?.error ? `: ${result.error}` : ''}`);
                }
              } catch (e: any) {
                console.error('Debug automation error:', e);
                alert(`Automation error: ${e?.message || e}`);
              }
            }}
            style={{ padding: '4px 10px', cursor: 'pointer' }}
          >
            Start
          </button>
          <span style={{ margin: '0 8px', color: '#888' }}>|</span>
          {!isNarrow && <span style={{ color: '#ddd' }}>Woori Spot:</span>}
          <input
            type="text"
            placeholder="ID"
            value={wooriId}
            onChange={(e) => setWooriId(e.target.value)}
            style={{ padding: '4px 8px', minWidth: '120px' }}
          />
          <input
            type="password"
            placeholder="Password"
            value={wooriPassword}
            onChange={(e) => setWooriPassword(e.target.value)}
            style={{ padding: '4px 8px', minWidth: '120px' }}
          />
          <input
            type="text"
            placeholder="Proxy (optional)"
            value={wooriProxy}
            onChange={(e) => setWooriProxy(e.target.value)}
            style={{ padding: '4px 8px', minWidth: '180px' }}
          />
          <input
            type="password"
            placeholder="Gemini API Key (optional)"
            value={wooriGeminiKey}
            onChange={(e) => setWooriGeminiKey(e.target.value)}
            style={{ padding: '4px 8px', minWidth: '200px' }}
          />
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
            style={{ padding: '4px 10px', cursor: 'pointer' }}
          >
            Start Woori
          </button>
          <button
            onClick={() => {
              setShowDebugForm(false);
              setDebugId('');
              setDebugPw('');
              setWooriId('');
              setWooriPassword('');
              setWooriProxy('');
              setWooriGeminiKey('');
            }}
            style={{ padding: '4px 10px', cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      )}
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
  return (
    <Router>
      <RouteWindowBoundsManager />
      <div className="app-container">
        <NavigationBar />
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
            
            {/* Fallback to home for unknown routes */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
