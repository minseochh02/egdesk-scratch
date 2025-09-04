import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AIEditRequest, AIEditResponse, AIEdit, FileContext, AIEditorConfig, Conversation, ConversationMessage } from '../AIEditor/types';
import { EnhancedAIEditorService } from '../AIEditor/services/enhancedAIEditorService';
import { CodespaceVectorService } from '../AIEditor/services/codespaceVectorService';
import { CodespaceChatService } from '../ChatInterface/services/codespaceChatService';
import { SearchReplacePromptService } from '../AIEditor/services/searchReplacePromptService';
import { IterativeFileReaderService } from '../AIEditor/services/iterativeFileReaderService';
import { SearchReplacePositioningService } from '../AIEditor/services/searchReplacePositioningService';
import { MessageContent } from '../ChatInterface/components';
import { aiKeysStore } from '../AIKeysManager/store/aiKeysStore';
import { AIKey } from '../AIKeysManager/types';
import { CHAT_PROVIDERS } from '../ChatInterface/types';
import { CodeEditBlock } from '../AIEditor/CodeEditBlock';
import { conversationStore } from '../AIEditor/store/conversationStore';
import { ContextManagementPanel } from '../AIEditor/ContextManagementPanel';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRobot, faBrain, faSearch, faCheck, faRefresh, faClock, faGlobe, faEdit, faPlus, faCog, faFile, faRocket, faClipboard, faComments, faTimes, faExclamationTriangle, faBook, faBroom, faBug } from '@fortawesome/free-solid-svg-icons';
import './DualScreenAIEditor.css';
import { createDemoAIResponse, demoCurrentFile } from './demoData';

// Component to split AI explanation and show edits in the middle
interface SplitExplanationWithEditsProps {
  explanation: string;
  edits: AIEdit[];
  currentFile: {
    path: string;
    name: string;
    content: string;
    language: string;
  } | null;
  onPreviewToggle: () => void;
  showPreview: boolean;
  onApply: () => void;
}

const SplitExplanationWithEdits: React.FC<SplitExplanationWithEditsProps> = ({
  explanation,
  edits,
  currentFile,
  onPreviewToggle,
  showPreview,
  onApply
}) => {
  // Remove regular code blocks from the explanation text but preserve search-replace blocks
  // Search-replace blocks should remain in the text flow for proper positioning
  const removeCodeBlocks = (text: string) => {
    console.log('🔍 DEBUG: removeCodeBlocks input:', text);
    
    // Remove regular code blocks but preserve search-replace blocks
    // First, temporarily replace search-replace blocks with placeholders
    const searchReplacePlaceholders: string[] = [];
    let processedText = text.replace(/```search-replace[\s\S]*?```/g, (match) => {
      const placeholder = `__SEARCH_REPLACE_PLACEHOLDER_${searchReplacePlaceholders.length}__`;
      searchReplacePlaceholders.push(match);
      return placeholder;
    });
    
    // Now remove regular code blocks
    processedText = processedText.replace(/```[\s\S]*?```/g, '').trim();
    
    // Restore search-replace blocks
    searchReplacePlaceholders.forEach((placeholder, index) => {
      processedText = processedText.replace(`__SEARCH_REPLACE_PLACEHOLDER_${index}__`, placeholder);
    });
    
    console.log('🔍 DEBUG: removeCodeBlocks output:', processedText);
    console.log('🔍 DEBUG: removed content length:', text.length - processedText.length);
    console.log('🔍 DEBUG: preserved search-replace blocks:', searchReplacePlaceholders.length);
    
    return processedText;
  };

  // Use the new positioning service to properly position search-replace blocks
  const splitExplanation = (text: string) => {
    console.log('🔍 DEBUG: Using SearchReplacePositioningService for text splitting');
    
    const positioningService = SearchReplacePositioningService.getInstance();
    const result = positioningService.repositionSearchReplaceBlocks(text);
    
    console.log('🔍 DEBUG: SearchReplacePositioningService result', {
      beforeLength: result.before.length,
      afterLength: result.after.length,
      searchReplaceBlocksCount: result.searchReplaceBlocks.length
    });
    
    return {
      before: result.before,
      after: result.after
    };
  };

  const { before, after } = splitExplanation(explanation);

  return (
    <div className="split-explanation">
      {/* First part of explanation */}
      {before && (
        <div className="explanation-part explanation-before">
          <MessageContent content={before} role="assistant" />
        </div>
      )}
      
      {/* Edits block in the middle */}
      <div className="explanation-edits">
        <CodeEditBlock 
          edits={edits}
          currentFile={currentFile}
          onPreviewToggle={onPreviewToggle}
          showPreview={showPreview}
          onApply={onApply}
        />
      </div>
      
      {/* Second part of explanation */}
      {after && (
        <div className="explanation-part explanation-after">
          <MessageContent content={after} role="assistant" />
        </div>
      )}
    </div>
  );
};

interface DualScreenAIEditorProps {
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
  routeFiles?: Array<{
    path: string;
    name: string;
    content: string;
    language: string;
  }>;
  onShowDiff?: (filePath: string, diff: { before: string; after: string; lineNumber: number }) => void;
}

export const DualScreenAIEditor: React.FC<DualScreenAIEditorProps> = ({
  isVisible,
  currentFile,
  onApplyEdits,
  onClose,
  projectContext,
  isEditing = false,
  onToggleEditing,
  routeFiles = [],
  onShowDiff
}) => {
  // Debug logging for component props
  console.log('🔍 DEBUG: DualScreenAIEditor component props', {
    isVisible,
    currentFile: currentFile ? {
      path: currentFile.path,
      name: currentFile.name,
      contentLength: currentFile.content?.length,
      language: currentFile.language,
      hasContent: !!currentFile.content,
      isNull: false
    } : {
      isNull: true,
      type: typeof currentFile
    },
    projectContext: {
      hasCurrentProject: !!projectContext?.currentProject,
      projectPath: projectContext?.currentProject?.path,
      availableFilesCount: projectContext?.availableFiles?.length || 0
    },
    routeFiles: routeFiles?.map(file => ({
      path: file.path,
      name: file.name,
      contentLength: file.content?.length,
      language: file.language
    })) || [],
    isEditing,
    hasOnToggleEditing: !!onToggleEditing
  });
  const [aiKeys, setAiKeys] = useState<AIKey[]>([]);
  const [selectedKey, setSelectedKey] = useState<AIKey | null>(null);
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini');
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
  
  // Iterative File Reader state
  const [iterativeReaderService] = useState(() => IterativeFileReaderService.getInstance());
  const [isIterativeReading, setIsIterativeReading] = useState(false);
  const [iterativeReadingState, setIterativeReadingState] = useState<any>(null);
  
  // File Editor state - removed, using right panel CodeEditor instead
  
  const [config, setConfig] = useState<AIEditorConfig>({
    provider: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    maxTokens: 2000,
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
    autoApply: false,
    requireConfirmation: true
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
    console.log('🔍 DEBUG: Current file useEffect triggered', {
      currentFile: {
        path: currentFile?.path,
        name: currentFile?.name,
        contentLength: currentFile?.content?.length,
        language: currentFile?.language,
        hasContent: !!currentFile?.content
      },
      currentFileData: {
        path: currentFileData?.path,
        name: currentFileData?.name,
        contentLength: currentFileData?.content?.length,
        language: currentFileData?.language
      },
      shouldUpdate: currentFile && currentFile.path !== currentFileData?.path
    });
    
    if (currentFile && currentFile.path !== currentFileData?.path) {
      console.log('🔍 DEBUG: Current file changed, clearing file editor state', {
        newFilePath: currentFile.path,
        oldFilePath: currentFileData?.path,
        newFileContent: {
          name: currentFile.name,
          contentLength: currentFile.content?.length,
          language: currentFile.language
        }
        // File editor state removed - using right panel CodeEditor instead
      });
      
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

  // File editor state management removed - using right panel CodeEditor instead

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

  // Handle iterative file reading
  const handleIterativeReading = async () => {
    if (!selectedKey || !selectedModel || !userInstruction.trim()) {
      return;
    }
    
    // We need either currentFileData or routeFiles to proceed
    if (!currentFileData && (!routeFiles || routeFiles.length === 0)) {
      return;
    }

    setIsLoading(true);
    setIsIterativeReading(true);
    setError(null);
    console.log('🔍 DEBUG: Clearing AI response and file editor state', {
      currentShowPreview: showPreview
      // File editor state removed - using right panel CodeEditor instead
    });
    
    setAiResponse(null);
    setShowPreview(false);
    setStreamedContent('');
    setStreamedEdits([]);

    try {
      // Get available files from project
      const projectRoot = projectContext?.currentProject?.path || '';
      
      const availableFiles = [
        ...(routeFiles?.map(f => normalizePath(f.path, projectRoot)) || []),
        ...(currentFileData?.path ? [normalizePath(currentFileData.path, projectRoot)] : [])
      ].filter(Boolean);
      
      // Start iterative reading process
      const result = await iterativeReaderService.startIterativeReading(
        userInstruction,
        projectRoot,
        availableFiles,
        selectedKey,
        selectedModel,
        50000 // max content limit
      );

      if (!result.success) {
        setError(result.error || 'Failed to start iterative reading');
        return;
      }

      // Process the first AI decision
      await processIterativeDecision(result.nextAction);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start iterative reading';
      setError(errorMessage);
      console.error('Iterative reading failed:', error);
    } finally {
      setIsLoading(false);
      setIsIterativeReading(false);
    }
  };

  // Load file content and generate diff for preview
  const loadFileForEdit = async (edit: AIEdit) => {
    console.log('🔍 DEBUG: loadFileForEdit called', {
      editFilePath: edit.filePath,
      hasOldText: !!edit.oldText,
      hasNewText: !!edit.newText,
      editType: edit.type,
      editRange: edit.range,
      hasOnShowDiff: !!onShowDiff
    });

    if (!edit.filePath || !edit.oldText || !edit.newText) {
      console.log('❌ DEBUG: loadFileForEdit - Missing required data', { 
        filePath: edit.filePath, 
        oldText: edit.oldText, 
        newText: edit.newText 
      });
      return;
    }

    console.log('🔍 DEBUG: loadFileForEdit - Starting to load file', edit.filePath);

    try {
      // Read the current file content
      let result = await window.electron.fileSystem.readFile(edit.filePath);
      
      // If the file path doesn't work, try some common variations
      if (!result.success) {
        console.log('loadFileForEdit: Original path failed, trying variations');
        const pathVariations = [
          `egdesk-scratch/${edit.filePath}`,
          `egdesk-scratch/wordpress/${edit.filePath}`,
          `wordpress/${edit.filePath}`,
          edit.filePath.replace('www/', 'egdesk-scratch/wordpress/'),
          edit.filePath.replace('www/', 'wordpress/')
        ];
        
        for (const path of pathVariations) {
          console.log('loadFileForEdit: Trying path:', path);
          result = await window.electron.fileSystem.readFile(path);
          if (result.success) {
            console.log('loadFileForEdit: Found file at:', path);
            break;
          }
        }
        
        if (!result.success) {
          console.error('Failed to read file with all path variations:', result.error);
          return;
        }
      }

      const currentContent = result.content || '';
      console.log('✅ DEBUG: loadFileForEdit - File content loaded successfully', {
        filePath: edit.filePath,
        contentLength: currentContent.length,
        firstLine: currentContent.split('\n')[0],
        totalLines: currentContent.split('\n').length
      });

      // Use the line numbers from the parsed operation, or find them by searching
      let lineNumber = 1;
      
      // Check if we have valid line numbers from the parsed operation
      if (edit.range?.startLine && !isNaN(edit.range.startLine) && edit.range.startLine > 0) {
        lineNumber = edit.range.startLine;
        console.log('🔍 DEBUG: Using range startLine', { lineNumber, range: edit.range });
      } else {
        // If line numbers are not valid, try to find the actual line by searching
        const lines = currentContent.split('\n');
        console.log('🔍 DEBUG: Searching for oldText in file lines', { 
          oldText: edit.oldText, 
          totalLines: lines.length 
        });
        
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(edit.oldText)) {
            lineNumber = i + 1;
            console.log('✅ DEBUG: Found oldText at line', { lineNumber, lineContent: lines[i] });
            break;
          }
        }
      }

      // Generate the diff data
      const diffData = {
        before: edit.oldText,
        after: edit.newText,
        lineNumber: lineNumber
      };
      
      console.log('🔍 DEBUG: Calling onShowDiff callback', {
        filePath: edit.filePath,
        diffData,
        hasOnShowDiff: !!onShowDiff
      });

      // Call the parent component to show the diff in the right panel
      if (onShowDiff) {
        onShowDiff(edit.filePath, diffData);
        console.log('✅ DEBUG: onShowDiff callback called successfully');
      } else {
        console.warn('⚠️ DEBUG: onShowDiff callback not provided - diff will not be shown in right panel');
      }

    } catch (error) {
      console.error('Failed to load file for edit:', error);
    }
  };

  // Parse search/replace operations from AI response
  const parseSearchReplaceOperations = (content: string): AIEdit[] => {
    console.log('🔍 DEBUG: parseSearchReplaceOperations called', {
      contentLength: content.length,
      hasSearchReplaceBlocks: content.includes('```search-replace')
    });
    
    const operations: AIEdit[] = [];
    const projectRoot = projectContext?.currentProject?.path || '';
    
    // STRICT APPROACH: Only look for actual ```search-replace blocks
    // First, find all ```search-replace blocks in the content
    const searchReplaceBlockRegex = /```search-replace[\s\S]*?```/g;
    const searchReplaceBlocks: string[] = [];
    let match;
    
    while ((match = searchReplaceBlockRegex.exec(content)) !== null) {
      searchReplaceBlocks.push(match[0]);
    }
    
    console.log('🔍 DEBUG: Found search-replace blocks', {
      count: searchReplaceBlocks.length,
      blocks: searchReplaceBlocks.map(block => ({
        length: block.length,
        preview: block.substring(0, 100)
      }))
    });
    
    // Log the full content of each search-replace block for debugging
    searchReplaceBlocks.forEach((block, index) => {
      console.log(`🔍 DEBUG: Search-replace block ${index + 1}:`, {
        fullContent: block,
        lines: block.split('\n').map((line, i) => `${i + 1}: ${line}`)
      });
    });
    
    // If no search-replace blocks found, return empty array
    if (searchReplaceBlocks.length === 0) {
      console.log('🔍 DEBUG: No search-replace blocks found in content');
      console.log('🔍 DEBUG: Full content for analysis:', content);
      return operations;
    }
    
    // Process each search-replace block individually
    for (const block of searchReplaceBlocks) {
      console.log('🔍 DEBUG: Processing search-replace block', {
        blockLength: block.length,
        blockPreview: block.substring(0, 200)
      });
      
      // Try new format with LINES field first - create new regex instance each time
      const newFormatRegex = /```search-replace\s*\nFILE:\s*(.+?)\s*\nLINES:\s*(.+?)\s*\nSEARCH:\s*([\s\S]*?)\nREPLACE:\s*([\s\S]*?)\n```/;
      let match = newFormatRegex.exec(block);
      
      console.log('🔍 DEBUG: Regex matching attempt', {
        block: block,
        regex: newFormatRegex.toString(),
        matchResult: match,
        matchGroups: match ? match.slice(1) : null
      });
      
      if (match) {
        const rawFilePath = match[1].trim();
        const filePath = normalizePath(rawFilePath, projectRoot);
        const linesText = match[2].trim();
        const searchText = match[3].trim();
        const replaceText = match[4].trim();
        
        console.log('🔍 DEBUG: Found search-replace block (new format)', {
          rawFilePath,
          filePath,
          linesText,
          searchTextLength: searchText.length,
          replaceTextLength: replaceText.length,
          searchTextPreview: searchText.substring(0, 100),
          replaceTextPreview: replaceText.substring(0, 100)
        });

        if (filePath && searchText && replaceText) {
          // Parse line numbers (e.g., "15-15" or "10-12")
          let startLine = 1, endLine = 1;
          if (linesText) {
            const lineMatch = linesText.match(/(\d+)-(\d+)/);
            if (lineMatch) {
              const parsedStart = parseInt(lineMatch[1], 10);
              const parsedEnd = parseInt(lineMatch[2], 10);
              // Only use parsed values if they're valid numbers
              if (!isNaN(parsedStart) && !isNaN(parsedEnd)) {
                startLine = parsedStart;
                endLine = parsedEnd;
              }
            }
          }

          console.log('Parsed operation:', { filePath, linesText, startLine, endLine, searchText: searchText.substring(0, 50) });
          
          operations.push({
            type: 'replace' as const,
            filePath: filePath,
            range: {
              start: 0,
              end: 0,
              startLine: startLine,
              endLine: endLine,
              startColumn: 1,
              endColumn: 1
            },
            oldText: searchText,
            newText: replaceText,
            description: `Search and replace in ${filePath} (lines ${startLine}-${endLine})`
          });
        }
      } else {
        // Try old format without LINES - create new regex instance each time
        const oldFormatRegex = /```search-replace\s*\nFILE:\s*(.+?)\s*\nSEARCH:\s*([\s\S]*?)\nREPLACE:\s*([\s\S]*?)\n```/;
        match = oldFormatRegex.exec(block);
        
        console.log('🔍 DEBUG: Old format regex matching attempt', {
          block: block,
          regex: oldFormatRegex.toString(),
          matchResult: match,
          matchGroups: match ? match.slice(1) : null
        });
        
        if (match) {
          const rawFilePath = match[1].trim();
          const filePath = normalizePath(rawFilePath, projectRoot);
          const searchText = match[2].trim();
          const replaceText = match[3].trim();

          console.log('🔍 DEBUG: Found search-replace block (old format)', {
            rawFilePath,
            filePath,
            searchTextLength: searchText.length,
            replaceTextLength: replaceText.length,
            searchTextPreview: searchText.substring(0, 100),
            replaceTextPreview: replaceText.substring(0, 100)
          });

          if (filePath && searchText && replaceText) {
            operations.push({
              type: 'replace' as const,
              filePath: filePath,
              range: {
                start: 0,
                end: 0,
                startLine: 1,
                endLine: 1,
                startColumn: 1,
                endColumn: 1
              },
              oldText: searchText,
              newText: replaceText,
              description: `Search and replace in ${filePath} (line numbers not specified)`
            });
          }
        } else {
          console.log('🔍 DEBUG: No format matched for search-replace block', {
            block: block,
            blockLines: block.split('\n').map((line, i) => `${i + 1}: ${line}`)
          });
        }
      }
    }

    console.log('🔍 DEBUG: parseSearchReplaceOperations completed', {
      totalOperations: operations.length,
      searchReplaceBlocksFound: searchReplaceBlocks.length,
      operations: operations.map(op => ({
        filePath: op.filePath,
        type: op.type,
        hasOldText: !!op.oldText,
        hasNewText: !!op.newText,
        range: op.range
      }))
    });

    return operations;
  };

  // Process AI decision in iterative reading
  const processIterativeDecision = async (decision: any) => {
    try {
      const result = await iterativeReaderService.continueIterativeReading(
        decision,
        selectedKey!,
        selectedModel!
      );

      if (!result.success) {
        setError(result.error || 'Failed to process AI decision');
        return;
      }

      // Update state
      setIterativeReadingState(iterativeReaderService.getCurrentState());

      // If we have content, show it
      if (result.content) {
        setStreamedContent(result.content);
      }

      // If analysis is complete, show final response
      if (decision.action === 'analyze_and_respond' && result.content) {
        // Parse search/replace operations from the response
        const searchReplaceOps = parseSearchReplaceOperations(result.content);
        
        console.log('🔍 DEBUG: Setting AI response with parsed operations', {
          searchReplaceOpsCount: searchReplaceOps.length,
          searchReplaceOps: searchReplaceOps.map(op => ({
            filePath: op.filePath,
            type: op.type,
            hasOldText: !!op.oldText,
            hasNewText: !!op.newText,
            range: op.range,
            oldTextPreview: op.oldText?.substring(0, 100),
            newTextPreview: op.newText?.substring(0, 100)
          })),
          hasExplanation: !!result.content,
          rawContent: result.content?.substring(0, 500)
        });

        const newAiResponse = {
          success: true,
          edits: searchReplaceOps, // Include parsed search/replace operations
          explanation: result.content,
          usage: { 
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0 
          }
        };
        
        console.log('🔍 DEBUG: Setting AI response', {
          newAiResponse
          // File editor state removed - using right panel CodeEditor instead
        });
        
        setAiResponse(newAiResponse);
        
        // Auto-toggle to editor mode when search/replace operations are found
        if (searchReplaceOps.length > 0 && onToggleEditing && !isEditing) {
          console.log('🔍 DEBUG: Auto-toggling to editor mode due to search/replace operations found', {
            searchReplaceOpsCount: searchReplaceOps.length,
            currentIsEditing: isEditing,
            hasOnToggleEditing: !!onToggleEditing
          });
          onToggleEditing();
        }
      } else if (result.nextAction) {
        // Continue with next decision
        setTimeout(() => processIterativeDecision(result.nextAction), 1000);
      }

    } catch (error) {
      console.error('Failed to process iterative decision:', error);
      setError('Failed to process AI decision');
    }
  };

  // Handle edit request
  const handleRequestEdit = async () => {
    if (!selectedKey || !selectedModel || !userInstruction.trim()) {
      return;
    }
    
    // We need either currentFileData or routeFiles to proceed
    if (!currentFileData && (!routeFiles || routeFiles.length === 0)) {
      return;
    }

    // Always use iterative mode
    return handleIterativeReading();
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
        console.log('🔍 DEBUG: Clearing AI response after successful application', {
          currentShowPreview: showPreview
          // File editor state removed - using right panel CodeEditor instead
        });
        
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
          } else if (edit.type === 'replace' && edit.oldText && edit.newText && edit.filePath) {
            // Handle search/replace operations
            try {
              // Read the current file content
              const fileResult = await window.electron.fileSystem.readFile(edit.filePath);
              if (!fileResult.success) {
                errors.push(`Failed to read file ${edit.filePath}: ${fileResult.error}`);
                continue;
              }

              const currentContent = fileResult.content || '';
              
              // Perform search and replace
              if (currentContent.includes(edit.oldText)) {
                const newContent = currentContent.replace(edit.oldText, edit.newText);
                const writeResult = await window.electron.fileSystem.writeFile(edit.filePath, newContent);
                
                if (writeResult.success) {
                  modifiedFiles.push(edit.filePath);
                  console.log(`Search/replace successful in: ${edit.filePath}`);
                } else {
                  errors.push(`Failed to write file ${edit.filePath}: ${writeResult.error}`);
                }
              } else {
                errors.push(`Search text not found in ${edit.filePath}`);
              }
            } catch (error) {
              errors.push(`Error processing search/replace for ${edit.filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          } else if (edit.type === 'insert' || edit.type === 'delete' || edit.type === 'format' || edit.type === 'refactor') {
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
    console.log('🔍 DEBUG: Clearing error state and resetting form', {
      currentShowPreview: showPreview
      // File editor state removed - using right panel CodeEditor instead
    });
    
    setAiResponse(null);
    setError(null);
    setShowPreview(false);
    setIsLoading(false); // Ensure loading state is reset
    // Don't clear userInstruction - let user retry with same text
  };

  // Test function to load demo data
  const loadDemoData = () => {
    console.log('🧪 LOADING DEMO DATA FOR TESTING');
    console.log('📁 Demo file:', demoCurrentFile);
    
    // Create test diff content based on user's request - this tests the text replacement behavior
    const testDiffContent = {
      text: "I'm a first sentence\n\n```javascript\nfunction example() {\n  console.log('codeblock');\n}\n```\n\nI'm a second sentence\n\n```search-replace\nFILE: example.txt\nLINES: 1-1\nSEARCH: I'm a second sentence\nREPLACE: I'm a modified second sentence\n```\n\nCongratulations\n\nThis should show the text replacement working correctly. The 'I'm a second sentence' should become 'I'm a modified second sentence' and the search-replace block should disappear."
    };
    
    // Create demo AI response with the test content
    const demoResponse = {
      success: true,
      explanation: testDiffContent.text,
      edits: [
        {
          type: 'replace' as const,
          filePath: 'Taehwa_demo/www/index.php',
          range: {
            start: 0,
            end: 0,
            startLine: 100,
            endLine: 100,
            startColumn: 1,
            endColumn: 1
          },
          oldText: '<option value="0" selected="select">Product</option>',
          newText: '<option value="test" >Test</option><option value="0" selected="select">Product</option>',
          description: 'Add Test option to product dropdown (line 100)'
        },
        {
          type: 'replace' as const,
          filePath: 'Taehwa_demo/www/index.php',
          range: {
            start: 0,
            end: 0,
            startLine: 220,
            endLine: 220,
            startColumn: 1,
            endColumn: 1
          },
          oldText: '} else if (obj == 0) {',
          newText: '} else if (obj == "test") {\n                                f.SUB0.style.display = "none";\n                                f.SUB1.style.display = "none";\n                                f.SUB2.style.display = "none";\n                                f.SUB3.style.display = "none";\n                                f.SUB4.style.display = "none";\n                                f.SUB5.style.display = "none";\n                                f.SUB6.style.display = "none";\n                            } else if (obj == 0) {',
          description: 'Update showSub function to handle test option (line 220)'
        }
      ],
      usage: { 
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0 
      }
    };
    
    console.log('🔍 Demo AI response:', demoResponse);
    console.log('📊 Demo edits count:', demoResponse.edits.length);
    
    // Parse search/replace operations from the explanation content
    const parsedOps = parseSearchReplaceOperations(demoResponse.explanation);
    console.log('🔍 DEBUG: Parsed operations from explanation:', {
      count: parsedOps.length,
      operations: parsedOps.map(op => ({
        filePath: op.filePath,
        type: op.type,
        hasOldText: !!op.oldText,
        hasNewText: !!op.newText,
        range: op.range
      }))
    });
    
    // Update the demo response with parsed operations
    const updatedDemoResponse = {
      ...demoResponse,
      edits: parsedOps.length > 0 ? parsedOps : demoResponse.edits
    };
    
    console.log('🔍 Updated demo response with parsed operations:', {
      originalEditsCount: demoResponse.edits.length,
      parsedEditsCount: parsedOps.length,
      finalEditsCount: updatedDemoResponse.edits.length
    });
    
    setAiResponse(updatedDemoResponse);
    setShowPreview(true);
    
    // Auto-load the first file for editing and show diff in right panel
    if (updatedDemoResponse.edits.length > 0) {
      const firstEdit = updatedDemoResponse.edits[0];
      console.log('🎯 AUTO-LOADING FIRST EDIT FOR TESTING:', firstEdit);
      loadFileForEdit(firstEdit);
    }
    
    console.log('✅ DEMO DATA LOADED - Check right panel for diff changes');
  };

  // Expose test function to window for console access
  useEffect(() => {
    (window as any).testDiffUI = loadDemoData;
    console.log('🧪 Test function available: window.testDiffUI()');
  }, []);

  // Handle preview toggle
  const handlePreviewToggle = async () => {
    console.log('🔍 DEBUG: Preview toggle clicked', { 
      currentShowPreview: showPreview, 
      newShowPreview: !showPreview,
      hasEdits: aiResponse?.edits?.length || 0,
      currentFileData: {
        path: currentFileData?.path,
        name: currentFileData?.name,
        contentLength: currentFileData?.content?.length,
        language: currentFileData?.language
      },
      aiResponseEdits: aiResponse?.edits?.map(edit => ({
        filePath: edit.filePath,
        type: edit.type,
        hasOldText: !!edit.oldText,
        hasNewText: !!edit.newText
      })) || []
      // File editor state removed - using right panel CodeEditor instead
    });
    
    const newShowPreview = !showPreview;
    
    // If enabling preview and we have edits, automatically load the first file with edits
    if (newShowPreview && aiResponse && aiResponse.edits && aiResponse.edits.length > 0) {
      console.log('🔍 DEBUG: Enabling preview - Auto-loading first file with edits');
      
      // Find the first edit that targets a file
      const firstEdit = aiResponse.edits.find(edit => edit.filePath && edit.oldText && edit.newText);
      
      if (firstEdit) {
        console.log('🔍 DEBUG: Auto-loading file for preview:', firstEdit.filePath);
        console.log('🎯 FOCUSING TO FILE PATH:', firstEdit.filePath);
        console.log('📊 SHOWING DIFF FOR FILE:', firstEdit.filePath);
        await loadFileForEdit(firstEdit);
      }
    }
    
    setShowPreview(newShowPreview);
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
    <div className="dual-screen-ai-editor">
      

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
                  onClick={() => {
                    console.log('AI Editor: Toggle button clicked, current isEditing:', isEditing);
                    onToggleEditing();
                  }}
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
              className="test-demo-btn"
              onClick={loadDemoData}
              title="Load demo data for testing diff UI"
              style={{
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                marginRight: '8px'
              }}
            >
              🧪 Test Diff UI
            </button>
            
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

        {/* Iterative Reading Status */}
        {isIterativeReading && iterativeReadingState && (
          <div className="message iterative-reading-message">
            <div className="message-content">
              <div className="response-header">
                <span className="response-title"><FontAwesomeIcon icon={faFile} /> Iterative File Reading</span>
              </div>
              
              <div className="iterative-status">
                <div className="status-phase">
                  <strong>Phase:</strong> {iterativeReadingState.phase}
                </div>
                <div className="status-content">
                  <strong>Content Read:</strong> {iterativeReadingState.totalContentRead.toLocaleString()} / {iterativeReadingState.maxContentLimit.toLocaleString()} chars
                </div>
                <div className="status-files">
                  <strong>Files Read:</strong> {iterativeReadingState.readRanges.length}
                </div>
                
                {iterativeReadingState.readRanges.length > 0 && (
                  <div className="read-ranges">
                    <strong>Read Ranges:</strong>
                    <ul>
                      {iterativeReadingState.readRanges.map((range: any, index: number) => (
                        <li key={index}>
                          {range.filePath.split('/').pop()} (lines {range.startLine}-{range.endLine})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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
                <span className="response-title"><FontAwesomeIcon icon={faSearch} /> {searchReplacePrompts.length} Search/Replace</span>
                <button 
                  onClick={() => setSearchReplacePrompts([])}
                  className="close-btn"
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
              
              <div className="search-replace-content">
                {searchReplacePrompts.map((prompt, index) => (
                  <div key={prompt.id || index} className="prompt-item">
                    <div className="prompt-header">
                      <span className="prompt-number">#{index + 1}</span>
                      <span className="prompt-description">{prompt.description}</span>
                      {prompt.filePath && <span className="file-path">{prompt.filePath.split('/').pop()}</span>}
                    </div>
                    
                    <div className="prompt-details">
                      <div className="search-replace-pair">
                        <div className="search-text">
                          <FontAwesomeIcon icon={faSearch} /> <code>{prompt.searchText}</code>
                        </div>
                        <div className="replace-text">
                          <FontAwesomeIcon icon={faRefresh} /> <code>{prompt.replaceText}</code>
                        </div>
                      </div>
                    </div>
                    
                    <div className="prompt-actions">
                      <button 
                        onClick={() => {
                          console.log('Executing search/replace:', prompt);
                        }}
                        className="execute-btn"
                        title="Execute"
                      >
                        <FontAwesomeIcon icon={faCheck} />
                      </button>
                      
                      <button 
                        onClick={() => {
                          const text = `Search: ${prompt.searchText}\nReplace: ${prompt.replaceText}`;
                          navigator.clipboard.writeText(text);
                        }}
                        className="copy-btn"
                        title="Copy"
                      >
                        <FontAwesomeIcon icon={faClipboard} />
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
                         <FontAwesomeIcon icon={faCheck} /> Apply {aiResponse.edits.length} Change{aiResponse.edits.length !== 1 ? 's' : ''}
                  </button>
                </div>
              )}
            </div>

            {/* AI Response Content */}
            {aiResponse.explanation && (
              <div className="explanation">
                {aiResponse.edits.length > 0 ? (
                  <SplitExplanationWithEdits 
                    explanation={aiResponse.explanation}
                    edits={aiResponse.edits}
                    currentFile={currentFileData}
                    onPreviewToggle={handlePreviewToggle}
                    showPreview={showPreview}
                    onApply={handleApplyEdits}
                  />
                ) : (
                  <MessageContent content={aiResponse.explanation} role="assistant" />
                )}
              </div>
            )}
            
            {/* Show message when there are no edits */}
            {aiResponse.edits.length === 0 && (
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
                disabled={!selectedKey || !selectedModel || (!currentFileData && (!routeFiles || routeFiles.length === 0)) || !userInstruction.trim() || isLoading || isStreaming}
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
