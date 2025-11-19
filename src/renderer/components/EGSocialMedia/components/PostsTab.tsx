import React, { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faFileAlt, 
  faEye, 
  faExternalLinkAlt,
  faRefresh,
  faSearch,
  faSpinner,
  faHeart,
  faComment,
  faImage,
  faVideo
} from '../../../utils/fontAwesomeIcons';
import '../SocialMediaConnectionDashboard.css';

interface InstagramPost {
  id: string;
  shortcode: string;
  url: string;
  caption: string;
  timestamp: string;
  likes: number;
  comments: number;
  imageUrl?: string;
  videoUrl?: string;
  isVideo: boolean;
}

interface PostsTabProps {
  connectionId: string;
  connectionName: string;
  connectionType: 'instagram' | 'facebook' | 'youtube';
  onStatsUpdate?: () => void;
}

const PostsTab: React.FC<PostsTabProps> = ({
  connectionId,
  connectionName,
  connectionType,
  onStatsUpdate
}) => {
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string>('');

  const loadPosts = useCallback(async () => {
    if (!window.electron?.instagram) {
      setError('Instagram API not available');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await window.electron.instagram.fetchPosts(connectionId, {
        limit: 24, // Fetch 24 posts initially
        useGraphAPI: false // Use Playwright scraping by default
      });

      if (result.success && result.posts) {
        setPosts(result.posts);
        setError('');
        onStatsUpdate?.();
      } else {
        setError(result.error || 'Failed to load posts');
      }
    } catch (err) {
      console.error('Error loading posts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load posts');
    } finally {
      setIsLoading(false);
    }
  }, [connectionId, onStatsUpdate]);

  const fetchMorePosts = async () => {
    if (isFetching) return;

    setIsFetching(true);
    setFetchError('');

    try {
      const result = await window.electron.instagram.fetchPosts(connectionId, {
        limit: posts.length + 12, // Fetch 12 more
        useGraphAPI: false
      });

      if (result.success && result.posts) {
        setPosts(result.posts);
      } else {
        setFetchError(result.error || 'Failed to fetch more posts');
      }
    } catch (err) {
      console.error('Error fetching more posts:', err);
      setFetchError(err instanceof Error ? err.message : 'Failed to fetch more posts');
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const filteredPosts = posts.filter(post => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      post.caption.toLowerCase().includes(searchLower) ||
      post.shortcode.toLowerCase().includes(searchLower)
    );
  });

  const formatDate = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return timestamp;
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (isLoading) {
    return (
      <div className="social-media-connection-dashboard-tab-content">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading posts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="social-media-connection-dashboard-tab-content">
      <div className="social-media-posts-header">
        <div className="social-media-posts-header-top">
          <h4>Published Posts</h4>
          <button
            className="social-media-posts-refresh-btn"
            onClick={loadPosts}
            disabled={isLoading}
            title="Refresh posts"
          >
            <FontAwesomeIcon icon={faRefresh} spin={isLoading} />
            Refresh
          </button>
        </div>

        <div className="social-media-posts-search">
          <div className="social-media-posts-search-input-wrapper">
            <FontAwesomeIcon icon={faSearch} className="social-media-posts-search-icon" />
            <input
              type="text"
              placeholder="Search posts by caption or shortcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="social-media-posts-search-input"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="social-media-posts-error">
          <p>{error}</p>
          <button onClick={loadPosts} className="social-media-posts-retry-btn">
            Try Again
          </button>
        </div>
      )}

      {!error && filteredPosts.length === 0 && (
        <div className="social-media-posts-empty">
          <FontAwesomeIcon icon={faFileAlt} />
          <p>No posts found</p>
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="social-media-posts-clear-search">
              Clear search
            </button>
          )}
        </div>
      )}

      {!error && filteredPosts.length > 0 && (
        <>
          <div className="social-media-posts-grid">
            {filteredPosts.map((post) => (
              <div key={post.id} className="social-media-post-card">
                <div className="social-media-post-card-header">
                  <div className="social-media-post-card-media-type">
                    {post.isVideo ? (
                      <FontAwesomeIcon icon={faVideo} />
                    ) : (
                      <FontAwesomeIcon icon={faImage} />
                    )}
                  </div>
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="social-media-post-card-link"
                    title="Open on Instagram"
                  >
                    <FontAwesomeIcon icon={faExternalLinkAlt} />
                  </a>
                </div>

                {post.imageUrl && (
                  <div className="social-media-post-card-image">
                    <img src={post.imageUrl} alt={post.caption || 'Instagram post'} />
                  </div>
                )}

                <div className="social-media-post-card-content">
                  {post.caption ? (
                    <p className="social-media-post-card-caption">
                      {post.caption.length > 150
                        ? `${post.caption.substring(0, 150)}...`
                        : post.caption}
                    </p>
                  ) : (
                    <p className="social-media-post-card-caption-placeholder">
                      No caption available
                    </p>
                  )}

                  <div className="social-media-post-card-stats">
                    <div className="social-media-post-card-stat">
                      <FontAwesomeIcon icon={faHeart} />
                      <span>{formatNumber(post.likes)}</span>
                    </div>
                    <div className="social-media-post-card-stat">
                      <FontAwesomeIcon icon={faComment} />
                      <span>{formatNumber(post.comments)}</span>
                    </div>
                  </div>

                  <div className="social-media-post-card-meta">
                    <span className="social-media-post-card-shortcode">#{post.shortcode}</span>
                    {post.timestamp && (
                      <span className="social-media-post-card-date">{formatDate(post.timestamp)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {fetchError && (
            <div className="social-media-posts-fetch-error">
              <p>{fetchError}</p>
            </div>
          )}

          <div className="social-media-posts-load-more">
            <button
              onClick={fetchMorePosts}
              disabled={isFetching}
              className="social-media-posts-load-more-btn"
            >
              {isFetching ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin />
                  Loading...
                </>
              ) : (
                'Load More Posts'
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default PostsTab;

