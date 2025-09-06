import React from 'react';
import { AIEditResponse, AIEdit } from '../../AIEditor/types';
import { MessageContent } from '../../ChatInterface/components';
import { SplitExplanationWithEdits } from '../SplitExplanationWithEdits';
import { faRobot, faCheck, faComments } from '@fortawesome/free-solid-svg-icons';

interface AIResponseDisplayProps {
  aiResponse: AIEditResponse | null;
  showPreview: boolean;
  onPreviewToggle: () => void;
  currentFileData: {
    path: string;
    name: string;
    content: string;
    language: string;
  } | null;
  FontAwesomeIcon: any;
}

export const AIResponseDisplay: React.FC<AIResponseDisplayProps> = ({
  aiResponse,
  showPreview,
  onPreviewToggle,
  currentFileData,
  FontAwesomeIcon
}) => {
  if (!aiResponse || !aiResponse.success) return null;

  return (
    <div className="message ai-message">
      <div className="message-content">
        <div className="response-header">
          <span className="response-title">
            {FontAwesomeIcon && <FontAwesomeIcon icon={faRobot} />} AI Response
          </span>
          {/* Only show edit actions if there are actual code edits */}
          {aiResponse.edits.length > 0 && (
            <div className="response-actions">
              <button onClick={onPreviewToggle} className="preview-btn">
                {showPreview ? 'Hide' : 'Preview'}
              </button>
              <div className="auto-applied-indicator">
                {FontAwesomeIcon && <FontAwesomeIcon icon={faCheck} />} Auto-Applied {aiResponse.edits.length} Change{aiResponse.edits.length !== 1 ? 's' : ''}
              </div>
            </div>
          )}
        </div>
        
        {/* Console log for AI response display */}
        {(() => {
          console.log('🎨 AI RESPONSE DISPLAYED:', {
            success: aiResponse.success,
            explanationLength: aiResponse.explanation?.length || 0,
            editsCount: aiResponse.edits.length,
            showPreview: showPreview,
            timestamp: new Date().toISOString()
          });
          return null;
        })()}

        {/* AI Response Content */}
        {aiResponse.explanation && (
          <div className="explanation">
            {aiResponse.edits.length > 0 ? (
              <SplitExplanationWithEdits 
                explanation={aiResponse.explanation}
                edits={aiResponse.edits}
                currentFile={currentFileData}
                onPreviewToggle={onPreviewToggle}
                showPreview={showPreview}
                onApply={() => {}}
                autoApplied={true}
              />
            ) : (
              <MessageContent content={aiResponse.explanation} role="assistant" />
            )}
          </div>
        )}
        
        {/* Show message when there are no edits */}
        {aiResponse.edits.length === 0 && (
          <div className="no-edits-message">
            {FontAwesomeIcon && <FontAwesomeIcon icon={faComments} />} This is a conversational response with no code changes to apply.
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
  );
};
