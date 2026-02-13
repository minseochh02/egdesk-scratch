import React, { useState, useEffect } from 'react';
import { useSyncConfig } from '../../hooks/useSyncConfig';
import { UserTable } from '../../hooks/useUserData';

interface SyncConfiguration {
  id: string;
  scriptFolderPath: string;
  scriptName: string;
  folderName: string;
  targetTableId: string;
  headerRow: number;
  skipBottomRows: number;
  sheetIndex: number;
  columnMappings: Record<string, string>;
  fileAction: 'keep' | 'archive' | 'delete';
  enabled: boolean;
  autoSyncEnabled: boolean;
  lastSyncAt?: string;
  lastSyncStatus?: string;
  lastSyncRowsImported: number;
  lastSyncRowsSkipped: number;
  lastSyncError?: string;
  createdAt: string;
  updatedAt: string;
}

interface SyncConfigurationsManagerProps {
  userTables: UserTable[];
  onClose: () => void;
}

export const SyncConfigurationsManager: React.FC<SyncConfigurationsManagerProps> = ({
  userTables,
  onClose,
}) => {
  const { configurations, loading, error, fetchConfigurations, deleteConfiguration, updateConfiguration } = useSyncConfig();
  const [selectedConfig, setSelectedConfig] = useState<SyncConfiguration | null>(null);
  const [watcherStatus, setWatcherStatus] = useState<Array<{ configId: string; processedFilesCount: number }>>([]);

  useEffect(() => {
    fetchConfigurations();
    loadWatcherStatus();

    // Refresh watcher status every 5 seconds
    const interval = setInterval(loadWatcherStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchConfigurations]);

  const loadWatcherStatus = async () => {
    try {
      const result = await (window as any).electron.debug.fileWatcher.getStatus();
      if (result.success) {
        setWatcherStatus(result.data);
      }
    } catch (err) {
      console.warn('Failed to load watcher status:', err);
    }
  };

  const handleToggleEnabled = async (configId: string, currentEnabled: boolean) => {
    try {
      await updateConfiguration(configId, { enabled: !currentEnabled });
      await fetchConfigurations();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to toggle configuration');
    }
  };

  const handleToggleAutoSync = async (configId: string, currentAutoSync: boolean) => {
    try {
      await updateConfiguration(configId, { autoSyncEnabled: !currentAutoSync });
      await fetchConfigurations();
      await loadWatcherStatus();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to toggle auto-sync');
    }
  };

  const isWatcherActive = (configId: string): boolean => {
    return watcherStatus.some((w) => w.configId === configId);
  };

  const getProcessedFilesCount = (configId: string): number => {
    const watcher = watcherStatus.find((w) => w.configId === configId);
    return watcher ? watcher.processedFilesCount : 0;
  };

  const handleDelete = async (configId: string, scriptName: string) => {
    if (!confirm(`Delete sync configuration for "${scriptName}"?\n\nThis will not delete the SQL table or downloaded files.`)) {
      return;
    }

    try {
      await deleteConfiguration(configId);
      await fetchConfigurations();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete configuration');
    }
  };

  const getTableName = (tableId: string): string => {
    const table = userTables.find((t) => t.id === tableId);
    return table ? table.displayName : 'Unknown Table';
  };

  const formatRelativeTime = (dateStr?: string): string => {
    if (!dateStr) return 'Never';

    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const getStatusIcon = (status?: string): string => {
    if (!status || status === 'never') return '⚪';
    if (status === 'success') return '✅';
    if (status === 'failed') return '❌';
    if (status === 'partial') return '⚠️';
    return '❓';
  };

  if (loading && configurations.length === 0) {
    return (
      <div className="import-wizard">
        <div className="import-wizard-dialog">
          <div className="import-wizard-header">
            <h2>⚙️ Sync Configurations</h2>
            <button className="btn-icon" onClick={onClose}>
              ✕
            </button>
          </div>
          <div className="import-wizard-body">
            <div className="progress-section">
              <div className="progress-spinner"></div>
              <p className="progress-message">Loading configurations...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="import-wizard">
      <div className="import-wizard-dialog" style={{ maxWidth: '1000px' }}>
        <div className="import-wizard-header">
          <h2>⚙️ Sync Configurations</h2>
          <button className="btn-icon" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="import-wizard-body">
          {error && <div className="error-message">{error}</div>}

          {configurations.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">⚙️</div>
              <h3 className="empty-state-title">No Sync Configurations Yet</h3>
              <p className="empty-state-message">
                Import an Excel file using "Sync Browser Downloads" and enable "Remember this configuration"
                to create your first auto-sync setup.
              </p>
            </div>
          ) : (
            <div className="sync-configs-list">
              {configurations.map((config) => (
                <div key={config.id} className="sync-config-card">
                  <div className="sync-config-header">
                    <div className="sync-config-title-row">
                      <div className="sync-config-icon">🤖</div>
                      <div className="sync-config-title-info">
                        <h4 className="sync-config-name">{config.scriptName}</h4>
                        <div className="sync-config-folder">{config.folderName}</div>
                      </div>
                      <div className="sync-config-actions">
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={config.enabled}
                            onChange={() => handleToggleEnabled(config.id, config.enabled)}
                          />
                          <span className="toggle-slider"></span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="sync-config-body">
                    <div className="sync-config-info-grid">
                      <div className="sync-config-info-item">
                        <div className="sync-config-info-label">Target Table</div>
                        <div className="sync-config-info-value">📊 {getTableName(config.targetTableId)}</div>
                      </div>

                      <div className="sync-config-info-item">
                        <div className="sync-config-info-label">Parsing</div>
                        <div className="sync-config-info-value">
                          Row {config.headerRow} → Skip {config.skipBottomRows}
                        </div>
                      </div>

                      <div className="sync-config-info-item">
                        <div className="sync-config-info-label">File Action</div>
                        <div className="sync-config-info-value">
                          {config.fileAction === 'archive' && '🗂️ Archive'}
                          {config.fileAction === 'delete' && '🗑️ Delete'}
                          {config.fileAction === 'keep' && '📁 Keep'}
                        </div>
                      </div>

                      <div className="sync-config-info-item">
                        <div className="sync-config-info-label">Columns Mapped</div>
                        <div className="sync-config-info-value">
                          {Object.keys(config.columnMappings).length} columns
                        </div>
                      </div>
                    </div>

                    <div className="sync-config-status">
                      <div className="sync-config-status-row">
                        <div>
                          <strong>Last Sync:</strong> {formatRelativeTime(config.lastSyncAt)}
                        </div>
                        <div>
                          {getStatusIcon(config.lastSyncStatus)} {config.lastSyncStatus || 'Never'}
                        </div>
                      </div>
                      {config.lastSyncAt && (
                        <div className="sync-config-stats">
                          <span>✅ {config.lastSyncRowsImported} imported</span>
                          {config.lastSyncRowsSkipped > 0 && (
                            <span>⚠️ {config.lastSyncRowsSkipped} skipped</span>
                          )}
                        </div>
                      )}
                      {config.lastSyncError && (
                        <div className="sync-config-error">
                          ❌ {config.lastSyncError}
                        </div>
                      )}
                    </div>

                    <div className="sync-config-auto-sync">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={config.autoSyncEnabled}
                          onChange={() => handleToggleAutoSync(config.id, config.autoSyncEnabled)}
                          disabled={!config.enabled}
                        />
                        <span style={{ fontSize: '14px', fontWeight: 500 }}>
                          🔄 Auto-Sync Enabled {!config.enabled && '(disabled)'}
                        </span>
                      </label>
                      {config.autoSyncEnabled && (
                        <div style={{ fontSize: '12px', color: '#666', marginLeft: '28px', marginTop: '4px' }}>
                          {isWatcherActive(config.id) ? (
                            <>
                              <span style={{ color: '#4CAF50', fontWeight: 500 }}>● Active</span> - Watching for new files
                              {getProcessedFilesCount(config.id) > 0 && (
                                <span> ({getProcessedFilesCount(config.id)} files seen)</span>
                              )}
                            </>
                          ) : (
                            <span style={{ color: '#FF9800' }}>⚪ Not watching (will start when enabled)</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="sync-config-footer">
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => setSelectedConfig(config)}
                    >
                      📋 View Details
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(config.id, config.scriptName)}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="import-wizard-footer">
          <div style={{ fontSize: '13px', color: '#666' }}>
            {configurations.length} configuration{configurations.length !== 1 ? 's' : ''} · {' '}
            <span style={{ color: '#4CAF50', fontWeight: 500 }}>
              {watcherStatus.length} active watcher{watcherStatus.length !== 1 ? 's' : ''}
            </span>
          </div>
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
