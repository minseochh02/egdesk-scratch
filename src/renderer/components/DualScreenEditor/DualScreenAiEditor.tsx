import React, { useEffect } from 'react';
import { AIEdit, AIEditResponse } from '../AIEditor/types';
import { conversationStore } from '../AIEditor/store/conversationStore';
import { ContextManagementPanel } from '../AIEditor/ContextManagementPanel';
import { useDualScreenAIEditor } from './hooks/useDualScreenAIEditor';
import { parseSearchReplaceOperations, loadFileForEdit, applyEditsToFiles } from './utils/fileOperations';
import { restartServer } from './utils/serverOperations';
import { IterativeFileReaderService } from '../AIEditor/services/iterativeFileReaderService';

// Import sub-components
import { ConversationControls } from './components/ConversationControls';
import { ConversationHistoryPanel } from './components/ConversationHistoryPanel';
import { AIResponseDisplay } from './components/AIResponseDisplay';
import { StreamingResponse } from './components/StreamingResponse';
import { WelcomeMessage } from './components/WelcomeMessage';
import { ErrorMessage } from './components/ErrorMessage';
import { InputArea } from './components/InputArea';
import { DebugPayloadDisplay } from './components/DebugPayloadDisplay';
import { IterativeReadingStatus } from './components/IterativeReadingStatus';
import { SearchReplacePrompts } from './components/SearchReplacePrompts';

import './DualScreenAIEditor.css';

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
  const {
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
    currentFileData,
    setCurrentFileData,
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
    messagesEndRef,
    
    // Functions
    normalizePath,
    loadProjectFiles,
    getCacheStatus,
    analyzeFile,
    scrollToBottom
  } = useDualScreenAIEditor(projectContext, currentFile);

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
      });
      
      setCurrentFileData(currentFile);
      analyzeFile(currentFile.path, currentFile.content);
      
      // Console log for AI response clearing when file changes
      console.log('📁 AI RESPONSE CLEARED DUE TO FILE CHANGE:', {
        hadResponse: !!aiResponse,
        responseSuccess: aiResponse?.success,
        editsCount: aiResponse?.edits?.length || 0,
        newFilePath: currentFile.path,
        oldFilePath: currentFileData?.path,
        timestamp: new Date().toISOString()
      });
      
      setAiResponse(null);
      setError(null);
      setShowPreview(false);
    }
  }, [currentFile?.path]);

  // Load project files when project context changes
  useEffect(() => {
    if (projectContext?.currentProject?.path) {
      loadProjectFiles(projectContext.currentProject.path);
    }
  }, [projectContext?.currentProject?.path]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [aiResponse, isStreaming, streamedContent]);

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
    });
    
    setAiResponse(null);
    setShowPreview(false);
    setStreamedContent('');
    setStreamedEdits([]);

    try {
      // Get available files from project
      const projectRoot = projectContext?.currentProject?.path || '';
      console.log('🔍 DEBUG: Project root:', projectRoot);
      
      const availableFiles = [
        ...(routeFiles?.map(f => normalizePath(f.path, projectRoot)) || []),
        ...(currentFileData?.path ? [normalizePath(currentFileData.path, projectRoot)] : [])
      ].filter(Boolean);

      console.log('🔍 DEBUG: Available files:', availableFiles);
      
      // Prepare cached files from current file and route files
      const cachedFiles = [
        ...(currentFileData ? [currentFileData] : []),
        ...(routeFiles || [])
      ].filter(Boolean);

      console.log('🔍 DEBUG: Starting iterative reading with cached files', {
        cachedFilesCount: cachedFiles.length,
        cachedFiles: cachedFiles.map(f => ({ path: f.path, name: f.name, contentLength: f.content.length }))
      });

      // Start iterative reading process
      const result = await iterativeReaderService.startIterativeReading(
        userInstruction,
        projectRoot,
        availableFiles,
        selectedKey,
        selectedModel,
        50000, // max content limit
        cachedFiles
      );

      console.log('🔍 DEBUG: Iterative reading result:', result);

      if (!result.success) {
        setError(result.error || 'Failed to start iterative reading');
        return;
      }

      console.log('🔍 DEBUG: Iterative reading next action:', result.nextAction);

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

  // Process AI decision in iterative reading
  const processIterativeDecision = async (decision: any) => {
    try {
      console.log('🔍 DEBUG: Processing iterative decision', {
        decision: decision,
        selectedKey: selectedKey,
        selectedModel: selectedModel
      });

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
        const searchReplaceOps = parseSearchReplaceOperations(
          result.content, 
          projectContext?.currentProject?.path || '', 
          normalizePath
        );
        
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
        });
        
        // Add console log for AI response
        console.log('🤖 AI RESPONSE RECEIVED:', {
          success: newAiResponse.success,
          explanationLength: newAiResponse.explanation?.length || 0,
          editsCount: newAiResponse.edits.length,
          edits: newAiResponse.edits.map(edit => ({
            filePath: edit.filePath,
            type: edit.type,
            oldTextLength: edit.oldText?.length || 0,
            newTextLength: edit.newText?.length || 0,
            range: edit.range
          })),
          usage: newAiResponse.usage,
          fullExplanation: newAiResponse.explanation
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

        // Auto-apply edits (always enabled) if we have valid edits
        if (searchReplaceOps.length > 0) {
          console.log('🚀 Auto-applying edits (always enabled)', {
            editsCount: searchReplaceOps.length,
            requireConfirmation: config.requireConfirmation
          });
          
          // Set a brief timeout to allow UI to update before applying
          setTimeout(async () => {
            try {
              await handleApplyEdits();
            } catch (error) {
              console.error('Auto-apply failed:', error);
              setError(`Auto-apply failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }, 500); // 500ms delay to allow UI to show the response first
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
    console.log('🔍 DEBUG: handleRequestEdit called', {
      selectedKey: !!selectedKey,
      selectedModel,
      userInstruction: userInstruction.trim(),
      currentFileData: !!currentFileData,
      routeFiles: routeFiles?.length || 0,
      isLoading,
      isStreaming
    });

    if (!selectedKey || !selectedModel || !userInstruction.trim()) {
      console.log('❌ DEBUG: Missing required fields for sending message');
      return;
    }
    
    // We need either currentFileData or routeFiles to proceed
    if (!currentFileData && (!routeFiles || routeFiles.length === 0)) {
      console.log('❌ DEBUG: No file data available for processing');
      return;
    }

    console.log('✅ DEBUG: All conditions met, proceeding with iterative reading');
    // Always use iterative mode
    return handleIterativeReading();
  };

  // Handle apply edits - now automatically applies and restarts server
  const handleApplyEdits = async () => {
    if (!aiResponse?.success || !aiResponse.edits.length) return;

    try {
      console.log('🚀 Auto-applying edits without user confirmation...');
      const result = await applyEditsToFiles(aiResponse.edits, projectContext?.currentProject?.path);
      
      if (result.success) {
        console.log('✅ Edits applied successfully to:', result.modifiedFiles);
        onApplyEdits(aiResponse.edits);
        
        // Clear the response after successful application
        console.log('🔍 DEBUG: Clearing AI response after successful application', {
          currentShowPreview: showPreview
        });
        
        // Console log for AI response clearing after successful application
        console.log('✅ AI RESPONSE CLEARED AFTER SUCCESSFUL APPLICATION:', {
          hadResponse: !!aiResponse,
          responseSuccess: aiResponse?.success,
          editsCount: aiResponse?.edits.length || 0,
          modifiedFilesCount: result.modifiedFiles.length,
          timestamp: new Date().toISOString()
        });
        
        setAiResponse(null);
        setShowPreview(false);
        
        // Show success message briefly
        console.log(`✅ Successfully applied ${aiResponse.edits.length} edit(s) to ${result.modifiedFiles.length} file(s)`);
        
        // Automatically restart server and show changes
        console.log('🔄 Auto-restarting server to show changes...');
        const serverResult = await restartServer(projectContext);
        
        if (serverResult.success) {
          console.log('✅ Server restarted and changes are visible at:', serverResult.url);
        } else {
          console.warn('⚠️ Changes applied but server restart failed:', serverResult.error);
          // Still try to open localhost:8000 as fallback
          setTimeout(() => {
            window.open('http://localhost:8000', '_blank');
          }, 1000);
        }
        
      } else {
        console.error('❌ Failed to apply edits:', result.errors);
        setError(`Failed to apply some edits: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      console.error('Failed to apply edits:', error);
      setError(`Error applying edits: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Clear error state and reset form
  const handleClearError = () => {
    console.log('🔍 DEBUG: Clearing error state and resetting form', {
      currentShowPreview: showPreview
    });
    
    // Console log for AI response clearing
    console.log('🧹 AI RESPONSE CLEARED:', {
      hadResponse: !!aiResponse,
      responseSuccess: aiResponse?.success,
      editsCount: aiResponse?.edits?.length || 0,
      timestamp: new Date().toISOString()
    });
    
    setAiResponse(null);
    setError(null);
    setShowPreview(false);
    setIsLoading(false); // Ensure loading state is reset
    // Don't clear userInstruction - let user retry with same text
  };

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
        await loadFileForEdit(firstEdit, projectContext, onShowDiff);
      }
    }
    
    setShowPreview(newShowPreview);
  };

  // Handle model change
  const handleModelChange = (providerId: string, modelId: string) => {
    setConfig(prev => ({ ...prev, provider: providerId }));
    setSelectedModel(modelId);
    
    // Auto-select a compatible API key for the new provider
    const compatibleKeys = aiKeys.filter(key => key.providerId === providerId);
    if (compatibleKeys.length > 0) {
      setSelectedKey(compatibleKeys[0]);
    } else {
      setSelectedKey(null);
    }
  };

  // Handle key change
  const handleKeyChange = (key: any) => {
    setSelectedKey(key);
    
    // Update provider to match selected key
    if (key) {
      setConfig(prev => ({ ...prev, provider: key.providerId }));
    }
  };

  // Handle new conversation
  const handleNewConversation = () => {
    if (projectContext?.currentProject?.path) {
      conversationStore.createConversation(
        projectContext.currentProject.path,
        projectContext.currentProject.name
      );
    }
  };

  // Handle search/replace prompt execution
  const handleExecutePrompt = (prompt: any) => {
    console.log('Executing search/replace:', prompt);
  };

  // Show all available keys, not filtered by provider
  const availableKeys = aiKeys;

  if (!isVisible) return null;

  return (
    <div className="dual-screen-ai-editor">
      <div className="sidebar-content">
        {/* Compact Configuration Bar */}
        <div className="config-bar">
          <ConversationControls
            currentConversation={currentConversation}
            isEditing={isEditing}
            onToggleEditing={onToggleEditing}
            onShowHistory={() => setShowConversationHistory(true)}
            onNewConversation={handleNewConversation}
            FontAwesomeIcon={FontAwesomeIcon}
          />
        </div>

        {/* Chat Messages Area */}
        <div className="chat-messages">
          {/* Welcome Message */}
          {!aiResponse && !isStreaming && !error && (
            <WelcomeMessage FontAwesomeIcon={FontAwesomeIcon} />
          )}

          {/* Error Message */}
          {error && (
            <ErrorMessage
              error={error}
              onRetry={handleClearError}
              FontAwesomeIcon={FontAwesomeIcon}
            />
          )}

          {/* Streaming Response */}
          <StreamingResponse
            isStreaming={isStreaming}
            streamedContent={streamedContent}
            FontAwesomeIcon={FontAwesomeIcon}
          />

          {/* Iterative Reading Status */}
          <IterativeReadingStatus
            isIterativeReading={isIterativeReading}
            iterativeReadingState={iterativeReadingState}
            FontAwesomeIcon={FontAwesomeIcon}
          />

          {/* Debug Payload Display */}
          <DebugPayloadDisplay
            debugPayload={debugPayload}
            onClose={() => setDebugPayload(null)}
            onSendAnyway={handleRequestEdit}
            FontAwesomeIcon={FontAwesomeIcon}
          />

          {/* Search & Replace Prompts Display */}
          <SearchReplacePrompts
            searchReplacePrompts={searchReplacePrompts}
            onClose={() => setSearchReplacePrompts([])}
            onExecute={handleExecutePrompt}
            FontAwesomeIcon={FontAwesomeIcon}
          />

          {/* AI Response */}
          <AIResponseDisplay
            aiResponse={aiResponse}
            showPreview={showPreview}
            onPreviewToggle={handlePreviewToggle}
            currentFileData={currentFileData}
            FontAwesomeIcon={FontAwesomeIcon}
          />

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>

        {/* Conversation History Panel */}
        <ConversationHistoryPanel
          isVisible={showConversationHistory}
          onClose={() => setShowConversationHistory(false)}
          searchQuery={conversationSearchQuery}
          onSearchChange={setConversationSearchQuery}
          currentConversationId={currentConversation?.id}
          projectPath={projectContext?.currentProject?.path}
          FontAwesomeIcon={FontAwesomeIcon}
        />

        {/* Input Area - Always at Bottom */}
        <InputArea
          userInstruction={userInstruction}
          onInstructionChange={setUserInstruction}
          selectedModel={selectedModel}
          onModelChange={handleModelChange}
          selectedKey={selectedKey}
          onKeyChange={handleKeyChange}
          availableKeys={availableKeys}
          isLoading={isLoading}
          isStreaming={isStreaming}
          onSend={handleRequestEdit}
          canSend={!!selectedKey && !!selectedModel && (!!currentFileData || (routeFiles && routeFiles.length > 0)) && !!userInstruction.trim() && !isLoading && !isStreaming}
          FontAwesomeIcon={FontAwesomeIcon}
        />
      </div>
      
      {/* Context Management Panel */}
      <ContextManagementPanel
        isVisible={showContextManagement}
        onClose={() => setShowContextManagement(false)}
      />
    </div>
  );
};
