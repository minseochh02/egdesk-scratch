import React, { useRef } from 'react';
import { faPaperclip } from '@fortawesome/free-solid-svg-icons';

interface FilePickerButtonProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  FontAwesomeIcon: any;
  maxFiles?: number;
  acceptedTypes?: string[];
  selectedFilesCount?: number;
}

export const FilePickerButton: React.FC<FilePickerButtonProps> = ({
  onFilesSelected,
  disabled = false,
  FontAwesomeIcon,
  maxFiles = 5,
  acceptedTypes = ['.txt', '.md', '.js', '.ts', '.tsx', '.jsx', '.css', '.html', '.json', '.py', '.php', '.java', '.cpp', '.c', '.h', '.xml', '.yaml', '.yml', '.sql', '.sh', '.bat', '.ps1', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.tif', '.ico', '.jfif', '.pjpeg', '.pjp', '.avif', '.heic', '.heif'],
  selectedFilesCount = 0
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    const remainingSlots = maxFiles - selectedFilesCount;
    const filesToAdd = validFiles.slice(0, remainingSlots);
    
    if (filesToAdd.length < validFiles.length) {
      alert(`Only ${filesToAdd.length} files can be added. Maximum ${maxFiles} files allowed.`);
    }

    onFilesSelected(filesToAdd);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
    // Reset the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleButtonClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptedTypes.join(',')}
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
        disabled={disabled}
      />
      
      <button
        className={`file-picker-btn ${disabled ? 'disabled' : ''}`}
        onClick={handleButtonClick}
        disabled={disabled}
        title={selectedFilesCount > 0 ? `${selectedFilesCount} files selected - Click to add more` : 'Attach files'}
      >
        <FontAwesomeIcon icon={faPaperclip} />
        {selectedFilesCount > 0 && (
          <span className="file-count-badge">{selectedFilesCount}</span>
        )}
      </button>
    </>
  );
};
