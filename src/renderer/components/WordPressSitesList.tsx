import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ScheduledPosts from './ScheduledPosts';
import WordPressPostScheduler from './WordPressSitesList/WordPressPostScheduler';
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

const WordPressSitesList: React.FC = () => {
  const navigate = useNavigate();
  const [connections, setConnections] = useState<WordPressSite[]>([]);
  const [selectedSite, setSelectedSite] = useState<WordPressSite | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [showScheduledPosts, setShowScheduledPosts] = useState(false);

  // Load saved connections on component mount
  useEffect(() => {
    loadSavedConnections();
  }, []);

  // Load sync history when selected site changes
  useEffect(() => {
    if (selectedSite?.id) {
      loadSyncHistory(selectedSite.id);
    }
  }, [selectedSite]);

  const loadSavedConnections = async () => {
    try {
      setIsLoading(true);
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
      setError('연결된 WordPress 사이트를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSyncHistory = async (connectionId: string) => {
    try {
      const result = await window.electron.sync.getHistory(connectionId);
      if (result.success && result.syncHistory) {
        setSyncHistory(result.syncHistory);
      }
    } catch (error) {
      console.error('Failed to load sync history:', error);
    }
  };

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
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Then trigger the folder navigation
      await (window.electron.wordpress as any).navigateToSyncedFolder({
        syncPath: site.local_sync_path,
        connectionName: site.name || site.url
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
      case 'completed': return '완료';
      case 'failed': return '실패';
      case 'in_progress': return '진행 중';
      default: return status;
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'completed': return '✅';
      case 'failed': return '❌';
      case 'in_progress': return '⏳';
      default: return '❓';
    }
  };

  if (isLoading) {
    return (
      <div className="wordpress-sites-list">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>WordPress 사이트를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="wordpress-sites-list">
        <div className="error-container">
          <h2>❌ 오류</h2>
          <p>{error}</p>
          <button onClick={loadSavedConnections} className="retry-btn">
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
          <h2>🌐 연결된 WordPress 사이트가 없습니다</h2>
          <p>새로운 WordPress 사이트를 연결하려면 아래 버튼을 클릭하세요.</p>
          <button onClick={navigateToWordPressConnector} className="connect-btn">
            WordPress 사이트 연결하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="wordpress-sites-list">
      <div className="sites-header">
        <h1>🌐 연결된 WordPress 사이트</h1>
        <p>총 {connections.length}개의 WordPress 사이트가 연결되어 있습니다.</p>
        <button onClick={navigateToWordPressConnector} className="add-connection-btn">
          ➕ 새 연결 추가
        </button>
      </div>

      <div className="sites-content">
        <div className="sites-grid">
          {connections.map((connection) => (
            <div
              key={connection.id}
              className={`site-card ${selectedSite?.id === connection.id ? 'selected' : ''}`}
              onClick={() => setSelectedSite(connection)}
            >
              <div className="site-card-header">
                <h3>{connection.name || '이름 없음'}</h3>
                <button
                  className="disconnect-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    disconnectSite(connection.id!);
                  }}
                  title="연결 삭제"
                >
                  ❌
                </button>
              </div>
              
              <div className="site-url">
                <span className="url-icon">🌐</span>
                <span className="url-text">{connection.url}</span>
              </div>
              
              <div className="site-stats">
                <div className="stat-item">
                  <span className="stat-icon">📝</span>
                  <span className="stat-label">포스트</span>
                  <span className="stat-value">{connection.posts_count || 0}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-icon">📄</span>
                  <span className="stat-label">페이지</span>
                  <span className="stat-value">{connection.pages_count || 0}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-icon">🖼️</span>
                  <span className="stat-label">미디어</span>
                  <span className="stat-value">{connection.media_count || 0}</span>
                </div>
              </div>

              {connection.local_sync_path && (
                <div className="sync-info">
                  <span className="sync-icon">💾</span>
                  <span className="sync-text">로컬 동기화됨</span>
                  <button
                    className="go-to-folder-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigateToSyncedFolder(connection);
                    }}
                    title="동기화된 폴더로 이동"
                  >
                    📁
                  </button>
                </div>
              )}

              <div className="site-actions">
                <button
                  className="action-btn primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateToWordPressConnector();
                  }}
                >
                  관리하기
                </button>
                <button
                  className="action-btn scheduled"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSite(connection);
                    setShowScheduledPosts(true);
                  }}
                >
                  📅 예약 포스트
                </button>
                {connection.local_sync_path && (
                  <button
                    className="action-btn secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigateToSyncedFolder(connection);
                    }}
                  >
                    폴더 열기
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* WordPress Post Scheduler */}
        <WordPressPostScheduler 
          sites={connections}
          onTaskCreated={() => {
            // Refresh any data if needed
            console.log('WordPress post task created');
          }}
        />

        {/* Selected Site Details */}
        {selectedSite && (
          <div className="site-details">
            <h3>📊 {selectedSite.name || '이름 없음'} 상세 정보</h3>
            
            <div className="details-grid">
              <div className="detail-item">
                <label>사이트 URL</label>
                <span>{selectedSite.url}</span>
              </div>
              <div className="detail-item">
                <label>사용자명</label>
                <span>{selectedSite.username}</span>
              </div>
              <div className="detail-item">
                <label>연결 ID</label>
                <span>{selectedSite.id}</span>
              </div>
              {selectedSite.local_sync_path && (
                <div className="detail-item">
                  <label>로컬 동기화 경로</label>
                  <span className="sync-path">{selectedSite.local_sync_path}</span>
                </div>
              )}
            </div>

            {/* Sync History */}
            {syncHistory.length > 0 && (
              <div className="sync-history-section">
                <h4>📋 동기화 기록</h4>
                <div className="sync-history-list">
                  {syncHistory.slice(0, 5).map((record) => (
                    <div key={record.id} className={`sync-record ${record.status}`}>
                      <div className="sync-record-header">
                        <span className="sync-status">
                          {getStatusIcon(record.status)} {getStatusText(record.status)}
                        </span>
                        <span className="sync-date">
                          {new Date(record.startedAt).toLocaleString('ko-KR')}
                        </span>
                      </div>
                      <div className="sync-record-details">
                        <span>파일: {record.syncedFiles}/{record.totalFiles}개</span>
                        {record.completedAt && (
                          <span>완료: {new Date(record.completedAt).toLocaleString('ko-KR')}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Scheduled Posts Modal */}
        {showScheduledPosts && selectedSite && (
          <ScheduledPosts
            site={selectedSite}
            onClose={() => setShowScheduledPosts(false)}
          />
        )}
      </div>
    </div>
  );
};

export default WordPressSitesList;
