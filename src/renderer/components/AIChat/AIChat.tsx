/**
 * AI Chat Component
 * Integrated with AI Keys Manager for automatic Gemini configuration
 */

import React, { useState, useEffect, useRef } from 'react';
import { AIService } from '../../services/ai-service';
import { aiKeysStore } from '../AIKeysManager/store/aiKeysStore';
import type { ConversationMessage, AIResponse } from '../../../main/types/ai-types';
import type { AIKey } from '../AIKeysManager/types';
import './AIChat.css';

interface AIChatProps {
  // Add props as needed
}

export const AIChat: React.FC<AIChatProps> = () => {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [aiKeysState, setAiKeysState] = useState(aiKeysStore.getState());
  const [selectedGoogleKey, setSelectedGoogleKey] = useState<AIKey | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected' | 'error'>('checking');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Subscribe to AI keys store changes
    const unsubscribe = aiKeysStore.subscribe(setAiKeysState);
    checkConfiguration();
    loadHistory();
    
    return unsubscribe;
  }, []);

  useEffect(() => {
    // Auto-select the first active Google AI key
    const googleKeys = aiKeysState.keys.filter(key => 
      key.providerId === 'google' && key.isActive
    );
    
    if (googleKeys.length > 0 && !selectedGoogleKey) {
      setSelectedGoogleKey(googleKeys[0]);
      configureWithKey(googleKeys[0]);
    } else if (googleKeys.length === 0) {
      setSelectedGoogleKey(null);
      setIsConfigured(false);
      setConnectionStatus('disconnected');
    }
  }, [aiKeysState.keys, selectedGoogleKey]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const checkConfiguration = async () => {
    setConnectionStatus('checking');
    const configured = await AIService.isConfigured();
    setIsConfigured(configured);
    setConnectionStatus(configured ? 'connected' : 'disconnected');
  };

  const loadHistory = async () => {
    try {
      const history = await AIService.getHistory();
      setMessages(history);
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const configureWithKey = async (key: AIKey) => {
    setConnectionStatus('checking');
    try {
      const success = await AIService.configure({
        apiKey: key.fields.apiKey,
        model: 'gemini-1.5-flash-latest'
      });

      if (success) {
        setIsConfigured(true);
        setConnectionStatus('connected');
        console.log(`✅ Configured AI with key: ${key.name}`);
      } else {
        console.error('Failed to configure AI with key:', key.name);
        setIsConfigured(false);
        setConnectionStatus('error');
      }
    } catch (error) {
      console.error('Error configuring AI with key:', error);
      setIsConfigured(false);
      setConnectionStatus('error');
    }
  };

  const handleKeySelection = (key: AIKey) => {
    setSelectedGoogleKey(key);
    configureWithKey(key);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !isConfigured) return;

    const userMessage: ConversationMessage = {
      role: 'user',
      parts: [{ text: inputMessage.trim() }],
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response: AIResponse = await AIService.sendMessage(inputMessage.trim());
      
      if (response.success && response.content) {
        const aiMessage: ConversationMessage = {
          role: 'model',
          parts: [{ text: response.content }],
          timestamp: new Date()
        };
        setMessages(prev => [...prev, aiMessage]);
      } else {
        const errorMessage: ConversationMessage = {
          role: 'model',
          parts: [{ text: `Error: ${response.error || 'Unknown error occurred'}` }],
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ConversationMessage = {
        role: 'model',
        parts: [{ text: 'Error: Failed to send message' }],
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = async () => {
    try {
      await AIService.clearHistory();
      setMessages([]);
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'checking': return '🔄';
      case 'connected': return '🟢';
      case 'disconnected': return '🔴';
      case 'error': return '❌';
      default: return '🔴';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'checking': return 'Checking connection...';
      case 'connected': return `Connected with ${selectedGoogleKey?.name || 'Google AI'}`;
      case 'disconnected': return 'No Google AI key available';
      case 'error': return 'Connection error';
      default: return 'Disconnected';
    }
  };

  const googleKeys = aiKeysState.keys.filter(key => 
    key.providerId === 'google' && key.isActive
  );

  return (
    <div className="ai-chat">
      <div className="ai-chat-header">
        <h3>AI Assistant (Gemini)</h3>
        <div className="header-buttons">
          <div className="connection-status">
            <span className="status-icon">{getConnectionStatusIcon()}</span>
            <span className="status-text">{getConnectionStatusText()}</span>
          </div>
          <button 
            className="clear-btn" 
            onClick={handleClearHistory}
            disabled={messages.length === 0}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Google AI Key Selector */}
      {googleKeys.length > 1 && (
        <div className="key-selector">
          <label htmlFor="google-key-select">Google AI Key:</label>
          <select 
            id="google-key-select"
            value={selectedGoogleKey?.id || ''}
            onChange={(e) => {
              const key = googleKeys.find(k => k.id === e.target.value);
              if (key) handleKeySelection(key);
            }}
          >
            {googleKeys.map(key => (
              <option key={key.id} value={key.id}>
                {key.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* No Key Warning */}
      {googleKeys.length === 0 && (
        <div className="no-key-warning">
          <p>⚠️ No active Google AI keys found.</p>
          <p>Please add and activate a Google AI key in the AI Keys Manager.</p>
        </div>
      )}

      {/* Messages */}
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="welcome-message">
            <p>👋 Welcome to the AI Assistant!</p>
            <p>Start a conversation with Gemini AI.</p>
            {!isConfigured && (
              <p className="config-hint">Configure your Google AI key first to begin.</p>
            )}
          </div>
        ) : (
          messages.map((message, index) => (
            <div key={index} className={`message ${message.role}`}>
              <div className="message-header">
                <span className="role">
                  {message.role === 'user' ? '👤 You' : '🤖 Gemini'}
                </span>
                <span className="timestamp">
                  {message.timestamp.toLocaleTimeString()}
                </span>
              </div>
              <div className="message-content">
                {message.parts.map((part, partIndex) => (
                  <div key={partIndex}>
                    {part.text && <pre className="message-text">{part.text}</pre>}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="input-container">
        <textarea
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={
            !isConfigured 
              ? "Configure Google AI key first..." 
              : "Type your message... (Enter to send, Shift+Enter for new line)"
          }
          disabled={!isConfigured || isLoading}
          rows={2}
        />
        <button 
          onClick={handleSendMessage}
          disabled={!inputMessage.trim() || isLoading || !isConfigured}
          className="send-btn"
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
};