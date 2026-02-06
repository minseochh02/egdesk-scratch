/**
 * Comparison Utility - RESEARCHER vs EXPLORER
 *
 * Runs both exploration methods on the same site and compares results
 */

import { researchWebsite, ResearchTask } from './ai-researcher';
import { exploreWebsiteParallel } from './ai-explorer';
import * as fs from 'fs';
import * as path from 'path';

export interface ComparisonResult {
  site: string;
  timestamp: string;
  researcher: {
    executionTimeMs: number;
    totalToolCalls: number;
    sectionsExplored: number;
    capabilitiesFound: number;
    success: boolean;
    findings: any;
  };
  explorer: {
    executionTimeMs: number;
    totalAgents: number;
    totalToolCalls: number;
    sectionsExplored: number;
    capabilitiesFound: number;
    success: boolean;
    findings: any;
  };
  comparison: {
    explorerFoundMoreSections: number;
    explorerFoundMoreCapabilities: number;
    explorerWasFaster: boolean;
    toolCallRatio: string;
    timeRatio: string;
  };
}

/**
 * Run both RESEARCHER and EXPLORER on the same site and compare results
 */
export async function compareExplorationMethods(params: {
  url: string;
  credentials?: { username: string; password: string };
  credentialValues?: Record<string, string>;
}): Promise<ComparisonResult> {
  const startTimestamp = new Date().toISOString();

  console.log('[Comparison] Starting side-by-side comparison...');
  console.log('  - URL:', params.url);

  // ===== RESEARCHER (Sequential) =====
  console.log('\n[Comparison] Phase 1: Running RESEARCHER (Sequential)...');
  const researcherStartTime = Date.now();

  const researcherTask: ResearchTask = {
    url: params.url,
  };

  const researcherResult = await researchWebsite(researcherTask,
    params.credentials ? {
      'default': params.credentials
    } : undefined
  );

  const researcherEndTime = Date.now();
  const researcherExecutionTime = researcherEndTime - researcherStartTime;

  console.log('[Comparison] RESEARCHER completed');
  console.log('  - Time:', (researcherExecutionTime / 1000).toFixed(1), 's');
  console.log('  - Tool calls:', researcherResult.toolCalls || 0);
  console.log('  - Capabilities:', researcherResult.capabilities?.length || 0);

  // ===== EXPLORER (Parallel) =====
  console.log('\n[Comparison] Phase 2: Running EXPLORER (Parallel)...');
  const explorerStartTime = Date.now();

  const explorerResult = await exploreWebsiteParallel({
    url: params.url,
    credentials: params.credentials,
    credentialValues: params.credentialValues,
  });

  const explorerEndTime = Date.now();
  const explorerExecutionTime = explorerEndTime - explorerStartTime;

  console.log('[Comparison] EXPLORER completed');
  console.log('  - Time:', (explorerExecutionTime / 1000).toFixed(1), 's');
  console.log('  - Agents:', explorerResult.explorationStats?.totalAgents || 0);
  console.log('  - Tool calls:', explorerResult.explorationStats?.totalToolCalls || 0);
  console.log('  - Capabilities:', explorerResult.capabilities?.length || 0);

  // ===== Calculate Comparison Metrics =====
  const researcherSections = researcherResult.capabilities?.length || 0;
  const explorerSections = explorerResult.capabilities?.length || 0;

  const researcherToolCalls = researcherResult.toolCalls || 0;
  const explorerToolCalls = explorerResult.explorationStats?.totalToolCalls || 0;

  const comparison: ComparisonResult = {
    site: params.url,
    timestamp: startTimestamp,
    researcher: {
      executionTimeMs: researcherExecutionTime,
      totalToolCalls: researcherToolCalls,
      sectionsExplored: researcherSections,
      capabilitiesFound: researcherSections,
      success: researcherResult.success,
      findings: researcherResult,
    },
    explorer: {
      executionTimeMs: explorerExecutionTime,
      totalAgents: explorerResult.explorationStats?.totalAgents || 0,
      totalToolCalls: explorerToolCalls,
      sectionsExplored: explorerResult.explorationStats?.sectionsExplored || 0,
      capabilitiesFound: explorerSections,
      success: explorerResult.success,
      findings: explorerResult,
    },
    comparison: {
      explorerFoundMoreSections: explorerSections - researcherSections,
      explorerFoundMoreCapabilities: explorerSections - researcherSections,
      explorerWasFaster: explorerExecutionTime < researcherExecutionTime,
      toolCallRatio: `${(explorerToolCalls / Math.max(researcherToolCalls, 1)).toFixed(1)}x`,
      timeRatio: explorerExecutionTime < researcherExecutionTime
        ? `${((researcherExecutionTime / explorerExecutionTime)).toFixed(1)}x faster`
        : `${((explorerExecutionTime / researcherExecutionTime)).toFixed(1)}x slower`,
    },
  };

  console.log('\n[Comparison] ✅ Comparison complete');
  console.log('  - EXPLORER found', comparison.comparison.explorerFoundMoreSections, 'more sections');
  console.log('  - EXPLORER used', comparison.comparison.toolCallRatio, 'tool calls');
  console.log('  - Time comparison:', comparison.comparison.timeRatio);

  return comparison;
}

/**
 * Save comparison results to file
 */
export function saveComparisonResults(result: ComparisonResult, outputDir: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `compare_${timestamp}.json`;
  const filePath = path.join(outputDir, fileName);

  // Ensure directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(result, null, 2));

  return filePath;
}
