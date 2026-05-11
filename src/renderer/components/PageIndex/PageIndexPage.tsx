import React, { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBrain,
  faFileAlt,
  faPlus,
  faSpinner,
  faChevronRight,
  faChevronDown,
  faTrash,
  faSync,
  faSearch,
} from '@fortawesome/free-solid-svg-icons';
import './PageIndexPage.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PageIndexNode {
  title: string;
  node_id: string;
  start_index: number;
  end_index: number;
  summary?: string;
  nodes?: PageIndexNode[];
}

interface PageIndexDoc {
  id: string;
  doc_name: string;
  doc_description: string;
  path: string;
  page_count: number;
}

interface SelectedDoc extends PageIndexDoc {
  nodes: PageIndexNode[];
}

// ─── IPC helpers ─────────────────────────────────────────────────────────────

const ipc = (channel: string, ...args: any[]) =>
  window.electron.invoke(channel, ...args);

// ─── Tree Node Component ──────────────────────────────────────────────────────

function TreeNode({ node, depth = 0 }: { node: PageIndexNode; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.nodes && node.nodes.length > 0;

  return (
    <div className="pi-tree-node" style={{ paddingLeft: depth > 0 ? '1.25rem' : 0 }}>
      <div
        className={`pi-tree-node-header ${hasChildren ? 'pi-tree-node-clickable' : ''}`}
        onClick={() => hasChildren && setExpanded(e => !e)}
      >
        <span className="pi-tree-node-toggle">
          {hasChildren ? (
            <FontAwesomeIcon icon={expanded ? faChevronDown : faChevronRight} />
          ) : (
            <span className="pi-tree-node-leaf">•</span>
          )}
        </span>
        <span className="pi-tree-node-title">{node.title}</span>
        <span className="pi-tree-node-pages">
          pp. {node.start_index + 1}–{node.end_index + 1}
        </span>
      </div>
      {node.summary && (
        <div className="pi-tree-node-summary">{node.summary}</div>
      )}
      {hasChildren && expanded && (
        <div className="pi-tree-node-children">
          {node.nodes!.map(child => (
            <TreeNode key={child.node_id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Document Card ────────────────────────────────────────────────────────────

function DocumentCard({
  doc,
  onDelete,
  onViewStructure,
  isSelected,
}: {
  doc: PageIndexDoc;
  onDelete: (id: string) => void;
  onViewStructure: (id: string) => void;
  isSelected: boolean;
}) {
  return (
    <div className={`pi-doc-card ${isSelected ? 'pi-doc-card-selected' : ''}`}>
      <div className="pi-doc-card-icon">
        <FontAwesomeIcon icon={faFileAlt} />
      </div>
      <div className="pi-doc-card-info">
        <div className="pi-doc-card-title">{doc.doc_name}</div>
        {doc.doc_description && (
          <div className="pi-doc-card-description">{doc.doc_description}</div>
        )}
        <div className="pi-doc-card-meta">
          <span>{doc.page_count} pages</span>
          <span className="pi-dot">·</span>
          <span className="pi-doc-path" title={doc.path}>
            {doc.path.split('/').pop()}
          </span>
        </div>
      </div>
      <div className="pi-doc-card-actions">
        <button
          className="pi-btn pi-btn-secondary"
          onClick={() => onViewStructure(doc.id)}
          title="View structure"
        >
          <FontAwesomeIcon icon={faSearch} />
          <span>Structure</span>
        </button>
        <button
          className="pi-btn pi-btn-danger"
          onClick={() => onDelete(doc.id)}
          title="Delete"
        >
          <FontAwesomeIcon icon={faTrash} />
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const PageIndexPage: React.FC = () => {
  const [documents, setDocuments] = useState<PageIndexDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [indexing, setIndexing] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<SelectedDoc | null>(null);
  const [structureLoading, setStructureLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [indexTitle, setIndexTitle] = useState('');
  const [indexDesc, setIndexDesc] = useState('');
  const [showIndexForm, setShowIndexForm] = useState(false);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [indexProgress, setIndexProgress] = useState('');

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const docs: PageIndexDoc[] = await ipc('pageindex:list-documents');
      setDocuments(docs || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handlePickFile = async () => {
    const result = await ipc('pageindex:pick-file');
    if (!result?.canceled && result?.filePath) {
      setSelectedFilePath(result.filePath);
      if (!indexTitle) {
        const name = result.filePath.split('/').pop()?.replace(/\.pdf$/i, '') || '';
        setIndexTitle(name);
      }
    }
  };

  const handleIndexDocument = async () => {
    if (!selectedFilePath) return;
    setIndexing(true);
    setError(null);
    setIndexProgress('Extracting text from PDF…');
    try {
      setIndexProgress('Building document structure with AI…');
      await ipc('pageindex:index-document', {
        filePath: selectedFilePath,
        title: indexTitle || undefined,
        description: indexDesc || undefined,
      });
      setShowIndexForm(false);
      setSelectedFilePath(null);
      setIndexTitle('');
      setIndexDesc('');
      setIndexProgress('');
      await loadDocuments();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIndexing(false);
      setIndexProgress('');
    }
  };

  const handleViewStructure = useCallback(async (docId: string) => {
    setStructureLoading(true);
    setError(null);
    try {
      const result = await ipc('pageindex:get-structure', { docId });
      const doc = documents.find(d => d.id === docId);
      if (doc) {
        setSelectedDoc({ ...doc, nodes: result.nodes || [] });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setStructureLoading(false);
    }
  }, [documents]);

  const handleDelete = useCallback(async (docId: string) => {
    if (!window.confirm('Delete this indexed document?')) return;
    try {
      await ipc('pageindex:delete-document', { docId });
      if (selectedDoc?.id === docId) setSelectedDoc(null);
      await loadDocuments();
    } catch (err: any) {
      setError(err.message);
    }
  }, [loadDocuments, selectedDoc]);

  return (
    <div className="pi-page">
      {/* Header */}
      <div className="pi-header">
        <div className="pi-header-left">
          <FontAwesomeIcon icon={faBrain} className="pi-header-icon" />
          <div>
            <h1 className="pi-title">PageIndex</h1>
            <p className="pi-subtitle">Vectorless RAG — index PDFs into hierarchical trees</p>
          </div>
        </div>
        <div className="pi-header-actions">
          <button className="pi-btn pi-btn-secondary" onClick={loadDocuments} title="Refresh">
            <FontAwesomeIcon icon={faSync} />
            <span>Refresh</span>
          </button>
          <button
            className="pi-btn pi-btn-primary"
            onClick={() => setShowIndexForm(f => !f)}
          >
            <FontAwesomeIcon icon={faPlus} />
            <span>Index PDF</span>
          </button>
        </div>
      </div>

      {/* Index Form */}
      {showIndexForm && (
        <div className="pi-index-form">
          <h3 className="pi-form-title">Index a New PDF</h3>
          <div className="pi-form-row">
            <button className="pi-btn pi-btn-secondary pi-file-pick" onClick={handlePickFile}>
              <FontAwesomeIcon icon={faFileAlt} />
              <span>{selectedFilePath ? selectedFilePath.split('/').pop() : 'Choose PDF…'}</span>
            </button>
          </div>
          <div className="pi-form-row">
            <input
              className="pi-input"
              type="text"
              placeholder="Title (optional — AI will infer if blank)"
              value={indexTitle}
              onChange={e => setIndexTitle(e.target.value)}
            />
          </div>
          <div className="pi-form-row">
            <input
              className="pi-input"
              type="text"
              placeholder="Description (optional)"
              value={indexDesc}
              onChange={e => setIndexDesc(e.target.value)}
            />
          </div>
          <div className="pi-form-actions">
            <button
              className="pi-btn pi-btn-secondary"
              onClick={() => { setShowIndexForm(false); setSelectedFilePath(null); setIndexTitle(''); setIndexDesc(''); }}
            >
              Cancel
            </button>
            <button
              className="pi-btn pi-btn-primary"
              onClick={handleIndexDocument}
              disabled={!selectedFilePath || indexing}
            >
              {indexing ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin />
                  <span>Indexing…</span>
                </>
              ) : (
                <span>Start Indexing</span>
              )}
            </button>
          </div>
          {indexing && (
            <p className="pi-indexing-note">
              {indexProgress || 'Building hierarchical tree with AI…'} This may take a minute for large PDFs.
            </p>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="pi-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Main Content */}
      <div className="pi-content">
        {/* Document List */}
        <div className="pi-doc-list">
          <div className="pi-section-header">
            <h2 className="pi-section-title">
              Documents
              {!loading && <span className="pi-count">{documents.length}</span>}
            </h2>
          </div>
          {loading ? (
            <div className="pi-loading">
              <FontAwesomeIcon icon={faSpinner} spin />
              <span>Loading…</span>
            </div>
          ) : documents.length === 0 ? (
            <div className="pi-empty">
              <FontAwesomeIcon icon={faFileAlt} className="pi-empty-icon" />
              <p>No documents indexed yet.</p>
              <p className="pi-empty-hint">Click "Index PDF" to get started.</p>
            </div>
          ) : (
            documents.map(doc => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                onDelete={handleDelete}
                onViewStructure={handleViewStructure}
                isSelected={selectedDoc?.id === doc.id}
              />
            ))
          )}
        </div>

        {/* Structure Panel */}
        <div className="pi-structure-panel">
          <div className="pi-section-header">
            <h2 className="pi-section-title">Document Structure</h2>
          </div>
          {structureLoading ? (
            <div className="pi-loading">
              <FontAwesomeIcon icon={faSpinner} spin />
              <span>Loading structure…</span>
            </div>
          ) : !selectedDoc ? (
            <div className="pi-empty">
              <FontAwesomeIcon icon={faBrain} className="pi-empty-icon" />
              <p>Select a document to view its hierarchical tree.</p>
            </div>
          ) : (
            <div className="pi-structure-view">
              <div className="pi-structure-doc-info">
                <h3 className="pi-structure-doc-title">{selectedDoc.doc_name}</h3>
                {selectedDoc.doc_description && (
                  <p className="pi-structure-doc-desc">{selectedDoc.doc_description}</p>
                )}
                <p className="pi-structure-doc-meta">{selectedDoc.page_count} pages</p>
              </div>
              <div className="pi-tree">
                {selectedDoc.nodes.length > 0 ? (
                  selectedDoc.nodes.map(node => (
                    <TreeNode key={node.node_id} node={node} depth={0} />
                  ))
                ) : (
                  <p className="pi-empty-hint">No structure nodes found.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PageIndexPage;
