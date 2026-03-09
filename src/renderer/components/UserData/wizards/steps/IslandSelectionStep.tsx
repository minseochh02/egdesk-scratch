import React from 'react';
import { BaseStepProps } from '../types';

/**
 * IslandSelectionStep - Multi-table detection and import mode selection (import-only)
 * Features: Separate/merged mode selection, island selection
 */
export const IslandSelectionStep: React.FC<BaseStepProps> = ({
  mode,
  wizardState,
  onStateChange,
  error,
}) => {
  const {
    parsedData,
    selectedSheet,
    selectedIslands,
    islandImportMode,
    mergedTableName,
    mergedDisplayName,
    addMetadataColumns,
  } = wizardState;

  if (!parsedData) return null;

  const currentSheet = parsedData.sheets[selectedSheet];
  const islands = currentSheet.detectedIslands || [];

  if (islands.length === 0) {
    return null;
  }

  // For upload mode (browser sync), force merged mode since we sync to ONE existing table
  React.useEffect(() => {
    if (mode === 'upload' && islandImportMode !== 'merged') {
      const allIslands = new Set(islands.map((_, idx) => idx));
      const suggestedName = parsedData.suggestedTableName;
      onStateChange({
        islandImportMode: 'merged',
        selectedIslands: allIslands,
        mergedTableName: mergedTableName || suggestedName,
        mergedDisplayName: mergedDisplayName || suggestedName.replace(/_/g, ' '),
        addMetadataColumns: true, // Always add metadata for merged islands
      });
    }
  }, [mode, islandImportMode]);

  const toggleIsland = (idx: number) => {
    const newSelected = new Set(selectedIslands);
    if (newSelected.has(idx)) {
      newSelected.delete(idx);
    } else {
      newSelected.add(idx);
    }
    onStateChange({ selectedIslands: newSelected });
  };

  const setImportMode = (mode: 'separate' | 'merged') => {
    if (mode === 'merged') {
      // Auto-select all islands in merge mode
      const allIslands = new Set(islands.map((_, idx) => idx));
      const suggestedName = parsedData.suggestedTableName;
      onStateChange({
        islandImportMode: mode,
        selectedIslands: allIslands,
        mergedTableName: mergedTableName || suggestedName,
        mergedDisplayName: mergedDisplayName || suggestedName.replace(/_/g, ' '),
      });
    } else {
      onStateChange({
        islandImportMode: mode,
        selectedIslands: new Set(),
      });
    }
  };

  return (
    <div>
      <div style={{ background: '#e3f2fd', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
        <h4 style={{ margin: '0 0 4px 0' }}>🏝️ Multiple Data Tables Detected</h4>
        <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
          This spreadsheet contains {islands.length} separate data table{islands.length > 1 ? 's' : ''}.
          {mode === 'upload'
            ? ' They will be merged and synced to your target table.'
            : ' Choose how you\'d like to import them.'}
        </p>
      </div>

      {/* Import Mode Selection */}
      {mode === 'import' && (
        <div style={{ marginBottom: '24px', background: '#f5f5f5', padding: '16px', borderRadius: '8px' }}>
          <h4 style={{ marginTop: 0, marginBottom: '12px' }}>Import Mode</h4>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', marginBottom: '8px' }}>
              <input
                type="radio"
                value="separate"
                checked={islandImportMode === 'separate'}
                onChange={() => setImportMode('separate')}
                style={{ marginRight: '8px' }}
              />
              <span><strong>Create separate tables</strong> (one table per island)</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="radio"
                value="merged"
                checked={islandImportMode === 'merged'}
                onChange={() => setImportMode('merged')}
                style={{ marginRight: '8px' }}
              />
              <span><strong>Merge into one table</strong> (combine all islands)</span>
            </label>
          </div>

        {islandImportMode === 'merged' && mode === 'import' && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #ddd' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', marginBottom: '8px' }}>
              <input
                type="checkbox"
                checked={addMetadataColumns}
                onChange={(e) => onStateChange({ addMetadataColumns: e.target.checked })}
                style={{ marginRight: '8px' }}
              />
              <span>Include metadata columns</span>
            </label>
            <p style={{ marginLeft: '28px', fontSize: '12px', color: '#666', marginTop: '4px', marginBottom: '12px' }}>
              Adds columns: 회사명, 기간, 계정코드_메타, 계정명_메타 (extracted from island titles)
            </p>

            <div style={{ marginTop: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 'bold' }}>
                Merged Table Name:
              </label>
              <input
                type="text"
                value={mergedTableName}
                onChange={(e) => onStateChange({ mergedTableName: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
                placeholder="Enter table name"
              />
            </div>

            <div style={{ marginTop: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 'bold' }}>
                Display Name:
              </label>
              <input
                type="text"
                value={mergedDisplayName}
                onChange={(e) => onStateChange({ mergedDisplayName: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
                placeholder="Enter display name"
              />
            </div>
          </div>
        )}
      </div>
      )}

      {/* Upload mode info */}
      {mode === 'upload' && (
        <div style={{ marginBottom: '24px', background: '#f0f7ff', padding: '16px', borderRadius: '8px', border: '1px solid #2196F3' }}>
          <p style={{ margin: 0, fontSize: '14px' }}>
            <strong>✅ Auto-merge enabled:</strong> All {islands.length} island tables will be automatically merged with metadata columns (회사명, 기간, 계정코드_메타, 계정명_메타) and synced to your target table.
          </p>
        </div>
      )}

      <h3 style={{ marginTop: 0 }}>
        {islandImportMode === 'separate' ? 'Select Islands to Import' : 'Islands to Merge'}
      </h3>
      <p style={{ color: '#666', marginBottom: '24px' }}>
        {islandImportMode === 'separate'
          ? 'Each selected island will be imported as a separate table.'
          : 'All islands will be merged into a single table. Ensure they have identical column structure.'}
      </p>

      {islands.map((island, idx) => {
        const isSelected = selectedIslands.has(idx);

        return (
          <div
            key={idx}
            style={{
              border: `2px solid ${isSelected ? '#4caf50' : '#e0e0e0'}`,
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '16px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              backgroundColor: isSelected ? '#f1f8f4' : '#fff',
            }}
            onClick={() => toggleIsland(idx)}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => {}}
                style={{ marginRight: '8px', width: '20px', height: '20px' }}
              />
              <strong style={{ fontSize: '16px' }}>{island.title}</strong>
            </div>

            <div style={{ marginLeft: '28px', color: '#666', fontSize: '14px' }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>📊 {island.rowCount} rows</strong> × <strong>{island.headers.length} columns</strong>
              </div>

              <div style={{ fontSize: '13px', color: '#999' }}>
                <strong>Columns:</strong> {island.headers.slice(0, 5).join(', ')}
                {island.headers.length > 5 && ` +${island.headers.length - 5} more`}
              </div>

              {island.rows.length > 0 && (
                <div style={{ marginTop: '8px', fontSize: '12px' }}>
                  <strong>Sample data:</strong>
                  <div style={{
                    marginTop: '4px',
                    padding: '8px',
                    background: '#f5f5f5',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    maxHeight: '100px',
                    overflow: 'auto'
                  }}>
                    {island.rows.slice(0, 2).map((row, rowIdx) => (
                      <div key={rowIdx} style={{ marginBottom: '4px' }}>
                        {Object.values(row).slice(0, 3).map(String).join(' | ')}
                        {Object.values(row).length > 3 && ' ...'}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div style={{ background: '#fff3e0', padding: '12px', borderRadius: '6px', marginTop: '16px' }}>
        <strong>💡 Tip:</strong> Select multiple islands to import them all as separate tables.
        If you don't select any, the full spreadsheet will be imported as one table.
      </div>

      {error && <div className="error-message">{error}</div>}
    </div>
  );
};
