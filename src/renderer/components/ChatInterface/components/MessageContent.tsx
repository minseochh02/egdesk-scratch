import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faComments,
  faSearch,
  faRefresh,
} from '@fortawesome/free-solid-svg-icons';
import './MessageContent.css';

interface MessageContentProps {
  content: string;
  role: 'user' | 'assistant';
}

interface SearchReplaceOperation {
  searchText: string;
  replaceText: string;
  filePath?: string;
  description?: string;
}

export const MessageContent: React.FC<MessageContentProps> = ({
  content,
  role,
}) => {
  // Detect if the message contains search/replace operations
  const detectSearchReplaceOperations = (
    text: string,
  ): SearchReplaceOperation[] => {
    const operations: SearchReplaceOperation[] = [];

    // Only look for explicit search-replace blocks, not regular code blocks
    // Pattern 1: Explicit ```search-replace blocks
    const searchReplaceBlockPattern = /```search-replace[\s\S]*?```/gi;

    let match;
    while ((match = searchReplaceBlockPattern.exec(text)) !== null) {
      const block = match[0];

      // Parse the search-replace block content
      const newFormatRegex =
        /```search-replace\s*\nFILE:\s*(.+?)\s*\nLINES:\s*(.+?)\s*\nSEARCH:\s*([\s\S]*?)\nREPLACE:\s*([\s\S]*?)\n```/g;
      let blockMatch = newFormatRegex.exec(block);

      if (blockMatch) {
        operations.push({
          searchText: blockMatch[3].trim(),
          replaceText: blockMatch[4].trim(),
          filePath: blockMatch[1].trim(),
          description: 'Search and replace operation',
        });
      } else {
        // Try old format without LINES
        const oldFormatRegex =
          /```search-replace\s*\nFILE:\s*(.+?)\s*\nSEARCH:\s*([\s\S]*?)\nREPLACE:\s*([\s\S]*?)\n```/g;
        blockMatch = oldFormatRegex.exec(block);

        if (blockMatch) {
          operations.push({
            searchText: blockMatch[2].trim(),
            replaceText: blockMatch[3].trim(),
            filePath: blockMatch[1].trim(),
            description: 'Search and replace operation',
          });
        }
      }
    }

    // Pattern 2: Search/Replace blocks with clear markers (only if they explicitly mention search/replace)
    const searchReplacePattern =
      /(?:search|find|replace|change|update).*?:\s*\n?```[^\n]*\n([\s\S]*?)```\s*\n?(?:with|to|replace with|change to|update to).*?:\s*\n?```[^\n]*\n([\s\S]*?)```/gi;

    while ((match = searchReplacePattern.exec(text)) !== null) {
      operations.push({
        searchText: match[1].trim(),
        replaceText: match[2].trim(),
        description: 'Search and replace operation',
      });
    }

    // Pattern 3: Before/After format (only if explicitly mentioned)
    const beforeAfterPattern =
      /(?:before|current|existing).*?:\s*\n?```[^\n]*\n([\s\S]*?)```\s*\n?(?:after|new|updated|result).*?:\s*\n?```[^\n]*\n([\s\S]*?)```/gi;

    while ((match = beforeAfterPattern.exec(text)) !== null) {
      operations.push({
        searchText: match[1].trim(),
        replaceText: match[2].trim(),
        description: 'Before and after comparison',
      });
    }

    // Pattern 4: Explicit search/replace markers
    const explicitPattern =
      /```search\s*\n([\s\S]*?)```\s*\n```replace\s*\n([\s\S]*?)```/gi;

    while ((match = explicitPattern.exec(text)) !== null) {
      operations.push({
        searchText: match[1].trim(),
        replaceText: match[2].trim(),
        description: 'Explicit search and replace',
      });
    }

    return operations;
  };

  // Parse the content and extract search/replace operations
  const searchReplaceOps = detectSearchReplaceOperations(content);

  // Debug logging
  console.log(
    '🔍 MessageContent: Detected operations:',
    searchReplaceOps.length,
  );
  if (searchReplaceOps.length > 0) {
    console.log('🔍 Operations:', searchReplaceOps);
  }

  // If no search/replace operations detected, render as regular content
  if (searchReplaceOps.length === 0) {
    return <div className="message-content-regular">{content}</div>;
  }

  // Render search/replace operations in a structured format
  return (
    <div className="message-content-structured">
      {/* Show the original content first */}
      <div className="original-content">
        <h4>
          <FontAwesomeIcon icon={faComments} /> AI Response
        </h4>
        <div className="content-text">{content}</div>
      </div>

      {/* Show detected search/replace operations */}
      <div className="search-replace-operations">
        <h4>
          <FontAwesomeIcon icon={faSearch} /> Detected {searchReplaceOps.length}{' '}
          Search/Replace Operation(s)
        </h4>

        {searchReplaceOps.map((op, index) => (
          <div key={index} className="operation-card">
            <div className="operation-header">
              <span className="operation-number">#{index + 1}</span>
              <span className="operation-description">
                {op.description || 'Search and replace operation'}
              </span>
              {op.filePath && (
                <span className="file-path">📁 {op.filePath}</span>
              )}
            </div>

            <div className="operation-content">
              <div className="search-section">
                <h5>
                  <FontAwesomeIcon icon={faSearch} /> Search for:
                </h5>
                <pre className="search-text">{op.searchText}</pre>
              </div>

              <div className="replace-section">
                <h5>
                  <FontAwesomeIcon icon={faRefresh} /> Replace with:
                </h5>
                <pre className="replace-text">{op.replaceText}</pre>
              </div>
            </div>

            <div className="operation-actions">
              <button
                onClick={() => {
                  const text = `Search: ${op.searchText}\nReplace: ${op.replaceText}`;
                  navigator.clipboard.writeText(text);
                }}
                className="copy-btn"
                title="Copy search/replace text"
              >
                📋 Copy
              </button>

              <button
                onClick={() => {
                  // TODO: Implement actual search/replace execution
                  console.log('Execute search/replace:', op);
                }}
                className="execute-btn"
                title="Execute this search/replace operation"
              >
                ✅ Execute
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
