import React from 'react';
import { Conversation } from '../../AIEditor/types';
import { conversationStore } from '../../AIEditor/store/conversationStore';
import { RevertButton } from '../../RevertManager';
import { faGlobe, faEdit, faBook, faPlus } from '@fortawesome/free-solid-svg-icons';

interface ConversationControlsProps {
  currentConversation: Conversation | null;
  isEditing: boolean;
  onToggleEditing?: () => void;
  onShowHistory: () => void;
  onNewConversation: () => void;
  FontAwesomeIcon: any;
  // Revert controls props
  currentFile?: {
    path: string;
    name: string;
    content: string;
    language: string;
  } | null;
  projectRoot?: string;
  onRevertComplete?: (success: boolean, message: string) => void;
  onShowRevertManager?: () => void;
}

export const ConversationControls: React.FC<ConversationControlsProps> = ({
  currentConversation,
  isEditing,
  onToggleEditing,
  onShowHistory,
  onNewConversation,
  FontAwesomeIcon,
  currentFile,
  projectRoot,
  onRevertComplete,
  onShowRevertManager
}) => {
  return (
    <div className="conversation-controls">
      <div className="conversation-info">
        {currentConversation && (
          <span className="conversation-stats">
            {currentConversation.messages.length}msgs
          </span>
        )}
      </div>
      
      <div className="conversation-actions">
        {/* Revert Controls */}
        {currentFile && (
          <div className="revert-controls">
            <RevertButton
              filePath={currentFile.path}
              projectRoot={projectRoot}
              onRevertComplete={onRevertComplete}
              size="small"
              showText={false}
            />
            {onShowRevertManager && (
              <button
                className="revert-manager-btn"
                onClick={onShowRevertManager}
                title="Open Revert Manager"
              >
                🔄
              </button>
            )}
          </div>
        )}
        
        {onToggleEditing && (
          <button
            className={`editor-toggle-btn ${isEditing ? 'editing' : 'server'}`}
            onClick={() => {
              console.log('AI Editor: Toggle button clicked, current isEditing:', isEditing);
              onToggleEditing();
            }}
            title={isEditing ? 'Switch to Server Mode' : 'Switch to Editing Mode'}
          >
            {isEditing ? <>Server</> : <>Editor</>}
          </button>
        )}
        <button
          className="history-btn"
          onClick={onShowHistory}
          title="Show conversation history"
        >
          📚
        </button>
        
        {currentConversation && (
          <button
            className="new-conversation-btn"
            onClick={onNewConversation}
            title="Start new conversation"
          >
            ➕
          </button>
        )}
      </div>
    </div>
  );
};
