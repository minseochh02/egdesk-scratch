import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faUser, faPlus, faTimes } from '@fortawesome/free-solid-svg-icons';
import type { BusinessIdentityScheduledTask } from './BusinessIdentityScheduledDemo';

interface AccountSelectorProps {
  task: BusinessIdentityScheduledTask;
  onAccountChange?: (task: BusinessIdentityScheduledTask, connectionId: string | null, connectionName: string | null, connectionType: string | null) => void;
  getAvailableConnections?: (channel: string) => Promise<Array<{ id: string; name: string; type: string }>>;
}

const AccountSelector: React.FC<AccountSelectorProps> = ({
  task,
  onAccountChange,
  getAvailableConnections,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [connections, setConnections] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Form state for adding new connection
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    username: '',
    password: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Load connections for blog platforms (WordPress, Naver Blog, Tistory) and social media (Instagram, YouTube)
    const isSupportedPlatform = /wordpress|naver|tistory|instagram|youtube/i.test(task.channel);
    if (isSupportedPlatform && getAvailableConnections) {
      loadConnections();
    }
  }, [task.channel, getAvailableConnections]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (connection: { id: string; name: string; type: string } | null) => {
    if (onAccountChange) {
      onAccountChange(
        task,
        connection?.id ?? null,
        connection?.name ?? null,
        connection?.type ?? null
      );
    }
    setIsOpen(false);
    setShowAddForm(false);
  };

  const handleAddNew = () => {
    setShowAddForm(true);
    setIsOpen(true);
  };

  const handleCancelAdd = () => {
    setShowAddForm(false);
    setFormData({ name: '', url: '', username: '', password: '' });
    setFormErrors({});
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    const normalized = task.channel.toLowerCase().trim();
    
    if (!formData.name.trim()) {
      errors.name = 'Connection name is required';
    }
    
    if (normalized.includes('wordpress') || normalized === 'wp') {
      if (!formData.url.trim()) {
        errors.url = 'WordPress URL is required';
      } else {
        try {
          new URL(formData.url);
        } catch {
          errors.url = 'Please enter a valid URL';
        }
      }
    }
    
    // Instagram and YouTube don't need URL, only username and password
    if (!formData.username.trim()) {
      errors.username = 'Username is required';
    }
    
    if (!formData.password.trim()) {
      errors.password = 'Password is required';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveNewConnection = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    try {
      const normalized = task.channel.toLowerCase().trim();
      let result;

      if (normalized.includes('wordpress') || normalized === 'wp') {
        result = await window.electron.wordpress.saveConnection({
          name: formData.name,
          url: formData.url,
          username: formData.username,
          password: formData.password,
        });
      } else if (normalized.includes('naver')) {
        result = await window.electron.naver.saveConnection({
          name: formData.name,
          username: formData.username,
          password: formData.password,
        });
      } else if (normalized.includes('instagram')) {
        result = await window.electron.instagram.saveConnection({
          name: formData.name,
          username: formData.username,
          password: formData.password,
        });
      } else if (normalized.includes('youtube') || normalized === 'yt') {
        // TODO: Implement YouTube connection saving when handler is created
        throw new Error('YouTube connection saving not yet implemented');
      } else {
        throw new Error('Unsupported platform');
      }

      if (result.success && result.connection) {
        // Reload connections
        await loadConnections();
        
        // Select the newly created connection
        let connectionType = 'unknown';
        if (normalized.includes('wordpress') || normalized === 'wp') {
          connectionType = 'wordpress';
        } else if (normalized.includes('naver')) {
          connectionType = 'naver';
        } else if (normalized.includes('instagram')) {
          connectionType = 'instagram';
        } else if (normalized.includes('youtube') || normalized === 'yt') {
          connectionType = 'youtube';
        }
        
        handleSelect({
          id: result.connection.id,
          name: result.connection.name,
          type: connectionType,
        });
        
        // Reset form
        setFormData({ name: '', url: '', username: '', password: '' });
        setShowAddForm(false);
      } else {
        throw new Error(result.error || 'Failed to save connection');
      }
    } catch (error) {
      console.error('[AccountSelector] Error saving connection:', error);
      alert(`Failed to save connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const loadConnections = async () => {
    if (!getAvailableConnections) return;
    
    setLoading(true);
    try {
      const available = await getAvailableConnections(task.channel);
      setConnections(available);
    } catch (error) {
      console.error('[AccountSelector] Error loading connections:', error);
      setConnections([]);
    } finally {
      setLoading(false);
    }
  };

  const isSupportedPlatform = /wordpress|naver|tistory|instagram|youtube/i.test(task.channel);
  
  if (!isSupportedPlatform) {
    // For unsupported platforms, don't show account selector
    return null;
  }

  const selectedConnection = task.connectionId
    ? connections.find(c => c.id === task.connectionId)
    : null;

  return (
    <div className="egbusiness-identity__account-selector" ref={dropdownRef}>
      <button
        type="button"
        className="egbusiness-identity__account-selector-button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        disabled={loading}
      >
        <FontAwesomeIcon icon={faUser} />
        <span>
          {selectedConnection
            ? selectedConnection.name
            : connections.length === 0
            ? 'Add account'
            : 'Select account'}
        </span>
        <FontAwesomeIcon icon={faChevronDown} className={isOpen ? 'open' : ''} />
      </button>
      
      {isOpen && (
        <div className="egbusiness-identity__account-selector-dropdown">
          {showAddForm ? (
            <div className="egbusiness-identity__account-selector-add-form">
              <div className="egbusiness-identity__account-selector-form-header">
                <h4>Add New {task.channel} Account</h4>
                <button
                  type="button"
                  className="egbusiness-identity__account-selector-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancelAdd();
                  }}
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
              <div className="egbusiness-identity__account-selector-form-body">
                <div className="egbusiness-identity__account-selector-form-field">
                  <label>Connection Name</label>
                  <input
                    type="text"
                    placeholder="My Blog Connection"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                      if (formErrors.name) setFormErrors({ ...formErrors, name: '' });
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  {formErrors.name && <span className="error">{formErrors.name}</span>}
                </div>
                {(task.channel.toLowerCase().includes('wordpress') || task.channel.toLowerCase() === 'wp') && (
                  <div className="egbusiness-identity__account-selector-form-field">
                    <label>WordPress URL</label>
                    <input
                      type="url"
                      placeholder="https://example.com"
                      value={formData.url}
                      onChange={(e) => {
                        setFormData({ ...formData, url: e.target.value });
                        if (formErrors.url) setFormErrors({ ...formErrors, url: '' });
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    {formErrors.url && <span className="error">{formErrors.url}</span>}
                  </div>
                )}
                {/* Instagram and YouTube don't need URL field */}
                <div className="egbusiness-identity__account-selector-form-field">
                  <label>Username</label>
                  <input
                    type="text"
                    placeholder="username"
                    value={formData.username}
                    onChange={(e) => {
                      setFormData({ ...formData, username: e.target.value });
                      if (formErrors.username) setFormErrors({ ...formErrors, username: '' });
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  {formErrors.username && <span className="error">{formErrors.username}</span>}
                </div>
                <div className="egbusiness-identity__account-selector-form-field">
                  <label>Password</label>
                  <input
                    type="password"
                    placeholder="password"
                    value={formData.password}
                    onChange={(e) => {
                      setFormData({ ...formData, password: e.target.value });
                      if (formErrors.password) setFormErrors({ ...formErrors, password: '' });
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  {formErrors.password && <span className="error">{formErrors.password}</span>}
                </div>
                <div className="egbusiness-identity__account-selector-form-actions">
                  <button
                    type="button"
                    className="egbusiness-identity__account-selector-cancel"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCancelAdd();
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="egbusiness-identity__account-selector-save"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSaveNewConnection();
                    }}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="egbusiness-identity__account-selector-option add-new"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddNew();
                }}
              >
                <FontAwesomeIcon icon={faPlus} />
                <span>Add New Account</span>
              </button>
              <button
                type="button"
                className="egbusiness-identity__account-selector-option"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(null);
                }}
              >
                <span>None</span>
              </button>
              {connections.map((connection) => (
                <button
                  key={connection.id}
                  type="button"
                  className={`egbusiness-identity__account-selector-option ${
                    selectedConnection?.id === connection.id ? 'selected' : ''
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(connection);
                  }}
                >
                  <span>{connection.name}</span>
                  <span className="egbusiness-identity__account-selector-type">{connection.type}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AccountSelector;

