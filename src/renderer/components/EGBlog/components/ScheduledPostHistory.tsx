import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faHistory,
  faClock,
  faCheckCircle,
  faExclamationTriangle,
  faSpinner,
  faTimes,
  faCalendarAlt,
  faFileAlt,
  faEye,
  faDownload,
  faRefresh,
  faSort,
  faFilter
} from '../../../utils/fontAwesomeIcons';
import './ScheduledPostHistory.css';

interface ExecutionHistory {
  id: string;
  scheduledPostId: string;
  status: 'success' | 'failure' | 'running';
  startedAt: Date;
  completedAt?: Date;
  duration?: number; // in milliseconds
  errorMessage?: string;
  blogPostId?: string;
  blogPostUrl?: string;
  topics: string[];
  generatedContent?: {
    title: string;
    excerpt: string;
    wordCount: number;
    imageCount: number;
  };
}

interface ScheduledPostHistoryProps {
  scheduledPostId: string;
  scheduledPostTitle: string;
  onClose: () => void;
}

const ScheduledPostHistory: React.FC<ScheduledPostHistoryProps> = ({
  scheduledPostId,
  scheduledPostTitle,
  onClose
}) => {
  const [history, setHistory] = useState<ExecutionHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  
  // Filter and sort states
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'duration' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Fetch execution history
  const fetchHistory = async () => {
    try {
      setIsLoading(true);
      setMessage(null);
      
      // This would call the main process to get execution history
      const result = await window.electron.scheduledPosts.getExecutionHistory(scheduledPostId);
      
      if (result.success && result.data) {
        setHistory(result.data);
      } else {
        setMessage({ 
          type: 'error', 
          text: result.error || 'Failed to fetch execution history' 
        });
      }
    } catch (error) {
      console.error('Failed to fetch execution history:', error);
      setMessage({ 
        type: 'error', 
        text: 'Failed to fetch execution history' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Load history on component mount
  useEffect(() => {
    fetchHistory();
  }, [scheduledPostId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return faCheckCircle;
      case 'failure':
        return faExclamationTriangle;
      case 'running':
        return faSpinner;
      default:
        return faClock;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'success';
      case 'failure':
        return 'error';
      case 'running':
        return 'warning';
      default:
        return 'neutral';
    }
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return 'N/A';
    
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  // Filter and sort history
  const filteredHistory = history.filter(entry => {
    if (statusFilter === 'all') return true;
    return entry.status === statusFilter;
  });

  const sortedHistory = [...filteredHistory].sort((a, b) => {
    let aValue: any, bValue: any;
    
    switch (sortBy) {
      case 'duration':
        aValue = a.duration || 0;
        bValue = b.duration || 0;
        break;
      case 'status':
        aValue = a.status;
        bValue = b.status;
        break;
      case 'date':
      default:
        aValue = new Date(a.startedAt).getTime();
        bValue = new Date(b.startedAt).getTime();
        break;
    }

    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const handleViewBlogPost = (blogPostUrl?: string) => {
    if (blogPostUrl) {
      window.open(blogPostUrl, '_blank');
    }
  };

  const handleDownloadLog = (entry: ExecutionHistory) => {
    // This would generate and download a log file for the execution
    console.log('Download log for entry:', entry.id);
  };

  return (
    <div className="eg-blog-scheduled-post-history-modal">
      <div className="eg-blog-scheduled-post-history-modal-content">
        <div className="eg-blog-scheduled-post-history-modal-header">
          <div className="eg-blog-scheduled-post-history-modal-title">
            <FontAwesomeIcon icon={faHistory} />
            <h3>Execution History</h3>
            <span className="eg-blog-scheduled-post-history-modal-subtitle">
              {scheduledPostTitle}
            </span>
          </div>
          <button
            className="eg-blog-scheduled-post-history-modal-close-btn"
            onClick={onClose}
            title="Close history"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {message && (
          <div className={`eg-blog-scheduled-post-history-modal-message eg-blog-scheduled-post-history-modal-message-${message.type}`}>
            <FontAwesomeIcon 
              icon={message.type === 'success' ? faCheckCircle : 
                    message.type === 'error' ? faExclamationTriangle : faClock} 
            />
            {message.text}
          </div>
        )}

        {/* Filters and Controls */}
        <div className="eg-blog-scheduled-post-history-modal-controls">
          <div className="eg-blog-scheduled-post-history-modal-filters">
            <div className="eg-blog-scheduled-post-history-modal-filter-group">
              <label>Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All</option>
                <option value="success">Success</option>
                <option value="failure">Failed</option>
                <option value="running">Running</option>
              </select>
            </div>

            <div className="eg-blog-scheduled-post-history-modal-sort-group">
              <label>Sort by:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'duration' | 'status')}
              >
                <option value="date">Date</option>
                <option value="duration">Duration</option>
                <option value="status">Status</option>
              </select>
              <button
                className="eg-blog-scheduled-post-history-modal-sort-order-btn"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
              >
                <FontAwesomeIcon icon={faSort} />
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>

          <button
            className="eg-blog-scheduled-post-history-modal-refresh-btn"
            onClick={fetchHistory}
            disabled={isLoading}
            title="Refresh history"
          >
            <FontAwesomeIcon icon={faRefresh} spin={isLoading} />
            Refresh
          </button>
        </div>

        {/* History List */}
        <div className="eg-blog-scheduled-post-history-modal-content-area">
          {isLoading ? (
            <div className="eg-blog-scheduled-post-history-modal-loading">
              <FontAwesomeIcon icon={faSpinner} spin />
              <p>Loading execution history...</p>
            </div>
          ) : sortedHistory.length === 0 ? (
            <div className="eg-blog-scheduled-post-history-modal-empty">
              <FontAwesomeIcon icon={faHistory} />
              <h4>No execution history</h4>
              <p>This scheduled post hasn't been executed yet.</p>
            </div>
          ) : (
            <div className="eg-blog-scheduled-post-history-modal-list">
              {sortedHistory.map((entry) => (
                <div key={entry.id} className={`eg-blog-scheduled-post-history-modal-item ${entry.status}`}>
                  <div className="eg-blog-scheduled-post-history-modal-item-header">
                    <div className="eg-blog-scheduled-post-history-modal-item-status">
                      <FontAwesomeIcon 
                        icon={getStatusIcon(entry.status)} 
                        className={getStatusColor(entry.status)}
                        spin={entry.status === 'running'}
                      />
                      <span className={`status-${entry.status}`}>
                        {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                      </span>
                    </div>
                    <div className="eg-blog-scheduled-post-history-modal-item-time">
                      <FontAwesomeIcon icon={faClock} />
                      <span>{formatDate(entry.startedAt)}</span>
                    </div>
                  </div>

                  <div className="eg-blog-scheduled-post-history-modal-item-content">
                    {/* Duration */}
                    <div className="eg-blog-scheduled-post-history-modal-item-duration">
                      <strong>Duration:</strong> {formatDuration(entry.duration)}
                    </div>

                    {/* Topics */}
                    {entry.topics.length > 0 && (
                      <div className="eg-blog-scheduled-post-history-modal-item-topics">
                        <strong>Topics:</strong>
                        <div className="eg-blog-scheduled-post-history-modal-topics-tags">
                          {entry.topics.map((topic, index) => (
                            <span key={index} className="eg-blog-scheduled-post-history-modal-topic-tag">
                              {topic}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Generated Content Info */}
                    {entry.generatedContent && (
                      <div className="eg-blog-scheduled-post-history-modal-item-content-info">
                        <div className="eg-blog-scheduled-post-history-modal-content-item">
                          <strong>Title:</strong> {entry.generatedContent.title}
                        </div>
                        <div className="eg-blog-scheduled-post-history-modal-content-item">
                          <strong>Excerpt:</strong> {entry.generatedContent.excerpt}
                        </div>
                        <div className="eg-blog-scheduled-post-history-modal-content-stats">
                          <span>{entry.generatedContent.wordCount} words</span>
                          <span>{entry.generatedContent.imageCount} images</span>
                        </div>
                      </div>
                    )}

                    {/* Error Message */}
                    {entry.status === 'failure' && entry.errorMessage && (
                      <div className="eg-blog-scheduled-post-history-modal-item-error">
                        <strong>Error:</strong> {entry.errorMessage}
                      </div>
                    )}

                    {/* Blog Post Link */}
                    {entry.status === 'success' && entry.blogPostUrl && (
                      <div className="eg-blog-scheduled-post-history-modal-item-blog-link">
                        <button
                          className="eg-blog-scheduled-post-history-modal-view-btn"
                          onClick={() => handleViewBlogPost(entry.blogPostUrl)}
                          title="View blog post"
                        >
                          <FontAwesomeIcon icon={faEye} />
                          View Blog Post
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="eg-blog-scheduled-post-history-modal-item-actions">
                    <button
                      className="eg-blog-scheduled-post-history-modal-action-btn"
                      onClick={() => handleDownloadLog(entry)}
                      title="Download execution log"
                    >
                      <FontAwesomeIcon icon={faDownload} />
                      Log
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

export default ScheduledPostHistory;
