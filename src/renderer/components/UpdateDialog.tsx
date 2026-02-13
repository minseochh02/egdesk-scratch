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
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(false);
  const [autoUpdateNotification, setAutoUpdateNotification] = useState<{version: string} | null>(null);

  useEffect(() => {
    if (!window.electron?.updater) return;

    // Load auto-update setting
    const loadAutoUpdateSetting = async () => {
      try {
        const result = await window.electron.updater.getAutoUpdateSetting();
        if (result.success) {
          setAutoUpdateEnabled(result.autoUpdate);
        }
      } catch (error) {
        console.error('Failed to load auto-update setting:', error);
      }
    };
    
    loadAutoUpdateSetting();

    // Listen for update available
    const unsubscribeAvailable = window.electron.updater.onUpdateAvailable((info) => {
      setUpdateAvailable(info);
      setError(null);
    });

    // Listen for download progress
    const unsubscribeProgress = window.electron.updater.onDownloadProgress((progress) => {
      setDownloadProgress(progress);
      setIsDownloading(true);
      // Show auto-update notification if download started but no manual update available dialog
      if (!updateAvailable && autoUpdateEnabled) {
        setAutoUpdateNotification({version: 'latest'});
      }
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
    setAutoUpdateNotification(null);
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

  // Show auto-update notification only if auto-update is enabled and in progress
  if (autoUpdateEnabled && autoUpdateNotification && !updateAvailable && isDownloading && downloadProgress) {
    return (
      <div className="update-dialog-overlay">
        <div className="update-dialog">
          <div className="update-dialog-header">
            <h2>🔄 Auto-Update in Progress</h2>
          </div>
          <div className="update-dialog-body">
            <p>A new version is being downloaded automatically...</p>
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
            <p className="update-dialog-note">
              The app will restart automatically when the download is complete. Save your work now.
            </p>
            <div className="update-dialog-note">
              <small>🔧 Auto-updates can be managed in EGDesktop settings</small>
            </div>
          </div>
          <div className="update-dialog-footer">
            <button className="update-btn update-btn-secondary" onClick={handleDismiss}>
              Dismiss
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

  // Show update available dialog only when auto-update is disabled
  if (updateAvailable && !isDownloading && !autoUpdateEnabled) {
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
            <div className="update-dialog-note">
              <small>💡 Enable auto-updates in EGDesktop settings to avoid this dialog</small>
            </div>
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

