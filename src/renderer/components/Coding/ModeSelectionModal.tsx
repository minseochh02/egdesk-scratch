import React from 'react';
import './ModeSelectionModal.css';

interface ModeSelectionModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onSelect: (mode: 'dev' | 'production') => void;
  onCancel: () => void;
}

const ModeSelectionModal: React.FC<ModeSelectionModalProps> = ({
  isOpen,
  title,
  message,
  onSelect,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="mode-modal-overlay">
      <div className="mode-modal-content">
        <div className="mode-modal-header">
          <h3>{title}</h3>
        </div>
        <div className="mode-modal-body">
          <p className="mode-modal-message">{message}</p>
          
          <div className="mode-options-container">
            <div className="mode-option" onClick={() => onSelect('production')}>
              <div className="mode-option-icon">🚀</div>
              <div className="mode-option-info">
                <div className="mode-option-title">Run as PROD</div>
                <div className="mode-option-desc">Optimized for external hosting</div>
              </div>
            </div>
            
            <div className="mode-option" onClick={() => onSelect('dev')}>
              <div className="mode-option-icon">⚡</div>
              <div className="mode-option-info">
                <div className="mode-option-title">Run as DEV</div>
                <div className="mode-option-desc">Fast startup & hot reload</div>
              </div>
            </div>
          </div>
        </div>
        <div className="mode-modal-footer">
          <button className="mode-modal-cancel-btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModeSelectionModal;
