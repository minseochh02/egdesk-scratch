import React from 'react';
import { AIEdit } from '../AIEditor/types';
import { CodeEditBlock } from '../AIEditor/CodeEditBlock';
import { MessageContent } from '../ChatInterface/components';

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

export const SplitExplanationWithEdits: React.FC<
  SplitExplanationWithEditsProps
> = ({
  explanation,
  edits,
  currentFile,
  onPreviewToggle,
  showPreview,
  onApply,
  autoApplied = false,
}) => {
  // Use search-replace blocks as positioning markers instead of removing them
  const splitExplanation = (text: string) => {
    console.log('🔍 DEBUG: Using search-replace blocks as positioning markers');

    // Find all search-replace blocks and their positions
    const searchReplaceBlockRegex = /```search-replace[\s\S]*?```/g;
    const blocks = [];
    let match;

    while ((match = searchReplaceBlockRegex.exec(text)) !== null) {
      blocks.push({
        block: match[0],
        start: match.index,
        end: match.index + match[0].length,
      });
    }

    console.log(
      `🔍 Found ${blocks.length} search-replace blocks for positioning`,
    );

    if (blocks.length === 0) {
      // No search-replace blocks, return original text
      return {
        before: text,
        after: '',
      };
    }

    // Find the first search-replace block to split around
    const firstBlock = blocks[0];
    const beforeText = text.substring(0, firstBlock.start).trim();
    const afterText = text.substring(firstBlock.end).trim();

    console.log('📍 Positioning information:', {
      beforeLength: beforeText.length,
      afterLength: afterText.length,
      firstBlockPosition: `${firstBlock.start}-${firstBlock.end}`,
      totalBlocks: blocks.length,
    });

    return {
      before: beforeText,
      after: afterText,
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
