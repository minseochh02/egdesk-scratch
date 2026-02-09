import React, { useState, useEffect } from 'react';
import './DesktopRecorderPage.css';

interface RecordingStatus {
  isRecording: boolean;
  isPaused: boolean;
  actionCount: number;
}

interface SavedRecording {
  path: string;
  name: string;
  createdAt: Date;
  actionCount: number;
}

const DesktopRecorderPage: React.FC = () => {
  // State
  const [hasPermissions, setHasPermissions] = useState<boolean>(false);
  const [checkingPermissions, setCheckingPermissions] = useState<boolean>(true);
  const [status, setStatus] = useState<RecordingStatus>({
    isRecording: false,
    isPaused: false,
    actionCount: 0,
  });
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [savedRecordings, setSavedRecordings] = useState<SavedRecording[]>([]);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [replaySpeed, setReplaySpeed] = useState<number>(1.0);

  // Check permissions on mount
  useEffect(() => {
    checkPermissions();
    loadSavedRecordings();
  }, []);

  // Poll status every second when recording
  useEffect(() => {
    if (status.isRecording) {
      const interval = setInterval(async () => {
        try {
          const result = await (window as any).electron.invoke('desktop-recorder:get-status');
          if (result.success) {
            setStatus(result.status);
          }
        } catch (err) {
          console.error('Error polling status:', err);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [status.isRecording]);

  // Listen for real-time code updates
  useEffect(() => {
    const handleUpdate = (data: any) => {
      setGeneratedCode(data.code);
    };

    const unsubscribe = (window as any).electron.desktopRecorder.onUpdate(handleUpdate);

    return () => {
      unsubscribe();
    };
  }, []);

  // Check permissions
  const checkPermissions = async () => {
    setCheckingPermissions(true);
    try {
      const result = await (window as any).electron.invoke('desktop-recorder:check-permissions');
      setHasPermissions(result.hasPermissions);
    } catch (err: any) {
      setError(err.message || 'Failed to check permissions');
    } finally {
      setCheckingPermissions(false);
    }
  };

  // Load saved recordings
  const loadSavedRecordings = async () => {
    try {
      const result = await (window as any).electron.invoke('desktop-recorder:get-recordings');
      if (result.success) {
        setSavedRecordings(result.recordings || []);
      }
    } catch (err) {
      console.error('Error loading recordings:', err);
    }
  };

  // Start recording
  const handleStartRecording = async () => {
    setError('');
    setSuccessMessage('');
    try {
      const result = await (window as any).electron.invoke('desktop-recorder:start');
      if (result.success) {
        setStatus({
          isRecording: true,
          isPaused: false,
          actionCount: 0,
        });
        setGeneratedCode('');
        setSuccessMessage('Recording started! Use hotkeys to control recording.');
      } else {
        setError(result.error || 'Failed to start recording');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start recording');
    }
  };

  // Stop recording
  const handleStopRecording = async () => {
    setError('');
    setSuccessMessage('');
    try {
      const result = await (window as any).electron.invoke('desktop-recorder:stop');
      if (result.success) {
        setStatus({
          isRecording: false,
          isPaused: false,
          actionCount: 0,
        });
        setSuccessMessage(`Recording saved to: ${result.filePath}`);
        loadSavedRecordings();
      } else {
        setError(result.error || 'Failed to stop recording');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to stop recording');
    }
  };

  // Pause recording
  const handlePauseRecording = async () => {
    try {
      const result = await (window as any).electron.invoke('desktop-recorder:pause');
      if (result.success) {
        setStatus({ ...status, isPaused: true });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to pause recording');
    }
  };

  // Resume recording
  const handleResumeRecording = async () => {
    try {
      const result = await (window as any).electron.invoke('desktop-recorder:resume');
      if (result.success) {
        setStatus({ ...status, isPaused: false });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to resume recording');
    }
  };

  // Replay recording
  const handleReplay = async (filePath: string) => {
    setError('');
    setSuccessMessage('');
    try {
      const result = await (window as any).electron.invoke('desktop-recorder:replay', {
        filePath,
        speed: replaySpeed,
      });
      if (result.success) {
        setSuccessMessage('Replay completed successfully!');
      } else {
        setError(result.error || 'Failed to replay recording');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to replay recording');
    }
  };

  // Delete recording
  const handleDelete = async (filePath: string) => {
    if (!confirm('Are you sure you want to delete this recording?')) {
      return;
    }

    try {
      const result = await (window as any).electron.invoke('desktop-recorder:delete-recording', {
        filePath,
      });
      if (result.success) {
        setSuccessMessage('Recording deleted successfully');
        loadSavedRecordings();
      } else {
        setError(result.error || 'Failed to delete recording');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete recording');
    }
  };

  // Permission Required State
  if (checkingPermissions) {
    return (
      <div className="desktop-recorder-page">
        <div className="desktop-recorder-container">
          <h1>Desktop Recorder</h1>
          <div className="checking-permissions">
            <p>Checking permissions...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!hasPermissions) {
    return (
      <div className="desktop-recorder-page">
        <div className="desktop-recorder-container">
          <h1>Desktop Recorder</h1>
          <div className="permission-required">
            <h2>⚠️ Accessibility Permissions Required</h2>
            <p>Desktop recording requires accessibility permissions to capture keyboard and mouse events.</p>
            <div className="permission-instructions">
              <h3>macOS Instructions:</h3>
              <ol>
                <li>Open <strong>System Settings</strong></li>
                <li>Go to <strong>Privacy & Security → Accessibility</strong></li>
                <li>Click the lock icon to make changes (enter your password)</li>
                <li>Add or enable this app in the list</li>
                <li><strong>Completely quit and restart</strong> this application</li>
              </ol>
              <p className="warning-note" style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)' }}>
                ⚠️ <strong>Important:</strong> After granting permissions, you MUST completely quit and restart the application. Using Cmd+Q to quit is recommended.
              </p>
              <div className="permission-instructions" style={{ marginTop: '1.5rem' }}>
                <h3>🔧 If Still Not Working:</h3>
                <p>The macOS accessibility database might be corrupted. Try this:</p>
                <ol>
                  <li>Open Terminal</li>
                  <li>Run: <code style={{ background: '#1a1a1a', padding: '0.25rem 0.5rem', borderRadius: '3px' }}>sudo tccutil reset Accessibility</code></li>
                  <li>Enter your password when prompted</li>
                  <li>Restart your Mac</li>
                  <li>Launch the app and grant permissions again</li>
                </ol>
              </div>
            </div>
            <button onClick={checkPermissions} className="btn-primary">
              Check Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main Recording UI
  return (
    <div className="desktop-recorder-page">
      <div className="desktop-recorder-container">
        <h1>Desktop Recorder</h1>

        {/* Error/Success Messages */}
        {error && (
          <div className="message error-message">
            {error}
            <button onClick={() => setError('')} className="close-btn">×</button>
          </div>
        )}
        {successMessage && (
          <div className="message success-message">
            {successMessage}
            <button onClick={() => setSuccessMessage('')} className="close-btn">×</button>
          </div>
        )}

        {/* Recording Controls */}
        <div className="recording-controls">
          {!status.isRecording ? (
            <button onClick={handleStartRecording} className="btn-start">
              ▶️ Start Recording
            </button>
          ) : (
            <div className="recording-active-controls">
              {!status.isPaused ? (
                <button onClick={handlePauseRecording} className="btn-pause">
                  ⏸️ Pause
                </button>
              ) : (
                <button onClick={handleResumeRecording} className="btn-resume">
                  ▶️ Resume
                </button>
              )}
              <button onClick={handleStopRecording} className="btn-stop">
                ⏹️ Stop Recording
              </button>
            </div>
          )}
        </div>

        {/* Status Display */}
        {status.isRecording && (
          <div className={`status-display ${status.isPaused ? 'paused' : 'recording'}`}>
            <div className="status-indicator">
              <span className="status-dot"></span>
              <span className="status-text">
                {status.isPaused ? 'Paused' : 'Recording'}
              </span>
            </div>
            <div className="action-count">
              Actions Recorded: <strong>{status.actionCount}</strong>
            </div>
          </div>
        )}

        {/* Hotkeys Info */}
        <div className="hotkeys-info">
          <h3>⌨️ Recording Features</h3>
          <div className="hotkey-list">
            <div className="hotkey-item">
              <span className="hotkey">🖱️ Mouse Clicks</span>
              <span className="hotkey-desc">Automatically captured (all buttons)</span>
            </div>
            <div className="hotkey-item">
              <span className="hotkey">⌨️ Keyboard</span>
              <span className="hotkey-desc">All keys and shortcuts captured</span>
            </div>
            <div className="hotkey-item">
              <span className="hotkey">⌘ + Shift + P</span>
              <span className="hotkey-desc">Pause/Resume recording</span>
            </div>
            <div className="hotkey-item">
              <span className="hotkey">⌘ + Shift + S</span>
              <span className="hotkey-desc">Stop recording</span>
            </div>
          </div>
          <p className="dev-mode-note" style={{
            marginTop: '1rem',
            fontSize: '0.9rem',
            color: '#fbbf24',
            fontStyle: 'italic'
          }}>
            📝 Note: Window/app switching detection is disabled in development mode due to macOS permission limitations.
            It will work in production builds.
          </p>
        </div>

        {/* Code Preview */}
        {generatedCode && (
          <div className="code-preview">
            <h3>Generated Code Preview</h3>
            <pre className="code-block">{generatedCode}</pre>
          </div>
        )}

        {/* Saved Recordings */}
        <div className="saved-recordings">
          <h3>📼 Saved Recordings</h3>
          {savedRecordings.length === 0 ? (
            <p className="no-recordings">No recordings yet. Start recording to create one!</p>
          ) : (
            <div className="recordings-list">
              {savedRecordings.map((recording) => (
                <div key={recording.path} className="recording-item">
                  <div className="recording-info">
                    <h4>{recording.name}</h4>
                    <p className="recording-meta">
                      {recording.actionCount} actions • {new Date(recording.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="recording-actions">
                    <div className="replay-controls">
                      <label>Speed:</label>
                      <select
                        value={replaySpeed}
                        onChange={(e) => setReplaySpeed(parseFloat(e.target.value))}
                        className="speed-selector"
                      >
                        <option value="0.5">0.5x</option>
                        <option value="1.0">1.0x</option>
                        <option value="2.0">2.0x</option>
                        <option value="5.0">5.0x</option>
                      </select>
                    </div>
                    <button
                      onClick={() => handleReplay(recording.path)}
                      className="btn-replay"
                      disabled={status.isRecording}
                    >
                      ▶️ Replay
                    </button>
                    <button
                      onClick={() => handleDelete(recording.path)}
                      className="btn-delete"
                      disabled={status.isRecording}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DesktopRecorderPage;
