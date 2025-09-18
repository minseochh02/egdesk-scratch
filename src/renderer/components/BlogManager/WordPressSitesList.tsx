
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
  faDatabase,
} from '../../utils/fontAwesomeIcons';
import ScheduledPosts from './ScheduledPosts';
import WordPressPostScheduler from './WordPressSitesList/WordPressPostScheduler';
import SchedulerManager from '../SchedulerManager/SchedulerManager';
import DebugButton from '../DebugButton';
import ExecutionLogs from '../ExecutionLogs';
import { aiKeysStore } from '../AIKeysManager/store/aiKeysStore';
import { AIKey } from '../AIKeysManager/types';
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
  site_id: string;
  site_name: string;
  operation_type: 'full_sync' | 'posts_only' | 'media_only' | 'incremental';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  start_time: string;
  end_time?: string;
  total_posts: number;
  synced_posts: number;
  total_media: number;
  synced_media: number;
  errors: string;
  export_format: string;
  local_path?: string;
  created_at: string;
}

interface SyncFileDetail {
  id: string;
  sync_operation_id: string;
  file_type: 'post' | 'media' | 'export';
  file_name: string;
  file_path: string;
  file_size: number;
  status: 'pending' | 'synced' | 'failed' | 'skipped';
  error_message?: string;
  synced_at?: string;
  wordpress_id?: number;
  wordpress_url?: string;
}

interface SyncStats {
  totalPosts: number;
  totalMedia: number;
  totalSyncOperations: number;
  lastSyncTime: string | null;
  totalFileSize: number;
}

interface WordPressSitesListProps {
  onSwitchToConnector?: () => void;
}

function WordPressSitesList({ onSwitchToConnector }: WordPressSitesListProps): React.JSX.Element {
  const navigate = useNavigate();
  const [connections, setConnections] = useState<WordPressSite[]>([]);
  const [selectedSite, setSelectedSite] = useState<WordPressSite | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncRecord[]>([]);
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [showScheduledPosts, setShowScheduledPosts] = useState(false);
  const [showExecutionLogs, setShowExecutionLogs] = useState(false);
  const [templateRefreshKey, setTemplateRefreshKey] = useState(0);
  
  // AI Keys state
  const [aiKeys, setAiKeys] = useState<AIKey[]>([]);
  const [selectedKey, setSelectedKey] = useState<AIKey | null>(null);
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini');

  // Add error boundary state
  const [componentError, setComponentError] = useState<string | null>(null);

  // Subscribe to AI keys store with error handling
  useEffect(() => {
    try {
      const unsubscribe = aiKeysStore.subscribe((keyState) => {
        try {
          const activeKeys = keyState.keys.filter((key) => key.isActive);
          setAiKeys(activeKeys);

          // Auto-select first key if none selected and keys are available
          if (!selectedKey && activeKeys.length > 0) {
            setSelectedKey(activeKeys[0]);
          }
        } catch (error) {
          console.error('Error in AI keys subscription:', error);
          setComponentError('Failed to load AI keys configuration');
        }
      });

      // Get initial state immediately
      try {
        const currentState = aiKeysStore.getState();
        const activeKeys = currentState.keys.filter((key) => key.isActive);
        setAiKeys(activeKeys);
        if (!selectedKey && activeKeys.length > 0) {
          setSelectedKey(activeKeys[0]);
        }
      } catch (error) {
        console.warn('Failed to get initial AI keys state:', error);
        setComponentError('Failed to initialize AI keys');
      }

      return () => unsubscribe();
    } catch (error) {
      console.error('Failed to set up AI keys subscription:', error);
      setComponentError('Failed to set up AI keys subscription');
    }
  }, [selectedKey]);

  // Handle model change
  const handleModelChange = (providerId: string, modelId: string) => {
    setSelectedModel(modelId);

    // Auto-select a compatible API key for the new provider
    const compatibleKeys = aiKeys.filter(
      (key) => key.providerId === providerId,
    );
    if (compatibleKeys.length > 0) {
      setSelectedKey(compatibleKeys[0]);
    } else {
      setSelectedKey(null);
    }
  };

  // Handle key change
  const handleKeyChange = (key: AIKey | null) => {
    setSelectedKey(key);
  };

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
  }, []);

  const loadSyncHistory = useCallback(async (connectionId: string) => {
    try {
      // Check if electron APIs are available
      if (!window.electron || !window.electron.wordpress) {
        console.warn('Electron WordPress API not available');
        return;
      }
      
      // Load sync operations from SQLite
      const operationsResult = await window.electron.wordpress.getSyncOperations(connectionId, 50);
      if (operationsResult.success && operationsResult.operations) {
        setSyncHistory(operationsResult.operations);
      }

      // Load sync stats from SQLite
      const statsResult = await window.electron.wordpress.getSyncStats(connectionId);
      if (statsResult.success && statsResult.stats) {
        setSyncStats(statsResult.stats);
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
      case 'running':
        return '진행 중';
      case 'pending':
        return '대기 중';
      case 'cancelled':
        return '취소됨';
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
      case 'running':
        return <FontAwesomeIcon icon={faSpinner} spin />;
      case 'pending':
        return <FontAwesomeIcon icon={faClock} />;
      case 'cancelled':
        return <FontAwesomeIcon icon={faTimesCircle} />;
      default:
        return <FontAwesomeIcon icon={faExclamationTriangle} />;
    }
  };

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
              WordPress 사이트 관리
            </h1>
            <p>총 {connections.length}개의 사이트가 연결되어 있습니다</p>
          </div>
          <div className="header-actions">
            {onSwitchToConnector && (
              <button
                type="button"
                onClick={onSwitchToConnector}
                className="add-connection-btn"
              >
                <FontAwesomeIcon icon={faPlus} />새 연결 추가
              </button>
            )}
            {!onSwitchToConnector && (
              <button
                type="button"
                onClick={navigateToWordPressConnector}
                className="add-connection-btn"
              >
                <FontAwesomeIcon icon={faPlus} />새 연결 추가
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowExecutionLogs(true)}
              className="execution-logs-btn"
              title="View execution logs"
            >
              <FontAwesomeIcon icon={faDatabase} />
              실행 로그
            </button>
            <DebugButton className="debug-btn" />
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
                      {syncStats?.totalPosts || connection.posts_count || 0}
                    </span>
                    <span className="stat-label">동기화된 포스트</span>
                  </div>
                </div>
                <div className="stat-item">
                  <FontAwesomeIcon icon={faImage} />
                  <div className="stat-content">
                    <span className="stat-value">
                      {syncStats?.totalMedia || connection.media_count || 0}
                    </span>
                    <span className="stat-label">동기화된 미디어</span>
                  </div>
                </div>
                <div className="stat-item">
                  <FontAwesomeIcon icon={faDatabase} />
                  <div className="stat-content">
                    <span className="stat-value">
                      {syncStats?.totalSyncOperations || 0}
                    </span>
                    <span className="stat-label">동기화 횟수</span>
                  </div>
                </div>
              </div>

              {/* Sync Status */}
              {syncStats && syncStats.totalPosts > 0 && (
                <div className="sync-info">
                  <div className="sync-status">
                    <FontAwesomeIcon icon={faDatabase} />
                    <span>SQLite 동기화됨</span>
                  </div>
                  <div className="sync-details">
                    <span>{syncStats.totalPosts}개 포스트</span>
                    <span>{syncStats.totalMedia}개 미디어</span>
                  </div>
                </div>
              )}

              {/* Legacy sync status for backward compatibility */}
              {!syncStats && connection.local_sync_path && (
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


        {/* WordPress Post Scheduler */}
        <WordPressPostScheduler
          key={templateRefreshKey}
          sites={connections}
          selectedSite={selectedSite}
          onTaskCreated={() => {
            // Refresh the WordPressPostScheduler component to show newly created task
            setTemplateRefreshKey(prev => prev + 1);
            console.log('WordPress post task created - refreshing component');
          }}
        />

        {/* Task Scheduler Manager */}
        <div className="scheduler-section">
          <SchedulerManager className="wordpress-scheduler-manager" />
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
                                {new Date(record.start_time).toLocaleString('ko-KR')}
                              </span>
                            </div>
                            <div className="sync-record-details">
                              <span>
                                포스트: {record.synced_posts}/{record.total_posts}개
                              </span>
                              <span>
                                미디어: {record.synced_media}/{record.total_media}개
                              </span>
                              {record.end_time && (
                                <span>
                                  완료:{' '}
                                  {new Date(record.end_time).toLocaleString(
                                    'ko-KR',
                                  )}
                                </span>
                              )}
                            </div>
                            <div className="sync-operation-type">
                              <span className="operation-badge">
                                {record.operation_type === 'full_sync' && '전체 동기화'}
                                {record.operation_type === 'posts_only' && '포스트만'}
                                {record.operation_type === 'media_only' && '미디어만'}
                                {record.operation_type === 'incremental' && '증분 동기화'}
                              </span>
                              <span className="export-format">
                                {record.export_format}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sync Stats */}
                  {syncStats && (
                    <div className="sync-stats-section">
                      <h4>
                        <FontAwesomeIcon icon={faChartBar} />
                        동기화 통계
                      </h4>
                      <div className="sync-stats-grid">
                        <div className="stat-item">
                          <span className="stat-value">{syncStats.totalPosts}</span>
                          <span className="stat-label">동기화된 포스트</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-value">{syncStats.totalMedia}</span>
                          <span className="stat-label">동기화된 미디어</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-value">{syncStats.totalSyncOperations}</span>
                          <span className="stat-label">총 동기화 횟수</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-value">
                            {syncStats.totalFileSize > 1024 * 1024 
                              ? `${(syncStats.totalFileSize / (1024 * 1024)).toFixed(1)}MB`
                              : `${(syncStats.totalFileSize / 1024).toFixed(1)}KB`
                            }
                          </span>
                          <span className="stat-label">총 파일 크기</span>
                        </div>
                        {syncStats.lastSyncTime && (
                          <div className="stat-item full-width">
                            <span className="stat-label">마지막 동기화:</span>
                            <span className="stat-value">
                              {new Date(syncStats.lastSyncTime).toLocaleString('ko-KR')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
          </div>
        )}

        {/* Scheduled Posts Modal */}
        {showScheduledPosts && selectedSite && (
          <ScheduledPosts
            site={selectedSite}
            onClose={() => setShowScheduledPosts(false)}
          />
        )}

        {/* Execution Logs Modal */}
        {showExecutionLogs && (
          <div className="execution-logs-modal">
            <div className="modal-overlay" onClick={() => setShowExecutionLogs(false)} />
            <div className="modal-content logs-modal">
              <ExecutionLogs
                onClose={() => setShowExecutionLogs(false)}
                showHeader={true}
              />
            </div>
          </div>
        )}

        
      </div>
    </div>
  );
};

export default WordPressSitesList;
