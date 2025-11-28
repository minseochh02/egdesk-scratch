import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCode, 
  faFileCode, 
  faSpinner,
  faExternalLinkAlt,
  faCalendarAlt,
  faDatabase,
  faPaperPlane,
  faRobot,
  faUser,
  faArrowLeft,
  faSave
} from '../../utils/fontAwesomeIcons';
import { chatWithGemma, OllamaChatMessage } from '../../lib/gemmaClient';
import './CloudMCPServerEditor.css';

interface TemplateCopy {
  id: string;
  templateId: string;
  templateScriptId?: string;
  spreadsheetId: string;
  spreadsheetUrl: string;
  scriptId?: string;
  scriptContent?: {
    files?: Array<{
      name: string;
      type: string;
      source?: string;
      functionSet?: any;
    }>;
  };
  createdAt: string;
  metadata?: any;
}

interface CloudMCPServerEditorProps {
  initialCopyId?: string;
  onBack?: () => void;
}

const CloudMCPServerEditor: React.FC<CloudMCPServerEditorProps> = ({ initialCopyId, onBack }) => {
  const [templateCopies, setTemplateCopies] = useState<TemplateCopy[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCopy, setSelectedCopy] = useState<TemplateCopy | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);

  // Ollama state
  const [ollamaInstalled, setOllamaInstalled] = useState<boolean | null>(null);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const [ollamaError, setOllamaError] = useState<string | null>(null);
  const [isPullingModel, setIsPullingModel] = useState(false);

  const GEMMA_MODEL = 'gemma3:4b';

  // Fetch all template copies
  const loadTemplateCopies = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await window.electron.templateCopies.getAll(100, 0);
      
      if (result.success && result.data) {
        setTemplateCopies(result.data);
        
        // Auto-select copy if initialCopyId is provided
        if (initialCopyId && result.data.length > 0) {
          const copyToSelect = result.data.find(copy => copy.id === initialCopyId);
          if (copyToSelect) {
            setSelectedCopy(copyToSelect);
            // Auto-select first file if available
            if (copyToSelect.scriptContent?.files && copyToSelect.scriptContent.files.length > 0) {
              setSelectedFile(copyToSelect.scriptContent.files[0].name);
            }
          }
        }
      } else {
        setError(result.error || 'Failed to load template copies');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplateCopies();
  }, []);

  // Check Ollama installation status on mount
  const checkOllamaStatus = useCallback(async () => {
    if (!window.electron) {
      console.warn('Electron API not available for Ollama check');
      return;
    }

    setOllamaLoading(true);
    setOllamaError(null);

    try {
      const result = await (window.electron as any).ollama.checkInstalled();
      if (result.success) {
        setOllamaInstalled(result.installed || false);
        
        if (result.installed) {
          // Note: We'll need to add listModels to OllamaAPI or use invoke
          // For now, we'll check for Gemma model directly
          const gemmaResult = await (window.electron as any).ollama.hasModel(GEMMA_MODEL);
          if (gemmaResult.success && gemmaResult.exists) {
            setOllamaModels([GEMMA_MODEL]);
          }
        }
      }
    } catch (error) {
      console.error('Failed to check Ollama status:', error);
      setOllamaError('Failed to check Ollama installation');
    } finally {
      setOllamaLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkOllamaStatus();
  }, [checkOllamaStatus]);

  // Install Ollama if needed
  const handleInstallOllama = useCallback(async () => {
    if (!window.electron) return;

    setOllamaLoading(true);
    setOllamaError(null);

    try {
      const result = await (window.electron as any).ollama.ensure();
      if (result.success && result.installed) {
        setOllamaInstalled(true);
        await checkOllamaStatus();
      } else {
        setOllamaError('Failed to install Ollama');
      }
    } catch (error) {
      console.error('Failed to install Ollama:', error);
      setOllamaError(error instanceof Error ? error.message : 'Installation failed');
    } finally {
      setOllamaLoading(false);
    }
  }, [checkOllamaStatus]);

  // Pull Gemma model
  const handlePullGemma = useCallback(async () => {
    if (!window.electron) return;

    setIsPullingModel(true);
    setOllamaError(null);

    try {
      const result = await (window.electron as any).ollama.pullModel(GEMMA_MODEL);
      if (result.success) {
        await checkOllamaStatus();
      } else {
        setOllamaError(result.error || 'Failed to pull Gemma model');
      }
    } catch (error) {
      console.error('Failed to pull Gemma model:', error);
      setOllamaError(error instanceof Error ? error.message : 'Model pull failed');
    } finally {
      setIsPullingModel(false);
    }
  }, [GEMMA_MODEL, checkOllamaStatus]);

  // Check if Gemma is installed
  const hasGemma = useMemo(() => {
    return ollamaModels.some((model) => model.toLowerCase().includes('gemma'));
  }, [ollamaModels]);

  const ollamaReady = ollamaInstalled && hasGemma;

  // Update selection when initialCopyId changes
  useEffect(() => {
    if (initialCopyId && templateCopies.length > 0) {
      const copyToSelect = templateCopies.find(copy => copy.id === initialCopyId);
      if (copyToSelect && copyToSelect.id !== selectedCopy?.id) {
        setSelectedCopy(copyToSelect);
        if (copyToSelect.scriptContent?.files && copyToSelect.scriptContent.files.length > 0) {
          setSelectedFile(copyToSelect.scriptContent.files[0].name);
        }
      }
    }
  }, [initialCopyId, templateCopies]);

  // Get selected file content
  const getSelectedFileContent = (): string => {
    if (!selectedCopy || !selectedFile || !selectedCopy.scriptContent?.files) {
      return '';
    }

    const file = selectedCopy.scriptContent.files.find(f => f.name === selectedFile);
    return file?.source || '';
  };

  // Handle save - uses AppsScript tools
  const handleSave = async () => {
    if (!selectedCopy || !selectedFile || !selectedCopy.scriptId) {
      return;
    }

    const fileContent = getSelectedFileContent();
    if (!fileContent) {
      return;
    }

    try {
      const result = await window.electron.appsScriptTools.writeFile(
        selectedCopy.scriptId,
        selectedFile,
        fileContent
      );
      
      if (result.success) {
        // Reload template copies to get updated content
        await loadTemplateCopies();
        alert('File saved successfully!');
      } else {
        alert(`Failed to save file: ${result.error}`);
      }
    } catch (error) {
      console.error('Save error:', error);
      alert(`Error saving file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Format date
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  // Scroll chat to bottom
  const scrollChatToBottom = () => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollChatToBottom();
  }, [chatMessages]);

  // Build system prompt with code context
  const buildSystemPrompt = useCallback(() => {
    const fileContent = getSelectedFileContent();
    const fileName = selectedFile || 'No file selected';
    const fileType = selectedCopy?.scriptContent?.files?.find(f => f.name === fileName)?.type || 'unknown';
    const scriptId = selectedCopy?.scriptId;

    let codeContext = '';
    if (fileContent && fileContent.trim().length > 0) {
      codeContext = `\n\nCURRENT FILE CONTEXT:
File Name: ${fileName}
File Type: ${fileType}
Script ID: ${scriptId || 'N/A'}
File Content:
\`\`\`${fileType === 'server_js' ? 'javascript' : fileType === 'html' ? 'html' : 'javascript'}
${fileContent.slice(0, 5000)}${fileContent.length > 5000 ? '\n... (truncated)' : ''}
\`\`\`
`;
    }

    const toolsInfo = scriptId ? `
AVAILABLE TOOLS:
You can use these AppsScript tools to interact with the code:
- apps_script_list_files: List all files in the AppsScript project (scriptId: ${scriptId})
- apps_script_read_file: Read any file from the project
- apps_script_write_file: Write/update file content
- apps_script_partial_edit: Make targeted edits to files
- apps_script_rename_file: Rename files

The script content is stored in the EGDesk app's SQLite database (cloudmcp.db).
` : '';

    return `You are an AI assistant helping a developer work with Google Apps Script code.

Your role:
- Help understand, modify, debug, and improve Apps Script code
- Provide clear explanations of code functionality
- Suggest improvements and best practices
- Help identify and fix bugs
- Generate code snippets when requested
- Answer questions about Apps Script APIs and features
- Use AppsScript tools to read, write, and modify files when needed

${codeContext}

${toolsInfo}

IMPORTANT:
- When the user asks about code, refer to the current file context above
- If they ask to modify code, you can use the AppsScript tools to make changes directly
- Always explain what changes you're making and why
- Be concise but thorough in your explanations
- If the file content is truncated, mention that you're working with a partial view
- You have access to all files in the AppsScript project via tools

Respond naturally and helpfully. If the user asks about code that isn't in the current context, use the tools to read that file first.`;
  }, [selectedFile, selectedCopy]);

  // Handle chat send
  const handleChatSend = useCallback(async () => {
    if (!chatInput.trim() || isChatLoading || !ollamaReady) {
      if (!ollamaReady) {
        setOllamaError('Gemma is not ready. Complete the setup before chatting.');
      }
      return;
    }

    const userMessage = {
      role: 'user' as const,
      content: chatInput.trim(),
      timestamp: new Date(),
    };

    setChatMessages(prev => [...prev, userMessage]);
    const prompt = chatInput.trim();
    setChatInput('');
    setIsChatLoading(true);
    setOllamaError(null);

    try {
      // Build context from previous messages
      const priorContext: OllamaChatMessage[] = chatMessages.map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      }));

      // Get AI response
      const { content: assistantContent } = await chatWithGemma(
        prompt,
        priorContext,
        {
          systemPrompt: buildSystemPrompt(),
        }
      );

      const assistantMessage = {
        role: 'assistant' as const,
        content: assistantContent || 'I apologize, but I could not generate a response.',
        timestamp: new Date(),
      };

      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      setOllamaError(error instanceof Error ? error.message : 'Chat failed');
      const errorMessage = {
        role: 'assistant' as const,
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}. Please ensure Ollama is running and try again.`,
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  }, [chatInput, isChatLoading, ollamaReady, chatMessages, buildSystemPrompt]);

  // Handle Enter key in chat input
  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSend();
    }
  };

  return (
    <div className="cloud-mcp-server-editor">
      <div className="editor-header">
        <div className="header-content">
          {onBack && (
            <button 
              className="back-button"
              onClick={onBack}
              title="Back to MCP Servers"
            >
              <FontAwesomeIcon icon={faArrowLeft} />
            </button>
          )}
          <FontAwesomeIcon icon={faCode} className="header-icon" />
          <div>
            <h2>Cloud MCP Server Editor</h2>
            <p>View and manage Apps Script content from template copies</p>
          </div>
        </div>
        <button 
          className="refresh-button"
          onClick={loadTemplateCopies}
          disabled={loading}
        >
          <FontAwesomeIcon icon={faSpinner} spin={loading} />
          Refresh
        </button>
      </div>

      {loading && (
        <div className="loading-state">
          <FontAwesomeIcon icon={faSpinner} spin />
          <span>Loading template copies...</span>
        </div>
      )}

      {error && (
        <div className="error-state">
          <span>{error}</span>
          <button onClick={loadTemplateCopies}>Retry</button>
        </div>
      )}

      {!loading && !error && (
        <div className="editor-layout">
          {/* Left sidebar - Template copies list */}
          <div className="editor-sidebar">
            <div className="sidebar-header">
              <FontAwesomeIcon icon={faDatabase} />
              <span>Template Copies ({templateCopies.length})</span>
            </div>
            <div className="copies-list">
              {templateCopies.length === 0 ? (
                <div className="empty-state">
                  <p>No template copies found</p>
                  <p className="empty-hint">Create a template copy to see script content here</p>
                </div>
              ) : (
                templateCopies.map((copy) => (
                  <div
                    key={copy.id}
                    className={`copy-item ${selectedCopy?.id === copy.id ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedCopy(copy);
                      setSelectedFile(null);
                    }}
                  >
                    <div className="copy-item-header">
                      <FontAwesomeIcon icon={faFileCode} />
                      <span className="copy-title">
                        {(copy.metadata as any)?.serverName || copy.spreadsheetId.substring(0, 20) + '...'}
                      </span>
                    </div>
                    <div className="copy-item-meta">
                      <div className="meta-item">
                        <FontAwesomeIcon icon={faCalendarAlt} />
                        <span>{formatDate(copy.createdAt)}</span>
                      </div>
                      {copy.scriptContent?.files && (
                        <div className="meta-item">
                          <span>{copy.scriptContent.files.length} file(s)</span>
                        </div>
                      )}
                    </div>
                    {copy.scriptId && (
                      <div className="copy-item-script-id">
                        Script ID: {copy.scriptId.substring(0, 30)}...
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Middle panel - Script content */}
          <div className="editor-content">
            {!selectedCopy ? (
              <div className="empty-content">
                <FontAwesomeIcon icon={faCode} className="empty-icon" />
                <h3>Select a template copy to view script content</h3>
                <p>Choose a template copy from the left sidebar to see its Apps Script files</p>
              </div>
            ) : !selectedCopy.scriptContent?.files || selectedCopy.scriptContent.files.length === 0 ? (
              <div className="empty-content">
                <FontAwesomeIcon icon={faFileCode} className="empty-icon" />
                <h3>No script content available</h3>
                <p>This template copy doesn't have any Apps Script files</p>
                <div className="copy-info">
                  <div className="info-item">
                    <strong>Spreadsheet ID:</strong> {selectedCopy.spreadsheetId}
                  </div>
                  <div className="info-item">
                    <strong>Spreadsheet URL:</strong>{' '}
                    <a 
                      href={selectedCopy.spreadsheetUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      {selectedCopy.spreadsheetUrl}
                      <FontAwesomeIcon icon={faExternalLinkAlt} />
                    </a>
                  </div>
                  {selectedCopy.scriptId && (
                    <div className="info-item">
                      <strong>Script ID:</strong> {selectedCopy.scriptId}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* File selector */}
                <div className="file-selector">
                  <div className="file-selector-header">
                    <FontAwesomeIcon icon={faFileCode} />
                    <span>Script Files</span>
                  </div>
                  <div className="files-list">
                    {selectedCopy.scriptContent.files.map((file, index) => (
                      <div
                        key={index}
                        className={`file-item ${selectedFile === file.name ? 'active' : ''}`}
                        onClick={() => setSelectedFile(file.name)}
                      >
                        <FontAwesomeIcon icon={faFileCode} />
                        <span>{file.name}</span>
                        <span className="file-type">{file.type}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Code viewer */}
                <div className="code-viewer">
                  <div className="code-viewer-header">
                    <div className="code-header-left">
                      <FontAwesomeIcon icon={faCode} />
                      <span>{selectedFile || 'Select a file'}</span>
                    </div>
                    <div className="code-header-actions">
                      {selectedCopy && (
                        <button
                          className="open-spreadsheet-button"
                          onClick={() => {
                            if (selectedCopy.spreadsheetUrl) {
                              // Open in default browser
                              window.open(selectedCopy.spreadsheetUrl, '_blank', 'noopener,noreferrer');
                            }
                          }}
                          title="Open spreadsheet in browser"
                        >
                          <FontAwesomeIcon icon={faExternalLinkAlt} />
                          <span>Open Spreadsheet</span>
                        </button>
                      )}
                      {selectedFile && getSelectedFileContent() && selectedCopy?.scriptId && (
                        <button
                          className="save-button"
                          onClick={handleSave}
                          title="Save changes to Apps Script (uses AppsScript tools)"
                        >
                          <FontAwesomeIcon icon={faSave} />
                          Save
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="code-content">
                    {selectedFile ? (
                      <pre className="code-block">
                        <code>{getSelectedFileContent() || 'No content available'}</code>
                      </pre>
                    ) : (
                      <div className="code-placeholder">
                        <p>Select a file from the list above to view its content</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right panel - Chat interface */}
          <div className="editor-chat">
            <div className="chat-header">
              <FontAwesomeIcon icon={faRobot} />
              <span>AI Assistant</span>
              <span className={`chat-status ${ollamaReady ? 'chat-status--ready' : ''}`}>
                {ollamaLoading
                  ? 'Checking...'
                  : ollamaReady
                  ? '🟢 Ready'
                  : '⚪ Setup Required'}
              </span>
            </div>
            {!ollamaReady ? (
              <div className="chat-setup">
                <div className="chat-setup-card">
                  <h3>🤖 Local AI Setup</h3>
                  {ollamaLoading ? (
                    <div className="chat-setup-status">
                      <FontAwesomeIcon icon={faSpinner} spin />
                      <span>Checking Ollama status...</span>
                    </div>
                  ) : ollamaError ? (
                    <div className="chat-setup-error">
                      <p>⚠️ {ollamaError}</p>
                      <button type="button" onClick={checkOllamaStatus}>
                        Retry
                      </button>
                    </div>
                  ) : ollamaInstalled === false ? (
                    <div className="chat-setup-install">
                      <p>Ollama is not installed. Install it to use local AI models.</p>
                      <button
                        type="button"
                        className="chat-setup-action"
                        onClick={handleInstallOllama}
                        disabled={ollamaLoading}
                      >
                        Install Ollama
                      </button>
                    </div>
                  ) : !hasGemma ? (
                    <div className="chat-setup-model">
                      <p>Gemma 4B model is not installed. Pull it to start chatting.</p>
                      <button
                        type="button"
                        className="chat-setup-action"
                        onClick={handlePullGemma}
                        disabled={isPullingModel}
                      >
                        {isPullingModel ? 'Pulling Gemma 4B...' : 'Pull Gemma 4B'}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <>
                <div className="chat-messages">
                  {chatMessages.length === 0 ? (
                    <div className="chat-empty">
                      <FontAwesomeIcon icon={faRobot} className="chat-empty-icon" />
                      <p>Ask me anything about your Apps Script code!</p>
                      <p className="chat-empty-hint">I can help you understand, modify, or debug your scripts.</p>
                      {selectedFile && (
                        <p className="chat-empty-hint">
                          Currently viewing: <strong>{selectedFile}</strong>
                        </p>
                      )}
                    </div>
                  ) : (
                    chatMessages.map((message, index) => (
                      <div key={index} className={`chat-message ${message.role}`}>
                        <div className="chat-message-avatar">
                          <FontAwesomeIcon icon={message.role === 'user' ? faUser : faRobot} />
                        </div>
                        <div className="chat-message-content">
                          <div className="chat-message-text">{message.content}</div>
                          <div className="chat-message-time">
                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  {isChatLoading && (
                    <div className="chat-message assistant">
                      <div className="chat-message-avatar">
                        <FontAwesomeIcon icon={faRobot} />
                      </div>
                      <div className="chat-message-content">
                        <div className="chat-message-text">
                          <FontAwesomeIcon icon={faSpinner} spin /> Thinking...
                        </div>
                      </div>
                    </div>
                  )}
                  {ollamaError && (
                    <div className="chat-error">
                      <p>⚠️ {ollamaError}</p>
                    </div>
                  )}
                  <div ref={chatMessagesEndRef} />
                </div>
                <div className="chat-input-container">
                  <textarea
                    className="chat-input"
                    placeholder={selectedFile ? `Ask about ${selectedFile}...` : "Ask about your code..."}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={handleChatKeyDown}
                    rows={3}
                    disabled={isChatLoading || !ollamaReady}
                  />
                  <button
                    className="chat-send-button"
                    onClick={handleChatSend}
                    disabled={!chatInput.trim() || isChatLoading || !ollamaReady}
                  >
                    <FontAwesomeIcon icon={faPaperPlane} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CloudMCPServerEditor;

