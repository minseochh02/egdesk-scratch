import React, { useState } from 'react';
import { faRobot } from '@fortawesome/free-solid-svg-icons';
import { UserTable, useUserData } from '../../hooks/useUserData';
import { ExcelDataWizard } from './wizards/ExcelDataWizard';
import { SourceFileSyncWizard, SyncFileItem, SyncSourceItem } from './SourceFileSyncWizard';

interface BrowserDownloadsSyncWizardProps {
  onClose: () => void;
  onComplete: () => void;
}

/**
 * BrowserDownloadsSyncWizard - Orchestrator that handles browser-specific steps
 * then delegates to ExcelDataWizard
 */
export const BrowserDownloadsSyncWizard: React.FC<BrowserDownloadsSyncWizardProps> = ({ onClose, onComplete }) => {
  const { tables } = useUserData();
  const [launchConfig, setLaunchConfig] = useState<{
    mode: 'import' | 'upload';
    selectedSource: SyncSourceItem;
    selectedFile: SyncFileItem;
    targetTable?: UserTable;
  } | null>(null);

  if (launchConfig) {
    return (
      <ExcelDataWizard
        mode={launchConfig.mode}
        preSelectedFile={launchConfig.selectedFile.path}
        targetTable={launchConfig.targetTable}
        onClose={onClose}
        onComplete={onComplete}
        sourceType="browser"
        scriptFolderPath={launchConfig.selectedSource.path}
        scriptName={launchConfig.selectedSource.metadata?.scriptName}
        folderName={launchConfig.selectedSource.metadata?.folderName}
      />
    );
  }

  return (
    <SourceFileSyncWizard
      title="Sync Browser Downloads to SQL"
      sourceLabel="Automation"
      sourceEmptyTitle="No browser automations found"
      sourceEmptyMessage="Browser recorder has not produced downloadable files yet."
      sourceIcon={faRobot}
      scriptNameLabel="Automation"
      userTables={tables}
      onClose={onClose}
      onStart={setLaunchConfig}
      loadSources={async () => {
        const result = await (window as any).electron.debug.getBrowserDownloadFolders();
        if (!result.success) throw new Error(result.error || 'Failed to load browser automations');
        return (result.folders || []).map((folder: any) => ({
          id: folder.path,
          title: folder.scriptName,
          subtitle: folder.folderName,
          path: folder.path,
          fileCount: folder.fileCount,
          excelFileCount: folder.excelFileCount,
          lastModified: new Date(folder.lastModified),
          size: folder.size,
          metadata: {
            scriptName: folder.scriptName,
            folderName: folder.folderName,
          },
        }));
      }}
      loadFiles={async (source) => {
        const result = await (window as any).electron.debug.getFolderFiles(source.path);
        if (!result.success) throw new Error(result.error || 'Failed to load folder files');
        return (result.files || [])
          .filter((file: any) => /\.(xlsx?|xlsm|xls|csv)$/i.test(file.name))
          .map((file: any) => ({
            id: file.path,
            name: file.name,
            path: file.path,
            size: file.size,
            modified: new Date(file.modified),
          }));
      }}
    />
  );
};
