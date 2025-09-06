import React from 'react';
import { faSearch, faTimes, faRefresh, faCheck, faClipboard } from '@fortawesome/free-solid-svg-icons';

interface SearchReplacePromptsProps {
  searchReplacePrompts: any[];
  onClose: () => void;
  onExecute: (prompt: any) => void;
  FontAwesomeIcon: any;
}

export const SearchReplacePrompts: React.FC<SearchReplacePromptsProps> = ({
  searchReplacePrompts,
  onClose,
  onExecute,
  FontAwesomeIcon
}) => {
  if (searchReplacePrompts.length === 0) return null;

  return (
    <div className="message search-replace-message">
      <div className="message-content">
        <div className="response-header">
          <span className="response-title">
            {FontAwesomeIcon && <FontAwesomeIcon icon={faSearch} />} {searchReplacePrompts.length} Search/Replace
          </span>
          <button 
            onClick={onClose}
            className="close-btn"
          >
            {FontAwesomeIcon && <FontAwesomeIcon icon={faTimes} />}
          </button>
        </div>
        
        <div className="search-replace-content">
          {searchReplacePrompts.map((prompt, index) => (
            <div key={prompt.id || index} className="prompt-item">
              <div className="prompt-header">
                <span className="prompt-number">#{index + 1}</span>
                <span className="prompt-description">{prompt.description}</span>
                {prompt.filePath && <span className="file-path">{prompt.filePath.split('/').pop()}</span>}
              </div>
              
              <div className="prompt-details">
                <div className="search-replace-pair">
                  <div className="search-text">
                    {FontAwesomeIcon && <FontAwesomeIcon icon={faSearch} />} <code>{prompt.searchText}</code>
                  </div>
                  <div className="replace-text">
                    {FontAwesomeIcon && <FontAwesomeIcon icon={faRefresh} />} <code>{prompt.replaceText}</code>
                  </div>
                </div>
              </div>
              
              <div className="prompt-actions">
                <button 
                  onClick={() => onExecute(prompt)}
                  className="execute-btn"
                  title="Execute"
                >
                        {FontAwesomeIcon && <FontAwesomeIcon icon={faCheck} />}
                </button>
                
                <button 
                  onClick={() => {
                    const text = `Search: ${prompt.searchText}\nReplace: ${prompt.replaceText}`;
                    navigator.clipboard.writeText(text);
                  }}
                  className="copy-btn"
                  title="Copy"
                >
                        {FontAwesomeIcon && <FontAwesomeIcon icon={faClipboard} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
