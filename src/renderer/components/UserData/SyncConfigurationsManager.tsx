import React, { useState, useEffect } from 'react';
import { useSyncConfig } from '../../hooks/useSyncConfig';
import { UserTable } from '../../hooks/useUserData';
import { SyncConfigEditDialog } from './SyncConfigEditDialog';

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
  const [editingConfig, setEditingConfig] = useState<SyncConfiguration | null>(null);
  const [watcherStatus, setWatcherStatus] = useState<Array<{ configId: string; processedFilesCount: number }>>([]);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

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

  const handleExportAll = async () => {
    try {
      setExporting(true);

      const result = await (window as any).electron.invoke('sync-config:export-all');

      if (result.success) {
        alert(
          `Export successful!\n\n` +
          `Configurations: ${result.data.configCount}\n\n` +
          `Location: ${result.data.filePath}`
        );
      } else {
        alert(`Export failed: ${result.error}`);
      }
    } catch (err) {
      console.error('Error exporting configurations:', err);
      alert(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    try {
      setImporting(true);

      const result = await (window as any).electron.invoke('sync-config:import');

      if (result.success) {
        const { imported, skipped, errors } = result.data;

        let message = `Import complete!\n\nImported: ${imported}\nSkipped: ${skipped}`;

        if (errors && errors.length > 0) {
          message += '\n\nNotes:\n' + errors.slice(0, 5).join('\n');
          if (errors.length > 5) {
            message += `\n...and ${errors.length - 5} more (see console for details)`;
            console.log('All import errors:', errors);
          }
        }

        alert(message);
        await fetchConfigurations();
      } else {
        if (result.error !== 'Import canceled') {
          alert(`Import failed: ${result.error}`);
        }
      }
    } catch (err) {
      console.error('Error importing configurations:', err);
      alert(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setImporting(false);
    }
  };

  if (loading && configurations.length === 0) {
    return (
      <div className="import-wizard">
        <div className="import-wizard-dialog">
          <div className="import-wizard-header">
            <h2>⚙️ Sync Configurations</h2>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                className="btn btn-sm btn-secondary"
                onClick={handleImport}
                disabled={importing}
                title="Import sync configurations"
              >
                {importing ? '⏳ Importing...' : '📥 Import'}
              </button>
              <button
                className="btn btn-sm btn-secondary"
                onClick={handleExportAll}
                disabled={true}
                title="Export all sync configurations"
              >
                📤 Export All
              </button>
              <button className="btn-icon" onClick={onClose}>
                ✕
              </button>
            </div>
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
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              className="btn btn-sm btn-secondary"
              onClick={handleImport}
              disabled={importing}
              title="Import sync configurations"
            >
              {importing ? '⏳ Importing...' : '📥 Import'}
            </button>
            <button
              className="btn btn-sm btn-secondary"
              onClick={handleExportAll}
              disabled={exporting || configurations.length === 0}
              title="Export all sync configurations"
            >
              {exporting ? '⏳ Exporting...' : '📤 Export All'}
            </button>
            <button className="btn-icon" onClick={onClose}>
              ✕
            </button>
          </div>
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
                          Headers: Row {config.headerRow}
                          {config.skipBottomRows > 0 && (
                            <span style={{ color: '#f57c00', marginLeft: '8px' }}>
                              | Skip: Last {config.skipBottomRows} row{config.skipBottomRows > 1 ? 's' : ''}
                            </span>
                          )}
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
                          <button
                            className="btn btn-sm btn-secondary"
                            style={{ marginLeft: '8px', padding: '2px 8px', fontSize: '11px' }}
                            onClick={() => setSelectedConfig(selectedConfig?.id === config.id ? null : config)}
                          >
                            {selectedConfig?.id === config.id ? 'Hide' : 'View'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {selectedConfig?.id === config.id && (
                      <div style={{ marginTop: '16px', padding: '12px', background: '#f8f9fa', borderRadius: '6px', fontSize: '12px' }}>
                        <strong style={{ display: 'block', marginBottom: '8px', color: '#1976d2' }}>📋 Column Mappings:</strong>
                        <div style={{ maxHeight: '200px', overflow: 'auto' }}>
                          <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ borderBottom: '2px solid #ddd' }}>
                                <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 600 }}>Excel Column</th>
                                <th style={{ padding: '4px 8px', textAlign: 'center' }}>→</th>
                                <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 600 }}>Table Column</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(config.columnMappings).map(([excelCol, tableCol]) => (
                                <tr key={excelCol} style={{ borderBottom: '1px solid #eee' }}>
                                  <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>{excelCol}</td>
                                  <td style={{ padding: '4px 8px', textAlign: 'center', color: '#999' }}>→</td>
                                  <td style={{ padding: '4px 8px', fontFamily: 'monospace', color: '#1976d2' }}>{tableCol}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

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
                      className="btn btn-sm btn-primary"
                      onClick={() => setEditingConfig(config)}
                    >
                      ✏️ Edit
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

      {editingConfig && (
        <SyncConfigEditDialog
          config={editingConfig}
          onClose={() => setEditingConfig(null)}
          onSave={() => {
            fetchConfigurations();
            loadWatcherStatus();
          }}
        />
      )}
    </div>
  );
};
