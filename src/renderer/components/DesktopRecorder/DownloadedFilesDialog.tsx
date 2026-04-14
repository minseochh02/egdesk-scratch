/**
 * DownloadedFilesDialog
 *
 * Shows files downloaded during desktop recording and allows importing them
 * into the database using the existing import wizard.
 */

import React, { useState, useEffect } from 'react';
import { X, Download, FileSpreadsheet, Upload, Clock, HardDrive, Settings } from 'lucide-react';
import { DesktopDownloadsSyncWizard } from '../UserData/DesktopDownloadsSyncWizard';
import { useUserData } from '../../hooks/useUserData';
import './DownloadedFilesDialog.css';

interface DownloadedFileInfo {
  filename: string;
  filePath: string;
  fileSize: number;
  downloadedAt: string;
  timestamp: number;
}

interface RecordingInfo {
  recordedAt: string;
  duration: number;
  platform: string;
  actionCount: number;
  downloadsFolder?: string;
}

interface DownloadedFilesDialogProps {
  recordingJsonPath: string;
  onClose: () => void;
}

export const DownloadedFilesDialog: React.FC<DownloadedFilesDialogProps> = ({
  recordingJsonPath,
  onClose,
}) => {
  const { tables } = useUserData();
  const [files, setFiles] = useState<DownloadedFileInfo[]>([]);
  const [recordingInfo, setRecordingInfo] = useState<RecordingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<DownloadedFileInfo | null>(null);
  const [showSyncWizard, setShowSyncWizard] = useState(false);

  useEffect(() => {
    loadDownloadedFiles();
  }, [recordingJsonPath]);

  const loadDownloadedFiles = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await window.electron.ipcRenderer.invoke(
        'desktop-recorder:load-downloaded-files-from-json',
        { jsonPath: recordingJsonPath }
      );

      if (result.success) {
        setFiles(result.files || []);
        setRecordingInfo(result.recordingInfo);
      } else {
        setError(result.error || 'Failed to load downloaded files');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load downloaded files');
    } finally {
      setLoading(false);
    }
  };

  const handleImportFile = (file: DownloadedFileInfo) => {
    setSelectedFile(file);
    setShowSyncWizard(true);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  const formatDateTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleString();
  };

  // Show sync wizard
  if (showSyncWizard) {
    return (
      <DesktopDownloadsSyncWizard
        onClose={() => {
          setShowSyncWizard(false);
          setSelectedFile(null);
        }}
        userTables={tables}
        initialFolder={recordingInfo?.downloadsFolder}
        initialFilePath={selectedFile?.filePath}
      />
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog downloaded-files-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <Download className="modal-icon" size={20} />
            <h2 className="modal-title">Downloaded Files</h2>
          </div>
          <button className="icon-button" onClick={onClose} title="Close">
            <X size={20} />
          </button>
        </div>

        {/* Recording Info */}
        {recordingInfo && (
          <>
            <div className="recording-info-banner">
              <div className="recording-info-item">
                <Clock size={16} />
                <span>Recorded: {formatDateTime(recordingInfo.recordedAt)}</span>
              </div>
              <div className="recording-info-item">
                <span>Duration: {formatDuration(recordingInfo.duration)}</span>
              </div>
              <div className="recording-info-item">
                <span>{recordingInfo.actionCount} actions</span>
              </div>
              <div className="recording-info-item">
                <span>{recordingInfo.platform}</span>
              </div>
            </div>
            {recordingInfo.downloadsFolder && (
              <div className="downloads-folder-banner">
                <div className="folder-info">
                  <strong>📂 Downloads Folder:</strong>
                  <code className="folder-path">{recordingInfo.downloadsFolder}</code>
                </div>
                <p className="folder-hint">
                  Files downloaded during this recording were moved to this folder.
                </p>
                <button
                  className="btn btn-secondary btn-sm setup-sync-btn"
                  onClick={() => setShowSyncWizard(true)}
                >
                  <Settings size={14} />
                  Set Up Auto-Sync for This Folder
                </button>
              </div>
            )}
          </>
        )}

        {/* Content */}
        <div className="modal-body">
          {loading && (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading downloaded files...</p>
            </div>
          )}

          {error && (
            <div className="error-state">
              <p className="error-message">{error}</p>
              <button className="btn btn-secondary" onClick={loadDownloadedFiles}>
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && files.length === 0 && (
            <div className="empty-state">
              <Download size={48} className="empty-icon" />
              <h3>No Downloads Detected</h3>
              <p>No Excel or CSV files were downloaded during this recording.</p>
            </div>
          )}

          {!loading && !error && files.length > 0 && (
            <div className="files-list">
              {files.map((file, index) => (
                <div key={index} className="file-card">
                  <div className="file-icon">
                    <FileSpreadsheet size={32} />
                  </div>

                  <div className="file-details">
                    <h4 className="file-name">{file.filename}</h4>
                    <div className="file-meta">
                      <span className="file-size">
                        <HardDrive size={14} />
                        {formatFileSize(file.fileSize)}
                      </span>
                      <span className="file-time">
                        <Clock size={14} />
                        {formatDateTime(file.downloadedAt)}
                      </span>
                    </div>
                    <p className="file-path" title={file.filePath}>
                      {file.filePath}
                    </p>
                  </div>

                  <div className="file-actions">
                    <button
                      className="btn btn-primary"
                      onClick={() => handleImportFile(file)}
                    >
                      <Upload size={16} />
                      Import to Database
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
