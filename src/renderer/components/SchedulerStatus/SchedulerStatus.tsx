import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSync,
  faCheckCircle,
  faTimesCircle,
  faSpinner,
  faClock,
  faExclamationTriangle,
  faPlayCircle,
  faStopCircle,
  faRedo,
} from '../../utils/fontAwesomeIcons';
import './SchedulerStatus.css';

interface ScheduleTask {
  entityType: 'card' | 'bank' | 'tax';
  entityId: string;
  entityName: string;
  enabled: boolean;
  scheduledTime: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  lastRun?: string;
  lastResult?: {
    success: boolean;
    inserted?: number;
    skipped?: number;
    error?: string;
  };
  nextRun?: string;
}

interface ExecutionIntent {
  id: string;
  schedulerType: string;
  taskId: string;
  taskName: string;
  intendedDate: string;
  intendedTime: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  executionWindowStart: string;
  executionWindowEnd: string;
  actualExecutionTime?: string;
  completedAt?: string;
  errorMessage?: string;
  retryCount?: number;
}

const SchedulerStatus: React.FC = () => {
  const [scheduledTasks, setScheduledTasks] = useState<ScheduleTask[]>([]);
  const [executionIntents, setExecutionIntents] = useState<ExecutionIntent[]>([]);
  const [schedulerSettings, setSchedulerSettings] = useState<any>(null);
  const [isSchedulerRunning, setIsSchedulerRunning] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncingEntities, setSyncingEntities] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'>('all');
  const [filterType, setFilterType] = useState<'all' | 'card' | 'bank' | 'tax'>('all');
  const [filterScheduler, setFilterScheduler] = useState<'all' | 'financehub' | 'docker' | 'playwright' | 'scheduled_posts'>('all');
  const [allIntents, setAllIntents] = useState<ExecutionIntent[]>([]);
  const [totalIntents, setTotalIntents] = useState(0);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [retentionDays, setRetentionDays] = useState(30);
  const [isCleaning, setIsCleaning] = useState(false);
  const [isCleaningTests, setIsCleaningTests] = useState(false);
  const [oldestRecord, setOldestRecord] = useState<string>('');
  const [newestRecord, setNewestRecord] = useState<string>('');
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [debugLog, setDebugLog] = useState<string>('');
  const [showDebugLog, setShowDebugLog] = useState(false);

  // Load data
  const loadSchedulerData = async () => {
    setIsLoading(true);
    try {
      // Get scheduler settings
      const settingsResult = await window.electron.financeHubScheduler.getSettings();
      if (settingsResult.success) {
        setSchedulerSettings(settingsResult.settings);
        setIsSchedulerRunning(settingsResult.settings.enabled);

        // Build task list from settings
        const tasks: ScheduleTask[] = [];

        // Cards
        Object.entries(settingsResult.settings.cards).forEach(([cardId, schedule]: [string, any]) => {
          if (schedule) {
            tasks.push({
              entityType: 'card',
              entityId: cardId,
              entityName: getEntityDisplayName('card', cardId),
              enabled: schedule.enabled,
              scheduledTime: schedule.time,
              status: 'pending',
            });
          }
        });

        // Banks
        Object.entries(settingsResult.settings.banks).forEach(([bankId, schedule]: [string, any]) => {
          if (schedule) {
            tasks.push({
              entityType: 'bank',
              entityId: bankId,
              entityName: getEntityDisplayName('bank', bankId),
              enabled: schedule.enabled,
              scheduledTime: schedule.time,
              status: 'pending',
            });
          }
        });

        // Tax
        Object.entries(settingsResult.settings.tax || {}).forEach(([businessNumber, schedule]: [string, any]) => {
          if (schedule) {
            tasks.push({
              entityType: 'tax',
              entityId: businessNumber,
              entityName: `사업자 ${businessNumber}`,
              enabled: schedule.enabled,
              scheduledTime: schedule.time,
              status: 'pending',
            });
          }
        });

        setScheduledTasks(tasks);
      }

      // Get execution intents from database (ALL scheduler types)
      const intentsResult = await window.electron.invoke('sqlite-scheduler-get-intents', {
        limit: 500, // Fetch more records for comprehensive view
        offset: 0
      });

      if (intentsResult?.success && intentsResult?.intents) {
        setAllIntents(intentsResult.intents);
        setTotalIntents(intentsResult.total || intentsResult.intents.length);
        setCurrentOffset(0);
        setExecutionIntents(intentsResult.intents.filter((i: ExecutionIntent) => i.schedulerType === 'financehub'));

        // Calculate date range from intents
        if (intentsResult.intents.length > 0) {
          const dates = intentsResult.intents.map((i: ExecutionIntent) => i.intendedDate).filter(Boolean).sort();
          setOldestRecord(dates[dates.length - 1] || '');
          setNewestRecord(dates[0] || '');
        }
      }

      // Get last sync info
      const syncInfo = await window.electron.financeHubScheduler.getLastSyncInfo();
      if (syncInfo.success) {
        setIsSyncing(syncInfo.isSyncing);
      }
    } catch (error) {
      console.error('Error loading scheduler data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSchedulerData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(loadSchedulerData, 30000);

    return () => clearInterval(interval);
  }, []);

  // Listen for scheduler events
  useEffect(() => {
    const cleanupStarted = window.electron.financeHubScheduler.onSyncStarted(() => {
      setIsSyncing(true);
      loadSchedulerData();
    });

    const cleanupCompleted = window.electron.financeHubScheduler.onSyncCompleted(() => {
      setIsSyncing(false);
      loadSchedulerData();
    });

    const cleanupFailed = window.electron.financeHubScheduler.onSyncFailed(() => {
      setIsSyncing(false);
      loadSchedulerData();
    });

    return () => {
      cleanupStarted();
      cleanupCompleted();
      cleanupFailed();
    };
  }, []);

  const getEntityDisplayName = (type: string, id: string): string => {
    const cardNames: Record<string, string> = {
      'bc': 'BC카드',
      'kb': 'KB카드',
      'nh': 'NH카드',
      'shinhan': '신한카드',
      'samsung': '삼성카드',
      'hyundai': '현대카드',
      'lotte': '롯데카드',
      'hana': '하나카드',
    };

    const bankNames: Record<string, string> = {
      'kookmin': 'KB국민은행',
      'shinhan': '신한은행',
      'nh': 'NH농협은행',
      'nhBusiness': 'NH농협은행(기업)',
    };

    if (type === 'card') return cardNames[id] || id;
    if (type === 'bank') return bankNames[id] || id;
    return id;
  };

  const handleStartScheduler = async () => {
    try {
      await window.electron.financeHubScheduler.start();
      setIsSchedulerRunning(true);
    } catch (error) {
      console.error('Failed to start scheduler:', error);
      alert('Failed to start scheduler');
    }
  };

  const handleStopScheduler = async () => {
    try {
      await window.electron.financeHubScheduler.stop();
      setIsSchedulerRunning(false);
    } catch (error) {
      console.error('Failed to stop scheduler:', error);
      alert('Failed to stop scheduler');
    }
  };

  const handleSyncNow = async () => {
    try {
      setIsSyncing(true);
      await window.electron.financeHubScheduler.syncNow();
    } catch (error) {
      console.error('Failed to trigger manual sync:', error);
      alert('Failed to trigger manual sync');
      setIsSyncing(false);
    }
  };

  const handleClearRetries = async () => {
    if (!confirm('Clear all retry timers?\n\nThis will cancel any pending retries and reset stuck sync states.')) {
      return;
    }

    try {
      const result = await window.electron.financeHubScheduler.clearRetries();
      if (result.success) {
        console.log('Cleared retries:', result);
        alert(`✅ Retries Cleared\n\n${result.cleared} retry timer(s) removed${result.entities.length > 0 ? '\n\nCleared:\n' + result.entities.join('\n') : ''}`);
        loadSchedulerData(); // Reload data
      } else {
        alert(`❌ Failed to clear retries: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to clear retries:', error);
      alert('Failed to clear retries');
    }
  };

  const loadMoreIntents = async () => {
    setIsLoadingMore(true);
    try {
      const newOffset = currentOffset + 500;
      const intentsResult = await window.electron.invoke('sqlite-scheduler-get-intents', {
        limit: 500,
        offset: newOffset
      });

      if (intentsResult?.success && intentsResult?.intents) {
        setAllIntents(prev => [...prev, ...intentsResult.intents]);
        setCurrentOffset(newOffset);
      }
    } catch (error) {
      console.error('Error loading more intents:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleCleanupOldRecords = async () => {
    if (!confirm(`Delete execution records older than ${retentionDays} days?\n\nThis will permanently remove old execution history.`)) {
      return;
    }

    setIsCleaning(true);
    try {
      const result = await window.electron.invoke('scheduler-recovery-cleanup', retentionDays);
      if (result.success) {
        alert(`Successfully deleted ${result.data} old records`);
        loadSchedulerData(); // Reload data
      } else {
        alert(`Cleanup failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Error cleaning up old records:', error);
      alert('Cleanup failed');
    } finally {
      setIsCleaning(false);
    }
  };

  // Calculate days of history
  const daysOfHistory = oldestRecord && newestRecord ?
    Math.ceil((new Date(newestRecord).getTime() - new Date(oldestRecord).getTime()) / (1000 * 60 * 60 * 24)) : 0;

  const handleCancelTask = async (schedulerType: string, taskId: string, intendedDate: string, taskName: string) => {
    if (!confirm(`Cancel task: ${taskName}?\n\nThis will mark it as cancelled and prevent it from running.`)) {
      return;
    }

    try {
      const result = await window.electron.invoke('scheduler-recovery-cancel-task', schedulerType, taskId, intendedDate);
      if (result.success) {
        alert('Task cancelled successfully');
        loadSchedulerData(); // Reload data
      } else {
        alert(`Cancel failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Error cancelling task:', error);
      alert('Cancel failed');
    }
  };

  const loadDiagnostics = async () => {
    try {
      const result = await window.electron.invoke('scheduler-recovery-diagnostics');
      if (result.success) {
        setDiagnostics(result.data);
        console.log('Diagnostics loaded:', result.data);
      } else {
        alert(`Failed to load diagnostics: ${result.error}`);
      }
    } catch (error) {
      console.error('Error loading diagnostics:', error);
      alert('Failed to load diagnostics');
    }
  };

  const loadDebugLog = async () => {
    try {
      const result = await window.electron.invoke('finance-hub:scheduler:get-debug-log');
      if (result.success) {
        setDebugLog(result.log);
        setShowDebugLog(true);
      } else {
        alert(`Failed to load debug log: ${result.error}`);
      }
    } catch (error) {
      console.error('Error loading debug log:', error);
      alert('Failed to load debug log');
    }
  };

  const handleCleanupDeletedTests = async () => {
    if (!confirm('Clean up schedules for deleted Playwright test files?\n\nThis will remove schedules and cancel pending executions for test files that no longer exist.')) {
      return;
    }

    setIsCleaningTests(true);
    try {
      const result = await window.electron.invoke('scheduler:cleanup-deleted-tests');
      if (result.success) {
        alert(`Cleanup complete!\n\nChecked: ${result.checked} tests\nRemoved: ${result.removed} deleted tests`);
        loadSchedulerData(); // Reload data
      } else {
        alert(`Cleanup failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Error cleaning up deleted tests:', error);
      alert('Cleanup failed');
    } finally {
      setIsCleaningTests(false);
    }
  };

  // Filter tasks
  const filteredTasks = scheduledTasks.filter(task => {
    if (filterType !== 'all' && task.entityType !== filterType) return false;
    if (!task.enabled && filterStatus !== 'all') return false;
    return true;
  });

  // Filter intents by scheduler type first
  useEffect(() => {
    if (filterScheduler === 'all') {
      setExecutionIntents(allIntents);
    } else {
      setExecutionIntents(allIntents.filter(i => i.schedulerType === filterScheduler));
    }
  }, [filterScheduler, allIntents]);

  // Filter intents
  const filteredIntents = executionIntents.filter(intent => {
    if (filterStatus !== 'all' && intent.status !== filterStatus) return false;
    return true;
  });

  // Use ALL intents for stats (not just filtered)
  const pendingIntents = allIntents.filter(i => i.status === 'pending');
  const runningIntents = allIntents.filter(i => i.status === 'running');
  const completedIntents = allIntents.filter(i => i.status === 'completed');
  const failedIntents = allIntents.filter(i => i.status === 'failed');

  if (isLoading) {
    return (
      <div className="scheduler-status">
        <div className="scheduler-status__loading">
          <FontAwesomeIcon icon={faSpinner} spin size="3x" />
          <p>Loading scheduler data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="scheduler-status">
      <div className="scheduler-status__header">
        <h1>📅 Scheduler Status</h1>
        <div className="scheduler-status__controls">
          {isSchedulerRunning ? (
            <button className="scheduler-status__btn scheduler-status__btn--danger" onClick={handleStopScheduler}>
              <FontAwesomeIcon icon={faStopCircle} /> Stop Scheduler
            </button>
          ) : (
            <button className="scheduler-status__btn scheduler-status__btn--primary" onClick={handleStartScheduler}>
              <FontAwesomeIcon icon={faPlayCircle} /> Start Scheduler
            </button>
          )}
          <button
            className="scheduler-status__btn scheduler-status__btn--secondary"
            onClick={handleSyncNow}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <>
                <FontAwesomeIcon icon={faSpinner} spin /> Syncing...
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faSync} /> Sync Now
              </>
            )}
          </button>
          <button
            className="scheduler-status__btn scheduler-status__btn--warning"
            onClick={handleClearRetries}
            title="Clear all retry timers and reset stuck sync states"
          >
            🧹 Clear Retries
          </button>
          <button className="scheduler-status__btn scheduler-status__btn--secondary" onClick={loadSchedulerData}>
            <FontAwesomeIcon icon={faRedo} /> Refresh
          </button>
          <button className="scheduler-status__btn scheduler-status__btn--secondary" onClick={loadDebugLog}>
            📋 View Debug Log
          </button>
        </div>
      </div>

      {/* Debug Log Modal */}
      {showDebugLog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}>
          <div style={{
            background: '#111827',
            border: '1px solid #1F2937',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '90%',
            maxHeight: '90%',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, color: '#F9FAFB' }}>📋 Scheduler Debug Log (Last 500 lines)</h2>
              <button
                className="scheduler-status__btn scheduler-status__btn--danger"
                onClick={() => setShowDebugLog(false)}
              >
                Close
              </button>
            </div>
            <pre style={{
              background: '#0A0E1A',
              color: '#F9FAFB',
              padding: '16px',
              borderRadius: '8px',
              overflow: 'auto',
              flex: 1,
              fontSize: '12px',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
            }}>
              {debugLog}
            </pre>
          </div>
        </div>
      )}

      {/* Status Overview */}
      <div className="scheduler-status__overview">
        <div className="scheduler-status__stat">
          <div className="scheduler-status__stat-icon scheduler-status__stat-icon--primary">
            <FontAwesomeIcon icon={faClock} />
          </div>
          <div className="scheduler-status__stat-info">
            <div className="scheduler-status__stat-value">{scheduledTasks.filter(t => t.enabled).length}</div>
            <div className="scheduler-status__stat-label">Scheduled</div>
          </div>
        </div>
        <div className="scheduler-status__stat">
          <div className="scheduler-status__stat-icon scheduler-status__stat-icon--success">
            <FontAwesomeIcon icon={faCheckCircle} />
          </div>
          <div className="scheduler-status__stat-info">
            <div className="scheduler-status__stat-value">{completedIntents.length}</div>
            <div className="scheduler-status__stat-label">Completed</div>
          </div>
        </div>
        <div className="scheduler-status__stat">
          <div className="scheduler-status__stat-icon scheduler-status__stat-icon--warning">
            <FontAwesomeIcon icon={faSpinner} />
          </div>
          <div className="scheduler-status__stat-info">
            <div className="scheduler-status__stat-value">{runningIntents.length}</div>
            <div className="scheduler-status__stat-label">Running</div>
          </div>
        </div>
        <div className="scheduler-status__stat">
          <div className="scheduler-status__stat-icon scheduler-status__stat-icon--danger">
            <FontAwesomeIcon icon={faTimesCircle} />
          </div>
          <div className="scheduler-status__stat-info">
            <div className="scheduler-status__stat-value">{failedIntents.length}</div>
            <div className="scheduler-status__stat-label">Failed</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="scheduler-status__filters">
        <div className="scheduler-status__filter-group">
          <label>Scheduler:</label>
          <select value={filterScheduler} onChange={(e) => setFilterScheduler(e.target.value as any)}>
            <option value="all">All Schedulers</option>
            <option value="financehub">Finance Hub</option>
            <option value="docker">Docker</option>
            <option value="playwright">Playwright</option>
            <option value="scheduled_posts">Scheduled Posts</option>
          </select>
        </div>
        <div className="scheduler-status__filter-group">
          <label>Type:</label>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)}>
            <option value="all">All</option>
            <option value="card">Cards</option>
            <option value="bank">Banks</option>
            <option value="tax">Tax</option>
          </select>
        </div>
        <div className="scheduler-status__filter-group">
          <label>Status:</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}>
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Scheduled Tasks */}
      <section className="scheduler-status__section">
        <h2>📋 Scheduled Tasks</h2>
        <div className="scheduler-status__tasks">
          {filteredTasks.length === 0 ? (
            <div className="scheduler-status__empty">No scheduled tasks found</div>
          ) : (
            filteredTasks.map((task) => {
              const intent = executionIntents.find(
                i => i.taskId === `${task.entityType}:${task.entityId}` &&
                     i.intendedDate === new Date().toISOString().split('T')[0]
              );

              return (
                <div key={`${task.entityType}:${task.entityId}`} className={`scheduler-status__task scheduler-status__task--${intent?.status || 'pending'}`}>
                  <div className="scheduler-status__task-header">
                    <div className="scheduler-status__task-info">
                      <span className={`scheduler-status__task-type scheduler-status__task-type--${task.entityType}`}>
                        {task.entityType === 'card' ? '💳' : task.entityType === 'bank' ? '🏦' : '📄'}
                        {task.entityType.toUpperCase()}
                      </span>
                      <h3>{task.entityName}</h3>
                      {!task.enabled && <span className="scheduler-status__task-disabled">Disabled</span>}
                    </div>
                    <div className="scheduler-status__task-status">
                      {intent ? (
                        <>
                          {intent.status === 'completed' && (
                            <span className="scheduler-status__badge scheduler-status__badge--success">
                              <FontAwesomeIcon icon={faCheckCircle} /> Completed
                            </span>
                          )}
                          {intent.status === 'running' && (
                            <>
                              <span className="scheduler-status__badge scheduler-status__badge--warning">
                                <FontAwesomeIcon icon={faSpinner} spin /> Running
                              </span>
                              <button
                                className="scheduler-status__cancel-btn"
                                onClick={() => handleCancelTask(intent.schedulerType, intent.taskId, intent.intendedDate, task.entityName)}
                                title="Cancel this task"
                              >
                                <FontAwesomeIcon icon={faTimesCircle} /> Cancel
                              </button>
                            </>
                          )}
                          {intent.status === 'failed' && (
                            <span className="scheduler-status__badge scheduler-status__badge--danger">
                              <FontAwesomeIcon icon={faTimesCircle} /> Failed
                            </span>
                          )}
                          {intent.status === 'pending' && (
                            <>
                              <span className="scheduler-status__badge scheduler-status__badge--info">
                                <FontAwesomeIcon icon={faClock} /> Pending
                              </span>
                              <button
                                className="scheduler-status__cancel-btn"
                                onClick={() => handleCancelTask(intent.schedulerType, intent.taskId, intent.intendedDate, task.entityName)}
                                title="Cancel this task"
                              >
                                <FontAwesomeIcon icon={faTimesCircle} /> Cancel
                              </button>
                            </>
                          )}
                          {intent.status === 'cancelled' && (
                            <span className="scheduler-status__badge scheduler-status__badge--muted">
                              <FontAwesomeIcon icon={faTimesCircle} /> Cancelled
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="scheduler-status__badge scheduler-status__badge--muted">
                          <FontAwesomeIcon icon={faClock} /> Not Started
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="scheduler-status__task-details">
                    <div className="scheduler-status__task-detail">
                      <strong>Scheduled Time:</strong> {task.scheduledTime}
                    </div>
                    {intent && (
                      <>
                        {intent.actualExecutionTime && (
                          <div className="scheduler-status__task-detail">
                            <strong>Executed At:</strong> {new Date(intent.actualExecutionTime).toLocaleString()}
                          </div>
                        )}
                        {intent.completedAt && (
                          <div className="scheduler-status__task-detail">
                            <strong>Completed At:</strong> {new Date(intent.completedAt).toLocaleString()}
                          </div>
                        )}
                        {intent.errorMessage && (
                          <div className="scheduler-status__task-error">
                            <FontAwesomeIcon icon={faExclamationTriangle} /> {intent.errorMessage}
                          </div>
                        )}
                        {intent.retryCount && intent.retryCount > 0 && (
                          <div className="scheduler-status__task-detail">
                            <strong>Retry Count:</strong> {intent.retryCount}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Execution History */}
      <section className="scheduler-status__section">
        <div className="scheduler-status__section-header">
          <h2>📊 Execution History</h2>
          <div className="scheduler-status__section-info">
            Showing {filteredIntents.length} of {allIntents.length} total executions
          </div>
        </div>
        <div className="scheduler-status__intents-wrapper">
          {filteredIntents.length === 0 ? (
            <div className="scheduler-status__empty">No execution history found</div>
          ) : (
            <div className="scheduler-status__table-scroll">
              <table className="scheduler-status__table">
                <thead>
                  <tr>
                    <th>Scheduler</th>
                    <th>Status</th>
                    <th>Task</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Executed At</th>
                    <th>Completed At</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIntents.map((intent) => (
                    <tr key={intent.id} className={`scheduler-status__intent-row scheduler-status__intent-row--${intent.status}`}>
                      <td>
                        <span className={`scheduler-status__scheduler-badge scheduler-status__scheduler-badge--${intent.schedulerType}`}>
                          {intent.schedulerType === 'financehub' && '💰 Finance'}
                          {intent.schedulerType === 'docker' && '🐳 Docker'}
                          {intent.schedulerType === 'playwright' && '🎭 Playwright'}
                          {intent.schedulerType === 'scheduled_posts' && '📝 Posts'}
                        </span>
                      </td>
                      <td>
                        {intent.status === 'completed' && (
                          <span className="scheduler-status__badge scheduler-status__badge--success">
                            <FontAwesomeIcon icon={faCheckCircle} /> Completed
                          </span>
                        )}
                        {intent.status === 'running' && (
                          <span className="scheduler-status__badge scheduler-status__badge--warning">
                            <FontAwesomeIcon icon={faSpinner} spin /> Running
                          </span>
                        )}
                        {intent.status === 'failed' && (
                          <span className="scheduler-status__badge scheduler-status__badge--danger">
                            <FontAwesomeIcon icon={faTimesCircle} /> Failed
                          </span>
                        )}
                        {intent.status === 'pending' && (
                          <span className="scheduler-status__badge scheduler-status__badge--info">
                            <FontAwesomeIcon icon={faClock} /> Pending
                          </span>
                        )}
                        {intent.status === 'cancelled' && (
                          <span className="scheduler-status__badge scheduler-status__badge--muted">
                            <FontAwesomeIcon icon={faTimesCircle} /> Cancelled
                          </span>
                        )}
                      </td>
                      <td className="scheduler-status__task-name">{intent.taskName}</td>
                      <td>{intent.intendedDate}</td>
                      <td>{intent.intendedTime}</td>
                      <td>{intent.actualExecutionTime ? new Date(intent.actualExecutionTime).toLocaleTimeString() : '-'}</td>
                      <td>{intent.completedAt ? new Date(intent.completedAt).toLocaleTimeString() : '-'}</td>
                      <td>
                        {intent.errorMessage && (
                          <span className="scheduler-status__error-text" title={intent.errorMessage}>
                            {intent.errorMessage.substring(0, 50)}...
                          </span>
                        )}
                        {intent.retryCount && intent.retryCount > 0 && (
                          <span className="scheduler-status__retry-badge">
                            Retry {intent.retryCount}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {allIntents.length < totalIntents && (
            <div className="scheduler-status__load-more">
              <button
                className="scheduler-status__btn scheduler-status__btn--secondary"
                onClick={loadMoreIntents}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} spin /> Loading...
                  </>
                ) : (
                  `Load More (${allIntents.length} / ${totalIntents})`
                )}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Failed Tasks - Will be Re-executed */}
      {failedIntents.length > 0 && (
        <section className="scheduler-status__section">
          <h2>🔄 Failed Tasks (Will Retry)</h2>
          <div className="scheduler-status__failed-tasks">
            {failedIntents.map((intent) => (
              <div key={intent.id} className="scheduler-status__failed-task">
                <div className="scheduler-status__failed-task-header">
                  <FontAwesomeIcon icon={faExclamationTriangle} />
                  <span className={`scheduler-status__scheduler-badge scheduler-status__scheduler-badge--${intent.schedulerType}`}>
                    {intent.schedulerType === 'financehub' && '💰'}
                    {intent.schedulerType === 'docker' && '🐳'}
                    {intent.schedulerType === 'playwright' && '🎭'}
                    {intent.schedulerType === 'scheduled_posts' && '📝'}
                    {intent.schedulerType}
                  </span>
                  <strong>{intent.taskName}</strong>
                </div>
                <div className="scheduler-status__failed-task-details">
                  <div>Intended: {intent.intendedDate} {intent.intendedTime}</div>
                  {intent.errorMessage && <div className="scheduler-status__error-message">Error: {intent.errorMessage}</div>}
                  {intent.schedulerType === 'financehub' && (
                    <>
                      <div>Retry Count: {intent.retryCount || 0} / {schedulerSettings?.retryCount || 3}</div>
                      {(intent.retryCount || 0) < (schedulerSettings?.retryCount || 3) && (
                        <div className="scheduler-status__retry-info">
                          Will retry in {schedulerSettings?.retryDelayMinutes || 5} minutes
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Database Stats & Cleanup */}
      <section className="scheduler-status__section">
        <h2>💾 Database Statistics</h2>
        <div className="scheduler-status__db-stats">
          <div className="scheduler-status__db-stat">
            <div className="scheduler-status__db-stat-label">Total Records</div>
            <div className="scheduler-status__db-stat-value">{totalIntents.toLocaleString()}</div>
          </div>
          <div className="scheduler-status__db-stat">
            <div className="scheduler-status__db-stat-label">Days of History</div>
            <div className="scheduler-status__db-stat-value">{daysOfHistory} days</div>
          </div>
          <div className="scheduler-status__db-stat">
            <div className="scheduler-status__db-stat-label">Oldest Record</div>
            <div className="scheduler-status__db-stat-value">{oldestRecord || 'N/A'}</div>
          </div>
          <div className="scheduler-status__db-stat">
            <div className="scheduler-status__db-stat-label">Newest Record</div>
            <div className="scheduler-status__db-stat-value">{newestRecord || 'N/A'}</div>
          </div>
        </div>

        <div className="scheduler-status__cleanup">
          <h3>🗑️ Cleanup Old Records</h3>
          <div className="scheduler-status__cleanup-controls">
            <label>Keep records from last:</label>
            <input
              type="number"
              min="1"
              max="365"
              value={retentionDays}
              onChange={(e) => setRetentionDays(Math.max(1, Math.min(365, parseInt(e.target.value) || 30)))}
              className="scheduler-status__cleanup-input"
            />
            <span>days</span>
            <button
              className="scheduler-status__btn scheduler-status__btn--danger"
              onClick={handleCleanupOldRecords}
              disabled={isCleaning}
            >
              {isCleaning ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin /> Cleaning...
                </>
              ) : (
                'Delete Old Records'
              )}
            </button>
          </div>
          <div className="scheduler-status__cleanup-info">
            This will delete all execution records older than {retentionDays} days (keeping recent history).
          </div>
        </div>

        <div className="scheduler-status__cleanup">
          <h3>🧹 Cleanup Deleted Test Files</h3>
          <div className="scheduler-status__cleanup-controls">
            <button
              className="scheduler-status__btn scheduler-status__btn--danger"
              onClick={handleCleanupDeletedTests}
              disabled={isCleaningTests}
            >
              {isCleaningTests ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin /> Scanning...
                </>
              ) : (
                'Remove Orphaned Playwright Tests'
              )}
            </button>
          </div>
          <div className="scheduler-status__cleanup-info">
            Removes schedules for Playwright test files that have been deleted. Cancels any pending/failed executions.
          </div>
        </div>
      </section>

      {/* Diagnostics Panel */}
      <section className="scheduler-status__section">
        <div className="scheduler-status__section-header">
          <h2>🔍 Diagnostics</h2>
          <button
            className="scheduler-status__btn scheduler-status__btn--secondary"
            onClick={() => {
              setShowDiagnostics(!showDiagnostics);
              if (!showDiagnostics) {
                loadDiagnostics();
              }
            }}
          >
            {showDiagnostics ? 'Hide' : 'Show'} Diagnostics
          </button>
        </div>

        {showDiagnostics && diagnostics && (
          <div className="scheduler-status__diagnostics">
            <div className="scheduler-status__diagnostic-section">
              <h3>⏰ Current Time</h3>
              <div className="scheduler-status__diagnostic-value">
                {new Date(diagnostics.currentTime).toLocaleString()}
              </div>
            </div>

            <div className="scheduler-status__diagnostic-section">
              <h3>📅 Today's Tasks ({diagnostics.todayTasks?.length || 0})</h3>
              {diagnostics.todayTasks && diagnostics.todayTasks.length > 0 ? (
                <div className="scheduler-status__table-scroll" style={{ maxHeight: '300px' }}>
                  <table className="scheduler-status__table">
                    <thead>
                      <tr>
                        <th>Task</th>
                        <th>Time</th>
                        <th>Status</th>
                        <th>Window End</th>
                        <th>Window Passed?</th>
                        <th>Retry Count</th>
                        <th>Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diagnostics.todayTasks.map((task: any, idx: number) => {
                        const windowPassed = new Date(task.execution_window_end) < new Date(diagnostics.currentTime);
                        return (
                          <tr key={idx}>
                            <td>{task.task_id}</td>
                            <td>{task.intended_time}</td>
                            <td>
                              <span className={`scheduler-status__badge scheduler-status__badge--${task.status === 'completed' ? 'success' : task.status === 'running' ? 'warning' : task.status === 'failed' ? 'danger' : 'info'}`}>
                                {task.status}
                              </span>
                            </td>
                            <td>{new Date(task.execution_window_end).toLocaleTimeString()}</td>
                            <td style={{ color: windowPassed ? '#10B981' : '#F59E0B' }}>
                              {windowPassed ? '✓ Yes' : '✗ No'}
                            </td>
                            <td>{task.retry_count || 0}</td>
                            <td style={{ color: '#EF4444', fontSize: '11px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {task.error_message || '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="scheduler-status__empty">No tasks scheduled for today</div>
              )}
            </div>

            <div className="scheduler-status__diagnostic-section">
              <h3>🔄 Tasks Eligible for Recovery ({diagnostics.missedTasks?.length || 0})</h3>
              <p style={{ fontSize: '13px', color: '#9CA3AF', marginBottom: '12px' }}>
                Tasks where execution window has passed and status is 'pending' or 'failed' (retry_count &lt; 5)
              </p>
              {diagnostics.missedTasks && diagnostics.missedTasks.length > 0 ? (
                <div className="scheduler-status__table-scroll" style={{ maxHeight: '300px' }}>
                  <table className="scheduler-status__table">
                    <thead>
                      <tr>
                        <th>Task</th>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Status</th>
                        <th>Retry Count</th>
                        <th>Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diagnostics.missedTasks.map((task: any, idx: number) => (
                        <tr key={idx}>
                          <td>{task.task_id}</td>
                          <td>{task.intended_date}</td>
                          <td>{task.intended_time}</td>
                          <td>
                            <span className={`scheduler-status__badge scheduler-status__badge--${task.status === 'failed' ? 'danger' : 'info'}`}>
                              {task.status}
                            </span>
                          </td>
                          <td>{task.retry_count || 0}/5</td>
                          <td style={{ color: '#EF4444', fontSize: '11px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {task.error_message || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="scheduler-status__empty" style={{ color: '#10B981' }}>
                  ✓ No missed tasks - everything is up to date!
                </div>
              )}
            </div>

            {diagnostics.stuckTasks && diagnostics.stuckTasks.length > 0 && (
              <div className="scheduler-status__diagnostic-section">
                <h3>⚠️ Stuck Tasks ({diagnostics.stuckTasks.length})</h3>
                <p style={{ fontSize: '13px', color: '#EF4444', marginBottom: '12px' }}>
                  Tasks stuck in 'running' state for &gt; 1 hour (will be reset to 'failed' on next recovery)
                </p>
                <div className="scheduler-status__table-scroll" style={{ maxHeight: '200px' }}>
                  <table className="scheduler-status__table">
                    <thead>
                      <tr>
                        <th>Task</th>
                        <th>Date</th>
                        <th>Started At</th>
                        <th>Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diagnostics.stuckTasks.map((task: any, idx: number) => (
                        <tr key={idx}>
                          <td>{task.task_id}</td>
                          <td>{task.intended_date}</td>
                          <td>{new Date(task.actual_started_at).toLocaleString()}</td>
                          <td style={{ color: '#EF4444', fontSize: '11px' }}>{task.error_message || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="scheduler-status__diagnostic-section">
              <h3>💾 Database Info</h3>
              <div style={{ fontSize: '14px', color: '#D1D5DB' }}>
                Total intents in database: <strong>{diagnostics.totalIntentsInDb?.count || 0}</strong>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Settings Info */}
      {schedulerSettings && (
        <section className="scheduler-status__section">
          <h2>⚙️ Scheduler Settings</h2>
          <div className="scheduler-status__settings">
            <div className="scheduler-status__setting">
              <strong>Status:</strong> {isSchedulerRunning ? '🟢 Running' : '🔴 Stopped'}
            </div>
            <div className="scheduler-status__setting">
              <strong>Retry Count:</strong> {schedulerSettings.retryCount}
            </div>
            <div className="scheduler-status__setting">
              <strong>Retry Delay:</strong> {schedulerSettings.retryDelayMinutes} minutes
            </div>
            <div className="scheduler-status__setting">
              <strong>Spreadsheet Sync:</strong> {schedulerSettings.spreadsheetSyncEnabled ? '✅ Enabled' : '❌ Disabled'}
            </div>
            {schedulerSettings.lastSyncTime && (
              <div className="scheduler-status__setting">
                <strong>Last Sync:</strong> {new Date(schedulerSettings.lastSyncTime).toLocaleString()}
              </div>
            )}
            {schedulerSettings.lastSyncStatus && (
              <div className="scheduler-status__setting">
                <strong>Last Sync Status:</strong> {schedulerSettings.lastSyncStatus}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default SchedulerStatus;
