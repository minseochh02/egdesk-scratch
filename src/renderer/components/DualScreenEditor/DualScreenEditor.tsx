import React, { useState } from 'react';
import { AIEditor } from '../AIEditor/AIEditor';
import { WebsitePreview } from './WebsitePreview';
import CodeEditor from '../CodeEditor';
import './DualScreenEditor.css';

interface DualScreenEditorProps {
  isVisible: boolean;
  currentFile: {
    path: string;
    name: string;
    content: string;
    language: string;
  } | null;
  onApplyEdits: (edits: any[]) => void;
  onClose: () => void;
  projectContext?: {
    currentProject: any;
    availableFiles: any[];
  };
}

export const DualScreenEditor: React.FC<DualScreenEditorProps> = ({
  isVisible,
  currentFile,
  onApplyEdits,
  onClose,
  projectContext
}) => {
  const [isEditing, setIsEditing] = useState(false);
  
  // Toggle between editing and non-editing states
  const toggleEditingMode = () => {
    setIsEditing(!isEditing);
  };

  if (!isVisible) return null;

  return (
    <div className="dual-screen-editor">
    {/* Dual Screen Content */}
    <div className="dual-screen-content">
      {/* Left Panel - Chat/AI Editor */}
      <div className="panel left-panel">
        <div className="panel-content">
          <AIEditor
            isVisible={true}
            currentFile={currentFile}
            onApplyEdits={onApplyEdits}
            onClose={() => {}} // Don't close, just hide
            projectContext={projectContext}
            isEditing={isEditing}
            onToggleEditing={toggleEditingMode}
          />
        </div>
      </div>

      {/* Right Panel - Code View/Website */}
      <div className="panel right-panel">
        <div className="panel-content">
          {isEditing ? (
            <CodeEditor 
              isEditing={isEditing}
              onToggleEditing={toggleEditingMode}
            />
          ) : (
            <WebsitePreview 
              isEditing={isEditing}
              onToggleEditing={toggleEditingMode}
            />
          )}
        </div>
      </div>
    </div>

    
    </div>
  );
};
