import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faCheck, faSpinner } from '@fortawesome/free-solid-svg-icons';
import './FacebookConnectionForm.css';

interface FacebookConnectionFormProps {
  onClose: () => void;
  onSuccess?: (connection: any) => void;
}

const FacebookConnectionForm: React.FC<FacebookConnectionFormProps> = ({
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    pageId: '',
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
      const result = await window.electron.facebook.saveConnection({
        name: formData.name,
        username: formData.username,
        password: formData.password,
        pageId: formData.pageId.trim() || undefined,
      });

      if (result.success && result.connection) {
        if (onSuccess) {
          onSuccess(result.connection);
        }
        onClose();
      } else {
        throw new Error(result.error || 'Failed to save Facebook connection');
      }
    } catch (error) {
      console.error('[FacebookConnectionForm] Error saving connection:', error);
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
    <div className="facebook-connection-form-overlay" onClick={onClose}>
      <div className="facebook-connection-form" onClick={(e) => e.stopPropagation()}>
        <div className="facebook-connection-form-header">
          <h2>Connect Facebook Account</h2>
          <button
            type="button"
            className="facebook-connection-form-close"
            onClick={onClose}
            disabled={isSaving}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="facebook-connection-form-body">
          <div className="facebook-connection-form-field">
            <label htmlFor="connection-name">
              Connection Name <span className="required">*</span>
            </label>
            <input
              id="connection-name"
              type="text"
              placeholder="My Facebook Page"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              disabled={isSaving}
            />
            {formErrors.name && (
              <span className="facebook-connection-form-error">{formErrors.name}</span>
            )}
          </div>

          <div className="facebook-connection-form-field">
            <label htmlFor="username">
              Facebook Email/Phone/Username <span className="required">*</span>
            </label>
            <input
              id="username"
              type="text"
              placeholder="email, phone number, or username"
              value={formData.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              disabled={isSaving}
            />
            {formErrors.username && (
              <span className="facebook-connection-form-error">{formErrors.username}</span>
            )}
          </div>

          <div className="facebook-connection-form-field">
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
              <span className="facebook-connection-form-error">{formErrors.password}</span>
            )}
          </div>

          <div className="facebook-connection-form-field">
            <label htmlFor="page-id">
              Page ID <span className="optional">(Optional)</span>
            </label>
            <input
              id="page-id"
              type="text"
              placeholder="Page ID"
              value={formData.pageId}
              onChange={(e) => handleInputChange('pageId', e.target.value)}
              disabled={isSaving}
            />
            <span className="facebook-connection-form-hint">
              Your Facebook page ID. Leave empty if you don't know it.
            </span>
          </div>

          <div className="facebook-connection-form-actions">
            <button
              type="button"
              className="facebook-connection-form-cancel"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="facebook-connection-form-submit"
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

export default FacebookConnectionForm;

