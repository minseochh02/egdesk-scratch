import React, { useState, useEffect } from 'react';
import './HomepageEditor.css';
import { aiKeysStore } from '../AIKeysManager/store/aiKeysStore';
import { ReadFileTool, type ReadFileToolParams, type ReadFileResult } from './tools/read-file';
import { WriteFileTool, type WriteFileToolParams, type WriteFileResult } from './tools/write-file';
import { AIChat } from '../AIChat/AIChat';

interface HomepageEditorProps {
  // Add any props you need
}

const HomepageEditor: React.FC<HomepageEditorProps> = () => {
  const [content, setContent] = useState<string>('');
  const [isPreview, setIsPreview] = useState<boolean>(false);
  const [aiKeysState, setAiKeysState] = useState(aiKeysStore.getState());
  const [showAIKeysDropdown, setShowAIKeysDropdown] = useState<boolean>(false);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string>('');
  const [readFileParams, setReadFileParams] = useState<ReadFileToolParams>({
    absolute_path: '',
    offset: undefined,
    limit: undefined
  });
  const [readFileResult, setReadFileResult] = useState<ReadFileResult | null>(null);
  const [isReadingFile, setIsReadingFile] = useState<boolean>(false);
  
  // Write File state
  const [writeFileParams, setWriteFileParams] = useState<WriteFileToolParams>({
    file_path: '',
    content: '',
    modified_by_user: false,
    ai_proposed_content: undefined
  });
  const [writeFileResult, setWriteFileResult] = useState<WriteFileResult | null>(null);
  const [isWritingFile, setIsWritingFile] = useState<boolean>(false);

  useEffect(() => {
    // Subscribe to AI keys store changes
    const unsubscribe = aiKeysStore.subscribe(setAiKeysState);
    
    // Initialize with default content or load from storage
    setContent(`
# Welcome to EGDesk

This is your homepage editor. You can customize this content to create your personalized dashboard.

## Features
- Edit content in real-time
- Preview mode
- Save and load configurations
- Customize layout and styling

## AI Keys Status
- Active Keys: ${aiKeysState.keys.filter(key => key.isActive).length}
- Total Keys: ${aiKeysState.keys.length}

## Getting Started
Start editing this content to make it your own!
    `.trim());
    
    return unsubscribe;
  }, [aiKeysState.keys.length, aiKeysState.keys.filter(key => key.isActive).length]);

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
  };

  const handleSave = () => {
    // TODO: Implement save functionality
    console.log('Saving content:', content);
  };

  const handleLoad = () => {
    // TODO: Implement load functionality
    console.log('Loading content');
  };

  const togglePreview = () => {
    setIsPreview(!isPreview);
  };

  const toggleAIKeysDropdown = () => {
    setShowAIKeysDropdown(!showAIKeysDropdown);
  };

  const handleKeySelect = (keyId: string) => {
    setSelectedKeyId(keyId);
    setShowAIKeysDropdown(false);
  };

  const getProviderInfo = (providerId: string) => {
    return aiKeysState.providers.find(p => p.id === providerId);
  };

  const getSelectedKey = () => {
    return aiKeysState.keys.find(key => key.id === selectedKeyId);
  };

  const handleTestFileReader = async () => {
    if (!readFileParams.absolute_path.trim()) {
      console.log('Please enter a file path');
      return;
    }
    
    setIsReadingFile(true);
    setReadFileResult(null);
    
    try {
      const result = await ReadFileTool.readFile(readFileParams);
      setReadFileResult(result);
    } catch (error) {
      setReadFileResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setIsReadingFile(false);
    }
  };

  const handleParamChange = (field: keyof ReadFileToolParams, value: string | number | undefined) => {
    setReadFileParams(prev => ({
      ...prev,
      [field]: value === '' ? undefined : value
    }));
  };

  // Write File handlers
  const handleTestFileWriter = async () => {
    if (!writeFileParams.file_path.trim()) {
      console.log('Please enter a file path');
      return;
    }
    
    if (!writeFileParams.content || !writeFileParams.content.trim()) {
      console.log('Please enter content to write');
      return;
    }
    
    // Debug logging
    console.log('Write file params:', {
      file_path: writeFileParams.file_path,
      content: writeFileParams.content,
      contentType: typeof writeFileParams.content,
      contentLength: writeFileParams.content?.length
    });
    
    setIsWritingFile(true);
    setWriteFileResult(null);
    
    try {
      const result = await WriteFileTool.writeFile(writeFileParams);
      setWriteFileResult(result);
    } catch (error) {
      console.error('Write file error:', error);
      setWriteFileResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setIsWritingFile(false);
    }
  };

  const handleWriteParamChange = (field: keyof WriteFileToolParams, value: string | boolean | undefined) => {
    setWriteFileParams(prev => ({
      ...prev,
      [field]: field === 'content' ? (value || '') : value
    }));
  };

  return (
    <div className="homepage-editor">
      <div className="homepage-editor-header">
        <h1>Homepage Editor</h1>
        <div className="homepage-editor-actions">
          <div className="ai-keys-selector">
            <button onClick={toggleAIKeysDropdown} className="ai-keys-dropdown-btn">
              AI Keys ({aiKeysState.keys.filter(key => key.isActive).length}/{aiKeysState.keys.length})
            </button>
            {showAIKeysDropdown && (
              <div className="ai-keys-dropdown">
                <div className="dropdown-header">
                  <span>Select AI Key</span>
                  <button 
                    onClick={toggleAIKeysDropdown}
                    className="close-dropdown"
                  >
                    ×
                  </button>
                </div>
                <div className="dropdown-content">
                  {aiKeysState.keys.length === 0 ? (
                    <div className="no-keys">No AI keys available</div>
                  ) : (
                    aiKeysState.keys.map(key => {
                      const provider = getProviderInfo(key.providerId);
                      return (
                        <div
                          key={key.id}
                          className={`dropdown-item ${selectedKeyId === key.id ? 'selected' : ''} ${!key.isActive ? 'inactive' : ''}`}
                          onClick={() => handleKeySelect(key.id)}
                        >
                          <div className="key-info">
                            <div className="key-name">{key.name}</div>
                            <div className="key-provider">
                              {provider?.name} {!key.isActive && '(Inactive)'}
                            </div>
                          </div>
                          <div className={`key-status ${key.isActive ? 'active' : 'inactive'}`}>
                            {key.isActive ? '●' : '○'}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
          <button onClick={togglePreview} className="preview-btn">
            {isPreview ? 'Edit' : 'Preview'}
          </button>
          <button onClick={handleLoad} className="load-btn">
            Load
          </button>
          <button onClick={handleSave} className="save-btn">
            Save
          </button>
        </div>
        
        {/* File Reader Test Section */}
        <div className="file-reader-test">
          <h3>Read File Tool Test</h3>
          <div className="file-reader-params">
            <div className="param-group">
              <label htmlFor="file-path">File Path (Absolute):</label>
              <input
                id="file-path"
                type="text"
                value={readFileParams.absolute_path}
                onChange={(e) => handleParamChange('absolute_path', e.target.value)}
                placeholder="Enter absolute file path..."
                className="file-path-input"
              />
            </div>
            
            <div className="param-row">
              <div className="param-group">
                <label htmlFor="offset">Offset (optional):</label>
                <input
                  id="offset"
                  type="number"
                  value={readFileParams.offset || ''}
                  onChange={(e) => handleParamChange('offset', e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="Line number to start from"
                  min="0"
                  className="param-input"
                />
              </div>
              
              <div className="param-group">
                <label htmlFor="limit">Limit (optional):</label>
                <input
                  id="limit"
                  type="number"
                  value={readFileParams.limit || ''}
                  onChange={(e) => handleParamChange('limit', e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="Number of lines to read"
                  min="1"
                  className="param-input"
                />
              </div>
            </div>
            
            <button 
              onClick={handleTestFileReader}
              className="test-file-reader-btn"
              disabled={!readFileParams.absolute_path.trim() || isReadingFile}
            >
              {isReadingFile ? 'Reading...' : 'Test File Reader'}
            </button>
          </div>
          
          {/* Results Display */}
          {readFileResult && (
            <div className="file-reader-results">
              <h4>Results:</h4>
              <div className={`result-container ${readFileResult.success ? 'success' : 'error'}`}>
                {readFileResult.success ? (
                  <div>
                    <div className="result-header">
                      <span className="status-indicator success">✓ Success</span>
                      {readFileResult.mimetype && (
                        <span className="mime-type">MIME: {readFileResult.mimetype}</span>
                      )}
                      {readFileResult.fileSize && (
                        <span className="file-size">Size: {readFileResult.fileSize} bytes</span>
                      )}
                    </div>
                    {readFileResult.isTruncated && (
                      <div className="truncation-warning">
                        ⚠️ Content truncated. Showing lines {readFileResult.linesShown?.[0]}-{readFileResult.linesShown?.[1]} of {readFileResult.totalLines} total.
                      </div>
                    )}
                    <div className="content-preview">
                      <pre>{readFileResult.content}</pre>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="result-header">
                      <span className="status-indicator error">✗ Error</span>
                    </div>
                    <div className="error-message">
                      {readFileResult.error}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* AI Chat Section */}
        <div className="ai-chat-section">
          <h3>AI Assistant (Gemini)</h3>
          <div className="ai-chat-container">
            <AIChat />
          </div>
        </div>

        {/* File Writer Test Section */}
        <div className="file-writer-test">
          <h3>Write File Tool Test</h3>
          <div className="file-writer-params">
            <div className="param-group">
              <label htmlFor="write-file-path">File Path (Absolute):</label>
              <input
                id="write-file-path"
                type="text"
                value={writeFileParams.file_path}
                onChange={(e) => handleWriteParamChange('file_path', e.target.value)}
                placeholder="Enter absolute file path..."
                className="file-path-input"
              />
            </div>
            
            <div className="param-group">
              <label htmlFor="write-content">Content to Write:</label>
              <textarea
                id="write-content"
                value={writeFileParams.content}
                onChange={(e) => handleWriteParamChange('content', e.target.value)}
                placeholder="Enter content to write to the file..."
                className="content-textarea"
                rows={6}
              />
            </div>

            <div className="param-row">
              <div className="param-group">
                <label htmlFor="modified-by-user">
                  <input
                    id="modified-by-user"
                    type="checkbox"
                    checked={writeFileParams.modified_by_user || false}
                    onChange={(e) => handleWriteParamChange('modified_by_user', e.target.checked)}
                  />
                  Modified by user
                </label>
              </div>
            </div>
            
            <button 
              onClick={handleTestFileWriter}
              className="test-file-writer-btn"
              disabled={!writeFileParams.file_path.trim() || !writeFileParams.content.trim() || isWritingFile}
            >
              {isWritingFile ? 'Writing...' : 'Test File Writer'}
            </button>
          </div>
          
          {/* Results Display */}
          {writeFileResult && (
            <div className="file-writer-results">
              <h4>Results:</h4>
              <div className={`result-container ${writeFileResult.success ? 'success' : 'error'}`}>
                {writeFileResult.success ? (
                  <div>
                    <div className="result-header">
                      <span className="status-indicator success">✓ Success</span>
                      {writeFileResult.isNewFile && (
                        <span className="new-file-indicator">New File Created</span>
                      )}
                      {writeFileResult.fileSize && (
                        <span className="file-size">Size: {writeFileResult.fileSize} bytes</span>
                      )}
                      {writeFileResult.linesWritten && (
                        <span className="lines-written">Lines: {writeFileResult.linesWritten}</span>
                      )}
                    </div>
                    <div className="success-message">
                      {writeFileResult.isNewFile 
                        ? `Successfully created and wrote to new file: ${writeFileResult.filePath}`
                        : `Successfully overwrote file: ${writeFileResult.filePath}`
                      }
                    </div>
                    {writeFileResult.content && (
                      <div className="content-preview">
                        <h5>Content written:</h5>
                        <pre>{writeFileResult.content}</pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="result-header">
                      <span className="status-indicator error">✗ Error</span>
                    </div>
                    <div className="error-message">
                      {writeFileResult.error}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="homepage-editor-content">
        {isPreview ? (
          <div className="preview-panel">
            <h2>Preview</h2>
            <div className="preview-content">
              <pre>{content}</pre>
            </div>
          </div>
        ) : (
          <div className="editor-panel">
            <h2>Editor</h2>
            <textarea
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              className="content-editor"
              placeholder="Enter your homepage content here..."
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default HomepageEditor;
