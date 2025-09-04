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
  diffData?: {
    filePath: string;
    diff: { before: string; after: string; lineNumber: number };
  } | null;
}

export const URLFileViewer: React.FC<URLFileViewerProps> = ({ 
  filesToOpen, 
  instanceId = 'url-viewer',
  diffData
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

  // Monitor when files are opened and UI should update
  useEffect(() => {
    if (openFiles.length > 0) {
      console.log('🔄 URLFileViewer: Files opened, UI should update');
      console.log('📁 Open files:', openFiles.map(f => ({ path: f.path, name: f.name, contentLength: f.content.length })));
      console.log('🎯 Active file index:', activeFileIndex);
      console.log('📊 DIFF UI SHOULD NOW BE VISIBLE');
    }
  }, [openFiles, activeFileIndex]);

  // Handle diff data changes
  useEffect(() => {
    if (diffData) {
      console.log('🔍 URLFileViewer: Diff data received', {
        filePath: diffData.filePath,
        diff: diffData.diff,
        openFilesCount: openFiles.length
      });
      
      // Find the file that matches the diff data
      const matchingFileIndex = openFiles.findIndex(file => 
        file.path === diffData.filePath || 
        file.path.endsWith(diffData.filePath) ||
        diffData.filePath.endsWith(file.path)
      );
      
      if (matchingFileIndex !== -1) {
        console.log('✅ URLFileViewer: Found matching file, switching to it', {
          matchingFileIndex,
          filePath: openFiles[matchingFileIndex].path
        });
        setActiveFileIndex(matchingFileIndex);
      } else {
        console.log('⚠️ URLFileViewer: No matching file found for diff data', {
          diffFilePath: diffData.filePath,
          availableFiles: openFiles.map(f => f.path)
        });
      }
    }
  }, [diffData, openFiles]);

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
      console.log('🎯 FOCUSING TO FILE PATH:', filePath);
      console.log('📊 SHOWING DIFF FOR FILE:', filePath);
      
      const fileName = filePath.split('/').pop() || filePath;
      const fileResult = await window.electron.fileSystem.readFile(filePath);
      
      // Handle the response structure from electron fileSystem
      const fileContent = fileResult.success ? fileResult.content : '';
      
      if (!fileResult.success) {
        console.error(`❌ URLFileViewer: Failed to read file ${filePath}:`, fileResult.error);
        return null;
      }
      
      const language = getLanguageFromExtension(fileName) || 'plaintext';
      
      const newFile: OpenFile = {
        path: filePath,
        name: fileName,
        content: fileContent,
        isModified: false,
        language: language || 'plaintext'
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

  const generateDiffView = (content: string, diffData?: { before: string; after: string; lineNumber: number }) => {
    if (!diffData) {
      return {
        lineNumbers: content.split('\n').map((_, index) => index + 1),
        lines: content.split('\n').map((line, index) => ({
          content: line,
          lineNumber: index + 1,
          type: 'unchanged' as const
        }))
      };
    }
    
    const lines = content.split('\n');
    const oldLines = diffData.before.split('\n');
    const newLines = diffData.after.split('\n');
    
    // Create diff view data
    const diffLines: Array<{
      content: string;
      lineNumber: number | string;
      type: 'unchanged' | 'deleted' | 'added';
    }> = [];
    
    const lineNumbers: (number | string)[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      
      if (lineNum === diffData.lineNumber) {
        // Show the original line as deleted
        diffLines.push({
          content: lines[i],
          lineNumber: lineNum,
          type: 'deleted'
        });
        lineNumbers.push(lineNum);
        
        // Show the new lines as added
        newLines.forEach((newLine, newLineIndex) => {
          diffLines.push({
            content: newLine,
            lineNumber: '+',
            type: 'added'
          });
          lineNumbers.push('+ + +');
        });
      } else {
        // Regular unchanged line
        diffLines.push({
          content: lines[i],
          lineNumber: lineNum,
          type: 'unchanged'
        });
        lineNumbers.push(lineNum);
      }
    }
    
    return { lineNumbers, lines: diffLines };
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

    // Check if this file has diff data
    const hasDiff = diffData && (
      activeFile.path === diffData.filePath || 
      activeFile.path.endsWith(diffData.filePath) ||
      diffData.filePath.endsWith(activeFile.path)
    );

    const { lineNumbers, lines: diffLines } = generateDiffView(activeFile.content, hasDiff ? diffData?.diff : undefined);

    return (
      <div className="editor-wrapper">
        {showLineNumbers && (
          <div className="line-numbers" id={`line-numbers-${instanceId}`}>
            {lineNumbers.map((lineNum, index) => {
              const isAddedLine = typeof lineNum === 'string' && lineNum === '+ + +';
              const isDeletedLine = hasDiff && typeof lineNum === 'number' && lineNum === diffData?.diff.lineNumber;
              
              return (
                <div 
                  key={`${lineNum}-${index}`} 
                  className={`line-number ${isDeletedLine ? 'deleted-line' : ''} ${isAddedLine ? 'added-line' : ''}`}
                  style={{
                    backgroundColor: isDeletedLine ? '#4a2a2a' : isAddedLine ? '#2a4a2a' : 'transparent',
                    color: isDeletedLine ? '#ffaaaa' : isAddedLine ? '#90ee90' : '#888888',
                    fontWeight: isDeletedLine || isAddedLine ? 'bold' : 'normal'
                  }}
                >
                  {lineNum}
                </div>
              );
            })}
          </div>
        )}
        <div 
          className={`code-content ${wordWrap ? 'word-wrap' : ''}`}
          id={`code-content-${instanceId}`}
          style={{
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
            fontSize: '14px',
            lineHeight: '1.5',
            whiteSpace: 'pre',
            overflow: 'visible', /* Make content fixed, let wrapper handle scrolling */
            padding: '10px',
            backgroundColor: '#1e1e1e',
            color: '#d4d4d4',
            border: '1px solid #3c3c3c',
            borderRadius: '4px',
            minHeight: '400px',
            flex: 1 /* Take remaining space */
          }}
        >
          {diffLines.map((line, index) => {
            const isDeletedLine = line.type === 'deleted';
            const isAddedLine = line.type === 'added';
            const isUnchangedLine = line.type === 'unchanged';
            
            return (
              <div 
                key={`${line.lineNumber}-${index}`}
                className={`code-line ${isDeletedLine ? 'deleted-line' : ''} ${isAddedLine ? 'added-line' : ''}`}
                style={{
                  backgroundColor: isDeletedLine ? '#4a2a2a' : isAddedLine ? '#2a4a2a' : 'transparent',
                  borderLeft: isDeletedLine ? '3px solid #ff4444' : isAddedLine ? '3px solid #00ff00' : 'none',
                  paddingLeft: isDeletedLine || isAddedLine ? '7px' : '0px',
                  margin: isDeletedLine || isAddedLine ? '2px 0' : '0',
                  color: isDeletedLine ? '#ffaaaa' : isAddedLine ? '#90ee90' : '#d4d4d4',
                  minHeight: '1.5em',
                  display: 'block',
                  lineHeight: '1.5'
                }}
              >
                {line.content}
              </div>
            );
          })}
        </div>
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
