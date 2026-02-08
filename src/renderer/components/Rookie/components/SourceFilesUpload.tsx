/**
 * SourceFilesUpload Component
 * Handles multiple source file uploads
 */

import React, { useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUpload, faTrash, faFileExcel } from '../../../utils/fontAwesomeIcons';

interface SourceFilesUploadProps {
  files: File[];
  onFilesAdd: (files: File[]) => void;
  onFileRemove: (index: number) => void;
}

export const SourceFilesUpload: React.FC<SourceFilesUploadProps> = ({
  files,
  onFilesAdd,
  onFileRemove,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { files: selectedFiles } = e.target;
    if (selectedFiles && selectedFiles.length > 0) {
      const fileArray = Array.from(selectedFiles);
      onFilesAdd(fileArray);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="rookie-upload-subsection">
      <h4 className="rookie-subsection-title">Source Files (Raw Data)</h4>
      <p className="rookie-subsection-description">
        Upload Excel files containing the raw data needed to build the target report.
      </p>

      <div className="rookie-resource-file-upload">
        <button
          type="button"
          className="rookie-upload-resource-button"
          onClick={handleBrowseClick}
        >
          <FontAwesomeIcon icon={faUpload} style={{ marginRight: '8px' }} />
          Upload Source Excel Files
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          multiple
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>

      {files.length > 0 && (
        <div className="rookie-resource-files-list">
          <h4 className="rookie-resource-files-title">Uploaded Files ({files.length})</h4>
          {files.map((file, idx) => (
            <div key={idx} className="rookie-resource-file-item">
              <div className="rookie-resource-file-info">
                <FontAwesomeIcon icon={faFileExcel} className="rookie-resource-file-icon" />
                <div className="rookie-resource-file-details">
                  <div className="rookie-resource-file-name">{file.name}</div>
                  <div className="rookie-resource-file-size">{formatFileSize(file.size)}</div>
                </div>
              </div>
              <button
                type="button"
                className="rookie-resource-file-remove"
                onClick={() => onFileRemove(idx)}
                title="Remove file"
              >
                <FontAwesomeIcon icon={faTrash} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
