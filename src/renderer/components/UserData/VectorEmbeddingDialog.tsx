import React, { useState, useEffect } from 'react';
import { UserTable } from '../../hooks/useUserData';

interface VectorEmbeddingDialogProps {
  table: UserTable;
  onClose: () => void;
  onComplete: () => void;
  embedTableColumns: (
    tableId: string,
    columnNames: string[],
    onProgress?: (progress: any) => void
  ) => Promise<any>;
  getEmbeddedColumns: (tableId: string) => Promise<string[]>;
}

/**
 * VectorEmbeddingDialog - Modal dialog for embedding table columns
 *
 * Two states:
 * 1. Column Selection - Choose which TEXT columns to embed
 * 2. Progress View - Watch embedding progress in real-time
 */
export const VectorEmbeddingDialog: React.FC<VectorEmbeddingDialogProps> = ({
  table,
  onClose,
  onComplete,
  embedTableColumns,
  getEmbeddedColumns,
}) => {
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [alreadyEmbeddedColumns, setAlreadyEmbeddedColumns] = useState<string[]>([]);
  const [isEmbedding, setIsEmbedding] = useState(false);
  const [progress, setProgress] = useState({
    progress: 0,
    total: 0,
    message: '',
    estimatedCost: 0,
  });
  const [error, setError] = useState<string | null>(null);

  // Get TEXT columns
  const textColumns = table.schema.filter((col) => col.type === 'TEXT');

  // Load already embedded columns
  useEffect(() => {
    const loadEmbeddedColumns = async () => {
      try {
        const embedded = await getEmbeddedColumns(table.id);
        setAlreadyEmbeddedColumns(embedded);
        // Pre-select already embedded columns
        setSelectedColumns(embedded);
      } catch (err) {
        console.error('Failed to load embedded columns:', err);
      }
    };

    loadEmbeddedColumns();
  }, [table.id, getEmbeddedColumns]);

  // Calculate estimates
  const estimateEmbedding = () => {
    const numColumns = selectedColumns.length;
    const numRows = table.rowCount;
    const totalOperations = numColumns * numRows;
    // Rough estimate: average 100 chars per cell
    const estimatedChars = totalOperations * 100;
    const estimatedCost = (estimatedChars / 1000) * 0.00001;

    return {
      totalOperations,
      estimatedChars,
      estimatedCost: estimatedCost.toFixed(4),
    };
  };

  const estimates = estimateEmbedding();

  // Handle column selection toggle
  const toggleColumn = (columnName: string) => {
    setSelectedColumns((prev) =>
      prev.includes(columnName)
        ? prev.filter((c) => c !== columnName)
        : [...prev, columnName]
    );
  };

  // Start embedding process
  const handleStartEmbedding = async () => {
    if (selectedColumns.length === 0) {
      return;
    }

    setIsEmbedding(true);
    setError(null);

    try {
      await embedTableColumns(table.id, selectedColumns, (progressUpdate) => {
        setProgress(progressUpdate);
      });

      // Success - close dialog
      onComplete();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to embed columns');
      setIsEmbedding(false);
    }
  };

  // Render column selection view
  if (!isEmbedding) {
    return (
      <div
        className="modal-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="modal-content" style={{ maxWidth: '600px', width: '90%' }}>
          <div className="modal-header">
            <h2>Embed Table: {table.displayName}</h2>
            <button className="close-button" onClick={onClose}>
              ×
            </button>
          </div>

          <div className="modal-body" style={{ maxHeight: '500px' }}>
            {textColumns.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📊</div>
                <p className="empty-state-title">No TEXT columns available</p>
                <p className="empty-state-message">
                  This table doesn't have any TEXT columns that can be embedded.
                </p>
              </div>
            ) : (
              <>
                <p className="embedding-description">
                  Select which TEXT columns to embed for semantic search:
                </p>

                <div className="column-selection-list">
                  {textColumns.map((col) => {
                    const isAlreadyEmbedded = alreadyEmbeddedColumns.includes(col.name);
                    const isSelected = selectedColumns.includes(col.name);

                    return (
                      <div
                        key={col.name}
                        className={`column-checkbox-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleColumn(col.name)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleColumn(col.name)}
                        />
                        <span className="column-checkbox-name">{col.name}</span>
                        {isAlreadyEmbedded && (
                          <span className="column-already-embedded-badge">
                            ✓ Already embedded
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {selectedColumns.length > 0 && (
                  <div className="embedding-estimates">
                    <h3>Estimate</h3>
                    <div className="estimate-row">
                      <span className="estimate-label">Rows:</span>
                      <span className="estimate-value">{(table.rowCount ?? 0).toLocaleString()}</span>
                    </div>
                    <div className="estimate-row">
                      <span className="estimate-label">Columns:</span>
                      <span className="estimate-value">{selectedColumns.length}</span>
                    </div>
                    <div className="estimate-row">
                      <span className="estimate-label">Total operations:</span>
                      <span className="estimate-value">
                        {estimates.totalOperations.toLocaleString()}
                      </span>
                    </div>
                    <div className="estimate-row">
                      <span className="estimate-label">Estimated cost:</span>
                      <span className="estimate-value">~${estimates.estimatedCost} USD</span>
                    </div>
                    <div className="estimate-row">
                      <span className="estimate-label">Model:</span>
                      <span className="estimate-value">text-embedding-004 (768 dimensions)</span>
                    </div>
                  </div>
                )}
              </>
            )}

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleStartEmbedding}
              disabled={selectedColumns.length === 0 || textColumns.length === 0}
            >
              Start Embedding
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render progress view
  const progressPercent =
    progress.total > 0 ? Math.round((progress.progress / progress.total) * 100) : 0;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '500px', width: '90%' }}>
        <div className="modal-header">
          <h2>Embedding in Progress</h2>
        </div>

        <div className="modal-body">
          <div className="embedding-progress-container">
            <div className="progress-bar-wrapper">
              <div
                className="progress-bar-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="progress-percentage">
              {progressPercent}%
            </div>

            <div className="progress-message">
              {progress.message}
            </div>

            <div className="progress-count">
              {progress.progress.toLocaleString()} / {progress.total.toLocaleString()}
            </div>

            {progress.estimatedCost > 0 && (
              <div className="progress-cost">
                Estimated cost: ${progress.estimatedCost.toFixed(4)} USD
              </div>
            )}
          </div>

          <div className="warning-box">
            ⚠️ Don't close this window until embedding is complete
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
