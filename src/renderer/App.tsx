import { MemoryRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useState, useEffect, useCallback, useMemo } from 'react';
import WordPressConnector from './components/WordPressConnector';
import LocalServer from './components/LocalServer';
import CodeEditor from './components/CodeEditor';
import { AIKeysManager } from './components/AIKeysManager';
import { ChatInterface } from './components/ChatInterface';
import { AIEditor } from './components/AIEditor';
import { DualScreenDemo } from './components/DualScreenEditor/DualScreenDemo';
import { CodespaceVectorAnalysis } from './components/AIEditor/CodespaceVectorAnalysis';
import SearchReplaceDemo from './components/SearchReplaceDemo';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolder, faLink, faFile, faCode, faStar, faDesktop, faDownload, faImage, faMusic, faVideo, faRocket, faGlobe, faServer, faRobot, faSearch, faRefresh, faHome, faTimes, faComments } from '@fortawesome/free-solid-svg-icons';
import './App.css';

interface FileSystemItem {
  name: string;
  type: 'folder' | 'file';
  path: string;
  isDirectory: boolean;
  isFile: boolean;
  isHidden: boolean;
  isSymlink: boolean;
}

import { IconDefinition } from '@fortawesome/fontawesome-svg-core';

interface SystemDirectory {
  name: string;
  path: string;
  icon: string;
}

function FinderUI() {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [fileItems, setFileItems] = useState<FileSystemItem[]>([]);
  const [systemDirectories, setSystemDirectories] = useState<SystemDirectory[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size' | 'type'>('name');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Debug: Monitor fileItems state changes
  useEffect(() => {
    console.log('fileItems state changed:', fileItems);
    console.log('fileItems length:', fileItems.length);
    console.log('fileItems content:', fileItems);
    
    // Force re-render when fileItems changes
    if (fileItems.length > 0) {
      console.log('Forcing re-render with', fileItems.length, 'items');
    }
  }, [fileItems]);

  // Debug: Monitor currentPath state changes
  useEffect(() => {
    console.log('currentPath state changed:', currentPath);
  }, [currentPath]);

  // Debug: Monitor render cycle (removed dependency array to prevent infinite renders)
  // useEffect(() => {
  //   console.log('FinderUI component rendered with:', {
  //     fileItemsLength: fileItems.length,
  //     currentPath,
  //     isLoading,
  //     error
  //   });
  // });

  // Initialize with home directory (only run once on mount)
  useEffect(() => {
    const initializeFileSystem = async () => {
      try {
        const homeDir = await window.electron.fileSystem.getHomeDirectory();
        const sysDirs = await window.electron.fileSystem.getSystemDirectories();
        
        setSystemDirectories(sysDirs);
        setCurrentPath(homeDir);
        await loadDirectory(homeDir);
      } catch (error) {
        console.error('Failed to initialize file system:', error);
        setError('파일 시스템을 초기화할 수 없습니다.');
      }
    };

    initializeFileSystem();
  }, []); // Empty dependency array to run only once

  // Separate useEffect for sync completion listener
  useEffect(() => {
    // Listen for sync completion notifications
    const handleSyncCompleted = (syncData: any) => {
      console.log('Sync completed, refreshing Finder UI:', syncData);
      // If the current path is the same as the sync path, refresh the directory
      if (currentPath === syncData.syncPath || currentPath.startsWith(syncData.syncPath)) {
        loadDirectory(currentPath);
      }
    };

    // Listen for navigation requests to synced folders
    const handleNavigateToSyncedFolder = (navigationData: any) => {
      console.log('Navigation request to synced folder:', navigationData);
      // Navigate to the synced folder
      loadDirectory(navigationData.syncPath);
    };

    // Add event listeners
    window.electron.ipcRenderer.on('sync-completed', handleSyncCompleted);
    window.electron.ipcRenderer.on('navigate-to-synced-folder', handleNavigateToSyncedFolder);

    // Cleanup event listeners
    return () => {
      // Note: In a real implementation, you'd want to properly remove the event listener
      // For now, we'll rely on the component unmounting to clean up
    };
  }, [currentPath]);

  const loadDirectory = useCallback(async (path: string) => {
    // Prevent loading the same directory multiple times
    if (currentPath === path && !isLoading) {
      console.log(`Directory ${path} already loaded, skipping`);
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      console.log(`Loading directory: ${path}`);
      const result = await window.electron.fileSystem.readDirectory(path);
      
      if (result.success && result.items) {
        console.log(`Received ${result.items.length} items from main process`);
        
        // Validate the data structure
        if (!Array.isArray(result.items)) {
          console.error('Items is not an array:', typeof result.items);
          setError('잘못된 데이터 형식입니다.');
          return;
        }
        
        // Check if items have required properties
        const validItems = result.items.filter(item => {
          if (!item.name || !item.path) {
            console.error('Invalid item:', item);
            return false;
          }
          return true;
        });
        
        console.log(`Valid items: ${validItems.length}`);
        
        // Batch state updates to prevent multiple renders
        setFileItems(validItems);
        setCurrentPath(path);
        
        console.log('State update completed. Current fileItems length should be:', validItems.length);
      } else {
        console.error('Failed to load directory:', result);
        setError(result.error || '폴더를 읽을 수 없습니다.');
        setFileItems([]);
      }
    } catch (error) {
      console.error('Error loading directory:', error);
      setError('폴더를 로드하는 중 오류가 발생했습니다.');
      setFileItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentPath, isLoading]);

  const handleFileSelect = useCallback((filePath: string, isMultiSelect: boolean) => {
    if (isMultiSelect) {
      setSelectedFiles(prev => 
        prev.includes(filePath) 
          ? prev.filter(f => f !== filePath)
          : [...prev, filePath]
      );
    } else {
      setSelectedFiles([filePath]);
    }
  }, []);

  const handleFileDoubleClick = useCallback(async (item: FileSystemItem) => {
    if (item.isDirectory) {
      await loadDirectory(item.path);
    } else {
      // 파일 열기 (시스템 기본 앱으로)
      console.log('Opening file:', item.path);
    }
  }, [loadDirectory]);

  const navigateToParent = useCallback(async () => {
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
    await loadDirectory(parentPath);
  }, [currentPath, loadDirectory]);

  const navigateToHome = useCallback(async () => {
    const homeDir = await window.electron.fileSystem.getHomeDirectory();
    await loadDirectory(homeDir);
  }, [loadDirectory]);

  const getSystemDirectoryIcon = (iconName: string) => {
    switch (iconName) {
      case 'desktop': return faDesktop;
      case 'folder': return faFolder;
      case 'download': return faDownload;
      case 'image': return faImage;
      case 'music': return faMusic;
      case 'video': return faVideo;
      case 'rocket': return faRocket;
      default: return faFolder;
    }
  };

  const getFileIcon = (item: FileSystemItem) => {
    if (item.isDirectory) return faFolder;
    if (item.isSymlink) return faLink;
    
    const ext = item.name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return faFile;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif': return faFile;
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx': return faCode;
      case 'md': return faFile;
      case 'txt': return faFile;
      case 'mp4':
      case 'avi':
      case 'mov': return faFile;
      case 'mp3':
      case 'wav':
      case 'flac': return faFile;
      default: return faFile;
    }
  };

  const getFileSize = (item: FileSystemItem) => {
    if (item.isDirectory) return '--';
    // 실제 파일 크기는 나중에 구현
    return '--';
  };

  const getFileDate = (item: FileSystemItem) => {
    // 실제 파일 날짜는 나중에 구현
    return '--';
  };

  const getFileType = (item: FileSystemItem) => {
    if (item.isDirectory) return '폴더';
    if (item.isSymlink) return '바로가기';
    
    const ext = item.name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return 'PDF 문서';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif': return '이미지';
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx': return 'JavaScript';
      case 'md': return '마크다운';
      case 'txt': return '텍스트';
      case 'mp4':
      case 'avi':
      case 'mov': return '비디오';
      case 'mp3':
      case 'wav':
      case 'flac': return '오디오';
      default: return '파일';
    }
  };

  const pathParts = useMemo(() => {
    const parts = currentPath.split('/').filter(Boolean);
    return parts.map((part, index) => ({
      name: part,
      path: '/' + parts.slice(0, index + 1).join('/')
    }));
  }, [currentPath]);

  return (
    <div className="finder-container">
      {/* Toolbar */}
      <div className="finder-toolbar">
        <div className="toolbar-left">
          <button className="toolbar-btn" onClick={navigateToParent} disabled={currentPath === '/'}>
            ←
          </button>
          <button className="toolbar-btn" onClick={navigateToHome}>
            <FontAwesomeIcon icon={faHome} />
          </button>
          <button className="toolbar-btn" onClick={() => loadDirectory(currentPath)} title="새로고침">
            <FontAwesomeIcon icon={faRefresh} />
          </button>
          <div className="path-breadcrumb">
            {pathParts.map((part, index) => (
              <span 
                key={index}
                onClick={() => loadDirectory(part.path)}
                className="breadcrumb-item"
              >
                {part.name}
              </span>
            ))}
          </div>
        </div>
        <div className="toolbar-right">
          <button 
            className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
          >
            ⊞
          </button>
          <button 
            className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
          >
            ☰
          </button>
        </div>
      </div>

      <div className="finder-content">
        {/* Sidebar */}
        <div className="finder-sidebar">
          <div className="sidebar-section">
            <div className="sidebar-section-header">
              <span className="sidebar-icon"><FontAwesomeIcon icon={faStar} /></span>
              <span className="sidebar-title">즐겨찾기</span>
            </div>
            <ul className="sidebar-items">
              {systemDirectories.map((dir, index) => (
                <li 
                  key={index} 
                  className="sidebar-item"
                  onClick={() => loadDirectory(dir.path)}
                >
                  <span className="sidebar-icon"><FontAwesomeIcon icon={getSystemDirectoryIcon(dir.icon)} /></span>
                  <span>{dir.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="finder-main">
          {/* File List Header */}
          <div className="file-list-header">
            <div className="header-cell" onClick={() => setSortBy('name')}>
              이름 {sortBy === 'name' && '↓'}
            </div>
            <div className="header-cell" onClick={() => setSortBy('date')}>
              수정된 날짜 {sortBy === 'date' && '↓'}
            </div>
            <div className="header-cell" onClick={() => setSortBy('size')}>
              크기 {sortBy === 'size' && '↓'}
            </div>
            <div className="header-cell" onClick={() => setSortBy('type')}>
              종류 {sortBy === 'type' && '↓'}
            </div>
          </div>

          {/* File List */}
          <div className={`file-list ${viewMode}`}>
            {isLoading ? (
              <div className="loading-indicator">
                <div className="spinner"></div>
                <p>폴더를 로드하는 중...</p>
              </div>
            ) : error ? (
              <div className="error-indicator">
                <p><FontAwesomeIcon icon={faTimes} /> {error}</p>
              </div>
            ) : fileItems.length === 0 ? (
              <div className="empty-indicator">
                <p><FontAwesomeIcon icon={faFolder} /> 이 폴더는 비어있습니다</p>
              </div>
            ) : (
              fileItems.map((item, index) => (
                <div
                  key={`${item.path}-${index}`}
                  className={`file-item ${selectedFiles.includes(item.path) ? 'selected' : ''} ${item.isHidden ? 'hidden' : ''}`}
                  onClick={(e) => handleFileSelect(item.path, e.metaKey || e.ctrlKey)}
                  onDoubleClick={() => handleFileDoubleClick(item)}
                >
                  <div className="file-icon"><FontAwesomeIcon icon={getFileIcon(item)} /></div>
                  <div className="file-name">{item.name}</div>
                  {viewMode === 'list' && (
                    <>
                      <div className="file-date">{getFileDate(item)}</div>
                      <div className="file-size">{getFileSize(item)}</div>
                      <div className="file-type">{getFileType(item)}</div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="finder-statusbar">
        <span>{selectedFiles.length}개 항목 선택됨</span>
        <span>{fileItems.length}개 항목</span>
        <span>{currentPath}</span>
      </div>
    </div>
  );
}

function NavigationBar() {
  const location = useLocation();
  
  return (
    <div className="navigation-bar">
      <nav className="nav-links">
        <Link 
          to="/" 
          className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faFolder} /> 파인더
        </Link>
        <Link 
          to="/wordpress" 
          className={`nav-link ${location.pathname === '/wordpress' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faGlobe} /> WordPress
        </Link>
        <Link 
          to="/local-server" 
          className={`nav-link ${location.pathname === '/local-server' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faServer} /> Local Server
        </Link>
        <Link 
          to="/code-editor" 
          className={`nav-link ${location.pathname === '/code-editor' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faCode} /> Code Editor
        </Link>
        <Link 
          to="/ai-keys" 
          className={`nav-link ${location.pathname === '/ai-keys' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faRobot} /> AI Keys
        </Link>
        <Link 
          to="/chat" 
          className={`nav-link ${location.pathname === '/chat' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faComments} /> AI Chat
        </Link>
        <Link 
          to="/dual-screen" 
          className={`nav-link ${location.pathname === '/dual-screen' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faServer} /> Dual Screen
        </Link>
        <Link 
          to="/codespace-analysis" 
          className={`nav-link ${location.pathname === '/codespace-analysis' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faSearch} /> Codespace Analysis
        </Link>
        <Link 
          to="/search-replace-demo" 
          className={`nav-link ${location.pathname === '/search-replace-demo' ? 'active' : ''}`}
        >
          <FontAwesomeIcon icon={faCode} /> Search/Replace Demo
        </Link>

      </nav>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <div className="app-container">
        <NavigationBar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<FinderUI />} />
            <Route path="/wordpress" element={<WordPressConnector />} />
            <Route path="/local-server" element={<LocalServer />} />
            <Route path="/code-editor" element={<CodeEditor />} />
            <Route path="/ai-keys" element={<AIKeysManager />} />
            <Route path="/chat" element={<ChatInterface />} />
            <Route path="/dual-screen" element={<DualScreenDemo />} />
            <Route path="/codespace-analysis" element={<CodespaceVectorAnalysis />} />
            <Route path="/search-replace-demo" element={<SearchReplaceDemo />} />
    
          </Routes>
        </main>
      </div>
    </Router>
  );
}
