import { useState, useEffect, useCallback } from 'react';

// Raw DB row shapes (mirrored from neuron-db.ts — no main-process import)
interface EntityRow {
  id: string;
  type: string;
  name: string;
  raw: string | null;
  source: string;
  confidence: number | null;
  created_at: string;
}

interface RelationRow {
  id: string;
  from_type: string;
  from_id: string;
  to_type: string;
  to_id: string;
  relation: string;
  confidence: number | null;
  source: string;
  created_at: string;
}

export interface TagRow {
  id: string;
  doc_type: string;
  doc_id: string;
  doc_ref: string | null;
  namespace: string;
  value: string;
  entity_id: string | null;
  confidence: number | null;
  source: string;
  created_at: string;
}

/**
 * Normalized shapes used by NeuronLayer.tsx
 */
export interface NeuronNode {
  id: string;
  name: string;
  type: string;
  tables: string[];
  rowCount: number;
}

export interface NeuronLink {
  source: string;
  target: string;
  label: string;
}

function rowToNode(row: EntityRow): NeuronNode {
  let tables: string[] = [];
  let rowCount = 0;
  try {
    const parsed = row.raw ? JSON.parse(row.raw) : null;
    tables   = parsed?.tables   ?? [];
    rowCount = parsed?.rowCount ?? 0;
  } catch {
    // malformed JSON — keep defaults
  }
  return { id: row.id, name: row.name, type: row.type, tables, rowCount };
}

function rowToLink(row: RelationRow): NeuronLink {
  return { source: row.from_id, target: row.to_id, label: row.relation };
}

export function useNeuronData() {
  const [entities,  setEntities]  = useState<NeuronNode[]>([]);
  const [relations, setRelations] = useState<NeuronLink[]>([]);
  const [tags,      setTags]      = useState<TagRow[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [entResult, relResult, tagResult] = await Promise.all([
        window.electron.invoke('neuron:get-entities'),
        window.electron.invoke('neuron:get-relations'),
        window.electron.invoke('neuron:get-tags'),
      ]);

      if (!entResult.success) throw new Error(entResult.error ?? 'Failed to fetch entities');
      if (!relResult.success) throw new Error(relResult.error ?? 'Failed to fetch relations');
      if (!tagResult.success) throw new Error(tagResult.error ?? 'Failed to fetch tags');

      setEntities((entResult.data as EntityRow[]).map(rowToNode));
      setRelations((relResult.data as RelationRow[]).map(rowToLink));
      setTags(tagResult.data as TagRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch on mount
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const createEntity = useCallback(async (data: Parameters<typeof window.electron.invoke>[1]) => {
    const result = await window.electron.invoke('neuron:create-entity', data);
    if (result.success) await fetchAll();
    return result;
  }, [fetchAll]);

  const deleteEntity = useCallback(async (id: string) => {
    const result = await window.electron.invoke('neuron:delete-entity', id);
    if (result.success) await fetchAll();
    return result;
  }, [fetchAll]);

  const createRelation = useCallback(async (data: Parameters<typeof window.electron.invoke>[1]) => {
    const result = await window.electron.invoke('neuron:create-relation', data);
    if (result.success) await fetchAll();
    return result;
  }, [fetchAll]);

  const deleteRelation = useCallback(async (id: string) => {
    const result = await window.electron.invoke('neuron:delete-relation', id);
    if (result.success) await fetchAll();
    return result;
  }, [fetchAll]);

  return {
    entities,
    relations,
    tags,
    loading,
    error,
    fetchAll,
    createEntity,
    deleteEntity,
    createRelation,
    deleteRelation,
  };
}
