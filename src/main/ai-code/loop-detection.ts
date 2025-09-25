/**
 * Loop Detection Service
 * Prevents infinite tool calling loops in autonomous AI conversations
 * Based on Gemini CLI patterns
 */

import type { ToolCallRequestInfo, LoopDetectionState } from '../types/ai-types';

export class LoopDetectionService {
  private state: LoopDetectionState = {
    recentToolCalls: [],
    recentResponses: [],
    patternThreshold: 3,
    enabled: true
  };

  private readonly MAX_HISTORY = 20;
  private readonly SIMILARITY_THRESHOLD = 0.8;

  /**
   * Check if a tool call would create a loop
   */
  checkToolCallLoop(toolCall: ToolCallRequestInfo): boolean {
    if (!this.state.enabled) return false;

    const callSignature = this.getToolCallSignature(toolCall);
    this.state.recentToolCalls.push(callSignature);

    // Keep only recent history
    if (this.state.recentToolCalls.length > this.MAX_HISTORY) {
      this.state.recentToolCalls.shift();
    }

    return this.detectPattern(this.state.recentToolCalls);
  }

  /**
   * Check if AI responses show repetitive patterns
   */
  checkResponseLoop(response: string): boolean {
    if (!this.state.enabled) return false;

    const responseSignature = this.getResponseSignature(response);
    this.state.recentResponses.push(responseSignature);

    // Keep only recent history
    if (this.state.recentResponses.length > this.MAX_HISTORY) {
      this.state.recentResponses.shift();
    }

    return this.detectPattern(this.state.recentResponses);
  }

  /**
   * Reset loop detection state
   */
  reset(): void {
    this.state.recentToolCalls = [];
    this.state.recentResponses = [];
  }

  /**
   * Enable or disable loop detection
   */
  setEnabled(enabled: boolean): void {
    this.state.enabled = enabled;
  }

  /**
   * Get current loop detection state
   */
  getState(): LoopDetectionState {
    return { ...this.state };
  }

  /**
   * Create a signature for a tool call
   */
  private getToolCallSignature(toolCall: ToolCallRequestInfo): string {
    // Create a simplified signature based on tool name and key parameters
    const keyParams = this.extractKeyParameters(toolCall.parameters);
    return `${toolCall.name}(${JSON.stringify(keyParams)})`;
  }

  /**
   * Create a signature for an AI response
   */
  private getResponseSignature(response: string): string {
    // Normalize and truncate response for pattern detection
    const normalized = response
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim();
    
    // Take first and last 50 characters for signature
    if (normalized.length > 100) {
      return normalized.substring(0, 50) + '...' + normalized.substring(normalized.length - 50);
    }
    
    return normalized;
  }

  /**
   * Extract key parameters from tool call parameters
   */
  private extractKeyParameters(params: Record<string, any>): Record<string, any> {
    const keyParams: Record<string, any> = {};
    
    // Extract only the most relevant parameters to avoid false positives
    const relevantKeys = ['filePath', 'command', 'query', 'path', 'name', 'id'];
    
    for (const key of relevantKeys) {
      if (params[key] !== undefined) {
        keyParams[key] = params[key];
      }
    }

    return keyParams;
  }

  /**
   * Detect repetitive patterns in an array of signatures
   */
  private detectPattern(signatures: string[]): boolean {
    if (signatures.length < this.state.patternThreshold) return false;

    // Check for exact repetitions
    const recentSignatures = signatures.slice(-this.state.patternThreshold);
    const uniqueSignatures = new Set(recentSignatures);
    
    if (uniqueSignatures.size === 1) {
      console.warn('🔄 Loop detected: Exact repetition pattern');
      return true;
    }

    // Check for alternating patterns (A-B-A-B)
    if (this.detectAlternatingPattern(signatures)) {
      console.warn('🔄 Loop detected: Alternating pattern');
      return true;
    }

    // Check for similar patterns with slight variations
    if (this.detectSimilarPattern(signatures)) {
      console.warn('🔄 Loop detected: Similar pattern with variations');
      return true;
    }

    return false;
  }

  /**
   * Detect alternating patterns like A-B-A-B
   */
  private detectAlternatingPattern(signatures: string[]): boolean {
    if (signatures.length < 4) return false;

    const recent = signatures.slice(-4);
    return recent[0] === recent[2] && recent[1] === recent[3] && recent[0] !== recent[1];
  }

  /**
   * Detect similar patterns with slight variations
   */
  private detectSimilarPattern(signatures: string[]): boolean {
    if (signatures.length < this.state.patternThreshold) return false;

    const recent = signatures.slice(-this.state.patternThreshold);
    
    // Check if all recent signatures are similar to each other
    for (let i = 0; i < recent.length - 1; i++) {
      for (let j = i + 1; j < recent.length; j++) {
        const similarity = this.calculateSimilarity(recent[i], recent[j]);
        if (similarity < this.SIMILARITY_THRESHOLD) {
          return false; // Not similar enough
        }
      }
    }

    return true; // All signatures are similar
  }

  /**
   * Calculate similarity between two strings (0 = completely different, 1 = identical)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;

    // Use Levenshtein distance for similarity calculation
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    const maxLength = Math.max(str1.length, str2.length);
    const distance = matrix[str2.length][str1.length];
    
    return 1 - (distance / maxLength);
  }

  /**
   * Analyze conversation history for potential loops using heuristics
   */
  analyzeConversationHealth(toolCalls: ToolCallRequestInfo[], responses: string[]): {
    isHealthy: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check tool call frequency
    const recentToolCalls = toolCalls.slice(-10);
    const toolCallFrequency = new Map<string, number>();
    
    for (const toolCall of recentToolCalls) {
      const count = toolCallFrequency.get(toolCall.name) || 0;
      toolCallFrequency.set(toolCall.name, count + 1);
    }

    // Flag tools called too frequently
    for (const [toolName, count] of toolCallFrequency.entries()) {
      if (count > 5) {
        issues.push(`Tool '${toolName}' called ${count} times in recent history`);
        recommendations.push(`Consider if '${toolName}' is being used effectively`);
      }
    }

    // Check response diversity
    const recentResponses = responses.slice(-5);
    if (recentResponses.length >= 3) {
      const avgSimilarity = this.calculateAverageSimilarity(recentResponses);
      if (avgSimilarity > 0.7) {
        issues.push('AI responses show high similarity - possible repetitive behavior');
        recommendations.push('Consider providing more specific instructions or context');
      }
    }

    return {
      isHealthy: issues.length === 0,
      issues,
      recommendations
    };
  }

  /**
   * Calculate average similarity between all pairs in an array
   */
  private calculateAverageSimilarity(strings: string[]): number {
    if (strings.length < 2) return 0;

    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < strings.length - 1; i++) {
      for (let j = i + 1; j < strings.length; j++) {
        totalSimilarity += this.calculateSimilarity(strings[i], strings[j]);
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }
}

// Export singleton instance
export const loopDetectionService = new LoopDetectionService();
