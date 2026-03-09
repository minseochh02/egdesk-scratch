import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { serializeEmbedding, deserializeEmbedding, validateEmbedding } from './vector-utils';

export interface EmbeddingData {
  messageId: string;
  conversationId: string;
  embedding: number[];
  model: string;
  dimensions?: number;
}

export interface Embedding {
  id: string;
  messageId: string;
  conversationId: string;
  embeddingModel: string;
  embeddingDimensions: number;
  embedding: number[];
  createdAt: string;
  updatedAt: string;
}

export interface SearchResult {
  messageId: string;
  conversationId: string;
  content: string;
  similarity: number;
  timestamp?: string;
}

export interface SearchOptions {
  embedding: number[];
  limit?: number;
  threshold?: number;
  conversationId?: string;
}

export interface VectorStats {
  totalEmbeddings: number;
  model: string | null;
  dimensions: number | null;
  lastUpdated: string | null;
}

/**
 * VectorDbManager - High-level API for vector operations
 *
 * Provides semantic search and embedding storage capabilities
 * using sqlite-vec extension.
 */
export class VectorDbManager {
  constructor(private db: Database.Database) {}

  /**
   * Insert a single embedding for a message
   * @param data - Embedding data including message ID, conversation ID, embedding array, and model
   * @returns The ID of the created embedding record
   */
  insertEmbedding(data: EmbeddingData): string {
    const { messageId, conversationId, embedding, model, dimensions } = data;
    const embeddingDimensions = dimensions || embedding.length;

    // Validate embedding
    if (!validateEmbedding(embedding, embeddingDimensions)) {
      throw new Error(
        `Invalid embedding: expected ${embeddingDimensions} dimensions, got ${embedding.length}`
      );
    }

    const id = uuidv4();
    const serialized = serializeEmbedding(embedding);

    const stmt = this.db.prepare(`
      INSERT INTO message_embeddings (
        id, message_id, conversation_id, embedding_model,
        embedding_dimensions, embedding
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, messageId, conversationId, model, embeddingDimensions, serialized);

    // Update metadata
    this.updateMetadata(model, embeddingDimensions);

    return id;
  }

  /**
   * Bulk insert embeddings (more efficient for multiple inserts)
   * @param embeddings - Array of embedding data
   * @returns Number of embeddings inserted
   */
  bulkInsertEmbeddings(embeddings: EmbeddingData[]): number {
    if (embeddings.length === 0) return 0;

    const stmt = this.db.prepare(`
      INSERT INTO message_embeddings (
        id, message_id, conversation_id, embedding_model,
        embedding_dimensions, embedding
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((items: EmbeddingData[]) => {
      for (const data of items) {
        const { messageId, conversationId, embedding, model, dimensions } = data;
        const embeddingDimensions = dimensions || embedding.length;

        if (!validateEmbedding(embedding, embeddingDimensions)) {
          console.warn(`Skipping invalid embedding for message ${messageId}`);
          continue;
        }

        const id = uuidv4();
        const serialized = serializeEmbedding(embedding);
        stmt.run(id, messageId, conversationId, model, embeddingDimensions, serialized);
      }
    });

    insertMany(embeddings);

    // Update metadata with the first embedding's model and dimensions
    if (embeddings.length > 0) {
      const firstEmbedding = embeddings[0];
      const dimensions = firstEmbedding.dimensions || firstEmbedding.embedding.length;
      this.updateMetadata(firstEmbedding.model, dimensions);
    }

    return embeddings.length;
  }

  /**
   * Search for similar messages using vector similarity
   * @param options - Search options including embedding, limit, threshold, and optional conversation filter
   * @returns Array of search results with similarity scores
   */
  searchSimilar(options: SearchOptions): SearchResult[] {
    const { embedding, limit = 10, threshold = 0.7, conversationId } = options;

    const serialized = serializeEmbedding(embedding);

    let query = `
      SELECT
        me.message_id as messageId,
        me.conversation_id as conversationId,
        m.content,
        m.timestamp,
        1 - vec_distance_cosine(me.embedding, ?) as similarity
      FROM message_embeddings me
      JOIN messages m ON me.message_id = m.id
      WHERE 1 - vec_distance_cosine(me.embedding, ?) >= ?
    `;

    const params: any[] = [serialized, serialized, threshold];

    // Filter by conversation if specified
    if (conversationId) {
      query += ' AND me.conversation_id = ?';
      params.push(conversationId);
    }

    query += ' ORDER BY similarity DESC LIMIT ?';
    params.push(limit);

    const stmt = this.db.prepare(query);
    const results = stmt.all(...params) as SearchResult[];

    return results;
  }

  /**
   * Get embedding for a specific message
   * @param messageId - The message ID
   * @returns The embedding record or null if not found
   */
  getEmbedding(messageId: string): Embedding | null {
    const stmt = this.db.prepare(`
      SELECT
        id,
        message_id as messageId,
        conversation_id as conversationId,
        embedding_model as embeddingModel,
        embedding_dimensions as embeddingDimensions,
        embedding,
        created_at as createdAt,
        updated_at as updatedAt
      FROM message_embeddings
      WHERE message_id = ?
    `);

    const row = stmt.get(messageId) as any;

    if (!row) return null;

    return {
      ...row,
      embedding: deserializeEmbedding(row.embedding),
    };
  }

  /**
   * Delete embedding for a message
   * @param messageId - The message ID
   * @returns true if deleted, false if not found
   */
  deleteEmbedding(messageId: string): boolean {
    const stmt = this.db.prepare('DELETE FROM message_embeddings WHERE message_id = ?');
    const result = stmt.run(messageId);
    return result.changes > 0;
  }

  /**
   * Delete all embeddings for a conversation
   * @param conversationId - The conversation ID
   * @returns Number of embeddings deleted
   */
  deleteConversationEmbeddings(conversationId: string): number {
    const stmt = this.db.prepare('DELETE FROM message_embeddings WHERE conversation_id = ?');
    const result = stmt.run(conversationId);
    return result.changes;
  }

  /**
   * Get embedding statistics
   * @returns Statistics about stored embeddings
   */
  getStats(): VectorStats {
    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) as totalEmbeddings,
        embedding_model as model,
        embedding_dimensions as dimensions,
        MAX(updated_at) as lastUpdated
      FROM message_embeddings
      GROUP BY embedding_model, embedding_dimensions
      ORDER BY COUNT(*) DESC
      LIMIT 1
    `);

    const row = stmt.get() as any;

    if (!row || row.totalEmbeddings === 0) {
      return {
        totalEmbeddings: 0,
        model: null,
        dimensions: null,
        lastUpdated: null,
      };
    }

    return {
      totalEmbeddings: row.totalEmbeddings,
      model: row.model,
      dimensions: row.dimensions,
      lastUpdated: row.lastUpdated,
    };
  }

  /**
   * Check if an embedding exists for a message
   * @param messageId - The message ID
   * @returns true if embedding exists
   */
  hasEmbedding(messageId: string): boolean {
    const stmt = this.db.prepare(
      'SELECT 1 FROM message_embeddings WHERE message_id = ? LIMIT 1'
    );
    const row = stmt.get(messageId);
    return !!row;
  }

  /**
   * Update metadata table with current embedding information
   * @private
   */
  private updateMetadata(model: string, dimensions: number): void {
    const stmt = this.db.prepare(`
      INSERT INTO embedding_metadata (
        id, database_name, table_name, total_embeddings,
        embedding_model, embedding_dimensions, last_updated
      )
      VALUES (?, 'conversations', 'message_embeddings',
        (SELECT COUNT(*) FROM message_embeddings), ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(database_name, table_name)
      DO UPDATE SET
        total_embeddings = (SELECT COUNT(*) FROM message_embeddings),
        embedding_model = ?,
        embedding_dimensions = ?,
        last_updated = CURRENT_TIMESTAMP
    `);

    stmt.run(uuidv4(), model, dimensions, model, dimensions);
  }
}
