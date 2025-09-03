import React, { useRef, useState } from 'react';
import LocalServer from '../LocalServer';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGlobe, faEdit, faRefresh, faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';
import './WebsitePreview.css';

export const WebsitePreview: React.FC<{
  isEditing?: boolean;
  onToggleEditing?: () => void;
  onUrlChange?: (url: string) => void;
  onOpenBrowser?: () => void;
}> = ({ isEditing = false, onToggleEditing, onUrlChange, onOpenBrowser }) => {
  const [showPreview, setShowPreview] = useState(true);
  const [iframeKey, setIframeKey] = useState(0); // Force iframe refresh
  const [previewUrl, setPreviewUrl] = useState<string>('http://localhost:3000');
  const lastNotifiedUrlRef = useRef<string>('');
  
  const computePageLabel = (url: string): string => {
    try {
      const u = new URL(url);
      const path = u.pathname || '/';
      if (path === '/' || path === '') return 'home';
      const last = path.split('/').filter(Boolean).pop() || 'home';
      const noExt = last.replace(/\.(php|html|htm)$/i, '');
      return noExt || 'home';
    } catch {
      return 'page';
    }
  };
  
  const notifyUrlChange = (url: string) => {
    if (url === lastNotifiedUrlRef.current) return;
    lastNotifiedUrlRef.current = url;
    if (onUrlChange) {
      try {
        onUrlChange(url);
      } catch (_) {}
    }
  };

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
              {showPreview ? <><FontAwesomeIcon icon={faGlobe} /> Hide Preview</> : <><FontAwesomeIcon icon={faGlobe} /> Show Preview</>}
            </button>
            {onToggleEditing && (
              <button
                className={`editor-toggle-btn ${isEditing ? 'editing' : 'server'}`}
                onClick={onToggleEditing}
                title={isEditing ? 'Switch to Server Mode' : 'Switch to Editing Mode'}
              >
                {isEditing ? <><FontAwesomeIcon icon={faGlobe} /> Show Server</> : <><FontAwesomeIcon icon={faEdit} /> Show Editor</>}
              </button>
            )}
            <button
              className="refresh-btn"
              onClick={refreshIframe}
              title="Refresh website preview"
            >
              <FontAwesomeIcon icon={faRefresh} /> Refresh
            </button>
            {onOpenBrowser && (
              <button
                className="browser-btn"
                onClick={onOpenBrowser}
                title="Open in browser window"
              >
                <FontAwesomeIcon icon={faExternalLinkAlt} /> Browser
              </button>
            )}
          </div>
        </div>
        
        {/* Compact LocalServer component */}
        <div className="compact-server">
          <LocalServer onStatusChange={(status) => {
            if (status?.url && status.url !== previewUrl) {
              setPreviewUrl(status.url);
              notifyUrlChange(status.url);
            } else if (status?.port) {
              const next = `http://localhost:${status.port}`;
              if (next !== previewUrl) {
                setPreviewUrl(next);
                notifyUrlChange(next);
              }
            }
          }} />
        </div>
      </div>

      {/* Website Preview Section */}
      {showPreview && (
        <div className="preview-section">
          <div className="preview-header">
            <h3><FontAwesomeIcon icon={faGlobe} /> Website Preview</h3>
          </div>
          
          <div className="preview-content">
            <div className="no-preview">
              <div className="no-preview-content">
                <h4>🚀 Website Preview</h4>
                <p>Use the server controls above to start your local development server.</p>
                <div className="preview-placeholder">
                  <div className="placeholder-icon"><FontAwesomeIcon icon={faGlobe} /></div>
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
              <span className="modal-title"><FontAwesomeIcon icon={faGlobe} /> Looking at: {computePageLabel(previewUrl)} page</span>
              <div className="modal-controls">
                <button 
                  className="refresh-modal-btn"
                  onClick={refreshIframe}
                  title="Refresh preview"
                >
                  <FontAwesomeIcon icon={faRefresh} />
                </button>
                {onOpenBrowser && (
                  <button 
                    className="browser-modal-btn"
                    onClick={onOpenBrowser}
                    title="Open in browser window"
                  >
                    <FontAwesomeIcon icon={faExternalLinkAlt} />
                  </button>
                )}
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
                onLoad={(e) => {
                  try {
                    const target = e.currentTarget as HTMLIFrameElement;
                    const href = target.contentWindow?.location?.href;
                    if (href) {
                      notifyUrlChange(href);
                    }
                  } catch (_) {
                    // Cross-origin or other issues; ignore
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
