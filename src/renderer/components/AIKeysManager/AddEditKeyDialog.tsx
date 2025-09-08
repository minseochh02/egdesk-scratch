import React, { useState, useEffect } from 'react';
import { AIKey, AIProvider, AIKeyFormData } from './types';
import './AIKeysManager.css';

interface AddEditKeyDialogProps {
  onSave: (keyData: AIKeyFormData) => void;
  onClose: () => void;
  initialKey?: AIKey;
  providers: AIProvider[];
}

export const AddEditKeyDialog: React.FC<AddEditKeyDialogProps> = ({
  onSave,
  onClose,
  initialKey,
  providers,
}) => {
  const [formData, setFormData] = useState<AIKeyFormData>({
    providerId: initialKey?.providerId || providers[0]?.id || '',
    name: initialKey?.name || '',
    fields: initialKey?.fields || {},
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProvider = providers.find((p) => p.id === formData.providerId);

  useEffect(() => {
    if (selectedProvider && !formData.fields[selectedProvider.fields[0]?.key]) {
      // Initialize fields for the selected provider
      const initialFields: Record<string, string> = {};
      selectedProvider.fields.forEach((field) => {
        initialFields[field.key] = formData.fields[field.key] || '';
      });
      setFormData((prev) => ({ ...prev, fields: initialFields }));
    }
  }, [formData.providerId, selectedProvider]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    if (name === 'providerId') {
      setFormData((prev) => ({
        ...prev,
        providerId: value,
        fields: {}, // Reset fields when provider changes
      }));
    } else if (name === 'name') {
      setFormData((prev) => ({ ...prev, name: value }));
    } else {
      // Handle field changes
      setFormData((prev) => ({
        ...prev,
        fields: { ...prev.fields, [name]: value },
      }));
    }
    setError(null); // Clear error on input change
  };

  const validateForm = (): boolean => {
    if (!formData.providerId) {
      setError('Please select an AI provider');
      return false;
    }

    if (!formData.name.trim()) {
      setError('Please enter a name for this key');
      return false;
    }

    if (!selectedProvider) {
      setError('Invalid provider selected');
      return false;
    }

    // Validate required fields
    for (const field of selectedProvider.fields) {
      if (field.required && !formData.fields[field.key]?.trim()) {
        setError(`${field.label} is required`);
        return false;
      }
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    setError(null);

    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save key');
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="ai-key-dialog">
      <div className="dialog-overlay" onClick={onClose} />
      <div className="dialog-content">
        <div className="dialog-header">
          <h2>{initialKey ? 'Edit AI Key' : 'Add New AI Key'}</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="dialog-body">
          {/* Provider Selection */}
          <div className="form-group">
            <label htmlFor="providerId">AI Provider</label>
            <select
              id="providerId"
              name="providerId"
              value={formData.providerId}
              onChange={handleInputChange}
              disabled={isSaving || !!initialKey}
            >
              <option value="">Select a provider...</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.icon} {provider.name}
                </option>
              ))}
            </select>
            {selectedProvider && (
              <small className="help-text">
                {selectedProvider.description}
              </small>
            )}
          </div>

          {/* Key Name */}
          <div className="form-group">
            <label htmlFor="name">Key Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="e.g., My OpenAI Key"
              disabled={isSaving}
            />
            <small className="help-text">
              Give this key a descriptive name to identify it
            </small>
          </div>

          {/* Provider-specific Fields */}
          {selectedProvider && (
            <div className="provider-fields">
              <h3>Configuration</h3>
              {selectedProvider.fields.map((field) => (
                <div key={field.key} className="form-group">
                  <label htmlFor={field.key}>{field.label}</label>
                  <input
                    type={field.type}
                    id={field.key}
                    name={field.key}
                    value={formData.fields[field.key] || ''}
                    onChange={handleInputChange}
                    placeholder={field.placeholder}
                    disabled={isSaving}
                    required={field.required}
                  />
                  {field.helpText && (
                    <small className="help-text">{field.helpText}</small>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Show existing key info if editing */}
          {initialKey && (
            <div className="existing-key-info">
              <h3>Key Information</h3>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Created:</span>
                  <span className="info-value">
                    {formatDate(initialKey.createdAt)}
                  </span>
                </div>
                {initialKey.lastUsed && (
                  <div className="info-item">
                    <span className="info-label">Last Used:</span>
                    <span className="info-value">
                      {formatDate(initialKey.lastUsed)}
                    </span>
                  </div>
                )}
                <div className="info-item">
                  <span className="info-label">Status:</span>
                  <span
                    className={`status-badge ${initialKey.isActive ? 'active' : 'inactive'}`}
                  >
                    {initialKey.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {error && <div className="error-message">⚠️ {error}</div>}
        </div>

        <div className="dialog-footer">
          <button
            className="button-secondary"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            className="button-primary"
            onClick={handleSave}
            disabled={isSaving || !selectedProvider}
          >
            {isSaving ? 'Saving...' : initialKey ? 'Update Key' : 'Add Key'}
          </button>
        </div>
      </div>
    </div>
  );
};
