import React, { useState, useEffect, useRef } from 'react';
import { ChatSession, ChatMessage, ChatConfig, CHAT_PROVIDERS } from './types';
import { chatStore } from './store/chatStore';
import { aiKeysStore } from '../AIKeysManager/store/aiKeysStore';
import { AIKey } from '../AIKeysManager/types';
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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const unsubscribeChat = chatStore.subscribe(setState);
    const unsubscribeKeys = aiKeysStore.subscribe((keyState) => {
      setAiKeys(keyState.keys.filter(key => key.isActive));
    });

    return () => {
      unsubscribeChat();
      unsubscribeKeys();
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [state.currentSessionId, state.sessions]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCreateSession = async () => {
    if (!newSessionName.trim()) return;

    try {
      await chatStore.createSession(newSessionName, selectedProvider, selectedModel);
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
      await chatStore.sendMessage(messageInput, selectedKey, currentSession.model);
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

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getProviderInfo = (providerId: string) => {
    return CHAT_PROVIDERS.find(p => p.id === providerId);
  };

  const getModelsForProvider = (providerId: string) => {
    const provider = CHAT_PROVIDERS.find(p => p.id === providerId);
    return provider?.models || [];
  };

  const currentSession = chatStore.getCurrentSession();
  const availableKeys = aiKeys.filter(key => key.providerId === selectedProvider);

  return (
    <div className="chat-interface">
      {/* Header */}
      <div className="chat-header">
        <div className="header-left">
          <h1>💬 AI Chat</h1>
          <p>Chat with AI using your saved API keys</p>
        </div>
        <div className="header-right">
          <button
            className="new-session-btn"
            onClick={() => setShowNewSessionDialog(true)}
          >
            ➕ New Chat
          </button>
          <button
            className="settings-btn"
            onClick={() => setShowSettings(!showSettings)}
          >
            ⚙️ Settings
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
                onChange={(e) => chatStore.updateConfig({ temperature: parseFloat(e.target.value) })}
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
                onChange={(e) => chatStore.updateConfig({ maxTokens: parseInt(e.target.value) })}
              />
              <small>Maximum response length</small>
            </div>
            <div className="setting-group">
              <label>System Prompt</label>
              <textarea
                value={state.config.systemPrompt}
                onChange={(e) => chatStore.updateConfig({ systemPrompt: e.target.value })}
                placeholder="You are a helpful AI assistant..."
                rows={3}
              />
              <small>Instructions for the AI behavior</small>
            </div>
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
              state.sessions.map(session => (
                <div
                  key={session.id}
                  className={`session-item ${state.currentSessionId === session.id ? 'active' : ''}`}
                  onClick={() => chatStore.setCurrentSession(session.id)}
                >
                  <div className="session-info">
                    <div className="session-name">{session.name}</div>
                    <div className="session-meta">
                      <span className="provider-icon" style={{ color: getProviderInfo(session.provider)?.color }}>
                        {getProviderInfo(session.provider)?.icon}
                      </span>
                      <span className="model-name">{session.model}</span>
                      <span className="message-count">{session.messages.length} messages</span>
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
                  currentSession.messages.map(message => (
                    <div
                      key={message.id}
                      className={`message ${message.role}`}
                    >
                      <div className="message-header">
                        <span className="message-role">
                          {message.role === 'user' ? '👤 You' : '🤖 AI'}
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
                        {message.content}
                      </div>
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
                        const key = aiKeys.find(k => k.id === e.target.value);
                        setSelectedKey(key || null);
                      }}
                      disabled={availableKeys.length === 0}
                    >
                      <option value="">
                        {availableKeys.length === 0 
                          ? 'No keys available for this provider' 
                          : 'Select an API key'
                        }
                      </option>
                      {availableKeys.map(key => (
                        <option key={key.id} value={key.id}>
                          {key.name} ({key.providerId})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="session-info-display">
                    <span className="provider-badge" style={{ color: getProviderInfo(currentSession.provider)?.color }}>
                      {getProviderInfo(currentSession.provider)?.icon} {currentSession.provider}
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
                    disabled={!messageInput.trim() || !selectedKey || state.isLoading}
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
        <div className="dialog-overlay" onClick={() => setShowNewSessionDialog(false)}>
          <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3>Create New Chat Session</h3>
              <button className="close-btn" onClick={() => setShowNewSessionDialog(false)}>×</button>
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
                  {CHAT_PROVIDERS.map(provider => (
                    <option key={provider.id} value={provider.id}>
                      {provider.icon} {provider.name}
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
                  {getModelsForProvider(selectedProvider).map(model => (
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
