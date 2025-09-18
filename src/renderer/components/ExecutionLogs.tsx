import React, { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faClock,
  faCheckCircle,
  faTimesCircle,
  faExclamationTriangle,
  faSpinner,
  faSearch,
  faFilter,
  faTrash,
  faRefresh,
  faDatabase,
  faChartBar,
  faEye,
  faEyeSlash,
  faSort,
  faSortUp,
  faSortDown,
} from '../utils/fontAwesomeIcons';
import './ExecutionLogs.css';

interface TaskExecution {
  id: string;
  taskId: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  exitCode?: number;
  output?: string;
  error?: string;
  pid?: number;
}

interface ExecutionStats {
  total: number;
  completed: number;
  failed: number;
  running: number;
  cancelled: number;
}

interface ExecutionLogsProps {
  taskId?: string;
  onClose?: () => void;
  showHeader?: boolean;
}

const ExecutionLogs: React.FC<ExecutionLogsProps> = ({ 
  taskId, 
  onClose, 
  showHeader = true 
}) => {
  const [executions, setExecutions] = useState<TaskExecution[]>([]);
  const [stats, setStats] = useState<ExecutionStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'startTime' | 'status' | 'duration'>('startTime');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [databaseSize, setDatabaseSize] = useState<number>(0);

  const loadExecutions = useCallback(async () => {
    if (!window.electron?.executionLogs) {
      setError('Execution logs API not available');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      let result;
      if (taskId) {
        result = await window.electron.executionLogs.getExecutionsForTask(taskId, 100);
      } else {
        result = await window.electron.executionLogs.getRecentExecutions(100);
      }

      if (result.success && result.executions) {
        setExecutions(result.executions);
      } else {
        setError(result.error || 'Failed to load executions');
      }
    } catch (err) {
      console.error('Error loading executions:', err);
      setError('Failed to load execution logs');
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  const loadStats = useCallback(async () => {
    if (!window.electron?.executionLogs) return;

    try {
      const result = await window.electron.executionLogs.getExecutionStats(taskId);
      if (result.success && result.stats) {
        setStats(result.stats);
      }
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  }, [taskId]);

  const loadDatabaseSize = useCallback(async () => {
    if (!window.electron?.executionLogs) return;

    try {
      const result = await window.electron.executionLogs.getDatabaseSize();
      if (result.success && result.size !== undefined) {
        setDatabaseSize(result.size);
      }
    } catch (err) {
      console.error('Error loading database size:', err);
    }
  }, []);

  const cleanupOldLogs = async () => {
    if (!window.electron?.executionLogs) return;

    if (!window.confirm('Delete logs older than 30 days? This action cannot be undone.')) {
      return;
    }

    try {
      const result = await window.electron.executionLogs.cleanupOldLogs(30);
      if (result.success) {
        alert(`Cleaned up ${result.deletedCount} old logs`);
        loadExecutions();
        loadStats();
        loadDatabaseSize();
      } else {
        alert(`Cleanup failed: ${result.error}`);
      }
    } catch (err) {
      console.error('Error cleaning up logs:', err);
      alert('Failed to cleanup old logs');
    }
  };

  useEffect(() => {
    loadExecutions();
    loadStats();
    loadDatabaseSize();
  }, [loadExecutions, loadStats, loadDatabaseSize]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <FontAwesomeIcon icon={faCheckCircle} className="status-icon completed" />;
      case 'failed':
        return <FontAwesomeIcon icon={faTimesCircle} className="status-icon failed" />;
      case 'running':
        return <FontAwesomeIcon icon={faSpinner} spin className="status-icon running" />;
      case 'cancelled':
        return <FontAwesomeIcon icon={faExclamationTriangle} className="status-icon cancelled" />;
      default:
        return <FontAwesomeIcon icon={faClock} className="status-icon" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'running':
        return 'Running';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  };

  const formatDuration = (startTime: Date, endTime?: Date) => {
    if (!endTime) return 'Running...';
    
    const duration = endTime.getTime() - startTime.getTime();
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const toggleLogExpansion = (executionId: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(executionId)) {
      newExpanded.delete(executionId);
    } else {
      newExpanded.add(executionId);
    }
    setExpandedLogs(newExpanded);
  };

  const filteredExecutions = executions
    .filter(execution => {
      const matchesSearch = !searchTerm || 
        execution.taskId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        execution.output?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        execution.error?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || execution.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'startTime':
          comparison = a.startTime.getTime() - b.startTime.getTime();
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'duration':
          const aDuration = a.endTime ? a.endTime.getTime() - a.startTime.getTime() : 0;
          const bDuration = b.endTime ? b.endTime.getTime() - b.startTime.getTime() : 0;
          comparison = aDuration - bDuration;
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const getSortIcon = (column: string) => {
    if (sortBy !== column) return <FontAwesomeIcon icon={faSort} className="sort-icon" />;
    return sortOrder === 'asc' ? 
      <FontAwesomeIcon icon={faSortUp} className="sort-icon" /> : 
      <FontAwesomeIcon icon={faSortDown} className="sort-icon" />;
  };

  const handleSort = (column: 'startTime' | 'status' | 'duration') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  return (
    <div className="execution-logs">
      {showHeader && (
        <div className="logs-header">
          <div className="header-content">
            <h3>
              <FontAwesomeIcon icon={faDatabase} />
              Execution Logs
              {taskId && <span className="task-id">for Task {taskId}</span>}
            </h3>
            <div className="header-actions">
              <button
                className="logs-action-btn secondary"
                onClick={loadExecutions}
                disabled={isLoading}
              >
                <FontAwesomeIcon icon={faRefresh} spin={isLoading} />
                Refresh
              </button>
              <button
                className="logs-action-btn danger"
                onClick={cleanupOldLogs}
                title="Delete logs older than 30 days"
              >
                <FontAwesomeIcon icon={faTrash} />
                Cleanup
              </button>
              {onClose && (
                <button
                  className="logs-action-btn secondary"
                  onClick={onClose}
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats Overview */}
      {stats && (
        <div className="logs-stats">
          <div className="stat-item">
            <FontAwesomeIcon icon={faChartBar} />
            <span className="stat-label">Total:</span>
            <span className="stat-value">{stats.total}</span>
          </div>
          <div className="stat-item">
            <FontAwesomeIcon icon={faCheckCircle} className="completed" />
            <span className="stat-label">Completed:</span>
            <span className="stat-value">{stats.completed}</span>
          </div>
          <div className="stat-item">
            <FontAwesomeIcon icon={faTimesCircle} className="failed" />
            <span className="stat-label">Failed:</span>
            <span className="stat-value">{stats.failed}</span>
          </div>
          <div className="stat-item">
            <FontAwesomeIcon icon={faSpinner} className="running" />
            <span className="stat-label">Running:</span>
            <span className="stat-value">{stats.running}</span>
          </div>
          <div className="stat-item">
            <FontAwesomeIcon icon={faDatabase} />
            <span className="stat-label">DB Size:</span>
            <span className="stat-value">{databaseSize.toFixed(2)} MB</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="logs-filters">
        <div className="filter-group">
          <FontAwesomeIcon icon={faSearch} />
          <input
            type="text"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="filter-group">
          <FontAwesomeIcon icon={faFilter} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="status-filter"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="running">Running</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Executions List */}
      <div className="executions-list">
        {isLoading ? (
          <div className="loading-container">
            <FontAwesomeIcon icon={faSpinner} spin />
            <span>Loading execution logs...</span>
          </div>
        ) : error ? (
          <div className="error-container">
            <FontAwesomeIcon icon={faExclamationTriangle} />
            <span>{error}</span>
            <button onClick={loadExecutions} className="retry-btn">
              <FontAwesomeIcon icon={faRefresh} />
              Retry
            </button>
          </div>
        ) : filteredExecutions.length === 0 ? (
          <div className="empty-state">
            <FontAwesomeIcon icon={faDatabase} />
            <span>No execution logs found</span>
          </div>
        ) : (
          <div className="executions-table">
            <div className="table-header">
              <div 
                className="table-cell sortable"
                onClick={() => handleSort('startTime')}
              >
                Start Time {getSortIcon('startTime')}
              </div>
              <div 
                className="table-cell sortable"
                onClick={() => handleSort('status')}
              >
                Status {getSortIcon('status')}
              </div>
              <div 
                className="table-cell sortable"
                onClick={() => handleSort('duration')}
              >
                Duration {getSortIcon('duration')}
              </div>
              <div className="table-cell">Task ID</div>
              <div className="table-cell">Actions</div>
            </div>
            
            {filteredExecutions.map((execution) => (
              <div key={execution.id} className="execution-row">
                <div className="table-cell">
                  <div className="execution-time">
                    {execution.startTime.toLocaleString()}
                  </div>
                  {execution.endTime && (
                    <div className="execution-end-time">
                      Ended: {execution.endTime.toLocaleString()}
                    </div>
                  )}
                </div>
                
                <div className="table-cell">
                  <div className="execution-status">
                    {getStatusIcon(execution.status)}
                    <span>{getStatusText(execution.status)}</span>
                  </div>
                  {execution.exitCode !== undefined && (
                    <div className="exit-code">
                      Exit Code: {execution.exitCode}
                    </div>
                  )}
                </div>
                
                <div className="table-cell">
                  {formatDuration(execution.startTime, execution.endTime)}
                </div>
                
                <div className="table-cell">
                  <div className="task-id">{execution.taskId}</div>
                  {execution.pid && (
                    <div className="pid">PID: {execution.pid}</div>
                  )}
                </div>
                
                <div className="table-cell">
                  <button
                    className="logs-action-btn small"
                    onClick={() => toggleLogExpansion(execution.id)}
                    title={expandedLogs.has(execution.id) ? 'Hide details' : 'Show details'}
                  >
                    <FontAwesomeIcon 
                      icon={expandedLogs.has(execution.id) ? faEyeSlash : faEye} 
                    />
                  </button>
                </div>
                
                {/* Expanded Log Details */}
                {expandedLogs.has(execution.id) && (
                  <div className="execution-details">
                    <div className="details-section">
                      <h4>Output</h4>
                      <pre className="log-output">
                        {execution.output || 'No output available'}
                      </pre>
                    </div>
                    
                    {execution.error && (
                      <div className="details-section">
                        <h4>Error</h4>
                        <pre className="log-error">
                          {execution.error}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExecutionLogs;
