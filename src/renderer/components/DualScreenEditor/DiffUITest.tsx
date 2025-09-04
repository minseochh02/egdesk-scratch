import React, { useState } from 'react';
import { DualScreenAIEditor } from './DualScreenAIEditor';
import { createDemoData, testDiffUI } from './demoData';
import { AIEdit } from '../AIEditor/types';

const DiffUITest: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [demoData] = useState(() => createDemoData());

  const handleApplyEdits = (edits: AIEdit[]) => {
    console.log('✅ Demo: Applying edits', edits);
    alert(`Demo: Applied ${edits.length} edit(s)`);
  };

  const handleClose = () => {
    console.log('❌ Demo: Closing AI Editor');
    setIsVisible(false);
  };

  const handleToggleEditing = () => {
    console.log('🔄 Demo: Toggling editing mode', { current: isEditing, new: !isEditing });
    setIsEditing(!isEditing);
  };

  const loadDemoData = () => {
    console.log('🧪 Loading demo data for testing');
    const testData = testDiffUI();
    console.log('📊 Test data loaded:', testData);
  };

  return (
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      zIndex: 9999,
      backgroundColor: '#1e1e1e',
      color: '#ffffff'
    }}>
      <div style={{ 
        padding: '20px', 
        borderBottom: '1px solid #333',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h2>🧪 Diff UI Test Component</h2>
        <div>
          <button 
            onClick={loadDemoData}
            style={{
              padding: '8px 16px',
              marginRight: '10px',
              backgroundColor: '#007acc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Load Demo Data
          </button>
          <button 
            onClick={() => setIsVisible(!isVisible)}
            style={{
              padding: '8px 16px',
              backgroundColor: isVisible ? '#dc3545' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {isVisible ? 'Hide' : 'Show'} AI Editor
          </button>
        </div>
      </div>

      <div style={{ 
        display: 'flex', 
        height: 'calc(100vh - 80px)',
        gap: '10px'
      }}>
        {/* Left Panel - Demo Info */}
        <div style={{ 
          width: '300px', 
          padding: '20px',
          backgroundColor: '#2d2d2d',
          overflow: 'auto'
        }}>
          <h3>📋 Demo Data Info</h3>
          <div style={{ marginBottom: '20px' }}>
            <h4>Current File:</h4>
            <p><strong>Path:</strong> {demoData.currentFile.path}</p>
            <p><strong>Name:</strong> {demoData.currentFile.name}</p>
            <p><strong>Language:</strong> {demoData.currentFile.language}</p>
            <p><strong>Content Length:</strong> {demoData.currentFile.content.length} chars</p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h4>AI Response:</h4>
            <p><strong>Success:</strong> {demoData.aiResponse.success ? '✅' : '❌'}</p>
            <p><strong>Edits Count:</strong> {demoData.aiResponse.edits.length}</p>
            <p><strong>Has Explanation:</strong> {demoData.aiResponse.explanation ? '✅' : '❌'}</p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h4>Edits Details:</h4>
            {demoData.aiResponse.edits.map((edit, index) => (
              <div key={index} style={{ 
                marginBottom: '10px', 
                padding: '10px', 
                backgroundColor: '#3d3d3d',
                borderRadius: '4px'
              }}>
                <p><strong>Edit #{index + 1}:</strong></p>
                <p><strong>Type:</strong> {edit.type}</p>
                <p><strong>File:</strong> {edit.filePath}</p>
                <p><strong>Lines:</strong> {edit.range?.startLine}-{edit.range?.endLine}</p>
                <p><strong>Description:</strong> {edit.description}</p>
              </div>
            ))}
          </div>

          <div>
            <h4>Test Instructions:</h4>
            <ol style={{ fontSize: '14px', lineHeight: '1.4' }}>
              <li>Click "Load Demo Data" to see console logs</li>
              <li>Make sure AI Editor is visible</li>
              <li>Click "Preview" button in AI Editor</li>
              <li>Click on file paths in the detected operations</li>
              <li>Check if diff UI shows properly</li>
              <li>Look for console logs starting with 🔍, 🎯, 📊</li>
            </ol>
          </div>
        </div>

        {/* Right Panel - AI Editor */}
        <div style={{ flex: 1 }}>
          <DualScreenAIEditor
            isVisible={isVisible}
            currentFile={demoData.currentFile}
            onApplyEdits={handleApplyEdits}
            onClose={handleClose}
            projectContext={demoData.projectContext}
            isEditing={isEditing}
            onToggleEditing={handleToggleEditing}
            routeFiles={demoData.routeFiles}
          />
        </div>
      </div>
    </div>
  );
};

export default DiffUITest;
