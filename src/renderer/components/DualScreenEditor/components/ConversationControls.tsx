import React from 'react';
import { Conversation } from '../../AIEditor/types';
import { conversationStore } from '../../AIEditor/store/conversationStore';
import { faGlobe, faEdit, faBook, faPlus } from '@fortawesome/free-solid-svg-icons';

interface ConversationControlsProps {
  currentConversation: Conversation | null;
  isEditing: boolean;
  onToggleEditing?: () => void;
  onShowHistory: () => void;
  onNewConversation: () => void;
  FontAwesomeIcon: any;
}

export const ConversationControls: React.FC<ConversationControlsProps> = ({
  currentConversation,
  isEditing,
  onToggleEditing,
  onShowHistory,
  onNewConversation,
  FontAwesomeIcon
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
