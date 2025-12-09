import React, { useState, useEffect, useCallback } from 'react';
import type {
  DockerScheduledTask,
  DockerTaskExecution,
  CreateDockerTaskData,
} from '../../preload';

interface Container {
  Id: string;
  Names: string[];
  Image: string;
  State: string;
}

interface DockerImage {
  Id: string;
  RepoTags: string[];
}

interface DockerSchedulerProps {
  containers: Container[];
  images: DockerImage[];
  onRefreshContainers: () => void;
}

const TASK_TYPE_LABELS: Record<string, string> = {
  start_container: '▶ Start',
  stop_container: '⏹ Stop',
  restart_container: '🔄 Restart',
  run_image: '🚀 Run Image',
};

const SCHEDULE_TYPE_LABELS: Record<string, string> = {
  once: 'One-time',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  custom: 'Custom Interval',
  cron: 'Cron Expression',
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const DockerScheduler: React.FC<DockerSchedulerProps> = ({
  containers,
  images,
  onRefreshContainers,
}) => {
  const [tasks, setTasks] = useState<DockerScheduledTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<DockerScheduledTask | null>(null);
  const [selectedTaskForHistory, setSelectedTaskForHistory] = useState<string | null>(null);
  const [executionHistory, setExecutionHistory] = useState<DockerTaskExecution[]>([]);
  const [schedulerStatus, setSchedulerStatus] = useState<{ isRunning: boolean; scheduledJobCount: number } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateDockerTaskData>({
    name: '',
    taskType: 'start_container',
    scheduleType: 'daily',
    scheduledTime: '09:00',
  });

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.electron.docker.scheduler.getAll();
      if (result.success && result.data) {
        setTasks(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch Docker tasks:', error);
    }
    setLoading(false);
  }, []);

  // Fetch scheduler status
  const fetchStatus = useCallback(async () => {
    try {
      const result = await window.electron.docker.scheduler.getStatus();
      if (result.success && result.data) {
        setSchedulerStatus(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch scheduler status:', error);
    }
  }, []);

  // Fetch execution history for a task
  const fetchExecutionHistory = useCallback(async (taskId: string) => {
    try {
      const result = await window.electron.docker.scheduler.getExecutions(taskId, 20);
      if (result.success && result.data) {
        setExecutionHistory(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch execution history:', error);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchStatus();
  }, [fetchTasks, fetchStatus]);

  useEffect(() => {
    if (selectedTaskForHistory) {
      fetchExecutionHistory(selectedTaskForHistory);
    }
  }, [selectedTaskForHistory, fetchExecutionHistory]);

  // Handle create/update task
  const handleSaveTask = async () => {
    setActionLoading('save');
    try {
      if (editingTask) {
        await window.electron.docker.scheduler.update(editingTask.id, formData);
      } else {
        await window.electron.docker.scheduler.create(formData);
      }
      setShowModal(false);
      setEditingTask(null);
      resetForm();
      await fetchTasks();
      await fetchStatus();
    } catch (error) {
      console.error('Failed to save task:', error);
      alert(`Failed to save task: ${error}`);
    }
    setActionLoading(null);
  };

  // Handle delete task
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this scheduled task?')) return;
    setActionLoading(taskId);
    try {
      await window.electron.docker.scheduler.delete(taskId);
      await fetchTasks();
      await fetchStatus();
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
    setActionLoading(null);
  };

  // Handle toggle task
  const handleToggleTask = async (taskId: string, enabled: boolean) => {
    setActionLoading(taskId);
    try {
      await window.electron.docker.scheduler.toggle(taskId, enabled);
      await fetchTasks();
      await fetchStatus();
    } catch (error) {
      console.error('Failed to toggle task:', error);
    }
    setActionLoading(null);
  };

  // Handle run now
  const handleRunNow = async (taskId: string) => {
    setActionLoading(taskId);
    try {
      const result = await window.electron.docker.scheduler.runNow(taskId);
      if (result.success) {
        await fetchTasks();
        if (selectedTaskForHistory === taskId) {
          await fetchExecutionHistory(taskId);
        }
        onRefreshContainers();
      } else {
        alert(`Task execution failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to run task:', error);
      alert(`Failed to run task: ${error}`);
    }
    setActionLoading(null);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      taskType: 'start_container',
      scheduleType: 'daily',
      scheduledTime: '09:00',
    });
  };

  // Open edit modal
  const openEditModal = (task: DockerScheduledTask) => {
    setEditingTask(task);
    setFormData({
      name: task.name,
      taskType: task.taskType,
      containerId: task.containerId,
      containerName: task.containerName,
      imageName: task.imageName,
      createOptions: task.createOptions,
      scheduleType: task.scheduleType,
      scheduledTime: task.scheduledTime,
      scheduledDate: task.scheduledDate,
      dayOfWeek: task.dayOfWeek,
      dayOfMonth: task.dayOfMonth,
      customIntervalDays: task.customIntervalDays,
      cronExpression: task.cronExpression,
      description: task.description,
    });
    setShowModal(true);
  };

  // Open create modal
  const openCreateModal = () => {
    setEditingTask(null);
    resetForm();
    setShowModal(true);
  };

  // Format schedule for display
  const formatSchedule = (task: DockerScheduledTask): string => {
    const time = task.scheduledTime;
    switch (task.scheduleType) {
      case 'once':
        return `Once on ${task.scheduledDate} at ${time}`;
      case 'daily':
        return `Daily at ${time}`;
      case 'weekly':
        return `Weekly on ${DAY_NAMES[task.dayOfWeek || 0]} at ${time}`;
      case 'monthly':
        return `Monthly on day ${task.dayOfMonth} at ${time}`;
      case 'custom':
        return `Every ${task.customIntervalDays} days at ${time}`;
      case 'cron':
        return `Cron: ${task.cronExpression}`;
      default:
        return task.scheduleType;
    }
  };

  // Format date
  const formatDate = (date: Date | string | undefined): string => {
    if (!date) return 'Never';
    const d = new Date(date);
    return d.toLocaleString();
  };

  // Get target display name
  const getTargetName = (task: DockerScheduledTask): string => {
    if (task.taskType === 'run_image') {
      return task.imageName || 'Unknown image';
    }
    return task.containerName || task.containerId?.slice(0, 12) || 'Unknown container';
  };

  if (loading) {
    return (
      <div className="docker-scheduler-loading">
        <div className="docker-spinner"></div>
        <p>Loading scheduled tasks...</p>
      </div>
    );
  }

  return (
    <div className="docker-scheduler">
      {/* Header */}
      <div className="docker-scheduler-header">
        <div className="docker-scheduler-header-left">
          <h2>⏰ Scheduled Tasks</h2>
          {schedulerStatus && (
            <span className={`scheduler-status ${schedulerStatus.isRunning ? 'running' : 'stopped'}`}>
              {schedulerStatus.isRunning ? '● Running' : '○ Stopped'}
              {schedulerStatus.isRunning && ` (${schedulerStatus.scheduledJobCount} jobs)`}
            </span>
          )}
        </div>
        <div className="docker-scheduler-header-right">
          <button onClick={fetchTasks} className="docker-btn-icon" title="Refresh">
            🔄
          </button>
          <button onClick={openCreateModal} className="docker-btn-primary">
            + New Task
          </button>
        </div>
      </div>

      {/* Task List */}
      <div className="docker-scheduler-list">
        {tasks.length === 0 ? (
          <div className="docker-empty-state">
            <p>No scheduled tasks</p>
            <p className="docker-hint">Create a task to automatically start, stop, or restart containers</p>
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className={`docker-scheduler-card ${task.enabled ? 'enabled' : 'disabled'}`}
            >
              <div className="docker-scheduler-card-main">
                <div className="docker-scheduler-card-header">
                  <span className="docker-scheduler-card-name">{task.name}</span>
                  <span className={`docker-task-type-badge docker-task-type-${task.taskType}`}>
                    {TASK_TYPE_LABELS[task.taskType]}
                  </span>
                </div>
                <div className="docker-scheduler-card-target">
                  🎯 {getTargetName(task)}
                </div>
                <div className="docker-scheduler-card-schedule">
                  📅 {formatSchedule(task)}
                </div>
                {task.description && (
                  <div className="docker-scheduler-card-description">
                    {task.description}
                  </div>
                )}
                <div className="docker-scheduler-card-stats">
                  <span title="Total runs">📊 {task.runCount}</span>
                  <span title="Successful" className="stat-success">✓ {task.successCount}</span>
                  <span title="Failed" className="stat-failure">✗ {task.failureCount}</span>
                  {task.nextRun && (
                    <span title="Next run" className="stat-next">
                      ⏰ {formatDate(task.nextRun)}
                    </span>
                  )}
                </div>
              </div>
              <div className="docker-scheduler-card-actions">
                {actionLoading === task.id ? (
                  <div className="docker-action-loading">
                    <div className="docker-spinner-small"></div>
                  </div>
                ) : (
                  <>
                    <label className="docker-toggle">
                      <input
                        type="checkbox"
                        checked={task.enabled}
                        onChange={(e) => handleToggleTask(task.id, e.target.checked)}
                      />
                      <span className="docker-toggle-slider"></span>
                    </label>
                    <button
                      onClick={() => handleRunNow(task.id)}
                      className="docker-btn-run"
                      title="Run Now"
                    >
                      ▶
                    </button>
                    <button
                      onClick={() => {
                        setSelectedTaskForHistory(selectedTaskForHistory === task.id ? null : task.id);
                      }}
                      className="docker-btn-logs"
                      title="View History"
                    >
                      📋
                    </button>
                    <button
                      onClick={() => openEditModal(task)}
                      className="docker-btn-edit"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="docker-btn-remove"
                      title="Delete"
                    >
                      🗑
                    </button>
                  </>
                )}
              </div>
              
              {/* Execution History Panel */}
              {selectedTaskForHistory === task.id && (
                <div className="docker-scheduler-history">
                  <h4>Execution History</h4>
                  {executionHistory.length === 0 ? (
                    <p className="docker-hint">No executions yet</p>
                  ) : (
                    <div className="docker-scheduler-history-list">
                      {executionHistory.map((exec) => (
                        <div
                          key={exec.id}
                          className={`docker-scheduler-history-item docker-exec-${exec.status}`}
                        >
                          <span className="exec-status">
                            {exec.status === 'success' ? '✓' : exec.status === 'failure' ? '✗' : '⏳'}
                          </span>
                          <span className="exec-time">{formatDate(exec.startedAt)}</span>
                          {exec.duration && (
                            <span className="exec-duration">{exec.duration}ms</span>
                          )}
                          {exec.errorMessage && (
                            <span className="exec-error" title={exec.errorMessage}>
                              {exec.errorMessage.slice(0, 50)}...
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="docker-modal-overlay" onClick={() => !actionLoading && setShowModal(false)}>
          <div className="docker-modal docker-scheduler-modal" onClick={(e) => e.stopPropagation()}>
            <div className="docker-modal-header">
              <h2>{editingTask ? '✏️ Edit Task' : '+ New Task'}</h2>
              <button
                className="docker-modal-close"
                onClick={() => !actionLoading && setShowModal(false)}
                disabled={!!actionLoading}
              >
                ✕
              </button>
            </div>
            <div className="docker-modal-body">
              {/* Task Name */}
              <div className="docker-form-group">
                <label>Task Name *</label>
                <input
                  type="text"
                  placeholder="e.g., Start Dev Database"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="docker-input"
                  disabled={!!actionLoading}
                />
              </div>

              {/* Task Type */}
              <div className="docker-form-group">
                <label>Task Type *</label>
                <select
                  value={formData.taskType}
                  onChange={(e) => setFormData({
                    ...formData,
                    taskType: e.target.value as CreateDockerTaskData['taskType'],
                    containerId: undefined,
                    containerName: undefined,
                    imageName: undefined,
                  })}
                  className="docker-select"
                  disabled={!!actionLoading}
                >
                  <option value="start_container">▶ Start Container</option>
                  <option value="stop_container">⏹ Stop Container</option>
                  <option value="restart_container">🔄 Restart Container</option>
                  <option value="run_image">🚀 Run New Container from Image</option>
                </select>
              </div>

              {/* Target Selection */}
              {formData.taskType !== 'run_image' ? (
                <div className="docker-form-group">
                  <label>Container *</label>
                  <select
                    value={formData.containerName || ''}
                    onChange={(e) => {
                      const container = containers.find(c => c.Names[0]?.replace(/^\//, '') === e.target.value);
                      setFormData({
                        ...formData,
                        containerName: e.target.value,
                        containerId: container?.Id,
                      });
                    }}
                    className="docker-select"
                    disabled={!!actionLoading}
                  >
                    <option value="">Select a container...</option>
                    {containers.map((c) => (
                      <option key={c.Id} value={c.Names[0]?.replace(/^\//, '')}>
                        {c.Names[0]?.replace(/^\//, '')} ({c.Image}) - {c.State}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div className="docker-form-group">
                    <label>Image *</label>
                    <select
                      value={formData.imageName || ''}
                      onChange={(e) => setFormData({ ...formData, imageName: e.target.value })}
                      className="docker-select"
                      disabled={!!actionLoading}
                    >
                      <option value="">Select an image...</option>
                      {images.map((img) => (
                        <option key={img.Id} value={img.RepoTags?.[0]}>
                          {img.RepoTags?.[0] || img.Id.slice(7, 19)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="docker-form-group">
                    <label>Container Name (optional)</label>
                    <input
                      type="text"
                      placeholder="e.g., my-app-container"
                      value={formData.createOptions?.containerName || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        createOptions: { ...formData.createOptions, containerName: e.target.value },
                      })}
                      className="docker-input"
                      disabled={!!actionLoading}
                    />
                  </div>
                  <div className="docker-form-row">
                    <div className="docker-form-group">
                      <label>Host Port</label>
                      <input
                        type="text"
                        placeholder="8080"
                        value={formData.createOptions?.hostPort || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          createOptions: { ...formData.createOptions, hostPort: e.target.value },
                        })}
                        className="docker-input"
                        disabled={!!actionLoading}
                      />
                    </div>
                    <span className="docker-form-separator">:</span>
                    <div className="docker-form-group">
                      <label>Container Port</label>
                      <input
                        type="text"
                        placeholder="80"
                        value={formData.createOptions?.containerPort || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          createOptions: { ...formData.createOptions, containerPort: e.target.value },
                        })}
                        className="docker-input"
                        disabled={!!actionLoading}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Schedule Type */}
              <div className="docker-form-group">
                <label>Schedule Type *</label>
                <select
                  value={formData.scheduleType}
                  onChange={(e) => setFormData({
                    ...formData,
                    scheduleType: e.target.value as CreateDockerTaskData['scheduleType'],
                  })}
                  className="docker-select"
                  disabled={!!actionLoading}
                >
                  <option value="once">One-time</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="custom">Custom Interval</option>
                  <option value="cron">Cron Expression</option>
                </select>
              </div>

              {/* Time */}
              <div className="docker-form-group">
                <label>Time *</label>
                <input
                  type="time"
                  value={formData.scheduledTime}
                  onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                  className="docker-input"
                  disabled={!!actionLoading}
                />
              </div>

              {/* Schedule-specific fields */}
              {formData.scheduleType === 'once' && (
                <div className="docker-form-group">
                  <label>Date *</label>
                  <input
                    type="date"
                    value={formData.scheduledDate || ''}
                    onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                    className="docker-input"
                    disabled={!!actionLoading}
                  />
                </div>
              )}

              {formData.scheduleType === 'weekly' && (
                <div className="docker-form-group">
                  <label>Day of Week *</label>
                  <select
                    value={formData.dayOfWeek ?? 1}
                    onChange={(e) => setFormData({ ...formData, dayOfWeek: parseInt(e.target.value) })}
                    className="docker-select"
                    disabled={!!actionLoading}
                  >
                    {DAY_NAMES.map((day, i) => (
                      <option key={i} value={i}>{day}</option>
                    ))}
                  </select>
                </div>
              )}

              {formData.scheduleType === 'monthly' && (
                <div className="docker-form-group">
                  <label>Day of Month *</label>
                  <select
                    value={formData.dayOfMonth ?? 1}
                    onChange={(e) => setFormData({ ...formData, dayOfMonth: parseInt(e.target.value) })}
                    className="docker-select"
                    disabled={!!actionLoading}
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>
              )}

              {formData.scheduleType === 'custom' && (
                <div className="docker-form-group">
                  <label>Interval (days) *</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.customIntervalDays ?? 1}
                    onChange={(e) => setFormData({ ...formData, customIntervalDays: parseInt(e.target.value) })}
                    className="docker-input"
                    disabled={!!actionLoading}
                  />
                </div>
              )}

              {formData.scheduleType === 'cron' && (
                <div className="docker-form-group">
                  <label>Cron Expression *</label>
                  <input
                    type="text"
                    placeholder="*/5 * * * *"
                    value={formData.cronExpression || ''}
                    onChange={(e) => setFormData({ ...formData, cronExpression: e.target.value })}
                    className="docker-input"
                    disabled={!!actionLoading}
                  />
                  <small className="docker-hint">Format: minute hour day month weekday</small>
                </div>
              )}

              {/* Description */}
              <div className="docker-form-group">
                <label>Description (optional)</label>
                <textarea
                  placeholder="What does this task do?"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="docker-textarea"
                  rows={2}
                  disabled={!!actionLoading}
                />
              </div>
            </div>
            <div className="docker-modal-footer">
              <button
                onClick={() => setShowModal(false)}
                className="docker-btn-secondary"
                disabled={!!actionLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTask}
                className="docker-btn-primary"
                disabled={!!actionLoading || !formData.name || !formData.scheduledTime}
              >
                {actionLoading === 'save' ? '⏳ Saving...' : editingTask ? 'Save Changes' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DockerScheduler;

