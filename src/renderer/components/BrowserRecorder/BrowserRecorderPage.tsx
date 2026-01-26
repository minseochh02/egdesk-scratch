import React, { useState, useEffect } from 'react';
import './BrowserRecorderPage.css';
import { ChromeExtensionSelector } from '../ChromeExtensionSelector';

interface Schedule {
  id: string;
  testPath: string;
  testName: string;
  enabled: boolean;
  frequencyType: 'daily' | 'weekly' | 'monthly' | 'custom';
  dayLabel: string;
  scheduledTime: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  customIntervalDays?: number;
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  successCount: number;
  failureCount: number;
}

const BrowserRecorderPage: React.FC = () => {
  // State
  const [chromeUrl, setChromeUrl] = useState('');
  const [savedTests, setSavedTests] = useState<any[]>([]);
  const [showSavedTests, setShowSavedTests] = useState(false);
  const [isRecordingEnhanced, setIsRecordingEnhanced] = useState(false);
  const [currentTestCode, setCurrentTestCode] = useState<string>('');
  const [playwrightDownloads, setPlaywrightDownloads] = useState<any[]>([]);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState<string | null>(null);
  const [scheduleForm, setScheduleForm] = useState<Partial<Schedule>>({
    testPath: '',
    enabled: true,
    frequencyType: 'daily',
    dayLabel: 'Every day',
    scheduledTime: '09:00',
    dayOfWeek: 0,
    dayOfMonth: 1,
  });
  const [showRenameModal, setShowRenameModal] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');
  const [showExtensionSelector, setShowExtensionSelector] = useState(false);
  const [selectedExtensionPaths, setSelectedExtensionPaths] = useState<string[]>([]);

  // Action Chain state
  const [justStoppedRecording, setJustStoppedRecording] = useState(false);
  const [lastRecordingHadDownload, setLastRecordingHadDownload] = useState(false);
  const [lastDownloadedFile, setLastDownloadedFile] = useState<string>('');
  const [lastDownloadPath, setLastDownloadPath] = useState<string>('');  // Full path to downloaded file
  const [lastRecordingScriptPath, setLastRecordingScriptPath] = useState<string>('');  // Path to the script that had the download
  const [uploadDestinationUrl, setUploadDestinationUrl] = useState('');
  const [currentChainId, setCurrentChainId] = useState<string | null>(null);

  // Helper functions
  const addDebugLog = (message: string) => {
    setDebugLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  // Load schedules from backend
  const loadSchedules = async () => {
    try {
      const result = await (window as any).electron.debug.getPlaywrightSchedules();
      if (result.success) {
        setSchedules(result.data || []);
      }
    } catch (error) {
      console.error('Failed to load schedules:', error);
    }
  };

  const openScheduleModal = async (testPath: string) => {
    // Check if schedule already exists for this test
    const result = await (window as any).electron.debug.getPlaywrightScheduleByPath(testPath);

    if (result.success && result.data) {
      // Existing schedule
      setScheduleForm({
        id: result.data.id,
        testPath: result.data.testPath,
        testName: result.data.testName,
        enabled: result.data.enabled,
        frequencyType: result.data.frequencyType,
        scheduledTime: result.data.scheduledTime,
        dayOfWeek: result.data.dayOfWeek,
        dayOfMonth: result.data.dayOfMonth,
        customIntervalDays: result.data.customIntervalDays,
        dayLabel: result.data.dayLabel || getDefaultDayLabel(result.data.frequencyType, result.data)
      });
    } else {
      // New schedule
      const test = savedTests.find(t => t.path === testPath);
      setScheduleForm({
        testPath,
        testName: test?.name || 'Test',
        enabled: true,
        frequencyType: 'daily',
        dayLabel: 'Every day',
        scheduledTime: '09:00',
        dayOfWeek: 0,
        dayOfMonth: 1,
      });
    }
    setShowScheduleModal(testPath);
  };

  const closeScheduleModal = () => {
    setShowScheduleModal(null);
  };

  const saveSchedule = async () => {
    if (!showScheduleModal) return;

    try {
      const scheduleData = {
        testPath: showScheduleModal,
        testName: scheduleForm.testName || 'Test',
        scheduledTime: scheduleForm.scheduledTime || '09:00',
        frequencyType: scheduleForm.frequencyType || 'daily',
        dayOfWeek: scheduleForm.dayOfWeek,
        dayOfMonth: scheduleForm.dayOfMonth,
        customIntervalDays: scheduleForm.customIntervalDays,
      };

      let result;
      if (scheduleForm.id) {
        // Update existing schedule
        result = await (window as any).electron.debug.updatePlaywrightSchedule(
          scheduleForm.id,
          scheduleData
        );

        // Toggle enabled state if changed
        if (scheduleForm.enabled !== undefined) {
          await (window as any).electron.debug.togglePlaywrightSchedule(
            scheduleForm.id,
            scheduleForm.enabled
          );
        }
      } else {
        // Create new schedule
        result = await (window as any).electron.debug.createPlaywrightSchedule(scheduleData);
      }

      if (result.success) {
        addDebugLog(`📅 Schedule ${scheduleForm.enabled ? 'set' : 'disabled'} for test: ${showScheduleModal}`);
        await loadSchedules(); // Reload schedules
        closeScheduleModal();
      } else {
        alert(`Failed to save schedule: ${result.error}`);
      }
    } catch (error) {
      console.error('Error saving schedule:', error);
      alert('Failed to save schedule');
    }
  };

  const removeSchedule = async (testPath: string) => {
    try {
      // Find the schedule by test path
      const schedule = schedules.find(s => s.testPath === testPath);
      if (!schedule) return;

      const result = await (window as any).electron.debug.deletePlaywrightSchedule(schedule.id);

      if (result.success) {
        addDebugLog(`🗑️ Schedule removed for test: ${testPath}`);
        await loadSchedules(); // Reload schedules
      } else {
        alert(`Failed to remove schedule: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error removing schedule:', error);
      alert('Failed to remove schedule');
    }
  };

  const getDefaultDayLabel = (frequencyType: string, data: any): string => {
    switch (frequencyType) {
      case 'daily':
        return 'Every day';
      case 'weekly':
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[data.dayOfWeek || 0];
      case 'monthly':
        return `Day ${data.dayOfMonth || 1} of month`;
      case 'custom':
        return `Every ${data.customIntervalDays || 1} days`;
      default:
        return 'Custom';
    }
  };

  const getScheduleDescription = (schedule: Schedule): string => {
    if (!schedule.enabled) return 'Disabled';

    const dayLabel = schedule.dayLabel || getDefaultDayLabel(schedule.frequencyType, schedule);
    return `${dayLabel} at ${schedule.scheduledTime}`;
  };

  const openRenameModal = (test: any) => {
    setRenameValue(test.name);
    setShowRenameModal(test.path);
  };

  const closeRenameModal = () => {
    setShowRenameModal(null);
    setRenameValue('');
  };

  const handleRename = async () => {
    if (!showRenameModal || !renameValue.trim()) return;

    try {
      const result = await (window as any).electron.debug.renamePlaywrightTest(showRenameModal, renameValue.trim());

      if (result.success) {
        addDebugLog(`✏️ Test renamed to: ${renameValue.trim()}`);
        // Refresh test list
        const testsResult = await (window as any).electron.debug.getPlaywrightTests();
        if (testsResult.success) {
          setSavedTests(testsResult.tests);
        }
        closeRenameModal();
      } else {
        alert(`Failed to rename test: ${result.error}`);
      }
    } catch (error) {
      console.error('Error renaming test:', error);
      alert('Failed to rename test');
    }
  };

  const loadPlaywrightDownloads = async () => {
    try {
      const result = await (window as any).electron.debug.getPlaywrightDownloads();
      if (result.success) {
        setPlaywrightDownloads(result.files || []);
      }
    } catch (error) {
      console.error('[BrowserRecorder] Failed to load playwright downloads:', error);
    }
  };

  const handleOpenDownload = async (filePath: string) => {
    try {
      await (window as any).electron.debug.openPlaywrightDownload(filePath);
    } catch (error) {
      console.error('[BrowserRecorder] Failed to open download:', error);
      alert('Failed to open file');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Load saved tests when component mounts
  useEffect(() => {
    (async () => {
      const result = await (window as any).electron.debug.getPlaywrightTests();
      if (result.success) {
        setSavedTests(result.tests);
      }
    })();
  }, []);

  // Load schedules when component mounts
  useEffect(() => {
    loadSchedules();
  }, []);

  // Load playwright downloads when component mounts
  useEffect(() => {
    loadPlaywrightDownloads();
  }, []);

  // Load saved extension preferences when component mounts
  useEffect(() => {
    (async () => {
      try {
        const result = await (window as any).electron.chromeExtensions?.getPreferences();
        if (result?.success && result.selectedExtensions) {
          setSelectedExtensionPaths(result.selectedExtensions);
          if (result.selectedExtensions.length > 0) {
            addDebugLog(`🧩 Loaded ${result.selectedExtensions.length} saved extension(s)`);
          }
        }
      } catch (error) {
        console.error('Failed to load extension preferences:', error);
      }
    })();
  }, []);

  // Listen for Playwright test saved events
  useEffect(() => {
    const handleTestSaved = (data: any) => {
      if (data && data.filePath) {
        addDebugLog(`📁 Test saved: ${data.filePath}`);
      }

      // Check if downloads were detected for chain support
      if (data && data.hasDownloads) {
        setLastDownloadedFile(data.lastDownloadedFile || 'unknown file');
        setLastDownloadPath(data.lastDownloadPath || '');  // Store full path from previous recording
        setLastRecordingScriptPath(data.filePath || '');  // Store script path for chain linking
        setLastRecordingHadDownload(true);
        setJustStoppedRecording(true);
        addDebugLog(`📥 Download detected: ${data.lastDownloadedFile}`);
        addDebugLog(`📂 Full path: ${data.lastDownloadPath}`);

        // Auto-hide chain UI after 5 minutes
        setTimeout(() => {
          setJustStoppedRecording(false);
          setLastRecordingHadDownload(false);
        }, 300000);
      }

      // Refresh test list and schedules
      (async () => {
        const result = await (window as any).electron.debug.getPlaywrightTests();
        if (result.success) {
          setSavedTests(result.tests);
        }
        await loadSchedules();
      })();
    };

    const unsubscribe = (window as any).electron.ipcRenderer.on('playwright-test-saved', handleTestSaved);

    return () => {
      unsubscribe();
    };
  }, []);

  // Listen for real-time test updates
  useEffect(() => {
    const handleTestUpdate = (data: any) => {
      if (data && data.code) {
        setCurrentTestCode(data.code);
      }
    };

    const unsubscribe = (window as any).electron.ipcRenderer.on('playwright-test-update', handleTestUpdate);

    return () => {
      unsubscribe();
    };
  }, []);

  // Listen for auto-stop events
  useEffect(() => {
    const handleAutoStop = (data: any) => {
      addDebugLog(`🔌 Recording auto-stopped: ${data.reason}`);
      setIsRecordingEnhanced(false);
      setCurrentTestCode('');

      // Refresh test list
      (async () => {
        const result = await (window as any).electron.debug.getPlaywrightTests();
        if (result.success) {
          setSavedTests(result.tests);
        }
      })();
    };

    const unsubscribe = (window as any).electron.ipcRenderer.on('recorder-auto-stopped', handleAutoStop);

    return () => {
      unsubscribe();
    };
  }, []);

  // Listen for Playwright test errors
  useEffect(() => {
    const handleTestError = (data: any) => {
      console.error('Playwright test error:', data);
      addDebugLog(`❌ Test error: ${data.error}`);

      // Show user-friendly alert if it's a user-friendly error
      if (data.userFriendly) {
        alert(data.error);

        // Log technical details to console for debugging
        if (data.details || data.technicalDetails) {
          console.log('Technical details:', data.details || data.technicalDetails);
        }
      }
    };

    const handleTestInfo = (data: any) => {
      console.log('Playwright test info:', data);
      addDebugLog(`ℹ️ ${data.message}`);
    };

    const handleTestCompleted = (data: any) => {
      if (data.success) {
        addDebugLog(`✅ Test completed successfully`);
      } else {
        const errorMsg = data.error || 'Unknown error';
        addDebugLog(`❌ Test failed: ${errorMsg}`);

        // Log all details to console for debugging
        console.error('=== Test Replay Failed ===');
        console.error('Error:', errorMsg);
        if (data.stack) {
          console.error('Stack:', data.stack);
        }
        if (data.details) {
          console.error('Details:', data.details);
        }
        console.error('=========================');

        // Show alert with truncated error (first 500 chars)
        const displayError = errorMsg.length > 500
          ? errorMsg.substring(0, 500) + '...\n\n(See browser console for full details)'
          : errorMsg;
        alert(`Test replay failed:\n\n${displayError}`);
      }
    };

    const unsubscribe1 = (window as any).electron.ipcRenderer.on('playwright-test-error', handleTestError);
    const unsubscribe2 = (window as any).electron.ipcRenderer.on('playwright-test-info', handleTestInfo);
    const unsubscribe3 = (window as any).electron.ipcRenderer.on('playwright-test-completed', handleTestCompleted);

    return () => {
      unsubscribe1();
      unsubscribe2();
      unsubscribe3();
    };
  }, []);

  // Handle starting upload recording (chain next action)
  const startUploadRecording = async () => {
    if (!uploadDestinationUrl) {
      addDebugLog('⚠️ Please enter a destination URL');
      return;
    }

    try {
      addDebugLog(`🔗 Starting upload recording for ${lastDownloadedFile}...`);
      addDebugLog(`📍 Destination: ${uploadDestinationUrl}`);

      // Generate or use existing chain ID
      const chainId = currentChainId || `chain-${Date.now()}`;

      // Start new recording as part of chain
      const result = await (window as any).electron.debug.launchBrowserRecorderEnhanced({
        url: uploadDestinationUrl.startsWith('http')
          ? uploadDestinationUrl
          : `https://${uploadDestinationUrl}`,
        chainId: chainId,
        previousDownload: lastDownloadPath,  // Use full path instead of just filename
        previousScriptPath: lastRecordingScriptPath,  // Path to the download script
        extensionPaths: selectedExtensionPaths,
      });

      if (result?.success) {
        if (!currentChainId) {
          setCurrentChainId(chainId);
          addDebugLog(`🔗 Chain created: ${chainId}`);
        }

        setIsRecordingEnhanced(true);
        setJustStoppedRecording(false);
        setUploadDestinationUrl(''); // Clear input

        addDebugLog('✅ Upload recording started');
        addDebugLog('📌 When you click file upload input, your downloaded file will be auto-selected');
      } else {
        addDebugLog(`❌ Failed to start upload recording: ${result?.error}`);
      }
    } catch (error) {
      console.error('Error starting upload recording:', error);
      addDebugLog(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const finishWithoutChain = () => {
    addDebugLog('✅ Recording complete (no upload chain)');
    setJustStoppedRecording(false);
    setLastRecordingHadDownload(false);
    setLastDownloadedFile('');
    setLastDownloadPath('');
    setLastRecordingScriptPath('');
    setUploadDestinationUrl('');
    setCurrentChainId(null);
  };

  return (
    <div className="browser-recorder-page">
      <div className="browser-recorder-scroll">
        <div className="browser-recorder-container">
          <div className="browser-recorder-content">
            {/* Header */}
            <div className="browser-recorder-header">
              <h1 className="browser-recorder-title">Browser Recorder</h1>
              <p className="browser-recorder-subtitle">Record and replay browser interactions with keyboard tracking</p>
            </div>

            {/* URL Input & Recording Controls Section */}
            <div className="browser-recorder-section">
              <h2 className="browser-recorder-section-title">Record New Test</h2>
              <div className="browser-recorder-url-input-container">
                <input
                  type="url"
                  placeholder="Enter URL to record (e.g., https://example.com)"
                  value={chromeUrl}
                  onChange={(e) => setChromeUrl(e.target.value)}
                  className="browser-recorder-url-input"
                  disabled={isRecordingEnhanced}
                />
              </div>

              <div className="browser-recorder-recording-controls">
                {!isRecordingEnhanced ? (
                  <>
                    <button
                      onClick={() => setShowExtensionSelector(true)}
                      className="browser-recorder-btn browser-recorder-btn-secondary"
                      disabled={isRecordingEnhanced}
                      title="Select Chrome extensions to load during recording"
                    >
                      🧩 Extensions ({selectedExtensionPaths.length})
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          if (!chromeUrl) {
                            addDebugLog('⚠️ Please enter a URL first');
                            return;
                          }

                          addDebugLog('🚀 Launching enhanced Playwright recorder with keyboard tracking...');
                          if (selectedExtensionPaths.length > 0) {
                            addDebugLog(`🧩 Loading ${selectedExtensionPaths.length} Chrome extension(s)`);
                          }

                          const result = await (window as any).electron.debug.launchBrowserRecorderEnhanced({
                            url: chromeUrl.startsWith('http') ? chromeUrl : `https://${chromeUrl}`,
                            extensionPaths: selectedExtensionPaths
                          });

                          if (result?.success) {
                            addDebugLog('✅ Enhanced recorder launched successfully');
                            addDebugLog('📝 All keyboard events including Enter will be captured');
                            addDebugLog(`📁 Test file: ${result.filePath}`);
                            addDebugLog('🖥️ Code viewer window opened - watch it update in real-time!');
                            addDebugLog('⏰ Click "Stop Recording" button or close browser when done');
                            setIsRecordingEnhanced(true);
                          } else {
                            addDebugLog(`❌ Failed to launch enhanced recorder: ${result?.error}`);
                          }
                        } catch (error) {
                          console.error('Error launching recorder:', error);
                          addDebugLog(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                        }
                      }}
                      className="browser-recorder-btn browser-recorder-btn-primary browser-recorder-btn-record"
                    >
                      🎹 Start Recording
                    </button>
                  </>
                ) : (
                  <button
                    onClick={async () => {
                      console.log('🔴 Stop Recording button clicked');
                      addDebugLog('⏹️ Stopping enhanced recorder...');

                      try {
                        console.log('📞 Calling stopBrowserRecorderEnhanced...');
                        const result = await (window as any).electron.debug.stopBrowserRecorderEnhanced();
                        console.log('📥 Received result:', result);

                        if (result?.success) {
                          addDebugLog('✅ Recording saved successfully');
                          addDebugLog(`📁 Test saved to: ${result.filePath}`);
                          setIsRecordingEnhanced(false);
                          setCurrentTestCode(''); // Clear the code viewer

                          // Refresh test list
                          const testsResult = await (window as any).electron.debug.getPlaywrightTests();
                          if (testsResult.success) {
                            setSavedTests(testsResult.tests);
                          }
                        } else {
                          addDebugLog(`❌ Failed to stop recorder: ${result?.error || 'Unknown error'}`);
                          console.error('Stop recorder failed:', result);
                          // Reset recording state even on failure so user isn't stuck
                          setIsRecordingEnhanced(false);
                        }
                      } catch (error) {
                        console.error('❌ Exception while stopping recorder:', error);
                        addDebugLog(`❌ Exception: ${error instanceof Error ? error.message : 'Unknown error'}`);
                        // Reset recording state on exception so user isn't stuck
                        setIsRecordingEnhanced(false);
                      }
                    }}
                    className="browser-recorder-btn browser-recorder-btn-danger browser-recorder-btn-stop"
                  >
                    ⏹️ Stop Recording
                  </button>
                )}
              </div>

              {/* Real-time Test Code Display */}
              {isRecordingEnhanced && currentTestCode && (
                <div className="browser-recorder-code-viewer-container">
                  <h3 className="browser-recorder-code-viewer-title">📝 Generated Test Code (Real-time)</h3>
                  <pre className="browser-recorder-code-viewer">
                    <code>{currentTestCode}</code>
                  </pre>
                </div>
              )}

              {/* Action Chain Upload Section */}
              {justStoppedRecording && lastRecordingHadDownload && !isRecordingEnhanced && (
                <div className="action-chain-upload">
                  <div className="chain-download-info">
                    <span className="success-icon">✅</span>
                    <span className="download-message">
                      File downloaded: <strong>{lastDownloadedFile}</strong>
                    </span>
                  </div>

                  <div className="chain-upload-form">
                    <label className="chain-upload-label">
                      Upload the downloaded file to:
                    </label>
                    <div className="chain-upload-controls">
                      <input
                        type="url"
                        placeholder="https://upload.example.com"
                        value={uploadDestinationUrl}
                        onChange={(e) => setUploadDestinationUrl(e.target.value)}
                        className="browser-recorder-url-input"
                      />
                      <button
                        onClick={startUploadRecording}
                        className="browser-recorder-btn browser-recorder-btn-primary"
                        disabled={!uploadDestinationUrl}
                      >
                        🎥 Start Upload Recording
                      </button>
                      <button
                        onClick={finishWithoutChain}
                        className="browser-recorder-btn browser-recorder-btn-secondary"
                      >
                        ✅ Done
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Saved Tests Section */}
            <div className="browser-recorder-section">
              <div className="browser-recorder-section-header">
                <h2 className="browser-recorder-section-title">Saved Tests</h2>
                <button
                  onClick={async () => {
                    const result = await (window as any).electron.debug.getPlaywrightTests();
                    if (result.success) {
                      setSavedTests(result.tests);
                      setShowSavedTests(!showSavedTests);
                    }
                  }}
                  className="browser-recorder-btn browser-recorder-btn-secondary browser-recorder-btn-toggle"
                >
                  {showSavedTests ? 'Hide Tests' : `View Saved Tests (${savedTests.length})`}
                </button>
              </div>

              {showSavedTests && savedTests.length > 0 && (
                <div className="browser-recorder-saved-tests-container">
                  {savedTests.map((test, index) => (
                      <div key={index} className="browser-recorder-test-item">
                        <div className="browser-recorder-test-header">
                          <div className="browser-recorder-test-info">
                            <div className="browser-recorder-test-name-row">
                              <strong className="browser-recorder-test-name">{test.name}</strong>
                              <span className="browser-recorder-test-badge">⏱️ Auto-Timed</span>
                              {test.chainId && test.chainOrder && (
                                <span className="browser-recorder-test-badge browser-recorder-chain-badge" title={`Part of chain: ${test.chainId}`}>
                                  🔗 Step {test.chainOrder}
                                </span>
                              )}
                              {(() => {
                                const schedule = schedules.find(s => s.testPath === test.path);
                                return schedule?.enabled && (
                                  <span className="test-badge browser-recorder-schedule-badge">📅 Scheduled</span>
                                );
                              })()}
                            </div>
                            <div className="browser-recorder-test-meta">
                              Created: {new Date(test.createdAt).toLocaleString()} | Size: {test.size} bytes
                            </div>
                            {(() => {
                              const schedule = schedules.find(s => s.testPath === test.path);
                              return schedule?.enabled && (
                                <div className="browser-recorder-schedule-info">
                                  📅 {getScheduleDescription(schedule)}
                                </div>
                              );
                            })()}
                          </div>
                          <div className="browser-recorder-test-actions">
                            <button
                              onClick={async () => {
                                const result = await (window as any).electron.debug.viewPlaywrightTest(test.path);
                                if (result.success) {
                                  console.log(`👁️ Viewing test: ${test.name}`);
                                  addDebugLog(`👁️ Opened test in code viewer: ${test.name}`);
                                } else {
                                  alert(`Failed to view test: ${result.error}`);
                                }
                              }}
                              className="browser-recorder-btn browser-recorder-btn-sm browser-recorder-btn-view"
                              title="View code"
                            >
                              👁️ View
                            </button>
                            <button
                              onClick={() => openRenameModal(test)}
                              className="browser-recorder-btn browser-recorder-btn-sm browser-recorder-btn-edit"
                              title="Rename test"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              onClick={async () => {
                                const result = await (window as any).electron.debug.runPlaywrightTest(test.path);
                                if (result.success) {
                                  console.log(`🎬 Running test with timing: ${test.name}`);
                                  addDebugLog(`🎬⏱️ Running test with timing: ${test.name}`);
                                } else {
                                  alert(`Failed to run test: ${result.error}`);
                                }
                              }}
                              className="browser-recorder-btn browser-recorder-btn-sm browser-recorder-btn-replay"
                            >
                              ▶️ Replay
                            </button>
                            {test.chainId && test.chainScripts && test.chainScripts.length > 1 && (
                              <button
                                onClick={async () => {
                                  addDebugLog(`🔗 Running chain: ${test.chainId}`);
                                  const result = await (window as any).electron.debug.runChain(test.chainId);
                                  if (result.success) {
                                    console.log(`🔗 Chain execution completed: ${test.chainId}`);
                                    addDebugLog(`✅ Chain execution completed`);
                                  } else {
                                    alert(`Failed to run chain: ${result.error}`);
                                    addDebugLog(`❌ Chain execution failed: ${result.error}`);
                                  }
                                }}
                                className="browser-recorder-btn browser-recorder-btn-sm browser-recorder-btn-chain"
                                title="Run entire chain of tests"
                              >
                                🔗 Replay Chain ({test.chainScripts.length} steps)
                              </button>
                            )}
                            <button
                              onClick={() => openScheduleModal(test.path)}
                              className={`browser-recorder-btn btn-sm browser-recorder-btn-schedule ${schedules.find(s => s.testPath === test.path && s.enabled) ? 'scheduled' : ''}`}
                              title="Schedule test"
                            >
                              📅
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm(`Are you sure you want to delete "${test.name}"?`)) {
                                  const result = await (window as any).electron.debug.deletePlaywrightTest(test.path);
                                  if (result.success) {
                                    // Refresh the test list
                                    const refreshResult = await (window as any).electron.debug.getPlaywrightTests();
                                    if (refreshResult.success) {
                                      setSavedTests(refreshResult.tests);
                                    }
                                    addDebugLog(`🗑️ Deleted test: ${test.name}`);
                                  } else {
                                    alert(`Failed to delete test: ${result.error}`);
                                  }
                                }
                              }}
                              className="browser-recorder-btn browser-recorder-btn-sm browser-recorder-btn-delete"
                              title="Delete test"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                        <div className="browser-recorder-test-preview">
                          {test.preview}
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {showSavedTests && savedTests.length === 0 && (
                <p className="browser-recorder-empty-message">No saved tests yet. Record your first test above!</p>
              )}
            </div>

            {/* Schedule Modal */}
            {showScheduleModal && (
              <div className="browser-recorder-modal-overlay" onClick={closeScheduleModal}>
                <div className="browser-recorder-schedule-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="browser-recorder-modal-header">
                    <h3 className="browser-recorder-modal-title">📅 Schedule Test Replay</h3>
                    <button className="browser-recorder-modal-close" onClick={closeScheduleModal}>✕</button>
                  </div>

                  <div className="browser-recorder-modal-body">
                    <div className="browser-recorder-form-group">
                      <label className="browser-recorder-form-label">
                        <input
                          type="checkbox"
                          checked={scheduleForm.enabled}
                          onChange={(e) => setScheduleForm({ ...scheduleForm, enabled: e.target.checked })}
                          className="browser-recorder-form-checkbox"
                        />
                        <span>Enable Schedule</span>
                      </label>
                    </div>

                    {scheduleForm.enabled && (
                      <>
                        <div className="browser-recorder-form-group">
                          <label className="browser-recorder-form-label">Frequency</label>
                          <select
                            value={scheduleForm.frequencyType}
                            onChange={(e) => {
                              const freq = e.target.value as 'daily' | 'weekly' | 'monthly' | 'custom';
                              let newDayLabel = '';

                              if (freq === 'daily') {
                                newDayLabel = 'Every day';
                              } else if (freq === 'weekly') {
                                const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                                newDayLabel = days[scheduleForm.dayOfWeek || 0];
                              } else if (freq === 'monthly') {
                                newDayLabel = `Day ${scheduleForm.dayOfMonth || 1} of month`;
                              } else {
                                newDayLabel = scheduleForm.dayLabel || 'Custom cadence';
                              }

                              setScheduleForm({ ...scheduleForm, frequencyType: freq, dayLabel: newDayLabel });
                            }}
                            className="browser-recorder-form-select"
                          >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="custom">Custom</option>
                          </select>
                        </div>

                        {scheduleForm.frequencyType === 'weekly' && (
                          <div className="browser-recorder-form-group">
                            <label className="browser-recorder-form-label">Day of Week</label>
                            <select
                              value={scheduleForm.dayOfWeek || 0}
                              onChange={(e) => {
                                const dayIndex = parseInt(e.target.value);
                                const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                                setScheduleForm({
                                  ...scheduleForm,
                                  dayOfWeek: dayIndex,
                                  dayLabel: days[dayIndex]
                                });
                              }}
                              className="browser-recorder-form-select"
                            >
                              <option value="0">Sunday</option>
                              <option value="1">Monday</option>
                              <option value="2">Tuesday</option>
                              <option value="3">Wednesday</option>
                              <option value="4">Thursday</option>
                              <option value="5">Friday</option>
                              <option value="6">Saturday</option>
                            </select>
                          </div>
                        )}

                        {scheduleForm.frequencyType === 'monthly' && (
                          <div className="browser-recorder-form-group">
                            <label className="browser-recorder-form-label">Day of Month</label>
                            <input
                              type="number"
                              min="1"
                              max="31"
                              value={scheduleForm.dayOfMonth || 1}
                              onChange={(e) => {
                                const day = parseInt(e.target.value);
                                setScheduleForm({
                                  ...scheduleForm,
                                  dayOfMonth: day,
                                  dayLabel: `Day ${day} of month`
                                });
                              }}
                              className="browser-recorder-form-input"
                            />
                          </div>
                        )}

                        {scheduleForm.frequencyType === 'custom' && (
                          <div className="browser-recorder-form-group">
                            <label className="browser-recorder-form-label">Interval (Days)</label>
                            <input
                              type="number"
                              min="1"
                              value={scheduleForm.customIntervalDays || 1}
                              onChange={(e) => {
                                const days = parseInt(e.target.value);
                                setScheduleForm({
                                  ...scheduleForm,
                                  customIntervalDays: days,
                                  dayLabel: `Every ${days} days`
                                });
                              }}
                              className="browser-recorder-form-input"
                              placeholder="Number of days"
                            />
                          </div>
                        )}

                        <div className="browser-recorder-form-group">
                          <label className="browser-recorder-form-label">Time</label>
                          <input
                            type="time"
                            value={scheduleForm.scheduledTime}
                            onChange={(e) => setScheduleForm({ ...scheduleForm, scheduledTime: e.target.value })}
                            className="browser-recorder-form-input"
                          />
                        </div>

                        <div className="browser-recorder-schedule-preview">
                          <strong>Schedule:</strong> {scheduleForm.frequencyType && scheduleForm.scheduledTime ? getScheduleDescription(scheduleForm as Schedule) : 'Configure schedule above'}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="browser-recorder-modal-footer">
                    {scheduleForm.id && (
                      <button
                        onClick={() => {
                          if (showScheduleModal) {
                            removeSchedule(showScheduleModal);
                            closeScheduleModal();
                          }
                        }}
                        className="browser-recorder-btn browser-recorder-btn-sm btn-secondary"
                      >
                        Remove Schedule
                      </button>
                    )}
                    <button onClick={closeScheduleModal} className="browser-recorder-btn browser-recorder-btn-sm btn-secondary">
                      Cancel
                    </button>
                    <button onClick={saveSchedule} className="browser-recorder-btn browser-recorder-btn-sm btn-primary">
                      Save Schedule
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Rename Modal */}
            {showRenameModal && (
              <div className="browser-recorder-modal-overlay" onClick={closeRenameModal}>
                <div className="browser-recorder-schedule-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="browser-recorder-modal-header">
                    <h3 className="browser-recorder-modal-title">✏️ Rename Test</h3>
                    <button className="browser-recorder-modal-close" onClick={closeRenameModal}>✕</button>
                  </div>

                  <div className="browser-recorder-modal-body">
                    <div className="browser-recorder-form-group">
                      <label className="browser-recorder-form-label">Test Name</label>
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="browser-recorder-form-input"
                        placeholder="Enter new test name"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleRename();
                          } else if (e.key === 'Escape') {
                            closeRenameModal();
                          }
                        }}
                        autoFocus
                      />
                      <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                        The file will be renamed to: {renameValue.trim() || 'test'}.spec.ts
                      </small>
                    </div>
                  </div>

                  <div className="browser-recorder-modal-footer">
                    <button onClick={closeRenameModal} className="browser-recorder-btn browser-recorder-btn-sm btn-secondary">
                      Cancel
                    </button>
                    <button onClick={handleRename} className="browser-recorder-btn browser-recorder-btn-sm btn-primary">
                      Rename
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Downloads Section */}
            <div className="browser-recorder-section">
              <div className="browser-recorder-section-header">
                <h2 className="browser-recorder-section-title">📥 Browser Recorder Downloads</h2>
                <div className="browser-recorder-downloads-actions">
                  <button
                    onClick={async () => {
                      try {
                        await (window as any).electron.debug.openPlaywrightDownloadsFolder();
                      } catch (error) {
                        console.error('Failed to open folder:', error);
                        alert('Failed to open folder');
                      }
                    }}
                    className="browser-recorder-btn browser-recorder-btn-sm btn-secondary"
                  >
                    Open Folder
                  </button>
                  <button
                    onClick={loadPlaywrightDownloads}
                    className="browser-recorder-btn browser-recorder-btn-sm btn-primary"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {playwrightDownloads.length === 0 ? (
                <p className="browser-recorder-empty-message">No downloaded files yet.</p>
              ) : (
                <div className="browser-recorder-downloads-container">
                  {playwrightDownloads.map((file, idx) => (
                    <div
                      key={idx}
                      className="browser-recorder-download-item"
                      onClick={() => handleOpenDownload(file.path)}
                    >
                      <div className="browser-recorder-download-info">
                        <div className="browser-recorder-download-name">📄 {file.name}</div>
                        <div className="browser-recorder-download-meta">
                          {file.scriptFolder && <span>📁 {file.scriptFolder} • </span>}
                          {formatFileSize(file.size)} • {new Date(file.modified).toLocaleString()}
                        </div>
                      </div>
                      <div className="browser-recorder-download-action">Open →</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Debug Console Section */}
            {debugLogs.length > 0 && (
              <div className="browser-recorder-section">
                <div className="browser-recorder-section-header">
                  <h2 className="browser-recorder-section-title">Debug Console</h2>
                  <button
                    onClick={() => setDebugLogs([])}
                    className="browser-recorder-btn browser-recorder-btn-sm btn-secondary"
                  >
                    Clear Logs
                  </button>
                </div>
                <div className="browser-recorder-debug-console">
                  {debugLogs.map((log, index) => (
                    <div key={index} className="browser-recorder-debug-log-entry">
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chrome Extension Selector Modal */}
      <ChromeExtensionSelector
        isOpen={showExtensionSelector}
        onClose={() => setShowExtensionSelector(false)}
        onSelect={(extensionPaths) => {
          setSelectedExtensionPaths(extensionPaths);
          addDebugLog(`🧩 Selected ${extensionPaths.length} Chrome extension(s)`);
        }}
      />
    </div>
  );
};

export default BrowserRecorderPage;
