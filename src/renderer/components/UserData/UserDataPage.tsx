import React, { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog, faDatabase, faDownload, faExclamationTriangle, faSpinner, faSync, faTrash, faUpload } from '@fortawesome/free-solid-svg-icons';
import { useUserData, UserTable } from '../../hooks/useUserData';
import { TableList } from './TableList';
import { TableViewer } from './TableViewer';
import { ImportWizard } from './ImportWizard';
import { BrowserDownloadsSyncWizard } from './BrowserDownloadsSyncWizard';
import { DesktopDownloadsSyncWizard } from './DesktopDownloadsSyncWizard';
import { SyncConfigurationsManager } from './SyncConfigurationsManager';
import './UserData.css';

export const UserDataPage: React.FC = () => {
  const { tables, loading, error, fetchTables, renameTable, deleteTable, exportAllTables, importAllSheets, dropAllTables, exportSQL, importSQL, forceDropAllTables } = useUserData();
  const [selectedTable, setSelectedTable] = useState<UserTable | null>(null);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [showBrowserSyncWizard, setShowBrowserSyncWizard] = useState(false);
  const [showDesktopSyncWizard, setShowDesktopSyncWizard] = useState(false);
  const [showSyncConfigManager, setShowSyncConfigManager] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [exportingSql, setExportingSql] = useState(false);
  const [importingSql, setImportingSql] = useState(false);
  const [forceDropping, setForceDropping] = useState(false);
  const [openActionGroup, setOpenActionGroup] = useState<'data' | 'sync' | 'reset' | null>(null);
  const headerActionsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!headerActionsRef.current) return;
      if (!headerActionsRef.current.contains(event.target as Node)) {
        setOpenActionGroup(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSelectTable = (table: UserTable) => {
    setSelectedTable(table);
  };

  const handleBackToList = () => {
    setSelectedTable(null);
  };

  const handleRenameTable = async (tableId: string, newTableName: string, newDisplayName: string) => {
    try {
      await renameTable(tableId, newTableName, newDisplayName);

      // If the renamed table was selected, update the selected table
      if (selectedTable && selectedTable.id === tableId) {
        const updatedTable = tables.find(t => t.id === tableId);
        if (updatedTable) {
          setSelectedTable(updatedTable);
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to rename table');
    }
  };

  const handleDeleteTable = async (tableId: string) => {
    try {
      await deleteTable(tableId);

      // If the deleted table was selected, go back to list
      if (selectedTable && selectedTable.id === tableId) {
        setSelectedTable(null);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete table');
    }
  };

  const handleImportComplete = () => {
    fetchTables();
  };

  const handleExportAll = async () => {
    if (tables.length === 0) {
      alert('No tables to export');
      return;
    }

    setExporting(true);
    try {
      const result = await exportAllTables();

      if (result) {
        alert(`Successfully exported ${result.tablesExported} table(s) with ${result.totalRows} total rows to:\n${result.filePath}`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to export tables');
    } finally {
      setExporting(false);
    }
  };

  const handleImportAll = async () => {
    // Ask user if they want to overwrite existing tables
    let overwrite = false;
    if (tables.length > 0) {
      overwrite = window.confirm(
        '📥 Import All Sheets\n\n' +
        'Do you want to OVERWRITE existing tables with the same name?\n\n' +
        'YES = Overwrite existing tables\n' +
        'NO = Skip existing tables (import only new ones)'
      );
    }

    setImporting(true);
    try {
      const result = await importAllSheets({ overwrite });

      if (result) {
        const successMsg = result.successCount > 0
          ? `✅ Successfully imported ${result.successCount} sheet(s) as tables.`
          : '';
        const failMsg = result.failCount > 0
          ? `\n⚠️ ${result.failCount} sheet(s) failed or were skipped.`
          : '';

        // Show details for failed/skipped sheets
        const skippedSheets = result.results.filter((r: any) => !r.success && r.skipped);
        const failedSheets = result.results.filter((r: any) => !r.success && !r.skipped);

        let details = '';
        if (skippedSheets.length > 0) {
          details += `\n\nSkipped (already exist):\n${skippedSheets.map((r: any) => `  • ${r.sheetName}`).join('\n')}`;
        }
        if (failedSheets.length > 0) {
          details += `\n\nFailed:\n${failedSheets.map((r: any) => `  • ${r.sheetName}: ${r.error}`).join('\n')}`;
        }

        alert(`Import from "${result.fileName}":\n${successMsg}${failMsg}${details}`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to import sheets');
    } finally {
      setImporting(false);
    }
  };

  const handleDropAll = async () => {
    if (tables.length === 0) {
      alert('No tables to drop');
      return;
    }

    // Double confirmation for destructive action
    const firstConfirm = window.confirm(
      `⚠️ WARNING: This will permanently delete ALL ${tables.length} table(s) and their data.\n\nThis action CANNOT be undone.\n\nAre you sure you want to continue?`
    );

    if (!firstConfirm) {
      return;
    }

    const secondConfirm = window.confirm(
      `⚠️ FINAL CONFIRMATION\n\nYou are about to delete:\n${tables.map(t => `  - ${t.displayName} (${t.rowCount} rows)`).join('\n')}\n\nType YES in your mind and click OK to proceed.`
    );

    if (!secondConfirm) {
      return;
    }

    setDropping(true);
    try {
      const result = await dropAllTables();

      if (result) {
        const successMsg = result.successCount > 0
          ? `Successfully dropped ${result.successCount} table(s).`
          : '';
        const failMsg = result.failCount > 0
          ? `\n${result.failCount} table(s) failed to drop.`
          : '';

        alert(`Drop All Complete:\n${successMsg}${failMsg}`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to drop tables');
    } finally {
      setDropping(false);
    }
  };

  const handleExportSQL = async () => {
    if (tables.length === 0) {
      alert('No tables to export');
      return;
    }

    setExportingSql(true);
    try {
      const result = await exportSQL();

      if (result) {
        alert(`✅ Successfully exported ${result.tablesExported} table(s) with ${result.totalRows} total rows as SQL to:\n${result.filePath}`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to export SQL');
    } finally {
      setExportingSql(false);
    }
  };

  const handleImportSQL = async () => {
    const confirm = window.confirm(
      '📥 Import SQL\n\n' +
      'This will execute all SQL statements from the file.\n\n' +
      'WARNING: If tables already exist, this may cause errors.\n' +
      'Consider using "Drop All" first if you want to replace all data.\n\n' +
      'Continue?'
    );

    if (!confirm) {
      return;
    }

    setImportingSql(true);
    try {
      const result = await importSQL();

      if (result) {
        const successMsg = `✅ Executed ${result.statementsExecuted} SQL statement(s)`;
        const tablesMsg = result.tablesRegistered > 0
          ? `\n📋 Registered ${result.tablesRegistered} new table(s)`
          : '';
        const errorMsg = result.errorCount > 0
          ? `\n⚠️ ${result.errorCount} statement(s) failed`
          : '';
        const errorDetails = result.errors && result.errors.length > 0
          ? `\n\nFirst errors:\n${result.errors.slice(0, 3).join('\n\n')}`
          : '';

        alert(`Import from "${result.fileName}":\n${successMsg}${tablesMsg}${errorMsg}${errorDetails}`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to import SQL');
    } finally {
      setImportingSql(false);
    }
  };

  const handleForceDropAll = async () => {
    // Triple confirmation for nuclear option
    const firstConfirm = window.confirm(
      `⚠️ FORCE DROP ALL TABLES\n\n` +
      `This will delete ALL tables from the database, including:\n` +
      `- Tables with metadata (${tables.length})\n` +
      `- Orphaned tables without metadata\n` +
      `- ALL data will be PERMANENTLY deleted\n\n` +
      `This action CANNOT be undone.\n\n` +
      `Are you absolutely sure?`
    );

    if (!firstConfirm) {
      return;
    }

    const secondConfirm = window.confirm(
      `⚠️ FINAL WARNING\n\n` +
      `This is a DESTRUCTIVE operation that will wipe your entire database.\n\n` +
      `Click OK only if you are 100% certain.`
    );

    if (!secondConfirm) {
      return;
    }

    setForceDropping(true);
    try {
      const result = await forceDropAllTables();

      if (result) {
        const successMsg = result.successCount > 0
          ? `Successfully dropped ${result.successCount} table(s).`
          : '';
        const failMsg = result.failCount > 0
          ? `\n${result.failCount} table(s) failed to drop.`
          : '';

        alert(`Force Drop Complete:\n${successMsg}${failMsg}\n\nDatabase is now empty.`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to force drop tables');
    } finally {
      setForceDropping(false);
    }
  };

  if (loading && tables.length === 0) {
    return (
      <div className="user-data-page">
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="user-data-page">
      <div className="user-data-header">
        <h1>
          <FontAwesomeIcon icon={faDatabase} /> {selectedTable ? 'User Database' : `User Database (${tables.length})`}
        </h1>
        <div className="user-data-header-actions" ref={headerActionsRef}>
          {!selectedTable && (
            <>
              <div className="action-group">
                <button
                  className={`btn btn-primary btn-compact action-group-trigger ${openActionGroup === 'data' ? 'active' : ''}`}
                  onClick={() => setOpenActionGroup(openActionGroup === 'data' ? null : 'data')}
                >
                  <FontAwesomeIcon icon={faDatabase} /> Data Management
                </button>
                {openActionGroup === 'data' && (
                  <div className="action-group-menu">
                    <button className="action-group-item" onClick={() => { setShowImportWizard(true); setOpenActionGroup(null); }}>
                      <FontAwesomeIcon icon={faUpload} /> Import Excel
                    </button>
                    <button
                      className="action-group-item"
                      onClick={() => { handleImportAll(); setOpenActionGroup(null); }}
                      disabled={importing}
                    >
                      {importing ? <><FontAwesomeIcon icon={faSpinner} spin /> Importing All...</> : <><FontAwesomeIcon icon={faUpload} /> Import All</>}
                    </button>
                    <button
                      className="action-group-item"
                      onClick={() => { handleExportAll(); setOpenActionGroup(null); }}
                      disabled={exporting || tables.length === 0}
                    >
                      {exporting ? <><FontAwesomeIcon icon={faSpinner} spin /> Exporting All...</> : <><FontAwesomeIcon icon={faDownload} /> Export All</>}
                    </button>
                    <button
                      className="action-group-item"
                      onClick={() => { handleImportSQL(); setOpenActionGroup(null); }}
                      disabled={importingSql}
                    >
                      {importingSql ? <><FontAwesomeIcon icon={faSpinner} spin /> Importing SQL...</> : <><FontAwesomeIcon icon={faUpload} /> Import SQL</>}
                    </button>
                    <button
                      className="action-group-item"
                      onClick={() => { handleExportSQL(); setOpenActionGroup(null); }}
                      disabled={exportingSql || tables.length === 0}
                    >
                      {exportingSql ? <><FontAwesomeIcon icon={faSpinner} spin /> Exporting SQL...</> : <><FontAwesomeIcon icon={faDownload} /> Export SQL</>}
                    </button>
                  </div>
                )}
              </div>

              <div className="action-group">
                <button
                  className={`btn btn-secondary action-group-trigger ${openActionGroup === 'sync' ? 'active' : ''}`}
                  onClick={() => setOpenActionGroup(openActionGroup === 'sync' ? null : 'sync')}
                >
                  <FontAwesomeIcon icon={faSync} /> Sync Config
                </button>
                {openActionGroup === 'sync' && (
                  <div className="action-group-menu">
                    <button className="action-group-item" onClick={() => { setShowBrowserSyncWizard(true); setOpenActionGroup(null); }}>
                      <FontAwesomeIcon icon={faSync} /> Sync Browser Downloads
                    </button>
                    <button className="action-group-item" onClick={() => { setShowDesktopSyncWizard(true); setOpenActionGroup(null); }}>
                      <FontAwesomeIcon icon={faSync} /> Sync Desktop Downloads
                    </button>
                    <button className="action-group-item" onClick={() => { setShowSyncConfigManager(true); setOpenActionGroup(null); }}>
                      <FontAwesomeIcon icon={faCog} /> Configurations
                    </button>
                  </div>
                )}
              </div>

              <div className="action-group">
                <button
                  className={`btn btn-danger action-group-trigger ${openActionGroup === 'reset' ? 'active' : ''}`}
                  onClick={() => setOpenActionGroup(openActionGroup === 'reset' ? null : 'reset')}
                >
                  <FontAwesomeIcon icon={faExclamationTriangle} /> DB Reset
                </button>
                {openActionGroup === 'reset' && (
                  <div className="action-group-menu action-group-menu-danger">
                    <button
                      className="action-group-item action-group-item-danger"
                      onClick={() => { handleDropAll(); setOpenActionGroup(null); }}
                      disabled={dropping || tables.length === 0}
                    >
                      {dropping ? <><FontAwesomeIcon icon={faSpinner} spin /> Dropping...</> : <><FontAwesomeIcon icon={faTrash} /> Drop All</>}
                    </button>
                    <button
                      className="action-group-item action-group-item-danger"
                      onClick={() => { handleForceDropAll(); setOpenActionGroup(null); }}
                      disabled={forceDropping}
                      title="Force drop ALL tables (including orphaned ones)"
                    >
                      {forceDropping ? <><FontAwesomeIcon icon={faSpinner} spin /> Force Dropping...</> : <><FontAwesomeIcon icon={faExclamationTriangle} /> Force Drop</>}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="user-data-content">
        {selectedTable ? (
          <TableViewer table={selectedTable} onBack={handleBackToList} />
        ) : (
          <TableList
            tables={tables}
            onSelectTable={handleSelectTable}
            onRenameTable={handleRenameTable}
            onDeleteTable={handleDeleteTable}
            onImportClick={() => setShowImportWizard(true)}
          />
        )}
      </div>

      {showImportWizard && (
        <ImportWizard
          onClose={() => setShowImportWizard(false)}
          onComplete={handleImportComplete}
        />
      )}

      {showBrowserSyncWizard && (
        <BrowserDownloadsSyncWizard
          onClose={() => setShowBrowserSyncWizard(false)}
          onComplete={handleImportComplete}
        />
      )}

      {showDesktopSyncWizard && (
        <DesktopDownloadsSyncWizard
          onClose={() => setShowDesktopSyncWizard(false)}
          userTables={tables}
        />
      )}

      {showSyncConfigManager && (
        <SyncConfigurationsManager
          userTables={tables}
          onClose={() => setShowSyncConfigManager(false)}
        />
      )}
    </div>
  );
};
