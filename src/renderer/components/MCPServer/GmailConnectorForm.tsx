import React, { useState, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faArrowRight, faUpload, faFile, faCheck, faTimes } from '../../utils/fontAwesomeIcons';
import './GmailConnectorForm.css';

interface GmailConnectorFormProps {
  onBack: () => void;
  onConnect: (connectionData: any) => void;
}

interface GmailConnectionData {
  id: string;
  name: string;
  email: string;
  serviceAccountKey: any;
  createdAt: string;
  updatedAt: string;
  type: 'gmail';
}

const GmailConnectorForm: React.FC<GmailConnectorFormProps> = ({ onBack, onConnect }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [connectionName, setConnectionName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = async (file: File) => {
    if (!file.name.endsWith('.json')) {
      setError('Please select a JSON file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      setError('File size must be less than 5MB');
      return;
    }

    setError('');
    setUploadedFile(file);
    setIsLoading(true);

    try {
      const content = await readFileAsText(file);
      const jsonData = JSON.parse(content);
      
      // Validate service account key structure
      if (!jsonData.type || jsonData.type !== 'service_account') {
        throw new Error('Invalid service account key file');
      }
      
      if (!jsonData.client_email || !jsonData.private_key) {
        throw new Error('Missing required fields in service account key');
      }

      setFileContent(jsonData);
      setConnectionName(jsonData.client_email || 'Gmail Service Account');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON file');
      setUploadedFile(null);
      setFileContent(null);
    } finally {
      setIsLoading(false);
    }
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setFileContent(null);
    setConnectionName('');
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConnect = async () => {
    if (!fileContent || !connectionName.trim()) {
      setError('Please upload a valid service account key file and enter a connection name');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const connectionData: GmailConnectionData = {
        id: `gmail-${Date.now()}`,
        name: connectionName.trim(),
        email: fileContent.client_email,
        serviceAccountKey: fileContent,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        type: 'gmail'
      };

      // Save to Electron store
      const result = await window.electron.mcpConfig.connections.add(connectionData);
      
      if (result.success) {
        onConnect(result.connection);
      } else {
        setError(result.error || 'Failed to save Gmail connection');
      }
    } catch (error) {
      console.error('Error saving Gmail connection:', error);
      setError('Failed to save Gmail connection. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="gmail-connector-form">
      <div className="connector-header">
        <button className="return-btn" onClick={onBack}>
          <FontAwesomeIcon icon={faArrowRight} />
          <span>Back to MCP Tools</span>
        </button>
      </div>
      
      <div className="connection-form-section">
        <div className="form-container">
          <div className="form-header">
            <div className="form-title">
              <h3>Gmail Service Account Setup</h3>
              <p>Upload your Google Service Account JSON key file to connect Gmail for AI-powered email integration</p>
            </div>
          </div>
          
          <div className="gmail-form">
            {/* File Upload Area */}
            <div className="form-group">
              <label>Service Account Key File</label>
              <div 
                className={`file-upload-area ${isDragOver ? 'drag-over' : ''} ${uploadedFile ? 'has-file' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleBrowseClick}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileInputChange}
                  style={{ display: 'none' }}
                />
                
                {!uploadedFile ? (
                  <div className="upload-content">
                    <div className="upload-icon">
                      <FontAwesomeIcon icon={faUpload} />
                    </div>
                    <div className="upload-text">
                      <h4>Drop your service account JSON file here</h4>
                      <p>or click to browse files</p>
                    </div>
                    <div className="upload-requirements">
                      <p>• Must be a valid Google Service Account JSON file</p>
                      <p>• File size limit: 5MB</p>
                      <p>• Required for Gmail API access</p>
                    </div>
                  </div>
                ) : (
                  <div className="file-preview">
                    <div className="file-info">
                      <div className="file-icon">
                        <FontAwesomeIcon icon={faFile} />
                      </div>
                      <div className="file-details">
                        <h4>{uploadedFile.name}</h4>
                        <p>{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                        <div className="file-status">
                          <FontAwesomeIcon icon={faCheck} />
                          <span>Valid service account key</span>
                        </div>
                      </div>
                    </div>
                    <button 
                      className="remove-file-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFile();
                      }}
                    >
                      <FontAwesomeIcon icon={faTimes} />
                    </button>
                  </div>
                )}
                
                {isLoading && (
                  <div className="loading-overlay">
                    <div className="spinner"></div>
                    <p>Validating file...</p>
                  </div>
                )}
              </div>
              
              {error && (
                <div className="error-message">
                  <FontAwesomeIcon icon={faTimes} />
                  {error}
                </div>
              )}
            </div>

            {/* Connection Name */}
            <div className="form-group">
              <label htmlFor="connectionName">Connection Name</label>
              <input
                id="connectionName"
                type="text"
                value={connectionName}
                onChange={(e) => setConnectionName(e.target.value)}
                placeholder="Enter a name for this Gmail connection"
                disabled={!fileContent}
              />
              <small>This will help you identify this connection later</small>
            </div>

            {/* Service Account Info */}
            {fileContent && (
              <div className="service-account-info">
                <h4>Service Account Information</h4>
                <div className="info-grid">
                  <div className="info-item">
                    <strong>Project ID:</strong>
                    <span>{fileContent.project_id || 'N/A'}</span>
                  </div>
                  <div className="info-item">
                    <strong>Client Email:</strong>
                    <span>{fileContent.client_email}</span>
                  </div>
                  <div className="info-item">
                    <strong>Client ID:</strong>
                    <span>{fileContent.client_id || 'N/A'}</span>
                  </div>
                  <div className="info-item">
                    <strong>Auth URI:</strong>
                    <span>{fileContent.auth_uri || 'N/A'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Form Actions */}
            <div className="form-actions">
              <button 
                className="cancel-btn"
                onClick={onBack}
              >
                Cancel
              </button>
              <button 
                className="submit-btn"
                onClick={handleConnect}
                disabled={!fileContent || !connectionName.trim() || isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="spinner"></div>
                    Connecting...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faEnvelope} />
                    Connect Gmail
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GmailConnectorForm;
