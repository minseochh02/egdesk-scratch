import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTrash,
  faImage,
  faCog,
  faTag,
  faSync,
  faEdit,
  faFileAlt,
  faImage as faImageFile,
  faArrowRight,
  faCalendarAlt,
  faChartBar,
  faCheckCircle,
  faTimesCircle,
  faExclamationTriangle,
  faArrowRight as faArrowRightIcon,
  faUser,
  faFileAlt as faDocument,
  faClock,
  faSpinner,
  faGlobe,
  faFileAlt as faTextFile,
  faCode as faJsonIcon,
  faRocket,
  faWrench,
  faArrowRight as faNextIcon,
  faFolder,
  faPlus,
  faExternalLinkAlt,
  faRefresh,
  faKey,
  faRobot,
} from '../utils/fontAwesomeIcons';
import WordPressPostScheduler from './WordPressSitesList/WordPressPostScheduler';
import SchedulerManager from './SchedulerManager/SchedulerManager';
import DebugButton from './DebugButton';
import { aiKeysStore } from './AIKeysManager/store/aiKeysStore';
import { AIKey } from './AIKeysManager/types';
import './BlogPoster.css';

interface WordPressPost {
  id: number;
  title: string;
  excerpt: string;
  content?: string;
  slug?: string;
  author: string;
  date: string;
  status: string;
  type: string;
}

interface WordPressMedia {
  id: number;
  title: string;
  url: string;
  type: string;
  filename?: string;
  date: string;
}

interface WordPressSite {
  id?: string;
  url: string;
  username: string;
  password?: string;
  name?: string;
  posts_count?: number;
  pages_count?: number;
  media_count?: number;
  local_sync_path?: string;
  createdAt?: string;
  updatedAt?: string;
  // Blog Writer preferences
  blog_category?: string;
  ai_provider_id?: string;
  ai_model_id?: string;
  ai_key_id?: string;
}

interface ConnectionForm {
  url: string;
  username: string;
  password: string;
  name: string;
}

interface WordPressAPIResponse {
  success: boolean;
  data?: {
    user: any;
    posts_count: number;
    pages_count: number;
    media_count: number;
  };
  error?: string;
}

interface SyncStatus {
  isSyncing: boolean;
  progress: number;
  currentFile: string;
  totalFiles: number;
  syncedFiles: number;
  errors: string[];
}

interface SyncRecord {
  id: string;
  connectionId: string;
  connectionName: string;
  syncPath: string;
  startedAt: string;
  completedAt?: string;
  status: 'in_progress' | 'completed' | 'failed';
  totalFiles: number;
  syncedFiles: number;
  failedFiles: number;
  fileDetails: SyncFileDetail[];
  errors: string[];
  updatedAt?: string;
}

interface SyncFileDetail {
  path: string;
  name: string;
  type: 'post' | 'media';
  status: 'synced' | 'failed' | 'skipped';
  localPath: string;
  size?: number;
  syncedAt: string;
  error?: string;
}

const BlogPoster: React.FC = () => {
  const navigate = useNavigate();
  const [connections, setConnections] = useState<WordPressSite[]>([]);
  const [selectedSite, setSelectedSite] = useState<WordPressSite | null>(null);
  const [posts, setPosts] = useState<WordPressPost[]>([]);
  const [media, setMedia] = useState<WordPressMedia[]>([]);
  const [activeTab, setActiveTab] = useState<
    'sites' | 'posts' | 'media' | 'sync' | 'settings' | 'scheduler'
  >('sites');
  const [formData, setFormData] = useState<ConnectionForm>({
    url: '',
    username: '',
    password: '',
    name: '',
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string>('');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isSyncing: false,
    progress: 0,
    currentFile: '',
    totalFiles: 0,
    syncedFiles: 0,
    errors: [],
  });
  const [localSyncPath, setLocalSyncPath] = useState<string>('');
  const [syncHistory, setSyncHistory] = useState<SyncRecord[]>([]);
  const [currentSyncId, setCurrentSyncId] = useState<string>('');
  const [exportFormat, setExportFormat] = useState<
    'markdown' | 'html' | 'txt' | 'json' | 'wordpress'
  >('wordpress');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [refreshProgress, setRefreshProgress] = useState<string>('');
  const [showPostDeleteConfirm, setShowPostDeleteConfirm] = useState<number | null>(null);
  const [isDeletingPost, setIsDeletingPost] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [templateRefreshKey, setTemplateRefreshKey] = useState(0);
  
  // AI Keys state
  const [aiKeys, setAiKeys] = useState<AIKey[]>([]);
  const [selectedKey, setSelectedKey] = useState<AIKey | null>(null);
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini');

  // Subscribe to AI keys store
  useEffect(() => {
    const unsubscribe = aiKeysStore.subscribe((keyState) => {
      const activeKeys = keyState.keys.filter((key) => key.isActive);
      setAiKeys(activeKeys);

      // Auto-select first key if none selected and keys are available
      if (!selectedKey && activeKeys.length > 0) {
        setSelectedKey(activeKeys[0]);
      }
    });

    // Get initial state immediately
    try {
      const currentState = aiKeysStore.getState();
      const activeKeys = currentState.keys.filter((key) => key.isActive);
      setAiKeys(activeKeys);
      if (!selectedKey && activeKeys.length > 0) {
        setSelectedKey(activeKeys[0]);
      }
    } catch (error) {
      console.warn('Failed to get initial AI keys state:', error);
    }

    return () => unsubscribe();
  }, [selectedKey]);

  // Load saved connections on component mount
  useEffect(() => {
    loadSavedConnections();
  }, []);

  // Load sync history when selected site changes
  useEffect(() => {
    if (selectedSite?.id) {
      loadSyncHistory(selectedSite.id);
    }
  }, [selectedSite]);

  const loadSavedConnections = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await window.electron.wordpress.getConnections();
      if (result.success && result.connections) {
        setConnections(result.connections);
        if (result.connections.length > 0 && !selectedSite) {
          setSelectedSite(result.connections[0]);
        }
      } else {
        setError('연결된 블로그를 불러올 수 없습니다.');
      }
    } catch (error) {
      console.error('Failed to load saved connections:', error);
      setError('연결된 블로그를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedSite]);

  const loadSyncHistory = useCallback(async (connectionId: string) => {
    try {
      const result = await window.electron.sync.getHistory(connectionId);
      if (result.success && result.syncHistory) {
        setSyncHistory(result.syncHistory);
      }
    } catch (error) {
      console.error('Failed to load sync history:', error);
    }
  }, []);

  const handleFormChange = (field: keyof ConnectionForm, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setConnectionError('');
  };

  const validateForm = (): boolean => {
    if (!formData.url.trim()) {
      setConnectionError('블로그 URL을 입력해주세요.');
      return false;
    }
    if (!formData.username.trim()) {
      setConnectionError('사용자명을 입력해주세요.');
      return false;
    }
    if (!formData.password.trim()) {
      setConnectionError('비밀번호를 입력해주세요.');
      return false;
    }
    if (!formData.name.trim()) {
      setConnectionError('연결 이름을 입력해주세요.');
      return false;
    }
    return true;
  };

  const testWordPressConnection = async (
    url: string,
    username: string,
    password: string,
  ): Promise<WordPressAPIResponse> => {
    try {
      // Test user authentication
      const userResponse = await fetch(`${url}/wp-json/wp/v2/users/me`, {
        method: 'GET',
        headers: {
          Authorization: `Basic ${btoa(`${username}:${password}`)}`,
          'Content-Type': 'application/json',
        },
      });

      if (!userResponse.ok) {
        return {
          success: false,
          error: '인증 실패: 사용자명 또는 비밀번호가 올바르지 않습니다.',
        };
      }

      const userData = await userResponse.json();

      // Get posts count
      const postsResponse = await fetch(
        `${url}/wp-json/wp/v2/posts?per_page=1`,
        {
          headers: {
            Authorization: `Basic ${btoa(`${username}:${password}`)}`,
            'Content-Type': 'application/json',
          },
        },
      );
      const postsCount = postsResponse.headers.get('X-WP-Total') || '0';

      // Get pages count
      const pagesResponse = await fetch(
        `${url}/wp-json/wp/v2/pages?per_page=1`,
        {
          headers: {
            Authorization: `Basic ${btoa(`${username}:${password}`)}`,
            'Content-Type': 'application/json',
          },
        },
      );
      const pagesCount = pagesResponse.headers.get('X-WP-Total') || '0';

      // Get media count
      const mediaResponse = await fetch(
        `${url}/wp-json/wp/v2/media?per_page=1`,
        {
          headers: {
            Authorization: `Basic ${btoa(`${username}:${password}`)}`,
            'Content-Type': 'application/json',
          },
        },
      );
      const mediaCount = mediaResponse.headers.get('X-WP-Total') || '0';

      return {
        success: true,
        data: {
          user: userData,
          posts_count: parseInt(postsCount),
          pages_count: parseInt(pagesCount),
          media_count: parseInt(mediaCount),
        },
      };
    } catch (error) {
      console.error('WordPress API test failed:', error);
      return { success: false, error: '연결 테스트 중 오류가 발생했습니다.' };
    }
  };

  const connectToSite = async () => {
    if (!validateForm()) return;

    setIsConnecting(true);
    setConnectionError('');

    try {
      const testResult = await testWordPressConnection(
        formData.url,
        formData.username,
        formData.password,
      );

      if (testResult.success && testResult.data) {
        const newSite: WordPressSite = {
          url: formData.url,
          username: formData.username,
          password: formData.password, // Store password for sync operations
          name: formData.name,
          posts_count: testResult.data.posts_count,
          pages_count: testResult.data.pages_count,
          media_count: testResult.data.media_count,
        };

        // Save connection to persistent storage
        const saveResult =
          await window.electron.wordpress.saveConnection(newSite);

        if (saveResult.success && saveResult.connections) {
          setConnections(saveResult.connections);
          setSelectedSite(newSite);
          await loadSiteContent(newSite);
          setActiveTab('posts');

          // Clear form
          setFormData({
            url: '',
            username: '',
            password: '',
            name: '',
          });
        } else {
          setConnectionError('연결을 저장할 수 없습니다.');
        }
      } else {
        setConnectionError(testResult.error || '연결에 실패했습니다.');
      }
    } catch (error) {
      console.error('Connection failed:', error);
      setConnectionError('연결 중 오류가 발생했습니다.');
    } finally {
      setIsConnecting(false);
    }
  };

  const loadSiteContent = async (site: WordPressSite): Promise<{postsCount: number, mediaCount: number}> => {
    try {
      // Fetch all posts with pagination
      const allPosts: WordPressPost[] = [];
      let page = 1;
      let hasMorePosts = true;
      const perPage = 100; // WordPress max per page

      while (hasMorePosts) {
        const postsResponse = await fetch(
          `${site.url}/wp-json/wp/v2/posts?per_page=${perPage}&page=${page}&_embed=author`,
          {
            headers: {
              Authorization: `Basic ${btoa(`${site.username}:${site.password || ''}`)}`,
              'Content-Type': 'application/json',
            },
          },
        );

        if (postsResponse.ok) {
          const postsData = await postsResponse.json();
          const totalPages = parseInt(postsResponse.headers.get('X-WP-TotalPages') || '1');
          
          const formattedPosts: WordPressPost[] = postsData.map((post: any) => ({
            id: post.id,
            title: post.title.rendered,
            excerpt: post.excerpt.rendered.replace(/<[^>]*>/g, ''),
            content: post.content.rendered,
            slug: post.slug,
            author: post._embedded?.author?.[0]?.name || 'Unknown',
            date: new Date(post.date).toLocaleDateString('ko-KR'),
            status: post.status,
            type: post.type,
          }));
          
          allPosts.push(...formattedPosts);
          
          hasMorePosts = page < totalPages;
          page++;
        } else {
          hasMorePosts = false;
        }
      }

      setPosts(allPosts);

      // Fetch all media with pagination
      const allMedia: WordPressMedia[] = [];
      page = 1;
      let hasMoreMedia = true;

      while (hasMoreMedia) {
        const mediaResponse = await fetch(
          `${site.url}/wp-json/wp/v2/media?per_page=${perPage}&page=${page}`,
          {
            headers: {
              Authorization: `Basic ${btoa(`${site.username}:${site.password || ''}`)}`,
              'Content-Type': 'application/json',
            },
          },
        );

        if (mediaResponse.ok) {
          const mediaData = await mediaResponse.json();
          const totalPages = parseInt(mediaResponse.headers.get('X-WP-TotalPages') || '1');
          
          const formattedMedia: WordPressMedia[] = mediaData.map((item: any) => ({
            id: item.id,
            title: item.title.rendered,
            url: item.source_url,
            type: item.media_type,
            filename: item.source_url.split('/').pop(),
            date: new Date(item.date).toLocaleDateString('ko-KR'),
          }));
          
          allMedia.push(...formattedMedia);
          
          hasMoreMedia = page < totalPages;
          page++;
        } else {
          hasMoreMedia = false;
        }
      }

      setMedia(allMedia);
      
      return {
        postsCount: allPosts.length,
        mediaCount: allMedia.length
      };
    } catch (error) {
      console.error('Failed to load site content:', error);
      // Fallback to mock data if API fails
      const mockPosts = [
        {
          id: 1,
          title: '샘플 포스트',
          excerpt: '이것은 샘플 포스트입니다.',
          author: '관리자',
          date: '2024-01-15',
          status: 'published',
          type: 'post',
        },
        {
          id: 2,
          title: '테스트 포스트',
          excerpt: '테스트를 위한 포스트입니다.',
          author: '관리자',
          date: '2024-01-14',
          status: 'draft',
          type: 'post',
        },
      ];
      const mockMedia = [
        {
          id: 1,
          title: '샘플 이미지',
          url: 'https://via.placeholder.com/300x200',
          type: 'image',
          date: '2024-01-15',
        },
        {
          id: 2,
          title: '테스트 문서',
          url: 'https://via.placeholder.com/400x300',
          type: 'document',
          date: '2024-01-14',
        },
      ];
      
      setPosts(mockPosts);
      setMedia(mockMedia);
      
      return {
        postsCount: mockPosts.length,
        mediaCount: mockMedia.length
      };
    }
  };

  const disconnectSite = async (siteId: string) => {
    try {
      const result = await window.electron.wordpress.deleteConnection(siteId);
      if (result.success && result.connections) {
        setConnections(result.connections);
        if (selectedSite?.id === siteId) {
          setSelectedSite(null);
          setPosts([]);
          setMedia([]);
        }
        setShowDeleteConfirm(null);
      }
    } catch (error) {
      console.error('Failed to disconnect site:', error);
    }
  };

  const refreshSiteContent = async () => {
    if (!selectedSite) return;
    
    setIsRefreshing(true);
    setRefreshProgress('포스트를 가져오는 중...');
    try {
      const { postsCount, mediaCount } = await loadSiteContent(selectedSite);
      
      setRefreshProgress('연결 정보를 업데이트하는 중...');
      
      // Update the connection with new counts
      const updatedSite = {
        ...selectedSite,
        posts_count: postsCount,
        media_count: mediaCount,
      };
      
      // Update the connection in storage
      await window.electron.wordpress.updateConnection(selectedSite.id!, {
        posts_count: postsCount,
        media_count: mediaCount,
      });
      
      // Update the connections list
      setConnections(prev => 
        prev.map(conn => 
          conn.id === selectedSite.id 
            ? { ...conn, posts_count: postsCount, media_count: mediaCount }
            : conn
        )
      );
      
      setSelectedSite(updatedSite);
      setRefreshProgress(`완료! ${postsCount}개 포스트, ${mediaCount}개 미디어 로드됨`);
      
      // Clear progress message after 3 seconds
      setTimeout(() => setRefreshProgress(''), 3000);
    } catch (error) {
      console.error('Failed to refresh site content:', error);
      setRefreshProgress('새로고침 중 오류가 발생했습니다.');
      setTimeout(() => setRefreshProgress(''), 3000);
    } finally {
      setIsRefreshing(false);
    }
  };

  const refreshConnections = async () => {
    setIsRefreshing(true);
    try {
      await loadSavedConnections();
    } catch (error) {
      console.error('Failed to refresh connections:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const deletePost = async (postId: number) => {
    if (!selectedSite) return;
    
    setIsDeletingPost(true);
    try {
      const response = await fetch(
        `${selectedSite.url}/wp-json/wp/v2/posts/${postId}?force=true`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Basic ${btoa(`${selectedSite.username}:${selectedSite.password || ''}`)}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.ok) {
        // Remove the post from local state
        setPosts(prev => prev.filter(post => post.id !== postId));
        
        // Update the connection count
        const updatedSite = {
          ...selectedSite,
          posts_count: (selectedSite.posts_count || 1) - 1,
        };
        
        // Update the connection in storage
        await window.electron.wordpress.updateConnection(selectedSite.id!, {
          posts_count: updatedSite.posts_count,
        });
        
        // Update the connections list
        setConnections(prev => 
          prev.map(conn => 
            conn.id === selectedSite.id 
              ? { ...conn, posts_count: updatedSite.posts_count }
              : conn
          )
        );
        
        setSelectedSite(updatedSite);
        setShowPostDeleteConfirm(null);
      } else {
        throw new Error('Failed to delete post');
      }
    } catch (error) {
      console.error('Failed to delete post:', error);
      alert('포스트 삭제에 실패했습니다.');
    } finally {
      setIsDeletingPost(false);
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'published':
        return '발행됨';
      case 'draft':
        return '임시저장';
      case 'pending':
        return '검토 대기';
      case 'completed':
        return '완료';
      case 'failed':
        return '실패';
      case 'in_progress':
        return '진행 중';
      default:
        return status;
    }
  };

  const getTypeText = (type: string): string => {
    switch (type) {
      case 'post':
        return '포스트';
      case 'page':
        return '페이지';
      default:
        return type;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <FontAwesomeIcon icon={faCheckCircle} />;
      case 'failed':
        return <FontAwesomeIcon icon={faTimesCircle} />;
      case 'in_progress':
        return <FontAwesomeIcon icon={faClock} />;
      default:
        return <FontAwesomeIcon icon={faExclamationTriangle} />;
    }
  };

  const navigateToSyncedFolder = async (site: WordPressSite) => {
    if (!site.local_sync_path) {
      alert('이 블로그는 아직 동기화되지 않았습니다.');
      return;
    }

    try {
      // First navigate to the Finder UI
      navigate('/');

      // Wait a bit for the component to mount
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Then trigger the folder navigation
      await (window.electron.wordpress as any).navigateToSyncedFolder({
        syncPath: site.local_sync_path,
        connectionName: site.name || site.url,
      });

      // Show success message
      alert(`동기화된 폴더로 이동합니다: ${site.local_sync_path}`);
    } catch (error) {
      console.error('Failed to navigate to synced folder:', error);
      alert('폴더로 이동할 수 없습니다.');
    }
  };

  const handleSiteSelect = async (site: WordPressSite) => {
    setSelectedSite(site);
    await loadSiteContent(site);
    setActiveTab('posts');
  };

  if (isLoading) {
    return (
      <div className="blog-poster">
        <div className="loading-container">
          <div className="loading-spinner">
            <FontAwesomeIcon icon={faSpinner} spin />
          </div>
          <h3>블로그를 불러오는 중...</h3>
          <p>잠시만 기다려주세요</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="blog-poster">
        <div className="error-container">
          <div className="error-icon">
            <FontAwesomeIcon icon={faExclamationTriangle} />
          </div>
          <h2>연결 오류</h2>
          <p>{error}</p>
          <button type="button" onClick={loadSavedConnections} className="retry-btn">
            <FontAwesomeIcon icon={faRefresh} />
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="blog-poster">
      <div className="poster-header">
        <div className="header-content">
          <div className="header-text">
            <h1>
              <FontAwesomeIcon icon={faRobot} />
              Blog Poster
            </h1>
            <p>블로그를 연결하고 블로그 포스트를 관리하세요</p>
          </div>
          <div className="header-actions">
            <DebugButton className="debug-btn" />
          </div>
        </div>
      </div>

      <div className="poster-content">
        {/* Navigation Tabs */}
        <div className="content-tabs">
          <button
            className={`tab-btn ${activeTab === 'sites' ? 'active' : ''}`}
            onClick={() => setActiveTab('sites')}
          >
            <FontAwesomeIcon icon={faGlobe} className="tab-icon" /> 블로그 관리
          </button>
          <button
            className={`tab-btn ${activeTab === 'posts' ? 'active' : ''}`}
            onClick={() => setActiveTab('posts')}
            disabled={!selectedSite}
          >
            <FontAwesomeIcon icon={faFileAlt} className="tab-icon" /> 포스트 ({selectedSite?.posts_count || 0})
          </button>
          <button
            className={`tab-btn ${activeTab === 'media' ? 'active' : ''}`}
            onClick={() => setActiveTab('media')}
            disabled={!selectedSite}
          >
            <FontAwesomeIcon icon={faImage} className="tab-icon" /> 미디어 ({selectedSite?.media_count || 0})
          </button>
          <button
            className={`tab-btn ${activeTab === 'sync' ? 'active' : ''}`}
            onClick={() => setActiveTab('sync')}
            disabled={!selectedSite}
          >
            💾 동기화
          </button>
          <button
            className={`tab-btn ${activeTab === 'scheduler' ? 'active' : ''}`}
            onClick={() => setActiveTab('scheduler')}
          >
            <FontAwesomeIcon icon={faClock} className="tab-icon" /> 스케줄러
          </button>
          <button
            className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
            disabled={!selectedSite}
          >
            <FontAwesomeIcon icon={faCog} className="tab-icon" /> 설정
          </button>
        </div>

        {/* Sites Tab */}
        {activeTab === 'sites' && (
          <div className="sites-tab">
            {/* Connection Form */}
            <div className="connection-form-section">
              <h2>새 연결 추가</h2>
              <div className="connection-form">
                <div className="form-group">
                  <label htmlFor="name">연결 이름 *</label>
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleFormChange('name', e.target.value)}
                    placeholder="예: 내 블로그"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="url">블로그 URL *</label>
                  <input
                    type="url"
                    id="url"
                    value={formData.url}
                    onChange={(e) => handleFormChange('url', e.target.value)}
                    placeholder="https://example.com"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="username">사용자명 *</label>
                  <input
                    type="text"
                    id="username"
                    value={formData.username}
                    onChange={(e) => handleFormChange('username', e.target.value)}
                    placeholder="WordPress 사용자명"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="password">비밀번호 *</label>
                  <div className="password-input">
                    <input
                      type="password"
                      id="password"
                      value={formData.password}
                      onChange={(e) => handleFormChange('password', e.target.value)}
                      placeholder="WordPress 비밀번호"
                      required
                      onKeyPress={(e) => e.key === 'Enter' && connectToSite()}
                    />
                  </div>
                </div>
                <button
                  className="connect-btn"
                  onClick={connectToSite}
                  disabled={isConnecting}
                >
                  {isConnecting ? '연결 중...' : '연결하기'}
                </button>
              </div>

              {connectionError && (
                <div className="connection-error">
                  <FontAwesomeIcon icon={faTimesCircle} className="error-icon" /> {connectionError}
                </div>
              )}

              <div className="connection-tips">
                <h3>💡 연결 팁</h3>
                <ul>
                  <li>WordPress REST API가 활성화되어 있어야 합니다</li>
                  <li>사용자 계정에 적절한 권한이 있어야 합니다</li>
                  <li>HTTPS를 사용하는 것을 권장합니다</li>
                </ul>
              </div>
            </div>

            {/* Saved Connections */}
            {connections.length > 0 && (
              <div className="saved-connections">
                <div className="saved-connections-header">
                  <h2>저장된 연결</h2>
                  <button
                    className="refresh-btn"
                    onClick={refreshConnections}
                    disabled={isRefreshing}
                    title="연결 목록 새로고침"
                  >
                    <FontAwesomeIcon icon={faSync} className="refresh-icon" /> 새로고침
                  </button>
                </div>
                <div className="connections-grid">
                  {connections.map((connection) => (
                    <div
                      key={connection.id}
                      className={`connection-card ${selectedSite?.id === connection.id ? 'selected' : ''}`}
                      onClick={() => handleSiteSelect(connection)}
                    >
                      <div className="connection-header">
                        <h3>{connection.name}</h3>
                        <div className="connection-actions">
                          <button
                            className="refresh-site-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (selectedSite?.id === connection.id) {
                                refreshSiteContent();
                              }
                            }}
                            disabled={isRefreshing}
                            title="블로그 콘텐츠 새로고침"
                          >
                            <FontAwesomeIcon icon={faSync} className="refresh-icon" />
                          </button>
                          <button
                            className="disconnect-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDeleteConfirm(connection.id!);
                            }}
                            title="연결 삭제"
                          >
                            <FontAwesomeIcon icon={faTrash} className="delete-icon" />
                          </button>
                        </div>
                      </div>
                      <p className="connection-url">{connection.url}</p>
                      <div className="connection-stats">
                        <span>
                          <FontAwesomeIcon icon={faFileAlt} className="stats-icon" /> {connection.posts_count || 0} 포스트
                        </span>
                        <span>
                          <FontAwesomeIcon icon={faFileAlt} className="stats-icon" /> {connection.pages_count || 0} 페이지
                        </span>
                        <span>
                          <FontAwesomeIcon icon={faImage} className="stats-icon" /> {connection.media_count || 0} 미디어
                        </span>
                      </div>
                      {connection.local_sync_path && (
                        <div className="sync-info">
                          💾 동기화됨: {connection.local_sync_path}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {connections.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">
                  <FontAwesomeIcon icon={faGlobe} />
                </div>
                <h2>연결된 블로그가 없습니다</h2>
                <p>새로운 블로그를 연결하여 시작하세요</p>
              </div>
            )}
          </div>
        )}

        {/* Posts Tab */}
        {activeTab === 'posts' && selectedSite && (
          <div className="posts-tab">
            <div className="tab-header">
              <h3>포스트 목록 - {selectedSite.name}</h3>
              <button
                className="refresh-content-btn"
                onClick={refreshSiteContent}
                disabled={isRefreshing}
                title="블로그 콘텐츠 새로고침"
              >
                <FontAwesomeIcon icon={faSync} className="refresh-icon" /> {isRefreshing ? '새로고침 중...' : '새로고침'}
              </button>
            </div>
            
            {refreshProgress && (
              <div className="refresh-progress">
                <span className="progress-text">{refreshProgress}</span>
              </div>
            )}

            <div className="posts-list">
              {posts.map((post) => (
                <div key={post.id} className="post-item">
                  <div className="post-header">
                    <h4>{post.title}</h4>
                    <button
                      className="delete-post-btn"
                      onClick={() => setShowPostDeleteConfirm(post.id)}
                      disabled={isDeletingPost}
                      title="포스트 삭제"
                    >
                      <FontAwesomeIcon 
                        icon={isDeletingPost ? faSync : faTrash} 
                        className="delete-icon" 
                      />
                    </button>
                  </div>
                  <p className="post-excerpt">{post.excerpt}</p>
                  <div className="post-meta">
                    <span>
                      <FontAwesomeIcon icon={faUser} className="meta-icon" /> {post.author}
                    </span>
                    <span>
                      <FontAwesomeIcon icon={faCalendarAlt} className="meta-icon" /> {post.date}
                    </span>
                    <span>
                      <FontAwesomeIcon icon={faChartBar} className="meta-icon" /> {getStatusText(post.status)}
                    </span>
                    <span>
                      <FontAwesomeIcon icon={faTag} className="meta-icon" /> {getTypeText(post.type)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Media Tab */}
        {activeTab === 'media' && selectedSite && (
          <div className="media-tab">
            <h3>미디어 목록 - {selectedSite.name}</h3>
            <div className="media-grid">
              {media.map((item) => (
                <div key={item.id} className="media-item">
                  <div className="media-preview">
                    {item.type === 'image' ? (
                      <img src={item.url} alt={item.title} />
                    ) : (
                      <div className="media-icon">📄</div>
                    )}
                  </div>
                  <h4>{item.title}</h4>
                  <p className="media-meta">
                    <span>
                      <FontAwesomeIcon icon={faCalendarAlt} className="meta-icon" /> {item.date}
                    </span>
                    <span>
                      <FontAwesomeIcon icon={faTag} className="meta-icon" /> {item.type}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sync Tab */}
        {activeTab === 'sync' && selectedSite && (
          <div className="sync-tab">
            <h3>로컬 동기화 - {selectedSite.name}</h3>
            {/* Sync functionality will be implemented here */}
            <div className="sync-placeholder">
              <p>동기화 기능이 곧 추가될 예정입니다.</p>
            </div>
          </div>
        )}

        {/* Scheduler Tab */}
        {activeTab === 'scheduler' && (
          <div className="scheduler-tab">
            <h3>블로그 포스트 스케줄러</h3>
            <WordPressPostScheduler
              key={templateRefreshKey}
              sites={connections}
              selectedSite={selectedSite}
              onTaskCreated={() => {
                setTemplateRefreshKey(prev => prev + 1);
                console.log('WordPress post task created - refreshing component');
              }}
            />
            <div className="scheduler-section">
              <SchedulerManager className="blog-poster-scheduler-manager" />
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && selectedSite && (
          <div className="settings-tab">
            <h3>연결 설정 - {selectedSite.name}</h3>
            <div className="settings-form">
              <div className="form-group">
                <label htmlFor="siteName">블로그 이름</label>
                <input
                  type="text"
                  id="siteName"
                  value={selectedSite.name || ''}
                  onChange={async (e) => {
                    const updatedSite = {
                      ...selectedSite,
                      name: e.target.value,
                    };
                    await window.electron.wordpress.updateConnection(
                      selectedSite.id!,
                      { name: e.target.value },
                    );
                    setSelectedSite(updatedSite);
                  }}
                />
              </div>
              <div className="form-group">
                <label htmlFor="siteUrl">블로그 URL</label>
                <input
                  type="url"
                  id="siteUrl"
                  value={selectedSite.url}
                  disabled
                />
                <small>URL은 보안상 변경할 수 없습니다.</small>
              </div>
              <div className="form-group">
                <label htmlFor="username">사용자명</label>
                <input
                  type="text"
                  id="username"
                  value={selectedSite.username}
                  disabled
                />
                <small>사용자명은 보안상 변경할 수 없습니다.</small>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="delete-confirmation-modal">
          <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)} />
          <div className="modal-content">
            <h3>연결 삭제 확인</h3>
            <p>
              정말로 이 WordPress 연결을 삭제하시겠습니까?
              <br />
              <strong>이 작업은 되돌릴 수 없습니다.</strong>
            </p>
            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={() => setShowDeleteConfirm(null)}
              >
                취소
              </button>
              <button
                className="delete-btn"
                onClick={() => disconnectSite(showDeleteConfirm)}
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post Delete Confirmation Modal */}
      {showPostDeleteConfirm && (
        <div className="delete-confirmation-modal">
          <div className="modal-overlay" onClick={() => setShowPostDeleteConfirm(null)} />
          <div className="modal-content">
            <h3>포스트 삭제 확인</h3>
            <p>
              정말로 이 포스트를 삭제하시겠습니까?
              <br />
              <strong>이 작업은 되돌릴 수 없습니다.</strong>
              <br />
              <em>포스트가 블로그에서 영구적으로 삭제됩니다.</em>
            </p>
            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={() => setShowPostDeleteConfirm(null)}
                disabled={isDeletingPost}
              >
                취소
              </button>
              <button
                className="delete-btn"
                onClick={() => deletePost(showPostDeleteConfirm)}
                disabled={isDeletingPost}
              >
                {isDeletingPost ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlogPoster;
