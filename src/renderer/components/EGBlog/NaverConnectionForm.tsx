import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGlobe, faUser, faKey, faSave, faArrowRight } from '../../utils/fontAwesomeIcons';
import './NaverConnectionForm.css';

interface NaverConnectionFormData {
  name: string;
  username: string;
  password: string;
}

interface NaverConnectionFormProps {
  onBack: () => void;
  onConnect: (formData: NaverConnectionFormData) => Promise<void>;
  editingConnection?: NaverConnection | null;
}

interface NaverConnection {
  id: string;
  name: string;
  url: string;
  username: string;
  password: string;
  createdAt: string;
  updatedAt: string;
}

const NaverConnectionForm: React.FC<NaverConnectionFormProps> = ({ onBack, onConnect, editingConnection }) => {
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [formData, setFormData] = useState<NaverConnectionFormData>({
    name: editingConnection?.name || '',
    username: editingConnection?.username || '',
    password: editingConnection?.password || ''
  });
  const [formErrors, setFormErrors] = useState<Partial<NaverConnectionFormData>>({});
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  // Update form data when editingConnection changes
  React.useEffect(() => {
    if (editingConnection) {
      setFormData({
        name: editingConnection.name,
        username: editingConnection.username,
        password: editingConnection.password
      });
    }
  }, [editingConnection]);

  const handleInputChange = (field: keyof NaverConnectionFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const errors: Partial<NaverConnectionFormData> = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Connection name is required';
    }
    
    if (!formData.username.trim()) {
      errors.username = 'Naver ID is required';
    }
    
    if (!formData.password.trim()) {
      errors.password = 'Password is required';
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
      const result = await window.electron.naver.saveConnection(formData);
      
      if (result.success) {
        console.log('Naver connection saved successfully:', result);
        // Reset form on success
        setFormData({ name: '', username: '', password: '' });
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
    <div className="naver-connection-form">
      <div className="form-container">
        <div className="form-header">
          <div className="form-title">
            <h1>{editingConnection ? 'Edit Naver Blog Connection' : 'Connect to Naver Blog'}</h1>
            <p>{editingConnection ? 'Update your Naver Blog connection details' : 'Enter your Naver account details to establish a secure connection'}</p>
          </div>
          <button className="back-btn" onClick={onBack}>
            <FontAwesomeIcon icon={faArrowRight} />
            <span>Back</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="naver-form">
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
                placeholder="My Naver Blog"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={formErrors.name ? 'error' : ''}
              />
              {formErrors.name && <span className="error-message">{formErrors.name}</span>}
              <small>Give this connection a memorable name</small>
            </div>

            {/* Naver ID */}
            <div className="form-group">
              <label htmlFor="naver-id">
                <FontAwesomeIcon icon={faUser} />
                Naver ID
              </label>
              <input
                type="text"
                id="naver-id"
                placeholder="your_naver_id"
                value={formData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                className={formErrors.username ? 'error' : ''}
              />
              {formErrors.username && <span className="error-message">{formErrors.username}</span>}
              <small>Your Naver account ID</small>
            </div>

            {/* Password */}
            <div className="form-group">
              <label htmlFor="password">
                <FontAwesomeIcon icon={faKey} />
                Password
              </label>
              <div className="password-input">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  placeholder="Your Naver password"
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
              <small>Your Naver account password</small>
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
                    <span>{editingConnection ? 'Update Connection' : 'Connect to Naver Blog'}</span>
                  </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NaverConnectionForm;
