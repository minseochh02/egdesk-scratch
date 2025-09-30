import React, { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faFileAlt, 
  faCalendarAlt, 
  faUser, 
  faEye, 
  faEdit, 
  faTrash, 
  faExternalLinkAlt,
  faRefresh,
  faSearch,
  faFilter,
  faSort,
  faChevronLeft,
  faChevronRight,
  faSpinner
} from '../../../utils/fontAwesomeIcons';
import './PostsTab.css';

interface WordPressPost {
  id: number;
  title: string;
  content?: string;
  excerpt?: string;
  slug?: string;
  status?: string;
  type?: string;
  author?: number;
  featured_media?: number;
  parent?: number;
  menu_order?: number;
  comment_status?: string;
  ping_status?: string;
  template?: string;
  format?: string;
  meta?: string;
  date?: string;
  date_gmt?: string;
  modified?: string;
  modified_gmt?: string;
  link?: string;
  guid?: string;
  wordpress_site_id: string;
  synced_at?: string;
  local_content?: string;
  export_format?: string;
}

interface PostsTabProps {
  connectionId: string;
  connectionName: string;
  connectionType: string;
  onStatsUpdate?: () => void;
}

const PostsTab: React.FC<PostsTabProps> = ({
  connectionId,
  connectionName,
  connectionType,
  onStatsUpdate
}) => {
  const [posts, setPosts] = useState<WordPressPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPosts, setTotalPosts] = useState(0);
  const [expandedPosts, setExpandedPosts] = useState<Set<number>>(new Set());
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string>('');
  
  const postsPerPage = 10;

  const loadPosts = useCallback(async () => {
    if (!window.electron?.wordpress) {
      setError('WordPress API not available');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const offset = (currentPage - 1) * postsPerPage;
      const result = await window.electron.wordpress.getPosts(
        connectionId, 
        postsPerPage, 
        offset
      );

      if (result.success && result.posts) {
        setPosts(result.posts);
        setTotalPosts(result.posts.length); // This might need adjustment based on actual API
      } else {
        setError(result.error || 'Failed to load posts');
      }
    } catch (err) {
      console.error('Error loading posts:', err);
      setError('Failed to load posts');
    } finally {
      setIsLoading(false);
    }
  }, [connectionId, currentPage]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const handleRefresh = () => {
    loadPosts();
  };

  const handleFetchPosts = async () => {
    if (!window.electron?.wordpress) {
      setFetchError('WordPress API not available');
      return;
    }

    setIsFetching(true);
    setFetchError('');

    try {
      const result = await window.electron.wordpress.fetchPosts(connectionId, {
        perPage: 100,
        status: 'any'
      });

      if (result.success) {
        console.log(`✅ Fetched ${result.posts?.length || 0} posts from WordPress`);
        // Reload posts from SQLite to show the newly fetched ones
        await loadPosts();
        // Update stats in parent component
        onStatsUpdate?.();
      } else {
        setFetchError(result.error || 'Failed to fetch posts');
      }
    } catch (err) {
      console.error('Error fetching posts:', err);
      setFetchError('Failed to fetch posts from WordPress');
    } finally {
      setIsFetching(false);
    }
  };

  const handleFetchAllPosts = async () => {
    if (!window.electron?.wordpress) {
      setFetchError('WordPress API not available');
      return;
    }

    setIsFetching(true);
    setFetchError('');

    try {
      const result = await window.electron.wordpress.fetchAllPosts(connectionId, {
        perPage: 100,
        status: 'any'
      });

      if (result.success) {
        console.log(`✅ Fetched all ${result.totalPosts || 0} posts from WordPress`);
        // Reload posts from SQLite to show the newly fetched ones
        await loadPosts();
        // Update stats in parent component
        onStatsUpdate?.();
      } else {
        setFetchError(result.error || 'Failed to fetch all posts');
      }
    } catch (err) {
      console.error('Error fetching all posts:', err);
      setFetchError('Failed to fetch all posts from WordPress');
    } finally {
      setIsFetching(false);
    }
  };

  const handleViewPost = (post: WordPressPost) => {
    if (post.link) {
      window.open(post.link, '_blank', 'noopener,noreferrer');
    }
  };

  const handleEditPost = (post: WordPressPost) => {
    // TODO: Implement edit functionality
    console.log('Edit post:', post);
  };

  const handleDeletePost = async (post: WordPressPost) => {
    if (!window.electron?.wordpress) {
      setFetchError('WordPress API not available');
      return;
    }

    const confirmed = window.confirm(
      `Delete this post permanently?\n\n` +
      `Title: ${post.title || 'Untitled'}\n` +
      `This will attempt to delete it from WordPress and remove it locally.`
    );
    if (!confirmed) return;

    try {
      setIsFetching(true);
      const result = await (window.electron.wordpress as any).deletePost(connectionId, post.id);
      if (result?.success) {
        // Optimistically update UI
        setPosts(prev => prev.filter(p => p.id !== post.id));
        setTotalPosts(prev => Math.max(0, prev - 1));
        // Reload from SQLite to stay in sync
        await loadPosts();
        onStatsUpdate?.();
      } else {
        const msg = result?.error || 'Failed to delete post';
        setFetchError(msg);
      }
    } catch (err) {
      console.error('Error deleting post:', err);
      setFetchError('Failed to delete post');
    } finally {
      setIsFetching(false);
    }
  };

  const togglePostExpansion = (postId: number) => {
    const newExpanded = new Set(expandedPosts);
    if (newExpanded.has(postId)) {
      newExpanded.delete(postId);
    } else {
      newExpanded.add(postId);
    }
    setExpandedPosts(newExpanded);
  };

  const filteredPosts = posts.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (post.excerpt && post.excerpt.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || post.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const sortedPosts = [...filteredPosts].sort((a, b) => {
    let aValue: any, bValue: any;
    
    switch (sortBy) {
      case 'title':
        aValue = a.title.toLowerCase();
        bValue = b.title.toLowerCase();
        break;
      case 'status':
        aValue = a.status || '';
        bValue = b.status || '';
        break;
      case 'date':
      default:
        aValue = new Date(a.modified || a.date || '').getTime();
        bValue = new Date(b.modified || b.date || '').getTime();
        break;
    }

    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

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

  const getStatusBadgeClass = (status?: string) => {
    switch (status) {
      case 'publish':
        return 'eg-blog-posts-status-published';
      case 'draft':
        return 'eg-blog-posts-status-draft';
      case 'private':
        return 'eg-blog-posts-status-private';
      case 'pending':
        return 'eg-blog-posts-status-pending';
      default:
        return 'eg-blog-posts-status-unknown';
    }
  };

  const totalPages = Math.ceil(totalPosts / postsPerPage);

  if (isLoading && posts.length === 0) {
    return (
      <div className="eg-blog-posts-loading">
        <FontAwesomeIcon icon={faSpinner} spin />
        <p>Loading posts...</p>
      </div>
    );
  }

  return (
    <div className="eg-blog-posts-tab">
      {/* Header */}
      <div className="eg-blog-posts-header">
        <div className="eg-blog-posts-header-info">
          <h3>Blog Posts</h3>
          <p>Manage posts for {connectionName} ({connectionType})</p>
        </div>
        <div className="eg-blog-posts-header-actions">
          <button 
            className="eg-blog-posts-fetch-btn"
            onClick={handleFetchPosts}
            disabled={isFetching || isLoading}
            title="Fetch recent posts from WordPress"
          >
            <FontAwesomeIcon icon={faRefresh} spin={isFetching} />
            Fetch Posts
          </button>
          <button 
            className="eg-blog-posts-fetch-all-btn"
            onClick={handleFetchAllPosts}
            disabled={isFetching || isLoading}
            title="Fetch all posts from WordPress (may take a while)"
          >
            <FontAwesomeIcon icon={faRefresh} spin={isFetching} />
            Fetch All
          </button>
          <button 
            className="eg-blog-posts-refresh-btn"
            onClick={handleRefresh}
            disabled={isLoading}
            title="Refresh local posts from SQLite"
          >
            <FontAwesomeIcon icon={faRefresh} spin={isLoading} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="eg-blog-posts-filters">
        <div className="eg-blog-posts-search">
          <FontAwesomeIcon icon={faSearch} />
          <input
            type="text"
            placeholder="Search posts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="eg-blog-posts-filter-group">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="publish">Published</option>
            <option value="draft">Draft</option>
            <option value="private">Private</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        <div className="eg-blog-posts-sort-group">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date' | 'title' | 'status')}
          >
            <option value="date">Sort by Date</option>
            <option value="title">Sort by Title</option>
            <option value="status">Sort by Status</option>
          </select>
          <button
            className="eg-blog-posts-sort-order-btn"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          >
            <FontAwesomeIcon icon={faSort} />
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Error Messages */}
      {error && (
        <div className="eg-blog-posts-error">
          <p>{error}</p>
          <button onClick={handleRefresh}>Try Again</button>
        </div>
      )}

      {fetchError && (
        <div className="eg-blog-posts-error">
          <p>{fetchError}</p>
          <button onClick={() => setFetchError('')}>Dismiss</button>
        </div>
      )}

      {/* Posts List */}
      <div className="eg-blog-posts-list">
        {sortedPosts.length === 0 ? (
          <div className="eg-blog-posts-empty">
            <FontAwesomeIcon icon={faFileAlt} />
            <p>No posts found</p>
            {searchTerm && (
              <p>Try adjusting your search terms</p>
            )}
          </div>
        ) : (
          sortedPosts.map((post) => (
            <div key={post.id} className="eg-blog-posts-item">
              <div className="eg-blog-posts-item-header">
                <div className="eg-blog-posts-item-title">
                  <h4>{post.title || 'Untitled'}</h4>
                  <span className={`eg-blog-posts-status-badge ${getStatusBadgeClass(post.status)}`}>
                    {post.status || 'unknown'}
                  </span>
                </div>
                <div className="eg-blog-posts-item-actions">
                  <button
                    className="eg-blog-posts-action-btn eg-blog-posts-view-btn"
                    onClick={() => handleViewPost(post)}
                    title="View Post"
                  >
                    <FontAwesomeIcon icon={faEye} />
                  </button>
                  <button
                    className="eg-blog-posts-action-btn eg-blog-posts-edit-btn"
                    onClick={() => handleEditPost(post)}
                    title="Edit Post"
                  >
                    <FontAwesomeIcon icon={faEdit} />
                  </button>
                  <button
                    className="eg-blog-posts-action-btn eg-blog-posts-delete-btn"
                    onClick={() => handleDeletePost(post)}
                    title="Delete Post"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </div>

              <div className="eg-blog-posts-item-meta">
                <div className="eg-blog-posts-item-meta-item">
                  <FontAwesomeIcon icon={faCalendarAlt} />
                  <span>Modified: {formatDate(post.modified)}</span>
                </div>
                <div className="eg-blog-posts-item-meta-item">
                  <FontAwesomeIcon icon={faUser} />
                  <span>Author: {post.author || 'Unknown'}</span>
                </div>
                {post.link && (
                  <div className="eg-blog-posts-item-meta-item">
                    <FontAwesomeIcon icon={faExternalLinkAlt} />
                    <a href={post.link} target="_blank" rel="noopener noreferrer">
                      View on Site
                    </a>
                  </div>
                )}
              </div>

              {post.excerpt && (
                <div className="eg-blog-posts-item-excerpt">
                  <p>{post.excerpt}</p>
                </div>
              )}

              {(post.content || post.local_content) && (
                <div className="eg-blog-posts-item-content-toggle">
                  <button
                    className="eg-blog-posts-expand-btn"
                    onClick={() => togglePostExpansion(post.id)}
                  >
                    <FontAwesomeIcon 
                      icon={expandedPosts.has(post.id) ? faChevronLeft : faChevronRight} 
                    />
                    {expandedPosts.has(post.id) ? 'Hide Content' : 'Show Content'}
                  </button>
                </div>
              )}

              {expandedPosts.has(post.id) && (post.content || post.local_content) && (
                <div className="eg-blog-posts-item-content">
                  <div 
                    dangerouslySetInnerHTML={{ 
                      __html: post.local_content || post.content || '' 
                    }} 
                  />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="eg-blog-posts-pagination">
          <button
            className="eg-blog-posts-pagination-btn"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            <FontAwesomeIcon icon={faChevronLeft} />
            Previous
          </button>
          
          <span className="eg-blog-posts-pagination-info">
            Page {currentPage} of {totalPages}
          </span>
          
          <button
            className="eg-blog-posts-pagination-btn"
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

export default PostsTab;
