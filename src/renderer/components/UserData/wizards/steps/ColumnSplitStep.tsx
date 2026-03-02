import React from 'react';
import { BaseStepProps } from '../types';

/**
 * ColumnSplitStep - Shows date+number split suggestions with preview
 * 95% duplicate code elimination from ImportWizard and ExcelUploadDialog
 */
export const ColumnSplitStep: React.FC<BaseStepProps> = ({
  wizardState,
  onStateChange,
  error,
}) => {
  const { parsedData, selectedSheet, acceptedSplits } = wizardState;

  if (!parsedData) return null;

  const currentSheet = parsedData.sheets[selectedSheet];
  const suggestions = currentSheet.splitSuggestions || [];

  if (suggestions.length === 0) {
    return null;
  }

  const toggleSplit = (originalColumn: string) => {
    const newAccepted = new Set(acceptedSplits);
    if (newAccepted.has(originalColumn)) {
      newAccepted.delete(originalColumn);
    } else {
      newAccepted.add(originalColumn);
    }
    onStateChange({ acceptedSplits: newAccepted });
  };

  return (
    <div>
      <div style={{ background: '#e3f2fd', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
        <h4 style={{ margin: '0 0 4px 0' }}>💡 Column Split Suggestions</h4>
        <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
          We detected columns that contain multiple values. You can split them for easier querying.
        </p>
      </div>

      <h3 style={{ marginTop: 0 }}>Suggested Column Splits</h3>
      <p style={{ color: '#666', marginBottom: '24px' }}>
        Select which columns you'd like to split. You can always keep them as-is.
      </p>

      {suggestions.map((suggestion) => {
        const isAccepted = acceptedSplits.has(suggestion.originalColumn);
        const sampleValues = currentSheet.rows
          .slice(0, 3)
          .map((row: any) => row[suggestion.originalColumn])
          .filter((v: any) => v != null);

        return (
          <div
            key={suggestion.originalColumn}
            style={{
              border: `2px solid ${isAccepted ? '#4caf50' : '#e0e0e0'}`,
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '16px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              backgroundColor: isAccepted ? '#f1f8f4' : '#fff',
            }}
            onClick={() => toggleSplit(suggestion.originalColumn)}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
              <input
                type="checkbox"
                checked={isAccepted}
                onChange={() => {}}
                style={{ marginRight: '8px', width: '20px', height: '20px' }}
              />
              <strong style={{ fontSize: '16px' }}>{suggestion.originalColumn}</strong>
              <span
                style={{
                  marginLeft: '8px',
                  padding: '2px 8px',
                  background: '#fff3e0',
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: '#f57c00',
                }}
              >
                {suggestion.pattern}
              </span>
            </div>

            <div style={{ marginLeft: '28px', color: '#666', fontSize: '14px' }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>Will split into:</strong>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto 1fr',
                  gap: '12px',
                  alignItems: 'center',
                  marginBottom: '12px',
                }}
              >
                <div
                  style={{
                    padding: '8px 12px',
                    background: '#e8f5e9',
                    borderRadius: '6px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '12px', color: '#666' }}>Column 1</div>
                  <strong>{suggestion.suggestedColumns[0].name}</strong>
                  <div style={{ fontSize: '11px', color: '#999' }}>
                    ({suggestion.suggestedColumns[0].type})
                  </div>
                </div>
                <div style={{ fontSize: '20px' }}>+</div>
                <div
                  style={{
                    padding: '8px 12px',
                    background: '#e3f2fd',
                    borderRadius: '6px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '12px', color: '#666' }}>Column 2</div>
                  <strong>{suggestion.suggestedColumns[1].name}</strong>
                  <div style={{ fontSize: '11px', color: '#999' }}>
                    ({suggestion.suggestedColumns[1].type})
                  </div>
                </div>
              </div>

              {sampleValues.length > 0 && (
                <div style={{ fontSize: '12px' }}>
                  <strong>Example values:</strong>
                  <div
                    style={{
                      marginTop: '4px',
                      padding: '8px',
                      background: '#f5f5f5',
                      borderRadius: '4px',
                      fontFamily: 'monospace',
                    }}
                  >
                    {sampleValues.map((val: any, idx: number) => {
                      const trimmed = String(val).trim();
                      // Try 4-digit year pattern first, then 2-digit
                      let match = trimmed.match(/^(\d{4}[-/]\d{2}[-/]\d{2})\s*-?(\d+)$/);
                      if (!match) {
                        match = trimmed.match(/^(\d{2}[-/]\d{2}[-/]\d{2})\s*-?(\d+)$/);
                      }
                      return (
                        <div key={idx} style={{ marginBottom: '4px' }}>
                          "{val}" →{' '}
                          {match ? (
                            <>
                              <span style={{ color: '#4caf50' }}>"{match[1]}"</span> +{' '}
                              <span style={{ color: '#2196f3' }}>{match[2]}</span>
                            </>
                          ) : (
                            <span style={{ color: '#ff9800' }}>No split</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div style={{ background: '#fff3e0', padding: '12px', borderRadius: '6px', marginTop: '16px' }}>
        <strong>💡 Tip:</strong> Splitting columns makes it easier to filter and query by date or
        number separately. You can always query the original combined format later if needed.
      </div>

      {error && <div className="error-message">{error}</div>}
    </div>
  );
};
