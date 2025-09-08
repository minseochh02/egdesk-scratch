import React, { useState, useEffect } from 'react';
import { revertService, BackupFile } from '../../services/revertService';
import './RevertButton.css';

interface RevertButtonProps {
  filePath?: string;
  projectRoot?: string;
  onRevertComplete?: (
    success: boolean,
    message: string,
    filePath?: string,
  ) => void;
  className?: string;
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
}

const RevertButton: React.FC<RevertButtonProps> = ({
  filePath,
  projectRoot,
  onRevertComplete,
  className = '',
  size = 'medium',
  showText = true,
}) => {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [reverting, setReverting] = useState(false);

  useEffect(() => {
    if (filePath) {
      loadBackupsForFile();
    } else {
      // Reset state when no file is selected
      setLoading(false);
      setBackups([]);
    }
  }, [filePath]);

  const loadBackupsForFile = async () => {
    if (!filePath) return;

    setLoading(true);
    try {
      const fileBackups = await revertService.findBackupsForFile(filePath);
      setBackups(fileBackups);
    } catch (error) {
      console.error('Failed to load backups:', error);
      setBackups([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRevertToLatest = async () => {
    if (!filePath || backups.length === 0) return;

    const latestBackup = backups[0];
    await handleRevert(latestBackup);
  };

  const handleRevert = async (backup: BackupFile) => {
    if (!filePath) return;

    setReverting(true);
    setShowDropdown(false);

    try {
      const result = await revertService.revertFile(
        filePath,
        backup.backupFilePath,
        {
          createBackupOfCurrent: true,
          validateContent: true,
        },
      );

      if (onRevertComplete) {
        onRevertComplete(
          result.success,
          result.success
            ? `✅ Successfully reverted ${getFileName(filePath)}`
            : `❌ Failed to revert: ${result.errors.join(', ')}`,
          filePath,
        );
      }

      // Reload backups after successful revert
      if (result.success) {
        await loadBackupsForFile();
      }
    } catch (error) {
      const errorMessage = `Failed to revert: ${error instanceof Error ? error.message : 'Unknown error'}`;
      if (onRevertComplete) {
        onRevertComplete(false, errorMessage, filePath);
      }
    } finally {
      setReverting(false);
    }
  };

  const formatTimestamp = (timestamp: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    }
    if (diffHours > 0) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    }
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return `${Math.max(1, diffMinutes)} minute${diffMinutes !== 1 ? 's' : ''} ago`;
  };

  const getFileName = (path: string): string => {
    return path.split('/').pop() || path;
  };

  const getRelativePath = (fullPath: string): string => {
    if (!projectRoot) return fullPath;
    return fullPath.startsWith(projectRoot)
      ? fullPath.substring(projectRoot.length + 1)
      : fullPath;
  };

  if (!filePath) {
    console.log('❌ RevertButton: No filePath provided, returning null');
    return null;
  }

  const hasBackups = backups.length > 0;
  const buttonClass = `revert-button revert-button--${size} ${className}`;

  return (
    <div className="revert-button-container">
      {/* Main revert button */}
      <button
        className={`${buttonClass} ${hasBackups ? '' : 'revert-button--disabled'}`}
        onClick={hasBackups ? handleRevertToLatest : undefined}
        disabled={loading || reverting || !hasBackups}
        title={
          loading
            ? 'Checking for backups...'
            : reverting
              ? 'Reverting...'
              : !hasBackups
                ? 'No backups available - backups are created when AI modifies files'
                : `Revert ${getFileName(filePath)} to latest backup`
        }
        style={{
          // Make button more visible even when disabled
          opacity: hasBackups ? 1 : 0.7,
          border: hasBackups ? '1px solid #4a5568' : '1px solid #666',
          background: hasBackups ? '#4a5568' : '#666',
        }}
      >
        {loading ? (
          <span className="revert-button__spinner">⏳</span>
        ) : reverting ? (
          <span className="revert-button__spinner">🔄</span>
        ) : (
          <span className="revert-button__icon">↶</span>
        )}
        {showText && (
          <span className="revert-button__text">
            {loading
              ? 'Checking...'
              : reverting
                ? 'Reverting...'
                : !hasBackups
                  ? 'No Backups'
                  : 'Revert'}
          </span>
        )}
      </button>

      {/* Dropdown button for multiple backups */}
      {hasBackups && backups.length > 1 && (
        <button
          className={`${buttonClass} revert-button--dropdown`}
          onClick={() => setShowDropdown(!showDropdown)}
          disabled={loading || reverting}
          title="Show all backups"
        >
          <span className="revert-button__dropdown-icon">▼</span>
        </button>
      )}

      {/* Dropdown menu */}
      {showDropdown && hasBackups && (
        <div className="revert-dropdown">
          <div className="revert-dropdown__header">
            <h4>🔄 Revert Options for {getFileName(filePath)}</h4>
            <button
              className="revert-dropdown__close"
              onClick={() => setShowDropdown(false)}
            >
              ✕
            </button>
          </div>
          <div className="revert-dropdown__list">
            {backups.map((backup, index) => (
              <div
                key={backup.backupFilePath}
                className={`revert-dropdown__item ${!backup.isValid ? 'revert-dropdown__item--invalid' : ''}`}
              >
                <div className="revert-dropdown__item-info">
                  <div className="revert-dropdown__item-time">
                    🕐 {formatTimestamp(backup.timestamp)}
                    {index === 0 && (
                      <span className="revert-dropdown__latest">Latest</span>
                    )}
                  </div>
                  <div className="revert-dropdown__item-details">
                    <span>{backup.timestamp.toLocaleString()}</span>
                    <span className={backup.isValid ? 'valid' : 'invalid'}>
                      {backup.isValid ? '✅ Valid' : '❌ Invalid'}
                    </span>
                  </div>
                </div>
                <button
                  className="revert-dropdown__item-button"
                  onClick={() => handleRevert(backup)}
                  disabled={!backup.isValid || reverting}
                >
                  {reverting ? '⏳' : '↶'} Revert
                </button>
              </div>
            ))}
          </div>
          <div className="revert-dropdown__footer">
            <p>💡 Current state will be backed up before reverting</p>
          </div>
        </div>
      )}

      {/* Backdrop for dropdown */}
      {showDropdown && (
        <div
          className="revert-dropdown__backdrop"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
};

export default RevertButton;
