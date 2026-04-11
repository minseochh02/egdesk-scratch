import React, { useState } from 'react';
import { useSyncConfig } from '../../hooks/useSyncConfig';

interface SyncConfiguration {
  id: string;
  scriptName: string;
  folderName: string;
  duplicateAction?: 'skip' | 'update' | 'allow' | 'replace-date-range' | 'replace-all';
  fileAction: 'keep' | 'archive' | 'delete';
  enabled: boolean;
  autoSyncEnabled: boolean;
}

interface SyncConfigEditDialogProps {
  config: SyncConfiguration;
  onClose: () => void;
  onSave: () => void;
}

export const SyncConfigEditDialog: React.FC<SyncConfigEditDialogProps> = ({
  config,
  onClose,
  onSave,
}) => {
  const { updateConfiguration } = useSyncConfig();
  const [fileAction, setFileAction] = useState<'keep' | 'archive' | 'delete'>(config.fileAction);
  const [enabled, setEnabled] = useState(config.enabled);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(config.autoSyncEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const duplicateHandlingLabel = (() => {
    switch (config.duplicateAction) {
      case 'skip':
        return '⏭️ Skip duplicates';
      case 'update':
        return '🔄 Update duplicates';
      case 'allow':
        return '✅ Allow duplicates';
      case 'replace-date-range':
        return '📅 Replace date range';
      case 'replace-all':
        return '🧹 Replace all';
      default:
        return '⏭️ Skip duplicates';
    }
  })();

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      await updateConfiguration(config.id, {
        fileAction,
        enabled,
        autoSyncEnabled,
      });

      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="import-wizard">
      <div className="import-wizard-dialog" style={{ maxWidth: '500px' }}>
        <div className="import-wizard-header">
          <h2>✏️ Edit Sync Configuration</h2>
          <button className="btn-icon" onClick={onClose} disabled={saving}>
            ✕
          </button>
        </div>

        <div className="import-wizard-body">
          <div style={{ marginBottom: '20px', padding: '12px', background: '#e3f2fd', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 4px 0' }}>🤖 {config.scriptName}</h4>
            <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
              {config.folderName}
            </p>
          </div>

          {error && <div className="error-message" style={{ marginBottom: '16px' }}>{error}</div>}

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
              🔍 Duplicate Handling
            </label>
            <div style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
              background: '#f8f9fa',
              color: '#333',
            }}>
              {duplicateHandlingLabel}
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#666' }}>
              Configured during import setup. Edit this in the import wizard duplicate settings.
            </p>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
              📄 File Action After Import
            </label>
            <select
              value={fileAction}
              onChange={(e) => setFileAction(e.target.value as 'keep' | 'archive' | 'delete')}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
              }}
              disabled={saving}
            >
              <option value="keep">📁 Keep - Leave file in place</option>
              <option value="archive">🗂️ Archive - Move to processed folder</option>
              <option value="delete">🗑️ Delete - Remove file after import</option>
            </select>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#666' }}>
              What to do with the Excel file after successfully importing it
            </p>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                disabled={saving}
              />
              <span style={{ fontSize: '14px', fontWeight: 500 }}>
                ✅ Configuration Enabled
              </span>
            </label>
            <p style={{ margin: '4px 0 0 28px', fontSize: '12px', color: '#666' }}>
              Enable or disable this sync configuration
            </p>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={autoSyncEnabled}
                onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                disabled={saving || !enabled}
              />
              <span style={{ fontSize: '14px', fontWeight: 500 }}>
                🔄 Auto-Sync Enabled {!enabled && '(requires configuration enabled)'}
              </span>
            </label>
            <p style={{ margin: '4px 0 0 28px', fontSize: '12px', color: '#666' }}>
              Automatically import new files when they appear in the folder
            </p>
          </div>
        </div>

        <div className="import-wizard-footer">
          <button
            className="btn btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '⏳ Saving...' : '💾 Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};
