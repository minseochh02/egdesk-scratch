import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faCheck, faSpinner } from '@fortawesome/free-solid-svg-icons';
import './YouTubeConnectionForm.css';

interface YouTubeConnectionFormProps {
  onClose: () => void;
  onSuccess?: (connection: any) => void;
}

const YouTubeConnectionForm: React.FC<YouTubeConnectionFormProps> = ({
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    channelId: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Connection name is required';
    }

    if (!formData.username.trim()) {
      errors.username = 'Username is required';
    }

    if (!formData.password.trim()) {
      errors.password = 'Password is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    try {
      const result = await window.electron.youtube.saveConnection({
        name: formData.name,
        username: formData.username,
        password: formData.password,
        channelId: formData.channelId.trim() || undefined,
      });

      if (result.success && result.connection) {
        if (onSuccess) {
          onSuccess(result.connection);
        }
        onClose();
      } else {
        throw new Error(result.error || 'Failed to save YouTube connection');
      }
    } catch (error) {
      console.error('[YouTubeConnectionForm] Error saving connection:', error);
      alert(`Failed to save connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    if (formErrors[field]) {
      setFormErrors({ ...formErrors, [field]: '' });
    }
  };

  return (
    <div className="youtube-connection-form-overlay" onClick={onClose}>
      <div className="youtube-connection-form" onClick={(e) => e.stopPropagation()}>
        <div className="youtube-connection-form-header">
          <h2>Connect YouTube Account</h2>
          <button
            type="button"
            className="youtube-connection-form-close"
            onClick={onClose}
            disabled={isSaving}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="youtube-connection-form-body">
          <div className="youtube-connection-form-field">
            <label htmlFor="connection-name">
              Connection Name <span className="required">*</span>
            </label>
            <input
              id="connection-name"
              type="text"
              placeholder="My YouTube Channel"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              disabled={isSaving}
            />
            {formErrors.name && (
              <span className="youtube-connection-form-error">{formErrors.name}</span>
            )}
          </div>

          <div className="youtube-connection-form-field">
            <label htmlFor="username">
              YouTube Username/Email <span className="required">*</span>
            </label>
            <input
              id="username"
              type="text"
              placeholder="username or email"
              value={formData.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              disabled={isSaving}
            />
            {formErrors.username && (
              <span className="youtube-connection-form-error">{formErrors.username}</span>
            )}
          </div>

          <div className="youtube-connection-form-field">
            <label htmlFor="password">
              Password <span className="required">*</span>
            </label>
            <input
              id="password"
              type="password"
              placeholder="password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              disabled={isSaving}
            />
            {formErrors.password && (
              <span className="youtube-connection-form-error">{formErrors.password}</span>
            )}
          </div>

          <div className="youtube-connection-form-field">
            <label htmlFor="channel-id">
              Channel ID <span className="optional">(Optional)</span>
            </label>
            <input
              id="channel-id"
              type="text"
              placeholder="UC..."
              value={formData.channelId}
              onChange={(e) => handleInputChange('channelId', e.target.value)}
              disabled={isSaving}
            />
            <span className="youtube-connection-form-hint">
              Your YouTube channel ID (starts with UC). Leave empty if you don't know it.
            </span>
          </div>

          <div className="youtube-connection-form-actions">
            <button
              type="button"
              className="youtube-connection-form-cancel"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="youtube-connection-form-submit"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faCheck} />
                  <span>Connect</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default YouTubeConnectionForm;

