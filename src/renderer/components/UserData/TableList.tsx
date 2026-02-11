import React from 'react';
import { UserTable } from '../../hooks/useUserData';

interface TableListProps {
  tables: UserTable[];
  onSelectTable: (table: UserTable) => void;
  onDeleteTable: (tableId: string) => void;
  onImportClick: () => void;
}

export const TableList: React.FC<TableListProps> = ({
  tables,
  onSelectTable,
  onDeleteTable,
  onImportClick,
}) => {
  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleDeleteClick = (e: React.MouseEvent, tableId: string) => {
    e.stopPropagation();

    if (window.confirm('Are you sure you want to delete this table? This action cannot be undone.')) {
      onDeleteTable(tableId);
    }
  };

  if (tables.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📊</div>
        <h3 className="empty-state-title">No Tables Yet</h3>
        <p className="empty-state-message">
          Import your first Excel file to get started
        </p>
        <button className="btn btn-primary" onClick={onImportClick}>
          📥 Import Excel File
        </button>
      </div>
    );
  }

  return (
    <div className="table-list">
      <div className="table-list-header">
        <h2>Your Tables ({tables.length})</h2>
        <button className="btn btn-primary" onClick={onImportClick}>
          📥 Import Excel
        </button>
      </div>

      <div className="table-list-grid">
        {tables.map((table) => (
          <div
            key={table.id}
            className="table-card"
            onClick={() => onSelectTable(table)}
          >
            <div className="table-card-header">
              <div>
                <h3 className="table-card-title">{table.displayName}</h3>
                <div className="table-card-subtitle">{table.tableName}</div>
              </div>
              <div className="table-card-actions">
                <button
                  className="btn-icon btn-danger btn-sm"
                  onClick={(e) => handleDeleteClick(e, table.id)}
                  title="Delete table"
                >
                  🗑️
                </button>
              </div>
            </div>

            <div className="table-card-stats">
              <div className="table-card-stat">
                <div className="table-card-stat-label">Rows</div>
                <div className="table-card-stat-value">
                  {(table.rowCount ?? 0).toLocaleString()}
                </div>
              </div>
              <div className="table-card-stat">
                <div className="table-card-stat-label">Columns</div>
                <div className="table-card-stat-value">{table.columnCount ?? 0}</div>
              </div>
            </div>

            {table.description && (
              <div className="table-card-description">{table.description}</div>
            )}

            <div className="table-card-meta">
              {table.createdFromFile && (
                <div>📄 From: {table.createdFromFile}</div>
              )}
              <div>📅 Created: {formatDate(table.createdAt)}</div>
              <div>🔄 Updated: {formatDate(table.updatedAt)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
