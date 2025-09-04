import React, { useState, useEffect } from 'react';
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

  // Set a default current file that matches the real project structure
  useEffect(() => {
    if (!currentFile) {
      // Use the same path that's being loaded by URLFileViewer
      const defaultFile = {
        path: '/Users/minseocha/Desktop/projects/태화트랜스/Taehwa_demo/www/index.php',
        name: 'index.php',
        content: `<?php
// Default content - will be replaced by actual file content from URLFileViewer
$title = "Welcome to EGDesk";
$description = "A powerful development environment";

function getPageTitle() {
    return $title;
}

// HTML content
?>
<!DOCTYPE html>
<html>
<head>
    <title><?php echo getPageTitle(); ?></title>
</head>
<body>
    <h1><?php echo $title; ?></h1>
    <p><?php echo $description; ?></p>
</body>
</html>`,
        language: 'php'
      };
      
      console.log('🔍 DEBUG: DualScreenDemo setting default current file', {
        defaultFile: {
          path: defaultFile.path,
          name: defaultFile.name,
          contentLength: defaultFile.content.length,
          language: defaultFile.language
        }
      });
      
      setCurrentFile(defaultFile);
    }
  }, [currentFile]);

  return (
    <DualScreenEditor
      isVisible={true}
      currentFile={currentFile}
      onApplyEdits={handleApplyEdits}
      onClose={() => {}} // No longer needed
    />
  );
};
