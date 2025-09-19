/**
 * AI Chat Component
 * Integrated with AI Keys Manager for automatic Gemini configuration
 */

import React, { useState, useEffect, useRef } from 'react';
import { AIService } from '../../../services/ai-service';
import { aiKeysStore } from '../../AIKeysManager/store/aiKeysStore';
import ProjectContextService from '../../../services/projectContextService';
import type { 
  ConversationMessage, 
  AIResponse, 
  AIStreamEvent, 
  ConversationState,
  ToolDefinition,
  ToolCallRequestInfo,
  ToolCallResponseInfo
} from '../../../../main/types/ai-types';
import { AIEventType } from '../../../../main/types/ai-types';
import type { AIKey } from '../../AIKeysManager/types';
import './AIChat.css';

interface AIChatProps {
  // Add props as needed
}

/**
 * Generate natural language message for tool execution
 */
const getToolExecutionMessage = (toolName: string, toolArgs?: any): string => {
  const messages: { [key: string]: string } = {
    'read_file': 'Let me read the file',
    'write_file': 'Let me write to the file',
    'list_directory': 'Let me check the directory contents',
    'run_shell_command': 'Let me run a command',
    'analyze_project': 'Let me analyze the project structure',
    'search_files': 'Let me search through the files',
    'create_file': 'Let me create a new file',
    'delete_file': 'Let me delete the file',
    'move_file': 'Let me move the file',
    'copy_file': 'Let me copy the file'
  };

  // Try to get a natural message, fallback to generic
  const naturalMessage = messages[toolName] || `Let me execute ${toolName}`;
  
  // Add context if available
  if (toolArgs) {
    if (toolArgs.path || toolArgs.file_path) {
      return `${naturalMessage}: ${toolArgs.path || toolArgs.file_path}`;
    }
    if (toolArgs.command) {
      return `${naturalMessage}: ${toolArgs.command}`;
    }
    if (toolArgs.directory || toolArgs.dir) {
      return `${naturalMessage}: ${toolArgs.directory || toolArgs.dir}`;
    }
  }
  
  return naturalMessage;
};

/**
 * Extract tool name from natural message for status updates
 */
const getToolNameFromMessage = (message: string): string => {
  // Extract the actual tool name from common patterns
  if (message.includes('read the file')) return 'read_file';
  if (message.includes('write to the file')) return 'write_file';
  if (message.includes('check the directory')) return 'list_directory';
  if (message.includes('run a command')) return 'run_shell_command';
  if (message.includes('analyze the project')) return 'analyze_project';
  if (message.includes('search through')) return 'search_files';
  if (message.includes('create a new file')) return 'create_file';
  if (message.includes('delete the file')) return 'delete_file';
  if (message.includes('move the file')) return 'move_file';
  if (message.includes('copy the file')) return 'copy_file';
  
  // Fallback: try to extract from "execute X" pattern
  const executeMatch = message.match(/execute (\w+)/);
  if (executeMatch) {
    return executeMatch[1];
  }
  
  return 'tool';
};

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
  const [toolCalls, setToolCalls] = useState<(ToolCallRequestInfo & { status: 'executing' | 'completed' | 'failed'; result?: ToolCallResponseInfo })[]>([]);
  const [isConversationActive, setIsConversationActive] = useState(false);
  
  // Live typing state
  const [isTyping, setIsTyping] = useState(false);
  const [currentMessage, setCurrentMessage] = useState<string>('');
  const [lastEventType, setLastEventType] = useState<AIEventType | null>(null);
  const [currentTurnNumber, setCurrentTurnNumber] = useState<number | null>(null);

  // Effect to update the last message with currentMessage content
  useEffect(() => {
    if (currentMessage && isTyping) {
      setMessages(prev => {
        const updated = [...prev];
        const lastMessage = updated[updated.length - 1];
        if (lastMessage && lastMessage.role === 'model' && !lastMessage.toolCallId) {
          updated[updated.length - 1] = {
            ...lastMessage,
            parts: [{ text: currentMessage }]
          };
        }
        return updated;
      });
    }
  }, [currentMessage, isTyping]);

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

    // Use autonomous conversation mode
    await handleAutonomousConversation(messageToSend);
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
        console.log('🎉 Received stream event in AIChat:', event.type, event);
        console.log('🎉 Event details:', JSON.stringify(event, null, 2));
        setStreamingEvents(prev => [...prev, event]);
        
        switch (event.type) {
          case AIEventType.Content:
            // Build the message by appending content
            const contentEvent = event as any;
            console.log('✍️ Processing content event:', contentEvent);
            
            const newContent = contentEvent.content || contentEvent.data || '';
            console.log('✍️ New content to append:', JSON.stringify(newContent), 'length:', newContent.length);
            
            if (newContent) {
              // Append text from content event to currentMessage
              setCurrentMessage(prev => {
                const updated = prev + newContent;
                console.log('✍️ Updated currentMessage:', JSON.stringify(updated));
                return updated;
              });
            } else {
              console.log('✍️ No content to append');
            }
            break;

          case AIEventType.ToolCallRequest:
            const toolCallEvent = event as any;
            const toolCall = toolCallEvent.toolCall;
            
            // Add a natural message for tool execution
            const toolMessage = getToolExecutionMessage(toolCall.name, toolCall.arguments);
            setLastEventType(AIEventType.ToolCallRequest);
            setMessages(prev => {
              const filteredPrev = prev.filter(msg => 
                !(msg.role === 'model' && msg.parts[0]?.text?.includes('🔄 Starting autonomous conversation'))
              );
              return [...filteredPrev, {
                role: 'model' as const,
                parts: [{ text: toolMessage }],
                timestamp: new Date(),
                toolCallId: toolCall.id,
                toolStatus: 'executing'
              }];
            });
            
            setToolCalls(prev => [...prev, {
              ...toolCallEvent.toolCall,
              status: 'executing'
            }]);
            break;

          case AIEventType.ToolCallResponse:
            const toolResponseEvent = event as any;
            const response = toolResponseEvent.response;
            
            // Update the tool message with completion status
            setLastEventType(AIEventType.ToolCallResponse);
            setMessages(prev => prev.map(msg => {
              if (msg.toolCallId === response.id) {
                const statusText = response.success ? 'success!' : 'failed!';
                const statusIcon = response.success ? '✅' : '❌';
                const originalText = msg.parts[0]?.text || '';
                const toolName = getToolNameFromMessage(originalText);
                
                return {
                  ...msg,
                  parts: [{ text: `${originalText}\n${toolName}: ${statusIcon} ${statusText}` }],
                  toolStatus: response.success ? 'completed' : 'failed'
                };
              }
              return msg;
            }));
            
            setToolCalls(prev => prev.map(call => 
              call.id === toolResponseEvent.response.id 
                ? { ...call, status: toolResponseEvent.response.success ? 'completed' : 'failed', result: toolResponseEvent.response }
                : call
            ));
            break;

          case AIEventType.Thought:
            const thoughtEvent = event as any;
            setLastEventType(AIEventType.Thought);
            setMessages(prev => [...prev, {
              role: 'model' as const,
              parts: [{ text: `💭 **${thoughtEvent.thought.subject}**: ${thoughtEvent.thought.description}` }],
              timestamp: new Date()
            }]);
            break;

          case AIEventType.Error:
            const errorEvent = event as any;
            setLastEventType(AIEventType.Error);
            setMessages(prev => [...prev, {
              role: 'model' as const,
              parts: [{ text: `❌ Error: ${errorEvent.error.message}` }],
              timestamp: new Date()
            }]);
            break;

          case AIEventType.LoopDetected:
            const loopEvent = event as any;
            setLastEventType(AIEventType.LoopDetected);
            setMessages(prev => [...prev, {
              role: 'model' as const,
              parts: [{ text: `🔄 Loop detected: ${loopEvent.pattern}. Stopping conversation to prevent infinite loop.` }],
              timestamp: new Date()
            }]);
            break;

          case AIEventType.Finished:
            console.log('🏁 Autonomous conversation completed');
            
            // Ensure isTyping is false as final guarantee
            setIsTyping(false);
            
            // Final cleanup of entire session
            console.log('🏁 Final cleanup - conversation stream ended');
            
            break;

          case AIEventType.TurnStarted:
            const turnEvent = event as any;
            console.log(`📬 Turn ${turnEvent.turnNumber} started`);
            
            // Create a new, empty message bubble in UI
            setMessages(prev => [...prev, {
              role: 'model' as const,
              parts: [{ text: '' }],
              timestamp: new Date()
            }]);
            
            // Set isTyping to true to show user something is happening
            setIsTyping(true);
            
            // Clear currentMessage to start fresh
            setCurrentMessage('');
            
            // Update turn state
            setCurrentTurnNumber(turnEvent.turnNumber);
            setLastEventType(AIEventType.TurnStarted);
            break;

          case AIEventType.TurnCompleted:
            const turnCompletedEvent = event as any;
            console.log(`✅ Turn ${turnCompletedEvent.turnNumber} completed`);
            
            // Set isTyping to false - typing indicator can now be hidden
            setIsTyping(false);
            
            // Final cleanup for this specific message bubble
            // The message is now fully delivered
            console.log('✅ Message fully delivered, final content:', currentMessage);
            
            setLastEventType(AIEventType.TurnCompleted);
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
      
      // Stop any ongoing typing
      setIsTyping(false);
      setCurrentMessage('');
      
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
                console.log('🧪 Testing tool execution flow...');
                
                // Simulate tool execution flow
                const mockToolCall = {
                  id: 'test-' + Date.now(),
                  name: 'read_file',
                  arguments: { path: '/test/file.txt' }
                };
                
                // Add initial tool message
                const toolMessage = getToolExecutionMessage(mockToolCall.name, mockToolCall.arguments);
                setMessages(prev => [...prev, {
                  role: 'model' as const,
                  parts: [{ text: toolMessage }],
                  timestamp: new Date(),
                  toolCallId: mockToolCall.id,
                  toolStatus: 'executing'
                }]);
                
                // Simulate completion after 2 seconds
                setTimeout(() => {
                  setMessages(prev => prev.map(msg => {
                    if (msg.toolCallId === mockToolCall.id) {
                      const originalText = msg.parts[0]?.text || '';
                      const toolName = getToolNameFromMessage(originalText);
                      
                      return {
                        ...msg,
                        parts: [{ text: `${originalText}\n${toolName}: ✅ success!` }],
                        toolStatus: 'completed' as const
                      };
                    }
                    return msg;
                  }));
                }, 2000);
                
              } catch (error) {
                console.error('🧪 Test failed:', error);
              }
            }}
            disabled={!selectedGoogleKey}
          >
            Test Tool Flow
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
          <>
            {messages.map((message, index) => (
              <div key={index} className={`message ${message.role} ${message.toolCallId ? 'tool-message' : ''} ${message.toolStatus ? `tool-${message.toolStatus}` : ''}`}>
                <div className="message-header">
                  <span className="role">
                    {message.role === 'user' ? '👤 You' : message.toolCallId ? '🔧 Tool' : '🤖 Gemini'}
                  </span>
                  <span className="timestamp">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                  {message.toolStatus && (
                    <span className={`tool-status-badge ${message.toolStatus}`}>
                      {message.toolStatus === 'executing' ? '⏳' : message.toolStatus === 'completed' ? '✅' : '❌'}
                    </span>
                  )}
                </div>
                <div className="message-content">
                  {message.parts.map((part, partIndex) => (
                    <div key={partIndex}>
                      {part.text && <pre className="message-text">{part.text}</pre>}
                    </div>
                  ))}
                  {isTyping && message.role === 'model' && message === messages[messages.length - 1] && (
                    <span className="typing-indicator">▋</span>
                  )}
                </div>
              </div>
            ))}
          </>
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