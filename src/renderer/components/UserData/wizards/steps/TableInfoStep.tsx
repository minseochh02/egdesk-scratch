import React from 'react';
import { BaseStepProps } from '../types';

/**
 * TableInfoStep - Table name, display name, description inputs with validation (import-only)
 */
export const TableInfoStep: React.FC<BaseStepProps> = ({
  wizardState,
  onStateChange,
  error,
}) => {
  const { selectedFile, tableName, displayName, description } = wizardState;

  const handleTableNameChange = (value: string) => {
    // Convert to lowercase and remove invalid characters
    let sanitized = value.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    // Ensure doesn't start with number
    if (/^\d/.test(sanitized)) {
      sanitized = 'table_' + sanitized;
    }
    onStateChange({ tableName: sanitized });
  };

  return (
    <div>
      <div style={{ background: '#e8f5e9', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
        <h4 style={{ margin: '0 0 4px 0' }}>📋 {selectedFile?.split(/[\\/]/).pop()}</h4>
        <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
          Name your new table
        </p>
      </div>

      <h3 style={{ marginTop: 0 }}>Table Information</h3>
      <p style={{ color: '#666', marginBottom: '24px' }}>
        Give your table a name and description. You can change these later.
      </p>

      <div className="form-group">
        <label>Table Name *</label>
        <input
          type="text"
          value={tableName}
          onChange={(e) => handleTableNameChange(e.target.value)}
          placeholder="e.g., sales_data"
        />
        <small style={{ color: '#999', fontSize: '12px' }}>
          Internal database table name (lowercase, alphanumeric and underscores only)
        </small>
      </div>

      <div className="form-group">
        <label>Display Name *</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => onStateChange({ displayName: e.target.value })}
          placeholder="e.g., Sales Data 2024"
        />
        <small style={{ color: '#999', fontSize: '12px' }}>
          Human-readable name shown in the UI
        </small>
      </div>

      <div className="form-group">
        <label>Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => onStateChange({ description: e.target.value })}
          placeholder="Add a description for this table..."
          rows={3}
        />
      </div>

      {error && <div className="error-message">{error}</div>}
    </div>
  );
};
