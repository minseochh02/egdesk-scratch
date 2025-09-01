import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AIEditor } from './AIEditor';
import { AIEdit } from './AIEditor/types';
import ProjectSelector from './ProjectSelector';
import ProjectContextService, { ProjectInfo } from '../services/projectContextService';
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

const CodeEditor: React.FC<{
  isEditing?: boolean;
  onToggleEditing?: () => void;
  instanceId?: string; // Add unique instance identifier
}> = ({ isEditing = false, onToggleEditing, instanceId = 'main' }) => {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [fileItems, setFileItems] = useState<FileSystemItem[]>([]);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState<number>(-1);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [infoMessage, setInfoMessage] = useState<string>('');
  const [isOpeningBrowser, setIsOpeningBrowser] = useState(false);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [wordWrap, setWordWrap] = useState(false);
  const [showAIEditor, setShowAIEditor] = useState(false);
  const [currentProject, setCurrentProject] = useState<ProjectInfo | null>(null);
  const [projectFiles, setProjectFiles] = useState<any[]>([]);



  // Guards to prevent duplicate opens and repeated auto-open
  const openingFilesRef = useRef<Set<string>>(new Set());
  const openFilesRef = useRef<OpenFile[]>([]);
  const autoOpenStartedRef = useRef<Record<string, boolean>>({});
  const autoOpenInProgressRef = useRef<boolean>(false);

  // Keep a ref in sync with openFiles state for use in async callbacks
  useEffect(() => {
    openFilesRef.current = openFiles;
  }, [openFiles]);
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

  // Subscribe to project context changes
  useEffect(() => {
    console.log('Setting up project context subscription');
    
    // Check initial context
    const initialContext = ProjectContextService.getInstance().getContext();
    console.log('Initial project context:', initialContext);
    
    const unsubscribe = ProjectContextService.getInstance().subscribe((context) => {
      console.log('Project context update received:', context.currentProject);
      console.log('Current path before update:', currentPath);
      setCurrentProject(context.currentProject);
      
      // If current project changes, load its directory and files
      if (context.currentProject && context.currentProject.path !== currentPath) {
        console.log('Project context changed, loading:', context.currentProject.path);
        setCurrentPath(context.currentProject.path);
        loadDirectory(context.currentProject.path);
        loadProjectFiles(context.currentProject.path);
      } else if (context.currentProject) {
        console.log('Project context same path, just loading files:', context.currentProject.path);
        loadProjectFiles(context.currentProject.path);
      }
    });

    return unsubscribe;
  }, [currentPath]); // Remove loadDirectory from dependencies to avoid circular dependency

  // Load project files for AI Editor
  const loadProjectFiles = async (projectPath: string) => {
    try {
      console.log('Loading project files from:', projectPath);
      const result = await window.electron.fileSystem.readDirectory(projectPath);
      if (result.success && result.items) {
        console.log('CodeEditor: Raw items:', result.items);
        
        const fileItems = result.items.filter(item => item.isFile);
        console.log('CodeEditor: File items only:', fileItems);
        
        const files = fileItems
          .filter(item => {
            const ext = item.name.split('.').pop()?.toLowerCase();
            console.log('CodeEditor: Checking file:', item.name, 'extension:', ext);
            const isSupported = [
              // Code files
              'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'php', 'html', 'css', 
              // Config files
              'json', 'yaml', 'yml', 'toml', 'ini', 'conf',
              // Documentation
              'md', 'markdown', 'txt', 'rst',
              // Database
              'sql', 'db', 'sqlite',
              // Shell scripts
              'sh', 'bash', 'zsh', 'fish',
              // Docker
              'dockerfile', 'docker',
              // Other common files
              'xml', 'csv', 'tsv', 'log'
            ].includes(ext || 'unknown');
            console.log('CodeEditor: Is supported:', isSupported);
            return isSupported;
          })
          .map(item => ({
            path: item.path,
            name: item.name,
            type: item.name.split('.').pop() || 'unknown'
          }));
        console.log('Found project files:', files.length, files.map(f => f.name));
        setProjectFiles(files);
        
        // Auto-open some key project files if none are open (only once per project)
        console.log('🔍 Checking auto-open: openFiles.length =', openFilesRef.current.length, 'files.length =', files.length);
        if (!autoOpenStartedRef.current[projectPath] && openFilesRef.current.length === 0 && files.length > 0) {
          autoOpenStartedRef.current[projectPath] = true;
          console.log('🚀 Auto-opening project files...');
          await autoOpenProjectFiles(files);
        }
      }
    } catch (error) {
      console.error('Failed to load project files:', error);
    }
  };

  // Auto-open key project files
  const autoOpenProjectFiles = async (projectFiles: any[]) => {
    try {
      if (autoOpenInProgressRef.current) {
        console.log('⏳ autoOpen already in progress, skipping');
        return;
      }
      autoOpenInProgressRef.current = true;

      console.log('📋 autoOpenProjectFiles called with:', projectFiles.map(f => f.name));
      console.log('📋 Current openFiles state:', openFilesRef.current.map(f => f.path));
      
      // Priority order for auto-opening files
      const priorityFiles = ['package.json', 'README.md', 'index.js', 'index.ts', 'main.py', 'app.py', 'index.html'];
      
      for (const priorityFile of priorityFiles) {
        const file = projectFiles.find(f => f.name === priorityFile);
        if (file) {
          console.log('🎯 Auto-opening priority file:', file.name);
          await openFile(file.path, file.name);
          break; // Only open the first priority file found
        }
      }
      
      // If no priority files found, open the first available file
      console.log('📋 After priority check, openFiles.length =', openFilesRef.current.length);
      if (openFilesRef.current.length === 0 && projectFiles.length > 0) {
        const firstFile = projectFiles[0];
        console.log('🎯 Auto-opening first available file:', firstFile.name);
        await openFile(firstFile.path, firstFile.name);
      }
    } catch (error) {
      console.error('Failed to auto-open project files:', error);
    } finally {
      autoOpenInProgressRef.current = false;
    }
  };

  const handleFileClick = useCallback(async (item: FileSystemItem) => {
    if (item.isDirectory) {
      await loadDirectory(item.path);
    } else if (item.isFile) {
      await openFile(item.path, item.name);
    }
  }, [loadDirectory]);

  const openFile = async (filePath: string, fileName: string) => {
    try {
      console.log('🔍 openFile called:', filePath, 'Current openFiles:', openFilesRef.current.map(f => f.path));

      // Prevent concurrent opens of the same file
      if (openingFilesRef.current.has(filePath)) {
        console.log('⏳ File is already opening, skipping:', filePath);
        return;
      }
      openingFilesRef.current.add(filePath);
      
      // Check if file is already open
      const existingIndex = openFilesRef.current.findIndex(file => file.path === filePath);
      if (existingIndex >= 0) {
        console.log('✅ File already open at index:', existingIndex);
        setActiveFileIndex(existingIndex);
        openingFilesRef.current.delete(filePath);
        return;
      }

      // Read file content using IPC
      const result = await window.electron.fileSystem.readFile(filePath);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to read file');
      }

      const content = result.content || '';
      
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
      else if (ext === 'yaml' || ext === 'yml') language = 'yaml';
      else if (ext === 'md' || ext === 'markdown') language = 'markdown';
      else if (ext === 'sql') language = 'sql';
      else if (ext === 'sh' || ext === 'bash' || ext === 'zsh' || ext === 'fish') language = 'shell';
      else if (ext === 'dockerfile' || ext === 'docker') language = 'dockerfile';
      else if (ext === 'xml') language = 'xml';
      else if (ext === 'csv' || ext === 'tsv') language = 'csv';
      else if (ext === 'log') language = 'log';
      else if (ext === 'txt') language = 'text';

      const newFile: OpenFile = {
        path: filePath,
        name: fileName,
        content,
        isModified: false,
        language
      };

      console.log('📁 Adding new file to openFiles:', newFile.path);
      setOpenFiles(prev => {
        // Prevent duplicate adds even under race conditions
        const alreadyExists = prev.some(f => f.path === filePath);
        if (alreadyExists) {
          console.log('⚠️ Duplicate detected in setOpenFiles, skipping add for:', filePath);
          const idx = prev.findIndex(f => f.path === filePath);
          if (idx >= 0) setActiveFileIndex(idx);
          return prev;
        }
        const updated = [...prev, newFile];
        console.log('📁 Updated openFiles:', updated.map(f => f.path));
        setActiveFileIndex(updated.length - 1);
        return updated;
      });
    } catch (error) {
      console.error('Error opening file:', error);
      setError('파일을 열 수 없습니다.');
    } finally {
      openingFilesRef.current.delete(filePath);
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

  // Handle applying AI edits
  const handleApplyAIEdits = useCallback(async (edits: AIEdit[]) => {
    if (activeFileIndex < 0 || !openFiles[activeFileIndex]) return;

    try {
      const currentFile = openFiles[activeFileIndex];
      let newContent = currentFile.content;

      // Apply edits in reverse order to maintain correct positions
      const sortedEdits = [...edits]
        .filter(edit => edit.range && edit.newText) // Only process edits with valid range and text
        .sort((a, b) => (b.range?.start || 0) - (a.range?.start || 0));
      
      for (const edit of sortedEdits) {
        if (edit.range && edit.newText) {
          const before = newContent.substring(0, edit.range.start);
          const after = newContent.substring(edit.range.end);
          newContent = before + edit.newText + after;
        }
      }

      // Update file content
      updateFileContent(activeFileIndex, newContent);
      
      // Save the file automatically
      await saveFile(activeFileIndex);
      
      console.log('AI edits applied successfully!');
      
      // Automatically open localhost:8000 to show changes immediately
      // Add a small delay to ensure file changes are fully saved and server picks them up
      setTimeout(() => {
        openLocalhost8000();
      }, 1000); // 1 second delay
    } catch (error) {
      console.error('Failed to apply AI edits:', error);
      setError('AI 편집을 적용할 수 없습니다.');
    }
  }, [activeFileIndex, openFiles, updateFileContent, saveFile]);

  // Function to open localhost:8000 in browser
  const openLocalhost8000 = () => {
    setIsOpeningBrowser(true);
    setInfoMessage('🔄 Opening browser to show AI changes...');
    
    // Check if this is a WordPress project
    const isWordPressProject = currentProject?.type === 'wordpress' || 
                              currentProject?.metadata?.framework === 'wordpress' ||
                              currentPath.includes('wordpress') ||
                              currentPath.includes('wp-content');
    
    if (!isWordPressProject) {
      setInfoMessage('ℹ️ Not a WordPress project. Opening localhost:8000 anyway for general web development.');
    }
    
    try {
      // Check if we're in an Electron environment
      if (window.electron && window.electron.wordpressServer) {
        // Try to get server status first
        window.electron.wordpressServer.getServerStatus().then((result) => {
          if (result.success && result.status && result.status.isRunning) {
            // Server is running, open the URL
            const url = result.status.url || 'http://localhost:8000';
            window.open(url, '_blank');
            console.log(`🌐 Opened ${url} to show AI changes`);
            
            // Show success message to user
            setError(''); // Clear any previous errors
            setInfoMessage(`✅ AI changes applied! Opening ${url} to show results...`);
            
            // Clear info message after 5 seconds
            setTimeout(() => {
              setInfoMessage('');
              setIsOpeningBrowser(false);
            }, 5000);
          } else {
            // Server not running, try to start it or just open localhost:8000
            console.log('🔄 Server not running, opening localhost:8000 directly');
            window.open('http://localhost:8000', '_blank');
            
            // Show info message to user
            setInfoMessage('ℹ️ Server not running, but opened localhost:8000. Start the server to see changes.');
            
            // Clear info message after 5 seconds
            setTimeout(() => {
              setInfoMessage('');
              setIsOpeningBrowser(false);
            }, 5000);
          }
        }).catch(() => {
          // Fallback: open localhost:8000 directly
          console.log('🔄 Fallback: opening localhost:8000 directly');
          window.open('http://localhost:8000', '_blank');
          
          // Show info message to user
          setInfoMessage('ℹ️ Opened localhost:8000. Make sure your server is running to see changes.');
          
          // Clear info message after 5 seconds
          setTimeout(() => {
            setInfoMessage('');
            setIsOpeningBrowser(false);
          }, 5000);
        });
      } else {
        // Not in Electron, use regular browser open
        window.open('http://localhost:8000', '_blank');
        console.log('🌐 Opened localhost:8000 to show AI changes');
        
        // Show info message to user
        setInfoMessage('ℹ️ Opened localhost:8000 in browser. Make sure your server is running to see changes.');
        
        // Clear info message after 5 seconds
        setTimeout(() => {
          setInfoMessage('');
          setIsOpeningBrowser(false);
        }, 5000);
      }
    } catch (error) {
      console.error('Failed to open localhost:8000:', error);
      // Fallback: try to open anyway
      try {
        window.open('http://localhost:8000', '_blank');
        setInfoMessage('ℹ️ Opened localhost:8000 (fallback). Make sure your server is running to see changes.');
        
        // Clear info message after 5 seconds
        setTimeout(() => {
          setInfoMessage('');
          setIsOpeningBrowser(false);
        }, 5000);
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        setError('❌ Failed to open browser. Please manually navigate to localhost:8000 to see changes.');
        setIsOpeningBrowser(false);
      }
    }
  };

  return (
    <div className="code-editor">
      {/* Top Toolbar */}
      <div className="editor-toolbar">
        <div className="toolbar-left">
          {/* Navigation Controls */}
          <div className="toolbar-group">
            <button className="toolbar-btn" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} title="사이드바 토글">
              {sidebarCollapsed ? '▶' : '◀'}
            </button>
            <button className="toolbar-btn" onClick={navigateToParent} disabled={currentPath === '/'} title="상위 폴더">
              ⬆️
            </button>
            <button className="toolbar-btn" onClick={navigateToHome} title="홈 디렉토리">
              🏠
            </button>
            <button className="toolbar-btn" onClick={() => loadDirectory(currentPath)} title="새로고침">
              🔄
            </button>
          </div>
          
          {/* Project Selector */}
          <div className="project-selector-container">
            <ProjectSelector
              onProjectSelect={(project) => {
                console.log('Project selected from toolbar:', project.path);
                setCurrentPath(project.path);
                loadDirectory(project.path);
                loadProjectFiles(project.path);
              }}
              showCurrentProject={true}
              showRecentProjects={false}
              showAvailableProjects={false}
              className="compact"
            />
          </div>
          
          {/* Path Breadcrumb */}
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
          {/* Editor Settings */}
          <div className="editor-settings">
            <button
              className={`toolbar-btn ${showAIEditor ? 'active' : ''}`}
              onClick={() => setShowAIEditor(!showAIEditor)}
              title="AI 에디터 토글"
            >
              🤖
            </button>
            <button
              className={`toolbar-btn ${showLineNumbers ? 'active' : ''}`}
              onClick={() => setShowLineNumbers(!showLineNumbers)}
              title="줄 번호 표시/숨김"
            >
              🔢
            </button>
            <button
              className={`toolbar-btn ${wordWrap ? 'active' : ''}`}
              onClick={() => setWordWrap(!wordWrap)}
              title="자동 줄바꿈"
            >
              ↩️
            </button>
          </div>
          
          {/* File Status */}
          <div className="file-status">
            <span className="status-text">
              {openFiles.length > 0 ? `${openFiles.length} 파일 열림` : '파일이 열려있지 않음'}
            </span>
            {activeFileIndex >= 0 && openFiles[activeFileIndex] && (
              <span className="current-file-info">
                📄 {openFiles[activeFileIndex].name}
                {openFiles[activeFileIndex].isModified && <span className="modified-indicator">●</span>}
              </span>
            )}
          </div>
          
          {/* Debug Button */}
          {process.env.NODE_ENV === 'development' && (
            <button 
              className="toolbar-btn debug-btn" 
              onClick={() => {
                console.log('Current project:', currentProject);
                console.log('Project files:', projectFiles);
                console.log('Current path:', currentPath);
                console.log('Open files:', openFiles);
              }}
              title="Debug Info"
            >
              🐛
            </button>
          )}
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
            ) : infoMessage ? (
              <div className="info-indicator">
                <p>{infoMessage}</p>
              </div>
            ) : (
              <div className="file-tree">
                {fileItems.map((item, index) => (
                  <div
                    key={`${instanceId}-${item.path}-${index}`}
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
                key={`${instanceId}-${file.path}`}
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
                  <div className="file-info">
                    <span className="file-language">{openFiles[activeFileIndex].language}</span>
                    <span className="file-path">{openFiles[activeFileIndex].path}</span>
                    {openFiles[activeFileIndex].isModified && (
                      <span className="modified-status">● 수정됨</span>
                    )}
                  </div>
                  <div className="editor-actions">
                    {onToggleEditing && (
                      <button
                        className={`editor-toggle-btn ${isEditing ? 'editing' : 'server'}`}
                        onClick={onToggleEditing}
                        title={isEditing ? 'Switch to Server Mode' : 'Switch to Editing Mode'}
                      >
                        {isEditing ? '🌐 Show Server' : '✏️ Show Editor'}
                      </button>
                    )}
                    <button
                      className="save-btn"
                      onClick={() => saveFile(activeFileIndex)}
                      disabled={!openFiles[activeFileIndex].isModified}
                      title="Ctrl+S로 저장"
                    >
                      💾 저장
                    </button>
                    <span className="shortcut-hint">Ctrl+S</span>
                  </div>
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
                    <div className="feature">
                      <span className="feature-icon">🤖</span>
                      <span>AI 편집</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* AI Editor Sidebar */}
        {showAIEditor && (
          <AIEditor
            isVisible={showAIEditor}
            currentFile={activeFileIndex >= 0 ? {
              path: openFiles[activeFileIndex].path,
              name: openFiles[activeFileIndex].name,
              content: openFiles[activeFileIndex].content,
              language: openFiles[activeFileIndex].language
            } : null}
            projectContext={{
              currentProject: currentProject,
              availableFiles: projectFiles || []
            }}
            onApplyEdits={handleApplyAIEdits}
            onClose={() => setShowAIEditor(false)}
          />
        )}

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
          {currentProject && (
            <span className="status-item project-status">
              {currentProject.type === 'wordpress' ? '🐘' : 
               currentProject.type === 'node' ? '🟢' : 
               currentProject.type === 'python' ? '🐍' : 
               currentProject.type === 'java' ? '☕' : 
               currentProject.type === 'cpp' ? '⚙️' : '📁'} {currentProject.name}
            </span>
          )}
        </div>
        <div className="status-right">
          <span className="status-item">
            📁 {currentPath}
          </span>
          {showAIEditor && (
            <span className="status-item">
              🤖 AI 편집기 활성화
            </span>
          )}
          {isOpeningBrowser && (
            <span className="status-item">
              🌐 브라우저 열는 중...
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;
