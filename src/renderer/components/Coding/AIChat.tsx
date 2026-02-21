import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRobot, faPaperPlane, faStop, faWrench, faKey, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { aiKeysStore } from '../AIKeysManager';
import type { AIKey } from '../AIKeysManager/types';
import { AIEventType } from '../../../main/types/ai-types';
import './AIChat.css';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: Date;
  toolName?: string;
  toolStatus?: 'executing' | 'completed' | 'failed';
}

const AIChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [aiKeysState, setAiKeysState] = useState(aiKeysStore.getState());
  const [selectedAnthropicKey, setSelectedAnthropicKey] = useState<AIKey | null>(null);
  const [showKeyDropdown, setShowKeyDropdown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const keySelectorRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const eventListenerCleanupRef = useRef<(() => void) | null>(null);

  // Get active Anthropic keys from store
  const anthropicKeys = useMemo(
    () => aiKeysState.keys.filter((key) => key.providerId === 'anthropic' && key.isActive),
    [aiKeysState.keys]
  );

  // Subscribe to AI keys store
  useEffect(() => {
    const unsubscribe = aiKeysStore.subscribe(setAiKeysState);
    return () => unsubscribe();
  }, []);

  // Auto-select first Anthropic key
  useEffect(() => {
    if (anthropicKeys.length === 0) {
      if (selectedAnthropicKey !== null) {
        setSelectedAnthropicKey(null);
      }
      setConfigError('No Anthropic API key found. Please add one in AI Keys Manager.');
      return;
    }

    if (!selectedAnthropicKey || !anthropicKeys.some((key) => key.id === selectedAnthropicKey.id)) {
      const nextKey = anthropicKeys[0];
      setSelectedAnthropicKey(nextKey);
      console.log('🔑 Auto-selected Anthropic API key:', nextKey.name);
    }
  }, [anthropicKeys, selectedAnthropicKey]);

  // Get project path from localStorage
  useEffect(() => {
    const storedPath = localStorage.getItem('selected-project-folder');
    console.log('📁 Retrieved from localStorage:', storedPath);
    if (storedPath) {
      setProjectPath(storedPath);
    }
  }, []);


  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close key dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (keySelectorRef.current && !keySelectorRef.current.contains(event.target as Node)) {
        setShowKeyDropdown(false);
      }
    };

    if (showKeyDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showKeyDropdown]);

  // Cleanup event listener on unmount
  useEffect(() => {
    return () => {
      if (eventListenerCleanupRef.current) {
        eventListenerCleanupRef.current();
        eventListenerCleanupRef.current = null;
      }
    };
  }, []);

  const sendMessage = async () => {
    if (!inputMessage.trim() || !projectPath || !selectedAnthropicKey) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const messageToSend = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);

    try {
      const electron = (window as any).electron;
      if (!electron?.ipcRenderer) {
        throw new Error('Electron IPC not available');
      }

      console.log('🎯 Starting Coding AI conversation with:', messageToSend);
      console.log('📁 Project path:', projectPath);

      const apiKey = selectedAnthropicKey.fields?.apiKey || '';

      // Clean up previous event listener if any
      if (eventListenerCleanupRef.current) {
        eventListenerCleanupRef.current();
        eventListenerCleanupRef.current = null;
      }

      // Setup event listener for streaming responses
      const conversationId = `coding-${Date.now()}`;

      const handleEvent = (streamEvent: any) => {
        if (streamEvent.conversationId === conversationId) {
          console.log('📥 Received stream event:', streamEvent.type);
          handleStreamEvent(streamEvent);

          // Stop loading when finished or error
          if (streamEvent.type === AIEventType.Finished || streamEvent.type === AIEventType.Error) {
            setIsLoading(false);
            // Cleanup listener after conversation ends
            if (eventListenerCleanupRef.current) {
              eventListenerCleanupRef.current();
              eventListenerCleanupRef.current = null;
            }
          }
        }
      };

      // Register event listener (the on method returns an unsubscribe function)
      const unsubscribe = electron.ipcRenderer.on('coding-ai:stream-event', handleEvent);

      // Store cleanup function
      eventListenerCleanupRef.current = unsubscribe;

      // Send message to Coding AI
      const result = await electron.ipcRenderer.invoke('coding-ai:send-message', {
        message: messageToSend,
        projectPath: projectPath,
        apiKey: apiKey,
        conversationId: conversationId,
        provider: 'anthropic',
        model: 'claude-sonnet-4-5-20250929',
        maxTurns: 20,
        timeoutMs: 300000
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to send message');
      }

      console.log('✅ Message sent to Coding AI');

    } catch (error: any) {
      console.error('Error sending message:', error);

      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${error.message || 'Failed to send message'}`,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);

      // Cleanup listener on error
      if (eventListenerCleanupRef.current) {
        eventListenerCleanupRef.current();
        eventListenerCleanupRef.current = null;
      }
    }
  };

  const handleStreamEvent = (event: any) => {
    console.log('📥 Processing event:', event.type, event);

    switch (event.type) {
      case AIEventType.Content:
        // Add or update assistant message with streaming text
        const contentData = event.data || {};
        const newContent = contentData.delta || contentData.accumulated || '';
        if (newContent) {
          setMessages(prev => {
            const lastMsg = prev[prev.length - 1];

            if (lastMsg && lastMsg.role === 'assistant' && lastMsg.id.startsWith('assistant-streaming')) {
              // Append to existing message (use delta)
              return [
                ...prev.slice(0, -1),
                { ...lastMsg, content: contentData.accumulated || (lastMsg.content + newContent) }
              ];
            } else {
              // Create new message
              return [
                ...prev,
                {
                  id: 'assistant-streaming',
                  role: 'assistant' as const,
                  content: newContent,
                  timestamp: new Date()
                }
              ];
            }
          });
        }
        break;

      case AIEventType.ToolCallRequest:
        // Show tool execution status
        const toolCall = event.data;
        const toolMessage: Message = {
          id: `tool-${toolCall.id}`,
          role: 'tool',
          content: getToolMessage(toolCall.name, toolCall.parameters || toolCall.arguments),
          timestamp: new Date(),
          toolName: toolCall.name,
          toolStatus: 'executing'
        };
        setMessages(prev => [...prev, toolMessage]);
        break;

      case AIEventType.ToolCallResponse:
        // Update tool status to completed
        const toolResponse = event.data;
        setMessages(prev => prev.map(msg =>
          msg.id === `tool-${toolResponse.id}`
            ? {
                ...msg,
                toolStatus: toolResponse.success ? 'completed' as const : 'failed' as const,
                content: toolResponse.success
                  ? msg.content
                  : msg.content + ` (Error: ${toolResponse.error})`
              }
            : msg
        ));
        break;

      case AIEventType.Finished:
        // Finalize the streaming message
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.id === 'assistant-streaming') {
            return [
              ...prev.slice(0, -1),
              { ...lastMsg, id: `assistant-${Date.now()}` }
            ];
          }
          return prev;
        });
        setIsLoading(false);
        break;

      case AIEventType.Error:
        const errorData = event.data || {};
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${errorData.error || 'Unknown error'}`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
        setIsLoading(false);
        break;

      case AIEventType.TurnStarted:
        // Turn started - could show a loading indicator
        console.log('🔄 Turn started');
        break;

      case AIEventType.TurnCompleted:
        // Turn completed
        console.log('✅ Turn completed');
        break;

      default:
        console.log('❓ Unknown event type:', event.type);
    }
  };

  const getToolMessage = (toolName: string, args?: any): string => {
    const messages: { [key: string]: string } = {
      'read_file': 'Reading file',
      'write_file': 'Writing file',
      'partial_edit': 'Editing file',
      'list_directory': 'Listing directory',
      'shell_command': 'Running command',
      'user_data_list_tables': 'Discovering database tables',
      'user_data_get_schema': 'Getting table schema',
      'user_data_query': 'Querying database',
      'user_data_search': 'Searching database',
      'user_data_aggregate': 'Computing aggregation'
    };

    const baseMessage = messages[toolName] || `Executing ${toolName}`;

    // Add context
    if (args) {
      if (args.filePath || args.file_path) {
        return `${baseMessage}: ${args.filePath || args.file_path}`;
      }
      if (args.tableName) {
        return `${baseMessage}: ${args.tableName}`;
      }
      if (args.command) {
        return `${baseMessage}: ${args.command}`;
      }
    }

    return baseMessage;
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  };

  const toggleKeyDropdown = () => {
    setShowKeyDropdown(!showKeyDropdown);
  };

  const handleKeySelection = (key: AIKey) => {
    setSelectedAnthropicKey(key);
    setShowKeyDropdown(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!projectPath) {
    return (
      <div className="ai-chat-container">
        <div className="ai-chat-empty-state">
          <FontAwesomeIcon icon={faRobot} className="ai-chat-empty-icon" />
          <h2>AI Assistant</h2>
          <p className="ai-chat-empty-message">No project selected</p>
          <p className="ai-chat-empty-hint">Please select a project folder to start</p>
        </div>
      </div>
    );
  }

  if (configError) {
    return (
      <div className="ai-chat-container">
        <div className="ai-chat-empty-state">
          <FontAwesomeIcon icon={faRobot} className="ai-chat-empty-icon" />
          <h2>AI Assistant</h2>
          <p className="ai-chat-empty-message" style={{ color: '#dc3545' }}>Error</p>
          <p className="ai-chat-empty-hint" style={{ color: '#dc3545', whiteSpace: 'pre-wrap' }}>{configError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-chat-container">
      {/* Toolbar at the top */}
      <div className="ai-chat-toolbar">
        <div className="ai-chat-project-info">
          <span className="project-label">Project:</span>
          <span className="project-path">{projectPath}</span>
        </div>

        {/* Anthropic AI Key Selector - only show if multiple keys */}
        {anthropicKeys.length > 1 && (
          <div className={`key-selector ${showKeyDropdown ? 'show-dropdown' : ''}`} ref={keySelectorRef}>
            <div className="key-info" onClick={toggleKeyDropdown}>
              <FontAwesomeIcon icon={faKey} className="key-icon" />
              <span className="key-label">Key:</span>
              <span className="key-name">
                {selectedAnthropicKey?.name || 'No key'}
              </span>
              <FontAwesomeIcon icon={faChevronDown} className="dropdown-icon" />
            </div>
            {showKeyDropdown && (
              <div className="key-dropdown">
                {anthropicKeys.map((key) => (
                  <div
                    key={key.id}
                    className={`key-option ${selectedAnthropicKey?.id === key.id ? 'selected' : ''}`}
                    onClick={() => handleKeySelection(key)}
                  >
                    <FontAwesomeIcon icon={faKey} className="key-option-icon" />
                    <span className="key-option-name">{key.name}</span>
                    {selectedAnthropicKey?.id === key.id && (
                      <span className="key-option-check">✓</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {messages.length === 0 ? (
        <div className="ai-chat-empty-state">
          <FontAwesomeIcon icon={faRobot} className="ai-chat-empty-icon" />
          <h2>AI Coding Assistant</h2>
          <p className="ai-chat-empty-message">Ask me to build features for your project</p>
          <p className="ai-chat-empty-hint">
            I can read/write files and access your EGDesk databases
          </p>
          <div className="ai-chat-examples">
            <p className="example-title">Try asking:</p>
            <button className="example-btn" onClick={() => setInputMessage("Show my sales data in a table")}>
              "Show my sales data in a table"
            </button>
            <button className="example-btn" onClick={() => setInputMessage("Create a dashboard with revenue chart")}>
              "Create a dashboard with revenue chart"
            </button>
            <button className="example-btn" onClick={() => setInputMessage("Add a search bar to filter data")}>
              "Add a search bar to filter data"
            </button>
          </div>
        </div>
      ) : (
        <div className="ai-chat-messages">
          {messages.map(msg => (
            <div key={msg.id} className={`ai-chat-message ai-chat-message-${msg.role}`}>
              {msg.role === 'tool' ? (
                <div className="ai-chat-tool-message">
                  <FontAwesomeIcon
                    icon={faWrench}
                    className={`tool-icon tool-icon-${msg.toolStatus}`}
                    spin={msg.toolStatus === 'executing'}
                  />
                  <span className="tool-text">{msg.content}</span>
                  {msg.toolStatus === 'completed' && <span className="tool-status">✓</span>}
                  {msg.toolStatus === 'failed' && <span className="tool-status tool-status-error">✗</span>}
                </div>
              ) : (
                <div className="ai-chat-message-content">
                  <div className="message-role">
                    {msg.role === 'user' ? 'You' : 'AI'}
                  </div>
                  <div className="message-text">{msg.content}</div>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      <div className="ai-chat-input-container">
        <div className="ai-chat-input-wrapper">
          <textarea
            className="ai-chat-input"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask AI to build something..."
            disabled={isLoading}
            rows={1}
          />
          {isLoading ? (
            <button className="ai-chat-send-btn ai-chat-stop-btn" onClick={stopGeneration}>
              <FontAwesomeIcon icon={faStop} />
            </button>
          ) : (
            <button
              className="ai-chat-send-btn"
              onClick={sendMessage}
              disabled={!inputMessage.trim()}
            >
              <FontAwesomeIcon icon={faPaperPlane} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIChat;
