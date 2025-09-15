import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGlobe,
  faPlus,
  faTrash,
  faFolderOpen,
  faCog,
  faCalendarAlt,
  faEdit,
  faSync,
  faCheckCircle,
  faTimesCircle,
  faClock,
  faFileAlt,
  faImage,
  faChartBar,
  faExternalLinkAlt,
  faSpinner,
  faExclamationTriangle,
  faRefresh,
  faKey,
  faRobot,
} from '../utils/fontAwesomeIcons';
import './WordPressSitesList.css';

interface WordPressSite {
  id?: string;
  url: string;
  username: string;
  password?: string;
  name?: string;
  posts_count?: number;
  pages_count?: number;
  media_count?: number;
  local_sync_path?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Gradual implementation of WordPressSitesList
 * This version adds complexity step by step to identify where the error occurs
 */
function WordPressSitesListGradual(): React.JSX.Element {
  const navigate = useNavigate();
  const [connections, setConnections] = useState<WordPressSite[]>([]);
  const [selectedSite, setSelectedSite] = useState<WordPressSite | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const addDebugInfo = (info: string) => {
    setDebugInfo(prev => [...prev, `${new Date().toISOString()}: ${info}`]);
  };

  const loadSavedConnections = useCallback(async () => {
    try {
      addDebugInfo('Starting loadSavedConnections');
      setIsLoading(true);
      
      // Check if electron APIs are available
      if (!window.electron || !window.electron.wordpress) {
        throw new Error('Electron WordPress API not available');
      }
      
      addDebugInfo('Electron APIs available, calling getConnections');
      const result = await window.electron.wordpress.getConnections();
      addDebugInfo(`getConnections result: ${JSON.stringify(result)}`);
      
      if (result.success && result.connections) {
        setConnections(result.connections);
        addDebugInfo(`Set connections: ${result.connections.length} items`);
        if (result.connections.length > 0 && !selectedSite) {
          setSelectedSite(result.connections[0]);
          addDebugInfo('Set selected site');
        }
      } else {
        setError('연결된 WordPress 사이트를 불러올 수 없습니다.');
        addDebugInfo('No connections found or API error');
      }
    } catch (error) {
      addDebugInfo(`Error in loadSavedConnections: ${error}`);
      console.error('Failed to load saved connections:', error);
      setError(`연결된 WordPress 사이트를 불러오는 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
      addDebugInfo('loadSavedConnections completed');
    }
  }, [selectedSite]);

  // Load saved connections on component mount
  useEffect(() => {
    addDebugInfo('Component mounted, starting loadSavedConnections');
    loadSavedConnections();
  }, [loadSavedConnections]);

  if (isLoading) {
    return (
      <div className="wordpress-sites-list">
        <div className="loading-container">
          <div className="loading-spinner">
            <FontAwesomeIcon icon={faSpinner} spin />
          </div>
          <h3>WordPress 사이트를 불러오는 중...</h3>
          <p>잠시만 기다려주세요</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="wordpress-sites-list">
        <div className="error-container">
          <div className="error-icon">
            <FontAwesomeIcon icon={faExclamationTriangle} />
          </div>
          <h2>연결 오류</h2>
          <p>{error}</p>
          <div className="debug-info">
            <h4>디버그 정보:</h4>
            <pre>{debugInfo.join('\n')}</pre>
          </div>
          <button type="button" onClick={loadSavedConnections} className="retry-btn">
            <FontAwesomeIcon icon={faRefresh} />
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <div className="wordpress-sites-list">
        <div className="empty-state">
          <div className="empty-icon">
            <FontAwesomeIcon icon={faGlobe} />
          </div>
          <h2>연결된 WordPress 사이트가 없습니다</h2>
          <p>새로운 WordPress 사이트를 연결하여 시작하세요</p>
          <button
            type="button"
            onClick={() => navigate('/wordpress')}
            className="connect-btn"
          >
            <FontAwesomeIcon icon={faPlus} />
            WordPress 사이트 연결하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="wordpress-sites-list">
      {/* Header Section */}
      <div className="sites-header">
        <div className="header-content">
          <div className="header-text">
            <h1>
              <FontAwesomeIcon icon={faGlobe} />
              WordPress 사이트 관리 (단계적 구현)
            </h1>
            <p>총 {connections.length}개의 사이트가 연결되어 있습니다</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="sites-content">
        {/* Sites Grid */}
        <div className="sites-grid">
          {connections.map((connection) => (
            <div
              key={connection.id}
              className={`site-card ${selectedSite?.id === connection.id ? 'selected' : ''}`}
              onClick={() => setSelectedSite(connection)}
            >
              {/* Card Header */}
              <div className="site-card-header">
                <div className="site-info">
                  <h3>{connection.name || '이름 없음'}</h3>
                  <div className="site-url">
                    <FontAwesomeIcon icon={faGlobe} />
                    <span>{connection.url}</span>
                  </div>
                </div>
              </div>

              {/* Stats Section */}
              <div className="site-stats">
                <div className="stat-item">
                  <FontAwesomeIcon icon={faFileAlt} />
                  <div className="stat-content">
                    <span className="stat-value">
                      {connection.posts_count || 0}
                    </span>
                    <span className="stat-label">포스트</span>
                  </div>
                </div>
                <div className="stat-item">
                  <FontAwesomeIcon icon={faChartBar} />
                  <div className="stat-content">
                    <span className="stat-value">
                      {connection.pages_count || 0}
                    </span>
                    <span className="stat-label">페이지</span>
                  </div>
                </div>
                <div className="stat-item">
                  <FontAwesomeIcon icon={faImage} />
                  <div className="stat-content">
                    <span className="stat-value">
                      {connection.media_count || 0}
                    </span>
                    <span className="stat-label">미디어</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Debug Info */}
        <div className="debug-section">
          <h3>디버그 정보</h3>
          <pre>{debugInfo.join('\n')}</pre>
        </div>
      </div>
    </div>
  );
}

export default WordPressSitesListGradual;
