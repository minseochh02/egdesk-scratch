/**
 * AI Key Selector Component
 * Allows users to select and configure Google AI keys
 */

import React, { useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faKey, faChevronDown } from '../../utils/fontAwesomeIcons';
import type { AIKey } from '../AIKeysManager/types';

interface AIKeySelectorProps {
  googleKeys: AIKey[];
  selectedGoogleKey: AIKey | null;
  connectionStatus: 'checking' | 'connected' | 'disconnected' | 'error';
  showKeyDropdown: boolean;
  onToggleDropdown: () => void;
  onKeySelection: (key: AIKey) => void;
  getConnectionStatusIcon: () => string;
  getConnectionStatusText: () => string;
}

export const AIKeySelector: React.FC<AIKeySelectorProps> = ({
  googleKeys,
  selectedGoogleKey,
  connectionStatus,
  showKeyDropdown,
  onToggleDropdown,
  onKeySelection,
  getConnectionStatusIcon,
  getConnectionStatusText,
}) => {
  const keySelectorRef = useRef<HTMLDivElement>(null);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (keySelectorRef.current && !keySelectorRef.current.contains(event.target as Node)) {
        onToggleDropdown();
      }
    };

    if (showKeyDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showKeyDropdown, onToggleDropdown]);

  if (googleKeys.length === 0) {
    return null;
  }

  return (
    <div className="egbusiness-identity__key-selector" ref={keySelectorRef}>
      <div className="egbusiness-identity__key-info" onClick={onToggleDropdown}>
        <FontAwesomeIcon icon={faKey} className="egbusiness-identity__key-icon" />
        <span className="egbusiness-identity__key-label">AI Key:</span>
        <span className="egbusiness-identity__key-name">
          {selectedGoogleKey?.name || 'No key selected'}
        </span>
        <span className="egbusiness-identity__connection-status">
          {getConnectionStatusIcon()} {getConnectionStatusText()}
        </span>
        <FontAwesomeIcon
          icon={faChevronDown}
          className={`egbusiness-identity__dropdown-icon ${showKeyDropdown ? 'open' : ''}`}
        />
      </div>
      {showKeyDropdown && (
        <div className="egbusiness-identity__key-dropdown">
          {googleKeys.map((key) => (
            <div
              key={key.id}
              className={`egbusiness-identity__key-option ${selectedGoogleKey?.id === key.id ? 'selected' : ''}`}
              onClick={() => onKeySelection(key)}
            >
              <FontAwesomeIcon icon={faKey} className="egbusiness-identity__key-option-icon" />
              <span className="egbusiness-identity__key-option-name">{key.name}</span>
              {selectedGoogleKey?.id === key.id && (
                <span className="egbusiness-identity__key-option-check">✓</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

