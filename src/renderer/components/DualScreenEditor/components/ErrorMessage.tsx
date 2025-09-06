import React from 'react';
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

interface ErrorMessageProps {
  error: string;
  onRetry: () => void;
  FontAwesomeIcon: any;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ error, onRetry, FontAwesomeIcon }) => {
  return (
    <div className="message error-message">
      <div className="message-content">
        <p>⚠️ {error}</p>
        <button onClick={onRetry} className="retry-btn">Try Again</button>
      </div>
    </div>
  );
};
