/**
 * TargetUpload Component
 * Handles target report upload with drag & drop
 */

import React, { useState, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUpload, faTrash, faFileExcel, faFilePdf } from '../../../utils/fontAwesomeIcons';

interface TargetUploadProps {
  uploadedFile: File | null;
  onFileSelect: (file: File) => void;
  onFileRemove: () => void;
}

export const TargetUpload: React.FC<TargetUploadProps> = ({
  uploadedFile,
  onFileSelect,
  onFileRemove,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const { files } = e.dataTransfer;
    if (files.length > 0) {
      const file = files[0];
      if (file.name.match(/\.(xlsx|xls|pdf)$/i)) {
        onFileSelect(file);
      } else {
        alert('Please upload an Excel (.xlsx, .xls) or PDF file');
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = e.target;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.match(/\.pdf$/i)) return faFilePdf;
    return faFileExcel;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="rookie-upload-subsection">
      <h4 className="rookie-subsection-title">Target Report</h4>
      {!uploadedFile ? (
        <div
          role="button"
          tabIndex={0}
          className={`rookie-file-upload-zone ${isDragging ? 'dragging' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={handleBrowseClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleBrowseClick();
            }
          }}
        >
          <FontAwesomeIcon icon={faUpload} className="rookie-upload-icon" />
          <p className="rookie-upload-text">Drag & Drop Target Excel file here</p>
          <p className="rookie-upload-subtext">or click to browse</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.pdf"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>
      ) : (
        <div className="rookie-file-preview">
          <div className="rookie-file-info">
            <FontAwesomeIcon icon={getFileIcon(uploadedFile.name)} className="rookie-file-icon" />
            <div className="rookie-file-details">
              <div className="rookie-file-name">{uploadedFile.name}</div>
              <div className="rookie-file-size">{formatFileSize(uploadedFile.size)}</div>
            </div>
          </div>
          <button type="button" className="rookie-file-remove" onClick={onFileRemove}>
            <FontAwesomeIcon icon={faTrash} />
          </button>
        </div>
      )}
    </div>
  );
};
