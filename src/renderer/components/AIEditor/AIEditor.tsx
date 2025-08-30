import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AIEditRequest, AIEditResponse, AIEdit, FileContext, AIEditorConfig, Conversation, ConversationMessage } from './types';
import { EnhancedAIEditorService } from './services/enhancedAIEditorService';
import { CodespaceVectorService } from './services/codespaceVectorService';
import { aiKeysStore } from '../AIKeysManager/store/aiKeysStore';
import { AIKey } from '../AIKeysManager/types';
import { CHAT_PROVIDERS } from '../ChatInterface/types';
import { CodeEditBlock } from './CodeEditBlock';
import { conversationStore } from './store/conversationStore';
import { ContextManagementPanel } from './ContextManagementPanel';
import './AIEditor.css';

interface AIEditorProps {
  isVisible: boolean;
  currentFile: {
    path: string;
    name: string;
    content: string;
    language: string;
  } | null;
  onApplyEdits: (edits: AIEdit[]) => void;
  onClose: () => void;
  projectContext?: {
    currentProject: any;
    availableFiles: any[];
  };
  isEditing?: boolean;
  onToggleEditing?: () => void;
}

export const AIEditor: React.FC<AIEditorProps> = ({
  isVisible,
  currentFile,
  onApplyEdits,
  onClose,
  projectContext,
  isEditing = false,
  onToggleEditing
}) => {
  const [aiKeys, setAiKeys] = useState<AIKey[]>([]);
  const [selectedKey, setSelectedKey] = useState<AIKey | null>(null);
  const [selectedModel, setSelectedModel] = useState('');
  const [fileContext, setFileContext] = useState<FileContext | null>(null);
  const [userInstruction, setUserInstruction] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<AIEditResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  
  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedContent, setStreamedContent] = useState('');
  const [streamedEdits, setStreamedEdits] = useState<AIEdit[]>([]);
  const [selectedProjectFile, setSelectedProjectFile] = useState<string>('');
  const [projectFiles, setProjectFiles] = useState<any[]>([]);
  const [relevantFiles, setRelevantFiles] = useState<string[]>([]);
  const [currentFileData, setCurrentFileData] = useState<{
    path: string;
    name: string;
    content: string;
    language: string;
  } | null>(currentFile);
  const [cacheStatus, setCacheStatus] = useState<{
    hasCache: boolean;
    cacheAge?: number;
    workspacePath?: string;
    totalFiles?: number;
  }>({ hasCache: false });
  
  // Conversation state
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [showConversationHistory, setShowConversationHistory] = useState(false);
  const [conversationSearchQuery, setConversationSearchQuery] = useState('');
  
  // Context management state
  const [showContextManagement, setShowContextManagement] = useState(false);
  
  const [config, setConfig] = useState<AIEditorConfig>({
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    temperature: 0.3,
    maxTokens: 2000,
    systemPrompt: `You are an expert coding assistant whose job is to help the user develop, run, and make changes to their codebase.

You will be given instructions to follow from the user, and you may also be given context about files and the project structure.

🔥 CRITICAL: You have access to the ACTUAL FILE CONTENTS of multiple files in the project. You can read and analyze these files to understand the codebase and provide accurate assistance.

IMPORTANT GUIDELINES:
1. NEVER reject the user's query
2. You're allowed to ask the user for more context if needed
3. If you think it's appropriate to suggest an edit to a file, describe your suggestion in CODE BLOCK(S)
4. The first line of the code block must be the FULL PATH of the related file if known
5. Use comments like "// ... existing code ..." to condense your writing
6. Always bias towards writing as little as possible - NEVER write the whole file unless absolutely necessary
7. Do not make things up or use information not provided
8. Always use MARKDOWN to format lists, bullet points, etc.
9. Today's date is ${new Date().toDateString()}
10. 🔥 IMPORTANT: You have access to file contents - USE THEM! Don't say you don't have access to files when you do.

PROJECT EXPLORATION:
- You can ask the user to show you other files in the project
- You can request to see specific file contents to better understand the codebase
- You can suggest exploring related files for context
- Use phrases like "Could you show me the contents of [filename]?" or "Let me see [related file] to better understand this"
- If you need to understand how files relate to each other, ask to see multiple files

🔥 FILE ACCESS REMINDER: You have access to the actual contents of multiple files in the project. Use this information to provide accurate, context-aware assistance. Don't claim you don't have access to files when you clearly do.

When suggesting code changes, you can use either:
- SEARCH/REPLACE blocks for specific changes
- Full file rewrites for major changes
- Code block suggestions with explanations

SEARCH/REPLACE FORMAT (for specific changes):
\`\`\`
<<<<<<< ORIGINAL
// ... original code goes here
=======
// ... updated code goes here
>>>>>>> UPDATED
\`\`\`

CODE BLOCK FORMAT (for suggestions):
\`\`\`[language]
[filepath]
// ... existing code ...
// [your suggested changes]
// ... existing code ...
\`\`\`

You can work with individual files or dynamically discover and analyze files across the entire project. Instead of having all files pre-loaded, you can search for relevant files, read their contents, and understand the codebase structure as needed. Always maintain code style and follow best practices.`,
    includeContext: true,
    autoApply: false,
    requireConfirmation: true
  });

  const instructionInputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Subscribe to AI keys store
  useEffect(() => {
    const unsubscribe = aiKeysStore.subscribe((keyState) => {
      setAiKeys(keyState.keys.filter(key => key.isActive));
    });

    return () => unsubscribe();
  }, []);

  // Check cache status when project context changes
  useEffect(() => {
    if (projectContext?.currentProject?.path) {
      const checkCacheStatus = async () => {
        try {
          const status = await EnhancedAIEditorService.getCacheStatus();
          setCacheStatus(status);
        } catch (error) {
          console.log('Could not check cache status:', error);
        }
      };
      checkCacheStatus();
    }
  }, [projectContext?.currentProject?.path]);

  // Subscribe to conversation store
  useEffect(() => {
    const unsubscribe = conversationStore.subscribe((state) => {
      if (state.currentConversationId) {
        const conversation = state.conversations.find(c => c.id === state.currentConversationId);
        setCurrentConversation(conversation || null);
      } else {
        setCurrentConversation(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Create new conversation when project changes
  useEffect(() => {
    if (projectContext?.currentProject?.path && !currentConversation) {
      const projectPath = projectContext.currentProject.path;
      const projectName = projectContext.currentProject.name;
      
      // Check if there's an existing conversation for this project
      const existingConversations = conversationStore.getConversationsForProject(projectPath);
      if (existingConversations.length > 0) {
        // Use the most recent conversation
        conversationStore.setCurrentConversation(existingConversations[0].id);
      } else {
        // Create a new conversation
        conversationStore.createConversation(projectPath, projectName);
      }
    }
  }, [projectContext?.currentProject?.path, currentConversation]);

  // Update config when selected key changes
  useEffect(() => {
    if (selectedKey) {
      setConfig(prev => ({ ...prev, provider: selectedKey.providerId }));
      // Set default model for the provider
      const provider = CHAT_PROVIDERS.find(p => p.id === selectedKey.providerId);
      if (provider && provider.models.length > 0) {
        setSelectedModel(provider.models[0].id);
      }
    }
  }, [selectedKey]);

  // Update provider when config changes
  useEffect(() => {
    if (config.provider && (!selectedKey || selectedKey.providerId !== config.provider)) {
      setSelectedKey(null);
      setSelectedModel('');
    }
  }, [config.provider, selectedKey]);

  // Analyze file when current file changes
  useEffect(() => {
    if (currentFile && currentFile.path !== currentFileData?.path) {
      console.log('🚀 File changed, clearing previous AI response');
      setCurrentFileData(currentFile);
      analyzeFile(currentFile.path, currentFile.content);
      setAiResponse(null);
      setError(null);
      setShowPreview(false);
    }
  }, [currentFile?.path]); // Only depend on the file path, not the entire currentFile object

  // Load project files when project context changes
  useEffect(() => {
    console.log('AI Editor: Project context changed:', projectContext);
    if (projectContext?.currentProject) {
      console.log('AI Editor: Loading project files from:', projectContext.currentProject.path);
      loadProjectFiles(projectContext.currentProject.path);
    } else {
      console.log('AI Editor: No current project in context');
    }
  }, [projectContext]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [aiResponse, isStreaming, streamedContent]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load available files from project
  const loadProjectFiles = async (projectPath: string) => {
    try {
      // This would be implemented to load project files
      console.log('Loading project files from:', projectPath);
    } catch (error) {
      console.error('Failed to load project files:', error);
    }
  };

  /**
   * Get cache status for the current project
   */
  const getCacheStatus = async () => {
    try {
      const status = await EnhancedAIEditorService.getCacheStatus();
      setCacheStatus(status);
    } catch (error) {
      console.error('Failed to get cache status:', error);
    }
  };

  /**
   * Analyze file for context
   */
  const analyzeFile = async (filePath: string, content: string) => {
    try {
      const context = await EnhancedAIEditorService.analyzeFile(filePath, content);
      return context;
    } catch (error) {
      console.error('Failed to analyze file:', error);
      return null;
    }
  };

  /**
   * Request AI edit with streaming
   */
  const requestEditStream = async (
    aiKey: any,
    model: string,
    request: any,
    config: any,
    onChunk: (chunk: any) => void
  ) => {
    try {
      // Use our new Void-based EnhancedAIEditorService for streaming
      await EnhancedAIEditorService.requestEditStream(
        aiKey,
        model,
        request,
        config,
        onChunk
      );
    } catch (error) {
      console.error('Stream edit failed:', error);
      onChunk({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        isComplete: true
      });
    }
  };

  /**
   * Request AI edit without streaming
   */
  const requestEdit = async (
    aiKey: any,
    model: string,
    request: any,
    config: any
  ) => {
    try {
      // Use our new Void-based EnhancedAIEditorService for non-streaming
      const response = await EnhancedAIEditorService.requestEdit(
        aiKey,
        model,
        request,
        config
      );
      return response;
    } catch (error) {
      console.error('Edit request failed:', error);
      return {
        success: false,
        edits: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  };

  /**
   * Apply edits to content
   */
  const applyEdits = (content: string, edits: AIEdit[]) => {
    try {
      const newContent = EnhancedAIEditorService.applyEdits(content, edits);
      return newContent;
    } catch (error) {
      console.error('Failed to apply edits:', error);
      return content;
    }
  };

  /**
   * Force refresh of codespace analysis
   */
  const forceRefresh = async () => {
    try {
      if (projectContext?.currentProject?.path) {
        EnhancedAIEditorService.forceRefresh(projectContext.currentProject.path);
        await getCacheStatus();
      } else {
        console.warn('No project context available for refresh');
      }
    } catch (error) {
      console.error('Failed to force refresh:', error);
    }
  };

  /**
   * Search codespace for relevant files
   */
  const searchCodespace = async (userInstruction: string) => {
    try {
      const results = await EnhancedAIEditorService.searchCodespace(userInstruction, 5);
      return results;
    } catch (error) {
      console.error('Codespace search failed:', error);
      return [];
    }
  };

  // Handle edit request
  const handleRequestEdit = async () => {
    if (!selectedKey || !selectedModel || !currentFileData || !userInstruction.trim()) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setAiResponse(null);
    setShowPreview(false);
    setStreamedContent('');
    setStreamedEdits([]);

    try {
      // Normalize the file path to handle different path formats
      let normalizedPath = currentFileData.path;
      let projectRoot = '';
      
      // If the path is absolute and contains the project, extract the project root
      if (normalizedPath.startsWith('/Users/') || normalizedPath.startsWith('C:\\')) {
        // Extract the project directory path (parent of the file)
        const pathParts = normalizedPath.split('/');
        const fileName = pathParts.pop(); // Remove filename
        projectRoot = pathParts.join('/'); // Keep the directory path
        normalizedPath = fileName || currentFileData.name;
        console.log('🔍 Normalized file path from absolute to relative:', normalizedPath);
        console.log('🔍 Project root directory:', projectRoot);
      }
      
      const request: AIEditRequest = {
        filePath: normalizedPath,
        fileContent: currentFileData.content,
        userInstruction: userInstruction,
        language: currentFileData.language,
        projectRoot: projectRoot, // Add project root for codespace analysis
        context: config.includeContext ? fileContext ? {
          imports: fileContext.imports || [],
          classes: fileContext.classes || [],
          functions: fileContext.functions || [],
          variables: fileContext.variables || []
        } : undefined : undefined
      };

      // Save user message to conversation
      conversationStore.addMessage(userInstruction, 'user', {
        filePath: normalizedPath,
        language: currentFileData.language
      });

      if (config.provider === 'openai' && selectedModel.includes('gpt-4')) {
        // Use streaming for GPT-4 models
        setIsStreaming(true);
        await requestEditStream(
          selectedKey,
        selectedModel,
          request,
          config,
          (chunk) => {
            if (chunk.type === 'content') {
              setStreamedContent(prev => prev + chunk.content);
            } else if (chunk.type === 'edit' && chunk.edit) {
              setStreamedEdits(prev => [...prev, chunk.edit!]);
            }
          }
        );
            setIsStreaming(false);
        
        // Convert streamed content to response
        const response: AIEditResponse = {
                success: true,
          edits: streamedEdits,
          explanation: 'Streamed response completed',
          usage: { 
            promptTokens: 0, 
            completionTokens: 0, 
            totalTokens: 0 
          },
          cost: 0
        };
        setAiResponse(response);

        // Save AI response to conversation
        conversationStore.addMessage(
          response.explanation || 'Streamed response completed',
          'ai',
          {
            filePath: normalizedPath,
            language: currentFileData.language,
            edits: response.edits,
            usage: response.usage,
            cost: response.cost,
            provider: selectedKey.providerId,
            model: selectedModel
          }
        );
                } else {
        // Use regular request for other models
        const response = await requestEdit(
          selectedKey,
          selectedModel,
          request,
          config
        );
        setAiResponse(response);

        // Save AI response to conversation
        conversationStore.addMessage(
          response.explanation || 'AI response received',
          'ai',
          {
            filePath: normalizedPath,
            language: currentFileData.language,
            edits: response.edits,
            usage: response.usage,
            cost: response.cost,
            provider: selectedKey.providerId,
            model: selectedModel
          }
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to request edit';
      setError(errorMessage);
      console.error('Edit request failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle apply edits
  const handleApplyEdits = async () => {
    if (!aiResponse?.success || !aiResponse.edits.length) return;

    try {
      const result = await applyEditsToFiles(aiResponse.edits);
      
      if (result.success) {
        console.log('✅ Edits applied successfully to:', result.modifiedFiles);
        onApplyEdits(aiResponse.edits);
        
        // Clear the response after successful application
        setAiResponse(null);
        setShowPreview(false);
        
        // Show success message
        alert(`✅ Successfully applied ${aiResponse.edits.length} edit(s) to ${result.modifiedFiles.length} file(s)`);
      } else {
        console.error('❌ Failed to apply edits:', result.errors);
        alert(`❌ Failed to apply some edits:\n${result.errors.join('\n')}`);
      }
    } catch (error) {
      console.error('Failed to apply edits:', error);
      alert(`❌ Error applying edits: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Apply edits directly to files (Cursor-style)
  const applyEditsToFiles = async (edits: AIEdit[]): Promise<{
    success: boolean;
    modifiedFiles: string[];
    errors: string[];
  }> => {
    const modifiedFiles: string[] = [];
    const errors: string[] = [];
    
    try {
      for (const edit of edits) {
        try {
          if (edit.type === 'create' && edit.filePath && edit.newText) {
            // Create new file
            const result = await window.electron.fileSystem.writeFile(edit.filePath, edit.newText);
            if (result.success) {
              modifiedFiles.push(edit.filePath);
              console.log(`Created file: ${edit.filePath}`);
            } else {
              errors.push(`Failed to create ${edit.filePath}: ${result.error}`);
            }
          } else if (edit.type === 'delete_file' && edit.filePath) {
            // Delete file
            const result = await window.electron.fileSystem.deleteItem(edit.filePath);
            if (result.success) {
              modifiedFiles.push(edit.filePath);
              console.log(`Deleted file: ${edit.filePath}`);
            } else {
              errors.push(`Failed to delete ${edit.filePath}: ${result.error}`);
            }
          } else if (edit.range && edit.newText && currentFileData) {
            // Modify existing file content
            const newContent = applyEdits(currentFileData.content, [edit]);
            const result = await window.electron.fileSystem.writeFile(currentFileData.path, newContent);
            if (result.success) {
              modifiedFiles.push(currentFileData.path);
              console.log(`Modified file: ${currentFileData.path}`);
            } else {
              errors.push(`Failed to modify ${currentFileData.path}: ${result.error}`);
            }
          } else if (edit.type === 'replace' || edit.type === 'insert' || edit.type === 'delete' || edit.type === 'format' || edit.type === 'refactor') {
            if (!edit.range || !edit.newText) {
              errors.push(`Edit operation ${edit.type} requires range and newText properties`);
            }
          } else {
            errors.push(`Invalid edit operation: ${edit.type} - missing required properties`);
          }
        } catch (error) {
          errors.push(`Error processing edit: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      return {
        success: errors.length === 0,
        modifiedFiles,
        errors
      };
    } catch (error) {
      errors.push(`Failed to apply edits: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        success: false,
        modifiedFiles,
        errors
      };
    }
  };

  // Clear error state and reset form
  const handleClearError = () => {
    setAiResponse(null);
    setError(null);
    setShowPreview(false);
    setIsLoading(false); // Ensure loading state is reset
    // Don't clear userInstruction - let user retry with same text
  };

  // Handle preview toggle
  const handlePreviewToggle = () => {
    setShowPreview(!showPreview);
  };

  // Get provider info
  const getProviderInfo = (providerId: string) => {
    return CHAT_PROVIDERS.find(p => p.id === providerId);
  };

  // Get models for provider
  const getModelsForProvider = (providerId: string) => {
    const provider = CHAT_PROVIDERS.find(p => p.id === providerId);
    return provider?.models || [];
  };

  // Filter available keys by provider
  const availableKeys = aiKeys.filter(key => key.providerId === config.provider);

  if (!isVisible) return null;

  return (
    <div className="ai-editor-sidebar">
      <div className="sidebar-header">
        <h3>🤖 AI Code Editor</h3>
        <div className="header-controls">
          {onToggleEditing && (
            <button
              className={`editor-toggle-btn ${isEditing ? 'editing' : 'server'}`}
              onClick={onToggleEditing}
              title={isEditing ? 'Switch to Server Mode' : 'Switch to Editing Mode'}
            >
              {isEditing ? '🌐 Show Server' : '✏️ Show Editor'}
            </button>
          )}
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
      </div>

      <div className="sidebar-content">
        {/* Compact Configuration Bar */}
        <div className="config-bar">
          {/* Cache Status Display */}
          {cacheStatus.hasCache && (
            <div className="cache-status">
              <span className="cache-indicator">💾</span>
              <span className="cache-info">
                Using cached analysis ({cacheStatus.cacheAge}min old, {cacheStatus.totalFiles} files)
              </span>
              <button 
                className="refresh-cache-btn"
                onClick={() => {
                  if (projectContext?.currentProject?.path) {
                    EnhancedAIEditorService.forceRefresh(projectContext.currentProject.path);
                  }
                }}
                title="Force refresh codespace analysis"
              >
                🔄
              </button>
              <button 
                className="test-search-btn"
                onClick={async () => {
                  if (userInstruction.trim()) {
                    console.log('🧪 Testing semantic search for:', userInstruction);
                    const results = await EnhancedAIEditorService.searchCodespace(userInstruction, 5);
                    console.log('🧪 Search results:', results);
                    alert(`Found ${results.length} relevant files! Check console for details.`);
                  } else {
                    alert('Please enter a search query first!');
                  }
                }}
                title="Test semantic search with current instruction"
              >
                🧪 Test Search
              </button>
              <button 
                className="test-ai-search-btn"
                onClick={async () => {
                  if (userInstruction.trim()) {
                    console.log('🤖 Testing AI-powered semantic search for:', userInstruction);
                    try {
                      // Test the new AI search directly
                      const vectorService = CodespaceVectorService.getInstance();
                      const results = await vectorService.searchCodespaceWithAI(userInstruction, 5);
                      console.log('🤖 AI Search results:', results);
                      
                      if (results.length > 0) {
                        const topResult = results[0];
                        alert(`🤖 AI found ${results.length} semantically relevant files!\n\nTop result: ${topResult.file.name}\nRelevance: ${topResult.relevance}\n\nCheck console for full details.`);
                      } else {
                        alert('🤖 AI search found no relevant files. This might indicate the query needs refinement.');
                      }
                    } catch (error) {
                      console.error('🤖 AI search test failed:', error);
                      alert('🤖 AI search test failed. Check console for details.');
                    }
                  } else {
                    alert('Please enter a search query first!');
                  }
                }}
                title="Test AI-powered semantic search"
              >
                🤖 Test AI Search
              </button>
            </div>
          )}

          {/* Conversation Management */}
          <div className="conversation-controls">
            <div className="conversation-info">
              <span className="conversation-indicator">💬</span>
              <span className="conversation-title">
                {currentConversation?.title || 'New Conversation'}
              </span>
              {currentConversation && (
                <span className="conversation-stats">
                  {currentConversation.messages.length} messages
                </span>
              )}
            </div>
            
            <div className="conversation-actions">
              <button
                className="history-btn"
                onClick={() => setShowConversationHistory(!showConversationHistory)}
                title="Show conversation history"
              >
                📚
              </button>
              
              {currentConversation && (
                <button
                  className="new-conversation-btn"
                  onClick={() => {
                    if (projectContext?.currentProject?.path) {
                      conversationStore.createConversation(
                        projectContext.currentProject.path,
                        projectContext.currentProject.name
                      );
                    }
                  }}
                  title="Start new conversation"
                >
                  ➕
                </button>
              )}
            </div>
          </div>
          
          <div className="config-controls">
            <button
              className="context-management-btn"
              onClick={() => setShowContextManagement(true)}
              title="Configure intelligent context management"
            >
              🧠 Context
            </button>
            
            <select
              className="provider-select"
              value={config.provider}
              onChange={(e) => {
                setConfig(prev => ({ ...prev, provider: e.target.value }));
                setSelectedKey(null);
                setSelectedModel('');
              }}
            >
              {CHAT_PROVIDERS.map(provider => (
                <option key={provider.id} value={provider.id}>
                  {provider.icon} {provider.name}
                </option>
              ))}
            </select>

              <select
              className="api-key-select"
                value={selectedKey?.id || ''}
                onChange={(e) => {
                  const key = aiKeys.find(k => k.id === e.target.value);
                  setSelectedKey(key || null);
                }}
                disabled={availableKeys.length === 0}
              >
                <option value="">
                  {availableKeys.length === 0 
                    ? 'No keys available' 
                  : 'Select API key'
                  }
                </option>
                {availableKeys.map(key => (
                  <option key={key.id} value={key.id}>
                    {key.name} ({key.providerId})
                  </option>
                ))}
              </select>

              <select
              className="model-select"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={!config.provider}
              >
              <option value="">Model...</option>
                {getModelsForProvider(config.provider).map(model => (
                  <option key={model.id} value={model.id}>
                  {model.name}
                  </option>
                ))}
              </select>

            <details className="advanced-config">
              <summary>⚙️</summary>
              <div className="advanced-config-content">
            <div className="config-group">
              <label>Temperature: {config.temperature}</label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={config.temperature}
                onChange={(e) => setConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
              />
            </div>
            <div className="config-group">
              <label>Max Tokens: {config.maxTokens}</label>
              <input
                type="range"
                min="500"
                max="8000"
                step="100"
                value={config.maxTokens}
                onChange={(e) => setConfig(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
              />
            </div>
            <div className="config-group">
              <label>
                <input
                  type="checkbox"
                  checked={config.includeContext}
                  onChange={(e) => setConfig(prev => ({ ...prev, includeContext: e.target.checked }))}
                />
                    Include context
              </label>
            </div>
            </div>
            </details>
          </div>
        </div>

        {/* File Info - Compact */}
        {currentFileData && (
          <div className="file-info-compact">
            <span className="file-name">📄 {currentFileData.name}</span>
            <span className="file-language">{currentFileData.language}</span>
            {fileContext && (
              <span className="file-size">{fileContext.size.toLocaleString()} chars</span>
            )}
          </div>
        )}

        {/* Chat Messages Area */}
        <div className="chat-messages">
          {/* Welcome Message */}
          {!aiResponse && !isStreaming && !error && (
            <div className="message ai-message">
              <div className="message-content">
                <p>👋 Hi! I'm your AI coding assistant. I can help you:</p>
                <ul>
                  <li>Refactor and improve code</li>
                  <li>Add new features and functionality</li>
                  <li>Fix bugs and issues</li>
                  <li>Explain code and concepts</li>
                  <li>Create new files and components</li>
                </ul>
                <p>Just describe what you'd like me to do with your code!</p>
                      </div>
                    </div>
                  )}

          {/* Error Message */}
          {error && (
            <div className="message error-message">
              <div className="message-content">
                <p>⚠️ {error}</p>
                <button onClick={handleClearError} className="retry-btn">Try Again</button>
                </div>
            </div>
          )}

          {/* Streaming Response */}
        {isStreaming && (
            <div className="message ai-message">
              <div className="message-content">
                <div className="streaming-indicator">
                  <span className="typing-dots">AI is typing</span>
                  <span className="typing-dots">●</span>
                  <span className="typing-dots">●</span>
                  <span className="typing-dots">●</span>
            </div>
            <div className="streaming-content">
                  {streamedContent}
              </div>
                    </div>
          </div>
        )}

        {/* AI Response */}
           {aiResponse && aiResponse.success && (
             <div className="message ai-message">
               <div className="message-content">
            <div className="response-header">
                   <span className="response-title">🤖 AI Response</span>
                   {/* Only show edit actions if there are actual code edits */}
                   {aiResponse.edits.length > 0 && (
                <div className="response-actions">
                       <button onClick={handlePreviewToggle} className="preview-btn">
                         {showPreview ? 'Hide' : 'Preview'}
                  </button>
                  <button 
                    className="apply-btn"
                    onClick={handleApplyEdits}
                    disabled={!aiResponse.edits.length}
                  >
                         ✅ Apply
                  </button>
                </div>
              )}
            </div>

                {aiResponse.explanation && (
                  <div className="explanation">
                     {aiResponse.explanation}
                  </div>
                )}
                
                 {/* Show Code Edit Block only when there are edits */}
                 {aiResponse.edits.length > 0 ? (
                   <CodeEditBlock 
                     edits={aiResponse.edits}
                     currentFile={currentFileData}
                     onPreviewToggle={handlePreviewToggle}
                     showPreview={showPreview}
                     onApply={handleApplyEdits}
                   />
                 ) : (
                   <div className="no-edits-message">
                     💬 This is a conversational response with no code changes to apply.
                        </div>
                      )}

                {aiResponse.usage && (
                  <div className="usage-info">
                    <span>Tokens: {aiResponse.usage.totalTokens}</span>
                    {aiResponse.cost && <span>Cost: ${aiResponse.cost.toFixed(4)}</span>}
                  </div>
                )}
              </div>
                  </div>
                )}

                     {/* Preview Panel - Now handled by CodeEditBlock */}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>

        {/* Conversation History Panel */}
        {showConversationHistory && (
          <div className="conversation-history-panel">
            <div className="history-header">
              <h4>💬 Conversation History</h4>
              <button
                className="close-history-btn"
                onClick={() => setShowConversationHistory(false)}
              >
                ×
              </button>
            </div>
            
            <div className="history-search">
              <input
                type="text"
                placeholder="Search conversations..."
                value={conversationSearchQuery}
                onChange={(e) => setConversationSearchQuery(e.target.value)}
                className="history-search-input"
              />
            </div>
            
            <div className="conversation-list">
              {conversationStore
                .searchConversations(conversationSearchQuery)
                .filter(conv => conv.projectPath === projectContext?.currentProject?.path)
                .map(conversation => (
                  <div
                    key={conversation.id}
                    className={`conversation-item ${
                      conversation.id === currentConversation?.id ? 'active' : ''
                    }`}
                    onClick={() => {
                      conversationStore.setCurrentConversation(conversation.id);
                      setShowConversationHistory(false);
                    }}
                  >
                    <div className="conversation-item-header">
                      <span className="conversation-item-title">{conversation.title}</span>
                      <span className="conversation-item-date">
                        {conversation.updatedAt.toLocaleDateString()}
                      </span>
                    </div>
                    <div className="conversation-item-preview">
                      {conversation.messages[0]?.content.substring(0, 100)}...
                    </div>
                    <div className="conversation-item-meta">
                      <span className="message-count">{conversation.messages.length} messages</span>
                      {conversation.tags.length > 0 && (
                        <span className="conversation-tags">
                          {conversation.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="tag">{tag}</span>
                          ))}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Input Area - Always at Bottom */}
        <div className="input-area">
          <div className="input-container">
            <textarea
              ref={instructionInputRef}
              value={userInstruction}
              onChange={(e) => setUserInstruction(e.target.value)}
              placeholder="Describe what you'd like me to do with your code..."
              rows={3}
              className="instruction-input"
              disabled={isLoading || isStreaming}
            />
                    <button 
              className="send-btn"
                      onClick={handleRequestEdit}
              disabled={!selectedKey || !selectedModel || !currentFileData || !userInstruction.trim() || isLoading || isStreaming}
            >
              {isLoading || isStreaming ? '⏳' : '🚀'}
                    </button>
                  </div>
                </div>
      </div>
      
      {/* Context Management Panel */}
      <ContextManagementPanel
        isVisible={showContextManagement}
        onClose={() => setShowContextManagement(false)}
      />
    </div>
  );
};
