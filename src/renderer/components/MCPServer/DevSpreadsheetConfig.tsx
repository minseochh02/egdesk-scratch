import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPlus, 
  faSync, 
  faSpinner, 
  faCheck,
  faExternalLinkAlt,
  faTimes,
  faExclamationTriangle,
  faDatabase
} from '@fortawesome/free-solid-svg-icons';
import MergeConflictModal from './MergeConflictModal';
import './DevSpreadsheet.css';

// Import types from preload
interface EGDeskDevFolderConfig {
  folderId: string;
  folderUrl: string;
  parentFolderId: string;
  createdAt: string;
}

interface EGDeskDevConfig {
  devSpreadsheetId: string;
  devSpreadsheetUrl: string;
  devSheetGid: string;
  publicSpreadsheetId: string;
  publicSheetGid: string;
  lastSyncedAt: string | null;
  syncDirection: 'public-to-dev' | 'dev-to-public' | 'bidirectional';
  createdAt: string;
  updatedAt: string;
}

interface SpreadsheetRow {
  name: string;
  description: string;
  url: string;
  scriptID: string;
  rowIndex: number;
}

interface MergeConflict {
  name: string;
  scriptID: string;
  field: string;
  publicValue: string;
  devValue: string;
  publicRow: SpreadsheetRow;
  devRow: SpreadsheetRow;
}

interface SchemaDiff {
  added: SpreadsheetRow[];
  removed: SpreadsheetRow[];
  modified: MergeConflict[];
  unchanged: SpreadsheetRow[];
}

interface DevSpreadsheetConfigProps {
  onConfigChange?: (config: EGDeskDevConfig | null) => void;
}

const DevSpreadsheetConfig: React.FC<DevSpreadsheetConfigProps> = ({
  onConfigChange
}) => {
  const [config, setConfig] = useState<EGDeskDevConfig | null>(null);
  const [folderConfig, setFolderConfig] = useState<EGDeskDevFolderConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [creating, setCreating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schemaDiff, setSchemaDiff] = useState<SchemaDiff | null>(null);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    errors: string[];
  } | null>(null);

  // Load configuration on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load both folder and spreadsheet config
      const [folderResult, configResult] = await Promise.all([
        window.electron.egdeskDev.getDevFolder(),
        window.electron.egdeskDev.getConfig()
      ]);
      
      if (folderResult.success) {
        setFolderConfig(folderResult.config || null);
      }
      
      if (configResult.success) {
        setConfig(configResult.config || null);
        onConfigChange?.(configResult.config || null);
      } else {
        setError(configResult.error || 'Failed to load configuration');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDevFolder = async () => {
    try {
      setCreatingFolder(true);
      setError(null);
      
      const result = await window.electron.egdeskDev.createDevFolder();
      
      if (result.success) {
        setFolderConfig({
          folderId: result.folderId!,
          folderUrl: result.folderUrl!,
          parentFolderId: result.parentFolderId!,
          createdAt: result.createdAt!
        });
        alert(`✅ Dev folder created!\n\nFolder URL: ${result.folderUrl}\n\nYou can now create dev spreadsheets inside this folder.`);
      } else {
        setError(result.error || 'Failed to create dev folder');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleCreateDevSpreadsheet = async () => {
    try {
      setCreating(true);
      setError(null);
      
      const result = await window.electron.egdeskDev.createDevSpreadsheet();
      
      if (result.success) {
        await loadConfig();
        alert(`✅ ${result.message}\n\nSpreadsheet URL: ${result.spreadsheetUrl}`);
      } else {
        setError(result.error || 'Failed to create dev spreadsheet');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setCreating(false);
    }
  };

  const handleClearConfig = async () => {
    if (!confirm('Are you sure you want to remove the dev spreadsheet configuration? This will not delete the actual spreadsheet.')) {
      return;
    }

    try {
      setError(null);
      const result = await window.electron.egdeskDev.clearConfig();
      
      if (result.success) {
        setConfig(null);
        onConfigChange?.(null);
        setSchemaDiff(null);
        setValidationResult(null);
      } else {
        setError(result.error || 'Failed to clear configuration');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleValidateSchema = async () => {
    try {
      setError(null);
      const result = await window.electron.egdeskDev.validateSchema();
      
      if (result.success) {
        setValidationResult({
          isValid: result.isValid || false,
          errors: result.errors || []
        });
        
        if (result.isValid) {
          alert('✅ Schema validation passed! Both spreadsheets have matching structure.');
        }
      } else {
        setError(result.error || 'Failed to validate schema');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleCompareSchemas = async () => {
    try {
      setComparing(true);
      setError(null);
      
      const result = await window.electron.egdeskDev.compareSchemas();
      
      if (result.success && result.diff) {
        setSchemaDiff(result.diff);
        
        // If there are conflicts, show the merge modal
        if (result.diff.modified.length > 0) {
          setShowMergeModal(true);
        } else {
          // Show summary
          const summary = `📊 Schema Comparison Results:
          
Added (in public, not in dev): ${result.diff.added.length}
Removed (in dev, not in public): ${result.diff.removed.length}
Modified: ${result.diff.modified.length}
Unchanged: ${result.diff.unchanged.length}

${result.diff.added.length === 0 && result.diff.removed.length === 0 && result.diff.modified.length === 0 
  ? '✅ Both spreadsheets are in sync!' 
  : '⚠️ Differences detected. Use sync controls to align them.'}`;
          
          alert(summary);
        }
      } else {
        setError(result.error || 'Failed to compare schemas');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setComparing(false);
    }
  };

  const handleSyncPublicToDev = async () => {
    if (!confirm('This will overwrite your dev spreadsheet with data from the public spreadsheet. A backup will be created first. Continue?')) {
      return;
    }

    try {
      setSyncing(true);
      setError(null);
      
      const result = await window.electron.egdeskDev.syncPublicToDev(true);
      
      if (result.success) {
        await loadConfig();
        alert(`✅ ${result.message}\n\n${result.backup ? `Backup created: ${result.backup.sheetName}` : ''}`);
      } else {
        setError(result.error || 'Failed to sync');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncDevToPublic = async () => {
    // Extra confirmation for publishing to public
    if (!confirm('⚠️ WARNING: This will overwrite the PUBLIC spreadsheet with your dev data.\n\nThis action affects the production server list that all users see.\n\nA backup will be created first. Are you absolutely sure?')) {
      return;
    }

    if (!confirm('🔴 FINAL CONFIRMATION: Publishing dev changes to production. Continue?')) {
      return;
    }

    try {
      setSyncing(true);
      setError(null);
      
      const result = await window.electron.egdeskDev.syncDevToPublic(true);
      
      if (result.success) {
        await loadConfig();
        alert(`✅ ${result.message}\n\n${result.backup ? `Backup created: ${result.backup.sheetName}` : 'Note: Could not create backup on public spreadsheet (may not have edit access).'}`);
      } else {
        setError(result.error || 'Failed to sync');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSyncing(false);
    }
  };

  const handleMergeResolution = async (resolvedRows: SpreadsheetRow[], target: 'public' | 'dev') => {
    try {
      setSyncing(true);
      setError(null);
      
      const result = await window.electron.egdeskDev.applyMergeResolution(target, resolvedRows);
      
      if (result.success) {
        await loadConfig();
        setSchemaDiff(null);
        setShowMergeModal(false);
        alert(`✅ ${result.message}`);
      } else {
        setError(result.error || 'Failed to apply merge resolution');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <div className="dev-spreadsheet-config">
        <div className="dev-spreadsheet-loading">
          <FontAwesomeIcon icon={faSpinner} spin />
          <span>Loading configuration...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="dev-spreadsheet-config">
      <div className="dev-spreadsheet-header">
        <div className="dev-spreadsheet-title">
          <FontAwesomeIcon icon={faDatabase} />
          <h3>Development Environment</h3>
        </div>
        <p className="dev-spreadsheet-description">
          Manage your dev spreadsheet for testing cloud MCP server configurations before publishing to production.
        </p>
      </div>

      {error && (
        <div className="dev-spreadsheet-error">
          <FontAwesomeIcon icon={faExclamationTriangle} />
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      )}

      {validationResult && !validationResult.isValid && (
        <div className="dev-spreadsheet-validation-errors">
          <h4>
            <FontAwesomeIcon icon={faExclamationTriangle} />
            Schema Validation Errors
          </h4>
          <ul>
            {validationResult.errors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Step 1: Dev Folder Section */}
      {!folderConfig ? (
        <div className="dev-folder-section">
          <div className="dev-folder-create">
            <div className="dev-folder-create-info">
              <h4>📂 Step 1: Create Dev Folder</h4>
              <p>First, create a Dev folder inside your EGDesk folder to store development spreadsheets.</p>
              <p className="folder-structure-preview">
                <code>📁 Google Drive / EGDesk / <strong>Dev</strong> / [your dev spreadsheets]</code>
              </p>
            </div>
            <button 
              className="dev-folder-create-button"
              onClick={handleCreateDevFolder}
              disabled={creatingFolder}
            >
              {creatingFolder ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin />
                  <span>Creating Folder...</span>
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faPlus} />
                  <span>Create Dev Folder</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="dev-folder-info">
          <div className="dev-folder-info-row">
            <span className="label">📂 Dev Folder:</span>
            <a 
              href={folderConfig.folderUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="dev-folder-link"
            >
              Open in Google Drive
              <FontAwesomeIcon icon={faExternalLinkAlt} />
            </a>
          </div>
        </div>
      )}

      {/* Step 2: Dev Spreadsheet Section (only show if folder exists) */}
      {folderConfig && !config ? (
        <div className="dev-spreadsheet-create">
          <div className="dev-spreadsheet-create-info">
            <h4>📊 Step 2: Create Dev Spreadsheet</h4>
            <p>Create a development spreadsheet to safely test changes before publishing to production.</p>
            <ul>
              <li>✓ Automatic backup before sync</li>
              <li>✓ Bidirectional sync with merge conflict resolution</li>
              <li>✓ Schema validation</li>
              <li>✓ Compare differences before syncing</li>
            </ul>
          </div>
          <button 
            className="dev-spreadsheet-create-button"
            onClick={handleCreateDevSpreadsheet}
            disabled={creating}
          >
            {creating ? (
              <>
                <FontAwesomeIcon icon={faSpinner} spin />
                <span>Creating...</span>
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faPlus} />
                <span>Create Dev Spreadsheet</span>
              </>
            )}
          </button>
        </div>
      ) : config ? (
        <div className="dev-spreadsheet-configured">
          <div className="dev-spreadsheet-info">
            <div className="dev-spreadsheet-info-row">
              <span className="label">Dev Spreadsheet:</span>
              <a 
                href={config.devSpreadsheetUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="dev-spreadsheet-link"
              >
                {config.devSpreadsheetId.substring(0, 20)}...
                <FontAwesomeIcon icon={faExternalLinkAlt} />
              </a>
            </div>
            <div className="dev-spreadsheet-info-row">
              <span className="label">Last Synced:</span>
              <span className="value">{formatDate(config.lastSyncedAt)}</span>
            </div>
            <div className="dev-spreadsheet-info-row">
              <span className="label">Created:</span>
              <span className="value">{formatDate(config.createdAt)}</span>
            </div>
          </div>



          <div className="dev-spreadsheet-actions">
            <button 
              className="dev-spreadsheet-refresh-button"
              onClick={loadConfig}
            >
              <FontAwesomeIcon icon={faSync} />
              <span>Refresh</span>
            </button>
            <button 
              className="dev-spreadsheet-remove-button"
              onClick={handleClearConfig}
            >
              <FontAwesomeIcon icon={faTimes} />
              <span>Remove Config</span>
            </button>
          </div>
        </div>
      ) : null}

      {/* Merge Conflict Modal */}
      {showMergeModal && schemaDiff && (
        <MergeConflictModal
          diff={schemaDiff}
          onResolve={handleMergeResolution}
          onCancel={() => setShowMergeModal(false)}
          syncing={syncing}
        />
      )}
    </div>
  );
};

export default DevSpreadsheetConfig;

