import React from 'react';

interface WelcomeMessageProps {
  FontAwesomeIcon: any;
}

export const WelcomeMessage: React.FC<WelcomeMessageProps> = ({ FontAwesomeIcon }) => {
  return (
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
  );
};
