import React, { useState } from 'react';
import { UserTable } from '../../hooks/useUserData';

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
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [tunnelUrl, setTunnelUrl] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [tunnelLoading, setTunnelLoading] = useState(false);
  const [tunnelError, setTunnelError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [renamingTableId, setRenamingTableId] = useState<string | null>(null);
  const [newTableName, setNewTableName] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');

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
                      ✓
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={handleRenameCancel}
                    >
                      ✕
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div>
                    <h3 className="table-card-title">{table.displayName}</h3>
                    <div className="table-card-subtitle">{table.tableName}</div>
                  </div>
                  <div className="table-card-actions">
                    {onRenameTable && (
                      <button
                        className="btn-icon btn-secondary btn-sm"
                        onClick={(e) => handleRenameClick(e, table)}
                        title="Rename table"
                      >
                        ✏️
                      </button>
                    )}
                    <button
                      className="btn-icon btn-danger btn-sm"
                      onClick={(e) => handleDeleteClick(e, table.id)}
                      title="Delete table"
                    >
                      🗑️
                    </button>
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
                <div>📄 From: {table.createdFromFile}</div>
              )}
              <div>📅 Created: {formatDate(table.createdAt)}</div>
              <div>🔄 Updated: {formatDate(table.updatedAt)}</div>
            </div>

            <button
              className="btn btn-sm btn-secondary sql-info-toggle"
              onClick={(e) => handleToggleSqlInfo(e, table.id)}
            >
              {expandedCardId === table.id ? 'Hide SQL Info' : 'SQL Address'}
            </button>

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
