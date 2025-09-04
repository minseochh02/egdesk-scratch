import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AIEditRequest, AIEditResponse, AIEdit, FileContext, AIEditorConfig, Conversation, ConversationMessage } from './types';
import { EnhancedAIEditorService } from './services/enhancedAIEditorService';
import { CodespaceVectorService } from './services/codespaceVectorService';
import { CodespaceChatService } from '../ChatInterface/services/codespaceChatService';
import { SearchReplacePromptService } from './services/searchReplacePromptService';
import { MessageContent } from '../ChatInterface/components';
import { aiKeysStore } from '../AIKeysManager/store/aiKeysStore';
import { AIKey } from '../AIKeysManager/types';
import { CHAT_PROVIDERS } from '../ChatInterface/types';
import { CodeEditBlock } from './CodeEditBlock';
import { conversationStore } from './store/conversationStore';
import { ContextManagementPanel } from './ContextManagementPanel';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRobot, faBrain, faSearch, faCheck, faRefresh, faClock, faGlobe, faEdit, faPlus, faCog, faFile, faRocket, faClipboard, faComments, faTimes, faExclamationTriangle, faBook, faBroom, faBug } from '@fortawesome/free-solid-svg-icons';
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
  const [codespaceChatService, setCodespaceChatService] = useState<CodespaceChatService | null>(null);
  
  // Debug state - always on
  const [debugPayload, setDebugPayload] = useState<any>(null);
  
  // Search & Replace state
  const [searchReplacePrompts, setSearchReplacePrompts] = useState<any[]>([]);
  const [isGeneratingSearchReplace, setIsGeneratingSearchReplace] = useState(false);
  
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
\`\`\`search-replace
FILE: complete/relative/path/from/project/root/file.ext
LINES: startLineNumber-endLineNumber
SEARCH: exact code to find
REPLACE: exact code to replace it with
\`\`\`

🚨 CRITICAL FILE PATH REQUIREMENTS:
- ALWAYS use the COMPLETE relative path from project root
- NEVER use just the filename (e.g., "index.php" ❌)
- ALWAYS include the full directory structure (e.g., "www/index.php" ✅, "egdesk-scratch/wordpress/index.php" ✅)
- Examples of CORRECT paths: "www/index.php", "src/components/Button.tsx", "egdesk-scratch/wordpress/wp-config.php"
- Examples of INCORRECT paths: "index.php", "Button.tsx", "wp-config.php"

CODE BLOCK FORMAT (for suggestions):
\`\`\`[language]
[filepath]
// ... existing code ...
// [your suggested changes]
// ... existing code ...
\`\`\`

You can work with individual files or dynamically discover and analyze files across the entire project. Instead of having all files pre-loaded, you can search for relevant files, read their contents, and understand the codebase structure as needed. Always maintain code style and follow best practices.`,
    includeContext: true,
    maxContextFiles: 5,
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
          // Silent fail - cache status check failed
        }
      };
      checkCacheStatus();
    }
  }, [projectContext?.currentProject?.path]);

  // Subscribe to conversation store
  useEffect(() => {
    const unsubscribe = conversationStore.subscribe((state) => {
      // Handle store errors
      if (state.error) {
        setError(state.error);
      } else {
        setError(null);
      }
      
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
  }, [projectContext?.currentProject?.path]); // Remove currentConversation dependency to break circular dependency

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
  }, [config.provider]); // Remove selectedKey dependency to prevent circular updates

  // Analyze file when current file changes
  useEffect(() => {
    if (currentFile && currentFile.path !== currentFileData?.path) {
      setCurrentFileData(currentFile);
      analyzeFile(currentFile.path, currentFile.content);
      setAiResponse(null);
      setError(null);
      setShowPreview(false);
    }
  }, [currentFile?.path]); // Only depend on the file path, not the entire currentFile object

  // Load project files when project context changes
  useEffect(() => {
    if (projectContext?.currentProject?.path) {
      loadProjectFiles(projectContext.currentProject.path);
      // Initialize CodespaceChatService for enhanced context
      const chatService = CodespaceChatService.getInstance();
      chatService.setWorkspacePath(projectContext.currentProject.path);
      setCodespaceChatService(chatService);
    }
  }, [projectContext?.currentProject?.path]); // Only depend on the path, not the entire projectContext object

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

    } catch (error) {

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

  // Removed legacy semantic search; we now rely on CodespaceChatService.enhanceMessageWithContext

  // Generate search/replace prompts for the current request
  const handleGenerateSearchReplace = async () => {
    if (!selectedKey || !selectedModel || !userInstruction.trim()) {
      return;
    }

    setIsGeneratingSearchReplace(true);
    setSearchReplacePrompts([]);

    try {
      const service = SearchReplacePromptService.getInstance();
      
      // Use the enhanced context if available, otherwise use current file
      if (debugPayload?.enhancedContext && debugPayload?.relevantFilesContext) {
        // Generate prompts based on the enhanced context - use the primary files, not current file
        const response = await service.generatePrompts(
          selectedKey,
          selectedModel,
          userInstruction,
          undefined, // Don't specify a target file - let the service use the enhanced context
          debugPayload.relevantFilesContext // Pass the full enhanced context
        );
        
        if (response.success) {
          setSearchReplacePrompts(response.searchReplacePrompts);
        }
      } else if (currentFileData) {
        // Generate prompts for the current file
        const response = await service.generatePromptsForFile(
          selectedKey,
          selectedModel,
          userInstruction,
          currentFileData.path,
          currentFileData.content
        );
        
        if (response.success) {
          setSearchReplacePrompts(response.searchReplacePrompts);
        }
      }
    } catch (error) {
      console.error('Failed to generate search/replace prompts:', error);
    } finally {
      setIsGeneratingSearchReplace(false);
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
        
        // Create relative path from project root instead of just filename
        // Find the project root within the absolute path
        const projectRootIndex = pathParts.findIndex(part => 
          part.includes('EGDesk-scratch') || part.includes('egdesk-scratch')
        );
        
        if (projectRootIndex !== -1) {
          // Create relative path from project root
          const relativeParts = pathParts.slice(projectRootIndex + 1);
          normalizedPath = relativeParts.length > 0 
            ? `${relativeParts.join('/')}/${fileName}`
            : fileName || currentFileData.name;
        } else {
          // Fallback to just filename if project root not found
          normalizedPath = fileName || currentFileData.name;
        }
        
        console.log('🔍 Normalized file path from absolute to relative:', normalizedPath);
        console.log('🔍 Project root directory:', projectRoot);
      }

      // Use enhanced context discovery like ChatInterface
      let enhancedUserInstruction = userInstruction;
      let relevantFilesContext = '';
      let hasEnhancedContext = false;
      
      if (codespaceChatService && config.includeContext) {
        try {
          console.log('🔍 Using enhanced context discovery for AI Editor...');
          const enhancedMessage = await codespaceChatService.enhanceMessageWithContext(
            userInstruction,
            selectedKey,
            selectedModel
          );
          
          // Extract primary files with full content and secondary metadata
          if (enhancedMessage.codespaceContext?.primaryFiles?.length && enhancedMessage.codespaceContext.primaryFiles.length > 0) {
            hasEnhancedContext = true;
            
            // Use primary files (full content) instead of search snippets
            const primaryFileContexts = enhancedMessage.codespaceContext.primaryFiles
              .map(pf => {
                const lang = pf.path.split('.').pop() || 'txt';
                return `\n--- ${pf.path} ---\n\`\`\`${lang}\n${pf.content}\n\`\`\``;
              })
              .join('\n');
            
            // Add secondary/technical metadata if available
            let secondaryContext = '';
            if (enhancedMessage.codespaceContext.secondaryTechMeta && enhancedMessage.codespaceContext.secondaryTechMeta.length > 0) {
              secondaryContext = '\n\nSecondary/Technical References:\n' + 
                enhancedMessage.codespaceContext.secondaryTechMeta
                  .map(meta => `- ${meta.category.toUpperCase()}: ${meta.path}${meta.description ? ' — ' + meta.description : ''}`)
                  .join('\n');
            }
            
            relevantFilesContext = `\n\n## Primary Project Files (Full Content):\n${primaryFileContexts}${secondaryContext}`;
            // When enhanced context exists, use ONLY the enhanced context, not the current file
            enhancedUserInstruction = userInstruction + relevantFilesContext;
            
            console.log('🔍 Enhanced instruction with PRIMARY files:', enhancedMessage.codespaceContext.primaryFiles.length, 'files');
          }
        } catch (error) {
          console.warn('🔍 Failed to enhance context, using basic context:', error);
        }
      }
      
      const request: AIEditRequest = {
        filePath: normalizedPath,
        // Disabled: avoid sending currently opened file content when enhanced context exists
        fileContent: hasEnhancedContext ? '' : currentFileData.content,
        userInstruction: enhancedUserInstruction,
        language: currentFileData.language,
        projectRoot: projectRoot, // Add project root for codespace analysis
        // Disabled: avoid appending per-open-file symbols when enhanced analyzer context is present
        context: hasEnhancedContext ? undefined : (config.includeContext ? (fileContext ? {
          imports: fileContext.imports || [],
          classes: fileContext.classes || [],
          functions: fileContext.functions || [],
          variables: fileContext.variables || []
        } : undefined) : undefined)
      };

      // (legacy) intent branch removed — unified S&R flow always runs below

      // Always capture debug payload
      setDebugPayload({
        request,
        enhancedContext: hasEnhancedContext,
        originalUserInstruction: userInstruction,
        enhancedUserInstruction,
        relevantFilesContext,
        config: {
          provider: config.provider,
          model: selectedModel,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
          includeContext: config.includeContext
        }
      });

      // Save user message to conversation
      conversationStore.addMessage(userInstruction, 'user', {
        filePath: normalizedPath,
        language: currentFileData.language
      });

      // Always use Search & Replace generation (unified flow)
      try {
        const service = SearchReplacePromptService.getInstance();
        if (debugPayload?.enhancedContext && debugPayload?.relevantFilesContext) {
          const resp = await service.generatePrompts(
            selectedKey,
            selectedModel,
            userInstruction,
            undefined,
            debugPayload.relevantFilesContext
          );
          if (resp.success) {
            setSearchReplacePrompts(resp.searchReplacePrompts);
            return;
          }
        }
        const resp = await service.generatePromptsForFile(
          selectedKey,
          selectedModel,
          userInstruction,
          currentFileData.path,
          currentFileData.content
        );
        if (resp.success) {
          setSearchReplacePrompts(resp.searchReplacePrompts);
          return;
        }
        // Fallback: show a simple error if generation failed silently
        setError('Failed to generate search/replace operations.');
      } catch (err) {
        console.error('Search/Replace generation failed:', err);
        setError('Error generating search/replace operations.');
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
        alert(`Successfully applied ${aiResponse.edits.length} edit(s) to ${result.modifiedFiles.length} file(s)`);
      } else {
        console.error('❌ Failed to apply edits:', result.errors);
        alert(`Failed to apply some edits:\n${result.errors.join('\n')}`);
      }
    } catch (error) {
      console.error('Failed to apply edits:', error);
      alert(`Error applying edits: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
            // Create new file, suggest unique path using codespace vector
            let targetPath = edit.filePath;
            try {
              if (projectContext?.currentProject?.path) {
                const vector = CodespaceVectorService.getInstance();
                targetPath = vector.suggestUniquePath(projectContext.currentProject.path, edit.filePath);
              }
            } catch {}
            const result = await window.electron.fileSystem.writeFile(targetPath, edit.newText);
            if (result.success) {
              modifiedFiles.push(targetPath);
              console.log(`Created file: ${targetPath}`);
            } else {
              errors.push(`Failed to create ${targetPath}: ${result.error}`);
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

  // Get all models across all providers (used to show all models)
  const getAllModels = () => {
    return CHAT_PROVIDERS.flatMap(provider =>
      (provider.models || []).map(model => ({
        ...model,
        providerId: provider.id,
        providerName: provider.name
      }))
    );
  };

  // Filter available keys by provider
  const availableKeys = aiKeys.filter(key => key.providerId === config.provider);

  if (!isVisible) return null;

  return (
    <div className="ai-editor-sidebar">
      

      <div className="sidebar-content">
        {/* Compact Configuration Bar */}
        <div className="config-bar">


          {/* Conversation Management */}
          <div className="conversation-controls">
            <div className="conversation-info">
              <span className="conversation-indicator"><FontAwesomeIcon icon={faComments} /></span>
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
              {onToggleEditing && (
                <button
                  className={`editor-toggle-btn ${isEditing ? 'editing' : 'server'}`}
                  onClick={onToggleEditing}
                  title={isEditing ? 'Switch to Server Mode' : 'Switch to Editing Mode'}
                >
                  {isEditing ? <><FontAwesomeIcon icon={faGlobe} /> Show Server</> : <><FontAwesomeIcon icon={faEdit} /> Show Editor</>}
                </button>
              )}
              <button
                className="history-btn"
                onClick={() => setShowConversationHistory(!showConversationHistory)}
                title="Show conversation history"
              >
                <FontAwesomeIcon icon={faBook} />
              </button>
              
              <button
                className="debug-clear-btn"
                onClick={() => setDebugPayload(null)}
                title="Clear debug payload"
              >
                <FontAwesomeIcon icon={faBroom} />
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
                  <FontAwesomeIcon icon={faPlus} />
                </button>
              )}
              
              <button className="close-btn" onClick={onClose} title="Close AI Editor">
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
          </div>
          
          <div className="config-controls">
            <button
              className="context-management-btn"
              onClick={() => setShowContextManagement(true)}
              title="Configure intelligent context management"
            >
              <FontAwesomeIcon icon={faBrain} /> Context
            </button>
            
            <select
              className="model-select"
              value={selectedModel ? `${config.provider}::${selectedModel}` : ''}
              onChange={(e) => {
                const value = e.target.value;
                if (!value) {
                  setSelectedModel('');
                  return;
                }
                const [providerId, modelId] = value.split('::');
                // Update provider to match chosen model
                setConfig(prev => ({ ...prev, provider: providerId }));
                setSelectedModel(modelId);
              }}
            >
              <option value="">Model...</option>
              {CHAT_PROVIDERS.map(provider => (
                <optgroup key={provider.id} label={provider.name}>
                  {provider.models.map(model => (
                    <option key={`${provider.id}::${model.id}`} value={`${provider.id}::${model.id}`}>
                      {model.name}
                    </option>
                  ))}
                </optgroup>
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

            
          </div>
        </div>

        {/* File Info - removed as requested */}

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
                <p><FontAwesomeIcon icon={faExclamationTriangle} /> {error}</p>
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

        {/* Debug Payload Display */}
        {debugPayload && (
          <div className="message debug-message">
            <div className="message-content">
              <div className="response-header">
                <span className="response-title"><FontAwesomeIcon icon={faBug} /> Debug Payload</span>
                <div className="response-actions">
                  <button 
                    onClick={() => setDebugPayload(null)}
                    className="close-btn"
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>
              </div>
              
              <div className="debug-payload-content">
                <h4>Enhanced Context: {debugPayload.enhancedContext ? <><FontAwesomeIcon icon={faCheck} /> Yes</> : <><FontAwesomeIcon icon={faTimes} /> No</>}</h4>
                
                <details open>
                  <summary><strong>Original User Instruction:</strong></summary>
                  <pre>{debugPayload.originalUserInstruction}</pre>
                </details>
                
                <details open>
                  <summary><strong>Enhanced User Instruction (sent to AI):</strong></summary>
                  <pre>{debugPayload.enhancedUserInstruction}</pre>
                </details>
                
                <details>
                  <summary><strong>Full Request Object:</strong></summary>
                  <pre>{JSON.stringify(debugPayload.request, null, 2)}</pre>
                </details>
                
                <details>
                  <summary><strong>Config:</strong></summary>
                  <pre>{JSON.stringify(debugPayload.config, null, 2)}</pre>
                </details>
              </div>
              
              <div className="debug-actions">
                <button 
                  onClick={() => {
                    setDebugPayload(null);
                    handleRequestEdit(); // Actually send the request
                  }}
                  className="send-anyway-btn"
                >
                  <FontAwesomeIcon icon={faRocket} /> Send to AI Anyway
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search & Replace Prompts Display */}
        {searchReplacePrompts.length > 0 && (
          <div className="message search-replace-message">
            <div className="message-content">
              <div className="response-header">
                <span className="response-title"><FontAwesomeIcon icon={faSearch} /> Search & Replace Prompts</span>
                <div className="response-actions">
                  <button 
                    onClick={() => setSearchReplacePrompts([])}
                    className="close-btn"
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>
              </div>
              
              <div className="search-replace-content">
                <h4>Generated {searchReplacePrompts.length} search/replace operation(s)</h4>
                
                {searchReplacePrompts.map((prompt, index) => (
                  <div key={prompt.id || index} className="prompt-item">
                    <div className="prompt-header">
                      <span className="prompt-number">#{index + 1}</span>
                      <span className="prompt-description">{prompt.description}</span>
                      <span className="prompt-confidence">{Math.round((prompt.confidence || 0.8) * 100)}%</span>
                    </div>
                    
                    <div className="prompt-details">
                      <div className="search-section">
                        <h5><FontAwesomeIcon icon={faSearch} /> Search for:</h5>
                        <pre className="search-text">{prompt.searchText}</pre>
                      </div>
                      
                      <div className="replace-section">
                        <h5><FontAwesomeIcon icon={faRefresh} /> Replace with:</h5>
                        <pre className="replace-text">{prompt.replaceText}</pre>
                      </div>
                      
                      {prompt.filePath && (
                        <div className="file-info">
                          <strong>File:</strong> {prompt.filePath}
                        </div>
                      )}
                      
                      {prompt.notes && (
                        <div className="notes">
                          <strong>Notes:</strong> {prompt.notes}
                        </div>
                      )}
                    </div>
                    
                    <div className="prompt-actions">
                      <button 
                        onClick={() => {
                          // TODO: Implement actual search/replace execution
                          console.log('Executing search/replace:', prompt);
                        }}
                        className="execute-btn"
                        title="Execute this search/replace operation"
                      >
                        <FontAwesomeIcon icon={faCheck} /> Execute
                      </button>
                      
                      <button 
                        onClick={() => {
                          const text = `Search: ${prompt.searchText}\nReplace: ${prompt.replaceText}`;
                          navigator.clipboard.writeText(text);
                        }}
                        className="copy-btn"
                        title="Copy search/replace text"
                      >
                        <FontAwesomeIcon icon={faClipboard} /> Copy
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* AI Response */}
           {aiResponse && aiResponse.success && (
             <div className="message ai-message">
               <div className="message-content">
            <div className="response-header">
                   <span className="response-title"><FontAwesomeIcon icon={faRobot} /> AI Response</span>
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
                         <FontAwesomeIcon icon={faCheck} /> Apply
                  </button>
                </div>
              )}
            </div>

                {aiResponse.explanation && (
                  <div className="explanation">
                     <MessageContent content={aiResponse.explanation} role="assistant" />
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
                     <FontAwesomeIcon icon={faComments} /> This is a conversational response with no code changes to apply.
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
              <h4><FontAwesomeIcon icon={faComments} /> Conversation History</h4>
              <button
                className="close-history-btn"
                onClick={() => setShowConversationHistory(false)}
              >
                <FontAwesomeIcon icon={faTimes} />
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
            <div className="input-buttons">
              <button 
                className="send-btn"
                onClick={handleRequestEdit}
                disabled={!selectedKey || !selectedModel || !currentFileData || !userInstruction.trim() || isLoading || isStreaming}
              >
                {isLoading || isStreaming ? <FontAwesomeIcon icon={faClock} /> : <FontAwesomeIcon icon={faRocket} />}
              </button>
            </div>
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
