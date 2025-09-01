import React, { useState } from 'react';
import LocalServer from '../LocalServer';
import './WebsitePreview.css';

export const WebsitePreview: React.FC<{
  isEditing?: boolean;
  onToggleEditing?: () => void;
}> = ({ isEditing = false, onToggleEditing }) => {
  const [showPreview, setShowPreview] = useState(true);
  const [iframeKey, setIframeKey] = useState(0); // Force iframe refresh
  const [previewUrl, setPreviewUrl] = useState<string>('http://localhost:3000');

  const refreshIframe = () => {
    setIframeKey(prev => prev + 1);
  };

  const togglePreview = () => {
    setShowPreview(!showPreview);
  };

  return (
    <div className="website-preview">
      {/* Server Controls Section */}
      <div className="server-controls-section">
        <div className="controls-header">
          <h3>🚀 Server Controls</h3>
          <div className="control-buttons">
            <button
              className={`preview-toggle-btn ${showPreview ? 'active' : ''}`}
              onClick={togglePreview}
              title={showPreview ? 'Hide Website Preview' : 'Show Website Preview'}
            >
              {showPreview ? '🌐 Hide Preview' : '🌐 Show Preview'}
            </button>
            {onToggleEditing && (
              <button
                className={`editor-toggle-btn ${isEditing ? 'editing' : 'server'}`}
                onClick={onToggleEditing}
                title={isEditing ? 'Switch to Server Mode' : 'Switch to Editing Mode'}
              >
                {isEditing ? '🌐 Show Server' : '✏️ Show Editor'}
              </button>
            )}
            <button
              className="refresh-btn"
              onClick={refreshIframe}
              title="Refresh website preview"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
        
        {/* Compact LocalServer component */}
        <div className="compact-server">
          <LocalServer onStatusChange={(status) => {
            if (status?.url) {
              setPreviewUrl(status.url);
            } else if (status?.port) {
              setPreviewUrl(`http://localhost:${status.port}`);
            }
          }} />
        </div>
      </div>

      {/* Website Preview Section */}
      {showPreview && (
        <div className="preview-section">
          <div className="preview-header">
            <h3>🌐 Website Preview</h3>
          </div>
          
          <div className="preview-content">
            <div className="no-preview">
              <div className="no-preview-content">
                <h4>🚀 Website Preview</h4>
                <p>Use the server controls above to start your local development server.</p>
                <div className="preview-placeholder">
                  <div className="placeholder-icon">🌐</div>
                  <p>Website preview will appear here</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Screen Modal Overlay - Positioned relative to entire right panel */}
      {showPreview && (
        <div className="preview-modal-overlay">
          <div className="preview-modal">
            <div className="preview-modal-header">
              <span className="modal-title">🌐 Live Website Preview</span>
              <div className="modal-controls">
                <button 
                  className="refresh-modal-btn"
                  onClick={refreshIframe}
                  title="Refresh preview"
                >
                  🔄
                </button>
                <button 
                  className="close-modal-btn"
                  onClick={togglePreview}
                  title="Close preview"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="preview-modal-content">
              <iframe
                key={iframeKey}
                src={previewUrl}
                title="Website Preview"
                className="website-iframe"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
