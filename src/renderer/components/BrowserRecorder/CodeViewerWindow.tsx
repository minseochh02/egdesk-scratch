import React, { useState, useEffect, useRef } from 'react';
import './CodeViewerWindow.css';

interface RecordedAction {
  type: string;
  selector?: string;
  value?: string;
  key?: string;
  url?: string;
  coordinates?: { x: number; y: number };
  frameSelector?: string;
  [key: string]: any;
}

interface WaitSettings {
  multiplier: number;
  maxDelay: number;
}

const CodeViewerWindow: React.FC = () => {
  const [code, setCode] = useState<string>('import { test, expect } from \'@playwright/test\';\n\ntest(\'recorded test\', async ({ page }) => {\n  // Recording in progress...\n});');
  const [actions, setActions] = useState<RecordedAction[]>([]);
  const [isViewMode, setIsViewMode] = useState<boolean>(false);
  const [waitSettings, setWaitSettings] = useState<WaitSettings>({ multiplier: 1.0, maxDelay: 3000 });
  const [geminiAnalysis, setGeminiAnalysis] = useState<string | null>(null);
  const codeContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const { electron } = window;
    
    // Listen for code updates
    const removeUpdateCodeListener = electron.ipcRenderer.on('update-code', (newCode: any) => {
      if (typeof newCode === 'string') {
        setCode(newCode);
      }
    });

    // Listen for view mode changes
    const removeSetViewModeListener = electron.ipcRenderer.on('set-view-mode', (isView: any) => {
      setIsViewMode(!!isView);
    });

    // Listen for actions updates
    const removeActionsUpdatedListener = electron.ipcRenderer.on('actions-updated', (newActions: any) => {
      console.log('🎬 Renderer: Received actions-updated:', Array.isArray(newActions) ? newActions.length : 0);
      if (Array.isArray(newActions)) {
        setActions(newActions);
      }
    });

    // Get initial state
    electron.ipcRenderer.invoke('get-current-code').then((initialCode) => {
      if (initialCode) setCode(initialCode);
    });

    electron.ipcRenderer.invoke('get-actions').then((initialActions) => {
      console.log('📊 Renderer: Initial actions fetched:', Array.isArray(initialActions) ? initialActions.length : 0);
      if (Array.isArray(initialActions)) setActions(initialActions);
    });

    return () => {
      if (removeUpdateCodeListener) removeUpdateCodeListener();
      if (removeSetViewModeListener) removeSetViewModeListener();
      if (removeActionsUpdatedListener) removeActionsUpdatedListener();
    };
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom when code updates
    if (codeContainerRef.current) {
      codeContainerRef.current.scrollTop = codeContainerRef.current.scrollHeight;
    }
  }, [code, actions]);

  // Handle Gemini analysis detection
  useEffect(() => {
    if (code.includes('<!-- Gemini Element Analysis -->')) {
      const htmlMatch = code.match(/(<!-- Gemini Element Analysis -->[\s\S]*?<\/div>)/);
      if (htmlMatch) {
        setGeminiAnalysis(htmlMatch[1]);
      }
    } else {
      setGeminiAnalysis(null);
    }
  }, [code]);

  const handleWaitMultiplierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const multiplier = parseFloat(e.target.value);
    const newSettings = { ...waitSettings, multiplier };
    setWaitSettings(newSettings);
    window.electron.ipcRenderer.sendMessage('update-wait-settings', newSettings);
  };

  const handleMaxDelayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const maxDelay = parseInt(e.target.value);
    const newSettings = { ...waitSettings, maxDelay };
    setWaitSettings(newSettings);
    window.electron.ipcRenderer.sendMessage('update-wait-settings', newSettings);
  };

  const handleSaveTest = async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('save-test-code');
      if (result.success) {
        alert('Test saved successfully!');
      } else {
        alert('Failed to save test: ' + result.error);
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Error saving test');
    }
  };

  const handleDeleteAction = (index: number) => {
    window.electron.ipcRenderer.sendMessage('delete-action', index);
  };

  const handlePlayToAction = (index: number) => {
    const confirmMsg = `Execute actions 0-${index} (${index + 1} actions total) and leave browser open?`;
    if (confirm(confirmMsg)) {
      window.electron.ipcRenderer.sendMessage('play-to-action', index);
    }
  };

  const getActionTypeLabel = (type: string, action: RecordedAction) => {
    if (type === 'click' && action.coordinates) {
      return '📍 Click (Coords)';
    }

    const labels: Record<string, string> = {
      'navigate': '🌐 Navigate',
      'click': '🖱️ Click',
      'clickUntilGone': '🔄 Click Until Gone',
      'fill': '📝 Fill',
      'keypress': '⌨️ Keypress',
      'screenshot': '📸 Screenshot',
      'waitForElement': '⏳ Wait',
      'download': '📥 Download',
      'datePickerGroup': '📅 Date Picker',
      'captureTable': '📊 Capture Table',
      'captureLabeledFields': '📋 Labeled Fields',
      'newTab': '🆕 New Tab',
      'closeTab': '🚪 Close Tab',
      'print': '🖨️ Print'
    };
    return labels[type] || type;
  };

  const getActionDetails = (action: RecordedAction) => {
    switch (action.type) {
      case 'navigate':
        return action.url || '';
      case 'click':
        let details = '';
        if (action.coordinates) {
          details = `X: ${action.coordinates.x}, Y: ${action.coordinates.y}`;
        } else {
          details = action.selector || '';
        }
        if (action.frameSelector) {
          details += ` (in iframe: ${action.frameSelector})`;
        }
        return details;
      case 'clickUntilGone':
        return `${action.selector} (max: ${action.maxIterations || 100} clicks)`;
      case 'fill':
        let fillDetails = `${action.selector}: "${action.value}"`;
        if (action.frameSelector) {
          fillDetails += ` (in iframe: ${action.frameSelector})`;
        }
        return fillDetails;
      case 'keypress':
        return `Key: ${action.key}`;
      case 'waitForElement':
        return `${action.selector} (${action.waitCondition || 'visible'})`;
      case 'datePickerGroup':
        const offsetText = action.dateOffset === 0 ? 'today' :
                         action.dateOffset! > 0 ? `today + ${action.dateOffset} days` :
                         `today - ${Math.abs(action.dateOffset!)} days`;
        return offsetText;
      case 'download':
        return action.value || 'Download event';
      case 'captureTable':
        return `${action.tables?.length || 0} table(s)`;
      case 'captureLabeledFields':
        return `${action.labeledFields?.length || 0} field(s)`;
      case 'newTab':
        return action.newTabUrl || 'New tab opened';
      case 'closeTab':
        return action.closedTabUrl || 'Tab closed, switched back to previous page';
      case 'print':
        return 'Print dialog triggered';
      default:
        return action.selector || '';
    }
  };

  const highlightCode = (codeText: string) => {
    try {
      const escaped = codeText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      const keywordPattern = /\b(import|from|async|await|const|let|var|function|return|if|else|for|while)\b/g;
      const stringPattern = /('[^']*'|"[^"]*"|`[^`]*`)/g;
      const commentPattern = /\/\/.*/g;
      const functionPattern = /\b(test|expect|page|locator|element|selectors|bounds|attributes|styles)\b/g;
      const bracketPattern = /([\{\}\(\)\[\]])/g;

      return escaped
        .replace(keywordPattern, (match) => `<span class="keyword">${match}</span>`)
        .replace(stringPattern, (match) => `<span class="string">${match}</span>`)
        .replace(commentPattern, (match) => `<span class="comment">${match}</span>`)
        .replace(functionPattern, (match) => `<span class="function">${match}</span>`)
        .replace(bracketPattern, (match) => `<span class="bracket">${match}</span>`);
    } catch (e) {
      return codeText;
    }
  };

  return (
    <div className="code-viewer-window">
      <div className="header">
        <h2>{geminiAnalysis ? '🔍 Gemini Element Analysis' : '📝 Playwright Test Code (Real-time)'}</h2>
        <div className="status">
          <div className="status-dot"></div>
          <span>{isViewMode ? 'View Mode' : 'Recording...'}</span>
        </div>
      </div>

      <div className="controls-panel">
        <div className="control-group">
          <label>⏱️ Wait Time Multiplier:</label>
          <input
            type="range"
            min="0"
            max="3"
            step="0.1"
            value={waitSettings.multiplier}
            onChange={handleWaitMultiplierChange}
          />
          <span className="value-display">{waitSettings.multiplier.toFixed(1)}x</span>
        </div>
        <div className="control-group">
          <label>Max Delay (ms):</label>
          <input
            type="number"
            min="0"
            max="10000"
            step="100"
            value={waitSettings.maxDelay}
            onChange={handleMaxDelayChange}
          />
        </div>
        {isViewMode && (
          <div className="control-group" style={{ marginLeft: 'auto' }}>
            <button className="save-btn" onClick={handleSaveTest}>💾 Save Changes</button>
          </div>
        )}
      </div>

      <div className="code-container" ref={codeContainerRef}>
        {isViewMode && (
          <div className="view-mode-notice">
            ℹ️ Viewing saved test - Actions are read-only. Record a new test to edit actions.
          </div>
        )}

        {geminiAnalysis && (
          <div 
            className="gemini-analysis-container"
            dangerouslySetInnerHTML={{ __html: geminiAnalysis }}
          />
        )}

        {actions.length > 0 && !geminiAnalysis && (
          <div className="actions-container">
            {actions.map((action, index) => (
              <div key={index} className="action-block">
                <div className="action-info">
                  <div className="action-type">{getActionTypeLabel(action.type, action)}</div>
                  <div className="action-details">{getActionDetails(action)}</div>
                </div>
                <button 
                  className="action-play-btn" 
                  title={`Execute actions 0-${index} and pause`}
                  onClick={() => handlePlayToAction(index)}
                >
                  ▶️ Play
                </button>
                <button 
                  className="action-delete-btn"
                  onClick={() => handleDeleteAction(index)}
                >
                  ✕ Delete
                </button>
              </div>
            ))}
          </div>
        )}

        {!geminiAnalysis && actions.length === 0 && (
          <pre>
            <code 
              id="code-display" 
              dangerouslySetInnerHTML={{ __html: highlightCode(code) }} 
            />
          </pre>
        )}
      </div>
    </div>
  );
};

export default CodeViewerWindow;
