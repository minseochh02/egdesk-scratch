import React, { useState, useEffect } from 'react';
import './DesktopRecorderPage.css';
import { DownloadedFilesDialog } from './DownloadedFilesDialog';

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
  downloadCount?: number;
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
  const [selectedRecordingForDownloads, setSelectedRecordingForDownloads] = useState<string | null>(null);

  // Recording mode
  const [simpleMode, setSimpleMode] = useState<boolean>(false);

  // Arduino UAC detection
  const [enableUAC, setEnableUAC] = useState<boolean>(false);
  const [arduinoPorts, setArduinoPorts] = useState<Array<{ path: string; manufacturer?: string }>>([]);
  const [selectedArduinoPort, setSelectedArduinoPort] = useState<string>('');
  const [loadingPorts, setLoadingPorts] = useState<boolean>(false);
  const [isWindows, setIsWindows] = useState<boolean>(false);

  // Check platform on mount
  useEffect(() => {
    setIsWindows(window.navigator.platform.toLowerCase().includes('win'));
  }, []);

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
          const handler = simpleMode ? 'simple-recorder:get-status' : 'desktop-recorder:get-status';
          const result = await (window as any).electron.invoke(handler);
          if (result.success) {
            setStatus(result.status);
          }
        } catch (err) {
          console.error('Error polling status:', err);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [status.isRecording, simpleMode]);

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
      // Load both desktop and simple recordings
      const [desktopResult, simpleResult] = await Promise.all([
        (window as any).electron.invoke('desktop-recorder:get-recordings'),
        (window as any).electron.invoke('simple-recorder:get-recordings')
      ]);

      const desktopRecordings = desktopResult.success ? (desktopResult.recordings || []) : [];
      const simpleRecordings = simpleResult.success ? (simpleResult.recordings || []) : [];

      // Load download counts for desktop recordings
      const desktopWithDownloads = await Promise.all(
        desktopRecordings.map(async (recording: SavedRecording) => {
          try {
            const jsonPath = recording.path.replace('.js', '.json');
            const downloadResult = await (window as any).electron.invoke(
              'desktop-recorder:load-downloaded-files-from-json',
              { jsonPath }
            );

            if (downloadResult.success) {
              return {
                ...recording,
                downloadCount: downloadResult.files?.length || 0,
              };
            }
          } catch (err) {
            console.error('Error loading downloads for recording:', err);
          }
          return { ...recording, downloadCount: 0 };
        })
      );

      // Simple recordings don't have downloads
      const simpleWithMetadata = simpleRecordings.map((rec: SavedRecording) => ({
        ...rec,
        downloadCount: 0,
      }));

      // Merge and sort by date
      const allRecordings = [...desktopWithDownloads, ...simpleWithMetadata]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setSavedRecordings(allRecordings);
    } catch (err) {
      console.error('Error loading recordings:', err);
    }
  };

  // Load Arduino ports
  const loadArduinoPorts = async () => {
    setLoadingPorts(true);
    try {
      const result = await (window as any).electron.invoke('desktop-recorder:list-arduino-ports');
      if (result.success) {
        setArduinoPorts(result.ports || []);
        // Auto-select first Arduino if available
        if (result.ports && result.ports.length > 0) {
          setSelectedArduinoPort(result.ports[0].path);
        }
      }
    } catch (err) {
      console.error('Error loading Arduino ports:', err);
    } finally {
      setLoadingPorts(false);
    }
  };

  // Start recording
  const handleStartRecording = async () => {
    setError('');
    setSuccessMessage('');
    try {
      const handler = simpleMode ? 'simple-recorder:start' : 'desktop-recorder:start-with-control-window';
      const result = await (window as any).electron.invoke(handler);
      if (result.success) {
        // Enable UAC detection if configured
        if (enableUAC && selectedArduinoPort) {
          await (window as any).electron.invoke('desktop-recorder:enable-uac-detection', {
            port: selectedArduinoPort,
          });
        }

        setStatus({
          isRecording: true,
          isPaused: false,
          actionCount: 0,
        });
        setGeneratedCode('');
        const uacMessage = enableUAC && selectedArduinoPort
          ? ` UAC detection enabled on ${selectedArduinoPort}.`
          : '';
        const modeMessage = simpleMode
          ? 'Simple mode: Recording click coordinates only.'
          : 'Use hotkeys to control recording.';
        setSuccessMessage(`Recording started! ${modeMessage}${uacMessage}`);
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
      const handler = simpleMode ? 'simple-recorder:stop' : 'desktop-recorder:stop';
      const result = await (window as any).electron.invoke(handler);
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
      const handler = simpleMode ? 'simple-recorder:pause' : 'desktop-recorder:pause';
      const result = await (window as any).electron.invoke(handler);
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
      const handler = simpleMode ? 'simple-recorder:resume' : 'desktop-recorder:resume';
      const result = await (window as any).electron.invoke(handler);
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
      // Determine handler based on file path (simple recordings are in simple-recordings folder)
      const isSimpleRecording = filePath.includes('simple-recordings');
      const handler = isSimpleRecording ? 'simple-recorder:replay' : 'desktop-recorder:replay';
      const result = await (window as any).electron.invoke(handler, {
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
      // Determine handler based on file path
      const isSimpleRecording = filePath.includes('simple-recordings');
      const handler = isSimpleRecording ? 'simple-recorder:delete-recording' : 'desktop-recorder:delete-recording';
      const result = await (window as any).electron.invoke(handler, {
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

        {/* Recording Mode Toggle */}
        {!status.isRecording && (
          <div className="recording-mode-toggle" style={{
            background: '#262626',
            border: '1px solid #333',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={simpleMode}
                onChange={(e) => setSimpleMode(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <div>
                <strong style={{ color: '#fff', fontSize: '1rem' }}>
                  {simpleMode ? '🖱️ Simple Mode (Clicks Only)' : '🎬 Full Recording Mode'}
                </strong>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#888' }}>
                  {simpleMode
                    ? 'Records only mouse click coordinates (x, y) - no desktop switching, keyboard, or window tracking'
                    : 'Records mouse, keyboard, apps, clipboard, downloads - with automatic desktop switching'}
                </p>
              </div>
            </label>
          </div>
        )}

        {/* Arduino UAC Configuration (Windows only) */}
        {!status.isRecording && isWindows && !simpleMode && (
          <div className="arduino-config">
            <h3>🛡️ UAC Prompt Handling (Optional)</h3>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>
              Enable Arduino HID to automatically handle Windows UAC prompts during replay
            </p>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={enableUAC}
                  onChange={(e) => {
                    setEnableUAC(e.target.checked);
                    if (e.target.checked && arduinoPorts.length === 0) {
                      loadArduinoPorts();
                    }
                  }}
                />
                <span>Enable UAC detection with Arduino</span>
              </label>
            </div>

            {enableUAC && (
              <div style={{ marginLeft: '28px', marginBottom: '12px' }}>
                <div style={{ marginBottom: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select
                    value={selectedArduinoPort}
                    onChange={(e) => setSelectedArduinoPort(e.target.value)}
                    disabled={loadingPorts}
                    style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}
                  >
                    {arduinoPorts.length === 0 && <option value="">No Arduino found</option>}
                    {arduinoPorts.map((port) => (
                      <option key={port.path} value={port.path}>
                        {port.path} {port.manufacturer ? `(${port.manufacturer})` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={loadArduinoPorts}
                    disabled={loadingPorts}
                    className="btn-secondary"
                    style={{ padding: '6px 12px' }}
                  >
                    {loadingPorts ? '⟳' : '🔄'} Refresh
                  </button>
                </div>
                <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>
                  Arduino Leonardo/Pro Micro required. <a href="#" style={{ color: '#4a90e2' }}>Setup guide</a>
                </p>
              </div>
            )}
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
                {status.isPaused ? 'Paused' : (simpleMode ? 'Recording Clicks' : 'Recording')}
              </span>
            </div>
            <div className="action-count">
              {simpleMode ? 'Clicks' : 'Actions'} Recorded: <strong>{status.actionCount}</strong>
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
            <div className="hotkey-item" style={{
              background: 'rgba(251, 191, 36, 0.1)',
              border: '1px solid rgba(251, 191, 36, 0.3)'
            }}>
              <span className="hotkey" style={{
                background: 'rgba(251, 191, 36, 0.2)',
                borderColor: 'rgba(251, 191, 36, 0.4)',
                color: '#fbbf24'
              }}>⇧ Shift + F2</span>
              <span className="hotkey-desc" style={{ color: '#fcd34d' }}>
                Toggle overlay mark mode (for banking/secure apps)
              </span>
            </div>
            {!simpleMode && (
              <>
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
              </>
            )}
          </div>
          <p className="dev-mode-note" style={{
            marginTop: '1rem',
            fontSize: '0.9rem',
            color: '#fcd34d',
            background: 'rgba(251, 191, 36, 0.1)',
            padding: '0.75rem',
            borderRadius: '6px',
            border: '1px solid rgba(251, 191, 36, 0.3)'
          }}>
            🛡️ <strong>For Banking/Secure Apps:</strong> If clicks aren't being recorded automatically, press <strong>Shift+F2</strong> to toggle the transparent overlay. When the overlay is active (green tint visible), click on it to mark positions. The overlay will capture your clicks even when the banking app blocks direct input.
          </p>
          {!simpleMode && (
            <p className="dev-mode-note" style={{
              marginTop: '1rem',
              fontSize: '0.9rem',
              color: '#9ca3af',
              fontStyle: 'italic'
            }}>
              📝 Note: Window/app switching detection is disabled in development mode due to macOS permission limitations.
              It will work in production builds.
            </p>
          )}
          {simpleMode && (
            <p className="dev-mode-note" style={{
              marginTop: '1rem',
              fontSize: '0.9rem',
              color: '#22c55e',
              fontStyle: 'italic'
            }}>
              ✅ Simple mode: Only click coordinates are recorded. No desktop switching, keyboard, or window tracking.
            </p>
          )}
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
              {savedRecordings.map((recording) => {
                const isSimpleRecording = recording.path.includes('simple-recordings');
                return (
                  <div key={recording.path} className="recording-item">
                    <div className="recording-info">
                      <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {recording.name}
                        {isSimpleRecording && (
                          <span style={{
                            background: '#22c55e',
                            color: '#000',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: '600'
                          }}>
                            🖱️ SIMPLE
                          </span>
                        )}
                      </h4>
                      <p className="recording-meta">
                        {recording.actionCount} {isSimpleRecording ? 'clicks' : 'actions'} • {new Date(recording.createdAt).toLocaleString()}
                        {recording.downloadCount !== undefined && recording.downloadCount > 0 && (
                          <> • 📥 {recording.downloadCount} file{recording.downloadCount > 1 ? 's' : ''} downloaded</>
                        )}
                      </p>
                    </div>
                  <div className="recording-actions">
                    {recording.downloadCount !== undefined && recording.downloadCount > 0 && (
                      <button
                        onClick={() => {
                          const jsonPath = recording.path.replace('.js', '.json');
                          setSelectedRecordingForDownloads(jsonPath);
                        }}
                        className="btn-downloads"
                        disabled={status.isRecording}
                      >
                        📥 View Downloads ({recording.downloadCount})
                      </button>
                    )}
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
              );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Downloaded Files Dialog */}
      {selectedRecordingForDownloads && (
        <DownloadedFilesDialog
          recordingJsonPath={selectedRecordingForDownloads}
          onClose={() => setSelectedRecordingForDownloads(null)}
        />
      )}
    </div>
  );
};

export default DesktopRecorderPage;
