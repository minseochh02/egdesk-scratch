import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus,
  faPlay,
  faStop,
  faEdit,
  faTrash,
  faClock,
  faCheckCircle,
  faTimesCircle,
  faSpinner,
  faCog,
  faHistory,
  faInfoCircle,
} from '@fortawesome/free-solid-svg-icons';
import SchedulerService, {
  CreateTaskData,
  UpdateTaskData,
} from '../../services/schedulerService';
import { ScheduledTask, TaskExecution } from '../../../main/preload';
import TaskForm from './TaskForm';
import './SchedulerManager.css';

interface SchedulerManagerProps {
  className?: string;
}

const SchedulerManager: React.FC<SchedulerManagerProps> = ({ className }) => {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [executions, setExecutions] = useState<TaskExecution[]>([]);
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showExecutionsModal, setShowExecutionsModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ScheduledTask | null>(null);
  const [selectedTaskExecutions, setSelectedTaskExecutions] = useState<
    TaskExecution[]
  >([]);
  const [activeTab, setActiveTab] = useState<'tasks' | 'executions' | 'system'>(
    'tasks',
  );
  const [editingTaskData, setEditingTaskData] = useState<CreateTaskData | null>(
    null,
  );

  const schedulerService = SchedulerService.getInstance();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [tasksResponse, executionsResponse, systemInfoResponse] =
        await Promise.all([
          schedulerService.getAllTasks(),
          schedulerService.getExecutions(),
          schedulerService.getSystemInfo(),
        ]);

      if (tasksResponse.success) {
        setTasks(tasksResponse.data || []);
      }

      if (executionsResponse.success) {
        setExecutions(executionsResponse.data || []);
      }

      if (systemInfoResponse.success) {
        setSystemInfo(systemInfoResponse.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (taskData: CreateTaskData) => {
    try {
      const response = await schedulerService.createTask(taskData);
      if (response.success) {
        setTasks((prev) => [...prev, response.data!]);
        setShowCreateModal(false);
        setError(null);
      } else {
        setError(response.error || 'Failed to create task');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    }
  };

  const handleUpdateTask = async (taskData: CreateTaskData) => {
    if (!selectedTask) return;

    try {
      const response = await schedulerService.updateTask(
        selectedTask.id,
        taskData,
      );
      if (response.success) {
        setTasks((prev) =>
          prev.map((task) =>
            task.id === selectedTask.id ? response.data! : task,
          ),
        );
        setShowEditModal(false);
        setSelectedTask(null);
        setEditingTaskData(null);
        setError(null);
      } else {
        setError(response.error || 'Failed to update task');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Are you sure you want to delete this task?')) {
      return;
    }

    try {
      const response = await schedulerService.deleteTask(taskId);
      if (response.success) {
        setTasks((prev) => prev.filter((task) => task.id !== taskId));
        setExecutions((prev) => prev.filter((exec) => exec.taskId !== taskId));
      } else {
        setError(response.error || 'Failed to delete task');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
    }
  };

  const handleRunTask = async (taskId: string) => {
    try {
      const response = await schedulerService.runTaskNow(taskId);
      if (response.success) {
        await loadData(); // Refresh data to show new execution
      } else {
        setError(response.error || 'Failed to run task');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run task');
    }
  };

  const handleStopTask = async (taskId: string) => {
    try {
      const response = await schedulerService.stopTask(taskId);
      if (response.success) {
        await loadData(); // Refresh data to show updated execution status
      } else {
        setError(response.error || 'Failed to stop task');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop task');
    }
  };

  const handleViewExecutions = async (task: ScheduledTask) => {
    try {
      const response = await schedulerService.getExecutions(task.id);
      if (response.success) {
        setSelectedTask(task);
        setSelectedTaskExecutions(response.data || []);
        setShowExecutionsModal(true);
      } else {
        setError(response.error || 'Failed to load executions');
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load executions',
      );
    }
  };

  const createHttpRequestTask = async () => {
    const url = 'https://demo-chatbot-iota.vercel.app/';
    const taskData: CreateTaskData = {
      name: 'HTTP Request to Demo Chatbot',
      description: `Sends a GET request to ${url} every 5 minutes`,
      command: `curl -X GET "${url}"`,
      schedule: 'interval:300000', // 5 minutes
      enabled: true,
      workingDirectory: '',
      environment: {},
      outputFile: '',
      errorFile: '',
    };

    try {
      const response = await schedulerService.createTask(taskData);
      if (response.success) {
        setTasks((prev) => [...prev, response.data!]);
        setError(null);
        // Show success message
        alert(
          'HTTP Request task created successfully! It will run every 5 minutes.',
        );
      } else {
        setError(response.error || 'Failed to create HTTP request task');
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to create HTTP request task',
      );
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <FontAwesomeIcon icon={faSpinner} className="spinning" />;
      case 'completed':
        return (
          <FontAwesomeIcon icon={faCheckCircle} className="text-success" />
        );
      case 'failed':
        return <FontAwesomeIcon icon={faTimesCircle} className="text-error" />;
      case 'cancelled':
        return (
          <FontAwesomeIcon icon={faTimesCircle} className="text-warning" />
        );
      default:
        return <FontAwesomeIcon icon={faClock} />;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'running':
        return 'status-running';
      case 'completed':
        return 'status-completed';
      case 'failed':
        return 'status-failed';
      case 'cancelled':
        return 'status-cancelled';
      default:
        return 'status-pending';
    }
  };

  if (loading) {
    return (
      <div className={`scheduler-manager ${className || ''}`}>
        <div className="loading">
          <FontAwesomeIcon icon={faSpinner} className="spinning" />
          <span>Loading scheduler...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`scheduler-manager ${className || ''}`}>
      <div className="scheduler-header">
        <h2>
          <FontAwesomeIcon icon={faClock} />
          Task Scheduler
        </h2>
        <div className="header-actions">
          <button className="btn btn-success" onClick={createHttpRequestTask}>
            <FontAwesomeIcon icon={faPlus} />
            HTTP Request (5min)
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <FontAwesomeIcon icon={faPlus} />
            New Task
          </button>
          <button className="btn btn-secondary" onClick={loadData}>
            <FontAwesomeIcon icon={faCog} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <FontAwesomeIcon icon={faTimesCircle} />
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="scheduler-tabs">
        <button
          className={`tab ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          <FontAwesomeIcon icon={faClock} />
          Tasks ({tasks.length})
        </button>
        <button
          className={`tab ${activeTab === 'executions' ? 'active' : ''}`}
          onClick={() => setActiveTab('executions')}
        >
          <FontAwesomeIcon icon={faHistory} />
          Executions ({executions.length})
        </button>
        <button
          className={`tab ${activeTab === 'system' ? 'active' : ''}`}
          onClick={() => setActiveTab('system')}
        >
          <FontAwesomeIcon icon={faInfoCircle} />
          System Info
        </button>
      </div>

      <div className="scheduler-content">
        {activeTab === 'tasks' && (
          <div className="tasks-tab">
            {tasks.length === 0 ? (
              <div className="empty-state">
                <FontAwesomeIcon icon={faClock} />
                <h3>No tasks found</h3>
                <p>Create your first scheduled task to get started.</p>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowCreateModal(true)}
                >
                  <FontAwesomeIcon icon={faPlus} />
                  Create Task
                </button>
              </div>
            ) : (
              <div className="tasks-list">
                {tasks.map((task) => (
                  <div key={task.id} className="task-card">
                    <div className="task-header">
                      <div className="task-info">
                        <h3>{task.name}</h3>
                        {task.description && (
                          <p className="task-description">{task.description}</p>
                        )}
                        <div className="task-meta">
                          <span className="task-schedule">
                            <FontAwesomeIcon icon={faClock} />
                            {schedulerService.formatSchedule(task.schedule)}
                          </span>
                          <span
                            className={`task-status ${task.enabled ? 'enabled' : 'disabled'}`}
                          >
                            {task.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      </div>
                      <div className="task-actions">
                        {schedulerService.isTaskRunning(task.id) ? (
                          <button
                            className="btn btn-warning btn-sm"
                            onClick={() => handleStopTask(task.id)}
                            title="Stop Task"
                          >
                            <FontAwesomeIcon icon={faStop} />
                          </button>
                        ) : (
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => handleRunTask(task.id)}
                            title="Run Now"
                          >
                            <FontAwesomeIcon icon={faPlay} />
                          </button>
                        )}
                        <button
                          className="btn btn-info btn-sm"
                          onClick={() => handleViewExecutions(task)}
                          title="View Executions"
                        >
                          <FontAwesomeIcon icon={faHistory} />
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setSelectedTask(task);
                            setEditingTaskData({
                              name: task.name,
                              description: task.description,
                              command: task.command,
                              schedule: task.schedule,
                              enabled: task.enabled,
                              workingDirectory: task.workingDirectory,
                              environment: task.environment,
                              outputFile: task.outputFile,
                              errorFile: task.errorFile,
                            });
                            setShowEditModal(true);
                          }}
                          title="Edit Task"
                        >
                          <FontAwesomeIcon icon={faEdit} />
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteTask(task.id)}
                          title="Delete Task"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>
                    </div>
                    <div className="task-details">
                      <div className="task-command">
                        <strong>Command:</strong> {task.command}
                      </div>
                      {task.workingDirectory && (
                        <div className="task-working-dir">
                          <strong>Working Directory:</strong>{' '}
                          {task.workingDirectory}
                        </div>
                      )}
                      <div className="task-timestamps">
                        <span>Created: {formatDate(task.createdAt)}</span>
                        {task.lastRun && (
                          <span>Last Run: {formatDate(task.lastRun)}</span>
                        )}
                        {task.nextRun && (
                          <span>Next Run: {formatDate(task.nextRun)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'executions' && (
          <div className="executions-tab">
            {executions.length === 0 ? (
              <div className="empty-state">
                <FontAwesomeIcon icon={faHistory} />
                <h3>No executions found</h3>
                <p>Task executions will appear here when tasks are run.</p>
              </div>
            ) : (
              <div className="executions-list">
                {executions
                  .sort(
                    (a, b) =>
                      new Date(b.startTime).getTime() -
                      new Date(a.startTime).getTime(),
                  )
                  .map((execution) => (
                    <div key={execution.id} className="execution-card">
                      <div className="execution-header">
                        <div className="execution-info">
                          <h4>Execution {execution.id}</h4>
                          <div className="execution-meta">
                            <span
                              className={`execution-status ${getStatusClass(execution.status)}`}
                            >
                              {getStatusIcon(execution.status)}
                              {execution.status}
                            </span>
                            <span className="execution-time">
                              {formatDate(execution.startTime)}
                              {execution.endTime &&
                                ` - ${formatDate(execution.endTime)}`}
                            </span>
                          </div>
                        </div>
                        {execution.pid && (
                          <div className="execution-pid">
                            PID: {execution.pid}
                          </div>
                        )}
                      </div>
                      {execution.output && (
                        <div className="execution-output">
                          <strong>Output:</strong>
                          <pre>{execution.output}</pre>
                        </div>
                      )}
                      {execution.error && (
                        <div className="execution-error">
                          <strong>Error:</strong>
                          <pre>{execution.error}</pre>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'system' && (
          <div className="system-tab">
            {systemInfo ? (
              <div className="system-info">
                <div className="info-section">
                  <h3>System Information</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <strong>Platform:</strong> {systemInfo.platform}
                    </div>
                    <div className="info-item">
                      <strong>Architecture:</strong> {systemInfo.arch}
                    </div>
                    <div className="info-item">
                      <strong>Node Version:</strong> {systemInfo.nodeVersion}
                    </div>
                    <div className="info-item">
                      <strong>Uptime:</strong>{' '}
                      {Math.floor(systemInfo.uptime / 60)} minutes
                    </div>
                  </div>
                </div>
                <div className="info-section">
                  <h3>Scheduler Statistics</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <strong>Total Tasks:</strong> {systemInfo.totalTasks}
                    </div>
                    <div className="info-item">
                      <strong>Running Tasks:</strong> {systemInfo.runningTasks}
                    </div>
                    <div className="info-item">
                      <strong>Total Executions:</strong>{' '}
                      {systemInfo.totalExecutions}
                    </div>
                  </div>
                </div>
                <div className="info-section">
                  <h3>Memory Usage</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <strong>RSS:</strong>{' '}
                      {Math.round(systemInfo.memoryUsage.rss / 1024 / 1024)} MB
                    </div>
                    <div className="info-item">
                      <strong>Heap Used:</strong>{' '}
                      {Math.round(
                        systemInfo.memoryUsage.heapUsed / 1024 / 1024,
                      )}{' '}
                      MB
                    </div>
                    <div className="info-item">
                      <strong>Heap Total:</strong>{' '}
                      {Math.round(
                        systemInfo.memoryUsage.heapTotal / 1024 / 1024,
                      )}{' '}
                      MB
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <FontAwesomeIcon icon={faInfoCircle} />
                <h3>System information not available</h3>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Task Creation Modal */}
      <TaskForm
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateTask}
        mode="create"
      />

      {/* Task Edit Modal */}
      <TaskForm
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedTask(null);
          setEditingTaskData(null);
        }}
        onSubmit={handleUpdateTask}
        editingTask={editingTaskData}
        mode="edit"
      />

      {showExecutionsModal && selectedTask && (
        <div className="modal-overlay">
          <div className="modal large">
            <h3>Executions for: {selectedTask.name}</h3>
            <div className="executions-list">
              {selectedTaskExecutions.map((execution) => (
                <div key={execution.id} className="execution-card">
                  <div className="execution-header">
                    <span
                      className={`execution-status ${getStatusClass(execution.status)}`}
                    >
                      {getStatusIcon(execution.status)}
                      {execution.status}
                    </span>
                    <span className="execution-time">
                      {formatDate(execution.startTime)}
                    </span>
                  </div>
                  {execution.output && (
                    <div className="execution-output">
                      <pre>{execution.output}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowExecutionsModal(false);
                  setSelectedTask(null);
                  setSelectedTaskExecutions([]);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchedulerManager;
