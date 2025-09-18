import { OverallSecurityResult } from './sslAnalysisService';

export interface StoredSSLAnalysis {
  id: string;
  websiteUrl: string;
  analysis: OverallSecurityResult;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  notes?: string;
}

export interface SSLAnalysisFilter {
  websiteUrl?: string;
  dateFrom?: string;
  dateTo?: string;
  grade?: string;
  tags?: string[];
}

export interface SSLAnalysisStats {
  totalAnalyses: number;
  averageScore: number;
  gradeDistribution: Record<string, number>;
  mostAnalyzedSites: Array<{ url: string; count: number }>;
  recentAnalyses: StoredSSLAnalysis[];
}

export class SSLAnalysisStorageService {
  private static readonly STORAGE_KEY = 'sslAnalysisHistory';

  /**
   * Save SSL analysis to storage
   */
  static async saveAnalysis(
    websiteUrl: string,
    analysis: OverallSecurityResult,
    tags?: string[],
    notes?: string
  ): Promise<StoredSSLAnalysis> {
    const storedAnalysis: StoredSSLAnalysis = {
      id: this.generateId(),
      websiteUrl,
      analysis,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: tags || [],
      notes: notes || ''
    };

    try {
      const result = await window.electron.sslAnalysis.save(storedAnalysis);
      if (result.success) {
        return storedAnalysis;
      } else {
        throw new Error(result.error || 'Failed to save analysis');
      }
    } catch (error) {
      console.error('Error saving SSL analysis:', error);
      throw error;
    }
  }

  /**
   * Get all SSL analyses with optional filtering
   */
  static async getAnalyses(filter?: SSLAnalysisFilter): Promise<StoredSSLAnalysis[]> {
    try {
      const result = await window.electron.sslAnalysis.getAll(filter);
      if (result.success) {
        return result.analyses || [];
      } else {
        throw new Error(result.error || 'Failed to get analyses');
      }
    } catch (error) {
      console.error('Error getting SSL analyses:', error);
      throw error;
    }
  }

  /**
   * Get a specific SSL analysis by ID
   */
  static async getAnalysisById(id: string): Promise<StoredSSLAnalysis | null> {
    try {
      const result = await window.electron.sslAnalysis.getById(id);
      if (result.success) {
        return result.analysis || null;
      } else {
        throw new Error(result.error || 'Failed to get analysis');
      }
    } catch (error) {
      console.error('Error getting SSL analysis by ID:', error);
      throw error;
    }
  }

  /**
   * Update an existing SSL analysis
   */
  static async updateAnalysis(
    id: string,
    updates: Partial<Pick<StoredSSLAnalysis, 'tags' | 'notes'>>
  ): Promise<StoredSSLAnalysis> {
    try {
      const result = await window.electron.sslAnalysis.update(id, updates);
      if (result.success) {
        return result.analysis;
      } else {
        throw new Error(result.error || 'Failed to update analysis');
      }
    } catch (error) {
      console.error('Error updating SSL analysis:', error);
      throw error;
    }
  }

  /**
   * Delete an SSL analysis
   */
  static async deleteAnalysis(id: string): Promise<boolean> {
    try {
      const result = await window.electron.sslAnalysis.delete(id);
      if (result.success) {
        return true;
      } else {
        throw new Error(result.error || 'Failed to delete analysis');
      }
    } catch (error) {
      console.error('Error deleting SSL analysis:', error);
      throw error;
    }
  }

  /**
   * Get analysis statistics
   */
  static async getAnalysisStats(): Promise<SSLAnalysisStats> {
    try {
      const result = await window.electron.sslAnalysis.getStats();
      if (result.success) {
        return result.stats;
      } else {
        throw new Error(result.error || 'Failed to get analysis stats');
      }
    } catch (error) {
      console.error('Error getting SSL analysis stats:', error);
      throw error;
    }
  }

  /**
   * Search analyses by query
   */
  static async searchAnalyses(query: string): Promise<StoredSSLAnalysis[]> {
    try {
      const result = await window.electron.sslAnalysis.search(query);
      if (result.success) {
        return result.analyses || [];
      } else {
        throw new Error(result.error || 'Failed to search analyses');
      }
    } catch (error) {
      console.error('Error searching SSL analyses:', error);
      throw error;
    }
  }

  /**
   * Export analyses to JSON
   */
  static async exportAnalyses(filter?: SSLAnalysisFilter): Promise<string> {
    try {
      const analyses = await this.getAnalyses(filter);
      const exportData = {
        exportDate: new Date().toISOString(),
        totalAnalyses: analyses.length,
        analyses: analyses
      };
      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('Error exporting SSL analyses:', error);
      throw error;
    }
  }

  /**
   * Import analyses from JSON
   */
  static async importAnalyses(jsonData: string): Promise<number> {
    try {
      const importData = JSON.parse(jsonData);
      if (!importData.analyses || !Array.isArray(importData.analyses)) {
        throw new Error('Invalid import data format');
      }

      let importedCount = 0;
      for (const analysis of importData.analyses) {
        try {
          await this.saveAnalysis(
            analysis.websiteUrl,
            analysis.analysis,
            analysis.tags,
            analysis.notes
          );
          importedCount++;
        } catch (error) {
          console.warn('Failed to import analysis:', analysis.id, error);
        }
      }

      return importedCount;
    } catch (error) {
      console.error('Error importing SSL analyses:', error);
      throw error;
    }
  }

  /**
   * Clear all analyses
   */
  static async clearAllAnalyses(): Promise<boolean> {
    try {
      const result = await window.electron.sslAnalysis.clearAll();
      if (result.success) {
        return true;
      } else {
        throw new Error(result.error || 'Failed to clear analyses');
      }
    } catch (error) {
      console.error('Error clearing SSL analyses:', error);
      throw error;
    }
  }

  /**
   * Generate unique ID for analysis
   */
  private static generateId(): string {
    return `ssl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Format analysis for display
   */
  static formatAnalysisForDisplay(analysis: StoredSSLAnalysis): string {
    const { analysis: sslAnalysis, websiteUrl, createdAt, tags, notes } = analysis;
    const date = new Date(createdAt).toLocaleString();
    
    let display = `🌐 ${websiteUrl}\n`;
    display += `📅 ${date}\n`;
    display += `🏆 보안 등급: ${sslAnalysis.grade.grade} (${sslAnalysis.grade.score}/100)\n`;
    
    if (tags && tags.length > 0) {
      display += `🏷️ 태그: ${tags.join(', ')}\n`;
    }
    
    if (notes) {
      display += `📝 메모: ${notes}\n`;
    }
    
    return display;
  }

  /**
   * Get analysis summary for quick reference
   */
  static getAnalysisSummary(analysis: StoredSSLAnalysis): {
    url: string;
    grade: string;
    score: number;
    date: string;
    hasIssues: boolean;
    criticalIssues: number;
  } {
    const { analysis: sslAnalysis, websiteUrl, createdAt } = analysis;
    
    return {
      url: websiteUrl,
      grade: sslAnalysis.grade.grade,
      score: sslAnalysis.grade.score,
      date: new Date(createdAt).toLocaleDateString(),
      hasIssues: sslAnalysis.grade.criticalIssues.length > 0 || sslAnalysis.grade.highIssues.length > 0,
      criticalIssues: sslAnalysis.grade.criticalIssues.length
    };
  }
}
