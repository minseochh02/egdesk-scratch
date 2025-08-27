import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './WordPressConnector.css';

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

const WordPressConnector: React.FC = () => {
  const navigate = useNavigate();
  const [connections, setConnections] = useState<WordPressSite[]>([]);
  const [selectedSite, setSelectedSite] = useState<WordPressSite | null>(null);
  const [posts, setPosts] = useState<WordPressPost[]>([]);
  const [media, setMedia] = useState<WordPressMedia[]>([]);
  const [activeTab, setActiveTab] = useState<'connections' | 'posts' | 'media' | 'sync' | 'settings'>('connections');
  const [formData, setFormData] = useState<ConnectionForm>({
    url: '',
    username: '',
    password: '',
    name: ''
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string>('');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isSyncing: false,
    progress: 0,
    currentFile: '',
    totalFiles: 0,
    syncedFiles: 0,
    errors: []
  });
  const [localSyncPath, setLocalSyncPath] = useState<string>('');
  const [syncHistory, setSyncHistory] = useState<SyncRecord[]>([]);
  const [currentSyncId, setCurrentSyncId] = useState<string>('');
  const [exportFormat, setExportFormat] = useState<'markdown' | 'html' | 'txt' | 'json' | 'wordpress'>('wordpress');

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

  const loadSavedConnections = async () => {
    try {
      const result = await window.electron.wordpress.getConnections();
      if (result.success && result.connections) {
        setConnections(result.connections);
        // If there are saved connections, select the first one
        if (result.connections.length > 0 && !selectedSite) {
          setSelectedSite(result.connections[0]);
          await loadSiteContent(result.connections[0]);
        }
      }
    } catch (error) {
      console.error('Failed to load saved connections:', error);
    }
  };

  const loadSyncHistory = async (connectionId: string) => {
    try {
      const result = await window.electron.sync.getHistory(connectionId);
      if (result.success && result.syncHistory) {
        setSyncHistory(result.syncHistory);
      }
    } catch (error) {
      console.error('Failed to load sync history:', error);
    }
  };

  const handleFormChange = (field: keyof ConnectionForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setConnectionError('');
  };

  const validateForm = (): boolean => {
    if (!formData.url.trim()) {
      setConnectionError('WordPress 사이트 URL을 입력해주세요.');
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

  const testWordPressConnection = async (url: string, username: string, password: string): Promise<WordPressAPIResponse> => {
    try {
      // Test user authentication
      const userResponse = await fetch(`${url}/wp-json/wp/v2/users/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${btoa(`${username}:${password}`)}`,
          'Content-Type': 'application/json',
        },
      });

      if (!userResponse.ok) {
        return { success: false, error: '인증 실패: 사용자명 또는 비밀번호가 올바르지 않습니다.' };
      }

      const userData = await userResponse.json();

      // Get posts count
      const postsResponse = await fetch(`${url}/wp-json/wp/v2/posts?per_page=1`, {
        headers: {
          'Authorization': `Basic ${btoa(`${username}:${password}`)}`,
          'Content-Type': 'application/json',
        },
      });
      const postsCount = postsResponse.headers.get('X-WP-Total') || '0';

      // Get pages count
      const pagesResponse = await fetch(`${url}/wp-json/wp/v2/pages?per_page=1`, {
        headers: {
          'Authorization': `Basic ${btoa(`${username}:${password}`)}`,
          'Content-Type': 'application/json',
        },
      });
      const pagesCount = pagesResponse.headers.get('X-WP-Total') || '0';

      // Get media count
      const mediaResponse = await fetch(`${url}/wp-json/wp/v2/media?per_page=1`, {
        headers: {
          'Authorization': `Basic ${btoa(`${username}:${password}`)}`,
          'Content-Type': 'application/json',
        },
      });
      const mediaCount = mediaResponse.headers.get('X-WP-Total') || '0';

      return {
        success: true,
        data: {
          user: userData,
          posts_count: parseInt(postsCount),
          pages_count: parseInt(pagesCount),
          media_count: parseInt(mediaCount)
        }
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
      const testResult = await testWordPressConnection(formData.url, formData.username, formData.password);
      
      if (testResult.success && testResult.data) {
        const newSite: WordPressSite = {
          url: formData.url,
          username: formData.username,
          password: formData.password, // Store password for sync operations
          name: formData.name,
          posts_count: testResult.data.posts_count,
          pages_count: testResult.data.pages_count,
          media_count: testResult.data.media_count
        };

        // Save connection to persistent storage
        const saveResult = await window.electron.wordpress.saveConnection(newSite);
        
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
            name: ''
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

  const loadSiteContent = async (site: WordPressSite) => {
    try {
      // Try to load actual content from WordPress API
      const postsResponse = await fetch(`${site.url}/wp-json/wp/v2/posts?per_page=20`, {
        headers: {
          'Authorization': `Basic ${btoa(`${site.username}:${site.password || ''}`)}`,
          'Content-Type': 'application/json',
        },
      });

      const mediaResponse = await fetch(`${site.url}/wp-json/wp/v2/media?per_page=20`, {
        headers: {
          'Authorization': `Basic ${btoa(`${site.username}:${site.password || ''}`)}`,
          'Content-Type': 'application/json',
        },
      });

      if (postsResponse.ok) {
        const postsData = await postsResponse.json();
        const formattedPosts: WordPressPost[] = postsData.map((post: any) => ({
          id: post.id,
          title: post.title.rendered,
          excerpt: post.excerpt.rendered.replace(/<[^>]*>/g, ''),
          content: post.content.rendered,
          slug: post.slug,
          author: post._embedded?.author?.[0]?.name || 'Unknown',
          date: new Date(post.date).toLocaleDateString('ko-KR'),
          status: post.status,
          type: post.type
        }));
        setPosts(formattedPosts);
      }

      if (mediaResponse.ok) {
        const mediaData = await mediaResponse.json();
        const formattedMedia: WordPressMedia[] = mediaData.map((item: any) => ({
          id: item.id,
          title: item.title.rendered,
          url: item.source_url,
          type: item.media_type,
          filename: item.source_url.split('/').pop(),
          date: new Date(item.date).toLocaleDateString('ko-KR')
        }));
        setMedia(formattedMedia);
      }
    } catch (error) {
      console.error('Failed to load site content:', error);
      // Fallback to mock data if API fails
      setPosts([
        { id: 1, title: '샘플 포스트', excerpt: '이것은 샘플 포스트입니다.', author: '관리자', date: '2024-01-15', status: 'published', type: 'post' },
        { id: 2, title: '테스트 포스트', excerpt: '테스트를 위한 포스트입니다.', author: '관리자', date: '2024-01-14', status: 'draft', type: 'post' }
      ]);
      setMedia([
        { id: 1, title: '샘플 이미지', url: 'https://via.placeholder.com/300x200', type: 'image', date: '2024-01-15' },
        { id: 2, title: '테스트 문서', url: 'https://via.placeholder.com/400x300', type: 'document', date: '2024-01-14' }
      ]);
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
      }
    } catch (error) {
      console.error('Failed to disconnect site:', error);
    }
  };

  const fetchFullPostContent = async (site: WordPressSite, postId: number): Promise<WordPressPost | null> => {
    try {
      const response = await fetch(`${site.url}/wp-json/wp/v2/posts/${postId}?_embed`, {
        headers: {
          'Authorization': `Basic ${btoa(`${site.username}:${site.password || ''}`)}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const postData = await response.json();
        return {
          id: postData.id,
          title: postData.title.rendered,
          excerpt: postData.excerpt.rendered.replace(/<[^>]*>/g, ''),
          content: postData.content.rendered,
          slug: postData.slug,
          author: postData._embedded?.author?.[0]?.name || 'Unknown',
          date: new Date(postData.date).toLocaleDateString('ko-KR'),
          status: postData.status,
          type: postData.type
        };
      }
      return null;
    } catch (error) {
      console.error('Failed to fetch full post content:', error);
      return null;
    }
  };

  const syncWordPressToLocal = async (site: WordPressSite, localPath: string) => {
    if (!site.password) {
      setSyncStatus(prev => ({
        ...prev,
        errors: ['동기화를 위해 비밀번호가 필요합니다.']
      }));
      return;
    }

    // Initialize sync record
    const syncData = {
      connectionId: site.id!,
      connectionName: site.name || site.url,
      syncPath: localPath,
      totalFiles: posts.length + media.length
    };

    try {
      const syncRecordResult = await window.electron.sync.saveHistory(syncData);
      if (!syncRecordResult.success) {
        throw new Error('Failed to create sync record');
      }

      const syncRecord = syncRecordResult.syncRecord!;
      setCurrentSyncId(syncRecord.id);

      setSyncStatus(prev => ({
        ...prev,
        isSyncing: true,
        progress: 0,
        currentFile: '동기화 시작...',
        totalFiles: posts.length + media.length,
        syncedFiles: 0,
        errors: []
      }));

      const fileDetails: SyncFileDetail[] = [];

      // Create local folders
      setSyncStatus(prev => ({ ...prev, currentFile: '로컬 폴더 생성 중...' }));
      const folderResult = await (window.electron.wordpress as any).syncCreateFolders(localPath);
      if (!folderResult.success) {
        throw new Error(`폴더 생성 실패: ${folderResult.error}`);
      }

      // Sync posts
      if (exportFormat === 'wordpress') {
        // For WordPress format, create a single XML file with all posts
        setSyncStatus(prev => ({ ...prev, currentFile: '모든 포스트 내용 가져오는 중...' }));
        
        const allPosts: WordPressPost[] = [];
        for (let i = 0; i < posts.length; i++) {
          const post = posts[i];
          setSyncStatus(prev => ({
            ...prev,
            currentFile: `포스트 내용 가져오는 중: ${post.title}`,
            progress: ((i) / posts.length) * 40
          }));

          const fullPost = await fetchFullPostContent(site, post.id);
          if (fullPost) {
            allPosts.push(fullPost);
          }
        }

        // Generate combined WordPress XML
        const wordpressXML = generateWordPressXML(allPosts, site);
        const xmlFilePath = `${localPath}/wordpress-export.xml`;
        
        setSyncStatus(prev => ({ ...prev, currentFile: 'WordPress XML 파일 생성 중...' }));
        const saveResult = await (window.electron.wordpress as any).syncSavePost(xmlFilePath, wordpressXML);
        
        if (!saveResult.success) {
          throw new Error(`WordPress XML 저장 실패: ${saveResult.error}`);
        }

        // Create setup instructions
        const instructionsContent = `# WordPress 로컬 테스트 가이드

## 📁 내보낸 파일
- **wordpress-export.xml**: WordPress 가져오기용 XML 파일
- **media/**: 다운로드된 미디어 파일들

## 🚀 로컬 WordPress 설정 방법

### 1. 로컬 WordPress 환경 설정
- XAMPP, WAMP, MAMP 또는 Local by Flywheel 설치
- 새로운 WordPress 사이트 생성

### 2. 콘텐츠 가져오기
1. WordPress 관리자 페이지 접속
2. **도구 > 가져오기** 메뉴 선택
3. **WordPress** 선택 후 플러그인 설치
4. **wordpress-export.xml** 파일 업로드
5. 작성자 설정 후 가져오기 실행

### 3. 미디어 파일 업로드
1. **media/** 폴더의 모든 파일을
2. **/wp-content/uploads/** 디렉토리에 복사

### 4. 테스트
- 포스트와 미디어가 정상적으로 표시되는지 확인

---
*EGDesk WordPress Connector로 생성됨 - ${new Date().toLocaleString('ko-KR')}*
`;

        const instructionsPath = `${localPath}/README-로컬테스트.md`;
        await (window.electron.wordpress as any).syncSavePost(instructionsPath, instructionsContent);

        const fileDetail: SyncFileDetail = {
          path: 'wordpress-export',
          name: 'WordPress Export XML',
          type: 'post',
          status: 'synced',
          localPath: xmlFilePath,
          size: saveResult.size,
          syncedAt: new Date().toISOString()
        };
        fileDetails.push(fileDetail);

        setSyncStatus(prev => ({
          ...prev,
          progress: 50,
          currentFile: `WordPress XML 생성 완료 (${allPosts.length}개 포스트)`,
          syncedFiles: 1
        }));

        await window.electron.sync.updateProgress(syncRecord.id, {
          syncedFiles: 1,
          fileDetails: fileDetails
        });

      } else {
        // For other formats, create individual files
        for (let i = 0; i < posts.length; i++) {
          const post = posts[i];
          
          setSyncStatus(prev => ({
            ...prev,
            currentFile: `포스트 내용 가져오는 중: ${post.title}`,
            progress: ((i) / posts.length) * 50
          }));

          // Fetch full post content from WordPress
          const fullPost = await fetchFullPostContent(site, post.id);
          if (!fullPost) {
            throw new Error(`포스트 내용을 가져올 수 없습니다: ${post.title}`);
          }

          const { content: postContent, extension } = convertPostToFormat(fullPost, exportFormat);
          const fileName = `${fullPost.slug || fullPost.id}.${extension}`;
          const localFilePath = `${localPath}/posts/${fileName}`;
          
          setSyncStatus(prev => ({
            ...prev,
            currentFile: `포스트 저장 중: ${fileName}`,
          }));

          // Save post to local file
          const saveResult = await (window.electron.wordpress as any).syncSavePost(localFilePath, postContent);
          if (!saveResult.success) {
            throw new Error(`포스트 저장 실패: ${saveResult.error}`);
          }
          
          // Record file sync detail
          const fileDetail: SyncFileDetail = {
            path: fullPost.slug || fullPost.id.toString(),
            name: fullPost.title,
            type: 'post',
            status: 'synced',
            localPath: localFilePath,
            size: saveResult.size,
            syncedAt: new Date().toISOString()
          };
          fileDetails.push(fileDetail);
          
          setSyncStatus(prev => ({
            ...prev,
            progress: ((i + 1) / posts.length) * 50,
            currentFile: `포스트 동기화 완료: ${fullPost.title}`,
            syncedFiles: i + 1
          }));

          // Update sync progress in storage
          await window.electron.sync.updateProgress(syncRecord.id, {
            syncedFiles: i + 1,
            fileDetails: fileDetails
          });
        }
      }

      // Sync media
      for (let i = 0; i < media.length; i++) {
        const item = media[i];
        const fileName = item.filename || `${item.title.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;
        const localFilePath = `${localPath}/media/${fileName}`;
        
        setSyncStatus(prev => ({
          ...prev,
          currentFile: `미디어 다운로드 중: ${item.title}`,
          progress: 50 + ((i) / media.length) * 50
        }));
        
        // Download media file
        const downloadResult = await (window.electron.wordpress as any).syncDownloadMedia(item.url, localFilePath);
        
        let fileDetail: SyncFileDetail;
        if (downloadResult.success) {
          fileDetail = {
            path: item.filename || item.title,
            name: item.title,
            type: 'media',
            status: 'synced',
            localPath: localFilePath,
            size: downloadResult.size,
            syncedAt: new Date().toISOString()
          };
        } else {
          fileDetail = {
            path: item.filename || item.title,
            name: item.title,
            type: 'media',
            status: 'failed',
            localPath: localFilePath,
            syncedAt: new Date().toISOString(),
            error: downloadResult.error
          };
        }
        fileDetails.push(fileDetail);
        
        setSyncStatus(prev => ({
          ...prev,
          progress: 50 + ((i + 1) / media.length) * 50,
          currentFile: `미디어 동기화: ${item.title}`,
          syncedFiles: posts.length + i + 1
        }));

        // Update sync progress in storage
        await window.electron.sync.updateProgress(syncRecord.id, {
          syncedFiles: posts.length + i + 1,
          fileDetails: fileDetails
        });
      }

      // Update site with sync path
      if (selectedSite) {
        const updatedSite = { ...selectedSite, local_sync_path: localPath };
        await window.electron.wordpress.updateConnection(selectedSite.id!, { local_sync_path: localPath });
        setSelectedSite(updatedSite);
      }

      // Complete sync record
      await window.electron.sync.complete(syncRecord.id, {
        syncedFiles: posts.length + media.length,
        failedFiles: 0,
        fileDetails: fileDetails,
        status: 'completed'
      });

      // Notify Finder UI about sync completion
      await window.electron.wordpress.notifySyncCompletion({
        syncPath: localPath,
        connectionName: site.name || site.url,
        totalFiles: posts.length + media.length,
        syncedFiles: posts.length + media.length
      });

      // Reload sync history
      await loadSyncHistory(site.id!);

      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        progress: 100,
        currentFile: '동기화 완료!',
        syncedFiles: posts.length + media.length
      }));
    } catch (error) {
      console.error('Sync failed:', error);
      
      // Mark sync as failed
      if (currentSyncId) {
        await window.electron.sync.complete(currentSyncId, {
          syncedFiles: syncStatus.syncedFiles,
          failedFiles: posts.length + media.length - syncStatus.syncedFiles,
          fileDetails: [],
          status: 'failed',
          errors: [error instanceof Error ? error.message : 'Unknown error']
        });
      }

      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        errors: [`동기화 실패: ${error}`]
      }));
    }
  };

  const convertPostToFormat = (post: WordPressPost, format: string): { content: string; extension: string } => {
    const cleanExcerpt = post.excerpt ? post.excerpt.replace(/<[^>]*>/g, '').trim() : '';
    
    switch (format) {
      case 'wordpress':
        // WordPress XML export format for local development
        return {
          content: `<?xml version="1.0" encoding="UTF-8" ?>
<!-- This is a WordPress eXtended RSS file generated by EGDesk as an export of your WordPress site. -->
<!-- It contains information about your site's posts, pages, comments, categories, and other WordPress content. -->

<rss version="2.0"
  xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:wfw="http://wellformedweb.org/CommentAPI/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:wp="http://wordpress.org/export/1.2/">

<channel>
  <title>EGDesk WordPress Export</title>
  <description>WordPress content exported via EGDesk</description>
  <language>ko-KR</language>
  <wp:wxr_version>1.2</wp:wxr_version>
  <wp:base_site_url><![CDATA[${post.slug ? post.slug.split('/')[0] : 'localhost'}]]></wp:base_site_url>
  <wp:base_blog_url><![CDATA[${post.slug ? post.slug.split('/')[0] : 'localhost'}]]></wp:base_blog_url>

  <item>
    <title><![CDATA[${post.title}]]></title>
    <link><![CDATA[${post.slug || post.id}]]></link>
    <pubDate>${new Date(post.date).toUTCString()}</pubDate>
    <dc:creator><![CDATA[${post.author}]]></dc:creator>
    <guid isPermaLink="false">${post.id}</guid>
    <description></description>
    <content:encoded><![CDATA[${post.content || ''}]]></content:encoded>
    <excerpt:encoded><![CDATA[${post.excerpt || ''}]]></excerpt:encoded>
    <wp:post_id>${post.id}</wp:post_id>
    <wp:post_date><![CDATA[${post.date}]]></wp:post_date>
    <wp:post_date_gmt><![CDATA[${new Date(post.date).toISOString()}]]></wp:post_date_gmt>
    <wp:comment_status><![CDATA[open]]></wp:comment_status>
    <wp:ping_status><![CDATA[open]]></wp:ping_status>
    <wp:post_name><![CDATA[${post.slug || post.id}]]></wp:post_name>
    <wp:status><![CDATA[${post.status}]]></wp:status>
    <wp:post_parent>0</wp:post_parent>
    <wp:menu_order>0</wp:menu_order>
    <wp:post_type><![CDATA[${post.type}]]></wp:post_type>
    <wp:post_password><![CDATA[]]></wp:post_password>
    <wp:is_sticky>0</wp:is_sticky>
  </item>

</channel>
</rss>`,
          extension: 'xml'
        };
      case 'markdown':
        const cleanContent = post.content 
          ? post.content
              .replace(/<p>/g, '\n\n')
              .replace(/<\/p>/g, '')
              .replace(/<br\s*\/?>/g, '\n')
              .replace(/<h([1-6])>/g, '\n\n$&')
              .replace(/<\/h[1-6]>/g, '$&\n\n')
              .replace(/<strong>/g, '**')
              .replace(/<\/strong>/g, '**')
              .replace(/<em>/g, '*')
              .replace(/<\/em>/g, '*')
              .replace(/<ul>/g, '\n')
              .replace(/<\/ul>/g, '\n')
              .replace(/<li>/g, '- ')
              .replace(/<\/li>/g, '\n')
              .replace(/<[^>]*>/g, '') // Remove remaining HTML tags
              .replace(/\n\s*\n\s*\n/g, '\n\n') // Clean up extra newlines
              .trim()
          : '내용 없음';

        return {
          content: `# ${post.title}

**작성자:** ${post.author}  
**날짜:** ${post.date}  
**상태:** ${getStatusText(post.status)}  
**타입:** ${getTypeText(post.type)}  
**슬러그:** ${post.slug || 'N/A'}

## 요약
${cleanExcerpt || '요약 없음'}

## 내용
${cleanContent}

---
*WordPress에서 동기화됨 - ${new Date().toLocaleString('ko-KR')}*`,
          extension: 'md'
        };

      case 'html':
        return {
          content: `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${post.title}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .meta { color: #666; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
        .content { line-height: 1.6; }
    </style>
</head>
<body>
    <h1>${post.title}</h1>
    <div class="meta">
        <p><strong>작성자:</strong> ${post.author}</p>
        <p><strong>날짜:</strong> ${post.date}</p>
        <p><strong>상태:</strong> ${getStatusText(post.status)}</p>
        <p><strong>타입:</strong> ${getTypeText(post.type)}</p>
        <p><strong>슬러그:</strong> ${post.slug || 'N/A'}</p>
    </div>
    ${cleanExcerpt ? `<div class="excerpt"><h2>요약</h2><p>${cleanExcerpt}</p></div>` : ''}
    <div class="content">
        <h2>내용</h2>
        ${post.content || '<p>내용 없음</p>'}
    </div>
    <hr>
    <p><em>WordPress에서 동기화됨 - ${new Date().toLocaleString('ko-KR')}</em></p>
</body>
</html>`,
          extension: 'html'
        };

      case 'txt':
        const textContent = post.content ? post.content.replace(/<[^>]*>/g, '').replace(/\n\s*\n/g, '\n\n').trim() : '내용 없음';
        return {
          content: `${post.title}
${'='.repeat(post.title.length)}

작성자: ${post.author}
날짜: ${post.date}
상태: ${getStatusText(post.status)}
타입: ${getTypeText(post.type)}
슬러그: ${post.slug || 'N/A'}

요약:
${cleanExcerpt || '요약 없음'}

내용:
${textContent}

---
WordPress에서 동기화됨 - ${new Date().toLocaleString('ko-KR')}`,
          extension: 'txt'
        };

      case 'json':
        return {
          content: JSON.stringify({
            id: post.id,
            title: post.title,
            slug: post.slug,
            author: post.author,
            date: post.date,
            status: post.status,
            type: post.type,
            excerpt: cleanExcerpt,
            content: post.content,
            exported_at: new Date().toISOString(),
            exported_from: 'EGDesk WordPress Connector'
          }, null, 2),
          extension: 'json'
        };

      default:
        return { content: '', extension: 'txt' };
    }
  };

  // Keep the old function for backward compatibility
  const convertPostToMarkdown = (post: WordPressPost): string => {
    return convertPostToFormat(post, 'markdown').content;
  };

  const generateWordPressXML = (posts: WordPressPost[], site: WordPressSite): string => {
    const siteUrl = site.url || 'http://localhost';
    const siteName = site.name || 'EGDesk Export';
    
    const postsXML = posts.map(post => `
  <item>
    <title><![CDATA[${post.title}]]></title>
    <link><![CDATA[${siteUrl}/${post.slug || post.id}]]></link>
    <pubDate>${new Date(post.date).toUTCString()}</pubDate>
    <dc:creator><![CDATA[${post.author}]]></dc:creator>
    <guid isPermaLink="false">${siteUrl}/?p=${post.id}</guid>
    <description></description>
    <content:encoded><![CDATA[${post.content || ''}]]></content:encoded>
    <excerpt:encoded><![CDATA[${post.excerpt || ''}]]></excerpt:encoded>
    <wp:post_id>${post.id}</wp:post_id>
    <wp:post_date><![CDATA[${post.date}]]></wp:post_date>
    <wp:post_date_gmt><![CDATA[${new Date(post.date).toISOString()}]]></wp:post_date_gmt>
    <wp:comment_status><![CDATA[open]]></wp:comment_status>
    <wp:ping_status><![CDATA[open]]></wp:ping_status>
    <wp:post_name><![CDATA[${post.slug || post.id}]]></wp:post_name>
    <wp:status><![CDATA[${post.status}]]></wp:status>
    <wp:post_parent>0</wp:post_parent>
    <wp:menu_order>0</wp:menu_order>
    <wp:post_type><![CDATA[${post.type}]]></wp:post_type>
    <wp:post_password><![CDATA[]]></wp:post_password>
    <wp:is_sticky>0</wp:is_sticky>
  </item>`).join('\n');

    return `<?xml version="1.0" encoding="UTF-8" ?>
<!-- This is a WordPress eXtended RSS file generated by EGDesk as an export of your WordPress site. -->
<!-- It contains information about your site's posts, pages, comments, categories, and other WordPress content. -->
<!-- You can use this file to transfer posts and pages between WordPress sites. -->

<rss version="2.0"
  xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:wfw="http://wellformedweb.org/CommentAPI/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:wp="http://wordpress.org/export/1.2/">

<channel>
  <title><![CDATA[${siteName}]]></title>
  <link><![CDATA[${siteUrl}]]></link>
  <description><![CDATA[WordPress content exported via EGDesk]]></description>
  <pubDate>${new Date().toUTCString()}</pubDate>
  <language>ko-KR</language>
  <wp:wxr_version>1.2</wp:wxr_version>
  <wp:base_site_url><![CDATA[${siteUrl}]]></wp:base_site_url>
  <wp:base_blog_url><![CDATA[${siteUrl}]]></wp:base_blog_url>

  <!-- Export created by EGDesk WordPress Connector -->
  <!-- Export date: ${new Date().toLocaleString('ko-KR')} -->
  <!-- Total posts: ${posts.length} -->
${postsXML}

</channel>
</rss>`;
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'published': return '발행됨';
      case 'draft': return '임시저장';
      case 'pending': return '검토 대기';
      default: return status;
    }
  };

  const getTypeText = (type: string): string => {
    switch (type) {
      case 'post': return '포스트';
      case 'page': return '페이지';
      default: return type;
    }
  };

  const handleSiteSelect = async (site: WordPressSite) => {
    setSelectedSite(site);
    await loadSiteContent(site);
    setActiveTab('posts');
  };

  return (
    <div className="wordpress-connector">
      <div className="connector-header">
        <h1>🌐 WordPress 커넥터</h1>
        <p>WordPress 사이트에 연결하고 콘텐츠를 관리하세요</p>
      </div>

      <div className="connector-content">
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
              <label htmlFor="url">WordPress 사이트 URL *</label>
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
              ❌ {connectionError}
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
            <h2>저장된 연결</h2>
            <div className="connections-grid">
              {connections.map((connection) => (
                <div
                  key={connection.id}
                  className={`connection-card ${selectedSite?.id === connection.id ? 'selected' : ''}`}
                  onClick={() => handleSiteSelect(connection)}
                >
                  <div className="connection-header">
                    <h3>{connection.name}</h3>
                    <button
                      className="disconnect-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        disconnectSite(connection.id!);
                      }}
                    >
                      ❌
                    </button>
                  </div>
                  <p className="connection-url">{connection.url}</p>
                  <div className="connection-stats">
                    <span>📝 {connection.posts_count || 0} 포스트</span>
                    <span>📄 {connection.pages_count || 0} 페이지</span>
                    <span>🖼️ {connection.media_count || 0} 미디어</span>
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

        {/* Site Content Tabs */}
        {selectedSite && (
          <div className="site-content">
            <div className="content-tabs">
              <button
                className={`tab-btn ${activeTab === 'posts' ? 'active' : ''}`}
                onClick={() => setActiveTab('posts')}
              >
                📝 포스트 ({selectedSite.posts_count || 0})
              </button>
              <button
                className={`tab-btn ${activeTab === 'media' ? 'active' : ''}`}
                onClick={() => setActiveTab('media')}
              >
                🖼️ 미디어 ({selectedSite.media_count || 0})
              </button>
              <button
                className={`tab-btn ${activeTab === 'sync' ? 'active' : ''}`}
                onClick={() => setActiveTab('sync')}
              >
                💾 동기화
              </button>
              <button
                className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => setActiveTab('settings')}
              >
                ⚙️ 설정
              </button>
            </div>

            {/* Posts Tab */}
            {activeTab === 'posts' && (
              <div className="posts-tab">
                <h3>포스트 목록</h3>
                <div className="posts-list">
                  {posts.map((post) => (
                    <div key={post.id} className="post-item">
                      <h4>{post.title}</h4>
                      <p className="post-excerpt">{post.excerpt}</p>
                      <div className="post-meta">
                        <span>👤 {post.author}</span>
                        <span>📅 {post.date}</span>
                        <span>📊 {getStatusText(post.status)}</span>
                        <span>🏷️ {getTypeText(post.type)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Media Tab */}
            {activeTab === 'media' && (
              <div className="media-tab">
                <h3>미디어 목록</h3>
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
                        <span>📅 {item.date}</span>
                        <span>🏷️ {item.type}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sync Tab */}
            {activeTab === 'sync' && (
              <div className="sync-tab">
                <h3>로컬 동기화</h3>
                
                {/* Quick Navigation Button */}
                {selectedSite?.local_sync_path && (
                  <div className="quick-navigation">
                    <h4>🚀 빠른 이동</h4>
                    <button
                      className="go-to-synced-folder-btn"
                      onClick={async () => {
                        try {
                          // First navigate to the Finder UI
                          navigate('/');
                          
                          // Wait a bit for the component to mount
                          await new Promise(resolve => setTimeout(resolve, 100));
                          
                          // Then trigger the folder navigation
                          await (window.electron.wordpress as any).navigateToSyncedFolder({
                            syncPath: selectedSite.local_sync_path!,
                            connectionName: selectedSite.name || selectedSite.url
                          });
                          
                          // Show success message
                          alert(`동기화된 폴더로 이동합니다: ${selectedSite.local_sync_path}`);
                        } catch (error) {
                          console.error('Failed to navigate to synced folder:', error);
                          alert('폴더로 이동할 수 없습니다.');
                        }
                      }}
                      title={`동기화된 폴더로 이동: ${selectedSite.local_sync_path}`}
                    >
                      📁 동기화된 폴더로 이동
                    </button>
                    <p className="quick-nav-help">
                      💡 이 버튼을 클릭하면 Finder UI에서 동기화된 폴더로 바로 이동할 수 있습니다.
                    </p>
                  </div>
                )}

                <div className="sync-form">
                  <div className="form-group">
                    <label htmlFor="exportFormat">내보내기 형식</label>
                    <select
                      id="exportFormat"
                      value={exportFormat}
                      onChange={(e) => setExportFormat(e.target.value as 'markdown' | 'html' | 'txt' | 'json' | 'wordpress')}
                      className="format-select"
                    >
                      <option value="wordpress">🚀 WordPress XML (.xml) - 로컬 개발/테스트용 (권장)</option>
                      <option value="html">🌐 HTML (.html) - 원본 포맷 유지</option>
                      <option value="markdown">📝 Markdown (.md) - 읽기 쉬운 형식</option>
                      <option value="txt">📄 Plain Text (.txt) - 순수 텍스트</option>
                      <option value="json">🔧 JSON (.json) - 데이터 형식</option>
                    </select>
                    <small className="form-help">
                      {exportFormat === 'wordpress' && '🚀 WordPress 표준 XML 형식 - 로컬 WordPress에서 가져오기 가능 (권장)'}
                      {exportFormat === 'html' && '💡 WordPress의 원본 HTML 형식을 그대로 유지'}
                      {exportFormat === 'markdown' && '💡 읽기 쉽고 편집하기 좋은 마크다운 형식'}
                      {exportFormat === 'txt' && '💡 모든 형식을 제거한 순수 텍스트'}
                      {exportFormat === 'json' && '💡 개발자용 구조화된 데이터 형식'}
                    </small>
                  </div>
                  <div className="form-group">
                    <label htmlFor="localPath">로컬 동기화 경로</label>
                    <div className="path-input-group">
                      <input
                        type="text"
                        id="localPath"
                        value={localSyncPath}
                        onChange={(e) => setLocalSyncPath(e.target.value)}
                        placeholder="/Users/username/Documents/WordPress"
                      />
                      <button
                        type="button"
                        className="folder-picker-btn"
                        onClick={async () => {
                          try {
                            const result = await window.electron.fileSystem.pickFolder();
                            if (result.success && result.folderPath) {
                              setLocalSyncPath(result.folderPath);
                            }
                          } catch (error) {
                            console.error('Failed to pick folder:', error);
                          }
                        }}
                        title="폴더 선택 (새 폴더 생성 가능)"
                      >
                        📁
                      </button>
                      <button
                        type="button"
                        className="new-folder-btn"
                        onClick={async () => {
                          try {
                            // First pick the parent directory
                            const result = await window.electron.fileSystem.pickFolder();
                            if (result.success && result.folderPath) {
                              // Prompt user for new folder name
                              const folderName = prompt('새 폴더 이름을 입력하세요:', 'WordPress-Sync');
                              if (folderName && folderName.trim()) {
                                const newFolderPath = `${result.folderPath}/${folderName.trim()}`;
                                
                                // Create the new folder
                                const createResult = await window.electron.fileSystem.createFolder(newFolderPath);
                                if (createResult.success) {
                                  setLocalSyncPath(newFolderPath);
                                  alert(`새 폴더가 생성되었습니다: ${newFolderPath}`);
                                } else {
                                  alert(`폴더 생성 실패: ${createResult.error}`);
                                }
                              }
                            }
                          } catch (error) {
                            console.error('Failed to create new folder:', error);
                            alert('새 폴더 생성 중 오류가 발생했습니다.');
                          }
                        }}
                        title="새 폴더 생성"
                      >
                        ➕
                      </button>
                    </div>
                    <small className="form-help">
                      📁 버튼: 기존 폴더 선택 (새 폴더 생성 가능) | ➕ 버튼: 새 폴더 생성
                    </small>
                  </div>
                  <button
                    className="sync-btn"
                    onClick={() => syncWordPressToLocal(selectedSite, localSyncPath)}
                    disabled={syncStatus.isSyncing || !localSyncPath.trim()}
                  >
                    {syncStatus.isSyncing ? '동기화 중...' : '동기화 시작'}
                  </button>
                </div>

                {syncStatus.isSyncing && (
                  <div className="sync-progress">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${syncStatus.progress}%` }}
                      ></div>
                    </div>
                    <p>진행률: {syncStatus.progress.toFixed(1)}%</p>
                    <p>현재 파일: {syncStatus.currentFile}</p>
                    <p>동기화된 파일: {syncStatus.syncedFiles} / {syncStatus.totalFiles}</p>
                  </div>
                )}

                {syncStatus.errors.length > 0 && (
                  <div className="sync-errors">
                    <h4>동기화 오류:</h4>
                    <ul>
                      {syncStatus.errors.map((error, index) => (
                        <li key={index}>❌ {error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {syncStatus.progress === 100 && !syncStatus.isSyncing && (
                  <div className="sync-success">
                    <h4>✅ 동기화 완료!</h4>
                    <p>{syncStatus.syncedFiles}개 파일이 성공적으로 동기화되었습니다.</p>
                  </div>
                )}

                {/* Sync History */}
                {syncHistory.length > 0 && (
                  <div className="sync-history">
                    <h3>동기화 기록</h3>
                    <div className="history-list">
                      {syncHistory.map((record) => (
                        <div key={record.id} className={`history-item ${record.status}`}>
                          <div className="history-header">
                            <h4>
                              {record.status === 'completed' ? '✅' : 
                               record.status === 'failed' ? '❌' : '⏳'} 
                              {record.connectionName} 동기화
                            </h4>
                            <span className="history-date">
                              {new Date(record.startedAt).toLocaleString('ko-KR')}
                            </span>
                          </div>
                          
                          <div className="history-details">
                            <p><strong>동기화 경로:</strong> {record.syncPath}</p>
                            <p><strong>상태:</strong> 
                              {record.status === 'completed' ? '완료' : 
                               record.status === 'failed' ? '실패' : '진행 중'}
                            </p>
                            <p><strong>파일:</strong> {record.syncedFiles}/{record.totalFiles}개</p>
                            
                            {record.completedAt && (
                              <p><strong>완료 시간:</strong> {new Date(record.completedAt).toLocaleString('ko-KR')}</p>
                            )}
                          </div>

                          {record.fileDetails.length > 0 && (
                            <div className="file-details">
                              <h5>동기화된 파일 목록:</h5>
                              <div className="files-list">
                                {record.fileDetails.map((file, index) => (
                                  <div key={index} className={`file-item ${file.status}`}>
                                    <span className="file-icon">
                                      {file.type === 'post' ? '📝' : '🖼️'}
                                    </span>
                                    <span className="file-name">{file.name}</span>
                                    <span className="file-status">
                                      {file.status === 'synced' ? '✅' : 
                                       file.status === 'failed' ? '❌' : '⏭️'}
                                    </span>
                                    <span className="file-path">{file.localPath}</span>
                                    <span className="file-time">
                                      {new Date(file.syncedAt).toLocaleTimeString('ko-KR')}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {record.errors.length > 0 && (
                            <div className="history-errors">
                              <h5>오류:</h5>
                              <ul>
                                {record.errors.map((error, index) => (
                                  <li key={index}>❌ {error}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="settings-tab">
                <h3>연결 설정</h3>
                <div className="settings-form">
                  <div className="form-group">
                    <label htmlFor="siteName">사이트 이름</label>
                    <input
                      type="text"
                      id="siteName"
                      value={selectedSite.name || ''}
                      onChange={async (e) => {
                        const updatedSite = { ...selectedSite, name: e.target.value };
                        await window.electron.wordpress.updateConnection(selectedSite.id!, { name: e.target.value });
                        setSelectedSite(updatedSite);
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="siteUrl">사이트 URL</label>
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
        )}
      </div>
    </div>
  );
};

export default WordPressConnector;
