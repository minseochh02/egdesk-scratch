import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFile, faCode, faTimes, faEdit, faGlobe, faHashtag } from '@fortawesome/free-solid-svg-icons';
import './URLFileViewer.css';

interface OpenFile {
  path: string;
  name: string;
  content: string;
  isModified: boolean;
  language: string;
}

interface URLFileViewerProps {
  filesToOpen: string[];
  instanceId?: string;
}

export const URLFileViewer: React.FC<URLFileViewerProps> = ({ 
  filesToOpen, 
  instanceId = 'url-viewer' 
}) => {
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState<number>(0);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [wordWrap, setWordWrap] = useState(false);
  const openingFilesRef = useRef<Set<string>>(new Set());

  // Effect to open files when filesToOpen prop changes
  useEffect(() => {
    if (filesToOpen && filesToOpen.length > 0) {
      console.log(`🔄 URLFileViewer: Opening files for ${instanceId}:`, filesToOpen);
      openFilesBatch(filesToOpen);
    }
  }, [filesToOpen, instanceId]);

  const openFilesBatch = async (filePaths: string[]) => {
    setIsLoading(true);
    const newFiles: OpenFile[] = [];
    
    // Clear any files that are no longer in the list
    setOpenFiles(prev => prev.filter(file => filePaths.includes(file.path)));
    
    for (const filePath of filePaths) {
      if (openingFilesRef.current.has(filePath)) {
        console.log(`⏳ File already opening, skipping: ${filePath}`);
        continue;
      }
      
      try {
        openingFilesRef.current.add(filePath);
        const file = await openFile(filePath);
        if (file) {
          newFiles.push(file);
        }
      } catch (error) {
        console.error(`Failed to open file ${filePath}:`, error);
      } finally {
        openingFilesRef.current.delete(filePath);
      }
    }
    
    if (newFiles.length > 0) {
      setOpenFiles(prev => {
        const existingPaths = new Set(prev.map(f => f.path));
        const uniqueNewFiles = newFiles.filter(f => !existingPaths.has(f.path));
        return [...prev, ...uniqueNewFiles];
      });
    }
    
    setIsLoading(false);
  };

  const openFile = async (filePath: string): Promise<OpenFile | null> => {
    try {
      console.log(`🔍 URLFileViewer: Opening file: ${filePath}`);
      
      const fileName = filePath.split('/').pop() || filePath;
      const fileResult = await window.electron.fileSystem.readFile(filePath);
      
      // Handle the response structure from electron fileSystem
      const fileContent = fileResult.success ? fileResult.content : '';
      
      if (!fileResult.success) {
        console.error(`❌ URLFileViewer: Failed to read file ${filePath}:`, fileResult.error);
        return null;
      }
      
      const language = getLanguageFromExtension(fileName);
      
      const newFile: OpenFile = {
        path: filePath,
        name: fileName,
        content: fileContent,
        isModified: false,
        language
      };
      
      console.log(`✅ URLFileViewer: Successfully opened: ${fileName}`);
      return newFile;
    } catch (error) {
      console.error(`❌ URLFileViewer: Failed to open file ${filePath}:`, error);
      return null;
    }
  };

  const getLanguageFromExtension = (fileName: string): string => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    const languageMap: { [key: string]: string } = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'php': 'php',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'json': 'json',
      'md': 'markdown',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust',
      'rb': 'ruby',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml'
    };
    return languageMap[extension || ''] || 'plaintext';
  };

  const closeFile = (filePath: string) => {
    setOpenFiles(prev => {
      const newFiles = prev.filter(file => file.path !== filePath);
      if (activeFileIndex >= newFiles.length && newFiles.length > 0) {
        setActiveFileIndex(newFiles.length - 1);
      }
      return newFiles;
    });
  };



  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (['php', 'html', 'css', 'js', 'ts', 'jsx', 'tsx'].includes(extension || '')) {
      return faCode;
    }
    return faFile;
  };

  const generateLineNumbers = (content: string) => {
    const lines = content.split('\n');
    return lines.map((_, index) => index + 1);
  };

  const renderWelcomeScreen = () => (
    <div className="welcome-screen">
      <div className="welcome-content">
        <h2>Route File Viewer</h2>
        <p>Files related to the current page route will appear here when you navigate the website.</p>
      </div>
    </div>
  );

  const renderFileContent = () => {
    if (openFiles.length === 0) {
      return renderWelcomeScreen();
    }

    const activeFile = openFiles[activeFileIndex];
    if (!activeFile) return renderWelcomeScreen();

    const lineNumbers = generateLineNumbers(activeFile.content);

    return (
      <div className="editor-wrapper">
        {showLineNumbers && (
          <div className="line-numbers">
            {lineNumbers.map((lineNum) => (
              <div key={lineNum} className="line-number">
                {lineNum}
              </div>
            ))}
          </div>
        )}
        <textarea
          className={`code-textarea ${wordWrap ? 'word-wrap' : ''}`}
          value={activeFile.content}
          readOnly
          spellCheck={false}
        />
      </div>
    );
  };

  return (
    <div className="url-file-viewer">
      {/* Toolbar */}
      <div className="url-toolbar">
        <div className="toolbar-left">
          <div className="toolbar-group">
            <button
              className={`toolbar-btn ${showLineNumbers ? 'active' : ''}`}
              onClick={() => setShowLineNumbers(!showLineNumbers)}
              title="Toggle Line Numbers"
            >
              <FontAwesomeIcon icon={faHashtag} />
            </button>
            <button
              className={`toolbar-btn ${wordWrap ? 'active' : ''}`}
              onClick={() => setWordWrap(!wordWrap)}
              title="Toggle Word Wrap"
            >
              <FontAwesomeIcon icon={faEdit} />
            </button>
          </div>
        </div>
        <div className="toolbar-right">
          <div className="toolbar-group">
            <span style={{ fontSize: '12px', color: 'var(--muted-text, #888888)' }}>
              Route Files ({openFiles.length})
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="url-content">
        {/* Main Editor Area */}
        <div className="url-main-editor">
          {/* File Tabs */}
          {openFiles.length > 0 && (
            <div className="file-tabs">
              {openFiles.map((file, index) => (
                <div
                  key={file.path}
                  className={`file-tab ${index === activeFileIndex ? 'active' : ''} ${file.isModified ? 'modified' : ''}`}
                  onClick={() => setActiveFileIndex(index)}
                >
                  <FontAwesomeIcon 
                    icon={getFileIcon(file.name)} 
                    style={{ fontSize: '12px' }}
                  />
                  <span className="tab-name">{file.name}</span>
                  <button
                    className="tab-close"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeFile(file.path);
                    }}
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Editor Area */}
          <div className="editor-area">
            <div className="editor-container">
              {renderFileContent()}
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="url-statusbar">
        <div className="status-left">
          <div className="status-item">
            <FontAwesomeIcon icon={faFile} />
            <span>{openFiles.length > 0 ? openFiles[activeFileIndex]?.name || 'No file' : 'No files'}</span>
          </div>
          {openFiles.length > 0 && openFiles[activeFileIndex] && (
            <div className="status-item">
              <FontAwesomeIcon icon={faCode} />
              <span>{openFiles[activeFileIndex].language}</span>
            </div>
          )}
        </div>
        <div className="status-right">
          <div className="status-item">
            <FontAwesomeIcon icon={faGlobe} />
            <span>Route Files</span>
          </div>
        </div>
      </div>
    </div>
  );
};
