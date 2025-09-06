import React from 'react';
import { AIEdit } from '../AIEditor/types';
import { CodeEditBlock } from '../AIEditor/CodeEditBlock';
import { MessageContent } from '../ChatInterface/components';
import { SearchReplacePositioningService } from '../AIEditor/services/searchReplacePositioningService';

// Component to split AI explanation and show edits in the middle
interface SplitExplanationWithEditsProps {
  explanation: string;
  edits: AIEdit[];
  currentFile: {
    path: string;
    name: string;
    content: string;
    language: string;
  } | null;
  onPreviewToggle: () => void;
  showPreview: boolean;
  onApply: () => void;
  autoApplied?: boolean;
}

export const SplitExplanationWithEdits: React.FC<SplitExplanationWithEditsProps> = ({
  explanation,
  edits,
  currentFile,
  onPreviewToggle,
  showPreview,
  onApply,
  autoApplied = false
}) => {
  // Use the new positioning service to properly position search-replace blocks
  const splitExplanation = (text: string) => {
    console.log('🔍 DEBUG: Using SearchReplacePositioningService for text splitting');

    const positioningService = SearchReplacePositioningService.getInstance();
    const result = positioningService.repositionSearchReplaceBlocks(text);

    console.log('🔍 DEBUG: SearchReplacePositioningService result', {
      beforeLength: result.before.length,
      afterLength: result.after.length,
      searchReplaceBlocksCount: result.searchReplaceBlocks.length
    });

    return {
      before: result.before,
      after: result.after
    };
  };

  const { before, after } = splitExplanation(explanation);

  return (
    <div className="split-explanation">
      {/* First part of explanation */}
      {before && (
        <div className="explanation-part explanation-before">
          <MessageContent content={before} role="assistant" />
        </div>
      )}

      {/* Edits block in the middle */}
      <div className="explanation-edits">
        <CodeEditBlock
          edits={edits}
          currentFile={currentFile}
          onPreviewToggle={onPreviewToggle}
          showPreview={showPreview}
          onApply={onApply}
          autoApplied={autoApplied}
        />
      </div>

      {/* Second part of explanation */}
      {after && (
        <div className="explanation-part explanation-after">
          <MessageContent content={after} role="assistant" />
        </div>
      )}
    </div>
  );
};
