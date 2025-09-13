import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faRobot,
  faPlus,
  faCheck,
  faFlask,
  faTrash,
  faTimes,
  faClock,
  faKey,
  faBuilding,
  faEdit,
  faExclamationTriangle,
  faPlay,
  faPause,
  faSearch,
  faCloud,
  faCog,
} from '../../utils/fontAwesomeIcons';
import { AIKey, AIProvider } from './types';
import { aiKeysStore } from './store/aiKeysStore';
import { AddEditKeyDialog } from './AddEditKeyDialog';
import { TestResult } from './services/apiTester';
import './AIKeysManager.css';

// Helper function to get FontAwesome icon from provider icon name
const getProviderIcon = (iconName: string) => {
  const iconMap: Record<string, any> = {
    faRobot,
    faSearch,
    faCloud,
    faCog,
  };
  return iconMap[iconName] || faRobot;
};

export const AIKeysManager: React.FC = () => {
  const [state, setState] = useState(aiKeysStore.getState());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingKey, setEditingKey] = useState<AIKey | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
    null,
  );
  const [testResults, setTestResults] = useState<Record<string, TestResult>>(
    {},
  );
  const [testingKeyId, setTestingKeyId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = aiKeysStore.subscribe(setState);
    return unsubscribe;
  }, []);

  const handleAddKey = async (keyData: any) => {
    try {
      await aiKeysStore.addKey(keyData);
    } catch (error) {
      console.error('Failed to add key:', error);
      throw error;
    }
  };

  const handleEditKey = async (keyData: any) => {
    if (!editingKey) return;

    try {
      await aiKeysStore.updateKey(editingKey.id, keyData);
      setEditingKey(null);
    } catch (error) {
      console.error('Failed to update key:', error);
      throw error;
    }
  };

  const handleDeleteKey = async (id: string) => {
    try {
      await aiKeysStore.deleteKey(id);
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete key:', error);
    }
  };

  const handleToggleActive = async (id: string) => {
    try {
      await aiKeysStore.toggleKeyActive(id);
    } catch (error) {
      console.error('Failed to toggle key status:', error);
    }
  };

  const handleTestKey = async (id: string) => {
    try {
      setTestingKeyId(id);
      const testResult = await aiKeysStore.testKey(id);

      setTestResults((prev) => ({
        ...prev,
        [id]: testResult,
      }));

      // Clear test result after 5 seconds
      setTimeout(() => {
        setTestResults((prev) => {
          const newResults = { ...prev };
          delete newResults[id];
          return newResults;
        });
      }, 5000);
    } catch (error) {
      console.error('Failed to test key:', error);
      setTestResults((prev) => ({
        ...prev,
        [id]: {
          success: false,
          message:
            error instanceof Error ? error.message : 'Failed to test key',
        },
      }));
    } finally {
      setTestingKeyId(null);
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getProviderInfo = (providerId: string): AIProvider | undefined => {
    return state.providers.find((p) => p.id === providerId);
  };

  const getActiveKeysCount = () => {
    return state.keys.filter((key) => key.isActive).length;
  };

  const getKeysByProvider = (providerId: string) => {
    return state.keys.filter((key) => key.providerId === providerId);
  };

  if (state.isLoading && state.keys.length === 0) {
    return (
      <div className="ai-keys-manager">
        <div className="loading-container">
          <div className="spinner" />
          <p>AI 키를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-keys-manager">
      {/* Header */}
      <div className="manager-header">
        <div className="header-main">
          <div className="header-title-section">
            <div className="title-icon-wrapper">
              <FontAwesomeIcon icon={faRobot} className="header-icon" />
            </div>
            <div className="title-content">
              <h1>API 키 관리</h1>
              <p>AI 서비스 API 키와 설정을 관리하세요</p>
            </div>
          </div>
          <div className="header-stats">
            <div className="header-stat">
              <span className="stat-number">{state.keys.length}</span>
              <span className="stat-label">전체 키</span>
            </div>
            <div className="header-stat">
              <span className="stat-number">{getActiveKeysCount()}</span>
              <span className="stat-label">활성</span>
            </div>
            <div className="header-stat">
              <span className="stat-number">{new Set(state.keys.map((k) => k.providerId)).size}</span>
              <span className="stat-label">제공업체</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="action-bar">
        <button
          className="add-key-btn"
          onClick={() => setShowAddDialog(true)}
        >
          <FontAwesomeIcon icon={faPlus} className="btn-icon" />
          <span>새 API 키 추가</span>
        </button>
      </div>


      {/* Error Display */}
      {state.error && (
        <div className="error-banner">
          <span>
            <FontAwesomeIcon icon={faExclamationTriangle} className="ai-keys-manager-icon" /> {state.error}
          </span>
          <button onClick={() => aiKeysStore.clearError()}>
            <FontAwesomeIcon icon={faTimes} className="ai-keys-manager-icon" />
          </button>
        </div>
      )}

      {/* Keys List */}
      <div className="keys-container">
        {state.keys.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <FontAwesomeIcon icon={faKey} className="ai-keys-manager-icon" />
            </div>
            <h3>AI 키가 없습니다</h3>
            <p>첫 번째 AI 서비스 API 키를 추가하여 시작하세요</p>
            <button
              className="add-first-key-btn"
              onClick={() => setShowAddDialog(true)}
            >
              <FontAwesomeIcon icon={faPlus} className="ai-keys-manager-icon" /> 키 추가
            </button>
          </div>
        ) : (
          <div className="keys-list">
            {state.keys.map((key) => {
              const provider = getProviderInfo(key.providerId);
              return (
                <div key={key.id}>
                  <div
                    className={`key-card ${key.isActive ? 'active' : 'inactive'} ${
                      state.selectedKeyId === key.id ? 'selected' : ''
                    }`}
                    onClick={() => aiKeysStore.setSelectedKey(key.id)}
                  >
                    <div className="key-header">
                      <div className="key-provider">
                        <span
                          className="provider-icon"
                          style={{ color: provider?.color }}
                        >
                          <FontAwesomeIcon 
                            icon={getProviderIcon(provider?.icon || 'faRobot')} 
                            className="provider-fa-icon" 
                          />
                        </span>
                        <span className="provider-name">{provider?.name}</span>
                      </div>
                      <div className="key-status">
                        <span
                          className={`status-badge ${key.isActive ? 'active' : 'inactive'}`}
                        >
                          {key.isActive ? '활성' : '비활성'}
                        </span>
                      </div>
                    </div>

                    <div className="key-content">
                      <h3 className="key-name">{key.name}</h3>
                      <div className="key-meta">
                        <span className="meta-item">
                          <span className="meta-label">생성:</span>
                          {formatDate(key.createdAt)}
                        </span>
                        {key.lastUsed && (
                          <span className="meta-item">
                            <span className="meta-label">사용:</span>
                            {formatDate(key.lastUsed)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="key-actions">
                      <button
                        className={`ai-keys-action-btn test-btn ${testingKeyId === key.id ? 'testing' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTestKey(key.id);
                        }}
                        title="연결 테스트"
                        disabled={testingKeyId === key.id}
                      >
                        {testingKeyId === key.id ? (
                          <FontAwesomeIcon icon={faClock} className="ai-keys-manager-icon" />
                        ) : (
                          <FontAwesomeIcon icon={faFlask} className="ai-keys-manager-icon" />
                        )}
                        {testingKeyId === key.id ? '테스트 중...' : '테스트'}
                      </button>
                      <button
                        className="ai-keys-action-btn edit-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingKey(key);
                        }}
                        title="키 편집"
                      >
                        <FontAwesomeIcon icon={faEdit} className="ai-keys-manager-icon" />
                      </button>
                      <button
                        className={`ai-keys-action-btn toggle-btn ${key.isActive ? 'deactivate' : 'activate'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleActive(key.id);
                        }}
                        title={key.isActive ? '비활성화' : '활성화'}
                      >
                        <FontAwesomeIcon 
                          icon={key.isActive ? faPause : faPlay} 
                          className="ai-keys-manager-icon" 
                        />
                      </button>
                      <button
                        className="ai-keys-action-btn delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteConfirm(key.id);
                        }}
                        title="키 삭제"
                      >
                        <FontAwesomeIcon icon={faTrash} className="ai-keys-manager-icon" />
                      </button>
                    </div>
                  </div>

                  {/* Test Result Display */}
                  {testResults[key.id] && (
                    <div
                      className={`test-result ${testResults[key.id].success ? 'success' : 'error'}`}
                    >
                      <div className="test-result-header">
                        <span className="test-result-icon">
                          {testResults[key.id].success ? (
                            <FontAwesomeIcon icon={faCheck} className="ai-keys-manager-icon" />
                          ) : (
                            <FontAwesomeIcon icon={faTimes} className="ai-keys-manager-icon" />
                          )}
                        </span>
                        <span className="test-result-message">
                          {testResults[key.id].message}
                        </span>
                        <button
                          className="test-result-close"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTestResults((prev) => {
                              const newResults = { ...prev };
                              delete newResults[key.id];
                              return newResults;
                            });
                          }}
                        >
                          <FontAwesomeIcon icon={faTimes} className="ai-keys-manager-icon" />
                        </button>
                      </div>
                      {testResults[key.id].details && (
                        <div className="test-result-details">
                          <pre>
                            {JSON.stringify(
                              testResults[key.id].details,
                              null,
                              2,
                            )}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>


      {/* Add/Edit Dialog */}
      {showAddDialog && (
        <AddEditKeyDialog
          onSave={handleAddKey}
          onClose={() => setShowAddDialog(false)}
          providers={state.providers}
        />
      )}

      {editingKey && (
        <AddEditKeyDialog
          onSave={handleEditKey}
          onClose={() => setEditingKey(null)}
          initialKey={editingKey}
          providers={state.providers}
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="delete-confirm-dialog">
          <div
            className="dialog-overlay"
            onClick={() => setShowDeleteConfirm(null)}
          />
          <div className="dialog-content">
            <div className="dialog-header">
              <h3>
                <FontAwesomeIcon icon={faTrash} className="ai-keys-manager-icon" /> AI 키 삭제
              </h3>
            </div>
            <div className="dialog-body">
              <p>
                이 AI 키를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
              </p>
              <p className="warning-text">
                <strong>경고:</strong> 이 키를 삭제하면 관련된 모든 설정이 제거됩니다.
              </p>
            </div>
            <div className="dialog-footer">
              <button
                className="button-secondary"
                onClick={() => setShowDeleteConfirm(null)}
              >
                취소
              </button>
              <button
                className="button-danger"
                onClick={() => handleDeleteKey(showDeleteConfirm)}
              >
                키 삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
