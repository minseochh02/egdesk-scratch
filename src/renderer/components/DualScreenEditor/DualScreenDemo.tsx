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

  return (
    <DualScreenEditor
      isVisible={true}
      currentFile={currentFile}
      onApplyEdits={handleApplyEdits}
      onClose={() => {}} // No longer needed
    />
  );
};
