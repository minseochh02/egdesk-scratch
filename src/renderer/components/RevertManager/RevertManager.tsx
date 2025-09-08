import React, { useState, useEffect, useCallback } from 'react';
import {
  revertService,
  BackupFile,
  RevertResult,
} from '../../services/revertService';
import './RevertManager.css';

interface RevertManagerProps {
  projectRoot?: string;
  onRevertComplete?: (result: RevertResult) => void;
  onClose?: () => void;
}

interface BackupGroup {
  originalFilePath: string;
  backups: BackupFile[];
  selected?: BackupFile;
}

const RevertManager: React.FC<RevertManagerProps> = ({
  projectRoot,
  onRevertComplete,
  onClose,
}) => {
  const [backupGroups, setBackupGroups] = useState<BackupGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBackups, setSelectedBackups] = useState<Set<string>>(
    new Set(),
  );
  const [previewData, setPreviewData] = useState<{
    originalFile: string;
    backupFile: string;
    currentContent: string;
    backupContent: string;
    diff?: { added: number; removed: number; modified: number };
  } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [loadingAbortController, setLoadingAbortController] =
    useState<AbortController | null>(null);

  // Load all backups on component mount
  useEffect(() => {
    if (projectRoot) {
      loadBackups();
    }
  }, [projectRoot]);

  const loadBackups = useCallback(async () => {
    if (!projectRoot) return;

    console.log(`🔄 Loading backups from project root: ${projectRoot}`);
    setLoading(true);
    setError(null);

    // Create abort controller for this loading operation
    const abortController = new AbortController();
    setLoadingAbortController(abortController);

    try {
      // Add a timeout for the entire operation
      const loadPromise = revertService.findAllBackups(projectRoot);
      const timeoutPromise = new Promise<Map<string, any>>((_, reject) => {
        setTimeout(
          () =>
            reject(
              new Error(
                'Loading backups timed out. This may happen if your project has many large directories.',
              ),
            ),
          15000,
        );
      });

      const allBackups = await Promise.race([loadPromise, timeoutPromise]);

      // Check if operation was aborted
      if (abortController.signal.aborted) {
        console.log('🚫 Backup loading was cancelled');
        return;
      }

      console.log(`📊 Found ${allBackups.size} files with backups`);

      const groups: BackupGroup[] = [];
      for (const [originalFilePath, backups] of allBackups.entries()) {
        if (backups.length > 0) {
          groups.push({
            originalFilePath,
            backups: backups.sort(
              (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
            ),
            selected: backups[0], // Default to newest backup
          });
        }
      }

      setBackupGroups(groups);

      // Automatically select all groups that have backups (since they have a default selected backup)
      const autoSelectedFiles = new Set(
        groups.map((group) => group.originalFilePath),
      );
      setSelectedBackups(autoSelectedFiles);

      console.log(
        `✅ Backup loading completed. Found ${groups.length} files with backups.`,
      );
    } catch (err) {
      if (abortController.signal.aborted) {
        console.log('🚫 Backup loading was cancelled');
        return;
      }

      const errorMessage = `Failed to load backups: ${err instanceof Error ? err.message : 'Unknown error'}`;
      console.error(`❌ ${errorMessage}`, err);
      setError(errorMessage);
    } finally {
      setLoading(false);
      setLoadingAbortController(null);
    }
  }, [projectRoot]);

  const cancelLoading = () => {
    if (loadingAbortController) {
      loadingAbortController.abort();
      setLoading(false);
      setLoadingAbortController(null);
      console.log('🚫 User cancelled backup loading');
    }
  };

  const handleBackupSelection = (groupIndex: number, backup: BackupFile) => {
    setBackupGroups((prev) =>
      prev.map((group, index) =>
        index === groupIndex ? { ...group, selected: backup } : group,
      ),
    );
  };

  const handleGroupToggle = (originalFilePath: string, selected: boolean) => {
    setSelectedBackups((prev) => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(originalFilePath);
      } else {
        newSet.delete(originalFilePath);
      }
      return newSet;
    });
  };

  const handlePreview = async (
    originalFilePath: string,
    backupFilePath: string,
  ) => {
    setLoading(true);
    try {
      const preview = await revertService.getRevertPreview(
        originalFilePath,
        backupFilePath,
      );

      if (preview.success) {
        setPreviewData({
          originalFile: originalFilePath,
          backupFile: backupFilePath,
          currentContent: preview.currentContent || '',
          backupContent: preview.backupContent || '',
          diff: preview.diff,
        });
        setShowPreview(true);
      } else {
        setError(preview.error || 'Failed to generate preview');
      }
    } catch (err) {
      setError(
        `Preview failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    } finally {
      setLoading(false);
    }
  };

  // Calculate the number of files ready for revert
  const getRevertableFileCount = () => {
    return backupGroups.filter(
      (group) => selectedBackups.has(group.originalFilePath) && group.selected,
    ).length;
  };

  const handleRevertSelected = async () => {
    const selectedGroups = backupGroups.filter(
      (group) => selectedBackups.has(group.originalFilePath) && group.selected,
    );

    if (selectedGroups.length === 0) {
      setError('No files selected for revert');
      return;
    }

    setReverting(true);
    setError(null);

    try {
      const revertOperations = selectedGroups.map((group) => ({
        originalFilePath: group.originalFilePath,
        backupFilePath: group.selected!.backupFilePath,
      }));

      console.log(
        `🔄 Starting revert operation for ${revertOperations.length} files...`,
      );

      const result = await revertService.revertMultipleFiles(revertOperations, {
        createBackupOfCurrent: true,
        validateContent: true,
      });

      console.log(`✅ Revert operation completed:`, result);

      if (onRevertComplete) {
        onRevertComplete(result);
      }

      // Add a small delay to ensure file system operations complete
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Refresh the backup list
      console.log(`🔄 Refreshing backup list after revert...`);
      await loadBackups();

      // Clear selections
      setSelectedBackups(new Set());

      console.log(`✅ Revert operation and UI refresh completed`);
    } catch (err) {
      const errorMessage = `Revert failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
      console.error(`❌ ${errorMessage}`, err);
      setError(errorMessage);
    } finally {
      setReverting(false);
    }
  };

  const formatTimestamp = (timestamp: Date): string => {
    return timestamp.toLocaleString();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
  };

  const getRelativePath = (fullPath: string): string => {
    if (!projectRoot) return fullPath;
    return fullPath.startsWith(projectRoot)
      ? fullPath.substring(projectRoot.length + 1)
      : fullPath;
  };

  if (loading && backupGroups.length === 0) {
    return (
      <div className="revert-manager">
        <div className="revert-manager__loading">
          <div className="loading-spinner" />
          <p>Loading backups...</p>
          <p style={{ fontSize: '0.9rem', color: '#888', marginTop: '0.5rem' }}>
            Searching project directories for backup files...
          </p>
          {loadingAbortController && (
            <button
              className="btn btn--secondary btn--small"
              onClick={cancelLoading}
              style={{ marginTop: '1rem' }}
            >
              🚫 Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="revert-manager">
      <div className="revert-manager__header">
        <h2>🔄 Revert AI Changes</h2>
        <div className="revert-manager__actions">
          <button
            className="btn btn--secondary"
            onClick={loadBackups}
            disabled={loading}
          >
            🔄 Refresh
          </button>
          <button
            className="btn btn--primary"
            onClick={handleRevertSelected}
            disabled={getRevertableFileCount() === 0 || reverting}
          >
            {reverting
              ? '⏳ Reverting...'
              : `🔄 Revert Selected (${getRevertableFileCount()})`}
          </button>
          {onClose && (
            <button className="btn btn--ghost" onClick={onClose}>
              ✕ Close
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="revert-manager__error">
          <p>❌ {error}</p>
          <button className="btn btn--small" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {backupGroups.length === 0 && !loading ? (
        <div className="revert-manager__empty">
          <p>No backup files found in the current project.</p>
          <p>
            Backup files are automatically created when AI makes changes to your
            files.
          </p>
        </div>
      ) : (
        <div className="revert-manager__content">
          <div className="revert-manager__summary">
            <p>
              Found backups for <strong>{backupGroups.length}</strong> files
            </p>
            <p>Select files to revert to their previous state</p>
          </div>

          <div className="revert-manager__file-list">
            {backupGroups.map((group, groupIndex) => (
              <div key={group.originalFilePath} className="backup-group">
                <div className="backup-group__header">
                  <label className="backup-group__checkbox">
                    <input
                      type="checkbox"
                      checked={selectedBackups.has(group.originalFilePath)}
                      onChange={(e) =>
                        handleGroupToggle(
                          group.originalFilePath,
                          e.target.checked,
                        )
                      }
                    />
                    <span className="backup-group__file-path">
                      📄 {getRelativePath(group.originalFilePath)}
                    </span>
                  </label>
                  <span className="backup-group__count">
                    {group.backups.length} backup
                    {group.backups.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="backup-group__backups">
                  {group.backups.map((backup, backupIndex) => (
                    <div
                      key={backup.backupFilePath}
                      className={`backup-item ${group.selected === backup ? 'backup-item--selected' : ''}`}
                    >
                      <label className="backup-item__radio">
                        <input
                          type="radio"
                          name={`backup-${groupIndex}`}
                          checked={group.selected === backup}
                          onChange={() =>
                            handleBackupSelection(groupIndex, backup)
                          }
                        />
                        <div className="backup-item__info">
                          <div className="backup-item__timestamp">
                            🕐 {formatTimestamp(backup.timestamp)}
                          </div>
                          <div className="backup-item__details">
                            <span className="backup-item__size">
                              📦 {formatFileSize(backup.size)}
                            </span>
                            <span
                              className={`backup-item__status ${backup.isValid ? 'valid' : 'invalid'}`}
                            >
                              {backup.isValid ? '✅ Valid' : '❌ Invalid'}
                            </span>
                            {backup.createdBy && (
                              <span className="backup-item__created-by">
                                👤 {backup.createdBy}
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                      <div className="backup-item__actions">
                        <button
                          className="btn btn--small btn--secondary"
                          onClick={() =>
                            handlePreview(
                              group.originalFilePath,
                              backup.backupFilePath,
                            )
                          }
                          disabled={!backup.isValid}
                        >
                          👁️ Preview
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && previewData && (
        <div className="revert-manager__preview-modal">
          <div className="preview-modal">
            <div className="preview-modal__header">
              <h3>🔍 Revert Preview</h3>
              <button
                className="btn btn--ghost"
                onClick={() => setShowPreview(false)}
              >
                ✕
              </button>
            </div>

            <div className="preview-modal__file-info">
              <p>
                <strong>File:</strong>{' '}
                {getRelativePath(previewData.originalFile)}
              </p>
              <p>
                <strong>Backup:</strong>{' '}
                {getRelativePath(previewData.backupFile)}
              </p>
              {previewData.diff && (
                <div className="preview-modal__diff-stats">
                  <span className="diff-stat diff-stat--added">
                    +{previewData.diff.added}
                  </span>
                  <span className="diff-stat diff-stat--removed">
                    -{previewData.diff.removed}
                  </span>
                  <span className="diff-stat diff-stat--modified">
                    ~{previewData.diff.modified}
                  </span>
                </div>
              )}
            </div>

            <div className="preview-modal__content">
              <div className="preview-pane">
                <h4>Current Content</h4>
                <pre className="preview-pane__code">
                  {previewData.currentContent || '(empty file)'}
                </pre>
              </div>
              <div className="preview-pane">
                <h4>Backup Content (will be restored)</h4>
                <pre className="preview-pane__code">
                  {previewData.backupContent || '(empty file)'}
                </pre>
              </div>
            </div>

            <div className="preview-modal__actions">
              <button
                className="btn btn--secondary"
                onClick={() => setShowPreview(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn--primary"
                onClick={async () => {
                  setShowPreview(false);
                  const result = await revertService.revertFile(
                    previewData.originalFile,
                    previewData.backupFile,
                    { createBackupOfCurrent: true },
                  );
                  if (onRevertComplete) {
                    onRevertComplete(result);
                  }
                  await loadBackups();
                }}
              >
                🔄 Revert This File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RevertManager;
