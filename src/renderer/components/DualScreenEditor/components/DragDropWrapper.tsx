import React, { useState, useRef } from 'react';
import { faPaperclip, faTimes, faFile, faFileText, faFileCode, faFileImage, faFilePdf } from '@fortawesome/free-solid-svg-icons';

interface DragDropWrapperProps {
  children: React.ReactNode;
  onFilesSelected: (files: File[]) => void;
  onFileRemove: (index: number) => void;
  selectedFiles: File[];
  disabled?: boolean;
  FontAwesomeIcon: any;
  maxFiles?: number;
  acceptedTypes?: string[];
  showFileList?: boolean;
}

export const DragDropWrapper: React.FC<DragDropWrapperProps> = ({
  children,
  onFilesSelected,
  onFileRemove,
  selectedFiles,
  disabled = false,
  FontAwesomeIcon,
  maxFiles = 5,
  acceptedTypes = ['.txt', '.md', '.js', '.ts', '.tsx', '.jsx', '.css', '.html', '.json', '.py', '.php', '.java', '.cpp', '.c', '.h', '.xml', '.yaml', '.yml', '.sql', '.sh', '.bat', '.ps1', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.tif', '.ico', '.jfif', '.pjpeg', '.pjp', '.avif', '.heic', '.heif'],
  showFileList = true
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(file => {
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      return acceptedTypes.includes(extension);
    });

    if (validFiles.length === 0) {
      alert('No valid files selected. Please select files with supported extensions.');
      return;
    }

    const remainingSlots = maxFiles - selectedFiles.length;
    const filesToAdd = validFiles.slice(0, remainingSlots);
    
    if (filesToAdd.length < validFiles.length) {
      alert(`Only ${filesToAdd.length} files can be added. Maximum ${maxFiles} files allowed.`);
    }

    onFilesSelected(filesToAdd);
  };


  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (disabled) return;
    
    handleFileSelect(e.dataTransfer.files);
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'txt':
      case 'md':
        return faFileText;
      case 'js':
      case 'ts':
      case 'tsx':
      case 'jsx':
      case 'py':
      case 'php':
      case 'java':
      case 'cpp':
      case 'c':
      case 'h':
      case 'css':
      case 'html':
      case 'json':
      case 'xml':
      case 'yaml':
      case 'yml':
      case 'sql':
      case 'sh':
      case 'bat':
      case 'ps1':
        return faFileCode;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp':
      case 'svg':
        return faFileImage;
      case 'pdf':
        return faFilePdf;
      default:
        return faFile;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="drag-drop-wrapper">
      <div
        className={`drag-drop-zone ${isDragOver ? 'drag-over' : ''} ${disabled ? 'disabled' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {children}
        
        {/* Drag overlay - only visible when dragging */}
        {isDragOver && (
          <div className="drag-overlay">
            <div className="drag-overlay-content">
              <FontAwesomeIcon icon={faPaperclip} className="drag-icon" />
              <span className="drag-text">Drop files here</span>
            </div>
          </div>
        )}
      </div>

      {/* Selected files display */}
      {showFileList && selectedFiles.length > 0 && (
        <div className="file-picker-selected-files">
          <div className="file-picker-selected-files-header">
            <span className="file-picker-files-count">
              {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
            </span>
            {selectedFiles.length >= maxFiles && (
              <span className="file-picker-max-files-warning">
                Maximum {maxFiles} files reached
              </span>
            )}
          </div>
          
          <div className="file-picker-files-list">
            {selectedFiles.map((file, index) => (
              <div key={`${file.name}-${index}`} className="file-picker-item">
                <div className="file-picker-info">
                  <FontAwesomeIcon 
                    icon={getFileIcon(file.name)} 
                    className="file-picker-icon" 
                  />
                  <div className="file-picker-details">
                    <span className="file-picker-name" title={file.name}>
                      {file.name}
                    </span>
                    <span className="file-picker-size">
                      {formatFileSize(file.size)}
                    </span>
                  </div>
                </div>
                
                <button
                  className="file-picker-remove-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFileRemove(index);
                  }}
                  disabled={disabled}
                  title="Remove file"
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
