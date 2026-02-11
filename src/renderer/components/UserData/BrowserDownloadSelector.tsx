import React, { useState, useEffect } from 'react';

interface BrowserDownloadFile {
  name: string;
  path: string;
  scriptFolder: string;
  size: number;
  created: string;
  modified: string;
}

interface BrowserDownloadSelectorProps {
  onSelectFile: (filePath: string) => void;
  onClose: () => void;
}

export const BrowserDownloadSelector: React.FC<BrowserDownloadSelectorProps> = ({
  onSelectFile,
  onClose,
}) => {
  const [files, setFiles] = useState<BrowserDownloadFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  useEffect(() => {
    loadDownloads();
  }, []);

  const loadDownloads = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await (window as any).electron.debug.getPlaywrightDownloads();

      if (result.success) {
        // Filter for Excel files only
        const excelFiles = result.files.filter((file: BrowserDownloadFile) => {
          const ext = file.name.toLowerCase();
          return ext.endsWith('.xlsx') || ext.endsWith('.xls') || ext.endsWith('.xlsm');
        });
        setFiles(excelFiles);
      } else {
        setError(result.error || 'Failed to load downloads');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load downloads');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const handleSelectFile = () => {
    if (selectedFile) {
      onSelectFile(selectedFile);
    }
  };

  const handleOpenFolder = async () => {
    try {
      await (window as any).electron.debug.openPlaywrightDownloadsFolder();
    } catch (error) {
      console.error('Failed to open folder:', error);
    }
  };

  return (
    <div className="import-wizard">
      <div className="import-wizard-dialog" style={{ maxWidth: '700px' }}>
        <div className="import-wizard-header">
          <h2>📥 Select Browser Download</h2>
          <button className="btn-icon" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="import-wizard-body">
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>
              Select an Excel file downloaded by Browser Recorder
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleOpenFolder}
                className="btn btn-secondary"
                style={{ fontSize: '13px', padding: '6px 12px' }}
              >
                📁 Open Folder
              </button>
              <button
                onClick={loadDownloads}
                className="btn btn-primary"
                style={{ fontSize: '13px', padding: '6px 12px' }}
              >
                🔄 Refresh
              </button>
            </div>
          </div>

          {loading && (
            <div className="loading-spinner">
              <div className="spinner"></div>
              <p>Loading downloads...</p>
            </div>
          )}

          {error && (
            <div className="error-message" style={{ marginBottom: '16px' }}>
              {error}
            </div>
          )}

          {!loading && files.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
              <p>No Excel files found in Browser Recorder downloads</p>
              <p style={{ fontSize: '14px' }}>
                Use Browser Recorder to download Excel files, then they'll appear here
              </p>
            </div>
          )}

          {!loading && files.length > 0 && (
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {files.map((file) => (
                <div
                  key={file.path}
                  className={`browser-recorder-download-item ${
                    selectedFile === file.path ? 'selected' : ''
                  }`}
                  onClick={() => setSelectedFile(file.path)}
                  style={{
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    marginBottom: '8px',
                    cursor: 'pointer',
                    background: selectedFile === file.path ? '#e3f2fd' : '#fff',
                    borderColor: selectedFile === file.path ? '#2196f3' : '#ddd',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                        📄 {file.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        📁 {file.scriptFolder}
                      </div>
                      <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                        {formatFileSize(file.size)} • {new Date(file.modified).toLocaleString()}
                      </div>
                    </div>
                    {selectedFile === file.path && (
                      <div style={{ color: '#2196f3', fontSize: '20px' }}>✓</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="import-wizard-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSelectFile}
            disabled={!selectedFile}
          >
            Next ➡️
          </button>
        </div>
      </div>
    </div>
  );
};
