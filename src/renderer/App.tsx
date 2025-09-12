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
  faSearch,
  faList,
  faHome,
} from '@fortawesome/free-solid-svg-icons';
import LandingPage from './components/LandingPage';
import WordPressConnector from './components/WordPressConnector';
import WordPressSitesList from './components/WordPressSitesList';
import LocalServer from './components/LocalServer';
import { AIKeysManager } from './components/AIKeysManager';
import { DualScreenDemo } from './components/DualScreenEditor/DualScreenDemo';
import { CodespaceVectorAnalysis } from './components/AIEditor/CodespaceVectorAnalysis';
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
          to="/wordpress"
          className={`nav-link ${location.pathname === '/wordpress' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faGlobe} /> 워드프레스
        </Link>
        <Link
          to="/wordpress-sites"
          className={`nav-link ${location.pathname === '/wordpress-sites' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faList} /> 홈페이지 관리
        </Link>
        <Link
          to="/local-server"
          className={`nav-link ${location.pathname === '/local-server' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faServer} /> 로컬 서버
        </Link>
        <Link
          to="/ai-keys"
          className={`nav-link ${location.pathname === '/ai-keys' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faRobot} /> API 키 관리
        </Link>
        <Link
          to="/dual-screen"
          className={`nav-link ${location.pathname === '/dual-screen' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faServer} /> 듀얼 스크린
        </Link>
        <Link
          to="/codespace-analysis"
          className={`nav-link ${location.pathname === '/codespace-analysis' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faSearch} /> 코드스페이스 분석
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
            <Route path="/wordpress" element={<WordPressConnector />} />
            <Route path="/wordpress-sites" element={<WordPressSitesList />} />
            <Route path="/local-server" element={<LocalServer />} />
            <Route path="/ai-keys" element={<AIKeysManager />} />
            <Route path="/dual-screen" element={<DualScreenDemo />} />
            <Route
              path="/codespace-analysis"
              element={<CodespaceVectorAnalysis />}
            />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
