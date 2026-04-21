import React, { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';

interface NewKnowledgeDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (title: string, category: string) => Promise<void>;
  defaultCategory?: string;
}

const CATEGORIES = [
  { value: 'hierarchy', label: 'Hierarchy / Org Chart' },
  { value: 'process', label: 'Process / SOP' },
  { value: 'policy', label: 'Policy / Rule' },
  { value: 'note', label: 'Note / Memo' },
];

const NewKnowledgeDocumentModal: React.FC<NewKnowledgeDocumentModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  defaultCategory = 'note',
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(defaultCategory);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setCategory(defaultCategory);
      setError(null);
      setIsCreating(false);
    }
  }, [isOpen, defaultCategory]);

  const handleCreate = useCallback(async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      await onCreate(title.trim(), category);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create document');
    } finally {
      setIsCreating(false);
    }
  }, [title, category, onCreate, onClose]);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleCreate();
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [handleCreate, onClose]
  );

  if (!isOpen) return null;

  return (
    <div className="knowledge-modal-overlay" onClick={onClose}>
      <div
        className="knowledge-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="knowledge-modal-header">
          <h2>Create New Knowledge Document</h2>
          <button
            type="button"
            className="knowledge-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="knowledge-modal-body">
          {error && <div className="knowledge-modal-error">{error}</div>}

          <div className="knowledge-modal-field">
            <label htmlFor="document-title">Title</label>
            <input
              id="document-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter document title..."
              autoFocus
              disabled={isCreating}
            />
          </div>

          <div className="knowledge-modal-field">
            <label htmlFor="document-category">Category</label>
            <select
              id="document-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={isCreating}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="knowledge-modal-footer">
          <button
            type="button"
            className="knowledge-modal-btn knowledge-modal-btn-secondary"
            onClick={onClose}
            disabled={isCreating}
          >
            Cancel
          </button>
          <button
            type="button"
            className="knowledge-modal-btn knowledge-modal-btn-primary"
            onClick={handleCreate}
            disabled={isCreating || !title.trim()}
          >
            {isCreating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewKnowledgeDocumentModal;
