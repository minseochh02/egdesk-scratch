import Database from 'better-sqlite3';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EntityRow {
  id: string;
  type: string;
  name: string;
  raw: string | null;
  embedding: Buffer | null;
  source: string;
  confidence: number | null;
  created_at: string;
}

export interface RelationRow {
  id: string;
  from_type: string;
  from_id: string;
  to_type: string;
  to_id: string;
  relation: string;
  vector_triple: Buffer | null;
  confidence: number | null;
  source: string;
  created_at: string;
  from_name?: string;
  to_name?: string;
}

export interface SourceRegistryRow {
  id: string;
  origin: string;
  label: string;
  row_count: number;
  last_row_count: number | null;
  processed_at: string | null;
  entity_count: number;
}

export interface TagRow {
  id: string;
  doc_type: string;
  doc_id: string;
  doc_ref: string | null;
  namespace: string;
  value: string;
  entity_id: string | null;
  embedding: Buffer | null;
  confidence: number | null;
  source: string;
  created_at: string;
}

// ─── Manager ──────────────────────────────────────────────────────────────────

export class NeuronDbManager {
  constructor(private db: Database.Database) {}

  // ── Entities ──────────────────────────────────────────────────────────────

  getEntities(types?: string[]): EntityRow[] {
    if (types && types.length > 0) {
      const placeholders = types.map(() => '?').join(', ');
      return this.db
        .prepare(`SELECT * FROM entities WHERE type IN (${placeholders}) ORDER BY name`)
        .all(...types) as EntityRow[];
    }
    return this.db.prepare('SELECT * FROM entities ORDER BY name').all() as EntityRow[];
  }

  createEntity(data: {
    id: string;
    type: string;
    name: string;
    raw?: string | null;
    source: string;
    confidence?: number | null;
  }): EntityRow {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO entities (id, type, name, raw, embedding, source, confidence, created_at)
         VALUES (?, ?, ?, ?, NULL, ?, ?, ?)`
      )
      .run(data.id, data.type, data.name, data.raw ?? null, data.source, data.confidence ?? null, now);
    return this.db.prepare('SELECT * FROM entities WHERE id = ?').get(data.id) as EntityRow;
  }

  updateEntity(
    id: string,
    data: { name?: string; raw?: string | null; confidence?: number | null }
  ): boolean {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.raw !== undefined)  { fields.push('raw = ?');  values.push(data.raw);  }
    if (data.confidence !== undefined) { fields.push('confidence = ?'); values.push(data.confidence); }

    if (fields.length === 0) return false;
    values.push(id);

    const result = this.db
      .prepare(`UPDATE entities SET ${fields.join(', ')} WHERE id = ?`)
      .run(...values);
    return result.changes > 0;
  }

  deleteEntity(id: string): boolean {
    const result = this.db.prepare('DELETE FROM entities WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // ── Relations ─────────────────────────────────────────────────────────────

  getRelations(fromId?: string): RelationRow[] {
    const sql = `
      SELECT dr.*,
             e1.name AS from_name,
             e2.name AS to_name
      FROM document_relations dr
      LEFT JOIN entities e1 ON e1.id = dr.from_id
      LEFT JOIN entities e2 ON e2.id = dr.to_id
      ${fromId ? 'WHERE dr.from_id = ? OR dr.to_id = ?' : ''}
      ORDER BY dr.created_at
    `;
    if (fromId) {
      return this.db.prepare(sql).all(fromId, fromId) as RelationRow[];
    }
    return this.db.prepare(sql).all() as RelationRow[];
  }

  createRelation(data: {
    id: string;
    from_type: string;
    from_id: string;
    to_type: string;
    to_id: string;
    relation: string;
    source: string;
    confidence?: number | null;
  }): RelationRow {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO document_relations
           (id, from_type, from_id, to_type, to_id, relation, vector_triple, confidence, source, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`
      )
      .run(
        data.id, data.from_type, data.from_id,
        data.to_type, data.to_id, data.relation,
        data.confidence ?? null, data.source, now
      );
    return this.db
      .prepare('SELECT * FROM document_relations WHERE id = ?')
      .get(data.id) as RelationRow;
  }

  deleteRelation(id: string): boolean {
    const result = this.db.prepare('DELETE FROM document_relations WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // ── Tags ──────────────────────────────────────────────────────────────────

  getTags(entityId?: string): TagRow[] {
    if (entityId) {
      return this.db
        .prepare('SELECT * FROM tags WHERE entity_id = ? ORDER BY created_at')
        .all(entityId) as TagRow[];
    }
    return this.db.prepare('SELECT * FROM tags ORDER BY created_at').all() as TagRow[];
  }

  createTag(data: {
    id: string;
    doc_type: string;
    doc_id: string;
    doc_ref?: string | null;
    namespace: string;
    value: string;
    entity_id?: string | null;
    source: string;
    confidence?: number | null;
  }): TagRow {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO tags
           (id, doc_type, doc_id, doc_ref, namespace, value, entity_id, embedding, confidence, source, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`
      )
      .run(
        data.id, data.doc_type, data.doc_id, data.doc_ref ?? null,
        data.namespace, data.value, data.entity_id ?? null,
        data.confidence ?? null, data.source, now
      );
    return this.db.prepare('SELECT * FROM tags WHERE id = ?').get(data.id) as TagRow;
  }

  deleteTag(id: string): boolean {
    const result = this.db.prepare('DELETE FROM tags WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // ── Source Registry ───────────────────────────────────────────────────────

  getSourceRegistry(): SourceRegistryRow[] {
    return this.db
      .prepare('SELECT * FROM source_registry ORDER BY origin, label')
      .all() as SourceRegistryRow[];
  }

  upsertSourceRegistry(data: {
    id: string;
    origin: string;
    label: string;
    row_count: number;
    last_row_count?: number | null;
    processed_at?: string | null;
    entity_count?: number;
  }): SourceRegistryRow {
    this.db
      .prepare(
        `INSERT INTO source_registry (id, origin, label, row_count, last_row_count, processed_at, entity_count)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           label         = excluded.label,
           row_count     = excluded.row_count,
           last_row_count = COALESCE(excluded.last_row_count, last_row_count),
           processed_at  = COALESCE(excluded.processed_at, processed_at),
           entity_count  = COALESCE(excluded.entity_count, entity_count)`
      )
      .run(
        data.id,
        data.origin,
        data.label,
        data.row_count,
        data.last_row_count ?? null,
        data.processed_at ?? null,
        data.entity_count ?? 0,
      );
    return this.db
      .prepare('SELECT * FROM source_registry WHERE id = ?')
      .get(data.id) as SourceRegistryRow;
  }

}
