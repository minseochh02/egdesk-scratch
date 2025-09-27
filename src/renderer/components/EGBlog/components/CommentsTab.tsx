import React, { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faComments, 
  faCalendarAlt, 
  faUser, 
  faEnvelope, 
  faGlobe, 
  faCheckCircle,
  faTimesCircle,
  faExclamationTriangle,
  faTrash, 
  faEdit, 
  faExternalLinkAlt,
  faRefresh,
  faSearch,
  faFilter,
  faSort,
  faChevronLeft,
  faChevronRight,
  faSpinner,
  faEye,
  faReply,
  faFlag,
  faThumbsUp,
  faThumbsDown
} from '../../../utils/fontAwesomeIcons';
import './CommentsTab.css';

interface WordPressComment {
  id: number;
  post_id: number;
  parent?: number;
  author_name?: string;
  author_email?: string;
  author_url?: string;
  author_ip?: string;
  content: string;
  status?: string;
  type?: string;
  karma?: number;
  date?: string;
  date_gmt?: string;
  link?: string;
  wordpress_site_id: string;
  synced_at?: string;
}

interface CommentsTabProps {
  connectionId: string;
  connectionName: string;
  connectionType: string;
  onStatsUpdate?: () => void;
}

const CommentsTab: React.FC<CommentsTabProps> = ({
  connectionId,
  connectionName,
  connectionType,
  onStatsUpdate
}) => {
  const [comments, setComments] = useState<WordPressComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'author' | 'status' | 'post'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalComments, setTotalComments] = useState(0);
  const [selectedComments, setSelectedComments] = useState<Set<number>>(new Set());
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string>('');
  const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set());
  
  const commentsPerPage = 20;

  const loadComments = useCallback(async () => {
    if (!window.electron?.wordpress) {
      setError('WordPress API not available');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const offset = (currentPage - 1) * commentsPerPage;
      const result = await window.electron.wordpress.getComments(
        connectionId, 
        commentsPerPage, 
        offset
      );

      if (result.success && result.comments) {
        setComments(result.comments);
        setTotalComments(result.comments.length); // This might need adjustment based on actual API
      } else {
        setError(result.error || 'Failed to load comments');
      }
    } catch (err) {
      console.error('Error loading comments:', err);
      setError('Failed to load comments');
    } finally {
      setIsLoading(false);
    }
  }, [connectionId, currentPage]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleRefresh = () => {
    loadComments();
  };

  const handleFetchComments = async () => {
    if (!window.electron?.wordpress) {
      setFetchError('WordPress API not available');
      return;
    }

    setIsFetching(true);
    setFetchError('');

    try {
      const result = await window.electron.wordpress.fetchComments(connectionId, {
        perPage: 100,
        status: 'all'
      });

      if (result.success) {
        console.log(`✅ Fetched ${result.comments?.length || 0} comments from WordPress`);
        // Reload comments from SQLite to show the newly fetched ones
        await loadComments();
        // Update stats in parent component
        onStatsUpdate?.();
      } else {
        setFetchError(result.error || 'Failed to fetch comments');
      }
    } catch (err) {
      console.error('Error fetching comments:', err);
      setFetchError('Failed to fetch comments from WordPress');
    } finally {
      setIsFetching(false);
    }
  };

  const handleFetchAllComments = async () => {
    if (!window.electron?.wordpress) {
      setFetchError('WordPress API not available');
      return;
    }

    setIsFetching(true);
    setFetchError('');

    try {
      const result = await window.electron.wordpress.fetchAllComments(connectionId, {
        perPage: 100
      });

      if (result.success) {
        console.log(`✅ Fetched all ${result.totalComments || 0} comments from WordPress`);
        // Reload comments from SQLite to show the newly fetched ones
        await loadComments();
        // Update stats in parent component
        onStatsUpdate?.();
      } else {
        setFetchError(result.error || 'Failed to fetch all comments');
      }
    } catch (err) {
      console.error('Error fetching all comments:', err);
      setFetchError('Failed to fetch all comments from WordPress');
    } finally {
      setIsFetching(false);
    }
  };

  const handleApproveComment = async (commentId: number) => {
    if (!window.electron?.wordpress) return;

    try {
      const result = await window.electron.wordpress.updateCommentStatus(connectionId, commentId, 'approved');
      if (result.success) {
        await loadComments();
        onStatsUpdate?.();
      }
    } catch (err) {
      console.error('Error approving comment:', err);
    }
  };

  const handleSpamComment = async (commentId: number) => {
    if (!window.electron?.wordpress) return;

    try {
      const result = await window.electron.wordpress.updateCommentStatus(connectionId, commentId, 'spam');
      if (result.success) {
        await loadComments();
        onStatsUpdate?.();
      }
    } catch (err) {
      console.error('Error marking comment as spam:', err);
    }
  };

  const handleTrashComment = async (commentId: number) => {
    if (!window.electron?.wordpress) return;

    try {
      const result = await window.electron.wordpress.updateCommentStatus(connectionId, commentId, 'trash');
      if (result.success) {
        await loadComments();
        onStatsUpdate?.();
      }
    } catch (err) {
      console.error('Error trashing comment:', err);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!window.electron?.wordpress) return;

    if (window.confirm('Are you sure you want to permanently delete this comment?')) {
      try {
        const result = await window.electron.wordpress.deleteComment(connectionId, commentId);
        if (result.success) {
          await loadComments();
          onStatsUpdate?.();
        }
      } catch (err) {
        console.error('Error deleting comment:', err);
      }
    }
  };

  const handleViewComment = (comment: WordPressComment) => {
    if (comment.link) {
      window.open(comment.link, '_blank', 'noopener,noreferrer');
    }
  };

  const handleSelectComment = (commentId: number) => {
    const newSelected = new Set(selectedComments);
    if (newSelected.has(commentId)) {
      newSelected.delete(commentId);
    } else {
      newSelected.add(commentId);
    }
    setSelectedComments(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedComments.size === filteredComments.length) {
      setSelectedComments(new Set());
    } else {
      setSelectedComments(new Set(filteredComments.map(c => c.id)));
    }
  };

  const toggleCommentExpansion = (commentId: number) => {
    const newExpanded = new Set(expandedComments);
    if (newExpanded.has(commentId)) {
      newExpanded.delete(commentId);
    } else {
      newExpanded.add(commentId);
    }
    setExpandedComments(newExpanded);
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'approved':
        return <FontAwesomeIcon icon={faCheckCircle} className="status-approved" />;
      case 'hold':
      case 'pending':
        return <FontAwesomeIcon icon={faExclamationTriangle} className="status-pending" />;
      case 'spam':
        return <FontAwesomeIcon icon={faFlag} className="status-spam" />;
      case 'trash':
        return <FontAwesomeIcon icon={faTrash} className="status-trash" />;
      default:
        return <FontAwesomeIcon icon={faTimesCircle} className="status-unknown" />;
    }
  };

  const getStatusBadgeClass = (status?: string) => {
    switch (status) {
      case 'approved':
        return 'eg-blog-comments-status-approved';
      case 'hold':
      case 'pending':
        return 'eg-blog-comments-status-pending';
      case 'spam':
        return 'eg-blog-comments-status-spam';
      case 'trash':
        return 'eg-blog-comments-status-trash';
      default:
        return 'eg-blog-comments-status-unknown';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredComments = comments.filter(comment => {
    const matchesSearch = comment.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (comment.author_name && comment.author_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (comment.author_email && comment.author_email.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || comment.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const sortedComments = [...filteredComments].sort((a, b) => {
    let aValue: any, bValue: any;
    
    switch (sortBy) {
      case 'author':
        aValue = (a.author_name || '').toLowerCase();
        bValue = (b.author_name || '').toLowerCase();
        break;
      case 'status':
        aValue = a.status || '';
        bValue = b.status || '';
        break;
      case 'post':
        aValue = a.post_id;
        bValue = b.post_id;
        break;
      case 'date':
      default:
        aValue = new Date(a.date || a.synced_at || '').getTime();
        bValue = new Date(b.date || b.synced_at || '').getTime();
        break;
    }

    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const totalPages = Math.ceil(totalComments / commentsPerPage);

  if (isLoading && comments.length === 0) {
    return (
      <div className="eg-blog-comments-loading">
        <FontAwesomeIcon icon={faSpinner} spin />
        <p>Loading comments...</p>
      </div>
    );
  }

  return (
    <div className="eg-blog-comments-tab">
      {/* Header */}
      <div className="eg-blog-comments-header">
        <div className="eg-blog-comments-header-info">
          <h3>Comments</h3>
          <p>Manage comments for {connectionName} ({connectionType})</p>
        </div>
        <div className="eg-blog-comments-header-actions">
          <button 
            className="eg-blog-comments-fetch-btn"
            onClick={handleFetchComments}
            disabled={isFetching || isLoading}
            title="Fetch recent comments from WordPress"
          >
            <FontAwesomeIcon icon={faRefresh} spin={isFetching} />
            Fetch Comments
          </button>
          <button 
            className="eg-blog-comments-fetch-all-btn"
            onClick={handleFetchAllComments}
            disabled={isFetching || isLoading}
            title="Fetch all comments from WordPress (may take a while)"
          >
            <FontAwesomeIcon icon={faRefresh} spin={isFetching} />
            Fetch All
          </button>
          <button 
            className="eg-blog-comments-refresh-btn"
            onClick={handleRefresh}
            disabled={isLoading}
            title="Refresh local comments from SQLite"
          >
            <FontAwesomeIcon icon={faRefresh} spin={isLoading} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="eg-blog-comments-filters">
        <div className="eg-blog-comments-search">
          <FontAwesomeIcon icon={faSearch} />
          <input
            type="text"
            placeholder="Search comments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="eg-blog-comments-filter-group">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="approved">Approved</option>
            <option value="hold">Pending</option>
            <option value="spam">Spam</option>
            <option value="trash">Trash</option>
          </select>
        </div>

        <div className="eg-blog-comments-sort-group">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date' | 'author' | 'status' | 'post')}
          >
            <option value="date">Sort by Date</option>
            <option value="author">Sort by Author</option>
            <option value="status">Sort by Status</option>
            <option value="post">Sort by Post</option>
          </select>
          <button
            className="eg-blog-comments-sort-order-btn"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          >
            <FontAwesomeIcon icon={faSort} />
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Selection Controls */}
      {sortedComments.length > 0 && (
        <div className="eg-blog-comments-selection-controls">
          <label className="eg-blog-comments-select-all">
            <input
              type="checkbox"
              checked={selectedComments.size === filteredComments.length && filteredComments.length > 0}
              onChange={handleSelectAll}
            />
            <span>Select All ({selectedComments.size} selected)</span>
          </label>
        </div>
      )}

      {/* Error Messages */}
      {error && (
        <div className="eg-blog-comments-error">
          <p>{error}</p>
          <button onClick={handleRefresh}>Try Again</button>
        </div>
      )}

      {fetchError && (
        <div className="eg-blog-comments-error">
          <p>{fetchError}</p>
          <button onClick={() => setFetchError('')}>Dismiss</button>
        </div>
      )}

      {/* Comments List */}
      <div className="eg-blog-comments-list">
        {sortedComments.length === 0 ? (
          <div className="eg-blog-comments-empty">
            <FontAwesomeIcon icon={faComments} />
            <p>No comments found</p>
            {searchTerm && (
              <p>Try adjusting your search terms</p>
            )}
          </div>
        ) : (
          sortedComments.map((comment) => (
            <div key={comment.id} className="eg-blog-comments-item">
              <div className="eg-blog-comments-item-checkbox">
                <input
                  type="checkbox"
                  checked={selectedComments.has(comment.id)}
                  onChange={() => handleSelectComment(comment.id)}
                />
              </div>
              
              <div className="eg-blog-comments-item-content">
                <div className="eg-blog-comments-item-header">
                  <div className="eg-blog-comments-item-author">
                    <div className="eg-blog-comments-author-info">
                      <FontAwesomeIcon icon={faUser} />
                      <span className="author-name">{comment.author_name || 'Anonymous'}</span>
                      {comment.author_email && (
                        <span className="author-email">
                          <FontAwesomeIcon icon={faEnvelope} />
                          {comment.author_email}
                        </span>
                      )}
                      {comment.author_url && (
                        <a href={comment.author_url} target="_blank" rel="noopener noreferrer" className="author-url">
                          <FontAwesomeIcon icon={faGlobe} />
                          Website
                        </a>
                      )}
                    </div>
                    <div className="eg-blog-comments-item-meta">
                      <span className="comment-date">
                        <FontAwesomeIcon icon={faCalendarAlt} />
                        {formatDate(comment.date)}
                      </span>
                      <span className="comment-post">
                        Post ID: {comment.post_id}
                      </span>
                    </div>
                  </div>
                  
                  <div className="eg-blog-comments-item-status">
                    {getStatusIcon(comment.status)}
                    <span className={`eg-blog-comments-status-badge ${getStatusBadgeClass(comment.status)}`}>
                      {comment.status || 'unknown'}
                    </span>
                  </div>
                </div>

                <div className="eg-blog-comments-item-body">
                  <div 
                    className="eg-blog-comments-content"
                    dangerouslySetInnerHTML={{ __html: comment.content }}
                  />
                </div>

                <div className="eg-blog-comments-item-actions">
                  <button
                    className="eg-blog-comments-action-btn eg-blog-comments-view-btn"
                    onClick={() => handleViewComment(comment)}
                    title="View Comment"
                  >
                    <FontAwesomeIcon icon={faEye} />
                  </button>
                  
                  {comment.status !== 'approved' && (
                    <button
                      className="eg-blog-comments-action-btn eg-blog-comments-approve-btn"
                      onClick={() => handleApproveComment(comment.id)}
                      title="Approve Comment"
                    >
                      <FontAwesomeIcon icon={faCheckCircle} />
                    </button>
                  )}
                  
                  {comment.status !== 'spam' && (
                    <button
                      className="eg-blog-comments-action-btn eg-blog-comments-spam-btn"
                      onClick={() => handleSpamComment(comment.id)}
                      title="Mark as Spam"
                    >
                      <FontAwesomeIcon icon={faFlag} />
                    </button>
                  )}
                  
                  {comment.status !== 'trash' && (
                    <button
                      className="eg-blog-comments-action-btn eg-blog-comments-trash-btn"
                      onClick={() => handleTrashComment(comment.id)}
                      title="Move to Trash"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  )}
                  
                  <button
                    className="eg-blog-comments-action-btn eg-blog-comments-delete-btn"
                    onClick={() => handleDeleteComment(comment.id)}
                    title="Permanently Delete"
                  >
                    <FontAwesomeIcon icon={faTimesCircle} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="eg-blog-comments-pagination">
          <button
            className="eg-blog-comments-pagination-btn"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            <FontAwesomeIcon icon={faChevronLeft} />
            Previous
          </button>
          
          <span className="eg-blog-comments-pagination-info">
            Page {currentPage} of {totalPages}
          </span>
          
          <button
            className="eg-blog-comments-pagination-btn"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
          >
            Next
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </div>
      )}
    </div>
  );
};

export default CommentsTab;
