import { MemoryRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import WordPressConnector from './components/WordPressConnector';
import WordPressSitesList from './components/WordPressSitesList';
import LocalServer from './components/LocalServer';
import CodeEditor from './components/CodeEditor';
import { AIKeysManager } from './components/AIKeysManager';
import { AIEditor } from './components/AIEditor';
import { DualScreenDemo } from './components/DualScreenEditor/DualScreenDemo';
import { CodespaceVectorAnalysis } from './components/AIEditor/CodespaceVectorAnalysis';
import SchedulerManager from './components/SchedulerManager/SchedulerManager';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCode, 
  faGlobe, 
  faServer, 
  faRobot, 
  faSearch, 
  faList, 
  faClock,
  faHome
} from '@fortawesome/free-solid-svg-icons';
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
          <FontAwesomeIcon icon={faHome} /> Home
        </Link>
        <Link 
          to="/wordpress" 
          className={`nav-link ${location.pathname === '/wordpress' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faGlobe} /> WordPress
        </Link>
        <Link 
          to="/wordpress-sites" 
          className={`nav-link ${location.pathname === '/wordpress-sites' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faList} /> WordPress Sites
        </Link>
        <Link 
          to="/local-server" 
          className={`nav-link ${location.pathname === '/local-server' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faServer} /> Local Server
        </Link>
        <Link 
          to="/code-editor" 
          className={`nav-link ${location.pathname === '/code-editor' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faCode} /> Code Editor
        </Link>
        <Link 
          to="/ai-keys" 
          className={`nav-link ${location.pathname === '/ai-keys' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faRobot} /> AI Keys
        </Link>
        <Link 
          to="/dual-screen" 
          className={`nav-link ${location.pathname === '/dual-screen' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faServer} /> Dual Screen
        </Link>
        <Link 
          to="/codespace-analysis" 
          className={`nav-link ${location.pathname === '/codespace-analysis' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faSearch} /> Codespace Analysis
        </Link>
        <Link 
          to="/scheduler" 
          className={`nav-link ${location.pathname === '/scheduler' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faClock} /> Scheduler
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
            <Route path="/code-editor" element={<CodeEditor />} />
            <Route path="/ai-keys" element={<AIKeysManager />} />
            <Route path="/dual-screen" element={<DualScreenDemo />} />
            <Route path="/codespace-analysis" element={<CodespaceVectorAnalysis />} />
            <Route path="/scheduler" element={<SchedulerManager />} />
    
          </Routes>
        </main>
      </div>
    </Router>
  );
}
