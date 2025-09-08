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

  const handleFileSelect = (file: {
    path: string;
    name: string;
    content: string;
    language: string;
  }) => {
    console.log('File selected:', file);
    setCurrentFile(file);
  };

  return (
    <DualScreenEditor
      isVisible
      currentFile={currentFile}
      onApplyEdits={handleApplyEdits}
      onClose={() => {}} // No longer needed
      onFileSelect={handleFileSelect}
    />
  );
};
