import React from 'react';
import type { ToolCallRequestInfo, ToolCallResponseInfo } from '../../../../main/types/ai-types';
import './AIToolCallResult.css';

interface AIToolCallResultProps {
  toolCall: ToolCallRequestInfo;
  response?: ToolCallResponseInfo;
  status: 'executing' | 'completed' | 'failed';
}

export const AIToolCallResult: React.FC<AIToolCallResultProps> = ({ 
  toolCall, 
  response, 
  status 
}) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'executing':
        return '🔧';
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      default:
        return '🔧';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'executing':
        return 'Executing...';
      case 'completed':
        return 'Success!';
      case 'failed':
        return 'Failed';
      default:
        return 'Executing...';
    }
  };

  const getStatusClass = () => {
    switch (status) {
      case 'executing':
        return 'executing';
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      default:
        return 'executing';
    }
  };

  return (
    <div className={`ai-tool-call-result ${getStatusClass()}`}>
      <div className="tool-call-header">
        <span className="tool-icon">{getStatusIcon()}</span>
        <span className="tool-name">{toolCall.name}</span>
        <span className="tool-status">{getStatusText()}</span>
      </div>
      
      {status === 'failed' && response?.error && (
        <div className="tool-error">
          <span className="error-text">{response.error}</span>
        </div>
      )}
      
      {status === 'completed' && response?.executionTime && (
        <div className="tool-execution-time">
          <span className="execution-time-text">
            {response.executionTime}ms
          </span>
        </div>
      )}
    </div>
  );
};
