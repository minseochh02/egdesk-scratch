import React, { useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUsers,
  faCogs,
  faFileAlt,
  faStickyNote,
  faPlus,
} from '@fortawesome/free-solid-svg-icons';

export interface InternalKnowledgeDocument {
  id: string;
  snapshotId: string;
  title: string;
  category: 'hierarchy' | 'process' | 'policy' | 'note';
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

interface KnowledgeDocumentListProps {
  documents: InternalKnowledgeDocument[];
  activeDocId: string | null;
  onSelectDocument: (doc: InternalKnowledgeDocument) => void;
  onCreateNew: (category: string) => void;
}

const CATEGORY_ICONS = {
  hierarchy: faUsers,
  process: faCogs,
  policy: faFileAlt,
  note: faStickyNote,
};

const CATEGORY_LABELS = {
  hierarchy: 'Hierarchy',
  process: 'Processes',
  policy: 'Policies',
  note: 'Notes',
};

const CATEGORY_ORDER: Array<'hierarchy' | 'process' | 'policy' | 'note'> = [
  'hierarchy',
  'process',
  'policy',
  'note',
];

const KnowledgeDocumentList: React.FC<KnowledgeDocumentListProps> = ({
  documents,
  activeDocId,
  onSelectDocument,
  onCreateNew,
}) => {
  const groupedDocuments = useMemo(() => {
    const grouped: Record<string, InternalKnowledgeDocument[]> = {
      hierarchy: [],
      process: [],
      policy: [],
      note: [],
    };

    documents.forEach((doc) => {
      if (grouped[doc.category]) {
        grouped[doc.category].push(doc);
      }
    });

    return grouped;
  }, [documents]);

  return (
    <div className="knowledge-document-list">
      {CATEGORY_ORDER.map((category) => (
        <div key={category} className="knowledge-category-section">
          <div className="knowledge-category-header">
            <FontAwesomeIcon
              icon={CATEGORY_ICONS[category]}
              className="knowledge-category-icon"
            />
            <span className="knowledge-category-title">
              {CATEGORY_LABELS[category]}
            </span>
            <span className="knowledge-category-count">
              ({groupedDocuments[category].length})
            </span>
            <button
              type="button"
              className="knowledge-category-add-btn"
              onClick={() => onCreateNew(category)}
              title={`Add new ${category}`}
            >
              <FontAwesomeIcon icon={faPlus} />
            </button>
          </div>
          <div className="knowledge-category-documents">
            {groupedDocuments[category].length === 0 ? (
              <div className="knowledge-empty-state">
                No {category} documents
              </div>
            ) : (
              groupedDocuments[category].map((doc) => (
                <div
                  key={doc.id}
                  className={`knowledge-document-item${
                    doc.id === activeDocId ? ' is-active' : ''
                  }`}
                  onClick={() => onSelectDocument(doc)}
                  role="button"
                  tabIndex={0}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      onSelectDocument(doc);
                    }
                  }}
                >
                  <div className="knowledge-document-title">{doc.title}</div>
                  <div className="knowledge-document-date">
                    {new Date(doc.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default KnowledgeDocumentList;
