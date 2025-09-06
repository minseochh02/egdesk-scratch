import React from 'react';

interface StreamingResponseProps {
  isStreaming: boolean;
  streamedContent: string;
  FontAwesomeIcon: any;
}

export const StreamingResponse: React.FC<StreamingResponseProps> = ({
  isStreaming,
  streamedContent,
  FontAwesomeIcon
}) => {
  if (!isStreaming) return null;

  return (
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
  );
};
