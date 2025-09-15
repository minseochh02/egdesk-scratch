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
  faComments,
  faLock,
  faShieldAlt,
  faCog,
} from './utils/fontAwesomeIcons';
import LandingPage from './components/LandingPage';
import BlogManager from './components/BlogManager';
import WordPressConnector from './components/WordPressConnector';
import WordPressSitesList from './components/WordPressSitesList';
import WordPressSitesListMinimal from './components/WordPressSitesListMinimal';
import WordPressSitesListStepByStep from './components/WordPressSitesListStepByStep';
import WordPressSitesListGradual from './components/WordPressSitesListGradual';
import WordPressSitesListWithComponents from './components/WordPressSitesListWithComponents';
import WordPressSitesListFixed from './components/WordPressSitesListFixed';
import WordPressSitesListTestComponents from './components/WordPressSitesListTestComponents';
import { AIKeysManager } from './components/AIKeysManager';
import { AIChat } from './components/AIChat/AIChat';
import SSLAnalyzer from './components/SSLAnalyzer';
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
          to="/ai-chat"
          className={`nav-link ${location.pathname === '/ai-chat' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faCog} /> 홈페이지 관리
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
            <Route path="/ai-chat" element={<AIChat />} />
            <Route path="/ssl-analyzer" element={<SSLAnalyzer />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
