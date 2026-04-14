import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSync, faEllipsisV, faEdit, faTrash, faCheck, faTimes, faDatabase, faUpload, faFile, faCalendarAlt } from '@fortawesome/free-solid-svg-icons';
import { UserTable } from '../../hooks/useUserData';
import { useSyncConfig } from '../../hooks/useSyncConfig';

interface TableListProps {
  tables: UserTable[];
  onSelectTable: (table: UserTable) => void;
  onDeleteTable: (tableId: string) => void;
  onRenameTable?: (tableId: string, newName: string, newDisplayName: string) => void;
  onImportClick: () => void;
}

export const TableList: React.FC<TableListProps> = ({
  tables,
  onSelectTable,
  onDeleteTable,
  onRenameTable,
  onImportClick,
}) => {
  const { configurations, fetchConfigurations } = useSyncConfig();
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [tunnelUrl, setTunnelUrl] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [tunnelLoading, setTunnelLoading] = useState(false);
  const [tunnelError, setTunnelError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [renamingTableId, setRenamingTableId] = useState<string | null>(null);
  const [newTableName, setNewTableName] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  // Fetch sync configurations on mount
  useEffect(() => {
    fetchConfigurations();
  }, [fetchConfigurations]);

  // Check if a table has browser sync configured
  const hasSyncConfig = (tableId: string): boolean => {
    return configurations.some(config => config.targetTableId === tableId && config.enabled);
  };

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

  const toggleActionMenu = (e: React.MouseEvent, tableId: string) => {
    e.stopPropagation();
    setOpenActionMenuId(prev => (prev === tableId ? null : tableId));
  };

  const handleRenameClick = (e: React.MouseEvent, table: UserTable) => {
    e.stopPropagation();
    setRenamingTableId(table.id);
    setNewTableName(table.tableName);
    setNewDisplayName(table.displayName);
  };

  const handleRenameSubmit = async (e: React.FormEvent, tableId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!newTableName.trim() || !newDisplayName.trim()) {
      alert('Please enter both table name and display name');
      return;
    }

    if (onRenameTable) {
      await onRenameTable(tableId, newTableName.trim(), newDisplayName.trim());
    }

    setRenamingTableId(null);
    setNewTableName('');
    setNewDisplayName('');
  };

  const handleRenameCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingTableId(null);
    setNewTableName('');
    setNewDisplayName('');
  };

  const handleToggleSqlInfo = async (e: React.MouseEvent, tableId: string) => {
    e.stopPropagation();
    if (expandedCardId === tableId) {
      setExpandedCardId(null);
      return;
    }
    setExpandedCardId(tableId);
    if (tunnelUrl !== null || tunnelError) return; // already fetched
    setTunnelLoading(true);
    try {
      const result = await window.electron.invoke('get-mcp-tunnel-config');
      const url = result?.tunnel?.publicUrl ?? null;
      setTunnelUrl(url);
      setApiKey(result?.tunnel?.apiKey ?? null);
      if (!url) setTunnelError('Tunnel not active');
    } catch {
      setTunnelError('Failed to retrieve tunnel URL');
    } finally {
      setTunnelLoading(false);
    }
  };

  const handleCopy = (e: React.MouseEvent, table: UserTable) => {
    e.stopPropagation();
    const endpoint = tunnelUrl ? `${tunnelUrl}/user-data/tools/call` : '(tunnel not active)';

    // Auto-detect date column: prefer type DATE, then name heuristics
    const dateCol =
      table.schema.find(c => c.type === 'DATE')?.name ||
      table.schema.find(c => /일자|날짜|date|dt/i.test(c.name))?.name ||
      '';

    const text = `// ============================================
// MCP SQL — ${table.displayName} (${table.tableName})
// Columns: ${table.schema.map(c => c.name).join(', ')}
// ============================================

const MCP_ENDPOINT = "${endpoint}";
const MCP_TABLE    = "${table.tableName}";
const MCP_API_KEY  = "${apiKey ?? '(not set)'}";
const DATE_COLUMN  = "${dateCol}";  // change if wrong
const SYNC_DAYS    = 30;            // how many days back to pull

// ============================================

function mcpQuery(sql) {
  const response = UrlFetchApp.fetch(MCP_ENDPOINT, {
    method: "post",
    contentType: "application/json",
    headers: { "X-Api-Key": MCP_API_KEY },
    payload: JSON.stringify({
      tool: "user_data_sql_query",
      arguments: { query: sql }
    }),
    muteHttpExceptions: true
  });
  const data = JSON.parse(response.getContentText());
  if (!data.success) throw new Error(data.error);
  const textContent = data.result && data.result.content && data.result.content.find(function(c) { return c.type === "text"; });
  return textContent ? JSON.parse(textContent.text).rows : [];
}

function writeToSheet(rows, sheetName) {
  if (!rows || !rows.length) { Logger.log("No rows returned"); return; }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  sheet.clearContents();
  const headers = Object.keys(rows[0]);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
  sheet.getRange(2, 1, rows.length, headers.length)
    .setValues(rows.map(function(r) { return headers.map(function(h) { return r[h] != null ? r[h] : ""; }); }));
  Logger.log("Done: " + rows.length + " rows → " + sheetName);
}

/** Pull last SYNC_DAYS days based on DATE_COLUMN */
function syncDateRange() {
  const today = new Date();
  const from  = new Date(today);
  from.setDate(from.getDate() - SYNC_DAYS);

  function fmt(d) {
    return d.getFullYear() + "-"
      + String(d.getMonth() + 1).padStart(2, "0") + "-"
      + String(d.getDate()).padStart(2, "0");
  }

  const sql = 'SELECT * FROM ' + MCP_TABLE
    + ' WHERE "' + DATE_COLUMN + '" >= \\'' + fmt(from) + '\\''
    + ' AND "'   + DATE_COLUMN + '" <= \\'' + fmt(today) + '\\''
    + ' ORDER BY "' + DATE_COLUMN + '" DESC';

  Logger.log("Querying: " + sql);
  const rows = mcpQuery(sql);
  writeToSheet(rows, "동기화_" + fmt(from) + "_" + fmt(today));
}

/** Pull everything, no date filter */
function queryToSheet() {
  const rows = mcpQuery("SELECT * FROM " + MCP_TABLE + " LIMIT 500");
  writeToSheet(rows, "전체조회");
}

function testConnection() {
  const rows = mcpQuery("SELECT COUNT(*) as total FROM " + MCP_TABLE);
  Logger.log(JSON.stringify(rows));
}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getTableKindLabel = (table: UserTable): 'SQL' | 'Bucket' => {
    return table.tableKind === 'bucket' ? 'Bucket' : 'SQL';
  };

  if (tables.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon"><FontAwesomeIcon icon={faDatabase} /></div>
        <h3 className="empty-state-title">No Tables Yet</h3>
        <p className="empty-state-message">
          Import your first Excel file to get started
        </p>
        <button className="btn btn-primary" onClick={onImportClick}>
          <FontAwesomeIcon icon={faUpload} /> Import Excel File
        </button>
      </div>
    );
  }

  return (
    <div className="table-list">
      <div className="table-list-grid">
        {tables.map((table) => (
          <div
            key={table.id}
            className="table-card"
            onClick={() => onSelectTable(table)}
          >
            <div className="table-card-header">
              {renamingTableId === table.id ? (
                <form
                  className="table-rename-form"
                  onSubmit={(e) => handleRenameSubmit(e, table.id)}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="table-rename-inputs">
                    <input
                      type="text"
                      className="table-rename-input"
                      placeholder="Display Name"
                      value={newDisplayName}
                      onChange={(e) => setNewDisplayName(e.target.value)}
                      autoFocus
                    />
                    <input
                      type="text"
                      className="table-rename-input small"
                      placeholder="table_name"
                      value={newTableName}
                      onChange={(e) => setNewTableName(e.target.value)}
                    />
                  </div>
                  <div className="table-rename-actions">
                    <button type="submit" className="btn btn-sm btn-primary">
                      <FontAwesomeIcon icon={faCheck} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={handleRenameCancel}
                    >
                      <FontAwesomeIcon icon={faTimes} />
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="table-card-title-wrap">
                    <h3 className="table-card-title">{table.displayName}</h3>
                    <div className="table-card-subtitle-row">
                      <div className="table-card-subtitle">{table.tableName}</div>
                      <span
                        className={`table-kind-badge ${table.tableKind === 'bucket' ? 'bucket' : 'sql'}`}
                      >
                        {getTableKindLabel(table)}
                      </span>
                    </div>
                  </div>

                  <div className="table-card-utility-row">
                    {hasSyncConfig(table.id) && (
                      <div className="table-card-sync-badge" title="Browser sync configured for this table">
                        <FontAwesomeIcon icon={faSync} />
                      </div>
                    )}
                    <div className="table-card-actions-menu">
                      <button
                        className="btn-icon btn-secondary btn-sm"
                        onClick={(e) => toggleActionMenu(e, table.id)}
                        title="Table actions"
                      >
                        <FontAwesomeIcon icon={faEllipsisV} />
                      </button>
                      {openActionMenuId === table.id && (
                        <div className="table-card-actions-dropdown" onClick={(e) => e.stopPropagation()}>
                          {onRenameTable && (
                            <button
                              className="table-card-actions-item"
                              onClick={(e) => {
                                handleRenameClick(e, table);
                                setOpenActionMenuId(null);
                              }}
                            >
                              <FontAwesomeIcon icon={faEdit} />
                              <span>Rename</span>
                            </button>
                          )}
                          <button
                            className="table-card-actions-item"
                            onClick={(e) => {
                              handleToggleSqlInfo(e, table.id);
                              setOpenActionMenuId(null);
                            }}
                          >
                            <span>{expandedCardId === table.id ? 'Hide SQL Address' : 'Show SQL Address'}</span>
                          </button>
                          <button
                            className="table-card-actions-item danger"
                            onClick={(e) => {
                              handleDeleteClick(e, table.id);
                              setOpenActionMenuId(null);
                            }}
                          >
                            <FontAwesomeIcon icon={faTrash} />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
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
                <div><FontAwesomeIcon icon={faFile} /> From: {table.createdFromFile}</div>
              )}
              <div><FontAwesomeIcon icon={faCalendarAlt} /> Created: {formatDate(table.createdAt)}</div>
              <div><FontAwesomeIcon icon={faSync} /> Updated: {formatDate(table.updatedAt)}</div>
            </div>

            {expandedCardId === table.id && (
              <div className="sql-info-panel" onClick={(e) => e.stopPropagation()}>
                {tunnelLoading && <div className="sql-info-loading">Loading...</div>}
                {tunnelError && <div className="sql-info-error">{tunnelError}</div>}
                {!tunnelLoading && (
                  <>
                    <div className="sql-info-row">
                      <span className="sql-info-label">Tunnel endpoint:</span>
                      <span className="sql-info-value">
                        {tunnelUrl ? `${tunnelUrl}/user-data/tools/call` : '—'}
                      </span>
                    </div>
                    <div className="sql-info-row">
                      <span className="sql-info-label">Table name:</span>
                      <span className="sql-info-value">{table.tableName}</span>
                    </div>
                    <div className="sql-info-row">
                      <span className="sql-info-label">Column headers:</span>
                      <span className="sql-info-value">
                        {table.schema.map(c => c.name).join(', ')}
                      </span>
                    </div>
                    <div className="sql-info-row">
                      <span className="sql-info-label">API Key (X-Api-Key header):</span>
                      <span className="sql-info-value">{apiKey ?? '—'}</span>
                    </div>
                    <button
                      className="sql-info-copy-btn"
                      onClick={(e) => handleCopy(e, table)}
                    >
                      {copied ? 'Copied!' : 'Copy Apps Script'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
