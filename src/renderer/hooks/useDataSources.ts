import { useState, useEffect, useCallback } from 'react';

export interface DataSource {
  id: string;
  origin: 'userdata' | 'financehub' | 'businessidentity' | 'companyresearch';
  group?: string;       // when set, items with the same group render as their own section
  groupLabel?: string;  // display title for the group section
  label: string;
  sublabel: string;
  rowCount: number;
  processedAt: string | null;
  lastRowCount: number | null;
  entityCount: number;
}

export type ProcessingState = 'never' | 'processed' | 'stale';

export function getProcessingState(source: DataSource): ProcessingState {
  if (!source.processedAt) return 'never';
  if (source.lastRowCount !== null && source.lastRowCount !== source.rowCount) return 'stale';
  return 'processed';
}

interface UseDataSourcesResult {
  sources: DataSource[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useDataSources(): UseDataSourcesResult {
  const [sources, setSources]   = useState<DataSource[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const fetchSources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await (window as any).electron.invoke('neuron:get-data-sources');
      if (result.success) {
        setSources(result.data as DataSource[]);
      } else {
        setError(result.error ?? 'Failed to load data sources');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data sources');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSources(); }, [fetchSources]);

  return { sources, loading, error, refetch: fetchSources };
}
