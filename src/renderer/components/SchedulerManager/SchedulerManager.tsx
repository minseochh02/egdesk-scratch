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
  faList,
  faTimes,
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
  const [showTopicsModal, setShowTopicsModal] = useState(false);
  const [selectedTaskTopics, setSelectedTaskTopics] = useState<Array<{topic: string, lastUsed: string, count: number}>>([]);
  const [selectedTaskName, setSelectedTaskName] = useState<string>('');

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
      setError(err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다');
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
        setError(response.error || '작업 생성에 실패했습니다');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '작업 생성에 실패했습니다');
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
        setError(response.error || '작업 업데이트에 실패했습니다');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '작업 업데이트에 실패했습니다');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('이 작업을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await schedulerService.deleteTask(taskId);
      if (response.success) {
        setTasks((prev) => prev.filter((task) => task.id !== taskId));
        setExecutions((prev) => prev.filter((exec) => exec.taskId !== taskId));
      } else {
        setError(response.error || '작업 삭제에 실패했습니다');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '작업 삭제에 실패했습니다');
    }
  };

  const handleRunTask = async (taskId: string) => {
    try {
      const response = await schedulerService.runTaskNow(taskId);
      if (response.success) {
        await loadData(); // Refresh data to show new execution
      } else {
        setError(response.error || '작업 실행에 실패했습니다');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '작업 실행에 실패했습니다');
    }
  };

  const handleStopTask = async (taskId: string) => {
    try {
      const response = await schedulerService.stopTask(taskId);
      if (response.success) {
        await loadData(); // Refresh data to show updated execution status
      } else {
        setError(response.error || '작업 중지에 실패했습니다');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '작업 중지에 실패했습니다');
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
        setError(response.error || '실행 기록을 불러오는데 실패했습니다');
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '실행 기록을 불러오는데 실패했습니다',
      );
    }
  };

  const handleViewTopics = async (task: ScheduledTask) => {
    try {
      const response = await (window as any).electron.scheduler.getTaskMetadata(task.id);
      if (response.success && response.metadata?.topics) {
        setSelectedTaskTopics(response.metadata.topics);
        setSelectedTaskName(task.name);
        setShowTopicsModal(true);
      } else {
        setError('주제 정보를 불러오는데 실패했습니다');
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '주제 정보를 불러오는데 실패했습니다',
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
          <span>스케줄러를 불러오는 중...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`scheduler-manager ${className || ''}`}>
      <div className="scheduler-header">
        <h2>
          <FontAwesomeIcon icon={faClock} />
          작업 스케줄러
        </h2>
        <div className="header-actions">
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <FontAwesomeIcon icon={faPlus} />
            새 작업
          </button>
          <button className="btn btn-secondary" onClick={loadData}>
            <FontAwesomeIcon icon={faCog} />
            새로고침
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
          작업 ({tasks.length})
        </button>
        <button
          className={`tab ${activeTab === 'executions' ? 'active' : ''}`}
          onClick={() => setActiveTab('executions')}
        >
          <FontAwesomeIcon icon={faHistory} />
          실행 기록 ({executions.length})
        </button>
        <button
          className={`tab ${activeTab === 'system' ? 'active' : ''}`}
          onClick={() => setActiveTab('system')}
        >
          <FontAwesomeIcon icon={faInfoCircle} />
          시스템 정보
        </button>
      </div>

      <div className="scheduler-content">
        {activeTab === 'tasks' && (
          <div className="tasks-tab">
            {tasks.length === 0 ? (
              <div className="empty-state">
                <FontAwesomeIcon icon={faClock} />
                <h3>작업이 없습니다</h3>
                <p>첫 번째 예약된 작업을 생성하여 시작하세요.</p>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowCreateModal(true)}
                >
                  <FontAwesomeIcon icon={faPlus} />
                  작업 생성
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
                            {task.enabled ? '활성화됨' : '비활성화됨'}
                          </span>
                        </div>
                      </div>
                      <div className="task-actions">
                        {schedulerService.isTaskRunning(task.id) ? (
                          <button
                            className="btn btn-warning btn-sm"
                            onClick={() => handleStopTask(task.id)}
                            title="작업 중지"
                          >
                            <FontAwesomeIcon icon={faStop} />
                          </button>
                        ) : (
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => handleRunTask(task.id)}
                            title="지금 실행"
                          >
                            <FontAwesomeIcon icon={faPlay} />
                          </button>
                        )}
                        <button
                          className="btn btn-info btn-sm"
                          onClick={() => handleViewExecutions(task)}
                          title="실행 기록 보기"
                        >
                          <FontAwesomeIcon icon={faHistory} />
                        </button>
                        {task.metadata?.topics && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleViewTopics(task)}
                            title="주제 보기"
                          >
                            <FontAwesomeIcon icon={faList} />
                          </button>
                        )}
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
                          title="작업 편집"
                        >
                          <FontAwesomeIcon icon={faEdit} />
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteTask(task.id)}
                          title="작업 삭제"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>
                    </div>
                    <div className="task-details">
                      <div className="task-command">
                        <strong>명령어:</strong> {task.command}
                      </div>
                      {task.workingDirectory && (
                        <div className="task-working-dir">
                          <strong>작업 디렉토리:</strong>{' '}
                          {task.workingDirectory}
                        </div>
                      )}
                      <div className="task-timestamps">
                        <span>생성일: {formatDate(task.createdAt)}</span>
                        {task.lastRun && (
                          <span>마지막 실행: {formatDate(task.lastRun)}</span>
                        )}
                        {task.nextRun && (
                          <span>다음 실행: {formatDate(task.nextRun)}</span>
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
                <h3>실행 기록이 없습니다</h3>
                <p>작업이 실행되면 여기에 실행 기록이 표시됩니다.</p>
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
                          <h4>실행 {execution.id}</h4>
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
                          <strong>출력:</strong>
                          <pre>{execution.output}</pre>
                        </div>
                      )}
                      {execution.error && (
                        <div className="execution-error">
                          <strong>오류:</strong>
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
                  <h3>시스템 정보</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <strong>플랫폼:</strong> {systemInfo.platform}
                    </div>
                    <div className="info-item">
                      <strong>아키텍처:</strong> {systemInfo.arch}
                    </div>
                    <div className="info-item">
                      <strong>Node 버전:</strong> {systemInfo.nodeVersion}
                    </div>
                    <div className="info-item">
                      <strong>가동 시간:</strong>{' '}
                      {Math.floor(systemInfo.uptime / 60)} 분
                    </div>
                  </div>
                </div>
                <div className="info-section">
                  <h3>스케줄러 통계</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <strong>총 작업 수:</strong> {systemInfo.totalTasks}
                    </div>
                    <div className="info-item">
                      <strong>실행 중인 작업:</strong> {systemInfo.runningTasks}
                    </div>
                    <div className="info-item">
                      <strong>총 실행 횟수:</strong>{' '}
                      {systemInfo.totalExecutions}
                    </div>
                  </div>
                </div>
                <div className="info-section">
                  <h3>메모리 사용량</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <strong>RSS:</strong>{' '}
                      {Math.round(systemInfo.memoryUsage.rss / 1024 / 1024)} MB
                    </div>
                    <div className="info-item">
                      <strong>사용된 힙:</strong>{' '}
                      {Math.round(
                        systemInfo.memoryUsage.heapUsed / 1024 / 1024,
                      )}{' '}
                      MB
                    </div>
                    <div className="info-item">
                      <strong>전체 힙:</strong>{' '}
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
                <h3>시스템 정보를 사용할 수 없습니다</h3>
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
            <h3>실행 기록: {selectedTask.name}</h3>
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
                      <strong>출력:</strong>
                      <pre>{execution.output}</pre>
                    </div>
                  )}
                  {execution.error && (
                    <div className="execution-error">
                      <strong>오류:</strong>
                      <pre>{execution.error}</pre>
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
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Topics Modal */}
      {showTopicsModal && (
        <div className="modal-overlay">
          <div className="modal large">
            <div className="modal-header">
              <h3>주제 목록: {selectedTaskName}</h3>
              <button
                className="close-button"
                onClick={() => {
                  setShowTopicsModal(false);
                  setSelectedTaskTopics([]);
                  setSelectedTaskName('');
                }}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div className="topics-modal-content">
              {selectedTaskTopics.length > 0 ? (
                <div className="topics-list">
                  {selectedTaskTopics
                    .sort((a, b) => {
                      // Sort by lastUsed date in descending order (most recent first)
                      if (!a.lastUsed && !b.lastUsed) return 0;
                      if (!a.lastUsed) return 1;
                      if (!b.lastUsed) return -1;
                      return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
                    })
                    .map((topicItem, index) => (
                    <div key={index} className="topic-item">
                      <div className="topic-info">
                        <div className="topic-text">{topicItem.topic}</div>
                        <div className="topic-stats">
                          <span className="usage-count">
                            사용: {topicItem.count}회
                          </span>
                          {topicItem.lastUsed && (
                            <span className="last-used">
                              마지막: {new Date(topicItem.lastUsed).toLocaleDateString('ko-KR')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <FontAwesomeIcon icon={faList} />
                  <p>주제가 없습니다.</p>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowTopicsModal(false);
                  setSelectedTaskTopics([]);
                  setSelectedTaskName('');
                }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchedulerManager;
