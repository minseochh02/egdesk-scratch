import React from 'react';
import { AIEdit } from './types';
import './CodeEditBlock.css';

interface CodeEditBlockProps {
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
}

export const CodeEditBlock: React.FC<CodeEditBlockProps> = ({
  edits,
  currentFile,
  onPreviewToggle,
  showPreview,
  onApply
}) => {
  // Group edits by file
  const editsByFile = edits.reduce((acc, edit) => {
    const filePath = edit.filePath || currentFile?.path || 'Unknown file';
    if (!acc[filePath]) {
      acc[filePath] = [];
    }
    acc[filePath].push(edit);
    return acc;
  }, {} as Record<string, AIEdit[]>);

  // Calculate total lines changed
  const totalLinesChanged = edits.reduce((total, edit) => {
    if (edit.range) {
      return total + (edit.range.end - edit.range.start);
    }
    return total + 1; // For insert/delete operations, count as 1 line
  }, 0);

  return (
    <div className="code-edit-block">
      <div className="edit-header">
        <div className="edit-summary">
          <span className="edit-count">📝 {edits.length} edit{edits.length !== 1 ? 's' : ''}</span>
          <span className="lines-changed">📊 ~{totalLinesChanged} line{totalLinesChanged !== 1 ? 's' : ''} changed</span>
        </div>
        
        <div className="edit-actions">
          <button onClick={onPreviewToggle} className="preview-btn">
            {showPreview ? '👁️ Hide Preview' : '👁️ Show Preview'}
          </button>
          <button 
            className="apply-btn"
            onClick={onApply}
            disabled={!edits.length}
          >
            ✅ Apply Changes
          </button>
        </div>
      </div>

      <div className="edits-container">
        {Object.entries(editsByFile).map(([filePath, fileEdits]) => (
          <div key={filePath} className="file-edit-group">
            <div className="file-header">
              <span className="file-name">📄 {filePath.split('/').pop() || filePath}</span>
              <span className="file-path">{filePath}</span>
              <span className="edit-count">{fileEdits.length} edit{fileEdits.length !== 1 ? 's' : ''}</span>
            </div>
            
            <div className="edits-list">
              {fileEdits.map((edit, index) => (
                <div key={index} className="edit-item">
                  <div className="edit-meta">
                    <span className={`edit-type edit-type-${edit.type}`}>
                      {getEditTypeIcon(edit.type)} {edit.type}
                    </span>
                    {edit.range && (
                      <span className="edit-range">
                        Lines {edit.range.start + 1}-{edit.range.end}
                      </span>
                    )}
                    {edit.confidence && (
                      <span className="edit-confidence">
                        {Math.round(edit.confidence * 100)}% confidence
                      </span>
                    )}
                  </div>
                  
                  <div className="edit-description">
                    {edit.description}
                  </div>
                  
                  {edit.newText && (
                    <div className="edit-preview">
                      <pre className="code-preview">{edit.newText}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

function getEditTypeIcon(type: string): string {
  switch (type) {
    case 'replace': return '🔄';
    case 'insert': return '➕';
    case 'delete': return '➖';
    case 'create': return '🆕';
    case 'delete_file': return '🗑️';
    case 'format': return '✨';
    case 'refactor': return '🔧';
    default: return '📝';
  }
}
