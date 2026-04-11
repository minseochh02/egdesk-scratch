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
  hasImportedAtColumn?: boolean; // Whether this table has an imported_at column
  schema: Array<{
    name: string;
    type: 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB' | 'DATE';
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
   * Rename a table
   */
  const renameTable = useCallback(async (tableId: string, newTableName: string, newDisplayName: string): Promise<UserTable | null> => {
    try {
      const result = await window.electron.invoke('user-data:rename-table', tableId, newTableName, newDisplayName);

      if (result.success) {
        // Refresh tables list
        await fetchTables();
        return result.data;
      } else {
        throw new Error(result.error || 'Failed to rename table');
      }
    } catch (err) {
      throw err;
    }
  }, [fetchTables]);

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
   * Get specific rows from Excel file for preview (header row and/or bottom rows)
   */
  const getExcelRowsPreview = useCallback(async (filePath: string, options: {
    sheetIndex?: number;
    headerRow?: number;
    bottomRowCount?: number;
  }) => {
    try {
      const result = await window.electron.invoke('user-data:get-excel-rows-preview', filePath, options);

      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error || 'Failed to read Excel file');
      }
    } catch (err) {
      throw err;
    }
  }, []);

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
      appliedSplits?: Array<{ originalColumn: string; dateColumn: string; numberColumn: string }>;
      headerRow?: number;
      skipRows?: number;
      skipBottomRows?: number;
      uniqueKeyColumns?: string[];
      duplicateAction?: 'skip' | 'update' | 'allow' | 'replace-date-range';
      addTimestamp?: boolean;
    }) => {
      try {
        console.log('[useUserData] importExcel called with columnTypes:', config.columnTypes);
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
   * Import pre-parsed island data as a new table
   */
  const importIsland = useCallback(
    async (config: {
      tableName: string;
      displayName: string;
      description?: string;
      headers: string[];
      rows: any[];
      detectedTypes: string[];
      uniqueKeyColumns?: string[];
      duplicateAction?: 'skip' | 'update' | 'allow' | 'replace-date-range';
    }) => {
      try {
        const result = await window.electron.invoke('user-data:import-island', config);

        if (result.success) {
          // Refresh tables list
          await fetchTables();
          return result.data;
        } else {
          throw new Error(result.error || 'Failed to import island');
        }
      } catch (err) {
        throw err;
      }
    },
    [fetchTables]
  );

  /**
   * Import merged islands as a single table
   */
  const importMergedIslands = useCallback(
    async (config: {
      tableName: string;
      displayName: string;
      description?: string;
      islands: any[]; // DataIsland[]
      addMetadataColumns?: boolean;
      addIslandIndex?: boolean;
      addTimestamp?: boolean;
      uniqueKeyColumns?: string[];
      duplicateAction?: 'skip' | 'update' | 'allow' | 'replace-date-range';
    }) => {
      try {
        const result = await window.electron.invoke('user-data:import-merged-islands', config);

        if (result.success) {
          // Refresh tables list
          await fetchTables();
          return result.data;
        } else {
          throw new Error(result.error || 'Failed to import merged islands');
        }
      } catch (err) {
        throw err;
      }
    },
    [fetchTables]
  );

  /**
   * Sync Excel data to existing table
   */
  const syncToExistingTable = useCallback(
    async (config: {
      filePath: string;
      sheetIndex: number;
      tableId: string;
      columnMappings: Record<string, string>;
      columnTypes?: Record<string, string>;
      mergeConfig?: Record<string, { sources: string[]; separator: string }>;
      headerRow?: number;
      skipRows?: number;
      skipBottomRows?: number;
      appliedSplits?: Array<{ originalColumn: string; dateColumn: string; numberColumn: string }>;
      uniqueKeyColumns?: string[];
      duplicateAction?: 'skip' | 'update' | 'allow' | 'replace-date-range';
      addTimestamp?: boolean;
    }) => {
      try {
        console.log('[useUserData] syncToExistingTable called with columnTypes:', config.columnTypes);
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

  /**
   * Export all tables to a single Excel file
   */
  const exportAllTables = useCallback(async () => {
    try {
      const result = await window.electron.invoke('user-data:export-all-tables');

      if (result.success) {
        return result.data;
      } else if (result.canceled) {
        return null;
      } else {
        throw new Error(result.error || 'Failed to export tables');
      }
    } catch (err) {
      throw err;
    }
  }, []);

  /**
   * Import all sheets from an Excel file as separate tables
   */
  const importAllSheets = useCallback(async (options?: { overwrite?: boolean }) => {
    try {
      const result = await window.electron.invoke('user-data:import-all-sheets', options);

      if (result.success) {
        // Refresh tables list
        await fetchTables();
        return result.data;
      } else if (result.canceled) {
        return null;
      } else {
        throw new Error(result.error || 'Failed to import sheets');
      }
    } catch (err) {
      throw err;
    }
  }, [fetchTables]);

  /**
   * Drop all tables from the database
   */
  const dropAllTables = useCallback(async () => {
    try {
      const result = await window.electron.invoke('user-data:drop-all-tables');

      if (result.success) {
        // Refresh tables list
        await fetchTables();
        return result.data;
      } else {
        throw new Error(result.error || 'Failed to drop tables');
      }
    } catch (err) {
      throw err;
    }
  }, [fetchTables]);

  /**
   * Export all tables as SQL commands
   */
  const exportSQL = useCallback(async () => {
    try {
      const result = await window.electron.invoke('user-data:export-sql');

      if (result.success) {
        return result.data;
      } else if (result.canceled) {
        return null;
      } else {
        throw new Error(result.error || 'Failed to export SQL');
      }
    } catch (err) {
      throw err;
    }
  }, []);

  /**
   * Import SQL commands from a file
   */
  const importSQL = useCallback(async () => {
    try {
      const result = await window.electron.invoke('user-data:import-sql');

      if (result.success) {
        // Refresh tables list
        await fetchTables();
        return result.data;
      } else if (result.canceled) {
        return null;
      } else {
        throw new Error(result.error || 'Failed to import SQL');
      }
    } catch (err) {
      throw err;
    }
  }, [fetchTables]);

  /**
   * Force drop ALL tables from database (including orphaned ones without metadata)
   */
  const forceDropAllTables = useCallback(async () => {
    try {
      const result = await window.electron.invoke('user-data:force-drop-all-tables');

      if (result.success) {
        // Refresh tables list
        await fetchTables();
        return result.data;
      } else {
        throw new Error(result.error || 'Failed to force drop tables');
      }
    } catch (err) {
      throw err;
    }
  }, [fetchTables]);

  // ==================== Vector Embedding Methods ====================

  /**
   * Embed table columns with progress tracking
   */
  const embedTableColumns = useCallback(
    async (
      tableId: string,
      columnNames: string[],
      onProgress?: (progress: {
        progress: number;
        total: number;
        message: string;
        estimatedCost?: number;
      }) => void
    ) => {
      try {
        // Set up progress listener
        const progressListener = (progress: any) => {
          if (onProgress) {
            onProgress(progress);
          }
        };

        // on() returns a cleanup function
        const removeListener = window.electron.ipcRenderer.on(
          'user-data:embedding-progress',
          progressListener
        );

        try {
          const result = await window.electron.invoke(
            'user-data:embed-table-columns',
            tableId,
            columnNames
          );

          if (!result.success) {
            throw new Error(result.error || 'Failed to embed columns');
          }

          return result;
        } finally {
          // Clean up listener using the cleanup function
          if (removeListener) {
            removeListener();
          }
        }
      } catch (err) {
        throw err;
      }
    },
    []
  );

  /**
   * Perform semantic search on a table
   */
  const vectorSearchTable = useCallback(
    async (
      tableId: string,
      queryText: string,
      options?: {
        limit?: number;
        threshold?: number;
        columnNames?: string[];
      }
    ): Promise<{
      rows: any[];
      total: number;
      searchResults: Array<{
        rowId: number;
        similarity: number;
        matchedColumns: string[];
      }>;
    }> => {
      try {
        const result = await window.electron.invoke(
          'user-data:vector-search-table',
          tableId,
          queryText,
          options
        );

        if (result.success) {
          return result.data;
        } else {
          throw new Error(result.error || 'Failed to perform vector search');
        }
      } catch (err) {
        throw err;
      }
    },
    []
  );

  /**
   * Get embedding statistics for a table
   */
  const getEmbeddingStats = useCallback(
    async (
      tableId: string
    ): Promise<{
      columnStats: Array<{
        columnName: string;
        totalEmbeddings: number;
        model: string;
        dimensions: number;
        lastUpdated: string;
      }>;
      totalEmbeddings: number;
      totalEstimatedCost: number;
    }> => {
      try {
        const result = await window.electron.invoke(
          'user-data:get-embedding-stats',
          tableId
        );

        if (result.success) {
          return result.data;
        } else {
          throw new Error(result.error || 'Failed to get embedding stats');
        }
      } catch (err) {
        throw err;
      }
    },
    []
  );

  /**
   * Delete embeddings for a table
   */
  const deleteEmbeddings = useCallback(
    async (tableId: string, columnNames?: string[]): Promise<number> => {
      try {
        const result = await window.electron.invoke(
          'user-data:delete-embeddings',
          tableId,
          columnNames
        );

        if (result.success) {
          return result.data.deletedCount;
        } else {
          throw new Error(result.error || 'Failed to delete embeddings');
        }
      } catch (err) {
        throw err;
      }
    },
    []
  );

  /**
   * Get list of embedded columns for a table
   */
  const getEmbeddedColumns = useCallback(async (tableId: string): Promise<string[]> => {
    try {
      const result = await window.electron.invoke(
        'user-data:get-embedded-columns',
        tableId
      );

      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error || 'Failed to get embedded columns');
      }
    } catch (err) {
      throw err;
    }
  }, []);

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
    renameTable,
    deleteTable,
    queryTable,
    searchTable,
    getExcelRowsPreview,
    parseExcel,
    importExcel,
    importIsland,
    importMergedIslands,
    selectExcelFile,
    validateTableName,
    getImportOperations,
    syncToExistingTable,
    exportAllTables,
    importAllSheets,
    dropAllTables,
    exportSQL,
    importSQL,
    forceDropAllTables,
    // Vector embedding methods
    embedTableColumns,
    vectorSearchTable,
    getEmbeddingStats,
    deleteEmbeddings,
    getEmbeddedColumns,
  };
}
