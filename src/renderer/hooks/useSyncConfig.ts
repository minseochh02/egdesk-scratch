import { useState, useCallback } from 'react';

interface SyncConfiguration {
  id: string;
  scriptFolderPath: string;
  scriptName: string;
  folderName: string;
  targetTableId: string;
  headerRow: number;
  skipBottomRows: number;
  sheetIndex: number;
  columnMappings: Record<string, string>;
  fileAction: 'keep' | 'archive' | 'delete';
  enabled: boolean;
  autoSyncEnabled: boolean;
  lastSyncAt?: string;
  lastSyncStatus?: string;
  lastSyncRowsImported: number;
  lastSyncRowsSkipped: number;
  lastSyncError?: string;
  createdAt: string;
  updatedAt: string;
}

export const useSyncConfig = () => {
  const [configurations, setConfigurations] = useState<SyncConfiguration[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfigurations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await (window as any).electron.invoke('sync-config:get-all');
      if (result.success) {
        setConfigurations(result.data);
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch configurations';
      setError(message);
      console.error('Error fetching sync configurations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const getConfiguration = useCallback(async (configId: string): Promise<SyncConfiguration | null> => {
    try {
      const result = await (window as any).electron.invoke('sync-config:get', configId);
      if (result.success) {
        return result.data;
      }
      throw new Error(result.error);
    } catch (err) {
      console.error('Error getting configuration:', err);
      return null;
    }
  }, []);

  const getConfigurationByFolder = useCallback(async (scriptFolderPath: string): Promise<SyncConfiguration | null> => {
    try {
      const result = await (window as any).electron.invoke('sync-config:get-by-folder', scriptFolderPath);
      if (result.success) {
        return result.data;
      }
      return null;
    } catch (err) {
      console.error('Error getting configuration by folder:', err);
      return null;
    }
  }, []);

  const updateConfiguration = useCallback(
    async (configId: string, updates: Partial<SyncConfiguration>): Promise<void> => {
      try {
        const result = await (window as any).electron.invoke('sync-config:update', configId, updates);
        if (!result.success) {
          throw new Error(result.error);
        }
        await fetchConfigurations();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update configuration';
        throw new Error(message);
      }
    },
    [fetchConfigurations]
  );

  const deleteConfiguration = useCallback(
    async (configId: string): Promise<void> => {
      try {
        const result = await (window as any).electron.invoke('sync-config:delete', configId);
        if (!result.success) {
          throw new Error(result.error);
        }
        await fetchConfigurations();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete configuration';
        throw new Error(message);
      }
    },
    [fetchConfigurations]
  );

  return {
    configurations,
    loading,
    error,
    fetchConfigurations,
    getConfiguration,
    getConfigurationByFolder,
    updateConfiguration,
    deleteConfiguration,
  };
};
