import {
  MemoryRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
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
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

function NavigationBar() {
  const location = useLocation();

  return (
    <div className="navigation-bar">
      <nav className="nav-links">
        <Link
          to="/"
          className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faHome} /> 홈
        </Link>
        <Link
          to="/blog-manager"
          className={`nav-link ${location.pathname === '/blog-manager' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faGlobe} /> 블로그 관리
        </Link>
        <Link
          to="/homepage-editor"
          className={`nav-link ${location.pathname === '/homepage-editor' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faCog} /> 홈페이지 에디터
        </Link>
        <Link
          to="/ssl-analyzer"
          className={`nav-link ${location.pathname === '/ssl-analyzer' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faShieldAlt} /> 사이트 보안 분석
        </Link>
        <Link
          to="/ai-keys"
          className={`nav-link ${location.pathname === '/ai-keys' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faRobot} /> API 키 관리
        </Link>
        <Link
          to="/local-server"
          className={`nav-link ${location.pathname === '/local-server' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faServer} /> 로컬 서버
        </Link>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <div className="app-container">
        <NavigationBar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<LandingPage />} />
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
          </Routes>
        </main>
      </div>
    </Router>
  );
}
