import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGlobe, faUser, faKey, faLink, faSave, faArrowRight } from '../../utils/fontAwesomeIcons';
import './WordPressConnectionForm.css';

interface WordPressConnectionFormData {
  name: string;
  url: string;
  username: string;
  password: string;
}

interface WordPressConnectionFormProps {
  onBack: () => void;
  onConnect: (formData: WordPressConnectionFormData) => Promise<void>;
  editingConnection?: WordPressConnection | null;
}

interface WordPressConnection {
  id: string;
  name: string;
  url: string;
  username: string;
  password: string;
  createdAt: string;
  updatedAt: string;
}

const WordPressConnectionForm: React.FC<WordPressConnectionFormProps> = ({ onBack, onConnect, editingConnection }) => {
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [formData, setFormData] = useState<WordPressConnectionFormData>({
    name: editingConnection?.name || '',
    url: editingConnection?.url || '',
    username: editingConnection?.username || '',
    password: editingConnection?.password || ''
  });
  const [formErrors, setFormErrors] = useState<Partial<WordPressConnectionFormData>>({});
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  // Update form data when editingConnection changes
  React.useEffect(() => {
    if (editingConnection) {
      setFormData({
        name: editingConnection.name,
        url: editingConnection.url,
        username: editingConnection.username,
        password: editingConnection.password
      });
    }
  }, [editingConnection]);

  const handleInputChange = (field: keyof WordPressConnectionFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const errors: Partial<WordPressConnectionFormData> = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Connection name is required';
    }
    
    if (!formData.url.trim()) {
      errors.url = 'WordPress URL is required';
    } else if (!isValidUrl(formData.url)) {
      errors.url = 'Please enter a valid URL';
    }
    
    if (!formData.username.trim()) {
      errors.username = 'Username is required';
    }
    
    if (!formData.password.trim()) {
      errors.password = 'Application password is required';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsConnecting(true);
    
    try {
      // Save connection to Electron store
      const result = await window.electron.wordpress.saveConnection(formData);
      
      if (result.success) {
        console.log('WordPress connection saved successfully:', result);
        // Reset form on success
        setFormData({ name: '', url: '', username: '', password: '' });
        // Call the parent's onConnect callback
        await onConnect(formData);
      } else {
        throw new Error(result.error || 'Failed to save connection');
      }
    } catch (error) {
      console.error('Connection failed:', error);
      // You could add a toast notification here
      alert(`Failed to save connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="wordpress-connection-form">
      <div className="form-container">
        <div className="form-header">
          <div className="form-title">
            <h1>{editingConnection ? 'Edit WordPress Connection' : 'Connect to WordPress'}</h1>
            <p>{editingConnection ? 'Update your WordPress site connection details' : 'Enter your WordPress site details to establish a secure connection'}</p>
          </div>
          <button className="back-btn" onClick={onBack}>
            <FontAwesomeIcon icon={faArrowRight} />
            <span>Back</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="wordpress-form">
          <div className="form-grid">
            {/* Connection Name */}
            <div className="form-group">
              <label htmlFor="connection-name">
                <FontAwesomeIcon icon={faSave} />
                Connection Name
              </label>
              <input
                type="text"
                id="connection-name"
                placeholder="My WordPress Site"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={formErrors.name ? 'error' : ''}
              />
              {formErrors.name && <span className="error-message">{formErrors.name}</span>}
              <small>Give this connection a memorable name</small>
            </div>

            {/* WordPress URL */}
            <div className="form-group">
              <label htmlFor="wordpress-url">
                <FontAwesomeIcon icon={faLink} />
                WordPress URL
              </label>
              <input
                type="url"
                id="wordpress-url"
                placeholder="https://yoursite.com"
                value={formData.url}
                onChange={(e) => handleInputChange('url', e.target.value)}
                className={formErrors.url ? 'error' : ''}
              />
              {formErrors.url && <span className="error-message">{formErrors.url}</span>}
              <small>Enter your WordPress site URL (include https://)</small>
            </div>

            {/* Username */}
            <div className="form-group">
              <label htmlFor="username">
                <FontAwesomeIcon icon={faUser} />
                Username
              </label>
              <input
                type="text"
                id="username"
                placeholder="your_username"
                value={formData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                className={formErrors.username ? 'error' : ''}
              />
              {formErrors.username && <span className="error-message">{formErrors.username}</span>}
              <small>Your WordPress admin username</small>
            </div>

            {/* Application Password */}
            <div className="form-group">
              <label htmlFor="app-password">
                <FontAwesomeIcon icon={faKey} />
                Application Password
              </label>
              <div className="password-input">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="app-password"
                  placeholder="xxxx xxxx xxxx xxxx"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className={formErrors.password ? 'error' : ''}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {formErrors.password && <span className="error-message">{formErrors.password}</span>}
              <small>
                Generate an application password in WordPress Admin → Users → Your Profile → Application Passwords
              </small>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="cancel-btn" onClick={onBack}>
              Cancel
            </button>
            <button 
              type="submit" 
              className={`submit-btn ${isConnecting ? 'connecting' : ''}`}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <div className="spinner"></div>
                  <span>Connecting...</span>
                </>
              ) : (
                  <>
                    <FontAwesomeIcon icon={faGlobe} />
                    <span>{editingConnection ? 'Update Connection' : 'Connect to WordPress'}</span>
                  </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WordPressConnectionForm;
