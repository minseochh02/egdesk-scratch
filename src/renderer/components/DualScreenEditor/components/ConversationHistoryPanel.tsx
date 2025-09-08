import React from 'react';
import { faComments, faTimes } from '@fortawesome/free-solid-svg-icons';
import { conversationStore } from '../../AIEditor/store/conversationStore';

interface ConversationHistoryPanelProps {
  isVisible: boolean;
  onClose: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  currentConversationId?: string;
  projectPath?: string;
  FontAwesomeIcon: any;
}

export const ConversationHistoryPanel: React.FC<
  ConversationHistoryPanelProps
> = ({
  isVisible,
  onClose,
  searchQuery,
  onSearchChange,
  currentConversationId,
  projectPath,
  FontAwesomeIcon,
}) => {
  if (!isVisible) return null;

  return (
    <div className="conversation-history-panel">
      <div className="history-header">
        <h4>💬 Conversation History</h4>
        <button className="close-history-btn" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="history-search">
        <input
          type="text"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="history-search-input"
        />
      </div>

      <div className="conversation-list">
        {conversationStore
          .searchConversations(searchQuery)
          .filter((conv) => conv.projectPath === projectPath)
          .map((conversation) => (
            <div
              key={conversation.id}
              className={`conversation-item ${
                conversation.id === currentConversationId ? 'active' : ''
              }`}
              onClick={() => {
                conversationStore.setCurrentConversation(conversation.id);
                onClose();
              }}
            >
              <div className="conversation-item-header">
                <span className="conversation-item-title">
                  {conversation.title}
                </span>
                <span className="conversation-item-date">
                  {conversation.updatedAt.toLocaleDateString()}
                </span>
              </div>
              <div className="conversation-item-preview">
                {conversation.messages[0]?.content.substring(0, 100)}...
              </div>
              <div className="conversation-item-meta">
                <span className="message-count">
                  {conversation.messages.length} messages
                </span>
                {conversation.tags.length > 0 && (
                  <span className="conversation-tags">
                    {conversation.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="tag">
                        {tag}
                      </span>
                    ))}
                  </span>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};
