import React, { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faImage, 
  faCalendarAlt, 
  faDownload, 
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
  faFileImage,
  faFile,
  faEye,
  faUpload,
  faFolderOpen
} from '../../../utils/fontAwesomeIcons';
import './MediaTab.css';

interface WordPressMedia {
  id: number;
  title?: string;
  description?: string;
  caption?: string;
  alt_text?: string;
  source_url: string;
  mime_type?: string;
  file_name?: string;
  file_size?: number;
  width?: number;
  height?: number;
  wordpress_site_id: string;
  synced_at?: string;
  local_data?: Buffer;
}

interface MediaTabProps {
  connectionId: string;
  connectionName: string;
  connectionType: string;
  onStatsUpdate?: () => void;
}

const MediaTab: React.FC<MediaTabProps> = ({
  connectionId,
  connectionName,
  connectionType,
  onStatsUpdate
}) => {
  const [media, setMedia] = useState<WordPressMedia[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [mimeTypeFilter, setMimeTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size' | 'type'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalMedia, setTotalMedia] = useState(0);
  const [selectedMedia, setSelectedMedia] = useState<Set<number>>(new Set());
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string>('');
  
  const mediaPerPage = 20;

  const loadMedia = useCallback(async () => {
    if (!window.electron?.wordpress) {
      setError('WordPress API not available');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const offset = (currentPage - 1) * mediaPerPage;
      const result = await window.electron.wordpress.getMedia(
        connectionId, 
        mediaPerPage, 
        offset
      );

      if (result.success && result.media) {
        setMedia(result.media);
        setTotalMedia(result.media.length); // This might need adjustment based on actual API
      } else {
        setError(result.error || 'Failed to load media');
      }
    } catch (err) {
      console.error('Error loading media:', err);
      setError('Failed to load media');
    } finally {
      setIsLoading(false);
    }
  }, [connectionId, currentPage]);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  const handleRefresh = () => {
    loadMedia();
  };

  const handleFetchMedia = async () => {
    if (!window.electron?.wordpress) {
      setFetchError('WordPress API not available');
      return;
    }

    setIsFetching(true);
    setFetchError('');

    try {
      const result = await window.electron.wordpress.fetchMedia(connectionId, {
        perPage: 100,
        mimeType: 'image'
      });

      if (result.success) {
        console.log(`✅ Fetched ${result.media?.length || 0} media items from WordPress`);
        // Reload media from SQLite to show the newly fetched ones
        await loadMedia();
        // Update stats in parent component
        onStatsUpdate?.();
      } else {
        setFetchError(result.error || 'Failed to fetch media');
      }
    } catch (err) {
      console.error('Error fetching media:', err);
      setFetchError('Failed to fetch media from WordPress');
    } finally {
      setIsFetching(false);
    }
  };

  const handleFetchAllMedia = async () => {
    if (!window.electron?.wordpress) {
      setFetchError('WordPress API not available');
      return;
    }

    setIsFetching(true);
    setFetchError('');

    try {
      const result = await window.electron.wordpress.fetchAllMedia(connectionId, {
        perPage: 100
      });

      if (result.success) {
        console.log(`✅ Fetched all ${result.totalMedia || 0} media items from WordPress`);
        // Reload media from SQLite to show the newly fetched ones
        await loadMedia();
        // Update stats in parent component
        onStatsUpdate?.();
      } else {
        setFetchError(result.error || 'Failed to fetch all media');
      }
    } catch (err) {
      console.error('Error fetching all media:', err);
      setFetchError('Failed to fetch all media from WordPress');
    } finally {
      setIsFetching(false);
    }
  };

  const handleViewMedia = (mediaItem: WordPressMedia) => {
    if (mediaItem.source_url) {
      window.open(mediaItem.source_url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDownloadMedia = (mediaItem: WordPressMedia) => {
    if (mediaItem.source_url) {
      const link = document.createElement('a');
      link.href = mediaItem.source_url;
      link.download = mediaItem.file_name || `media-${mediaItem.id}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleEditMedia = (mediaItem: WordPressMedia) => {
    // TODO: Implement edit functionality
    console.log('Edit media:', mediaItem);
  };

  const handleDeleteMedia = (mediaItem: WordPressMedia) => {
    // TODO: Implement delete functionality
    console.log('Delete media:', mediaItem);
  };

  const handleSelectMedia = (mediaId: number) => {
    const newSelected = new Set(selectedMedia);
    if (newSelected.has(mediaId)) {
      newSelected.delete(mediaId);
    } else {
      newSelected.add(mediaId);
    }
    setSelectedMedia(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedMedia.size === filteredMedia.length) {
      setSelectedMedia(new Set());
    } else {
      setSelectedMedia(new Set(filteredMedia.map(m => m.id)));
    }
  };

  const getMediaIcon = (mimeType?: string) => {
    if (!mimeType) return faFile;
    
    if (mimeType.startsWith('image/')) return faFileImage;
    if (mimeType.startsWith('video/')) return faFile;
    if (mimeType.startsWith('audio/')) return faFile;
    return faFile;
  };

  const getMediaTypeColor = (mimeType?: string) => {
    if (!mimeType) return '#6b7280';
    
    if (mimeType.startsWith('image/')) return '#10b981';
    if (mimeType.startsWith('video/')) return '#3b82f6';
    if (mimeType.startsWith('audio/')) return '#f59e0b';
    return '#6b7280';
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
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

  const filteredMedia = media.filter(mediaItem => {
    const matchesSearch = (mediaItem.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (mediaItem.file_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (mediaItem.alt_text || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesMimeType = mimeTypeFilter === 'all' || 
                           (mediaItem.mime_type && mediaItem.mime_type.startsWith(mimeTypeFilter));
    
    return matchesSearch && matchesMimeType;
  });

  const sortedMedia = [...filteredMedia].sort((a, b) => {
    let aValue: any, bValue: any;
    
    switch (sortBy) {
      case 'name':
        aValue = (a.title || a.file_name || '').toLowerCase();
        bValue = (b.title || b.file_name || '').toLowerCase();
        break;
      case 'size':
        aValue = a.file_size || 0;
        bValue = b.file_size || 0;
        break;
      case 'type':
        aValue = a.mime_type || '';
        bValue = b.mime_type || '';
        break;
      case 'date':
      default:
        aValue = new Date(a.synced_at || '').getTime();
        bValue = new Date(b.synced_at || '').getTime();
        break;
    }

    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const totalPages = Math.ceil(totalMedia / mediaPerPage);

  if (isLoading && media.length === 0) {
    return (
      <div className="eg-blog-media-loading">
        <FontAwesomeIcon icon={faSpinner} spin />
        <p>Loading media...</p>
      </div>
    );
  }

  return (
    <div className="eg-blog-media-tab">
      {/* Header */}
      <div className="eg-blog-media-header">
        <div className="eg-blog-media-header-info">
          <h3>Media Library</h3>
          <p>Manage media files for {connectionName} ({connectionType})</p>
        </div>
        <div className="eg-blog-media-header-actions">
          <button 
            className="eg-blog-media-fetch-btn"
            onClick={handleFetchMedia}
            disabled={isFetching || isLoading}
            title="Fetch recent media from WordPress"
          >
            <FontAwesomeIcon icon={faRefresh} spin={isFetching} />
            Fetch Media
          </button>
          <button 
            className="eg-blog-media-fetch-all-btn"
            onClick={handleFetchAllMedia}
            disabled={isFetching || isLoading}
            title="Fetch all media from WordPress (may take a while)"
          >
            <FontAwesomeIcon icon={faRefresh} spin={isFetching} />
            Fetch All
          </button>
          <button 
            className="eg-blog-media-refresh-btn"
            onClick={handleRefresh}
            disabled={isLoading}
            title="Refresh local media from SQLite"
          >
            <FontAwesomeIcon icon={faRefresh} spin={isLoading} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="eg-blog-media-filters">
        <div className="eg-blog-media-search">
          <FontAwesomeIcon icon={faSearch} />
          <input
            type="text"
            placeholder="Search media..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="eg-blog-media-filter-group">
          <select
            value={mimeTypeFilter}
            onChange={(e) => setMimeTypeFilter(e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="image/">Images</option>
            <option value="video/">Videos</option>
            <option value="audio/">Audio</option>
          </select>
        </div>

        <div className="eg-blog-media-sort-group">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date' | 'name' | 'size' | 'type')}
          >
            <option value="date">Sort by Date</option>
            <option value="name">Sort by Name</option>
            <option value="size">Sort by Size</option>
            <option value="type">Sort by Type</option>
          </select>
          <button
            className="eg-blog-media-sort-order-btn"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          >
            <FontAwesomeIcon icon={faSort} />
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>

        <div className="eg-blog-media-view-controls">
          <button
            className={`eg-blog-media-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="Grid View"
          >
            <FontAwesomeIcon icon={faFolderOpen} />
          </button>
          <button
            className={`eg-blog-media-view-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            title="List View"
          >
            <FontAwesomeIcon icon={faFile} />
          </button>
        </div>
      </div>

      {/* Selection Controls */}
      {sortedMedia.length > 0 && (
        <div className="eg-blog-media-selection-controls">
          <label className="eg-blog-media-select-all">
            <input
              type="checkbox"
              checked={selectedMedia.size === filteredMedia.length && filteredMedia.length > 0}
              onChange={handleSelectAll}
            />
            <span>Select All ({selectedMedia.size} selected)</span>
          </label>
        </div>
      )}

      {/* Error Messages */}
      {error && (
        <div className="eg-blog-media-error">
          <p>{error}</p>
          <button onClick={handleRefresh}>Try Again</button>
        </div>
      )}

      {fetchError && (
        <div className="eg-blog-media-error">
          <p>{fetchError}</p>
          <button onClick={() => setFetchError('')}>Dismiss</button>
        </div>
      )}

      {/* Media List/Grid */}
      <div className={`eg-blog-media-container ${viewMode}`}>
        {sortedMedia.length === 0 ? (
          <div className="eg-blog-media-empty">
            <FontAwesomeIcon icon={faImage} />
            <p>No media found</p>
            {searchTerm && (
              <p>Try adjusting your search terms</p>
            )}
          </div>
        ) : (
          sortedMedia.map((mediaItem) => (
            <div key={mediaItem.id} className={`eg-blog-media-item ${viewMode}`}>
              <div className="eg-blog-media-item-checkbox">
                <input
                  type="checkbox"
                  checked={selectedMedia.has(mediaItem.id)}
                  onChange={() => handleSelectMedia(mediaItem.id)}
                />
              </div>
              
              <div className="eg-blog-media-item-preview">
                {mediaItem.mime_type?.startsWith('image/') ? (
                  <img
                    src={mediaItem.source_url}
                    alt={mediaItem.alt_text || mediaItem.title || 'Media'}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`eg-blog-media-item-icon ${mediaItem.mime_type?.startsWith('image/') ? 'hidden' : ''}`}>
                  <FontAwesomeIcon 
                    icon={getMediaIcon(mediaItem.mime_type)} 
                    style={{ color: getMediaTypeColor(mediaItem.mime_type) }}
                  />
                </div>
              </div>

              <div className="eg-blog-media-item-content">
                <div className="eg-blog-media-item-title">
                  <h4>{mediaItem.title || mediaItem.file_name || 'Untitled'}</h4>
                  <span className="eg-blog-media-item-type">
                    {mediaItem.mime_type || 'Unknown type'}
                  </span>
                </div>

                <div className="eg-blog-media-item-meta">
                  <div className="eg-blog-media-item-meta-item">
                    <FontAwesomeIcon icon={faCalendarAlt} />
                    <span>{formatDate(mediaItem.synced_at)}</span>
                  </div>
                  <div className="eg-blog-media-item-meta-item">
                    <FontAwesomeIcon icon={faFile} />
                    <span>{formatFileSize(mediaItem.file_size)}</span>
                  </div>
                  {mediaItem.width && mediaItem.height && (
                    <div className="eg-blog-media-item-meta-item">
                      <FontAwesomeIcon icon={faImage} />
                      <span>{mediaItem.width} × {mediaItem.height}</span>
                    </div>
                  )}
                </div>

                {mediaItem.alt_text && (
                  <div className="eg-blog-media-item-alt">
                    <p>{mediaItem.alt_text}</p>
                  </div>
                )}

                <div className="eg-blog-media-item-actions">
                  <button
                    className="eg-blog-media-action-btn eg-blog-media-view-btn"
                    onClick={() => handleViewMedia(mediaItem)}
                    title="View Media"
                  >
                    <FontAwesomeIcon icon={faEye} />
                  </button>
                  <button
                    className="eg-blog-media-action-btn eg-blog-media-download-btn"
                    onClick={() => handleDownloadMedia(mediaItem)}
                    title="Download Media"
                  >
                    <FontAwesomeIcon icon={faDownload} />
                  </button>
                  <button
                    className="eg-blog-media-action-btn eg-blog-media-edit-btn"
                    onClick={() => handleEditMedia(mediaItem)}
                    title="Edit Media"
                  >
                    <FontAwesomeIcon icon={faEdit} />
                  </button>
                  <button
                    className="eg-blog-media-action-btn eg-blog-media-delete-btn"
                    onClick={() => handleDeleteMedia(mediaItem)}
                    title="Delete Media"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="eg-blog-media-pagination">
          <button
            className="eg-blog-media-pagination-btn"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            <FontAwesomeIcon icon={faChevronLeft} />
            Previous
          </button>
          
          <span className="eg-blog-media-pagination-info">
            Page {currentPage} of {totalPages}
          </span>
          
          <button
            className="eg-blog-media-pagination-btn"
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

export default MediaTab;
