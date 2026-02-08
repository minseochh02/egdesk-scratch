/**
 * WebsiteSelector Component
 * Skillset library selection and new website exploration
 */

import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '../../../utils/fontAwesomeIcons';

interface WebsiteSkillset {
  id: string;
  url: string;
  siteName: string;
  siteType?: string;
  overallConfidence: number;
  lastUsedAt?: string;
}

interface CredentialStatus {
  hasCredentials: boolean;
  isValid: boolean;
  lastUsed?: Date;
  lastError?: string;
}

interface WebsiteSelectorProps {
  availableSkillsets: WebsiteSkillset[];
  selectedSkillsetId: string | null;
  credentialStatus: CredentialStatus | null;
  isExploring: boolean;
  onSkillsetSelect: (skillsetId: string | null) => void;
  onExploreWebsite: (url: string) => Promise<void>;
  onReExplore?: (skillsetId: string) => Promise<void>;
}

export const WebsiteSelector: React.FC<WebsiteSelectorProps> = ({
  availableSkillsets,
  selectedSkillsetId,
  credentialStatus,
  isExploring,
  onSkillsetSelect,
  onExploreWebsite,
  onReExplore,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUrl, setNewUrl] = useState('');

  const handleExplore = async () => {
    if (!newUrl.trim()) {
      alert('Please enter a URL');
      return;
    }

    await onExploreWebsite(newUrl.trim());
    setNewUrl('');
    setShowAddForm(false);
  };

  const selectedSkillset = availableSkillsets.find(s => s.id === selectedSkillsetId);

  return (
    <div className="rookie-upload-subsection">
      <h4 className="rookie-subsection-title">Websites (Optional)</h4>
      <p className="rookie-subsection-description">
        Select websites from your library or add new ones to explore. AI will extract data from these websites.
      </p>

      {/* Skillset Library Selector */}
      {availableSkillsets.length > 0 && (
        <div className="rookie-skillset-section">
          <label className="rookie-skillset-label">
            <strong>📚 Use from Library:</strong>
          </label>
          <select
            value={selectedSkillsetId || ''}
            onChange={(e) => onSkillsetSelect(e.target.value || null)}
            className="rookie-skillset-dropdown"
            disabled={isExploring}
          >
            <option value="">-- Select explored website --</option>
            {availableSkillsets.map((skillset) => (
              <option key={skillset.id} value={skillset.id}>
                {skillset.siteName} ({Math.round(skillset.overallConfidence * 100)}% confidence)
              </option>
            ))}
          </select>

          {selectedSkillset && (
            <div className="rookie-skillset-selected">
              <div className="rookie-skillset-selected-header">
                <span className="rookie-skillset-selected-icon">✓</span>
                <span className="rookie-skillset-selected-name">{selectedSkillset.siteName}</span>
                <span className="rookie-skillset-selected-confidence">
                  {Math.round(selectedSkillset.overallConfidence * 100)}% confidence
                </span>
              </div>
              <div className="rookie-skillset-selected-details">
                <div className="rookie-skillset-detail">
                  <strong>URL:</strong> {selectedSkillset.url}
                </div>
                <div className="rookie-skillset-detail">
                  <strong>Last used:</strong>{' '}
                  {selectedSkillset.lastUsedAt
                    ? new Date(selectedSkillset.lastUsedAt).toLocaleDateString()
                    : 'Never'}
                </div>
                {credentialStatus && credentialStatus.hasCredentials && (
                  <div className="rookie-skillset-detail">
                    <strong>Credentials:</strong>{' '}
                    {credentialStatus.isValid ? (
                      <span style={{ color: '#4CAF50' }}>✓ Saved (auto-login enabled)</span>
                    ) : (
                      <span style={{ color: '#FF9800' }}>⚠ Invalid (need to re-enter)</span>
                    )}
                  </div>
                )}
                {credentialStatus && !credentialStatus.hasCredentials && (
                  <div className="rookie-skillset-detail">
                    <strong>Credentials:</strong> <span style={{ color: '#888' }}>Not saved</span>
                  </div>
                )}
                <div className="rookie-skillset-detail-highlight">
                  ⚡ No exploration needed - using cached capabilities
                </div>
              </div>
              {onReExplore && (
                <button
                  type="button"
                  className="rookie-reexplore-button"
                  onClick={() => onReExplore(selectedSkillset.id)}
                  disabled={isExploring}
                  title="Re-explore this website to refresh capabilities while keeping saved credentials"
                >
                  🔄 Refresh Capabilities
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Exploration Progress */}
      {isExploring && (
        <div className="rookie-exploration-progress">
          <div className="rookie-spinner"></div>
          <div className="rookie-exploration-progress-text">
            <strong>🔍 Exploring Website...</strong>
            <p>
              EXPLORER is discovering login fields, mapping sections, and finding capabilities. This
              may take 2-3 minutes.
            </p>
          </div>
        </div>
      )}

      {/* Add New Website */}
      {!selectedSkillsetId && !isExploring && (
        <>
          {!showAddForm ? (
            <button
              type="button"
              className="rookie-add-website-button"
              onClick={() => setShowAddForm(true)}
            >
              + Add New Website to Explore
            </button>
          ) : (
            <div className="rookie-add-site-form">
              <input
                type="url"
                placeholder="Website URL (e.g., https://login.ecount.com)"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                className="rookie-site-input"
                autoFocus
              />
              <p className="rookie-site-form-note">
                🤖 EXPLORER will automatically discover login fields, map all sections, and save to
                your Skillset library
              </p>
              <div className="rookie-form-buttons">
                <button
                  type="button"
                  className="rookie-form-button-explore"
                  onClick={handleExplore}
                  disabled={isExploring || !newUrl.trim()}
                >
                  {isExploring ? '🔍 Exploring Website...' : '🔍 Explore Website'}
                </button>
                <button
                  type="button"
                  className="rookie-form-button-cancel"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewUrl('');
                  }}
                  disabled={isExploring}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
