import React, { useState, useEffect } from 'react';
import './UpdateDialog.css';

interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes?: string;
}

interface UpdateProgress {
  percent: number;
  transferred: number;
  total: number;
}

export function UpdateDialog() {
  const [updateAvailable, setUpdateAvailable] = useState<UpdateInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<UpdateProgress | null>(null);
  const [updateDownloaded, setUpdateDownloaded] = useState<UpdateInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (!window.electron?.updater) return;

    // Listen for update available
    const unsubscribeAvailable = window.electron.updater.onUpdateAvailable((info) => {
      setUpdateAvailable(info);
      setError(null);
    });

    // Listen for download progress
    const unsubscribeProgress = window.electron.updater.onDownloadProgress((progress) => {
      setDownloadProgress(progress);
      setIsDownloading(true);
    });

    // Listen for update downloaded
    const unsubscribeDownloaded = window.electron.updater.onUpdateDownloaded((info) => {
      setUpdateDownloaded(info);
      setIsDownloading(false);
      setDownloadProgress(null);
    });

    // Listen for errors
    const unsubscribeError = window.electron.updater.onUpdateError((err) => {
      setError(err.message);
      setIsDownloading(false);
      setDownloadProgress(null);
    });

    return () => {
      unsubscribeAvailable();
      unsubscribeProgress();
      unsubscribeDownloaded();
      unsubscribeError();
    };
  }, []);

  const handleDownload = async () => {
    if (!window.electron?.updater) return;
    
    setIsDownloading(true);
    setError(null);
    try {
      await window.electron.updater.downloadUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start download');
      setIsDownloading(false);
    }
  };

  const handleRestart = async () => {
    if (!window.electron?.updater) return;
    
    try {
      await window.electron.updater.quitAndInstall();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restart');
    }
  };

  const handleDismiss = () => {
    setUpdateAvailable(null);
    setUpdateDownloaded(null);
    setError(null);
    setDownloadProgress(null);
    setIsDownloading(false);
  };

  // Show update downloaded dialog
  if (updateDownloaded) {
    return (
      <div className="update-dialog-overlay">
        <div className="update-dialog">
          <div className="update-dialog-header">
            <h2>✅ Update Ready to Install</h2>
          </div>
          <div className="update-dialog-body">
            <p>
              Version <strong>{updateDownloaded.version}</strong> has been downloaded successfully.
            </p>
            <p className="update-dialog-note">
              The app will restart to apply the update. Make sure to save your work.
            </p>
          </div>
          <div className="update-dialog-footer">
            <button className="update-btn update-btn-secondary" onClick={handleDismiss}>
              Later
            </button>
            <button className="update-btn update-btn-primary" onClick={handleRestart}>
              Restart Now
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show download progress
  if (isDownloading && downloadProgress) {
    return (
      <div className="update-dialog-overlay">
        <div className="update-dialog">
          <div className="update-dialog-header">
            <h2>📥 Downloading Update</h2>
          </div>
          <div className="update-dialog-body">
            <p>Downloading version <strong>{updateAvailable?.version || 'latest'}</strong>...</p>
            <div className="update-progress-container">
              <div className="update-progress-bar">
                <div
                  className="update-progress-fill"
                  style={{ width: `${downloadProgress.percent}%` }}
                />
              </div>
              <div className="update-progress-text">
                {downloadProgress.percent}% ({Math.round(downloadProgress.transferred / 1024 / 1024)}MB / {Math.round(downloadProgress.total / 1024 / 1024)}MB)
              </div>
            </div>
          </div>
          <div className="update-dialog-footer">
            <button className="update-btn update-btn-secondary" onClick={handleDismiss} disabled>
              Downloading...
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show update available dialog
  if (updateAvailable && !isDownloading) {
    return (
      <div className="update-dialog-overlay">
        <div className="update-dialog">
          <div className="update-dialog-header">
            <h2>🎉 Update Available</h2>
          </div>
          <div className="update-dialog-body">
            <p>
              A new version <strong>{updateAvailable.version}</strong> is available.
            </p>
            {updateAvailable.releaseNotes && (
              <div className="update-release-notes">
                <h3>What's New:</h3>
                <div dangerouslySetInnerHTML={{ __html: updateAvailable.releaseNotes }} />
              </div>
            )}
            <p className="update-dialog-note">
              Would you like to download and install it now?
            </p>
          </div>
          <div className="update-dialog-footer">
            <button className="update-btn update-btn-secondary" onClick={handleDismiss}>
              Later
            </button>
            <button className="update-btn update-btn-primary" onClick={handleDownload}>
              Download Update
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show error dialog
  if (error) {
    return (
      <div className="update-dialog-overlay">
        <div className="update-dialog">
          <div className="update-dialog-header">
            <h2>❌ Update Error</h2>
          </div>
          <div className="update-dialog-body">
            <p>{error}</p>
          </div>
          <div className="update-dialog-footer">
            <button className="update-btn update-btn-primary" onClick={handleDismiss}>
              OK
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

