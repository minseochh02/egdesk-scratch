/**
 * Backup Manager Component
 * UI for managing conversation-based backups and reversion
 */

import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faHistory, 
  faTrash, 
  faUndo, 
  faInfoCircle, 
  faTimes,
  faExclamationTriangle,
  faCheckCircle,
  faFolder,
  faFile,
  faSpinner
} from '../../utils/fontAwesomeIcons';
import { BackupService, BackupInfo, BackupStats, RevertResult, RevertSummary } from '../../services/backup-service';
import './BackupManager.css';

interface BackupManagerProps {
  isVisible: boolean;
  onClose: () => void;
  onBackupReverted?: () => void;
}

export const BackupManager: React.FC<BackupManagerProps> = ({ 
  isVisible, 
  onClose, 
  onBackupReverted 
}) => {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [reverting, setReverting] = useState<string | null>(null);
  const [selectedBackup, setSelectedBackup] = useState<BackupInfo | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [revertMode, setRevertMode] = useState<'single' | 'chronological'>('single');
  const [revertResult, setRevertResult] = useState<RevertResult | RevertSummary | null>(null);

  useEffect(() => {
    if (isVisible) {
      loadData();
    }
  }, [isVisible]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [backupsData, statsData] = await Promise.all([
        BackupService.getAvailableBackups(),
        BackupService.getBackupStats()
      ]);
      setBackups(backupsData);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load backup data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRevertSingle = async (backup: BackupInfo) => {
    setSelectedBackup(backup);
    setRevertMode('single');
    setShowConfirmDialog(true);
  };

  const handleRevertToConversation = async (backup: BackupInfo) => {
    setSelectedBackup(backup);
    setRevertMode('chronological');
    setShowConfirmDialog(true);
  };

  const confirmRevert = async () => {
    if (!selectedBackup) return;

    setReverting(selectedBackup.conversationId);
    setShowConfirmDialog(false);

    try {
      let result;
      if (revertMode === 'single') {
        result = await BackupService.revertConversation(selectedBackup.conversationId);
      } else {
        result = await BackupService.revertToConversation(selectedBackup.conversationId);
      }

      setRevertResult(result);
      
      if (result?.success) {
        await loadData(); // Reload data after successful revert
        onBackupReverted?.();
      }
    } catch (error) {
      console.error('Failed to revert:', error);
    } finally {
      setReverting(null);
      setSelectedBackup(null);
    }
  };

  const handleCleanupOld = async () => {
    setLoading(true);
    try {
      const result = await BackupService.cleanupOldBackups(5); // Keep only 5 most recent
      if (result) {
        console.log(`Cleaned up ${result.cleaned} old backups`);
        await loadData(); // Reload data after cleanup
      }
    } catch (error) {
      console.error('Failed to cleanup old backups:', error);
    } finally {
      setLoading(false);
    }
  };

  const getConversationsToRevert = (targetBackup: BackupInfo): BackupInfo[] => {
    const targetIndex = backups.findIndex(b => b.conversationId === targetBackup.conversationId);
    return backups.slice(0, targetIndex + 1);
  };

  if (!isVisible) return null;

  return (
    <div className="backup-manager-overlay">
      <div className="backup-manager">
        <div className="backup-manager-header">
          <h3>
            <FontAwesomeIcon icon={faHistory} className="header-icon" />
            Backup Manager
          </h3>
          <button className="close-btn" onClick={onClose}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* Statistics */}
        {stats && (
          <div className="backup-stats">
            <div className="stat-item">
              <FontAwesomeIcon icon={faFolder} />
              <span>{stats.totalBackups} Backups</span>
            </div>
            <div className="stat-item">
              <FontAwesomeIcon icon={faFile} />
              <span>{stats.totalFiles} Files</span>
            </div>
            <div className="stat-item">
              <FontAwesomeIcon icon={faInfoCircle} />
              <span>{BackupService.formatFileSize(stats.totalSizeBytes)}</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="backup-actions">
          <button 
            className="action-btn refresh-btn"
            onClick={loadData}
            disabled={loading}
          >
            {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faHistory} />}
            Refresh
          </button>
          <button 
            className="action-btn cleanup-btn"
            onClick={handleCleanupOld}
            disabled={loading || backups.length <= 5}
          >
            <FontAwesomeIcon icon={faTrash} />
            Cleanup Old
          </button>
        </div>

        {/* Backup List */}
        <div className="backup-list">
          {loading && backups.length === 0 ? (
            <div className="loading-state">
              <FontAwesomeIcon icon={faSpinner} spin />
              <span>Loading backups...</span>
            </div>
          ) : backups.length === 0 ? (
            <div className="empty-state">
              <FontAwesomeIcon icon={faInfoCircle} />
              <span>No backups found</span>
            </div>
          ) : (
            backups.map((backup, index) => (
              <div key={backup.conversationId} className="backup-item">
                <div className="backup-info">
                  <div className="backup-id">
                    <FontAwesomeIcon icon={faFolder} />
                    <span>Conversation {backup.conversationId.substring(0, 8)}...</span>
                  </div>
                  <div className="backup-meta">
                    <span className="backup-time">
                      {BackupService.formatRelativeTime(backup.timestamp)}
                    </span>
                    <span className="backup-files">
                      {backup.files.length} file{backup.files.length === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>

                <div className="backup-actions-item">
                  <button
                    className="action-btn revert-single-btn"
                    onClick={() => handleRevertSingle(backup)}
                    disabled={reverting !== null}
                    title="Revert only this conversation"
                  >
                    {reverting === backup.conversationId ? (
                      <FontAwesomeIcon icon={faSpinner} spin />
                    ) : (
                      <FontAwesomeIcon icon={faUndo} />
                    )}
                    Revert This
                  </button>

                  {index < backups.length - 1 && (
                    <button
                      className="action-btn revert-to-btn"
                      onClick={() => handleRevertToConversation(backup)}
                      disabled={reverting !== null}
                      title="Revert to this conversation (will revert all newer conversations)"
                    >
                      <FontAwesomeIcon icon={faHistory} />
                      Revert To
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Confirmation Dialog */}
        {showConfirmDialog && selectedBackup && (
          <div className="confirm-dialog-overlay">
            <div className="confirm-dialog">
              <div className="confirm-header">
                <FontAwesomeIcon icon={faExclamationTriangle} className="warning-icon" />
                <h4>Confirm Revert</h4>
              </div>

              <div className="confirm-content">
                {revertMode === 'single' ? (
                  <div>
                    <p>Are you sure you want to revert conversation <strong>{selectedBackup.conversationId.substring(0, 8)}...</strong>?</p>
                    <p>This will:</p>
                    <ul>
                      <li>Restore {selectedBackup.files.filter(f => !f.isNewFile).length} modified files</li>
                      <li>Delete {selectedBackup.files.filter(f => f.isNewFile).length} created files</li>
                    </ul>
                  </div>
                ) : (
                  <div>
                    <p>Are you sure you want to revert to conversation <strong>{selectedBackup.conversationId.substring(0, 8)}...</strong>?</p>
                    <p>This will revert <strong>{getConversationsToRevert(selectedBackup).length} conversations</strong> in chronological order:</p>
                    <ul className="conversations-to-revert">
                      {getConversationsToRevert(selectedBackup).map(backup => (
                        <li key={backup.conversationId}>
                          {backup.conversationId.substring(0, 8)}... ({backup.files.length} files)
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="warning-text">
                  <FontAwesomeIcon icon={faExclamationTriangle} />
                  This action cannot be undone!
                </p>
              </div>

              <div className="confirm-actions">
                <button 
                  className="action-btn cancel-btn"
                  onClick={() => setShowConfirmDialog(false)}
                >
                  Cancel
                </button>
                <button 
                  className="action-btn confirm-btn"
                  onClick={confirmRevert}
                >
                  <FontAwesomeIcon icon={faUndo} />
                  {revertMode === 'single' ? 'Revert Conversation' : 'Revert To Conversation'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Result Dialog */}
        {revertResult && (
          <div className="result-dialog-overlay">
            <div className="result-dialog">
              <div className="result-header">
                <FontAwesomeIcon 
                  icon={revertResult.success ? faCheckCircle : faExclamationTriangle} 
                  className={revertResult.success ? 'success-icon' : 'error-icon'}
                />
                <h4>{revertResult.success ? 'Revert Successful' : 'Revert Failed'}</h4>
              </div>

              <div className="result-content">
                {'conversationsReverted' in revertResult ? (
                  // RevertSummary
                  <div>
                    <p>Reverted {revertResult.conversationsReverted.length} conversations</p>
                    <p>Total files restored: {revertResult.totalFilesReverted}</p>
                    <p>Total files deleted: {revertResult.totalFilesDeleted}</p>
                    {revertResult.errors.length > 0 && (
                      <div className="errors">
                        <h5>Errors:</h5>
                        <ul>
                          {revertResult.errors.map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  // RevertResult
                  <div>
                    <p>Files restored: {revertResult.filesReverted.length}</p>
                    <p>Files deleted: {revertResult.filesDeleted.length}</p>
                    {revertResult.errors.length > 0 && (
                      <div className="errors">
                        <h5>Errors:</h5>
                        <ul>
                          {revertResult.errors.map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="result-actions">
                <button 
                  className="action-btn close-btn"
                  onClick={() => setRevertResult(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
