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
  mode: 'workspace' | 'personal';
  adminEmail: string;
  serviceAccountKey?: any;
  createdAt: string;
  updatedAt: string;
  type: 'gmail';
}

const GmailConnectorForm: React.FC<GmailConnectorFormProps> = ({ onBack, onConnect }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [showEmailInput, setShowEmailInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [personalLoading, setPersonalLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [showOAuthOption, setShowOAuthOption] = useState(false);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleFileSelect(files[0]);
  };
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) handleFileSelect(files[0]);
  };

  const handleFileSelect = async (file: File) => {
    if (!file.name.endsWith('.json')) { setError('Please select a JSON file'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('File size must be less than 5MB'); return; }
    setError('');
    setUploadedFile(file);
    setIsLoading(true);
    try {
      const content = await readFileAsText(file);
      const jsonData = JSON.parse(content);
      if (!jsonData.type || jsonData.type !== 'service_account') throw new Error('Invalid service account key file');
      if (!jsonData.client_email || !jsonData.private_key) throw new Error('Missing required fields in service account key');
      setFileContent(jsonData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON file');
      setUploadedFile(null);
      setFileContent(null);
    } finally {
      setIsLoading(false);
    }
  };

  const readFileAsText = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });

  const handleRemoveFile = () => {
    setUploadedFile(null); setFileContent(null); setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConnect = async () => {
    if (!fileContent) {
      setError('Please upload a valid service account key file');
      return;
    }

    if (showEmailInput && !email.trim()) {
      setError('Please enter an email address to connect');
      return;
    }

    setIsLoading(true); setError('');
    try {
      // If we don't have an email yet, we try to detect using the service account's own domain 
      // or common admin patterns, but realistically we need an email to check delegation.
      // We'll ask for one if it's missing.
      if (!email.trim()) {
        setShowEmailInput(true);
        setIsLoading(false);
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) { setError('Please enter a valid email address'); setIsLoading(false); return; }

      // Auto-detect: try Directory API to see if this is a workspace domain
      const detectResult = await (window.electron as any).gmailMCP.detectMode(fileContent, email.trim());
      const mode: 'workspace' | 'personal' = detectResult.mode || 'personal';

      const connectionData: GmailConnectionData = {
        id: `gmail-${Date.now()}`,
        name: email.trim(),
        email: email.trim(),
        mode,
        adminEmail: email.trim(),
        serviceAccountKey: fileContent,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        type: 'gmail',
      };

      const result = await window.electron.mcpConfig.connections.add(connectionData);
      if (result.success) {
        onConnect(result.connection);
      } else {
        setError(result.error || 'Failed to save Gmail connection');
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to connect Gmail';
      setError(msg);
      if (msg.includes('unauthorized_client') || msg.includes('gmail.com')) {
        setError('This service account is not authorized to access this email. Note: Service accounts cannot access personal @gmail.com accounts.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="gmail-connector-form">
      <div className="connector-header">
        <button className="return-btn" onClick={onBack}>
          <FontAwesomeIcon icon={faArrowRight} />
          <span>Back</span>
        </button>
      </div>

      <div className="connection-form-section">
        <div className="form-container">
          <div className="form-header">
            <div className="form-title">
              <h3>Connect Gmail</h3>
              <p>Upload your Google Service Account key and enter an email address to connect</p>
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
                onClick={() => fileInputRef.current?.click()}
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
                    <div className="upload-icon"><FontAwesomeIcon icon={faUpload} /></div>
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
                      <div className="file-icon"><FontAwesomeIcon icon={faFile} /></div>
                      <div className="file-details">
                        <h4>{uploadedFile.name}</h4>
                        <p>{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                        <div className="file-status">
                          <FontAwesomeIcon icon={faCheck} />
                          <span>Valid service account key</span>
                        </div>
                      </div>
                    </div>
                    <button className="remove-file-btn" onClick={(e) => { e.stopPropagation(); handleRemoveFile(); }}>
                      <FontAwesomeIcon icon={faTimes} />
                    </button>
                  </div>
                )}
                {isLoading && !fileContent && (
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

            {/* Email Address - shown after JSON upload or if needed */}
            {(fileContent || showEmailInput) && (
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@yourdomain.com or you@yourdomain.com"
                />
                <small>
                  Enter an email to check for Workspace domain access, or a specific user's email to connect.
                </small>
              </div>
            )}

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
                </div>
              </div>
            )}

            {/* Form Actions */}
            <div className="form-actions">
              <button className="cancel-btn" onClick={onBack}>
                Cancel
              </button>
              <button
                className="submit-btn"
                onClick={handleConnect}
                disabled={!fileContent || !email.trim() || isLoading}
              >
                {isLoading ? (
                  <><div className="spinner"></div>Connecting...</>
                ) : (
                  <><FontAwesomeIcon icon={faEnvelope} />Connect Gmail</>
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
