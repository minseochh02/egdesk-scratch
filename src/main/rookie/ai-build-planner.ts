/**
 * BUILD PLANNER - Comprehensive Report Builder
 *
 * Analyzes target report, source files, and website capabilities
 * to create a complete strategy for building the entire report from scratch.
 */

import { generateWithRookieAI } from './rookie-ai-handler';
import * as fs from 'fs';
import * as path from 'path';

export interface BuildStep {
  step: number;
  phase: string; // "Extract", "Transform", "Load", "Calculate"
  action: string;
  source: string; // Which file/website to use
  details: string;
  output: string; // What this step produces
}

export interface BuildPlan {
  success: boolean;
  strategy: {
    overview: string; // High-level approach
    phases: string[]; // Main phases (e.g., "Data Collection", "Processing", "Assembly")
  };
  steps: BuildStep[]; // Detailed step-by-step plan
  dataFlow: {
    sourceFiles: Array<{
      file: string;
      columns: string[];
      usage: string;
    }>;
    websiteData: Array<{
      site: string;
      section: string;
      fields: string[];
      usage: string;
    }>;
  };
  summary: string;
  estimatedComplexity: string; // "Simple", "Moderate", "Complex"
  error?: string;
}

/**
 * Generate comprehensive build plan
 */
export async function generateBuildPlan(params: {
  targetReport: any; // ROOKIE analysis of target report
  sourceFiles: Array<{ name: string; columns: any[] }>; // Available Excel files
  websiteCapabilities?: any; // Available website data from Skillset
}): Promise<BuildPlan> {
  const { targetReport, sourceFiles, websiteCapabilities } = params;

  try {
    console.log('[Build Planner] Generating comprehensive build plan...');
    console.log('  - Target report:', targetReport.sheetName);
    console.log('  - Source files:', sourceFiles.length);
    console.log('  - Website capabilities:', websiteCapabilities?.capabilities?.length || 0);

    // Build context for AI
    const targetContext = buildTargetContext(targetReport);
    const sourceContext = buildSourceContext(sourceFiles);
    const websiteContext = websiteCapabilities
      ? buildWebsiteContext(websiteCapabilities)
      : 'No website data available.';

    const prompt = `You are an expert data analyst and report builder. Your task is to create a comprehensive plan for building a complete report from scratch using available resources.

## TARGET REPORT TO BUILD

${targetContext}

## AVAILABLE RESOURCES

### Source Files (Excel)
${sourceContext}

### Website Data
${websiteContext}

## YOUR TASK

Create a **comprehensive, step-by-step plan** to build the entire target report from scratch. This is NOT about filling in blanks - you need to analyze ALL available resources and figure out the complete strategy for constructing this report.

**Your plan should:**

1. **Analyze the target report structure:**
   - What type of report is this?
   - What are the key sections/dimensions?
   - What metrics/measures are needed?
   - What calculations are required?

2. **Map available resources:**
   - Which source file columns can be used for each section?
   - Which website data complements the Excel data?
   - What transformations are needed?

3. **Create a logical build sequence:**
   - Phase 1: Data Collection (extract from files + websites)
   - Phase 2: Data Processing (clean, transform, calculate)
   - Phase 3: Report Assembly (structure, format, populate)
   - Phase 4: Validation (check completeness, accuracy)

4. **Be specific and actionable:**
   - Exact column names from source files
   - Exact website sections to access
   - Specific calculations (formulas, aggregations)
   - Clear input → transformation → output for each step

**Think holistically:** How would you build this report if you were doing it manually? What's the logical sequence? What data dependencies exist?

Create a complete build plan with 8-15 steps covering the entire process.`;

    const buildResult = await generateWithRookieAI({
      prompt,
      systemPrompt: 'You are an expert report builder. Create comprehensive, logical plans for building complete reports from multiple data sources.',
      model: 'gemini-2.0-flash-exp',
      temperature: 0,
      maxOutputTokens: 16384,
      responseSchema: {
        type: 'object',
        properties: {
          strategy: {
            type: 'object',
            properties: {
              overview: {
                type: 'string',
                description: 'High-level overview of the build approach',
              },
              phases: {
                type: 'array',
                items: { type: 'string' },
                description: 'Main phases of the build process',
              },
            },
            required: ['overview', 'phases'],
          },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                step: { type: 'number' },
                phase: { type: 'string', description: 'Which phase this belongs to' },
                action: { type: 'string', description: 'What to do' },
                source: { type: 'string', description: 'Which file/website to use' },
                details: { type: 'string', description: 'Detailed instructions' },
                output: { type: 'string', description: 'What this step produces' },
              },
              required: ['step', 'phase', 'action', 'source', 'details', 'output'],
            },
          },
          dataFlow: {
            type: 'object',
            properties: {
              sourceFiles: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    file: { type: 'string' },
                    columns: { type: 'array', items: { type: 'string' } },
                    usage: { type: 'string' },
                  },
                  required: ['file', 'columns', 'usage'],
                },
              },
              websiteData: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    site: { type: 'string' },
                    section: { type: 'string' },
                    fields: { type: 'array', items: { type: 'string' } },
                    usage: { type: 'string' },
                  },
                  required: ['site', 'section', 'fields', 'usage'],
                },
              },
            },
            required: ['sourceFiles', 'websiteData'],
          },
          summary: { type: 'string', description: 'Executive summary of the build plan' },
          estimatedComplexity: {
            type: 'string',
            enum: ['Simple', 'Moderate', 'Complex'],
            description: 'Overall complexity assessment',
          },
        },
        required: ['strategy', 'steps', 'dataFlow', 'summary', 'estimatedComplexity'],
      },
    });

    console.log('[Build Planner] Build planning complete');

    if (buildResult.json) {
      const plan = buildResult.json;
      console.log('[Build Planner] ✓ Generated', plan.steps?.length || 0, 'build steps');
      console.log('[Build Planner] Complexity:', plan.estimatedComplexity);

      return {
        success: true,
        strategy: plan.strategy,
        steps: plan.steps,
        dataFlow: plan.dataFlow,
        summary: plan.summary,
        estimatedComplexity: plan.estimatedComplexity,
      };
    }

    return {
      success: false,
      strategy: { overview: '', phases: [] },
      steps: [],
      dataFlow: { sourceFiles: [], websiteData: [] },
      summary: '',
      estimatedComplexity: 'Unknown',
      error: 'AI did not generate valid build plan',
    };
  } catch (error: any) {
    console.error('[Build Planner] Error:', error);
    return {
      success: false,
      strategy: { overview: '', phases: [] },
      steps: [],
      dataFlow: { sourceFiles: [], websiteData: [] },
      summary: '',
      estimatedComplexity: 'Unknown',
      error: error.message,
    };
  }
}

/**
 * Build target report context for AI
 */
function buildTargetContext(targetReport: any): string {
  const sections = [
    `**Report Name:** ${targetReport.sheetName || 'Unknown'}`,
    `**Report Purpose:** ${targetReport.reportContext?.reportPurpose || 'Not specified'}`,
  ];

  if (targetReport.reportContext?.dataStory) {
    sections.push(`**Data Story:** ${targetReport.reportContext.dataStory}`);
  }

  if (targetReport.dimensions && targetReport.dimensions.length > 0) {
    sections.push('\n**Dimensions (Categories):**');
    targetReport.dimensions.forEach((dim: any) => {
      sections.push(`- ${dim.name}: ${dim.description}`);
      if (dim.values && dim.values.length > 0) {
        sections.push(`  Values: ${dim.values.join(', ')}`);
      }
    });
  }

  if (targetReport.measures && targetReport.measures.length > 0) {
    sections.push('\n**Measures (Metrics):**');
    targetReport.measures.forEach((measure: any) => {
      sections.push(`- ${measure.name} (${measure.unit}): ${measure.description}`);
    });
  }

  if (targetReport.calculations && targetReport.calculations.length > 0) {
    sections.push('\n**Calculations:**');
    targetReport.calculations.forEach((calc: any) => {
      sections.push(`- ${calc.name}: ${calc.logic}`);
    });
  }

  return sections.join('\n');
}

/**
 * Build source files context for AI
 */
function buildSourceContext(sourceFiles: Array<{ name: string; columns: any[] }>): string {
  if (sourceFiles.length === 0) {
    return 'No source files available.';
  }

  return sourceFiles
    .map((file) => {
      const columnList = file.columns
        .map((col) => {
          if (typeof col === 'string') return col;
          return col.name || col.column || String(col);
        })
        .filter(Boolean)
        .join(', ');

      return `**${file.name}**\nColumns: ${columnList || 'No columns detected'}`;
    })
    .join('\n\n');
}

/**
 * Build website context for AI
 */
function buildWebsiteContext(websiteCapabilities: any): string {
  const capabilities = websiteCapabilities.capabilities || [];

  if (capabilities.length === 0) {
    return 'Website connected but no capabilities mapped yet.';
  }

  const sections = [
    `**Website:** ${websiteCapabilities.siteName || 'Unknown'} (${websiteCapabilities.siteType || 'Unknown Type'})`,
    `**Total Capabilities:** ${capabilities.length}`,
    '\n**Available Data Sections:**',
  ];

  // Group by section
  const grouped: Record<string, any[]> = {};
  capabilities.forEach((cap: any) => {
    const section = cap.section || 'Other';
    if (!grouped[section]) grouped[section] = [];
    grouped[section].push(cap);
  });

  Object.entries(grouped).forEach(([section, caps]) => {
    sections.push(`\n**${section}** (${caps.length} capabilities):`);
    caps.slice(0, 3).forEach((cap: any) => {
      // Show top 3 per section
      sections.push(`  - ${cap.description}`);
      if (cap.dataAvailable && cap.dataAvailable.length > 0) {
        sections.push(`    Fields: ${cap.dataAvailable.slice(0, 5).join(', ')}`);
      }
    });
    if (caps.length > 3) {
      sections.push(`  ... and ${caps.length - 3} more`);
    }
  });

  return sections.join('\n');
}

/**
 * Save build plan to file
 */
export function saveBuildPlan(result: BuildPlan, outputDir: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `build_plan_${timestamp}.json`;
  const filePath = path.join(outputDir, fileName);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(result, null, 2));

  return filePath;
}
