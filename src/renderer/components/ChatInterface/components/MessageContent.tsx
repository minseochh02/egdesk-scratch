import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faComments, faSearch, faRefresh } from '@fortawesome/free-solid-svg-icons';
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

export const MessageContent: React.FC<MessageContentProps> = ({ content, role }) => {
  // Detect if the message contains search/replace operations
  const detectSearchReplaceOperations = (text: string): SearchReplaceOperation[] => {
    const operations: SearchReplaceOperation[] = [];
    
    // Pattern 1: Search/Replace blocks with clear markers
    const searchReplacePattern = /(?:search|find|replace|change|update).*?:\s*\n?```[^\n]*\n([\s\S]*?)```\s*\n?(?:with|to|replace with|change to|update to).*?:\s*\n?```[^\n]*\n([\s\S]*?)```/gi;
    
    let match;
    while ((match = searchReplacePattern.exec(text)) !== null) {
      operations.push({
        searchText: match[1].trim(),
        replaceText: match[2].trim(),
        description: 'Search and replace operation'
      });
    }
    
    // Pattern 2: Before/After format
    const beforeAfterPattern = /(?:before|current|existing).*?:\s*\n?```[^\n]*\n([\s\S]*?)```\s*\n?(?:after|new|updated|result).*?:\s*\n?```[^\n]*\n([\s\S]*?)```/gi;
    
    while ((match = beforeAfterPattern.exec(text)) !== null) {
      operations.push({
        searchText: match[1].trim(),
        replaceText: match[2].trim(),
        description: 'Before and after comparison'
      });
    }
    
    // Pattern 3: Explicit search/replace markers
    const explicitPattern = /```search\s*\n([\s\S]*?)```\s*\n```replace\s*\n([\s\S]*?)```/gi;
    
    while ((match = explicitPattern.exec(text)) !== null) {
      operations.push({
        searchText: match[1].trim(),
        replaceText: match[2].trim(),
        description: 'Explicit search and replace'
      });
    }
    
    // Pattern 4: File path with search/replace
    const filePattern = /(?:in|file|path):\s*([^\n]+)\s*\n(?:search|find|replace|change|update).*?:\s*\n?```[^\n]*\n([\s\S]*?)```\s*\n?(?:with|to|replace with|change to|update to).*?:\s*\n?```[^\n]*\n([\s\S]*?)```/gi;
    
    while ((match = filePattern.exec(text)) !== null) {
      operations.push({
        searchText: match[2].trim(),
        replaceText: match[3].trim(),
        filePath: match[1].trim(),
        description: 'File-specific search and replace'
      });
    }
    
    // Pattern 5: Code changes with comments (like the AI response format)
    const codeChangePattern = /```(?:php|html|javascript|js|css|php|html|xml|json|yaml|yml|sql|bash|sh|python|py|java|cpp|c|cs|go|rust|swift|kotlin|scala|r|ruby|perl|php|html|xml|json|yaml|yml|sql|bash|sh|python|py|java|cpp|c|cs|go|rust|swift|kotlin|scala|r|ruby|perl)\s*\n([\s\S]*?)```/gi;
    
    while ((match = codeChangePattern.exec(text)) !== null) {
      const codeContent = match[1].trim();
      
      // Look for patterns like "// ... existing code ..." followed by new code
      const existingCodePattern = /\/\/\s*\.\.\.\s*existing\s+code\s*\.\.\.\s*\n([\s\S]*?)(?=\/\/\s*\.\.\.\s*existing\s+code\s*\.\.\.|$)/gi;
      const existingMatch = existingCodePattern.exec(codeContent);
      
      if (existingMatch) {
        // Extract the new code part
        const newCode = existingMatch[1].trim();
        
        // Try to find the original code context from the surrounding text
        const beforeCode = text.substring(0, match.index);
        const afterCode = text.substring(match.index + match[0].length);
        
        // Look for file paths in the context
        const filePathMatch = beforeCode.match(/(?:in|file|path):\s*([^\n]+)/i) || 
                             afterCode.match(/(?:in|file|path):\s*([^\n]+)/i);
        
        operations.push({
          searchText: '// ... existing code ...',
          replaceText: newCode,
          filePath: filePathMatch ? filePathMatch[1].trim() : undefined,
          description: 'Code modification with context'
        });
      }
    }
    
    // Pattern 6: Direct code blocks with file paths
    const directCodePattern = /```(?:php|html|javascript|js|css|php|html|xml|json|yaml|yml|sql|bash|sh|python|py|java|cpp|c|cs|go|rust|swift|kotlin|scala|r|ruby|perl)\s*\n([\s\S]*?)```/gi;
    
    while ((match = directCodePattern.exec(text)) !== null) {
      const codeContent = match[1].trim();
      
      // Look for file paths in the surrounding context
      const beforeCode = text.substring(0, match.index);
      const afterCode = text.substring(match.index + match[0].length);
      
      const filePathMatch = beforeCode.match(/(?:in|file|path):\s*([^\n]+)/i) || 
                           afterCode.match(/(?:in|file|path):\s*([^\n]+)/i);
      
      if (filePathMatch) {
        operations.push({
          searchText: '// ... existing code ...',
          replaceText: codeContent,
          filePath: filePathMatch[1].trim(),
          description: 'Code modification for specific file'
        });
      }
    }
    
    // Pattern 7: AI response format with file paths and code changes
    const aiResponsePattern = /```(?:php|html|javascript|js|css|php|html|xml|json|yaml|yml|sql|bash|sh|python|py|java|cpp|c|cs|go|rust|swift|kotlin|scala|r|ruby|perl)\s*\n([\s\S]*?)```/gi;
    
    while ((match = aiResponsePattern.exec(text)) !== null) {
      const codeContent = match[1].trim();
      
      // Look for file paths in the surrounding context
      const beforeCode = text.substring(0, match.index);
      const afterCode = text.substring(match.index + match[0].length);
      
      // Look for file paths in the context
      const filePathMatch = beforeCode.match(/(?:in|file|path):\s*([^\n]+)/i) || 
                           afterCode.match(/(?:in|file|path):\s*([^\n]+)/i);
      
      if (filePathMatch) {
        operations.push({
          searchText: '// ... existing code ...',
          replaceText: codeContent,
          filePath: filePathMatch[1].trim(),
          description: 'Code modification for specific file'
        });
      }
    }
    
    // Pattern 8: Simple code blocks without explicit search/replace markers
    const simpleCodePattern = /```(?:php|html|javascript|js|css|php|html|xml|json|yaml|yml|sql|bash|sh|python|py|java|cpp|c|cs|go|rust|swift|kotlin|scala|r|ruby|perl)\s*\n([\s\S]*?)```/gi;
    
    while ((match = simpleCodePattern.exec(text)) !== null) {
      const codeContent = match[1].trim();
      
      // Look for file paths in the surrounding context
      const beforeCode = text.substring(0, match.index);
      const afterCode = text.substring(match.index + match[0].length);
      
      // Look for file paths in the context
      const filePathMatch = beforeCode.match(/(?:in|file|path):\s*([^\n]+)/i) || 
                           afterCode.match(/(?:in|file|path):\s*([^\n]+)/i);
      
      if (filePathMatch) {
        operations.push({
          searchText: '// ... existing code ...',
          replaceText: codeContent,
          filePath: filePathMatch[1].trim(),
          description: 'Code modification for specific file'
        });
      }
    }
    
    // Pattern 9: Simple code blocks with file paths (like your example)
    const simpleCodeBlockPattern = /```(?:php|html|javascript|js|css|xml|json|yaml|yml|sql|bash|sh|python|py|java|cpp|c|cs|go|rust|swift|kotlin|scala|r|ruby|perl)\s*\n([\s\S]*?)```/gi;
    
    while ((match = simpleCodeBlockPattern.exec(text)) !== null) {
      const codeContent = match[1].trim();
      
      // Look for file paths in the code content itself (first line is often the file path)
      const lines = codeContent.split('\n');
      const firstLine = lines[0]?.trim();
      
      // Check if first line looks like a file path
      const filePathMatch = firstLine?.match(/^([^\n]*\.(?:php|html|js|css|xml|json|yaml|yml|sql|bash|sh|py|java|cpp|c|cs|go|rust|swift|kt|scala|r|rb|pl))/i);
      
      if (filePathMatch) {
        // Remove the file path from the code content
        const codeWithoutPath = lines.slice(1).join('\n').trim();
        
        operations.push({
          searchText: '// ... existing code ...',
          replaceText: codeWithoutPath,
          filePath: filePathMatch[1].trim(),
          description: 'Code modification for specific file'
        });
      }
    }
    
    return operations;
  };

  // Parse the content and extract search/replace operations
  const searchReplaceOps = detectSearchReplaceOperations(content);
  
  // Debug logging
  console.log('🔍 MessageContent: Detected operations:', searchReplaceOps.length);
  if (searchReplaceOps.length > 0) {
    console.log('🔍 Operations:', searchReplaceOps);
  }
  
  // If no search/replace operations detected, render as regular content
  if (searchReplaceOps.length === 0) {
    return (
      <div className="message-content-regular">
        {content}
      </div>
    );
  }

  // Render search/replace operations in a structured format
  return (
    <div className="message-content-structured">
      {/* Show the original content first */}
      <div className="original-content">
        <h4><FontAwesomeIcon icon={faComments} /> AI Response</h4>
        <div className="content-text">
          {content}
        </div>
      </div>
      
      {/* Show detected search/replace operations */}
      <div className="search-replace-operations">
        <h4><FontAwesomeIcon icon={faSearch} /> Detected {searchReplaceOps.length} Search/Replace Operation(s)</h4>
        
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
                <h5><FontAwesomeIcon icon={faSearch} /> Search for:</h5>
                <pre className="search-text">{op.searchText}</pre>
              </div>
              
              <div className="replace-section">
                <h5><FontAwesomeIcon icon={faRefresh} /> Replace with:</h5>
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
