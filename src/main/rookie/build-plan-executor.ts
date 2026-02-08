/**
 * Build Plan Executor
 * Breaks down strategic build plan into executable navigation plans
 * and uses existing EXECUTOR to run them
 */

import { executeNavigationPlan } from './ai-executor';
import { executeDataProcessing } from './data-processing/data-processor';

export interface ExecutionProgress {
  currentStep: number;
  totalSteps: number;
  stepName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  phase: 'website' | 'data-processing';
}

export interface BuildPlanExecutionResult {
  success: boolean;
  completedSteps: number;
  totalSteps: number;
  websiteResults: any[];
  dataProcessingResult?: any;
  outputFile?: string;
  error?: string;
}

/**
 * Execute build plan by breaking it into navigation tasks
 */
export async function executeBuildPlan(params: {
  buildPlan: any;
  websiteSkillsetId?: string;
  credentials?: Record<string, string>;
  websiteCapabilities?: any[];
  outputDir?: string;
  onProgress?: (progress: ExecutionProgress) => void;
}): Promise<BuildPlanExecutionResult> {
  const { buildPlan, websiteSkillsetId, credentials, websiteCapabilities, onProgress } = params;

  console.log('[Build Plan Executor] Starting execution...');
  console.log('  - Total steps:', buildPlan.steps?.length || 0);

  const results: any[] = [];
  const websiteSteps = identifyWebsiteSteps(buildPlan);

  console.log('[Build Plan Executor] Identified', websiteSteps.length, 'website-automatable steps');

  if (websiteSteps.length === 0) {
    console.log('[Build Plan Executor] No website automation steps found');
    return {
      success: true,
      completedSteps: 0,
      totalSteps: buildPlan.steps?.length || 0,
      results: [],
      error: 'No automatable website steps in this build plan. Most steps require manual data acquisition or stakeholder input.',
    };
  }

  // Execute each website step
  for (let i = 0; i < websiteSteps.length; i++) {
    const step = websiteSteps[i];

    if (onProgress) {
      onProgress({
        currentStep: i + 1,
        totalSteps: websiteSteps.length,
        stepName: step.action,
        status: 'running',
      });
    }

    try {
      console.log(`[Build Plan Executor] Executing step ${i + 1}/${websiteSteps.length}:`, step.action);

      // Convert build step to navigation plan format
      const navPlan = convertToNavigationPlan(step, websiteCapabilities);

      // Execute with existing EXECUTOR
      const result = await executeNavigationPlan({
        plan: navPlan,
        url: step.websiteUrl || 'https://login.ecount.com/', // Default to ECOUNT
        credentialValues: credentials,
        explorerCapabilities: websiteCapabilities || [],
      });

      results.push({
        step: step.step,
        action: step.action,
        result,
        success: result.success,
      });

      if (!result.success) {
        console.error(`[Build Plan Executor] Step ${step.step} failed:`, result.error);
        // Continue to next step even if this one fails
      }

      if (onProgress) {
        onProgress({
          currentStep: i + 1,
          totalSteps: websiteSteps.length,
          stepName: step.action,
          status: result.success ? 'completed' : 'failed',
        });
      }
    } catch (error: any) {
      console.error(`[Build Plan Executor] Error executing step ${step.step}:`, error);
      results.push({
        step: step.step,
        action: step.action,
        success: false,
        error: error.message,
      });
    }
  }

  const successfulSteps = results.filter(r => r.success).length;

  console.log('[Build Plan Executor] ✓ Website automation complete');
  console.log('  - Successful steps:', successfulSteps, '/', websiteSteps.length);

  // ===== PHASE 2: Data Processing =====
  const dataProcessingSteps = identifyDataProcessingSteps(buildPlan);
  console.log('[Build Plan Executor] Starting data processing phase...');
  console.log('  - Data steps:', dataProcessingSteps.length);

  let dataProcessingResult = null;
  if (dataProcessingSteps.length > 0) {
    // Map downloaded files for data processor
    const downloadedFileMap: Record<string, string> = {};
    for (const result of results) {
      if (result.success && result.result?.downloadedFile) {
        downloadedFileMap[result.result.downloadedFile.name] = result.result.downloadedFile.path;
      }
    }

    console.log('[Build Plan Executor] Downloaded file map:', downloadedFileMap);

    dataProcessingResult = await executeDataProcessing(
      dataProcessingSteps,
      downloadedFileMap,
      params.outputDir || process.cwd()
    );

    console.log('[Build Plan Executor] Data processing result:', dataProcessingResult);
  }

  return {
    success: successfulSteps > 0 || (dataProcessingResult?.success || false),
    completedSteps: successfulSteps + (dataProcessingResult?.stepsCompleted || 0),
    totalSteps: websiteSteps.length + dataProcessingSteps.length,
    websiteResults: results,
    dataProcessingResult,
    outputFile: dataProcessingResult?.outputFile,
  };
}

/**
 * Identify data processing steps
 */
function identifyDataProcessingSteps(buildPlan: any): any[] {
  const steps = buildPlan.steps || [];

  return steps.filter((step: any) => {
    const dataActionTypes = [
      'LOAD_EXCEL_FILE',
      'EXTRACT_COLUMNS',
      'JOIN_DATA',
      'CALCULATE',
      'AGGREGATE',
      'CREATE_REPORT',
      'FORMAT_CELLS',
    ];

    return dataActionTypes.includes(step.actionType);
  });
}

/**
 * Identify which build steps require website automation
 */
function identifyWebsiteSteps(buildPlan: any): any[] {
  const steps = buildPlan.steps || [];

  return steps.filter((step: any) => {
    const actionType = step.actionType || '';

    // Filter by actionType - only automate website navigation and downloads
    const websiteActionTypes = ['NAVIGATE_WEBSITE', 'DOWNLOAD_EXCEL'];

    return websiteActionTypes.includes(actionType);
  });
}

/**
 * Identify Excel processing steps (for future implementation)
 */
function identifyExcelProcessingSteps(buildPlan: any): any[] {
  const steps = buildPlan.steps || [];

  return steps.filter((step: any) => {
    const actionType = step.actionType || '';

    const excelActionTypes = [
      'LOAD_EXCEL_FILE',
      'EXTRACT_COLUMNS',
      'JOIN_DATA',
      'CALCULATE',
      'AGGREGATE',
      'CREATE_REPORT',
      'FORMAT_CELLS',
    ];

    return excelActionTypes.includes(actionType);
  });
}

/**
 * Convert build step to navigation plan format for EXECUTOR
 */
function convertToNavigationPlan(buildStep: any, websiteCapabilities: any[]): any {
  const params = buildStep.parameters || {};
  const websiteSection = params.websiteSection || buildStep.source;

  // Find the exact capability that matches this section
  const matchingCap = websiteCapabilities?.find((cap: any) => {
    return cap.section === websiteSection ||
           cap.section?.includes(websiteSection) ||
           websiteSection?.includes(cap.section);
  });

  const columnsToExtract = params.columns || [];
  const filters = params.filters || [];

  return {
    goal: buildStep.action,
    missingData: columnsToExtract.length > 0 ? columnsToExtract : [buildStep.output],
    context: `Extract data from website section "${websiteSection}". ${filters.length > 0 ? `Apply filters: ${JSON.stringify(filters)}` : 'No filters needed.'}`,
    websiteSource: {
      siteName: 'ERP System',
      siteType: 'ERP',
      capability: matchingCap?.description || `Access ${websiteSection}`,
      path: websiteSection,
    },
    steps: [], // Let EXECUTOR explore freely with AI guidance
    estimatedTime: '3-5 minutes',
    notes: `Automated extraction: Navigate to "${websiteSection}", download Excel with fields [${columnsToExtract.join(', ')}]. Output: ${buildStep.output}`,
  };
}
