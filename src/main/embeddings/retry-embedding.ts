/**
 * Retry wrapper for embedding service
 * Reuses existing retry logic from ai-blog/retry.ts
 */

import retryWithBackoff from '../ai-blog/retry';
import { GeminiEmbeddingService, EmbeddingOptions, EmbeddingResult } from './gemini-embedding-service';

/**
 * Embed text with retry logic
 */
export async function embedTextWithRetry(
  service: GeminiEmbeddingService,
  text: string,
  options?: EmbeddingOptions,
  maxRetries = 3
): Promise<EmbeddingResult> {
  return retryWithBackoff(
    () => service.embedText(text, options),
    maxRetries,
    1000
  );
}

/**
 * Batch embed texts with retry logic
 */
export async function embedBatchWithRetry(
  service: GeminiEmbeddingService,
  texts: string[],
  options?: EmbeddingOptions,
  maxRetries = 3
): Promise<EmbeddingResult[]> {
  return retryWithBackoff(
    () => service.embedBatch(texts, options),
    maxRetries,
    1000
  );
}
