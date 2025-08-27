import React, { useState, useEffect, useCallback } from 'react';
import './CodeEditor.css';

interface FileSystemItem {
  name: string;
  type: 'folder' | 'file';
  path: string;
  isDirectory: boolean;
  isFile: boolean;
  isHidden: boolean;
  isSymlink: boolean;
}

interface OpenFile {
  path: string;
  name: string;
  content: string;
  isModified: boolean;
  language: string;
}

const CodeEditor: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [fileItems, setFileItems] = useState<FileSystemItem[]>([]);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState<number>(-1);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [wordWrap, setWordWrap] = useState(false);

  // Initialize with home directory
  useEffect(() => {
    const initializeFileSystem = async () => {
      try {
        const homeDir = await window.electron.fileSystem.getHomeDirectory();
        setCurrentPath(homeDir);
        await loadDirectory(homeDir);
      } catch (error) {
        console.error('Failed to initialize file system:', error);
        setError('파일 시스템을 초기화할 수 없습니다.');
      }
    };

    initializeFileSystem();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 's':
            e.preventDefault();
            if (activeFileIndex >= 0) {
              saveFile(activeFileIndex);
            }
            break;
          case 'w':
            e.preventDefault();
            if (activeFileIndex >= 0) {
              closeFile(activeFileIndex);
            }
            break;
          case 'o':
            e.preventDefault();
            selectFolder();
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeFileIndex]);

  const selectFolder = async () => {
    try {
      const result = await window.electron.fileSystem.pickFolder();
      if (result.success && result.folderPath) {
        await loadDirectory(result.folderPath);
      }
    } catch (error) {
      console.error('Error selecting folder:', error);
      setError('폴더를 선택할 수 없습니다.');
    }
  };

  const loadDirectory = useCallback(async (path: string) => {
    if (currentPath === path && !isLoading) {
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      const result = await window.electron.fileSystem.readDirectory(path);
      
      if (result.success && result.items) {
        const validItems = result.items.filter(item => {
          if (!item.name || !item.path) {
            return false;
          }
          return true;
        });
        
        setFileItems(validItems);
        setCurrentPath(path);
      } else {
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

  const handleFileClick = useCallback(async (item: FileSystemItem) => {
    if (item.isDirectory) {
      await loadDirectory(item.path);
    } else if (item.isFile) {
      await openFile(item.path, item.name);
    }
  }, [loadDirectory]);

  const openFile = async (filePath: string, fileName: string) => {
    try {
      // Check if file is already open
      const existingIndex = openFiles.findIndex(file => file.path === filePath);
      if (existingIndex >= 0) {
        setActiveFileIndex(existingIndex);
        return;
      }

      // Read file content using IPC
      const result = await window.electron.fileSystem.readFile(filePath);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to read file');
      }

      const content = result.content;
      
      // Determine language based on file extension
      const ext = fileName.split('.').pop()?.toLowerCase();
      let language = 'plaintext';
      
      if (ext === 'js' || ext === 'jsx') language = 'javascript';
      else if (ext === 'ts' || ext === 'tsx') language = 'typescript';
      else if (ext === 'html') language = 'html';
      else if (ext === 'css') language = 'css';
      else if (ext === 'php') language = 'php';
      else if (ext === 'py') language = 'python';
      else if (ext === 'java') language = 'java';
      else if (ext === 'cpp' || ext === 'cc' || ext === 'cxx') language = 'cpp';
      else if (ext === 'c') language = 'c';
      else if (ext === 'json') language = 'json';
      else if (ext === 'xml') language = 'xml';
      else if (ext === 'md') language = 'markdown';
      else if (ext === 'sql') language = 'sql';
      else if (ext === 'sh' || ext === 'bash') language = 'bash';
      else if (ext === 'yaml' || ext === 'yml') language = 'yaml';

      const newFile: OpenFile = {
        path: filePath,
        name: fileName,
        content,
        isModified: false,
        language
      };

      setOpenFiles(prev => [...prev, newFile]);
      setActiveFileIndex(openFiles.length);
    } catch (error) {
      console.error('Error opening file:', error);
      setError('파일을 열 수 없습니다.');
    }
  };

  const closeFile = (index: number) => {
    setOpenFiles(prev => prev.filter((_, i) => i !== index));
    if (activeFileIndex === index) {
      setActiveFileIndex(prev => prev > 0 ? prev - 1 : 0);
    } else if (activeFileIndex > index) {
      setActiveFileIndex(prev => prev - 1);
    }
  };

  const updateFileContent = (index: number, content: string) => {
    setOpenFiles(prev => prev.map((file, i) => 
      i === index ? { ...file, content, isModified: true } : file
    ));
  };

  const saveFile = async (index: number) => {
    try {
      const file = openFiles[index];
      const result = await window.electron.fileSystem.writeFile(file.path, file.content);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to write file');
      }
      
      setOpenFiles(prev => prev.map((f, i) => 
        i === index ? { ...f, isModified: false } : f
      ));
    } catch (error) {
      console.error('Error saving file:', error);
      setError('파일을 저장할 수 없습니다.');
    }
  };

  const navigateToParent = async () => {
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
    await loadDirectory(parentPath);
  };

  const navigateToHome = async () => {
    const homeDir = await window.electron.fileSystem.getHomeDirectory();
    await loadDirectory(homeDir);
  };

  const getFileIcon = (item: FileSystemItem) => {
    if (item.isDirectory) return '📁';
    if (item.isSymlink) return '🔗';
    
    const ext = item.name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx': return '💻';
      case 'html': return '🌐';
      case 'css': return '🎨';
      case 'php': return '🐘';
      case 'py': return '🐍';
      case 'java': return '☕';
      case 'cpp':
      case 'cc':
      case 'cxx':
      case 'c': return '⚙️';
      case 'json': return '📋';
      case 'xml': return '📄';
      case 'md': return '📝';
      case 'sql': return '🗄️';
      case 'sh':
      case 'bash': return '💻';
      case 'yaml':
      case 'yml': return '⚙️';
      default: return '📄';
    }
  };

  const pathParts = currentPath.split('/').filter(Boolean).map((part, index) => ({
    name: part,
    path: '/' + currentPath.split('/').filter(Boolean).slice(0, index + 1).join('/')
  }));

  return (
    <div className="code-editor">
      {/* Top Toolbar */}
      <div className="editor-toolbar">
        <div className="toolbar-left">
          <button className="toolbar-btn" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
            {sidebarCollapsed ? '▶' : '◀'}
          </button>
          <button className="toolbar-btn" onClick={navigateToParent} disabled={currentPath === '/'}>
            ⬆️
          </button>
          <button className="toolbar-btn" onClick={navigateToHome}>
            🏠
          </button>
          <button className="toolbar-btn" onClick={() => loadDirectory(currentPath)} title="새로고침">
            🔄
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
          <div className="editor-settings">
            <button
              className={`toolbar-btn ${showLineNumbers ? 'active' : ''}`}
              onClick={() => setShowLineNumbers(!showLineNumbers)}
              title="줄 번호 표시/숨김"
            >
              {showLineNumbers ? '🔢' : '🔢'}
            </button>
            <button
              className={`toolbar-btn ${wordWrap ? 'active' : ''}`}
              onClick={() => setWordWrap(!wordWrap)}
              title="자동 줄바꿈"
            >
              {wordWrap ? '↩️' : '↩️'}
            </button>
          </div>
          <span className="status-text">
            {openFiles.length > 0 ? `${openFiles.length} 파일 열림` : '파일이 열려있지 않음'}
          </span>
        </div>
      </div>

      <div className="editor-content">
        {/* File Explorer Sidebar */}
        <div className={`file-explorer ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="explorer-header">
            <h3>📁 파일 탐색기</h3>
          </div>
          <div className="explorer-content">
            {isLoading ? (
              <div className="loading-indicator">
                <div className="spinner"></div>
                <p>로딩 중...</p>
              </div>
            ) : error ? (
              <div className="error-indicator">
                <p>❌ {error}</p>
              </div>
            ) : (
              <div className="file-tree">
                {fileItems.map((item, index) => (
                  <div
                    key={`${item.path}-${index}`}
                    className={`file-tree-item ${item.isDirectory ? 'folder' : 'file'}`}
                    onClick={() => handleFileClick(item)}
                  >
                    <span className="file-icon">{getFileIcon(item)}</span>
                    <span className="file-name">{item.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Editor Area */}
        <div className="main-editor">
          {/* File Tabs */}
          <div className="file-tabs">
            {openFiles.map((file, index) => (
              <div
                key={file.path}
                className={`file-tab ${index === activeFileIndex ? 'active' : ''} ${file.isModified ? 'modified' : ''}`}
                onClick={() => setActiveFileIndex(index)}
              >
                <span className="tab-name">{file.name}</span>
                <button
                  className="tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeFile(index);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* Editor Content */}
          <div className="editor-area">
            {activeFileIndex >= 0 && openFiles[activeFileIndex] ? (
              <div className="editor-container">
                <div className="editor-header">
                  <span className="file-language">{openFiles[activeFileIndex].language}</span>
                  <button
                    className="save-btn"
                    onClick={() => saveFile(activeFileIndex)}
                    disabled={!openFiles[activeFileIndex].isModified}
                  >
                    💾 저장
                  </button>
                </div>
                <div className="editor-wrapper">
                  {showLineNumbers && (
                    <div className="line-numbers">
                      {openFiles[activeFileIndex].content.split('\n').map((_, index) => (
                        <div key={index} className="line-number">
                          {index + 1}
                        </div>
                      ))}
                    </div>
                  )}
                  <textarea
                    className={`code-textarea ${wordWrap ? 'word-wrap' : ''}`}
                    value={openFiles[activeFileIndex].content}
                    onChange={(e) => updateFileContent(activeFileIndex, e.target.value)}
                    placeholder="코드를 입력하세요..."
                    spellCheck={false}
                    wrap={wordWrap ? 'soft' : 'off'}
                  />
                </div>
              </div>
            ) : (
              <div className="welcome-screen">
                <div className="welcome-content">
                  <h2>👋 코드 에디터에 오신 것을 환영합니다</h2>
                  <p>왼쪽 파일 탐색기에서 파일을 선택하여 편집을 시작하세요.</p>
                  <div className="welcome-features">
                    <div className="feature">
                      <span className="feature-icon">📁</span>
                      <span>파일 탐색기</span>
                    </div>
                    <div className="feature">
                      <span className="feature-icon">💻</span>
                      <span>코드 편집</span>
                    </div>
                    <div className="feature">
                      <span className="feature-icon">💾</span>
                      <span>자동 저장</span>
                    </div>
                    <div className="feature">
                      <span className="feature-icon">🎨</span>
                      <span>구문 강조</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="editor-statusbar">
        <div className="status-left">
          {activeFileIndex >= 0 && openFiles[activeFileIndex] && (
            <>
              <span className="status-item">
                📄 {openFiles[activeFileIndex].name}
              </span>
              <span className="status-item">
                💾 {openFiles[activeFileIndex].isModified ? '수정됨' : '저장됨'}
              </span>
              <span className="status-item">
                🎨 {openFiles[activeFileIndex].language}
              </span>
            </>
          )}
        </div>
        <div className="status-right">
          <span className="status-item">
            📁 {currentPath}
          </span>
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;
