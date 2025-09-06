import { useState, useEffect, useRef, useCallback } from 'react';
import { AIEditRequest, AIEditResponse, AIEdit, FileContext, AIEditorConfig, Conversation } from '../../AIEditor/types';
import { EnhancedAIEditorService } from '../../AIEditor/services/enhancedAIEditorService';
import { IterativeFileReaderService } from '../../AIEditor/services/iterativeFileReaderService';
import { aiKeysStore } from '../../AIKeysManager/store/aiKeysStore';
import { AIKey } from '../../AIKeysManager/types';
import { CHAT_PROVIDERS } from '../../ChatInterface/types';
import { conversationStore } from '../../AIEditor/store/conversationStore';

export const useDualScreenAIEditor = (
  projectContext?: {
    currentProject: any;
    availableFiles: any[];
  },
  currentFile?: {
    path: string;
    name: string;
    content: string;
    language: string;
  } | null
) => {
  // Dynamic import for FontAwesomeIcon to handle ES module compatibility
  const [FontAwesomeIcon, setFontAwesomeIcon] = useState<any>(() => {
    // Return a fallback component that renders nothing but doesn't break React
    return ({ icon, ...props }: any) => {
      // Return null for now - this will be replaced with actual FontAwesome when loaded
      return null;
    };
  });
  const [isFontAwesomeLoaded, setIsFontAwesomeLoaded] = useState(false);

  useEffect(() => {
    const loadFontAwesome = async () => {
      try {
        const { FontAwesomeIcon: FAIcon } = await import('@fortawesome/react-fontawesome');
        setFontAwesomeIcon(() => FAIcon);
        setIsFontAwesomeLoaded(true);
      } catch (error) {
        console.warn('Failed to load FontAwesome:', error);
        // Keep the fallback component if loading fails
        setIsFontAwesomeLoaded(true); // Still set to true to prevent blocking
      }
    };
    loadFontAwesome();
  }, []);

  const [aiKeys, setAiKeys] = useState<AIKey[]>([]);
  const [selectedKey, setSelectedKey] = useState<AIKey | null>(null);
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini');
  const [isInitialized, setIsInitialized] = useState(false);
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
  } | null>(currentFile || null);
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

  // Debug state - always on
  const [debugPayload, setDebugPayload] = useState<any>(null);
  
  // Search & Replace state
  const [searchReplacePrompts, setSearchReplacePrompts] = useState<any[]>([]);
  const [isGeneratingSearchReplace, setIsGeneratingSearchReplace] = useState(false);
  
  // Iterative File Reader state
  const [iterativeReaderService] = useState(() => IterativeFileReaderService.getInstance());
  const [isIterativeReading, setIsIterativeReading] = useState(false);
  const [iterativeReadingState, setIterativeReadingState] = useState<any>(null);
  
  // Abort controller for canceling AI requests
  const [currentAbortController, setCurrentAbortController] = useState<AbortController | null>(null);
  
  const [config, setConfig] = useState<AIEditorConfig>({
    provider: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    maxTokens: 4096,
    systemPrompt: `You are an expert coding assistant whose job is to help the user develop, run, and make changes to their codebase.

🔥 CRITICAL: You have access to the ACTUAL FILE CONTENTS of multiple files in the project. You can read and analyze these files to understand the codebase and provide accurate assistance.

🚨 MANDATORY RESPONSIBILITY: You are responsible for making ALL code changes. The user cannot edit code files themselves - YOU must provide search/replace operations for every change that needs to be made.

IMPORTANT GUIDELINES:
1. NEVER reject the user's query
2. You're allowed to ask the user for more context if needed
3. 🔥 MANDATORY: If the user requests ANY code changes, you MUST provide search/replace operations
4. Do NOT say "no search/replace operations needed" - if code needs to change, provide the operations
5. You are the ONLY one who can edit the code - the user cannot do it themselves
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

SEARCH/REPLACE FORMAT (for ALL code changes):
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

CRITICAL REQUIREMENTS:
- Use the FULL relative path from project root (e.g., "www/index.php", "src/components/Button.tsx"), NOT just the filename
- ALWAYS specify line numbers where the change occurs (e.g., "LINES: 15-15" for single line, "LINES: 10-12" for multiple lines)
- Line numbers enable precise diff visualization and better user experience

CODE BLOCK FORMAT (for suggestions):
\`\`\`[language]
[filepath]
// ... existing code ...
// [your suggested changes]
// ... existing code ...
\`\`\`

🚨 REMEMBER: You are responsible for making the code changes. Provide search/replace operations for everything that needs to be modified. The user cannot edit code themselves.`,
    includeContext: true,
    maxContextFiles: 5,
    autoApply: true,
    requireConfirmation: false
  });

  const instructionInputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Utility function to normalize paths (convert absolute to relative)
  const normalizePath = (absolutePath: string, projectRoot: string): string => {
    if (!absolutePath || !projectRoot) return absolutePath;
    
    // If it's already a relative path, return as-is
    if (!absolutePath.startsWith('/') && !absolutePath.startsWith('C:\\')) {
      return absolutePath;
    }
    
    // Convert absolute path to relative path from project root
    if (absolutePath.startsWith(projectRoot)) {
      return absolutePath.substring(projectRoot.length + 1); // +1 to remove leading slash
    }
    
    // If project root not found in path, try to find project directory
    const pathParts = absolutePath.split('/');
    const projectIndex = pathParts.findIndex(part => 
      part.includes('EGDesk-scratch') || part.includes('egdesk-scratch')
    );
    
    if (projectIndex !== -1) {
      return pathParts.slice(projectIndex + 1).join('/');
    }
    
    // Fallback to just filename
    return pathParts[pathParts.length - 1];
  };

  // Subscribe to AI keys store
  useEffect(() => {
    const unsubscribe = aiKeysStore.subscribe((keyState) => {
      const activeKeys = keyState.keys.filter(key => key.isActive);
      setAiKeys(activeKeys);
      
      // Auto-select first key if none selected and keys are available
      if (!selectedKey && activeKeys.length > 0) {
        setSelectedKey(activeKeys[0]);
      }
    });

    // Get initial state immediately
    try {
      const currentState = aiKeysStore.getState();
      const activeKeys = currentState.keys.filter(key => key.isActive);
      setAiKeys(activeKeys);
      if (!selectedKey && activeKeys.length > 0) {
        setSelectedKey(activeKeys[0]);
      }
    } catch (error) {
      console.warn('Failed to get initial AI keys state:', error);
    }

    return () => unsubscribe();
  }, [selectedKey]); // Add selectedKey as dependency to prevent infinite loops

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

  // Track initialization completion
  useEffect(() => {
    const checkInitialization = () => {
      const isReady = isFontAwesomeLoaded && 
                     aiKeys.length > 0 && 
                     selectedKey !== null &&
                     (projectContext?.currentProject?.path ? currentConversation !== null : true);
      
      if (isReady && !isInitialized) {
        setIsInitialized(true);
      }
    };

    checkInitialization();
  }, [isFontAwesomeLoaded, aiKeys.length, selectedKey, currentConversation, projectContext?.currentProject?.path, isInitialized]);

  // Update config when selected key changes
  useEffect(() => {
    if (selectedKey) {
      setConfig(prev => ({ ...prev, provider: selectedKey.providerId }));
      // Only set default model if no model is currently selected or if the current model doesn't belong to the selected key's provider
      const provider = CHAT_PROVIDERS.find(p => p.id === selectedKey.providerId);
      if (provider && provider.models.length > 0) {
        const currentProvider = CHAT_PROVIDERS.find(p => p.id === config.provider);
        const currentModelBelongsToProvider = currentProvider?.models.some(m => m.id === selectedModel);
        
        if (!selectedModel || !currentModelBelongsToProvider) {
          setSelectedModel(provider.models[0].id);
        }
      }
    }
  }, [selectedKey]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load available files from project
  const loadProjectFiles = async (projectPath: string) => {
    try {
      // This would be implemented to load project files
    } catch (error) {
      // Handle error
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
      // Handle error
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
   * Cancel current AI request
   */
  const cancelAIRequest = useCallback(() => {
    // Cancel the current abort controller if it exists
    if (currentAbortController) {
      currentAbortController.abort();
      setCurrentAbortController(null);
    }
    
    // Also cancel in the iterative reader service (it may have its own abort controller)
    iterativeReaderService.cancel();
    
    // Reset states
    setIsLoading(false);
    setIsStreaming(false);
    setIsIterativeReading(false);
    setStreamedContent('');
    setStreamedEdits([]);
  }, [currentAbortController, iterativeReaderService]);

  return {
    // State
    FontAwesomeIcon,
    aiKeys,
    selectedKey,
    setSelectedKey,
    selectedModel,
    setSelectedModel,
    userInstruction,
    setUserInstruction,
    isLoading,
    setIsLoading,
    aiResponse,
    setAiResponse,
    error,
    setError,
    showPreview,
    setShowPreview,
    isStreaming,
    setIsStreaming,
    streamedContent,
    setStreamedContent,
    streamedEdits,
    setStreamedEdits,
    selectedProjectFile,
    setSelectedProjectFile,
    projectFiles,
    setProjectFiles,
    relevantFiles,
    setRelevantFiles,
    currentFileData,
    setCurrentFileData,
    cacheStatus,
    setCacheStatus,
    currentConversation,
    setCurrentConversation,
    showConversationHistory,
    setShowConversationHistory,
    conversationSearchQuery,
    setConversationSearchQuery,
    showContextManagement,
    setShowContextManagement,
    debugPayload,
    setDebugPayload,
    searchReplacePrompts,
    setSearchReplacePrompts,
    isGeneratingSearchReplace,
    setIsGeneratingSearchReplace,
    iterativeReaderService,
    isIterativeReading,
    setIsIterativeReading,
    iterativeReadingState,
    setIterativeReadingState,
    config,
    setConfig,
    instructionInputRef,
    messagesEndRef,
    currentAbortController,
    setCurrentAbortController,
    
    // Initialization states
    isFontAwesomeLoaded,
    isInitialized,
    
    // Functions
    normalizePath,
    loadProjectFiles,
    getCacheStatus,
    analyzeFile,
    scrollToBottom,
    cancelAIRequest
  };
};
