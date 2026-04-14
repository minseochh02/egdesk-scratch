import React, { useState } from 'react';
import { faFolderOpen } from '@fortawesome/free-solid-svg-icons';
import { ExcelDataWizard } from './wizards/ExcelDataWizard';
import { UserTable } from '../../hooks/useUserData';
import { SourceFileSyncWizard, SyncFileItem, SyncSourceItem } from './SourceFileSyncWizard';

interface DesktopDownloadsSyncWizardProps {
  onClose: () => void;
  userTables: UserTable[];
  initialFolder?: string; // Optional: pre-select a folder
  initialFilePath?: string;
}

export const DesktopDownloadsSyncWizard: React.FC<DesktopDownloadsSyncWizardProps> = ({
  onClose,
  userTables,
  initialFolder,
  initialFilePath,
}) => {
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
        sourceType="desktop"
        scriptFolderPath={launchConfig.selectedSource.path}
        scriptName={launchConfig.selectedSource.metadata?.scriptName}
        folderName={launchConfig.selectedSource.metadata?.folderName}
        preSelectedFile={launchConfig.selectedFile.path}
        targetTable={launchConfig.targetTable}
        onClose={onClose}
        onComplete={onClose}
      />
    );
  }

  return (
    <SourceFileSyncWizard
      title="Sync Desktop Downloads"
      sourceLabel="Recording"
      sourceEmptyTitle="No desktop recordings found"
      sourceEmptyMessage="Record a desktop session with file downloads to get started."
      sourceIcon={faFolderOpen}
      scriptNameLabel="Recording"
      userTables={userTables}
      onClose={onClose}
      onStart={setLaunchConfig}
      initialSourcePath={initialFolder}
      initialFilePath={initialFilePath}
      loadSources={async () => {
        const result = await (window as any).electron.invoke('desktop-recorder:get-download-folders');
        if (!result.success) throw new Error(result.error || 'Failed to load desktop recording folders');
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
        const result = await (window as any).electron.invoke('desktop-recorder:get-folder-files', {
          folderPath: source.path,
        });
        if (!result.success) throw new Error(result.error || 'Failed to load files');
        return (result.files || [])
          .filter((file: any) => /\.(xlsx|xls|xlsm|csv)$/i.test(file.name))
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
