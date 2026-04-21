import React, { useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import './ImageViewerModal.css';

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  imageUrl: string;
}

const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  isOpen,
  onClose,
  productName,
  imageUrl,
}) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="image-viewer__overlay" onClick={onClose}>
      <div className="image-viewer__modal" onClick={(e) => e.stopPropagation()}>
        <div className="image-viewer__header">
          <h3 className="image-viewer__title">{productName}</h3>
          <button
            className="image-viewer__close"
            onClick={onClose}
            type="button"
            aria-label="Close image viewer"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="image-viewer__content">
          <img
            src={imageUrl}
            alt={productName}
            className="image-viewer__image"
          />
        </div>

        <div className="image-viewer__footer">
          <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="image-viewer__url-link"
            title={imageUrl}
          >
            {imageUrl}
          </a>
        </div>
      </div>
    </div>
  );
};

export default ImageViewerModal;
