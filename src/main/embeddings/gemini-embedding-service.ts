/**
 * Gemini Embedding Service
 * Generate text embeddings using Google's Gemini API for semantic search
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getGoogleApiKey } from '../gemini';

export interface EmbeddingOptions {
  model?: string;  // Default: 'gemini-embedding-001'
  taskType?: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT' | 'SEMANTIC_SIMILARITY';
  title?: string;  // Optional title for document embeddings
}

export interface EmbeddingResult {
  embedding: number[];
  dimensions: number;
  model: string;
}

export class GeminiEmbeddingService {
  private genAI: GoogleGenerativeAI;
  private model: string;

  constructor(apiKey?: string) {
    const key = apiKey || getGoogleApiKey().apiKey;
    if (!key) {
      throw new Error('No Google API key available for embedding service');
    }
    this.genAI = new GoogleGenerativeAI(key);
    // Use gemini-embedding-001 - the official Gemini API embedding model
    // Supports multilingual content including Korean
    this.model = 'gemini-embedding-001';
  }

  /**
   * Generate embedding for a single text
   */
  async embedText(
    text: string,
    options?: EmbeddingOptions
  ): Promise<EmbeddingResult> {
    if (!text || typeof text !== 'string' || !text.trim()) {
      throw new Error('Text is required for embedding generation');
    }

    const model = this.genAI.getGenerativeModel({
      model: options?.model || this.model
    });

    const result = await model.embedContent({
      content: { parts: [{ text: text.trim() }] },
      taskType: options?.taskType || 'RETRIEVAL_DOCUMENT',
      title: options?.title
    } as any);

    return {
      embedding: result.embedding.values,
      dimensions: result.embedding.values.length,
      model: options?.model || this.model
    };
  }

  /**
   * Batch generate embeddings for multiple texts
   */
  async embedBatch(
    texts: string[],
    options?: EmbeddingOptions
  ): Promise<EmbeddingResult[]> {
    if (!Array.isArray(texts) || texts.length === 0) {
      throw new Error('Texts array is required for batch embedding generation');
    }

    const model = this.genAI.getGenerativeModel({
      model: options?.model || this.model
    });

    const requests = texts.map(text => ({
      content: { parts: [{ text: text.trim() }] },
      taskType: options?.taskType || 'RETRIEVAL_DOCUMENT',
      title: options?.title
    }));

    const result = await model.batchEmbedContents({
      requests
    } as any);

    return result.embeddings.map((emb: any) => ({
      embedding: emb.values,
      dimensions: emb.values.length,
      model: options?.model || this.model
    }));
  }

  /**
   * Generate query embedding (optimized for search)
   */
  async embedQuery(query: string): Promise<EmbeddingResult> {
    return this.embedText(query, {
      taskType: 'RETRIEVAL_QUERY'
    });
  }
}

// Singleton instance
let embeddingService: GeminiEmbeddingService | null = null;

export function getEmbeddingService(apiKey?: string): GeminiEmbeddingService {
  if (!embeddingService || apiKey) {
    embeddingService = new GeminiEmbeddingService(apiKey);
  }
  return embeddingService;
}
