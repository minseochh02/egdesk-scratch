import React, { useState, useCallback, useEffect } from 'react';
import { CodeEditBlock } from '../AIEditor/CodeEditBlock';
import { AIEdit } from '../AIEditor/types';
import CodeEditor from '../CodeEditor';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFile, faCode, faEye, faCheck, faTimes, faMinus, faPlus, faEdit } from '@fortawesome/free-solid-svg-icons';
import './SearchReplaceDemo.css';

interface DemoStep {
  id: string;
  title: string;
  description: string;
  content: string;
  aiResponse?: string;
  parsedEdits?: AIEdit[];
  showCodeEditor?: boolean;
  showAppliedChanges?: boolean;
  showPreview?: boolean;
}

const SearchReplaceDemo: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [showPreview, setShowPreview] = useState(true);
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [demoFileCreated, setDemoFileCreated] = useState(false);
  
  // Mock file content for the demo
  const mockFileContent = `<?php
// Product selection dropdown
function renderProductDropdown() {
    echo '<select name="product" class="form-control">';
    echo '<option value="">Select a product</option>';
    echo '<option value="1">Temperature Sensor</option>';
    echo '<option value="2">Pressure Sensor</option>';
    echo '<option value="3">Humidity Sensor</option>';
    echo '<option value="4">Motion Sensor</option>';
    echo '<option value="5">Light Sensor</option>';
    echo '<option value="6">ACB &amp; GIS Current Transformer</option>';
    echo '<option value="7">Voltage Sensor</option>';
    echo '<option value="8">Power Meter</option>';
    echo '</select>';
}
?>`;

  // Modified file content after applying the edit
  const modifiedFileContent = `<?php
// Product selection dropdown
function renderProductDropdown() {
    echo '<select name="product" class="form-control">';
    echo '<option value="">Select a product</option>';
    echo '<option value="1">Temperature Sensor</option>';
    echo '<option value="2">Pressure Sensor</option>';
    echo '<option value="3">Humidity Sensor</option>';
    echo '<option value="4">Motion Sensor</option>';
    echo '<option value="5">Light Sensor</option>';
    echo '<option value="6">ACB &amp; GIS Current Transformer</option>';
    echo '<option value="7">Test</option>';
    echo '<option value="8">Voltage Sensor</option>';
    echo '<option value="9">Power Meter</option>';
    echo '</select>';
}
?>`;

  const [demoSteps] = useState<DemoStep[]>([
    {
      id: 'step1',
      title: 'Step 1: User Request & File Context',
      description: 'User makes a request and the system shows the current file content',
      content: `User Request: "Add a test option to the product dropdown in index.php"`,
      showCodeEditor: true,
    },
    {
      id: 'step2',
      title: 'Step 2: AI Response Format',
      description: 'AI responds with search/replace operations in the correct format',
      content: `AI Response:
\`\`\`search-replace
FILE: www/index.php
LINES: 113-120
SEARCH: <option value="6">ACB &amp; GIS Current Transformer</option>
REPLACE: <option value="6">ACB &amp; GIS Current Transformer</option>
<option value="7">Test</option>
\`\`\``,
      aiResponse: `\`\`\`search-replace
FILE: www/index.php
LINES: 113-120
SEARCH: <option value="6">ACB &amp; GIS Current Transformer</option>
REPLACE: <option value="6">ACB &amp; GIS Current Transformer</option>
<option value="7">Test</option>
\`\`\``,
    },
    {
      id: 'step3',
      title: 'Step 3: Parsed AI Edit',
      description: 'The AI response is parsed into AIEdit objects',
      content: `Parsed AIEdit Object:
{
  type: 'replace',
  filePath: 'www/index.php',
  range: {
    startLine: 113,
    endLine: 120
  },
  oldText: '<option value="6">ACB &amp; GIS Current Transformer</option>',
  newText: '<option value="6">ACB &amp; GIS Current Transformer</option>\\n<option value="7">Test</option>',
  description: 'Add test option to product dropdown'
}`,
      parsedEdits: [{
        type: 'replace',
        filePath: 'www/index.php',
        range: {
          startLine: 113,
          endLine: 120
        },
        oldText: '<option value="6">ACB &amp; GIS Current Transformer</option>',
        newText: '<option value="6">ACB &amp; GIS Current Transformer</option>\n<option value="7">Test</option>',
        description: 'Add test option to product dropdown'
      }]
    },
    {
      id: 'step4',
      title: 'Step 4: CodeEditBlock Display',
      description: 'The CodeEditBlock component displays the edit with preview',
      content: `The CodeEditBlock component renders:
- File path and line numbers
- Old text (what will be replaced)
- New text (replacement content)
- Preview toggle functionality`,
      parsedEdits: [{
        type: 'replace',
        filePath: 'www/index.php',
        range: {
          startLine: 113,
          endLine: 120
        },
        oldText: '<option value="6">ACB &amp; GIS Current Transformer</option>',
        newText: '<option value="6">ACB &amp; GIS Current Transformer</option>\n<option value="7">Test</option>',
        description: 'Add test option to product dropdown'
      }]
    },
    {
      id: 'step5',
      title: 'Step 5: Preview Changes',
      description: 'Preview the changes before applying them - see exactly what will be modified',
      content: `This preview shows the exact changes that will be made to the file. You can see the before and after code side by side.`,
      showPreview: true
    },
    {
      id: 'step6',
      title: 'Step 6: Applied Changes',
      description: 'After applying the edit, the code editor shows the updated file content',
      content: `The edit has been applied successfully! The new option "Test" has been added to the dropdown.`,
      showCodeEditor: true,
      showAppliedChanges: true
    }
  ]);

  const handlePreviewToggle = useCallback(() => {
    setShowPreview(prev => !prev);
  }, []);

  const handleApplyEdit = useCallback((edit: AIEdit) => {
    console.log('Applying edit:', edit);
    alert(`Edit applied: ${edit.description}`);
  }, []);

  // For demo purposes, just set as created immediately
  useEffect(() => {
    // Simulate file creation for demo
    const timer = setTimeout(() => {
      setDemoFileCreated(true);
    }, 500); // Small delay to show loading state

    return () => clearTimeout(timer);
  }, []);

  // Simple code editor component
  const CodeEditor = ({ content, highlightLine }: { content: string; highlightLine?: number }) => {
    const lines = content.split('\n');
    
    return (
      <div className="demo-code-editor">
        <div className="editor-header">
          <span className="file-name">
            <FontAwesomeIcon icon={faFile} /> www/index.php
          </span>
        </div>
        <div className="editor-content">
          <div className="line-numbers">
            {lines.map((_, index) => (
              <div 
                key={index} 
                className={`line-number ${highlightLine === index + 1 ? 'highlight' : ''}`}
              >
                {index + 1}
              </div>
            ))}
          </div>
          <div className="code-content">
            {lines.map((line, index) => (
              <div 
                key={index} 
                className={`code-line ${highlightLine === index + 1 ? 'highlight' : ''}`}
              >
                {line}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Code editor with inline diff overlay (Cursor-style)
  const CodeEditorWithDiffOverlay = () => {
    const lines = mockFileContent.split('\n');
    
    return (
      <div className="code-editor-with-inline-diff">
        {demoFileCreated ? (
          <div className="mock-code-editor">
            <div className="editor-header">
              <span className="file-name">
                <FontAwesomeIcon icon={faFile} /> www/index.php
              </span>
            </div>
            <div className="editor-content">
              <div className="line-numbers">
                {lines.map((_, index) => (
                  <React.Fragment key={index}>
                    <div className="line-number">
                      {index + 1}
                    </div>
                    {/* Add line numbers for the replacement lines right after line 6 */}
                    {index === 5 && (
                      <>
                        <div className="line-number added-line">+</div>
                        <div className="line-number added-line">+</div>
                      </>
                    )}
                  </React.Fragment>
                ))}
              </div>
              <div className="code-content">
                {lines.map((line, index) => (
                  <React.Fragment key={index}>
                    <div className={`code-line ${index === 5 ? 'removed-line' : ''}`}>
                      {line}
                    </div>
                    {/* Add the replacement lines right after the line being replaced */}
                    {index === 5 && (
                      <>
                        <div className="code-line added-line">
                          {line}
                        </div>
                        <div className="code-line added-line">
                          {line.replace('ACB &amp; GIS Current Transformer', 'Test')}
                        </div>
                      </>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="loading-editor">
            <div className="spinner"></div>
            <p>Loading demo file...</p>
          </div>
        )}
      </div>
    );
  };



  const nextStep = () => {
    if (currentStep < demoSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const currentStepData = demoSteps[currentStep];

  return (
    <div className="search-replace-demo">
      <div className="demo-header">
        <h1>Search & Replace Demo</h1>
        <p>Step-by-step demonstration of the search and replace functionality</p>
      </div>

      <div className="demo-navigation">
        <button 
          onClick={prevStep} 
          disabled={currentStep === 0}
          className="nav-button prev"
        >
          ← Previous
        </button>
        <span className="step-indicator">
          Step {currentStep + 1} of {demoSteps.length}
        </span>
        <button 
          onClick={nextStep} 
          disabled={currentStep === demoSteps.length - 1}
          className="nav-button next"
        >
          Next →
        </button>
      </div>

      <div className="demo-content">
        <div className="step-info">
          <h2>{currentStepData.title}</h2>
          <p>{currentStepData.description}</p>
        </div>

        <div className="step-content">
          {currentStepData.showPreview ? (
            <div className="preview-demo">
              <h3>Change Preview:</h3>
              <CodeEditorWithDiffOverlay />
              {currentStepData.content && (
                <div className="step-description">
                  <pre>{currentStepData.content}</pre>
                </div>
              )}
            </div>
          ) : currentStepData.showCodeEditor ? (
            <div className="code-editor-demo">
              <h3>Code Editor:</h3>
              <CodeEditor 
                content={currentStepData.showAppliedChanges ? modifiedFileContent : mockFileContent}
                highlightLine={currentStepData.showAppliedChanges ? 13 : undefined}
              />
              {currentStepData.content && (
                <div className="step-description">
                  <pre>{currentStepData.content}</pre>
                </div>
              )}
            </div>
          ) : currentStepData.parsedEdits ? (
            <div className="code-edit-demo">
              <h3>CodeEditBlock Component:</h3>
              <div className="preview-controls">
                <label>
                  <input 
                    type="checkbox" 
                    checked={showPreview}
                    onChange={handlePreviewToggle}
                  />
                  Show Preview
                </label>
              </div>
              <CodeEditBlock
                edits={currentStepData.parsedEdits}
                currentFile={{
                  path: 'www/index.php',
                  name: 'index.php',
                  content: 'Sample file content...',
                  language: 'php'
                }}
                onPreviewToggle={handlePreviewToggle}
                showPreview={showPreview}
                onApply={() => handleApplyEdit(currentStepData.parsedEdits[0])}
              />
            </div>
          ) : (
            <div className="text-content">
              <pre>{currentStepData.content}</pre>
            </div>
          )}
        </div>
      </div>

      <div className="demo-footer">
        <div className="step-list">
          {demoSteps.map((step, index) => (
            <button
              key={step.id}
              onClick={() => setCurrentStep(index)}
              className={`step-button ${index === currentStep ? 'active' : ''}`}
            >
              {index + 1}. {step.title}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SearchReplaceDemo;
