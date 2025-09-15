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
  // Blog Writer preferences
  blog_category?: string;
  ai_provider_id?: string;
  ai_model_id?: string;
  ai_key_id?: string;
}

interface SyncRecord {
  id: string;
  connectionId: string;
  connectionName: string;
  syncPath: string;
  startedAt: string;
  completedAt?: string;
  status: 'in_progress' | 'completed' | 'failed';
  totalFiles: number;
  syncedFiles: number;
  failedFiles: number;
  fileDetails: SyncFileDetail[];
  errors: string[];
  updatedAt?: string;
}

interface SyncFileDetail {
  path: string;
  name: string;
  type: 'post' | 'media';
  status: 'synced' | 'failed' | 'skipped';
  localPath: string;
  size?: number;
  syncedAt: string;
  error?: string;
}

/**
 * Test version that adds components one by one to identify the problematic one
 */
function WordPressSitesListTestComponents(): React.JSX.Element {
  const navigate = useNavigate();
  const [connections, setConnections] = useState<WordPressSite[]>([]);
  const [selectedSite, setSelectedSite] = useState<WordPressSite | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [showScheduledPosts, setShowScheduledPosts] = useState(false);
  const [templateRefreshKey, setTemplateRefreshKey] = useState(0);
  
  // AI Keys state - simplified to avoid complex store interactions
  const [aiKeys, setAiKeys] = useState<any[]>([]);
  const [selectedKey, setSelectedKey] = useState<any | null>(null);
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini');

  // Add error boundary state
  const [componentError, setComponentError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Array<{component: string, status: 'pending' | 'success' | 'error', message: string}>>([]);

  const addTestResult = (component: string, status: 'success' | 'error', message: string) => {
    setTestResults(prev => [...prev, { component, status, message }]);
  };

  // Simplified AI Keys Store interaction with error handling
  useEffect(() => {
    try {
      // Try to load AI keys store safely
      const { aiKeysStore } = require('./AIKeysManager/store/aiKeysStore');
      
      const unsubscribe = aiKeysStore.subscribe((keyState: any) => {
        try {
          if (keyState && keyState.keys && Array.isArray(keyState.keys)) {
            const activeKeys = keyState.keys.filter((key: any) => key && key.isActive);
            setAiKeys(activeKeys);
            
            if (!selectedKey && activeKeys.length > 0) {
              setSelectedKey(activeKeys[0]);
            }
          }
        } catch (error) {
          console.error('Error in AI keys subscription:', error);
          setComponentError('Failed to load AI keys configuration');
        }
      });

      // Get initial state safely
      try {
        const currentState = aiKeysStore.getState();
        if (currentState && currentState.keys && Array.isArray(currentState.keys)) {
          const activeKeys = currentState.keys.filter((key: any) => key && key.isActive);
          setAiKeys(activeKeys);
          if (!selectedKey && activeKeys.length > 0) {
            setSelectedKey(activeKeys[0]);
          }
        }
      } catch (error) {
        console.warn('Failed to get initial AI keys state:', error);
        // Don't set component error for this, just continue without AI keys
      }

      return () => unsubscribe();
    } catch (error) {
      console.error('Failed to set up AI keys subscription:', error);
      // Don't set component error, just continue without AI keys
    }
  }, [selectedKey]);

  const loadSavedConnections = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Check if electron APIs are available
      if (!window.electron || !window.electron.wordpress) {
        throw new Error('Electron WordPress API not available');
      }
      
      const result = await window.electron.wordpress.getConnections();
      if (result.success && result.connections) {
        setConnections(result.connections);
        if (result.connections.length > 0 && !selectedSite) {
          setSelectedSite(result.connections[0]);
        }
      } else {
        setError('연결된 WordPress 사이트를 불러올 수 없습니다.');
      }
    } catch (error) {
      console.error('Failed to load saved connections:', error);
      setError(`연결된 WordPress 사이트를 불러오는 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSite]);

  const loadSyncHistory = useCallback(async (connectionId: string) => {
    try {
      // Check if electron APIs are available
      if (!window.electron || !window.electron.sync) {
        console.warn('Electron sync API not available');
        return;
      }
      
      const result = await window.electron.sync.getHistory(connectionId);
      if (result.success && result.syncHistory) {
        setSyncHistory(result.syncHistory);
      }
    } catch (error) {
      console.error('Failed to load sync history:', error);
    }
  }, []);

  const disconnectSite = async (siteId: string) => {
    if (window.confirm('정말로 이 연결을 삭제하시겠습니까?')) {
      try {
        const result = await window.electron.wordpress.deleteConnection(siteId);
        if (result.success && result.connections) {
          setConnections(result.connections);
          if (selectedSite?.id === siteId) {
            setSelectedSite(null);
            setSyncHistory([]);
          }
        }
      } catch (error) {
        console.error('Failed to disconnect site:', error);
        alert('연결 삭제 중 오류가 발생했습니다.');
      }
    }
  };

  const navigateToWordPressConnector = () => {
    navigate('/wordpress');
  };

  const navigateToSyncedFolder = async (site: WordPressSite) => {
    if (!site.local_sync_path) {
      alert('이 사이트는 아직 동기화되지 않았습니다.');
      return;
    }

    try {
      // First navigate to the Finder UI
      navigate('/');

      // Wait a bit for the component to mount
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Then trigger the folder navigation
      await (window.electron.wordpress as any).navigateToSyncedFolder({
        syncPath: site.local_sync_path,
        connectionName: site.name || site.url,
      });

      // Show success message
      alert(`동기화된 폴더로 이동합니다: ${site.local_sync_path}`);
    } catch (error) {
      console.error('Failed to navigate to synced folder:', error);
      alert('폴더로 이동할 수 없습니다.');
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'completed':
        return '완료';
      case 'failed':
        return '실패';
      case 'in_progress':
        return '진행 중';
      default:
        return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <FontAwesomeIcon icon={faCheckCircle} />;
      case 'failed':
        return <FontAwesomeIcon icon={faTimesCircle} />;
      case 'in_progress':
        return <FontAwesomeIcon icon={faClock} />;
      default:
        return <FontAwesomeIcon icon={faExclamationTriangle} />;
    }
  };

  // Test components individually
  useEffect(() => {
    const testComponents = async () => {
      // Test 1: WordPressPostScheduler
      try {
        addTestResult('WordPressPostScheduler', 'pending', 'Testing...');
        const WordPressPostScheduler = require('./WordPressSitesList/WordPressPostScheduler').default;
        addTestResult('WordPressPostScheduler', 'success', 'Component loaded successfully');
      } catch (error) {
        addTestResult('WordPressPostScheduler', 'error', `Failed to load: ${error}`);
      }

      // Test 2: SchedulerManager
      try {
        addTestResult('SchedulerManager', 'pending', 'Testing...');
        const SchedulerManager = require('./SchedulerManager/SchedulerManager').default;
        addTestResult('SchedulerManager', 'success', 'Component loaded successfully');
      } catch (error) {
        addTestResult('SchedulerManager', 'error', `Failed to load: ${error}`);
      }

      // Test 3: ScheduledPosts
      try {
        addTestResult('ScheduledPosts', 'pending', 'Testing...');
        const ScheduledPosts = require('./ScheduledPosts').default;
        addTestResult('ScheduledPosts', 'success', 'Component loaded successfully');
      } catch (error) {
        addTestResult('ScheduledPosts', 'error', `Failed to load: ${error}`);
      }

      // Test 4: DebugButton
      try {
        addTestResult('DebugButton', 'pending', 'Testing...');
        const DebugButton = require('./DebugButton').default;
        addTestResult('DebugButton', 'success', 'Component loaded successfully');
      } catch (error) {
        addTestResult('DebugButton', 'error', `Failed to load: ${error}`);
      }
    };

    testComponents();
  }, []);

  // Load saved connections on component mount
  useEffect(() => {
    loadSavedConnections();
  }, [loadSavedConnections]);

  // Load sync history when selected site changes
  useEffect(() => {
    if (selectedSite?.id) {
      loadSyncHistory(selectedSite.id);
    }
  }, [selectedSite, loadSyncHistory]);

  // Show component error if any
  if (componentError) {
    return (
      <div className="wordpress-sites-list">
        <div className="error-container">
          <div className="error-icon">
            <FontAwesomeIcon icon={faExclamationTriangle} />
          </div>
          <h2>구성 오류</h2>
          <p>{componentError}</p>
          <button 
            type="button" 
            onClick={() => {
              setComponentError(null);
              window.location.reload();
            }} 
            className="retry-btn"
          >
            <FontAwesomeIcon icon={faRefresh} />
            페이지 새로고침
          </button>
        </div>
      </div>
    );
  }

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
            onClick={navigateToWordPressConnector}
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
              WordPress 사이트 관리 (컴포넌트 테스트)
            </h1>
            <p>총 {connections.length}개의 사이트가 연결되어 있습니다</p>
          </div>
          <div className="header-actions">
            <button
              type="button"
              onClick={navigateToWordPressConnector}
              className="add-connection-btn"
            >
              <FontAwesomeIcon icon={faPlus} />새 연결 추가
            </button>
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
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedSite(connection);
                }
              }}
              role="button"
              tabIndex={0}
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
                <button
                  type="button"
                  className="disconnect-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    disconnectSite(connection.id!);
                  }}
                  title="연결 삭제"
                >
                  <FontAwesomeIcon icon={faTrash} />
                </button>
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

              {/* Sync Status */}
              {connection.local_sync_path && (
                <div className="sync-info">
                  <div className="sync-status">
                    <FontAwesomeIcon icon={faSync} />
                    <span>로컬 동기화됨</span>
                  </div>
                  <button
                    className="go-to-folder-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigateToSyncedFolder(connection);
                    }}
                    title="동기화된 폴더로 이동"
                  >
                    <FontAwesomeIcon icon={faFolderOpen} />
                  </button>
                </div>
              )}

              {/* Action Buttons */}
              <div className="site-actions">
                <button
                  type="button"
                  className="wordpress-sites-action-btn primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateToWordPressConnector();
                  }}
                >
                  <FontAwesomeIcon icon={faCog} />
                  관리
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Component Test Results */}
        <div className="component-test-results">
          <h3>컴포넌트 테스트 결과</h3>
          <div className="test-results">
            {testResults.map((result, index) => (
              <div key={index} className={`test-result ${result.status}`}>
                <div className="test-result-header">
                  <span className="test-component">{result.component}</span>
                  <span className={`test-status ${result.status}`}>
                    {result.status === 'success' ? <FontAwesomeIcon icon={faCheckCircle} /> : 
                     result.status === 'error' ? <FontAwesomeIcon icon={faTimesCircle} /> :
                     <FontAwesomeIcon icon={faSpinner} spin />}
                  </span>
                </div>
                <div className="test-message">{result.message}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Sidebar: Site Summary */}
        {selectedSite && (
          <div className="sidebar-stack">
            <div className="site-details">
              <div className="details-header">
                <h3>
                  <FontAwesomeIcon icon={faChartBar} />
                  {selectedSite.name || '이름 없음'} 상세 정보
                </h3>
              </div>

              <div className="details-content">
                <div className="detail-section">
                  <h4>연결 정보</h4>
                  <div className="detail-item">
                    <div className="detail-label">
                      <FontAwesomeIcon icon={faGlobe} />
                      사이트 URL
                    </div>
                    <span className="url-value">{selectedSite.url}</span>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">
                      <FontAwesomeIcon icon={faCog} />
                      사용자명
                    </div>
                    <span>{selectedSite.username}</span>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">
                      <FontAwesomeIcon icon={faExternalLinkAlt} />
                      연결 ID
                    </div>
                    <span className="id-value">{selectedSite.id}</span>
                  </div>
                  {selectedSite.local_sync_path && (
                    <div className="detail-item">
                      <div className="detail-label">
                        <FontAwesomeIcon icon={faFolderOpen} />
                        로컬 동기화 경로
                      </div>
                      <span className="sync-path">
                        {selectedSite.local_sync_path}
                      </span>
                    </div>
                  )}
                </div>

                {/* Sync History */}
                {syncHistory.length > 0 && (
                  <div className="sync-history-section">
                    <h4>
                      <FontAwesomeIcon icon={faClock} />
                      동기화 기록
                    </h4>
                    <div className="sync-history-list">
                      {syncHistory.slice(0, 5).map((record) => (
                        <div
                          key={record.id}
                          className={`sync-record ${record.status}`}
                        >
                          <div className="sync-record-header">
                            <div className="sync-status">
                              {getStatusIcon(record.status)}
                              <span>{getStatusText(record.status)}</span>
                            </div>
                            <span className="sync-date">
                              {new Date(record.startedAt).toLocaleString('ko-KR')}
                            </span>
                          </div>
                          <div className="sync-record-details">
                            <span>
                              파일: {record.syncedFiles}/{record.totalFiles}개
                            </span>
                            {record.completedAt && (
                              <span>
                                완료:{' '}
                                {new Date(record.completedAt).toLocaleString(
                                  'ko-KR',
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default WordPressSitesListTestComponents;
