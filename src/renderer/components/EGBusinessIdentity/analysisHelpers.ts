/**
 * Helper functions for SEO and SSL analysis in business identity flow
 */

import { SSLAnalysisService, type OverallSecurityResult } from '../../services/sslAnalysisService';

export interface SEOAnalysisResult {
  success: boolean;
  url: string;
  scores?: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
    pwa: number;
    average: number;
  };
  reportPath?: string;
  error?: string;
  timestamp: string;
}

export interface SSLAnalysisResult {
  success: boolean;
  url: string;
  result?: OverallSecurityResult;
  error?: string;
  timestamp: string;
}

/**
 * Run SEO analysis using Lighthouse
 */
export async function runSEOAnalysis(url: string): Promise<SEOAnalysisResult> {
  const timestamp = new Date().toISOString();
  
  try {
    if (!window.electron?.debug?.generateLighthouseReports) {
      return {
        success: false,
        url,
        error: 'Lighthouse analysis API unavailable',
        timestamp,
      };
    }

    console.log('[BusinessIdentity] Starting SEO analysis with Lighthouse...');
    const result = await window.electron.debug.generateLighthouseReports([url], undefined);

    if (!result?.success) {
      return {
        success: false,
        url,
        error: result?.error || 'Lighthouse analysis failed',
        timestamp,
      };
    }

    // Extract SEO scores from the result
    // The result structure from seo-analyzer.ts returns scores object directly
    const scores = result.scores;
    
    return {
      success: true,
      url,
      scores: scores ? {
        performance: scores.performance || 0,
        accessibility: scores.accessibility || 0,
        bestPractices: scores.bestPractices || 0,
        seo: scores.seo || 0,
        pwa: scores.pwa || 0,
        average: scores.overall || 0,
      } : undefined,
      reportPath: result.finalReportPath,
      timestamp,
    };
  } catch (error) {
    console.error('[BusinessIdentity] SEO analysis error:', error);
    return {
      success: false,
      url,
      error: error instanceof Error ? error.message : 'Unknown error during SEO analysis',
      timestamp,
    };
  }
}

/**
 * Run SSL analysis
 */
export async function runSSLAnalysis(url: string): Promise<SSLAnalysisResult> {
  const timestamp = new Date().toISOString();
  
  try {
    console.log('[BusinessIdentity] Starting SSL analysis...');
    const result = await SSLAnalysisService.performCompleteAnalysis(url);
    
    return {
      success: true,
      url,
      result,
      timestamp,
    };
  } catch (error) {
    console.error('[BusinessIdentity] SSL analysis error:', error);
    return {
      success: false,
      url,
      error: error instanceof Error ? error.message : 'Unknown error during SSL analysis',
      timestamp,
    };
  }
}

