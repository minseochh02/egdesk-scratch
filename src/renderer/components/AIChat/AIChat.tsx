/**
 * AI Chat Component
 * Integrated with AI Keys Manager for automatic Gemini configuration
 */

import React, { useState, useEffect, useRef } from 'react';
import { AIService } from '../../services/ai-service';
import { aiKeysStore } from '../AIKeysManager/store/aiKeysStore';
import ProjectContextService from '../../services/projectContextService';
import type { 
  ConversationMessage, 
  AIResponse, 
  AIStreamEvent, 
  ConversationState,
  ToolDefinition 
} from '../../../main/types/ai-types';
import { AIEventType } from '../../../main/types/ai-types';
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
  const [currentProject, setCurrentProject] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // New autonomous conversation state
  const [isAutonomousMode, setIsAutonomousMode] = useState(true);
  const [conversationState, setConversationState] = useState<ConversationState | null>(null);
  const [streamingEvents, setStreamingEvents] = useState<AIStreamEvent[]>([]);
  const [toolCalls, setToolCalls] = useState<any[]>([]);
  const [isConversationActive, setIsConversationActive] = useState(false);

  useEffect(() => {
    // Subscribe to AI keys store changes
    const unsubscribe = aiKeysStore.subscribe(setAiKeysState);
    checkConfiguration();
    loadHistory();
    
    // Subscribe to project context changes
    const unsubscribeProject = ProjectContextService.getInstance().subscribe((context) => {
      setCurrentProject(context.currentProject);
      // Send project context to main process (always send, even if null)
      window.electron.projectContext.updateContext(context);
    });

    // Also send initial project context immediately on component mount
    const initialContext = ProjectContextService.getInstance().getContext();
    if (initialContext.currentProject) {
      window.electron.projectContext.updateContext(initialContext);
      setCurrentProject(initialContext.currentProject);
    }
    
    return () => {
      unsubscribe();
      unsubscribeProject();
    };
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
    const messageToSend = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);
    setIsConversationActive(true);

    if (isAutonomousMode) {
      // Use autonomous conversation mode
      await handleAutonomousConversation(messageToSend);
    } else {
      // Use simple chat mode
      await handleLegacyConversation(messageToSend);
    }
  };

  /**
   * NEW: Handle autonomous conversation with tool execution
   */
  const handleAutonomousConversation = async (message: string) => {
    try {
      console.log('🎯 Starting autonomous conversation with:', message);
      setStreamingEvents([]);
      setToolCalls([]);

      // Add a loading indicator message immediately
      setMessages(prev => [...prev, {
        role: 'model' as const,
        parts: [{ text: '🔄 Starting autonomous conversation...' }],
        timestamp: new Date()
      }]);

      // Start autonomous conversation
      console.log('📞 Calling AIService.streamConversation...');
      
      for await (const event of AIService.streamConversation(message, {
        autoExecuteTools: true,
        maxTurns: 10, // Increased from 5 to allow more complex conversations
        timeoutMs: 300000, // 5 minutes - increased from 1 minute
        context: {
          currentProject: currentProject?.name,
          projectPath: currentProject?.path
        }
      })) {
        console.log('🎉 Received stream event:', event.type, event);
        setStreamingEvents(prev => [...prev, event]);
        
        switch (event.type) {
          case AIEventType.Content:
            // Add AI response content as it streams
            const contentEvent = event as any;
            console.log('📝 Processing content event:', contentEvent);
            
            setMessages(prev => {
              // Remove any loading messages first
              const filteredPrev = prev.filter(msg => 
                !(msg.role === 'model' && msg.parts[0]?.text?.includes('🔄 Starting autonomous conversation'))
              );
              
              const lastMessage = filteredPrev[filteredPrev.length - 1];
              if (lastMessage && lastMessage.role === 'model' && 
                  !lastMessage.parts[0]?.text?.startsWith('🔧') && 
                  !lastMessage.parts[0]?.text?.startsWith('✅') &&
                  !lastMessage.parts[0]?.text?.startsWith('❌') &&
                  !lastMessage.parts[0]?.text?.startsWith('💭')) {
                // Append to existing AI message (only if it's a content message)
                const updatedMessage = {
                  ...lastMessage,
                  parts: [{
                    text: (lastMessage.parts[0]?.text || '') + (contentEvent.content || contentEvent.data || '')
                  }]
                };
                return [...filteredPrev.slice(0, -1), updatedMessage];
              } else {
                // Create new AI message
                return [...filteredPrev, {
                  role: 'model' as const,
                  parts: [{ text: contentEvent.content || contentEvent.data || 'AI response received' }],
                  timestamp: new Date()
                }];
              }
            });
            break;

          case AIEventType.ToolCallRequest:
            const toolCallEvent = event as any;
            setToolCalls(prev => [...prev, {
              ...toolCallEvent.toolCall,
              status: 'executing'
            }]);
            
            // Add tool call indicator to messages
            setMessages(prev => [...prev, {
              role: 'model' as const,
              parts: [{ text: `🔧 Executing tool: ${toolCallEvent.toolCall.name}` }],
              timestamp: new Date()
            }]);
            break;

          case AIEventType.ToolCallResponse:
            const toolResponseEvent = event as any;
            setToolCalls(prev => prev.map(call => 
              call.id === toolResponseEvent.response.id 
                ? { ...call, status: toolResponseEvent.response.success ? 'completed' : 'failed', result: toolResponseEvent.response }
                : call
            ));

            // Add tool result to messages
            const resultText = toolResponseEvent.response.success 
              ? `✅ Tool completed: ${JSON.stringify(toolResponseEvent.response.result)}`
              : `❌ Tool failed: ${toolResponseEvent.response.error}`;
            
            setMessages(prev => [...prev, {
              role: 'model' as const,
              parts: [{ text: resultText }],
              timestamp: new Date()
            }]);
            break;

          case AIEventType.Thought:
            const thoughtEvent = event as any;
            setMessages(prev => [...prev, {
              role: 'model' as const,
              parts: [{ text: `💭 **${thoughtEvent.thought.subject}**: ${thoughtEvent.thought.description}` }],
              timestamp: new Date()
            }]);
            break;

          case AIEventType.Error:
            const errorEvent = event as any;
            setMessages(prev => [...prev, {
              role: 'model' as const,
              parts: [{ text: `❌ Error: ${errorEvent.error.message}` }],
              timestamp: new Date()
            }]);
            break;

          case AIEventType.LoopDetected:
            const loopEvent = event as any;
            setMessages(prev => [...prev, {
              role: 'model' as const,
              parts: [{ text: `🔄 Loop detected: ${loopEvent.pattern}. Stopping conversation to prevent infinite loop.` }],
              timestamp: new Date()
            }]);
            break;

          case AIEventType.Finished:
            console.log('🏁 Autonomous conversation completed');
            break;

          case AIEventType.TurnStarted:
            const turnEvent = event as any;
            console.log(`🔄 Turn ${turnEvent.turnNumber} started`);
            break;

          case AIEventType.TurnCompleted:
            const turnCompletedEvent = event as any;
            console.log(`✅ Turn ${turnCompletedEvent.turnNumber} completed`);
            break;

          default:
            // Handle any unrecognized event types
            console.log('🔍 Unhandled event type:', (event as any).type, event);
            
            // Check if this might be a content event with a different structure
            const unknownEvent = event as any;
            if (unknownEvent.content || unknownEvent.data || unknownEvent.text) {
              console.log('📝 Treating unknown event as content:', unknownEvent);
              setMessages(prev => {
                // Remove any loading messages first
                const filteredPrev = prev.filter(msg => 
                  !(msg.role === 'model' && msg.parts[0]?.text?.includes('🔄 Starting autonomous conversation'))
                );
                
                return [...filteredPrev, {
                  role: 'model' as const,
                  parts: [{ text: unknownEvent.content || unknownEvent.data || unknownEvent.text || `Unknown event: ${JSON.stringify(unknownEvent)}` }],
                  timestamp: new Date()
                }];
              });
            }
            break;
        }
      }
    } catch (error) {
      console.error('Error in autonomous conversation:', error);
      setMessages(prev => [...prev, {
        role: 'model' as const,
        parts: [{ 
          text: `❌ **Autonomous Conversation Error**\n\n${error instanceof Error ? error.message : 'Unknown error in autonomous conversation'}\n\n💡 *Try switching to Chat Mode (💬) for simple conversations, or check your connection and try again.*` 
        }],
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
      setIsConversationActive(false);
    }
  };

  /**
   * Legacy conversation handler (for backward compatibility)
   */
  const handleLegacyConversation = async (message: string) => {
    try {
      const response: AIResponse = await AIService.sendMessage(message);
      
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
      setIsConversationActive(false);
    }
  };

  const handleClearHistory = async () => {
    try {
      await AIService.clearHistory();
      setMessages([]);
      setStreamingEvents([]);
      setToolCalls([]);
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  };

  const handleCancelConversation = async () => {
    try {
      await AIService.cancelConversation();
      setIsConversationActive(false);
      setIsLoading(false);
      
      setMessages(prev => [...prev, {
        role: 'model' as const,
        parts: [{ text: '⏹️ Conversation cancelled by user.' }],
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('Error cancelling conversation:', error);
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
        <h3>AI Assistant (Gemini) {isAutonomousMode ? '🤖 Autonomous' : '💬 Chat'}</h3>
        <div className="header-buttons">
          <div className="connection-status">
            <span className="status-icon">{getConnectionStatusIcon()}</span>
            <span className="status-text">{getConnectionStatusText()}</span>
          </div>
          
          {/* Mode Toggle */}
          <button 
            className={`mode-toggle ${isAutonomousMode ? 'autonomous' : 'chat'}`}
            onClick={() => setIsAutonomousMode(!isAutonomousMode)}
            disabled={isConversationActive}
            title={isAutonomousMode ? 'Switch to simple chat mode' : 'Switch to autonomous mode with tools'}
          >
            {isAutonomousMode ? '🤖→💬' : '💬→🤖'}
          </button>

          {/* Test button for debugging */}
          <button 
            className="test-btn" 
            onClick={async () => {
              try {
                console.log('🧪 Testing simple AI...');
                await (window.electron as any).aiService.simpleAI.configure({
                  apiKey: selectedGoogleKey?.fields.apiKey || 'test',
                  model: 'gemini-1.5-flash-latest'
                });
                const response = await (window.electron as any).aiService.simpleAI.sendMessage('Hello, can you respond?');
                console.log('🧪 Simple AI response:', response);
                
                setMessages(prev => [...prev, {
                  role: 'model' as const,
                  parts: [{ text: `🧪 Test Response: ${response.content || response.error}` }],
                  timestamp: new Date()
                }]);
              } catch (error) {
                console.error('🧪 Test failed:', error);
              }
            }}
            disabled={!selectedGoogleKey}
          >
            Test
          </button>

          {/* Cancel button (only show when conversation is active) */}
          {isConversationActive && (
            <button 
              className="cancel-btn" 
              onClick={handleCancelConversation}
            >
              Cancel
            </button>
          )}

          <button 
            className="clear-btn" 
            onClick={handleClearHistory}
            disabled={messages.length === 0 || isConversationActive}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Project Context Display */}
      {currentProject && (
        <div className="project-context">
          <span className="project-indicator">📁</span>
          <span className="project-name">{currentProject.name}</span>
          <span className="project-type">({currentProject.type})</span>
          <span className="project-path">{currentProject.path}</span>
        </div>
      )}

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

      {/* Autonomous Mode Status */}
      {isAutonomousMode && (
        <div className="autonomous-status">
          <div className="status-row">
            <span className="status-label">Mode:</span>
            <span className="status-value">
              🤖 Autonomous {isConversationActive ? '(Active)' : '(Ready)'}
            </span>
          </div>
          {toolCalls.length > 0 && (
            <div className="status-row">
              <span className="status-label">Tools:</span>
              <span className="status-value">
                {toolCalls.filter(t => t.status === 'executing').length} executing, 
                {' '}{toolCalls.filter(t => t.status === 'completed').length} completed
              </span>
            </div>
          )}
          {streamingEvents.length > 0 && (
            <div className="status-row">
              <span className="status-label">Events:</span>
              <span className="status-value">{streamingEvents.length} total</span>
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="welcome-message">
            <p>👋 Welcome to the AI Assistant!</p>
            {isAutonomousMode ? (
              <>
                <p>🤖 <strong>Autonomous Mode</strong>: AI can execute tools and work independently to complete complex tasks.</p>
                <p>Available tools: read files, write files, list directories, run commands, analyze project structure.</p>
                <p>Try: "Analyze my project and create missing documentation" or "Fix all linting errors in my code"</p>
              </>
            ) : (
              <p>💬 <strong>Chat Mode</strong>: Simple conversation with Gemini AI.</p>
            )}
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
              : isAutonomousMode
                ? "Describe a task for AI to complete autonomously... (Enter to send, Shift+Enter for new line)"
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