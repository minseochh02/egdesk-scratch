import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRobot } from '@fortawesome/free-solid-svg-icons';
import './AIChat.css';

const AIChat: React.FC = () => {
  return (
    <div className="ai-chat-container">
      <div className="ai-chat-empty-state">
        <FontAwesomeIcon icon={faRobot} className="ai-chat-empty-icon" />
        <h2>AI Assistant</h2>
        <p className="ai-chat-empty-message">Ask AI to build your UI</p>
        <p className="ai-chat-empty-hint">Start a conversation to create your project</p>
      </div>
    </div>
  );
};

export default AIChat;
