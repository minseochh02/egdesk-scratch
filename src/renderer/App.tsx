import React, { useState, useEffect, useRef } from 'react';
import {
  MemoryRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
  useNavigate,
  Navigate,
} from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGlobe,
  faRobot,
  faList,
  faHome,
  faLock,
  faShieldAlt,
  faCog,
} from './utils/fontAwesomeIcons';
import LandingPage from './components/LandingPage';
// import BlogManager from './components/BlogManager/BlogManager'; // Legacy component - replaced by EGBlogging
// import WordPressConnector from './components/BlogManager/WordPressConnector'; // Legacy component - replaced by EGBlogging
// import WordPressSitesList from './components/BlogManager/WordPressSitesList'; // Legacy component - replaced by EGBlogging
import { AIKeysManager } from './components/AIKeysManager';
import { HomepageEditor } from './components/HomepageEditor';
import SSLAnalyzer from './components/SSLAnalyzer/SSLAnalyzer';
import URLFileViewerPage from './components/URLFileViewerPage';
import ErrorBoundary from './components/ErrorBoundary';
import { EGBlogging } from './components/EGBlog';
// import { BlogConnector } from './components/EGBlog'; // Legacy component - replaced by EGBlogging
import './App.css';

function NavigationBar() {
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
        {/* Legacy BlogManager navigation - replaced by Blog Connector */}
        {/* <Link
          to="/blog-manager"
          className={`nav-link ${location.pathname === '/blog-manager' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faGlobe} />
          {!isNarrow && <span>EG Bloging</span>}
        </Link> */}
        <Link
          to="/blog-connector"
          className={`nav-link ${location.pathname === '/blog-connector' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faGlobe} />
          {!isNarrow && <span>EG Bloging</span>}
        </Link>
        <Link
          to="/homepage-editor"
          className={`nav-link ${location.pathname === '/homepage-editor' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faCog} />
          {!isNarrow && <span>EG Coding</span>}
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
  // Sync initial route from window.location for deep-link support in preview windows
  const initialPath = typeof window !== 'undefined' ? (window.location.pathname + window.location.search) : '/';
  return (
    <Router initialEntries={[initialPath]} initialIndex={0}>
      <RouteWindowBoundsManager />
      <div className="app-container">
        <NavigationBar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/index.html" element={<LandingPage />} />
            <Route path="/viewer" element={<URLFileViewerPage />} />
            {/* Legacy BlogManager route - replaced by EGBlogging */}
            {/* <Route 
              path="/blog-manager" 
              element={
                <ErrorBoundary>
                  <BlogManager />
                </ErrorBoundary>
              } 
            /> */}
            {/* Legacy WordPressConnector route - replaced by EGBlogging */}
            {/* <Route path="/wordpress" element={<WordPressConnector />} /> */}
            {/* Legacy WordPressSitesList route - replaced by EGBlogging */}
            {/* <Route 
              path="/wordpress-sites" 
              element={
                <ErrorBoundary>
                  <WordPressSitesList />
                </ErrorBoundary>
              } 
            /> */}
            <Route 
              path="/blog-connector" 
              element={
                <ErrorBoundary>
                  <EGBlogging />
                </ErrorBoundary>
              } 
            />
            {/* Legacy BlogConnector route - replaced by EGBlogging above */}
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
