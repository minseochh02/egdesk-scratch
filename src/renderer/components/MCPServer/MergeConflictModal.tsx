import React, { useState, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faTimes, 
  faSpinner, 
  faCheck,
  faArrowRight,
  faExclamationTriangle,
  faDatabase,
  faCloud
} from '@fortawesome/free-solid-svg-icons';
import './DevSpreadsheet.css';

// Types
interface SpreadsheetRow {
  name: string;
  description: string;
  url: string;
  scriptID: string;
  rowIndex: number;
}

interface MergeConflict {
  name: string;
  scriptID: string;
  field: string;
  publicValue: string;
  devValue: string;
  publicRow: SpreadsheetRow;
  devRow: SpreadsheetRow;
}

interface SchemaDiff {
  added: SpreadsheetRow[];
  removed: SpreadsheetRow[];
  modified: MergeConflict[];
  unchanged: SpreadsheetRow[];
}

type Resolution = 'public' | 'dev' | 'custom';

interface ConflictResolution {
  conflict: MergeConflict;
  resolution: Resolution;
  customValue?: string;
}

interface MergeConflictModalProps {
  diff: SchemaDiff;
  onResolve: (resolvedRows: SpreadsheetRow[], target: 'public' | 'dev') => void;
  onCancel: () => void;
  syncing: boolean;
}

const MergeConflictModal: React.FC<MergeConflictModalProps> = ({
  diff,
  onResolve,
  onCancel,
  syncing
}) => {
  // Group conflicts by row (using name + scriptID as key)
  const conflictsByRow = useMemo(() => {
    const grouped = new Map<string, MergeConflict[]>();
    
    for (const conflict of diff.modified) {
      const key = conflict.scriptID || conflict.name;
      const existing = grouped.get(key) || [];
      existing.push(conflict);
      grouped.set(key, existing);
    }
    
    return grouped;
  }, [diff.modified]);

  // State for resolutions
  const [resolutions, setResolutions] = useState<Map<string, Map<string, Resolution>>>(() => {
    const initial = new Map<string, Map<string, Resolution>>();
    
    for (const [rowKey, conflicts] of conflictsByRow) {
      const fieldResolutions = new Map<string, Resolution>();
      for (const conflict of conflicts) {
        fieldResolutions.set(conflict.field, 'public'); // Default to public
      }
      initial.set(rowKey, fieldResolutions);
    }
    
    return initial;
  });

  // State for target spreadsheet
  const [targetSpreadsheet, setTargetSpreadsheet] = useState<'public' | 'dev'>('dev');

  // Handle resolution change
  const handleResolutionChange = (rowKey: string, field: string, resolution: Resolution) => {
    setResolutions(prev => {
      const newResolutions = new Map(prev);
      const fieldResolutions = new Map(newResolutions.get(rowKey) || new Map());
      fieldResolutions.set(field, resolution);
      newResolutions.set(rowKey, fieldResolutions);
      return newResolutions;
    });
  };

  // Handle "Keep All Public" or "Keep All Dev"
  const handleKeepAll = (resolution: 'public' | 'dev') => {
    setResolutions(prev => {
      const newResolutions = new Map<string, Map<string, Resolution>>();
      
      for (const [rowKey, conflicts] of conflictsByRow) {
        const fieldResolutions = new Map<string, Resolution>();
        for (const conflict of conflicts) {
          fieldResolutions.set(conflict.field, resolution);
        }
        newResolutions.set(rowKey, fieldResolutions);
      }
      
      return newResolutions;
    });
  };

  // Build resolved rows
  const buildResolvedRows = (): SpreadsheetRow[] => {
    const resolvedRows: SpreadsheetRow[] = [];
    
    // Start with unchanged rows
    resolvedRows.push(...diff.unchanged);
    
    // Add rows that are only in target (added if target=dev, removed if target=public)
    if (targetSpreadsheet === 'dev') {
      // For dev target: add public-only rows (they're new)
      resolvedRows.push(...diff.added);
    } else {
      // For public target: add dev-only rows (they're new from dev)
      resolvedRows.push(...diff.removed);
    }
    
    // Resolve conflicts
    for (const [rowKey, conflicts] of conflictsByRow) {
      const firstConflict = conflicts[0];
      const fieldResolutions = resolutions.get(rowKey) || new Map();
      
      // Start with public row as base
      const resolvedRow: SpreadsheetRow = { ...firstConflict.publicRow };
      
      // Apply resolutions
      for (const conflict of conflicts) {
        const resolution = fieldResolutions.get(conflict.field) || 'public';
        
        if (resolution === 'dev') {
          (resolvedRow as any)[conflict.field] = conflict.devValue;
        }
        // If 'public', keep the public value (already in resolvedRow)
      }
      
      resolvedRows.push(resolvedRow);
    }
    
    return resolvedRows;
  };

  // Handle apply
  const handleApply = () => {
    const resolvedRows = buildResolvedRows();
    onResolve(resolvedRows, targetSpreadsheet);
  };

  return (
    <div className="merge-conflict-modal-overlay">
      <div className="merge-conflict-modal">
        <div className="merge-conflict-modal-header">
          <div className="merge-conflict-title">
            <FontAwesomeIcon icon={faExclamationTriangle} />
            <h3>Merge Conflicts Detected</h3>
            <span className="conflict-count">{diff.modified.length} conflicts</span>
          </div>
          <button 
            className="merge-conflict-close"
            onClick={onCancel}
            disabled={syncing}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="merge-conflict-modal-content">
          {/* Summary */}
          <div className="merge-conflict-summary">
            <div className="summary-item">
              <span className="summary-label">Added (public only):</span>
              <span className="summary-value">{diff.added.length}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Removed (dev only):</span>
              <span className="summary-value">{diff.removed.length}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Conflicts:</span>
              <span className="summary-value">{diff.modified.length}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Unchanged:</span>
              <span className="summary-value">{diff.unchanged.length}</span>
            </div>
          </div>

          {/* Bulk Actions */}
          <div className="merge-conflict-bulk-actions">
            <button 
              className="bulk-action-button keep-public"
              onClick={() => handleKeepAll('public')}
            >
              <FontAwesomeIcon icon={faCloud} />
              Keep All Public
            </button>
            <button 
              className="bulk-action-button keep-dev"
              onClick={() => handleKeepAll('dev')}
            >
              <FontAwesomeIcon icon={faDatabase} />
              Keep All Dev
            </button>
          </div>

          {/* Conflicts List */}
          <div className="merge-conflict-list">
            {Array.from(conflictsByRow.entries()).map(([rowKey, conflicts]) => (
              <div key={rowKey} className="merge-conflict-row">
                <div className="merge-conflict-row-header">
                  <span className="row-name">{conflicts[0].name || rowKey}</span>
                  <span className="row-id">{conflicts[0].scriptID}</span>
                </div>
                
                <div className="merge-conflict-fields">
                  {conflicts.map((conflict, idx) => {
                    const fieldResolution = resolutions.get(rowKey)?.get(conflict.field) || 'public';
                    
                    return (
                      <div key={idx} className="merge-conflict-field">
                        <div className="field-name">{conflict.field}</div>
                        
                        <div className="field-values">
                          <div 
                            className={`field-value public-value ${fieldResolution === 'public' ? 'selected' : ''}`}
                            onClick={() => handleResolutionChange(rowKey, conflict.field, 'public')}
                          >
                            <div className="field-value-header">
                              <FontAwesomeIcon icon={faCloud} />
                              <span>Public</span>
                              {fieldResolution === 'public' && <FontAwesomeIcon icon={faCheck} className="selected-icon" />}
                            </div>
                            <div className="field-value-content">
                              {conflict.publicValue || <em>(empty)</em>}
                            </div>
                          </div>
                          
                          <div className="field-value-arrow">
                            <FontAwesomeIcon icon={faArrowRight} />
                          </div>
                          
                          <div 
                            className={`field-value dev-value ${fieldResolution === 'dev' ? 'selected' : ''}`}
                            onClick={() => handleResolutionChange(rowKey, conflict.field, 'dev')}
                          >
                            <div className="field-value-header">
                              <FontAwesomeIcon icon={faDatabase} />
                              <span>Dev</span>
                              {fieldResolution === 'dev' && <FontAwesomeIcon icon={faCheck} className="selected-icon" />}
                            </div>
                            <div className="field-value-content">
                              {conflict.devValue || <em>(empty)</em>}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="merge-conflict-modal-footer">
          <div className="target-selector">
            <span>Apply to:</span>
            <select 
              value={targetSpreadsheet}
              onChange={(e) => setTargetSpreadsheet(e.target.value as 'public' | 'dev')}
              disabled={syncing}
            >
              <option value="dev">Dev Spreadsheet</option>
              <option value="public">Public Spreadsheet ⚠️</option>
            </select>
          </div>
          
          <div className="footer-actions">
            <button 
              className="cancel-button"
              onClick={onCancel}
              disabled={syncing}
            >
              Cancel
            </button>
            <button 
              className="apply-button"
              onClick={handleApply}
              disabled={syncing}
            >
              {syncing ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin />
                  <span>Applying...</span>
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faCheck} />
                  <span>Apply Resolutions</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MergeConflictModal;

