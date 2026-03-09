import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
  serializeEmbedding,
  deserializeEmbedding,
  validateEmbedding,
} from './vector-utils';

export interface UserDataEmbeddingData {
  tableId: string;
  rowId: number;
  columnName: string;
  embedding: number[];
  model: string;
  dimensions?: number;
}

export interface UserDataEmbedding {
  id: string;
  tableId: string;
  rowId: number;
  columnName: string;
  embeddingModel: string;
  embeddingDimensions: number;
  embedding: number[];
  createdAt: string;
  updatedAt: string;
}

export interface UserDataSearchResult {
  rowId: number;
  columnName: string;
  similarity: number;
}

export interface UserDataSearchOptions {
  embedding: number[];
  limit?: number;
  threshold?: number;
  columnNames?: string[];
}

export interface UserDataColumnStats {
  columnName: string;
  totalEmbeddings: number;
  model: string;
  dimensions: number;
  lastUpdated: string;
}

export interface UserDataEmbeddingStats {
  columnStats: UserDataColumnStats[];
  totalEmbeddings: number;
  totalEstimatedCost: number;
}

/**
 * UserDataVectorManager - High-level API for user data vector operations
 *
 * Provides semantic search and embedding storage capabilities for user-defined tables
 * using sqlite-vec extension.
 */
export class UserDataVectorManager {
  constructor(private db: Database.Database) {}

  /**
   * Bulk insert embeddings (more efficient for multiple inserts)
   * @param embeddings - Array of embedding data
   * @returns Number of embeddings inserted
   */
  bulkInsertEmbeddings(embeddings: UserDataEmbeddingData[]): number {
    if (embeddings.length === 0) return 0;

    const stmt = this.db.prepare(`
      INSERT INTO user_data_embeddings (
        id, table_id, row_id, column_name, embedding_model,
        embedding_dimensions, embedding
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(table_id, row_id, column_name)
      DO UPDATE SET
        embedding_model = excluded.embedding_model,
        embedding_dimensions = excluded.embedding_dimensions,
        embedding = excluded.embedding,
        updated_at = CURRENT_TIMESTAMP
    `);

    const insertMany = this.db.transaction((items: UserDataEmbeddingData[]) => {
      for (const data of items) {
        const { tableId, rowId, columnName, embedding, model, dimensions } =
          data;
        const embeddingDimensions = dimensions || embedding.length;

        if (!validateEmbedding(embedding, embeddingDimensions)) {
          console.warn(
            `Skipping invalid embedding for table ${tableId}, row ${rowId}, column ${columnName}`
          );
          continue;
        }

        const id = uuidv4();
        const serialized = serializeEmbedding(embedding);
        stmt.run(
          id,
          tableId,
          rowId,
          columnName,
          model,
          embeddingDimensions,
          serialized
        );
      }
    });

    insertMany(embeddings);

    return embeddings.length;
  }

  /**
   * Search for similar rows using vector similarity
   * @param tableId - The table ID to search within
   * @param options - Search options including embedding, limit, threshold, and optional column filter
   * @returns Array of search results with similarity scores
   */
  searchSimilar(
    tableId: string,
    options: UserDataSearchOptions
  ): UserDataSearchResult[] {
    const {
      embedding,
      limit = 10,
      threshold = 0.7,
      columnNames,
    } = options;

    const serialized = serializeEmbedding(embedding);

    let query = `
      SELECT
        row_id as rowId,
        column_name as columnName,
        1 - vec_distance_cosine(embedding, ?) as similarity
      FROM user_data_embeddings
      WHERE table_id = ?
        AND 1 - vec_distance_cosine(embedding, ?) >= ?
    `;

    const params: any[] = [serialized, tableId, serialized, threshold];

    // Filter by columns if specified
    if (columnNames && columnNames.length > 0) {
      const placeholders = columnNames.map(() => '?').join(',');
      query += ` AND column_name IN (${placeholders})`;
      params.push(...columnNames);
    }

    query += ' ORDER BY similarity DESC LIMIT ?';
    params.push(limit);

    const stmt = this.db.prepare(query);
    const results = stmt.all(...params) as UserDataSearchResult[];

    return results;
  }

  /**
   * Get embedding statistics for a table
   * @param tableId - The table ID
   * @returns Statistics about stored embeddings per column
   */
  getEmbeddingStats(tableId: string): UserDataEmbeddingStats {
    // Get stats per column
    const columnStatsStmt = this.db.prepare(`
      SELECT
        column_name as columnName,
        total_embeddings as totalEmbeddings,
        embedding_model as model,
        embedding_dimensions as dimensions,
        last_updated as lastUpdated,
        estimated_cost_usd as estimatedCost
      FROM user_data_embedding_metadata
      WHERE table_id = ?
      ORDER BY column_name
    `);

    const columnStats = columnStatsStmt.all(tableId) as any[];

    // Calculate totals
    const totalEmbeddings = columnStats.reduce(
      (sum, stat) => sum + stat.totalEmbeddings,
      0
    );
    const totalEstimatedCost = columnStats.reduce(
      (sum, stat) => sum + (stat.estimatedCost || 0),
      0
    );

    return {
      columnStats: columnStats.map((stat) => ({
        columnName: stat.columnName,
        totalEmbeddings: stat.totalEmbeddings,
        model: stat.model,
        dimensions: stat.dimensions,
        lastUpdated: stat.lastUpdated,
      })),
      totalEmbeddings,
      totalEstimatedCost,
    };
  }

  /**
   * Delete embeddings for a table
   * @param tableId - The table ID
   * @param columnNames - Optional array of column names to delete (if not provided, deletes all)
   * @returns Number of embeddings deleted
   */
  deleteEmbeddings(tableId: string, columnNames?: string[]): number {
    if (columnNames && columnNames.length > 0) {
      const placeholders = columnNames.map(() => '?').join(',');
      const stmt = this.db.prepare(
        `DELETE FROM user_data_embeddings WHERE table_id = ? AND column_name IN (${placeholders})`
      );
      const result = stmt.run(tableId, ...columnNames);

      // Delete metadata for these columns
      const metaStmt = this.db.prepare(
        `DELETE FROM user_data_embedding_metadata WHERE table_id = ? AND column_name IN (${placeholders})`
      );
      metaStmt.run(tableId, ...columnNames);

      return result.changes;
    } else {
      const stmt = this.db.prepare(
        'DELETE FROM user_data_embeddings WHERE table_id = ?'
      );
      const result = stmt.run(tableId);

      // Delete all metadata for this table
      const metaStmt = this.db.prepare(
        'DELETE FROM user_data_embedding_metadata WHERE table_id = ?'
      );
      metaStmt.run(tableId);

      return result.changes;
    }
  }

  /**
   * Get list of embedded columns for a table
   * @param tableId - The table ID
   * @returns Array of column names that have embeddings
   */
  getEmbeddedColumns(tableId: string): string[] {
    const stmt = this.db.prepare(`
      SELECT DISTINCT column_name
      FROM user_data_embeddings
      WHERE table_id = ?
      ORDER BY column_name
    `);

    const rows = stmt.all(tableId) as any[];
    return rows.map((row) => row.column_name);
  }

  /**
   * Update metadata table with embedding information for a column
   * @param tableId - The table ID
   * @param columnName - The column name
   * @param model - The embedding model used
   * @param dimensions - The embedding dimensions
   * @param estimatedCost - The estimated cost in USD
   */
  updateMetadata(
    tableId: string,
    columnName: string,
    model: string,
    dimensions: number,
    estimatedCost: number
  ): void {
    const countStmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM user_data_embeddings
      WHERE table_id = ? AND column_name = ?
    `);
    const countRow = countStmt.get(tableId, columnName) as any;
    const totalEmbeddings = countRow.count;

    const stmt = this.db.prepare(`
      INSERT INTO user_data_embedding_metadata (
        id, table_id, column_name, total_embeddings,
        embedding_model, embedding_dimensions, estimated_cost_usd, last_updated
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(table_id, column_name)
      DO UPDATE SET
        total_embeddings = excluded.total_embeddings,
        embedding_model = excluded.embedding_model,
        embedding_dimensions = excluded.embedding_dimensions,
        estimated_cost_usd = excluded.estimated_cost_usd,
        last_updated = CURRENT_TIMESTAMP
    `);

    stmt.run(
      uuidv4(),
      tableId,
      columnName,
      totalEmbeddings,
      model,
      dimensions,
      estimatedCost
    );
  }

  /**
   * Check if a table has any embeddings
   * @param tableId - The table ID
   * @returns true if table has embeddings
   */
  hasEmbeddings(tableId: string): boolean {
    const stmt = this.db.prepare(
      'SELECT 1 FROM user_data_embeddings WHERE table_id = ? LIMIT 1'
    );
    const row = stmt.get(tableId);
    return !!row;
  }
}
