import React, { useState, useEffect } from 'react';
import './ChromeExtensionSelector.css';

interface ChromeExtension {
  id: string;
  name: string;
  version: string;
  description: string;
  iconDataUrl?: string | null;
  extensionPath: string;
  profileName: string;
}

interface ChromeProfile {
  name: string;
  path: string;
  extensions: ChromeExtension[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (extensionPaths: string[]) => void;
}

export const ChromeExtensionSelector: React.FC<Props> = ({ isOpen, onClose, onSelect }) => {
  const [profiles, setProfiles] = useState<ChromeProfile[]>([]);
  const [selectedExtensions, setSelectedExtensions] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadExtensions();
      loadSavedPreferences();
    }
  }, [isOpen]);

  const loadExtensions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electron.chromeExtensions.scanProfiles();

      if (result.success) {
        setProfiles(result.profiles || []);
        console.log('[Extension Selector] Loaded profiles:', result.profiles);
      } else {
        setError(result.error || 'Failed to scan extensions');
      }
    } catch (err) {
      console.error('[Extension Selector] Error loading extensions:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSavedPreferences = async () => {
    try {
      const result = await window.electron.chromeExtensions.getPreferences();
      if (result.success && result.selectedExtensions) {
        setSelectedExtensions(new Set(result.selectedExtensions));
        console.log('[Extension Selector] Loaded saved preferences:', result.selectedExtensions);
      }
    } catch (err) {
      console.error('[Extension Selector] Failed to load saved preferences:', err);
    }
  };

  const handleToggleExtension = (extensionPath: string) => {
    const newSelected = new Set(selectedExtensions);

    if (newSelected.has(extensionPath)) {
      newSelected.delete(extensionPath);
    } else {
      newSelected.add(extensionPath);
    }

    setSelectedExtensions(newSelected);
  };

  const handleSelectAll = (profile: ChromeProfile) => {
    const newSelected = new Set(selectedExtensions);
    profile.extensions.forEach(ext => newSelected.add(ext.extensionPath));
    setSelectedExtensions(newSelected);
  };

  const handleDeselectAll = (profile: ChromeProfile) => {
    const newSelected = new Set(selectedExtensions);
    profile.extensions.forEach(ext => newSelected.delete(ext.extensionPath));
    setSelectedExtensions(newSelected);
  };

  const handleConfirm = async () => {
    const extensionPaths = Array.from(selectedExtensions);

    // Save preferences
    try {
      await window.electron.chromeExtensions.savePreferences(extensionPaths);
      console.log('[Extension Selector] Saved preferences:', extensionPaths);
    } catch (err) {
      console.error('[Extension Selector] Failed to save preferences:', err);
    }

    // Pass to parent
    onSelect(extensionPaths);
    onClose();
  };

  if (!isOpen) return null;

  const totalExtensions = profiles.reduce((sum, profile) => sum + profile.extensions.length, 0);

  return (
    <div className="extension-selector-overlay" onClick={onClose}>
      <div className="extension-selector-modal" onClick={(e) => e.stopPropagation()}>
        <div className="extension-selector-header">
          <h2>Select Chrome Extensions</h2>
          <button className="extension-selector-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="extension-selector-body">
          {isLoading && (
            <div className="extension-selector-loading">
              <div className="extension-selector-spinner"></div>
              <p>Scanning Chrome profiles...</p>
            </div>
          )}

          {error && (
            <div className="extension-selector-error">
              <p>❌ {error}</p>
              <button className="extension-selector-retry-btn" onClick={loadExtensions}>
                Retry
              </button>
            </div>
          )}

          {!isLoading && !error && profiles.length === 0 && (
            <div className="extension-selector-empty">
              <p>No Chrome profiles with extensions found.</p>
              <p className="extension-selector-hint">
                Make sure Google Chrome is installed and has extensions.
              </p>
            </div>
          )}

          {!isLoading && !error && profiles.length > 0 && (
            <>
              <div className="extension-selector-summary">
                Found {totalExtensions} extension{totalExtensions !== 1 ? 's' : ''} across {profiles.length} profile{profiles.length !== 1 ? 's' : ''}
              </div>

              <div className="extension-selector-profiles">
                {profiles.map(profile => (
                  <div key={profile.name} className="extension-selector-profile">
                    <div className="extension-selector-profile-header">
                      <h3>📁 {profile.name}</h3>
                      <div className="extension-selector-profile-actions">
                        <button
                          className="extension-selector-text-btn"
                          onClick={() => handleSelectAll(profile)}
                        >
                          Select All
                        </button>
                        <button
                          className="extension-selector-text-btn"
                          onClick={() => handleDeselectAll(profile)}
                        >
                          Deselect All
                        </button>
                      </div>
                    </div>

                    <div className="extension-selector-extensions">
                      {profile.extensions.length === 0 && (
                        <p className="extension-selector-no-extensions">
                          No extensions in this profile
                        </p>
                      )}

                      {profile.extensions.map(extension => {
                        const isSelected = selectedExtensions.has(extension.extensionPath);

                        return (
                          <div
                            key={extension.id}
                            className={`extension-selector-extension ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleToggleExtension(extension.extensionPath)}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleExtension(extension.extensionPath)}
                              onClick={(e) => e.stopPropagation()}
                            />

                            <div className="extension-selector-icon">
                              {extension.iconDataUrl ? (
                                <img src={extension.iconDataUrl} alt={extension.name} />
                              ) : (
                                <div className="extension-selector-icon-placeholder">🧩</div>
                              )}
                            </div>

                            <div className="extension-selector-info">
                              <div className="extension-selector-name">{extension.name}</div>
                              <div className="extension-selector-version">v{extension.version}</div>
                              {extension.description && (
                                <div className="extension-selector-description" title={extension.description}>
                                  {extension.description}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="extension-selector-footer">
          <div className="extension-selector-count">
            {selectedExtensions.size} extension{selectedExtensions.size !== 1 ? 's' : ''} selected
          </div>
          <div className="extension-selector-actions">
            <button className="extension-selector-btn extension-selector-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              className="extension-selector-btn extension-selector-btn-primary"
              onClick={handleConfirm}
              disabled={isLoading}
            >
              Use Selected Extensions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
