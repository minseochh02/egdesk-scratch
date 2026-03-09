import React, { useState, useEffect } from 'react';

interface VectorStatsPanelProps {
  tableId: string;
  getEmbeddingStats: (tableId: string) => Promise<{
    columnStats: Array<{
      columnName: string;
      totalEmbeddings: number;
      model: string;
      dimensions: number;
      lastUpdated: string;
    }>;
    totalEmbeddings: number;
    totalEstimatedCost: number;
  }>;
  deleteEmbeddings: (tableId: string, columnNames?: string[]) => Promise<number>;
  onEmbeddingsDeleted?: () => void;
}

/**
 * VectorStatsPanel - Display embedding statistics for a table
 *
 * Shows:
 * - Summary: X embeddings across Y columns
 * - Details (expandable): Per-column stats
 * - Delete button with confirmation
 */
export const VectorStatsPanel: React.FC<VectorStatsPanelProps> = ({
  tableId,
  getEmbeddingStats,
  deleteEmbeddings,
  onEmbeddingsDeleted,
}) => {
  const [stats, setStats] = useState<{
    columnStats: Array<{
      columnName: string;
      totalEmbeddings: number;
      model: string;
      dimensions: number;
      lastUpdated: string;
    }>;
    totalEmbeddings: number;
    totalEstimatedCost: number;
  } | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load stats
  useEffect(() => {
    const loadStats = async () => {
      try {
        const statsData = await getEmbeddingStats(tableId);
        if (statsData.totalEmbeddings > 0) {
          setStats(statsData);
        } else {
          setStats(null);
        }
      } catch (err) {
        console.error('Failed to load embedding stats:', err);
        setStats(null);
      }
    };

    loadStats();
  }, [tableId, getEmbeddingStats]);

  // Handle delete embeddings
  const handleDeleteEmbeddings = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      await deleteEmbeddings(tableId);
      setStats(null);
      setShowDeleteConfirm(false);
      if (onEmbeddingsDeleted) {
        onEmbeddingsDeleted();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete embeddings');
    } finally {
      setIsDeleting(false);
    }
  };

  // Don't render if no embeddings
  if (!stats || stats.totalEmbeddings === 0) {
    return null;
  }

  return (
    <div className="vector-stats-panel">
      {/* Header */}
      <div className="vector-stats-header">
        <div className="vector-stats-info">
          <h3 className="vector-stats-title">
            🔍 Semantic Search Enabled
          </h3>
          <p className="vector-stats-summary">
            {stats.totalEmbeddings.toLocaleString()} embeddings across{' '}
            {stats.columnStats.length} column{stats.columnStats.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="vector-stats-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? 'Hide Details' : 'View Details'}
          </button>

          {!showDeleteConfirm ? (
            <button
              className="btn btn-danger btn-sm"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete
            </button>
          ) : (
            <div className="delete-confirm-buttons">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={handleDeleteEmbeddings}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="vector-stats-details">
          <h4>Column Details</h4>

          <div className="vector-stats-table-wrapper">
            <table className="vector-stats-table">
              <thead>
                <tr>
                  <th>Column</th>
                  <th className="right-align">Embeddings</th>
                  <th>Model</th>
                  <th className="right-align">Dimensions</th>
                  <th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {stats.columnStats.map((col) => (
                  <tr key={col.columnName}>
                    <td className="bold">{col.columnName}</td>
                    <td className="right-align">
                      {col.totalEmbeddings.toLocaleString()}
                    </td>
                    <td>{col.model}</td>
                    <td className="right-align">{col.dimensions}</td>
                    <td>{new Date(col.lastUpdated).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="vector-stats-cost">
            <strong>Total Estimated Cost:</strong> $
            {stats.totalEstimatedCost.toFixed(4)} USD
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
    </div>
  );
};
