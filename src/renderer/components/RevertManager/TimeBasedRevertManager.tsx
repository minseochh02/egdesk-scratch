import React, { useState, useEffect, useCallback } from 'react';
import {
  revertService,
  TimeBasedRevertResult,
} from '../../services/revertService';
import './TimeBasedRevertManager.css';

interface TimeBasedRevertManagerProps {
  projectRoot?: string;
  onRevertComplete?: (result: TimeBasedRevertResult) => void;
  onClose?: () => void;
}

const TimeBasedRevertManager: React.FC<TimeBasedRevertManagerProps> = ({
  projectRoot,
  onRevertComplete,
  onClose,
}) => {
  const [availableTimestamps, setAvailableTimestamps] = useState<Date[]>([]);
  const [selectedTimestamp, setSelectedTimestamp] = useState<Date | null>(null);
  const [previewData, setPreviewData] = useState<TimeBasedRevertResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load available timestamps on component mount
  useEffect(() => {
    if (projectRoot) {
      loadAvailableTimestamps();
    }
  }, [projectRoot]);

  const loadAvailableTimestamps = useCallback(async () => {
    if (!projectRoot) return;

    console.log(`🕐 Loading available timestamps from: ${projectRoot}`);
    setLoading(true);
    setError(null);

    try {
      const timestamps = await revertService.getAvailableTimestamps(projectRoot);
      setAvailableTimestamps(timestamps);
      if (timestamps.length > 0) {
        setSelectedTimestamp(timestamps[0]); // Default to most recent
      }
      console.log(`✅ Loaded ${timestamps.length} available timestamps`);
    } catch (err) {
      const errorMessage = `Failed to load timestamps: ${err instanceof Error ? err.message : 'Unknown error'}`;
      console.error(`❌ ${errorMessage}`, err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [projectRoot]);

  const handlePreview = async () => {
    if (!selectedTimestamp || !projectRoot) return;

    console.log(`🔍 Previewing revert to: ${selectedTimestamp.toISOString()}`);
    setLoading(true);
    setError(null);

    try {
      const preview = await revertService.revertToTimestamp(
        projectRoot,
        selectedTimestamp,
        { dryRun: true }
      );
      setPreviewData(preview);
      console.log(`✅ Preview completed:`, preview);
    } catch (err) {
      const errorMessage = `Preview failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
      console.error(`❌ ${errorMessage}`, err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRevert = async () => {
    if (!selectedTimestamp || !projectRoot) return;

    console.log(`🔄 Starting revert to: ${selectedTimestamp.toISOString()}`);
    setReverting(true);
    setError(null);

    try {
      const result = await revertService.revertToTimestamp(
        projectRoot,
        selectedTimestamp,
        { createBackupOfCurrent: true }
      );

      console.log(`✅ Revert completed:`, result);

      if (onRevertComplete) {
        onRevertComplete(result);
      }

      // Refresh timestamps after revert
      await loadAvailableTimestamps();
      setPreviewData(null);
    } catch (err) {
      const errorMessage = `Revert failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
      console.error(`❌ ${errorMessage}`, err);
      setError(errorMessage);
    } finally {
      setReverting(false);
    }
  };

  const formatTimestamp = (timestamp: Date, index: number): string => {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    let timeAgo = '';
    if (diffMinutes < 1) {
      timeAgo = 'Just now';
    } else if (diffMinutes < 60) {
      timeAgo = `${diffMinutes} minutes ago`;
    } else if (diffHours < 24) {
      timeAgo = `${diffHours} hours ago`;
    } else {
      timeAgo = `${diffDays} days ago`;
    }

    return `${timestamp.toLocaleString()} (${timeAgo})`;
  };

  const getRevertDescription = (index: number): string => {
    if (index === 0) return 'Most Recent';
    if (index === 1) return '1 change ago';
    return `${index + 1} changes ago`;
  };

  if (loading && availableTimestamps.length === 0) {
    return (
      <div className="time-based-revert-manager">
        <div className="time-based-revert-manager__loading">
          <div className="loading-spinner" />
          <p>Loading available timestamps...</p>
          <p style={{ fontSize: '0.9rem', color: '#888', marginTop: '0.5rem' }}>
            Scanning project for backup files...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="time-based-revert-manager">
      <div className="time-based-revert-manager__header">
        <h2>🕐 Time-Based Revert</h2>
        <div className="time-based-revert-manager__actions">
          <button
            className="btn btn--secondary"
            onClick={loadAvailableTimestamps}
            disabled={loading}
          >
            🔄 Refresh
          </button>
          {onClose && (
            <button className="btn btn--ghost" onClick={onClose}>
              ✕ Close
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="time-based-revert-manager__error">
          <p>❌ {error}</p>
          <button className="btn btn--small" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {availableTimestamps.length === 0 && !loading ? (
        <div className="time-based-revert-manager__empty">
          <p>No backup files found in the current project.</p>
          <p>
            Backup files are automatically created when AI makes changes to your
            files.
          </p>
        </div>
      ) : (
        <div className="time-based-revert-manager__content">
          <div className="time-based-revert-manager__summary">
            <p>
              Found <strong>{availableTimestamps.length}</strong> available timestamps
            </p>
            <p>Select a timestamp to revert all files to that point in time</p>
          </div>

          <div className="time-based-revert-manager__timestamp-selector">
            <label htmlFor="timestamp-select">Select Target Timestamp:</label>
            <select
              id="timestamp-select"
              value={selectedTimestamp?.toISOString() || ''}
              onChange={(e) => setSelectedTimestamp(new Date(e.target.value))}
              disabled={loading}
            >
              {availableTimestamps.map((timestamp, index) => (
                <option key={index} value={timestamp.toISOString()}>
                  {getRevertDescription(index)} - {formatTimestamp(timestamp, index)}
                </option>
              ))}
            </select>
          </div>

          <div className="time-based-revert-manager__actions">
            <button
              className="btn btn--secondary"
              onClick={handlePreview}
              disabled={!selectedTimestamp || loading}
            >
              {loading ? '⏳ Loading...' : '🔍 Preview Changes'}
            </button>

            <button
              className="btn btn--primary"
              onClick={handleRevert}
              disabled={!selectedTimestamp || reverting || !previewData}
            >
              {reverting ? '⏳ Reverting...' : '🔄 Revert to Selected Time'}
            </button>
          </div>

          {previewData && (
            <div className="time-based-revert-manager__preview">
              <h3>📋 Preview Results</h3>
              <div className="preview-summary">
                <div className="preview-stat">
                  <span className="preview-stat__label">Files to revert:</span>
                  <span className="preview-stat__value">{previewData.revertedFiles.length}</span>
                </div>
                <div className="preview-stat">
                  <span className="preview-stat__label">Skipped files:</span>
                  <span className="preview-stat__value">{previewData.skippedFiles.length}</span>
                </div>
                <div className="preview-stat">
                  <span className="preview-stat__label">Target time:</span>
                  <span className="preview-stat__value">
                    {selectedTimestamp?.toLocaleString()}
                  </span>
                </div>
              </div>

              {previewData.revertedFiles.length > 0 && (
                <div className="preview-files">
                  <h4>Files to be reverted:</h4>
                  <div className="file-list">
                    {previewData.revertedFiles.map((file, index) => (
                      <div key={index} className="file-item">
                        <div className="file-item__path">
                          📄 {file.originalFilePath.split('/').pop()}
                        </div>
                        <div className="file-item__timestamp">
                          🕐 {file.backupTimestamp.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {previewData.skippedFiles.length > 0 && (
                <div className="preview-skipped">
                  <h4>Skipped files:</h4>
                  <div className="file-list">
                    {previewData.skippedFiles.map((file, index) => (
                      <div key={index} className="file-item file-item--skipped">
                        <div className="file-item__path">
                          ⚠️ {file.originalFilePath.split('/').pop()}
                        </div>
                        <div className="file-item__reason">
                          {file.reason}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {previewData.errors.length > 0 && (
                <div className="preview-errors">
                  <h4>Errors:</h4>
                  <div className="error-list">
                    {previewData.errors.map((error, index) => (
                      <div key={index} className="error-item">
                        ❌ {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TimeBasedRevertManager;
