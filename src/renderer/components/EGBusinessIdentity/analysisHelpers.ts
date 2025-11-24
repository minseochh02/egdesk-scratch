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
 * Helper function to check if URL should try www fallback
 */
function shouldTryWwwFallback(url: string, error: string | undefined): boolean {
  if (!url || url.startsWith('www.')) return false;
  if (!error) return false;
  
  const lowerError = error.toLowerCase();
  return (
    lowerError.includes('timeout') ||
    lowerError.includes('connect timeout') ||
    lowerError.includes('connection timeout') ||
    lowerError.includes('failed to establish connection') ||
    lowerError.includes('und_err_connect_timeout')
  );
}

/**
 * Helper function to add www subdomain to URL
 */
function addWwwSubdomain(url: string): string {
  try {
    const urlObj = new URL(url);
    if (!urlObj.hostname.startsWith('www.')) {
      urlObj.hostname = 'www.' + urlObj.hostname;
    }
    return urlObj.toString();
  } catch {
    // If URL parsing fails, try simple string manipulation
    if (url.startsWith('https://') && !url.startsWith('https://www.')) {
      return url.replace('https://', 'https://www.');
    }
    if (url.startsWith('http://') && !url.startsWith('http://www.')) {
      return url.replace('http://', 'http://www.');
    }
    return url;
  }
}

/**
 * Run SEO analysis using Lighthouse
 */
export async function runSEOAnalysis(url: string): Promise<SEOAnalysisResult> {
  const timestamp = new Date().toISOString();
  const originalUrl = url;
  
  try {
    if (!window.electron?.debug?.generateLighthouseReports) {
      return {
        success: false,
        url: originalUrl,
        error: 'Lighthouse analysis API unavailable',
        timestamp,
      };
    }

    console.log('[BusinessIdentity] Starting SEO analysis with Lighthouse...');
    let result = await window.electron.debug.generateLighthouseReports([url], undefined);

    // If failed and it's a timeout/connection error, try with www subdomain
    if (!result?.success && shouldTryWwwFallback(url, result?.error)) {
      const wwwUrl = addWwwSubdomain(url);
      console.log(`[BusinessIdentity] SEO analysis failed for ${url}, retrying with www subdomain: ${wwwUrl}`);
      
      try {
        result = await window.electron.debug.generateLighthouseReports([wwwUrl], undefined);
        if (result?.success) {
          console.log(`[BusinessIdentity] SEO analysis succeeded with www subdomain`);
        }
      } catch (wwwError) {
        console.warn(`[BusinessIdentity] SEO analysis also failed with www subdomain:`, wwwError);
        // Fall through to return original error
      }
    }

    if (!result?.success) {
      return {
        success: false,
        url: originalUrl,
        error: result?.error || 'Lighthouse analysis failed',
        timestamp,
      };
    }

    // Extract SEO scores from the result
    // The result structure from chrome-handlers.ts returns scores object, but TypeScript type doesn't include it
    // Use type assertion to access the actual return structure
    const resultWithScores = result as { scores?: { overall?: number; performance?: number; accessibility?: number; bestPractices?: number; seo?: number; pwa?: number } };
    const scores = resultWithScores.scores;
    
    return {
      success: true,
      url: originalUrl, // Preserve original URL in result
      scores: scores ? {
        performance: scores.performance || 0,
        accessibility: scores.accessibility || 0,
        bestPractices: scores.bestPractices || 0,
        seo: scores.seo || 0,
        pwa: scores.pwa || 0,
        average: scores.overall || 0,
      } : undefined,
      reportPath: (result as { finalReportPath?: string }).finalReportPath,
      timestamp,
    };
  } catch (error) {
    // If it's a timeout/connection error, try with www subdomain
    if (shouldTryWwwFallback(url, error instanceof Error ? error.message : undefined)) {
      const wwwUrl = addWwwSubdomain(url);
      console.log(`[BusinessIdentity] SEO analysis error for ${url}, retrying with www subdomain: ${wwwUrl}`);
      
      try {
        if (window.electron?.debug?.generateLighthouseReports) {
          const wwwResult = await window.electron.debug.generateLighthouseReports([wwwUrl], undefined);
          if (wwwResult?.success) {
            console.log(`[BusinessIdentity] SEO analysis succeeded with www subdomain`);
            // Use type assertion to access the actual return structure
            const wwwResultWithScores = wwwResult as { scores?: { overall?: number; performance?: number; accessibility?: number; bestPractices?: number; seo?: number; pwa?: number }; finalReportPath?: string };
            const scores = wwwResultWithScores.scores;
            return {
              success: true,
              url: originalUrl, // Preserve original URL
              scores: scores ? {
                performance: scores.performance || 0,
                accessibility: scores.accessibility || 0,
                bestPractices: scores.bestPractices || 0,
                seo: scores.seo || 0,
                pwa: scores.pwa || 0,
                average: scores.overall || 0,
              } : undefined,
              reportPath: wwwResultWithScores.finalReportPath,
              timestamp,
            };
          }
        }
      } catch (wwwError) {
        console.warn(`[BusinessIdentity] SEO analysis also failed with www subdomain:`, wwwError);
        // Fall through to return original error
      }
    }
    
    console.error('[BusinessIdentity] SEO analysis error:', error);
    return {
      success: false,
      url: originalUrl,
      error: error instanceof Error ? error.message : 'Unknown error during SEO analysis',
      timestamp,
    };
  }
}

/**
 * Check if URL should retry with www subdomain
 */
function shouldRetryWithWww(url: string): boolean {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    // Only retry if URL doesn't already have www
    return !urlObj.hostname.startsWith('www.');
  } catch {
    // If URL parsing fails, check string directly
    return !url.includes('www.');
  }
}

/**
 * Run SSL analysis
 */
export async function runSSLAnalysis(url: string): Promise<SSLAnalysisResult> {
  const timestamp = new Date().toISOString();
  const originalUrl = url;
  
  try {
    console.log('[BusinessIdentity] Starting SSL analysis...');
    let result: OverallSecurityResult | null = null;
    let analysisFailed = false;
    let errorMessage: string | undefined = undefined;
    
    try {
      result = await SSLAnalysisService.performCompleteAnalysis(url);
      
      // Check if analysis failed (accessibility failed or other issues)
      if (!result.accessibility.accessible) {
        analysisFailed = true;
        errorMessage = result.accessibility.error;
        console.warn(`[BusinessIdentity] SSL analysis failed for ${url}:`, errorMessage);
      }
    } catch (error) {
      analysisFailed = true;
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`[BusinessIdentity] SSL analysis error for ${url}:`, errorMessage);
    }
    
    // If analysis failed and URL doesn't have www, retry with www subdomain
    if (analysisFailed && shouldRetryWithWww(url)) {
      const wwwUrl = addWwwSubdomain(url);
      console.log(`[BusinessIdentity] SSL analysis failed for ${url}, retrying with www subdomain: ${wwwUrl}`);
      
      try {
        result = await SSLAnalysisService.performCompleteAnalysis(wwwUrl);
        
        // Check if the www version succeeded
        if (result.accessibility.accessible) {
          console.log(`[BusinessIdentity] SSL analysis succeeded with www subdomain`);
        } else {
          console.warn(`[BusinessIdentity] SSL analysis with www subdomain also failed:`, result.accessibility.error);
          // Use the www result even if it failed, as it might have partial data
        }
      } catch (wwwError) {
        console.warn(`[BusinessIdentity] SSL analysis with www subdomain threw error:`, wwwError);
        // If we had a result from the first attempt, use it; otherwise we'll return error below
        if (!result) {
          throw wwwError;
        }
      }
    }
    
    // If we still don't have a result, return error
    if (!result) {
      throw new Error(errorMessage || 'SSL analysis failed and no result available');
    }
    
    // Return success even if accessibility failed, as long as we have a result
    // The UI will handle displaying the error state
    return {
      success: result.accessibility.accessible,
      url: originalUrl, // Preserve original URL in result
      result,
      error: result.accessibility.accessible ? undefined : (result.accessibility.error || 'SSL analysis failed'),
      timestamp,
    };
  } catch (error) {
    console.error('[BusinessIdentity] SSL analysis error:', error);
    return {
      success: false,
      url: originalUrl,
      error: error instanceof Error ? error.message : 'Unknown error during SSL analysis',
      timestamp,
    };
  }
}

