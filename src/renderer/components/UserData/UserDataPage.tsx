import React, { useState } from 'react';
import { useUserData, UserTable } from '../../hooks/useUserData';
import { TableList } from './TableList';
import { TableViewer } from './TableViewer';
import { ImportWizard } from './ImportWizard';
import { BrowserDownloadsSyncWizard } from './BrowserDownloadsSyncWizard';
import { SyncConfigurationsManager } from './SyncConfigurationsManager';
import './UserData.css';

export const UserDataPage: React.FC = () => {
  const { tables, loading, error, fetchTables, renameTable, deleteTable } = useUserData();
  const [selectedTable, setSelectedTable] = useState<UserTable | null>(null);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [showBrowserSyncWizard, setShowBrowserSyncWizard] = useState(false);
  const [showSyncConfigManager, setShowSyncConfigManager] = useState(false);

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
        <h1>📊 User Database</h1>
        <div className="user-data-header-actions">
          {!selectedTable && (
            <>
              <button className="btn btn-primary" onClick={() => setShowImportWizard(true)}>
                📥 Import Excel
              </button>
            <button className="btn btn-secondary" onClick={() => setShowBrowserSyncWizard(true)}>
              🔄 Sync Browser Downloads
            </button>
            <button className="btn btn-secondary" onClick={() => setShowSyncConfigManager(true)}>
              ⚙️ Configurations
            </button>
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

      {showSyncConfigManager && (
        <SyncConfigurationsManager
          userTables={tables}
          onClose={() => setShowSyncConfigManager(false)}
        />
      )}
    </div>
  );
};
