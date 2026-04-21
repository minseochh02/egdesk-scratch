import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSave, faTrash, faCheckCircle } from '@fortawesome/free-solid-svg-icons';
import KnowledgeDocumentList, { InternalKnowledgeDocument } from './KnowledgeDocumentList';
import MarkdownEditor from './MarkdownEditor';
import NewKnowledgeDocumentModal from './NewKnowledgeDocumentModal';
import './InternalKnowledgeTab.css';

interface InternalKnowledgeTabProps {
  snapshotId?: string;
}

const InternalKnowledgeTab: React.FC<InternalKnowledgeTabProps> = ({ snapshotId }) => {
  const [documents, setDocuments] = useState<InternalKnowledgeDocument[]>([]);
  const [activeDocument, setActiveDocument] = useState<InternalKnowledgeDocument | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [defaultCategory, setDefaultCategory] = useState<string>('note');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isDirty, setIsDirty] = useState(false);

  // Load documents when component mounts or snapshotId changes
  useEffect(() => {
    if (!snapshotId) {
      setIsLoading(false);
      return;
    }

    const loadDocuments = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await window.electron.internalKnowledge.list(snapshotId);

        if (result.success && result.data) {
          // Convert date strings to Date objects
          const docs = result.data.map((doc: any) => ({
            ...doc,
            createdAt: new Date(doc.createdAt),
            updatedAt: new Date(doc.updatedAt),
          }));
          setDocuments(docs);
        } else {
          setError(result.error || 'Failed to load documents');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    loadDocuments();
  }, [snapshotId]);

  // Auto-save functionality with debouncing
  const saveDocument = useCallback(async (docId: string, content: string) => {
    if (!snapshotId) return;

    setSaveStatus('saving');

    try {
      const result = await window.electron.internalKnowledge.update(docId, { content });

      if (result.success && result.data) {
        // Update the document in the list
        setDocuments(prev => prev.map(doc =>
          doc.id === docId
            ? { ...doc, content, updatedAt: new Date(result.data.updatedAt) }
            : doc
        ));

        // Update active document
        if (activeDocument && activeDocument.id === docId) {
          setActiveDocument(prev => prev ? { ...prev, content, updatedAt: new Date(result.data.updatedAt) } : null);
        }

        setSaveStatus('saved');
        setIsDirty(false);

        // Clear saved status after 2 seconds
        setTimeout(() => {
          setSaveStatus('idle');
        }, 2000);
      } else {
        setError(result.error || 'Failed to save document');
        setSaveStatus('idle');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      setSaveStatus('idle');
    }
  }, [snapshotId, activeDocument]);

  // Debounced save
  const debouncedSave = useMemo(() => {
    let timeoutId: NodeJS.Timeout;
    return (docId: string, content: string) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        saveDocument(docId, content);
      }, 2000);
    };
  }, [saveDocument]);

  // Handle content changes
  const handleContentChange = useCallback((content: string) => {
    if (!activeDocument) return;

    setActiveDocument(prev => prev ? { ...prev, content } : null);
    setIsDirty(true);
    debouncedSave(activeDocument.id, content);
  }, [activeDocument, debouncedSave]);

  // Handle manual save (Cmd/Ctrl+S)
  const handleManualSave = useCallback(() => {
    if (!activeDocument || !isDirty) return;
    saveDocument(activeDocument.id, activeDocument.content);
  }, [activeDocument, isDirty, saveDocument]);

  // Handle document selection
  const handleSelectDocument = useCallback((doc: InternalKnowledgeDocument) => {
    setActiveDocument(doc);
    setIsDirty(false);
    setSaveStatus('idle');
    setError(null);
  }, []);

  // Handle create new document
  const handleCreateNew = useCallback((category: string) => {
    setDefaultCategory(category);
    setIsModalOpen(true);
  }, []);

  // Handle document creation
  const handleCreate = useCallback(async (title: string, category: string) => {
    if (!snapshotId) return;

    try {
      const result = await window.electron.internalKnowledge.create(snapshotId, {
        title,
        category,
        content: '',
      });

      if (result.success && result.data) {
        const newDoc: InternalKnowledgeDocument = {
          ...result.data,
          createdAt: new Date(result.data.createdAt),
          updatedAt: new Date(result.data.updatedAt),
        };

        setDocuments(prev => [...prev, newDoc]);
        setActiveDocument(newDoc);
        setIsModalOpen(false);
      } else {
        throw new Error(result.error || 'Failed to create document');
      }
    } catch (err) {
      throw err; // Let modal handle the error
    }
  }, [snapshotId]);

  // Handle document deletion
  const handleDelete = useCallback(async () => {
    if (!activeDocument || !snapshotId) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${activeDocument.title}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      const result = await window.electron.internalKnowledge.delete(activeDocument.id);

      if (result.success) {
        setDocuments(prev => prev.filter(doc => doc.id !== activeDocument.id));
        setActiveDocument(null);
        setIsDirty(false);
        setSaveStatus('idle');
      } else {
        setError(result.error || 'Failed to delete document');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  }, [activeDocument, snapshotId]);

  // No snapshot ID - show message
  if (!snapshotId) {
    return (
      <div className="internal-knowledge-tab">
        <div className="internal-knowledge-empty-state">
          <h3>No Business Identity Selected</h3>
          <p>Please save a business identity first to use the knowledge base.</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="internal-knowledge-tab">
        <div className="internal-knowledge-loading">Loading knowledge base...</div>
      </div>
    );
  }

  return (
    <div className="internal-knowledge-tab">
      <div className="internal-knowledge-header">
        <h2>Internal Knowledge Base</h2>
        <button
          type="button"
          className="internal-knowledge-new-btn"
          onClick={() => handleCreateNew('note')}
        >
          <FontAwesomeIcon icon={faPlus} />
          <span>New Document</span>
        </button>
      </div>

      {error && (
        <div className="internal-knowledge-error">
          {error}
          <button type="button" onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="internal-knowledge-content">
        <div className="internal-knowledge-sidebar">
          <KnowledgeDocumentList
            documents={documents}
            activeDocId={activeDocument?.id || null}
            onSelectDocument={handleSelectDocument}
            onCreateNew={handleCreateNew}
          />
        </div>

        <div className="internal-knowledge-editor-panel">
          {activeDocument ? (
            <>
              <div className="internal-knowledge-editor-header">
                <div className="internal-knowledge-editor-title">
                  <h3>{activeDocument.title}</h3>
                  <span className="internal-knowledge-category-badge">
                    {activeDocument.category}
                  </span>
                </div>
                <div className="internal-knowledge-editor-actions">
                  {saveStatus === 'saving' && (
                    <span className="internal-knowledge-save-status saving">
                      Saving...
                    </span>
                  )}
                  {saveStatus === 'saved' && (
                    <span className="internal-knowledge-save-status saved">
                      <FontAwesomeIcon icon={faCheckCircle} /> Saved
                    </span>
                  )}
                  <button
                    type="button"
                    className="internal-knowledge-action-btn"
                    onClick={handleManualSave}
                    disabled={!isDirty}
                    title="Save (Cmd/Ctrl+S)"
                  >
                    <FontAwesomeIcon icon={faSave} />
                  </button>
                  <button
                    type="button"
                    className="internal-knowledge-action-btn delete"
                    onClick={handleDelete}
                    title="Delete document"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </div>

              <div className="internal-knowledge-editor-body">
                <MarkdownEditor
                  value={activeDocument.content}
                  onChange={handleContentChange}
                  onSave={handleManualSave}
                />
              </div>
            </>
          ) : (
            <div className="internal-knowledge-editor-empty">
              {documents.length === 0 ? (
                <>
                  <h3>Welcome to Internal Knowledge Base</h3>
                  <p>Create your first document to get started.</p>
                  <ul>
                    <li><strong>Hierarchy:</strong> Org charts and team structures</li>
                    <li><strong>Processes:</strong> SOPs and workflows</li>
                    <li><strong>Policies:</strong> Company rules and compliance</li>
                    <li><strong>Notes:</strong> Free-form documentation</li>
                  </ul>
                  <button
                    type="button"
                    className="internal-knowledge-new-btn-large"
                    onClick={() => handleCreateNew('note')}
                  >
                    <FontAwesomeIcon icon={faPlus} />
                    <span>Create Your First Document</span>
                  </button>
                </>
              ) : (
                <>
                  <h3>No Document Selected</h3>
                  <p>Select a document from the sidebar or create a new one.</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <NewKnowledgeDocumentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreate}
        defaultCategory={defaultCategory}
      />
    </div>
  );
};

export default InternalKnowledgeTab;
