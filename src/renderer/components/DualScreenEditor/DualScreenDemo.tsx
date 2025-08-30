import React, { useState } from 'react';
import { DualScreenEditor } from './DualScreenEditor';
import './DualScreenEditor.css';

export const DualScreenDemo: React.FC = () => {
  const [currentFile, setCurrentFile] = useState<{
    path: string;
    name: string;
    content: string;
    language: string;
  } | null>(null);

  const handleApplyEdits = (edits: any[]) => {
    console.log('Applying edits:', edits);
    // In a real implementation, this would apply the edits to the files
  };

  // Mock project context for demonstration
  const projectContext = {
    currentProject: {
      name: 'Demo Project',
      path: '/demo/project',
      type: 'web'
    },
    availableFiles: [
      { name: 'index.html', path: '/demo/project/index.html', type: 'file' },
      { name: 'style.css', path: '/demo/project/style.css', type: 'file' },
      { name: 'script.js', path: '/demo/project/script.js', type: 'file' }
    ]
  };

  return (
    <DualScreenEditor
      isVisible={true}
      currentFile={currentFile}
      onApplyEdits={handleApplyEdits}
      onClose={() => {}} // No longer needed
      projectContext={projectContext}
    />
  );
};
