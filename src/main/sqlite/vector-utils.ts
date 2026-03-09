/**
 * Convert an array of numbers to a Buffer for storage in SQLite
 * Embeddings are stored as float32 arrays
 * @param embedding - Array of numbers representing the embedding
 * @returns Buffer containing the serialized embedding
 */
export function serializeEmbedding(embedding: number[]): Buffer {
  const buffer = Buffer.allocUnsafe(embedding.length * 4); // 4 bytes per float32
  for (let i = 0; i < embedding.length; i++) {
    buffer.writeFloatLE(embedding[i], i * 4);
  }
  return buffer;
}

/**
 * Convert a Buffer back to an array of numbers
 * @param buffer - Buffer containing the serialized embedding
 * @returns Array of numbers representing the embedding
 */
export function deserializeEmbedding(buffer: Buffer): number[] {
  const embedding: number[] = [];
  for (let i = 0; i < buffer.length; i += 4) {
    embedding.push(buffer.readFloatLE(i));
  }
  return embedding;
}

/**
 * Validate that an embedding has the expected dimensions
 * @param embedding - Array of numbers representing the embedding
 * @param expectedDims - Expected number of dimensions
 * @returns true if valid, false otherwise
 */
export function validateEmbedding(embedding: number[], expectedDims: number): boolean {
  if (!Array.isArray(embedding)) {
    return false;
  }
  if (embedding.length !== expectedDims) {
    return false;
  }
  // Check that all values are valid numbers
  return embedding.every((val) => typeof val === 'number' && !Number.isNaN(val) && Number.isFinite(val));
}

/**
 * Calculate cosine similarity between two embeddings
 * Returns a value between -1 and 1, where 1 means identical
 * @param a - First embedding
 * @param b - Second embedding
 * @returns Cosine similarity score
 */
export function calculateCosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have the same dimensions');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) {
    return 0;
  }

  return dotProduct / magnitude;
}

/**
 * Calculate L2 (Euclidean) distance between two embeddings
 * Lower values indicate more similarity
 * @param a - First embedding
 * @param b - Second embedding
 * @returns L2 distance
 */
export function calculateL2Distance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have the same dimensions');
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}
