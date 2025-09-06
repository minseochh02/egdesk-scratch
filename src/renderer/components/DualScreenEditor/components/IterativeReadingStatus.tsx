import React from 'react';
import { faFile } from '@fortawesome/free-solid-svg-icons';

interface IterativeReadingStatusProps {
  isIterativeReading: boolean;
  iterativeReadingState: any;
  FontAwesomeIcon: any;
}

export const IterativeReadingStatus: React.FC<IterativeReadingStatusProps> = ({
  isIterativeReading,
  iterativeReadingState,
  FontAwesomeIcon
}) => {
  if (!isIterativeReading || !iterativeReadingState) return null;

  return (
    <div className="message iterative-reading-message">
      <div className="message-content">
        <div className="response-header">
          <span className="response-title">
            {FontAwesomeIcon && <FontAwesomeIcon icon={faFile} />} Iterative File Reading
          </span>
        </div>
        
        <div className="iterative-status">
          <div className="status-phase">
            <strong>Phase:</strong> {iterativeReadingState.phase}
          </div>
          <div className="status-content">
            <strong>Content Read:</strong> {iterativeReadingState.totalContentRead.toLocaleString()} / {iterativeReadingState.maxContentLimit.toLocaleString()} chars
          </div>
          <div className="status-files">
            <strong>Files Read:</strong> {iterativeReadingState.readRanges.length}
          </div>
          
          {iterativeReadingState.readRanges.length > 0 && (
            <div className="read-ranges">
              <strong>Read Ranges:</strong>
              <ul>
                {iterativeReadingState.readRanges.map((range: any, index: number) => (
                  <li key={index}>
                    {range.filePath.split('/').pop()} (lines {range.startLine}-{range.endLine})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
