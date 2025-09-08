import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faRobot,
  faBrain,
  faSearch,
  faComments,
  faCheck,
  faTimes,
  faLightbulb,
  faInfo,
  faUser,
  faRocket,
  faRefresh,
  faPlus,
  faCog,
  faBug,
} from '@fortawesome/free-solid-svg-icons';
import { ChatSession, ChatMessage, ChatConfig, CHAT_PROVIDERS } from './types';
import { chatStore } from './store/chatStore';
import { aiKeysStore } from '../AIKeysManager/store/aiKeysStore';
import { AIKey } from '../AIKeysManager/types';
import { MessageContent } from './components';
import './ChatInterface.css';

export const ChatInterface: React.FC = () => {
  const [state, setState] = useState(chatStore.getState());
  const [aiKeys, setAiKeys] = useState<AIKey[]>([]);
  const [showNewSessionDialog, setShowNewSessionDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [selectedModel, setSelectedModel] = useState('gpt-3.5-turbo');
  const [messageInput, setMessageInput] = useState('');
  const [selectedKey, setSelectedKey] = useState<AIKey | null>(null);
  const [workspacePath, setWorkspacePath] = useState<string>('');
  const [codespaceInfo, setCodespaceInfo] = useState(
    chatStore.getCodespaceInfo(),
  );
  const [showDemo, setShowDemo] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const unsubscribeChat = chatStore.subscribe(setState);
    const unsubscribeKeys = aiKeysStore.subscribe((keyState) => {
      setAiKeys(keyState.keys.filter((key) => key.isActive));
    });

    // Update codespace info when store changes
    const updateCodespaceInfo = () => {
      setCodespaceInfo(chatStore.getCodespaceInfo());
    };

    // Initial load
    updateCodespaceInfo();

    return () => {
      unsubscribeChat();
      unsubscribeKeys();
    };
  }, []);

  // Removed auto-detect workspace on mount to prevent infinite reload
  // Users can manually set workspace path or use the auto-detect button

  useEffect(() => {
    scrollToBottom();
  }, [state.currentSessionId, state.sessions]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCreateSession = async () => {
    if (!newSessionName.trim()) return;

    try {
      await chatStore.createSession(
        newSessionName,
        selectedProvider,
        selectedModel,
      );
      setShowNewSessionDialog(false);
      setNewSessionName('');
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedKey) return;

    const currentSession = chatStore.getCurrentSession();
    if (!currentSession) return;

    try {
      await chatStore.sendMessage(
        messageInput,
        selectedKey,
        currentSession.model,
      );
      setMessageInput('');
      messageInputRef.current?.focus();
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (confirm('Are you sure you want to delete this chat session?')) {
      try {
        await chatStore.deleteSession(sessionId);
      } catch (error) {
        console.error('Failed to delete session:', error);
      }
    }
  };

  const handleWorkspacePathChange = async (path: string) => {
    // Prevent unnecessary changes if path is the same
    if (path === workspacePath) {
      return;
    }

    setWorkspacePath(path);
    try {
      await chatStore.setWorkspacePath(path);
      setCodespaceInfo(chatStore.getCodespaceInfo());
    } catch (error) {
      console.error('Failed to set workspace path:', error);
    }
  };

  const handleRefreshCodespace = async () => {
    try {
      await chatStore.refreshCodespace();
      setCodespaceInfo(chatStore.getCodespaceInfo());
    } catch (error) {
      console.error('Failed to refresh codespace:', error);
    }
  };

  const handleAutoDetectWorkspace = async () => {
    try {
      // Try to get the current working directory or project path
      const homeDir = await window.electron.fileSystem.getHomeDirectory();
      if (homeDir && homeDir !== workspacePath) {
        await handleWorkspacePathChange(homeDir);
      }
    } catch (error) {
      console.error('Failed to auto-detect workspace:', error);
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getProviderInfo = (providerId: string) => {
    return CHAT_PROVIDERS.find((p) => p.id === providerId);
  };

  const getModelsForProvider = (providerId: string) => {
    const provider = CHAT_PROVIDERS.find((p) => p.id === providerId);
    return provider?.models || [];
  };

  const currentSession = chatStore.getCurrentSession();
  const availableKeys = aiKeys.filter(
    (key) => key.providerId === selectedProvider,
  );

  return (
    <div className="chat-interface">
      {/* Header */}
      <div className="chat-header">
        <div className="header-left">
          <h1>
            <FontAwesomeIcon icon={faComments} /> AI Chat
          </h1>
          <p>Chat with AI using your saved API keys</p>
        </div>
        <div className="header-right">
          <button
            className="new-session-btn"
            onClick={() => setShowNewSessionDialog(true)}
          >
            <FontAwesomeIcon icon={faPlus} /> New Chat
          </button>
          <button
            className="settings-btn"
            onClick={() => setShowSettings(!showSettings)}
          >
            <FontAwesomeIcon icon={faCog} /> Settings
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="settings-panel">
          <h3>Chat Settings</h3>
          <div className="settings-grid">
            <div className="setting-group">
              <label>Temperature: {state.config.temperature}</label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={state.config.temperature}
                onChange={(e) =>
                  chatStore.updateConfig({
                    temperature: parseFloat(e.target.value),
                  })
                }
              />
              <small>Controls randomness (0 = focused, 2 = creative)</small>
            </div>
            <div className="setting-group">
              <label>Max Tokens: {state.config.maxTokens}</label>
              <input
                type="range"
                min="100"
                max="4000"
                step="100"
                value={state.config.maxTokens}
                onChange={(e) =>
                  chatStore.updateConfig({
                    maxTokens: parseInt(e.target.value),
                  })
                }
              />
              <small>Maximum response length</small>
            </div>
            <div className="setting-group">
              <label>System Prompt</label>
              <textarea
                value={state.config.systemPrompt}
                onChange={(e) =>
                  chatStore.updateConfig({ systemPrompt: e.target.value })
                }
                placeholder="You are a helpful AI assistant..."
                rows={3}
              />
              <small>Instructions for the AI behavior</small>
            </div>
          </div>
        </div>
      )}

      {/* Codespace Context Panel */}
      <div className="codespace-panel">
        <div className="codespace-header">
          <h3>
            <FontAwesomeIcon icon={faSearch} /> Codespace Context
          </h3>
          <div className="codespace-controls">
            <div className="codespace-status">
              {codespaceInfo.isAvailable ? (
                <span className="status-available">
                  <FontAwesomeIcon icon={faCheck} /> Available
                </span>
              ) : (
                <span className="status-unavailable">
                  <FontAwesomeIcon icon={faTimes} /> Not Available
                </span>
              )}
            </div>
            <button
              className="demo-toggle-btn"
              onClick={() => setShowDemo(!showDemo)}
              title="Toggle demo mode"
            >
              {showDemo ? '🎭 Hide Demo' : '🎭 Show Demo'}
            </button>
          </div>
        </div>

        <div className="workspace-input">
          <label>Workspace Path:</label>
          <div className="input-group">
            <input
              type="text"
              value={workspacePath}
              onChange={(e) => setWorkspacePath(e.target.value)}
              placeholder="Enter workspace path (e.g., /path/to/project)"
              onBlur={(e) => handleWorkspacePathChange(e.target.value)}
            />
            <button
              className="button-secondary"
              onClick={handleAutoDetectWorkspace}
              title="Auto-detect workspace"
            >
              <FontAwesomeIcon icon={faSearch} /> Auto-detect
            </button>
            <button
              className="button-secondary"
              onClick={handleRefreshCodespace}
              disabled={!codespaceInfo.isAvailable}
              title="Refresh codespace analysis"
            >
              <FontAwesomeIcon icon={faRefresh} /> Refresh
            </button>
          </div>
        </div>

        {codespaceInfo.isAvailable && codespaceInfo.cacheStatus && (
          <div className="cache-info">
            <span>
              Cache:{' '}
              {codespaceInfo.cacheStatus.hasCache ? (
                <FontAwesomeIcon icon={faCheck} />
              ) : (
                <FontAwesomeIcon icon={faTimes} />
              )}
            </span>
            {codespaceInfo.cacheStatus.hasCache &&
              codespaceInfo.cacheStatus.cacheAge && (
                <span>Age: {codespaceInfo.cacheStatus.cacheAge} minutes</span>
              )}
            {codespaceInfo.cacheStatus.totalFiles && (
              <span>Files: {codespaceInfo.cacheStatus.totalFiles}</span>
            )}
          </div>
        )}

        {codespaceInfo.isAvailable && (
          <div className="codespace-tip">
            <FontAwesomeIcon icon={faLightbulb} /> <strong>Pro Tip:</strong> The
            AI will now automatically search your codebase and provide
            context-aware responses based on your actual code!
          </div>
        )}

        {!codespaceInfo.isAvailable && workspacePath && (
          <div className="codespace-error">
            ⚠️ <strong>Codespace Analysis Failed:</strong> Unable to analyze the
            specified workspace. Please check the path and ensure it contains
            source code files.
          </div>
        )}

        {!workspacePath && (
          <div className="codespace-info">
            <FontAwesomeIcon icon={faInfo} /> <strong>No Workspace Set:</strong>{' '}
            Set a workspace path to enable intelligent code context in your AI
            chat.
          </div>
        )}
      </div>

      {/* Demo Mode */}
      {showDemo && (
        <div className="demo-panel">
          <div className="demo-header">
            <h3>🎭 Demo Mode - Try These Examples</h3>
            <p>
              These examples show how the AI will use your codespace context
            </p>
          </div>

          <div className="demo-examples">
            <div className="demo-example">
              <h4>
                <FontAwesomeIcon icon={faSearch} /> Code Search
              </h4>
              <p>"How do I implement authentication in this project?"</p>
              <small>
                The AI will search your codebase for auth-related files and
                provide specific guidance.
              </small>
            </div>

            <div className="demo-example">
              <h4>
                <FontAwesomeIcon icon={faBug} /> Bug Investigation
              </h4>
              <p>"Why is the login form not working?"</p>
              <small>
                The AI will examine your login implementation and identify
                potential issues.
              </small>
            </div>

            <div className="demo-example">
              <h4>
                <FontAwesomeIcon icon={faRocket} /> Feature Development
              </h4>
              <p>"I want to add a new API endpoint for user profiles"</p>
              <small>
                The AI will understand your current API structure and suggest
                the best approach.
              </small>
            </div>

            <div className="demo-example">
              <h4>📚 Code Understanding</h4>
              <p>"Explain how the routing works in this application"</p>
              <small>
                The AI will analyze your routing files and provide a
                comprehensive explanation.
              </small>
            </div>
          </div>

          <div className="demo-tip">
            <FontAwesomeIcon icon={faLightbulb} /> <strong>Pro Tip:</strong> The
            more specific your questions are about your code, the better the AI
            can leverage the codespace context to help you!
          </div>
        </div>
      )}

      <div className="chat-content">
        {/* Sidebar - Chat Sessions */}
        <div className="chat-sidebar">
          <div className="sidebar-header">
            <h3>Chat Sessions</h3>
          </div>
          <div className="sessions-list">
            {state.sessions.length === 0 ? (
              <div className="empty-sessions">
                <p>No chat sessions yet</p>
                <button
                  className="create-first-session-btn"
                  onClick={() => setShowNewSessionDialog(true)}
                >
                  Start Your First Chat
                </button>
              </div>
            ) : (
              state.sessions.map((session) => (
                <div
                  key={session.id}
                  className={`session-item ${state.currentSessionId === session.id ? 'active' : ''}`}
                  onClick={() => chatStore.setCurrentSession(session.id)}
                >
                  <div className="session-info">
                    <div className="session-name">{session.name}</div>
                    <div className="session-meta">
                      <span
                        className="provider-icon"
                        style={{
                          color: getProviderInfo(session.provider)?.color,
                        }}
                      >
                        <FontAwesomeIcon
                          icon={getProviderInfo(session.provider)?.icon}
                        />
                      </span>
                      <span className="model-name">{session.model}</span>
                      <span className="message-count">
                        {session.messages.length} messages
                      </span>
                    </div>
                  </div>
                  <button
                    className="delete-session-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSession(session.id);
                    }}
                    title="Delete session"
                  >
                    🗑️
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="chat-main">
          {!currentSession ? (
            <div className="welcome-screen">
              <div className="welcome-content">
                <h2>👋 Welcome to AI Chat</h2>
                <p>Start a new chat session to begin conversing with AI</p>
                <button
                  className="start-chat-btn"
                  onClick={() => setShowNewSessionDialog(true)}
                >
                  Start New Chat
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Chat Messages */}
              <div className="messages-container">
                {currentSession.messages.length === 0 ? (
                  <div className="empty-chat">
                    <p>Start the conversation by sending a message</p>
                  </div>
                ) : (
                  currentSession.messages.map((message) => (
                    <div key={message.id} className={`message ${message.role}`}>
                      <div className="message-header">
                        <span className="message-role">
                          {message.role === 'user' ? (
                            <>
                              <FontAwesomeIcon icon={faUser} /> You
                            </>
                          ) : (
                            <>
                              <FontAwesomeIcon icon={faRobot} /> AI
                            </>
                          )}
                        </span>
                        <span className="message-time">
                          {formatDate(message.timestamp)}
                        </span>
                        {message.tokens && (
                          <span className="message-tokens">
                            {message.tokens} tokens
                          </span>
                        )}
                        {message.cost && (
                          <span className="message-cost">
                            ${message.cost.toFixed(4)}
                          </span>
                        )}
                      </div>
                      <div className="message-content">
                        <MessageContent
                          content={message.content}
                          role={message.role}
                        />
                      </div>
                      {/* Read [path] [lines] hints for the latest turn */}
                      {state.lastContextReads &&
                        message.role === 'assistant' &&
                        message.id ===
                          currentSession.messages[
                            currentSession.messages.length - 1
                          ]?.id && (
                          <div className="context-reads">
                            {state.lastContextReads.map((r, i) => (
                              <div key={i} className="context-read-item">
                                Read [{r.path}] [lines {r.start}-{r.end}]
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="message-input-container">
                <div className="input-header">
                  <div className="key-selector">
                    <label>API Key:</label>
                    <select
                      value={selectedKey?.id || ''}
                      onChange={(e) => {
                        const key = aiKeys.find((k) => k.id === e.target.value);
                        setSelectedKey(key || null);
                      }}
                      disabled={availableKeys.length === 0}
                    >
                      <option value="">
                        {availableKeys.length === 0
                          ? 'No keys available for this provider'
                          : 'Select an API key'}
                      </option>
                      {availableKeys.map((key) => (
                        <option key={key.id} value={key.id}>
                          {key.name} ({key.providerId})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="session-info-display">
                    <span
                      className="provider-badge"
                      style={{
                        color: getProviderInfo(currentSession.provider)?.color,
                      }}
                    >
                      <FontAwesomeIcon
                        icon={getProviderInfo(currentSession.provider)?.icon}
                      />{' '}
                      {currentSession.provider}
                    </span>
                    <span className="model-badge">{currentSession.model}</span>
                  </div>
                </div>
                <div className="input-area">
                  <textarea
                    ref={messageInputRef}
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message here... (Shift+Enter for new line)"
                    disabled={!selectedKey || state.isLoading}
                    rows={3}
                  />
                  <button
                    className="send-btn"
                    onClick={handleSendMessage}
                    disabled={
                      !messageInput.trim() || !selectedKey || state.isLoading
                    }
                  >
                    {state.isLoading ? '⏳ Sending...' : '📤 Send'}
                  </button>
                </div>
                {state.error && (
                  <div className="error-message">
                    ⚠️ {state.error}
                    <button onClick={() => chatStore.clearError()}>×</button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* New Session Dialog */}
      {showNewSessionDialog && (
        <div
          className="dialog-overlay"
          onClick={() => setShowNewSessionDialog(false)}
        >
          <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3>Create New Chat Session</h3>
              <button
                className="close-btn"
                onClick={() => setShowNewSessionDialog(false)}
              >
                ×
              </button>
            </div>
            <div className="dialog-body">
              <div className="form-group">
                <label>Session Name</label>
                <input
                  type="text"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  placeholder="e.g., Project Discussion"
                />
              </div>
              <div className="form-group">
                <label>AI Provider</label>
                <select
                  value={selectedProvider}
                  onChange={(e) => {
                    setSelectedProvider(e.target.value);
                    setSelectedModel('');
                  }}
                >
                  {CHAT_PROVIDERS.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Model</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  disabled={!selectedProvider}
                >
                  <option value="">Select a model...</option>
                  {getModelsForProvider(selectedProvider).map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} ({model.maxTokens.toLocaleString()} tokens)
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="dialog-footer">
              <button
                className="button-secondary"
                onClick={() => setShowNewSessionDialog(false)}
              >
                Cancel
              </button>
              <button
                className="button-primary"
                onClick={handleCreateSession}
                disabled={!newSessionName.trim() || !selectedModel}
              >
                Create Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
