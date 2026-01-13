import React, { useState, useEffect } from 'react';
import './PlaywrightRecorderPage.css';

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

const PlaywrightRecorderPage: React.FC = () => {
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

  const loadPlaywrightDownloads = async () => {
    try {
      const result = await (window as any).electron.debug.getPlaywrightDownloads();
      if (result.success) {
        setPlaywrightDownloads(result.files || []);
      }
    } catch (error) {
      console.error('[PlaywrightRecorder] Failed to load playwright downloads:', error);
    }
  };

  const handleOpenDownload = async (filePath: string) => {
    try {
      await (window as any).electron.debug.openPlaywrightDownload(filePath);
    } catch (error) {
      console.error('[PlaywrightRecorder] Failed to open download:', error);
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

  // Listen for Playwright test saved events
  useEffect(() => {
    const handleTestSaved = (event: any, data: any) => {
      if (data && data.filePath) {
        addDebugLog(`📁 Test saved: ${data.filePath}`);
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

    (window as any).electron.ipcRenderer.on('playwright-test-saved', handleTestSaved);

    return () => {
      (window as any).electron.ipcRenderer.removeListener('playwright-test-saved', handleTestSaved);
    };
  }, []);

  // Listen for real-time test updates
  useEffect(() => {
    const handleTestUpdate = (event: any, data: any) => {
      if (data && data.code) {
        setCurrentTestCode(data.code);
      }
    };

    (window as any).electron.ipcRenderer.on('playwright-test-update', handleTestUpdate);

    return () => {
      (window as any).electron.ipcRenderer.removeListener('playwright-test-update', handleTestUpdate);
    };
  }, []);

  // Listen for auto-stop events
  useEffect(() => {
    const handleAutoStop = (event: any, data: any) => {
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

    (window as any).electron.ipcRenderer.on('recorder-auto-stopped', handleAutoStop);

    return () => {
      (window as any).electron.ipcRenderer.removeListener('recorder-auto-stopped', handleAutoStop);
    };
  }, []);

  // Listen for Playwright test errors
  useEffect(() => {
    const handleTestError = (event: any, data: any) => {
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

    const handleTestInfo = (event: any, data: any) => {
      console.log('Playwright test info:', data);
      addDebugLog(`ℹ️ ${data.message}`);
    };

    const handleTestCompleted = (event: any, data: any) => {
      if (data.success) {
        addDebugLog(`✅ Test completed successfully`);
      } else {
        addDebugLog(`❌ Test failed: ${data.error || 'Unknown error'}`);

        // Show alert for test failures
        alert(`Test replay failed: ${data.error || 'Unknown error'}`);

        // Log details for debugging
        if (data.details) {
          console.log('Test failure details:', data.details);
        }
      }
    };

    (window as any).electron.ipcRenderer.on('playwright-test-error', handleTestError);
    (window as any).electron.ipcRenderer.on('playwright-test-info', handleTestInfo);
    (window as any).electron.ipcRenderer.on('playwright-test-completed', handleTestCompleted);

    return () => {
      (window as any).electron.ipcRenderer.removeListener('playwright-test-error', handleTestError);
      (window as any).electron.ipcRenderer.removeListener('playwright-test-info', handleTestInfo);
      (window as any).electron.ipcRenderer.removeListener('playwright-test-completed', handleTestCompleted);
    };
  }, []);

  return (
    <div className="playwright-recorder-page">
      <div className="playwright-recorder-scroll">
        <div className="playwright-recorder-container">
          <div className="playwright-recorder-content">
            {/* Header */}
            <div className="playwright-recorder-header">
              <h1 className="playwright-recorder-title">Playwright Recorder</h1>
              <p className="playwright-recorder-subtitle">Record and replay browser interactions with keyboard tracking</p>
            </div>

            {/* URL Input & Recording Controls Section */}
            <div className="playwright-recorder-section">
              <h2 className="playwright-recorder-section-title">Record New Test</h2>
              <div className="playwright-recorder-url-input-container">
                <input
                  type="url"
                  placeholder="Enter URL to record (e.g., https://example.com)"
                  value={chromeUrl}
                  onChange={(e) => setChromeUrl(e.target.value)}
                  className="playwright-recorder-url-input"
                  disabled={isRecordingEnhanced}
                />
              </div>

              <div className="playwright-recorder-recording-controls">
                {!isRecordingEnhanced ? (
                  <button
                    onClick={async () => {
                      try {
                        if (!chromeUrl) {
                          addDebugLog('⚠️ Please enter a URL first');
                          return;
                        }

                        addDebugLog('🚀 Launching enhanced Playwright recorder with keyboard tracking...');

                        const result = await (window as any).electron.debug.launchPlaywrightRecorderEnhanced(
                          chromeUrl.startsWith('http') ? chromeUrl : `https://${chromeUrl}`
                        );

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
                    className="playwright-recorder-btn playwright-recorder-btn-primary playwright-recorder-btn-record"
                  >
                    🎹 Start Recording
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      addDebugLog('⏹️ Stopping enhanced recorder...');

                      const result = await (window as any).electron.debug.stopPlaywrightRecorderEnhanced();

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
                        addDebugLog(`❌ Failed to stop recorder: ${result?.error}`);
                      }
                    }}
                    className="playwright-recorder-btn playwright-recorder-btn-danger playwright-recorder-btn-stop"
                  >
                    ⏹️ Stop Recording
                  </button>
                )}
              </div>

              {/* Real-time Test Code Display */}
              {isRecordingEnhanced && currentTestCode && (
                <div className="playwright-recorder-code-viewer-container">
                  <h3 className="playwright-recorder-code-viewer-title">📝 Generated Test Code (Real-time)</h3>
                  <pre className="playwright-recorder-code-viewer">
                    <code>{currentTestCode}</code>
                  </pre>
                </div>
              )}
            </div>

            {/* Saved Tests Section */}
            <div className="playwright-recorder-section">
              <div className="playwright-recorder-section-header">
                <h2 className="playwright-recorder-section-title">Saved Tests</h2>
                <button
                  onClick={async () => {
                    const result = await (window as any).electron.debug.getPlaywrightTests();
                    if (result.success) {
                      setSavedTests(result.tests);
                      setShowSavedTests(!showSavedTests);
                    }
                  }}
                  className="playwright-recorder-btn playwright-recorder-btn-secondary playwright-recorder-btn-toggle"
                >
                  {showSavedTests ? 'Hide Tests' : `View Saved Tests (${savedTests.length})`}
                </button>
              </div>

              {showSavedTests && savedTests.length > 0 && (
                <div className="playwright-recorder-saved-tests-container">
                  {savedTests.map((test, index) => (
                      <div key={index} className="playwright-recorder-test-item">
                        <div className="playwright-recorder-test-header">
                          <div className="playwright-recorder-test-info">
                            <div className="playwright-recorder-test-name-row">
                              <strong className="playwright-recorder-test-name">{test.name}</strong>
                              <span className="playwright-recorder-test-badge">⏱️ Auto-Timed</span>
                              {(() => {
                                const schedule = schedules.find(s => s.testPath === test.path);
                                return schedule?.enabled && (
                                  <span className="test-badge playwright-recorder-schedule-badge">📅 Scheduled</span>
                                );
                              })()}
                            </div>
                            <div className="playwright-recorder-test-meta">
                              Created: {new Date(test.createdAt).toLocaleString()} | Size: {test.size} bytes
                            </div>
                            {(() => {
                              const schedule = schedules.find(s => s.testPath === test.path);
                              return schedule?.enabled && (
                                <div className="playwright-recorder-schedule-info">
                                  📅 {getScheduleDescription(schedule)}
                                </div>
                              );
                            })()}
                          </div>
                          <div className="playwright-recorder-test-actions">
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
                              className="playwright-recorder-btn playwright-recorder-btn-sm playwright-recorder-btn-view"
                              title="View code"
                            >
                              👁️ View
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
                              className="playwright-recorder-btn playwright-recorder-btn-sm playwright-recorder-btn-replay"
                            >
                              ▶️ Replay
                            </button>
                            <button
                              onClick={() => openScheduleModal(test.path)}
                              className={`playwright-recorder-btn btn-sm playwright-recorder-btn-schedule ${schedules.find(s => s.testPath === test.path && s.enabled) ? 'scheduled' : ''}`}
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
                              className="playwright-recorder-btn playwright-recorder-btn-sm playwright-recorder-btn-delete"
                              title="Delete test"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                        <div className="playwright-recorder-test-preview">
                          {test.preview}
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {showSavedTests && savedTests.length === 0 && (
                <p className="playwright-recorder-empty-message">No saved tests yet. Record your first test above!</p>
              )}
            </div>

            {/* Schedule Modal */}
            {showScheduleModal && (
              <div className="playwright-recorder-modal-overlay" onClick={closeScheduleModal}>
                <div className="playwright-recorder-schedule-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="playwright-recorder-modal-header">
                    <h3 className="playwright-recorder-modal-title">📅 Schedule Test Replay</h3>
                    <button className="playwright-recorder-modal-close" onClick={closeScheduleModal}>✕</button>
                  </div>

                  <div className="playwright-recorder-modal-body">
                    <div className="playwright-recorder-form-group">
                      <label className="playwright-recorder-form-label">
                        <input
                          type="checkbox"
                          checked={scheduleForm.enabled}
                          onChange={(e) => setScheduleForm({ ...scheduleForm, enabled: e.target.checked })}
                          className="playwright-recorder-form-checkbox"
                        />
                        <span>Enable Schedule</span>
                      </label>
                    </div>

                    {scheduleForm.enabled && (
                      <>
                        <div className="playwright-recorder-form-group">
                          <label className="playwright-recorder-form-label">Frequency</label>
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
                            className="playwright-recorder-form-select"
                          >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="custom">Custom</option>
                          </select>
                        </div>

                        {scheduleForm.frequencyType === 'weekly' && (
                          <div className="playwright-recorder-form-group">
                            <label className="playwright-recorder-form-label">Day of Week</label>
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
                              className="playwright-recorder-form-select"
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
                          <div className="playwright-recorder-form-group">
                            <label className="playwright-recorder-form-label">Day of Month</label>
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
                              className="playwright-recorder-form-input"
                            />
                          </div>
                        )}

                        {scheduleForm.frequencyType === 'custom' && (
                          <div className="playwright-recorder-form-group">
                            <label className="playwright-recorder-form-label">Interval (Days)</label>
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
                              className="playwright-recorder-form-input"
                              placeholder="Number of days"
                            />
                          </div>
                        )}

                        <div className="playwright-recorder-form-group">
                          <label className="playwright-recorder-form-label">Time</label>
                          <input
                            type="time"
                            value={scheduleForm.scheduledTime}
                            onChange={(e) => setScheduleForm({ ...scheduleForm, scheduledTime: e.target.value })}
                            className="playwright-recorder-form-input"
                          />
                        </div>

                        <div className="playwright-recorder-schedule-preview">
                          <strong>Schedule:</strong> {scheduleForm.frequencyType && scheduleForm.scheduledTime ? getScheduleDescription(scheduleForm as Schedule) : 'Configure schedule above'}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="playwright-recorder-modal-footer">
                    {scheduleForm.id && (
                      <button
                        onClick={() => {
                          if (showScheduleModal) {
                            removeSchedule(showScheduleModal);
                            closeScheduleModal();
                          }
                        }}
                        className="playwright-recorder-btn playwright-recorder-btn-sm btn-secondary"
                      >
                        Remove Schedule
                      </button>
                    )}
                    <button onClick={closeScheduleModal} className="playwright-recorder-btn playwright-recorder-btn-sm btn-secondary">
                      Cancel
                    </button>
                    <button onClick={saveSchedule} className="playwright-recorder-btn playwright-recorder-btn-sm btn-primary">
                      Save Schedule
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Downloads Section */}
            <div className="playwright-recorder-section">
              <div className="playwright-recorder-section-header">
                <h2 className="playwright-recorder-section-title">📥 Playwright Downloads</h2>
                <div className="playwright-recorder-downloads-actions">
                  <button
                    onClick={async () => {
                      try {
                        await (window as any).electron.debug.openPlaywrightDownloadsFolder();
                      } catch (error) {
                        console.error('Failed to open folder:', error);
                        alert('Failed to open folder');
                      }
                    }}
                    className="playwright-recorder-btn playwright-recorder-btn-sm btn-secondary"
                  >
                    Open Folder
                  </button>
                  <button
                    onClick={loadPlaywrightDownloads}
                    className="playwright-recorder-btn playwright-recorder-btn-sm btn-primary"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {playwrightDownloads.length === 0 ? (
                <p className="playwright-recorder-empty-message">No downloaded files yet.</p>
              ) : (
                <div className="playwright-recorder-downloads-container">
                  {playwrightDownloads.map((file, idx) => (
                    <div
                      key={idx}
                      className="playwright-recorder-download-item"
                      onClick={() => handleOpenDownload(file.path)}
                    >
                      <div className="playwright-recorder-download-info">
                        <div className="playwright-recorder-download-name">📄 {file.name}</div>
                        <div className="playwright-recorder-download-meta">
                          {formatFileSize(file.size)} • {new Date(file.modified).toLocaleString()}
                        </div>
                      </div>
                      <div className="playwright-recorder-download-action">Open →</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Debug Console Section */}
            {debugLogs.length > 0 && (
              <div className="playwright-recorder-section">
                <div className="playwright-recorder-section-header">
                  <h2 className="playwright-recorder-section-title">Debug Console</h2>
                  <button
                    onClick={() => setDebugLogs([])}
                    className="playwright-recorder-btn playwright-recorder-btn-sm btn-secondary"
                  >
                    Clear Logs
                  </button>
                </div>
                <div className="playwright-recorder-debug-console">
                  {debugLogs.map((log, index) => (
                    <div key={index} className="playwright-recorder-debug-log-entry">
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlaywrightRecorderPage;
