/**
 * Recorder Control Panel
 *
 * Floating control window for desktop recording on a separate virtual desktop.
 * Shows recording status, action count, and provides Start/Stop/Pause controls.
 */

import React, { useState, useEffect } from 'react';
import './RecorderControl.css';

interface RecorderStatus {
  isRecording: boolean;
  isPaused: boolean;
  actionCount: number;
}

interface RecorderUpdate {
  filePath: string;
  code: string;
  timestamp: string;
  actionCount: number;
  status: RecorderStatus;
}

const RecorderControl: React.FC = () => {
  const [status, setStatus] = useState<RecorderStatus>({
    isRecording: false,
    isPaused: false,
    actionCount: 0,
  });
  const [scriptName, setScriptName] = useState<string>('');

  useEffect(() => {
    // Listen for recorder updates
    const removeListener = window.electron.ipcRenderer.on(
      'recorder-control:update',
      (update: RecorderUpdate) => {
        if (update.status) {
          setStatus(update.status);
        }
      }
    );

    return () => {
      removeListener();
    };
  }, []);

  const handleStop = async () => {
    try {
      await window.electron.ipcRenderer.invoke('desktop-recorder:stop');
      // Close the control window after stopping
      await window.electron.ipcRenderer.invoke('desktop-recorder:close-control-window');
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  const handlePause = async () => {
    try {
      if (status.isPaused) {
        await window.electron.ipcRenderer.invoke('desktop-recorder:resume');
      } else {
        await window.electron.ipcRenderer.invoke('desktop-recorder:pause');
      }
    } catch (error) {
      console.error('Failed to pause/resume recording:', error);
    }
  };

  const handleClose = async () => {
    try {
      await window.electron.ipcRenderer.invoke('desktop-recorder:close-control-window');
    } catch (error) {
      console.error('Failed to close control window:', error);
    }
  };

  return (
    <div className="recorder-control">
      <div className="control-header">
        <div className="status-indicator">
          <div className={`status-dot ${status.isRecording ? (status.isPaused ? 'paused' : 'recording') : 'stopped'}`}></div>
          <span className="status-text">
            {status.isPaused ? 'Paused' : status.isRecording ? 'Recording' : 'Stopped'}
          </span>
        </div>
        <button className="close-btn" onClick={handleClose} title="Close">
          ×
        </button>
      </div>

      <div className="control-body">
        <div className="action-count">
          <div className="count-label">Actions</div>
          <div className="count-value">{status.actionCount}</div>
        </div>

        <div className="control-buttons">
          <button
            className="control-btn pause-btn"
            onClick={handlePause}
            disabled={!status.isRecording}
            title={status.isPaused ? 'Resume' : 'Pause'}
          >
            {status.isPaused ? '▶' : '⏸'}
          </button>
          <button
            className="control-btn stop-btn"
            onClick={handleStop}
            disabled={!status.isRecording}
            title="Stop Recording"
          >
            ⏹
          </button>
        </div>

        <div className="hotkeys">
          <div className="hotkey-item">
            <span className="hotkey-keys">Win+Ctrl+←</span>
            <span className="hotkey-desc">Back to EGDesk</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecorderControl;
