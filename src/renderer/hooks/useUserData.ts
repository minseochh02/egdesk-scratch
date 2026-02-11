import { useState, useEffect, useCallback } from 'react';

/**
 * React hook for User Data operations
 *
 * Provides methods to interact with the user data database via IPC
 */

export interface UserTable {
  id: string;
  tableName: string;
  displayName: string;
  description?: string;
  createdFromFile?: string;
  rowCount: number;
  columnCount: number;
  createdAt: string;
  updatedAt: string;
  schema: Array<{
    name: string;
    type: 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB';
    notNull?: boolean;
    defaultValue?: string | number | null;
  }>;
}

export interface QueryResult {
  rows: any[];
  total: number;
  limit: number;
  offset: number;
}

export interface QueryOptions {
  filters?: Record<string, string>;
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  searchQuery?: string;
  searchColumns?: string[];
}

export function useUserData() {
  const [tables, setTables] = useState<UserTable[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch all user tables
   */
  const fetchTables = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await window.electron.invoke('user-data:get-tables');

      if (result.success) {
        setTables(result.data || []);
      } else {
        setError(result.error || 'Failed to fetch tables');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get a specific table by ID
   */
  const getTable = useCallback(async (tableId: string): Promise<UserTable | null> => {
    try {
      const result = await window.electron.invoke('user-data:get-table', tableId);

      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error || 'Failed to get table');
      }
    } catch (err) {
      throw err;
    }
  }, []);

  /**
   * Delete a table
   */
  const deleteTable = useCallback(async (tableId: string): Promise<boolean> => {
    try {
      const result = await window.electron.invoke('user-data:delete-table', tableId);

      if (result.success) {
        // Refresh tables list
        await fetchTables();
        return true;
      } else {
        throw new Error(result.error || 'Failed to delete table');
      }
    } catch (err) {
      throw err;
    }
  }, [fetchTables]);

  /**
   * Query table data
   */
  const queryTable = useCallback(
    async (tableId: string, options: QueryOptions = {}): Promise<QueryResult> => {
      try {
        const result = await window.electron.invoke(
          'user-data:query-table',
          tableId,
          options
        );

        if (result.success) {
          return result.data;
        } else {
          throw new Error(result.error || 'Failed to query table');
        }
      } catch (err) {
        throw err;
      }
    },
    []
  );

  /**
   * Search table data
   */
  const searchTable = useCallback(
    async (tableId: string, searchQuery: string, limit?: number): Promise<QueryResult> => {
      try {
        const result = await window.electron.invoke(
          'user-data:search-table',
          tableId,
          searchQuery,
          limit
        );

        if (result.success) {
          return result.data;
        } else {
          throw new Error(result.error || 'Failed to search table');
        }
      } catch (err) {
        throw err;
      }
    },
    []
  );

  /**
   * Parse Excel file
   */
  const parseExcel = useCallback(async (filePath: string, options?: {
    headerRow?: number;
    skipRows?: number;
    skipBottomRows?: number;
  }) => {
    try {
      const result = await window.electron.invoke('user-data:parse-excel', filePath, options);

      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error || 'Failed to parse Excel file');
      }
    } catch (err) {
      throw err;
    }
  }, []);

  /**
   * Import Excel file
   */
  const importExcel = useCallback(
    async (config: {
      filePath: string;
      sheetIndex: number;
      tableName: string;
      displayName: string;
      description?: string;
      columnMappings?: Record<string, string>;
      columnTypes?: Record<string, string>;
      mergeConfig?: Record<string, { sources: string[]; separator: string }>;
      headerRow?: number;
      skipRows?: number;
      skipBottomRows?: number;
    }) => {
      try {
        const result = await window.electron.invoke('user-data:import-excel', config);

        if (result.success) {
          // Refresh tables list
          await fetchTables();
          return result.data;
        } else {
          throw new Error(result.error || 'Failed to import Excel file');
        }
      } catch (err) {
        throw err;
      }
    },
    [fetchTables]
  );

  /**
   * Select Excel file
   */
  const selectExcelFile = useCallback(async (): Promise<string | null> => {
    try {
      const result = await window.electron.invoke('user-data:select-excel-file');

      if (result.success) {
        return result.filePath;
      } else if (result.canceled) {
        return null;
      } else {
        throw new Error(result.error || 'Failed to select file');
      }
    } catch (err) {
      throw err;
    }
  }, []);

  /**
   * Validate table name
   */
  const validateTableName = useCallback(async (tableName: string) => {
    try {
      const result = await window.electron.invoke(
        'user-data:validate-table-name',
        tableName
      );

      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error || 'Failed to validate table name');
      }
    } catch (err) {
      throw err;
    }
  }, []);

  /**
   * Get import operations for a table
   */
  const getImportOperations = useCallback(async (tableId: string, limit?: number) => {
    try {
      const result = await window.electron.invoke(
        'user-data:get-import-operations',
        tableId,
        limit
      );

      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error || 'Failed to get import operations');
      }
    } catch (err) {
      throw err;
    }
  }, []);

  /**
   * Sync Excel data to existing table
   */
  const syncToExistingTable = useCallback(
    async (config: {
      filePath: string;
      sheetIndex: number;
      tableId: string;
      columnMappings: Record<string, string>;
      headerRow?: number;
      skipRows?: number;
      skipBottomRows?: number;
    }) => {
      try {
        const result = await window.electron.invoke('user-data:sync-to-existing-table', config);

        if (result.success) {
          // Refresh tables list
          await fetchTables();
          return result.data;
        } else {
          throw new Error(result.error || 'Failed to sync to existing table');
        }
      } catch (err) {
        throw err;
      }
    },
    [fetchTables]
  );

  // Fetch tables on mount
  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  return {
    tables,
    loading,
    error,
    fetchTables,
    getTable,
    deleteTable,
    queryTable,
    searchTable,
    parseExcel,
    importExcel,
    selectExcelFile,
    validateTableName,
    getImportOperations,
    syncToExistingTable,
  };
}
