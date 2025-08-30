import React, { useState, useEffect } from 'react';
import { ContextManagementService } from './services/contextManagementService';
import './ContextManagementPanel.css';

interface ContextManagementPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

export const ContextManagementPanel: React.FC<ContextManagementPanelProps> = ({
  isVisible,
  onClose
}) => {
  const [config, setConfig] = useState({
    maxTotalTokens: 8000,
    reservedOutputTokens: 4000,
    maxSnippetLines: 7,
    maxDepth: 3,
    maxFileSize: 100000,
    minContextTokens: 2000
  });

  const [isDirty, setIsDirty] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (isVisible) {
      loadCurrentConfig();
    }
  }, [isVisible]);

  const loadCurrentConfig = () => {
    const currentConfig = ContextManagementService.getInstance().getContextConfig();
    setConfig(currentConfig);
    setIsDirty(false);
  };

  const handleConfigChange = (key: keyof typeof config, value: number) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleSave = () => {
    ContextManagementService.getInstance().updateConfig(config);
    setIsDirty(false);
  };

  const handleReset = () => {
    loadCurrentConfig();
  };

  const handleClearCache = () => {
    ContextManagementService.getInstance().clearCache();
    alert('Context cache cleared!');
  };

  const getReservedPercentage = () => {
    return Math.round((config.reservedOutputTokens / config.maxTotalTokens) * 100);
  };

  const getAvailableContextTokens = () => {
    return config.maxTotalTokens - config.reservedOutputTokens - config.minContextTokens;
  };

  if (!isVisible) return null;

  return (
    <div className="context-management-panel">
      <div className="panel-header">
        <h3>🧠 Intelligent Context Management</h3>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="panel-content">
        <div className="config-section">
          <h4>📊 Context Window Configuration</h4>
          
          <div className="config-group">
            <label>
              Max Total Tokens: {config.maxTotalTokens.toLocaleString()}
              <span className="config-help">
                Maximum total tokens for the entire AI request
              </span>
            </label>
            <input
              type="range"
              min="4000"
              max="16000"
              step="1000"
              value={config.maxTotalTokens}
              onChange={(e) => handleConfigChange('maxTotalTokens', parseInt(e.target.value))}
            />
          </div>

          <div className="config-group">
            <label>
              Reserved Output Tokens: {config.reservedOutputTokens.toLocaleString()} ({getReservedPercentage()}%)
              <span className="config-help">
                Tokens reserved for AI response (Void uses 50%)
              </span>
            </label>
            <input
              type="range"
              min="2000"
              max={config.maxTotalTokens - 2000}
              step="500"
              value={config.reservedOutputTokens}
              onChange={(e) => handleConfigChange('reservedOutputTokens', parseInt(e.target.value))}
            />
          </div>

          <div className="config-group">
            <label>
              Available Context Tokens: {getAvailableContextTokens().toLocaleString()}
              <span className="config-help">
                Tokens available for context after reserving output space
              </span>
            </label>
            <div className="token-bar">
              <div 
                className="token-segment reserved"
                style={{ width: `${(config.reservedOutputTokens / config.maxTotalTokens) * 100}%` }}
                title={`Reserved for AI response: ${config.reservedOutputTokens.toLocaleString()} tokens`}
              />
              <div 
                className="token-segment context"
                style={{ width: `${(getAvailableContextTokens() / config.maxTotalTokens) * 100}%` }}
                title={`Available for context: ${getAvailableContextTokens().toLocaleString()} tokens`}
              />
              <div 
                className="token-segment minimum"
                style={{ width: `${(config.minContextTokens / config.maxTotalTokens) * 100}%` }}
                title={`Minimum context preserved: ${config.minContextTokens.toLocaleString()} tokens`}
              />
            </div>
          </div>
        </div>

        <div className="config-section">
          <h4>🔍 Context Gathering Settings</h4>
          
          <div className="config-group">
            <label>
              Max Snippet Lines: {config.maxSnippetLines}
              <span className="config-help">
                Maximum lines per code snippet (Void's approach)
              </span>
            </label>
            <input
              type="range"
              min="3"
              max="15"
              step="1"
              value={config.maxSnippetLines}
              onChange={(e) => handleConfigChange('maxSnippetLines', parseInt(e.target.value))}
            />
          </div>

          <div className="config-group">
            <label>
              Max Dependency Depth: {config.maxDepth}
              <span className="config-help">
                Maximum depth for symbol-based context expansion
              </span>
            </label>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={config.maxDepth}
              onChange={(e) => handleConfigChange('maxDepth', parseInt(e.target.value))}
            />
          </div>

          <div className="config-group">
            <label>
              Max File Size: {config.maxFileSize.toLocaleString()} chars
              <span className="config-help">
                Maximum characters per file in context
              </span>
            </label>
            <input
              type="range"
              min="50000"
              max="200000"
              step="10000"
              value={config.maxFileSize}
              onChange={(e) => handleConfigChange('maxFileSize', parseInt(e.target.value))}
            />
          </div>

          <div className="config-group">
            <label>
              Minimum Context Tokens: {config.minContextTokens.toLocaleString()}
              <span className="config-help">
                Minimum context preserved even when trimming
              </span>
            </label>
            <input
              type="range"
              min="1000"
              max="5000"
              step="500"
              value={config.minContextTokens}
              onChange={(e) => handleConfigChange('minContextTokens', parseInt(e.target.value))}
            />
          </div>
        </div>

        <details className="advanced-section" open={showAdvanced}>
          <summary onClick={() => setShowAdvanced(!showAdvanced)}>
            ⚙️ Advanced Settings
          </summary>
          
          <div className="advanced-content">
            <div className="config-section">
              <h4>🎯 Context Prioritization</h4>
              
              <div className="priority-info">
                <div className="priority-item">
                  <span className="priority-label proximity">Proximity Context</span>
                  <span className="priority-weight">Weight: 10</span>
                  <span className="priority-desc">Code within 3 lines of cursor</span>
                </div>
                
                <div className="priority-item">
                  <span className="priority-label definition">Definition Context</span>
                  <span className="priority-weight">Weight: 8</span>
                  <span className="priority-desc">Function/class definitions near cursor</span>
                </div>
                
                <div className="priority-item">
                  <span className="priority-label symbol">Symbol Context</span>
                  <span className="priority-weight">Weight: 7-depth</span>
                  <span className="priority-desc">Import/usage references</span>
                </div>
                
                <div className="priority-item">
                  <span className="priority-label semantic">Semantic Context</span>
                  <span className="priority-weight">Weight: 6</span>
                  <span className="priority-desc">AI-found relevant files</span>
                </div>
              </div>
            </div>

            <div className="config-section">
              <h4>🔄 Cache Management</h4>
              
              <div className="cache-controls">
                <button 
                  className="cache-btn clear"
                  onClick={handleClearCache}
                  title="Clear all cached context snippets"
                >
                  🗑️ Clear Context Cache
                </button>
                
                <div className="cache-info">
                  <p>Context snippets are cached to avoid re-processing the same code sections.</p>
                  <p>Clear cache if you experience issues or want to force fresh context gathering.</p>
                </div>
              </div>
            </div>
          </div>
        </details>

        <div className="config-section">
          <h4>📈 Performance Impact</h4>
          
          <div className="performance-metrics">
            <div className="metric">
              <span className="metric-label">Context Processing Time:</span>
              <span className="metric-value">~50-200ms</span>
            </div>
            
            <div className="metric">
              <span className="metric-label">Memory Usage:</span>
              <span className="metric-value">~2-8MB</span>
            </div>
            
            <div className="metric">
              <span className="metric-label">AI Response Quality:</span>
              <span className="metric-value">High</span>
            </div>
            
            <div className="metric">
              <span className="metric-label">Context Relevance:</span>
              <span className="metric-value">Optimized</span>
            </div>
          </div>
        </div>
      </div>

      <div className="panel-footer">
        <div className="button-group">
          <button 
            className="btn btn-secondary"
            onClick={handleReset}
            disabled={!isDirty}
          >
            🔄 Reset
          </button>
          
          <button 
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!isDirty}
          >
            💾 Save Configuration
          </button>
        </div>
        
        {isDirty && (
          <div className="dirty-indicator">
            ⚠️ Configuration has unsaved changes
          </div>
        )}
      </div>
    </div>
  );
};
