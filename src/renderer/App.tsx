import React, { useState, useEffect } from 'react';
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
  faServer,
  faRobot,
  faList,
  faHome,
  faLock,
  faShieldAlt,
  faCog,
} from './utils/fontAwesomeIcons';
import LandingPage from './components/LandingPage';
import BlogManager from './components/BlogManager/BlogManager';
import WordPressConnector from './components/BlogManager/WordPressConnector';
import WordPressSitesList from './components/BlogManager/WordPressSitesList';
import { AIKeysManager } from './components/AIKeysManager';
import { HomepageEditor } from './components/HomepageEditor';
import SSLAnalyzer from './components/SSLAnalyzer/SSLAnalyzer';
import LocalServer from './components/LocalServer';
import URLFileViewerPage from './components/URLFileViewerPage';
import ErrorBoundary from './components/ErrorBoundary';
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
        <Link
          to="/blog-manager"
          className={`nav-link ${location.pathname === '/blog-manager' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faGlobe} />
          {!isNarrow && <span>블로그 관리</span>}
        </Link>
        <Link
          to="/homepage-editor"
          className={`nav-link ${location.pathname === '/homepage-editor' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faCog} />
          {!isNarrow && <span>홈페이지 에디터</span>}
        </Link>
        <Link
          to="/ssl-analyzer"
          className={`nav-link ${location.pathname === '/ssl-analyzer' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faShieldAlt} />
          {!isNarrow && <span>블로그 보안 분석</span>}
        </Link>
        <Link
          to="/ai-keys"
          className={`nav-link ${location.pathname === '/ai-keys' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faRobot} />
          {!isNarrow && <span>API 키 관리</span>}
        </Link>
        <Link
          to="/local-server"
          className={`nav-link ${location.pathname === '/local-server' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faServer} />
          {!isNarrow && <span>로컬 서버</span>}
        </Link>
      </nav>
    </div>
  );
}

export default function App() {
  // Sync initial route from window.location for deep-link support in preview windows
  const initialPath = typeof window !== 'undefined' ? (window.location.pathname + window.location.search) : '/';
  return (
    <Router initialEntries={[initialPath]} initialIndex={0}>
      <div className="app-container">
        <NavigationBar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/index.html" element={<LandingPage />} />
            <Route path="/viewer" element={<URLFileViewerPage />} />
            <Route 
              path="/blog-manager" 
              element={
                <ErrorBoundary>
                  <BlogManager />
                </ErrorBoundary>
              } 
            />
            <Route path="/wordpress" element={<WordPressConnector />} />
            <Route 
              path="/wordpress-sites" 
              element={
                <ErrorBoundary>
                  <WordPressSitesList />
                </ErrorBoundary>
              } 
            />
            <Route path="/ai-keys" element={<AIKeysManager />} />
            <Route path="/homepage-editor" element={<HomepageEditor />} />
            <Route path="/ssl-analyzer" element={<SSLAnalyzer />} />
            <Route 
              path="/local-server" 
              element={
                <ErrorBoundary>
                  <LocalServer />
                </ErrorBoundary>
              } 
            />
            {/* Fallback to home for unknown routes */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
