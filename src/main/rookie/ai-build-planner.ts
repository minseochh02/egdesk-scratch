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
    console.log('  - Source files:', sourceFiles?.length || 0);
    console.log('  - Website capabilities:', websiteCapabilities?.capabilities?.length || 0);

    // Debug: Log what we're working with
    if (sourceFiles && sourceFiles.length > 0) {
      sourceFiles.forEach((file: any) => {
        console.log(`  - Source file: ${file.name}, columns: ${file.columns?.length || 0}`);
      });
    }

    if (websiteCapabilities) {
      console.log(`  - Website: ${websiteCapabilities.siteName}`);
      console.log(`  - Capabilities: ${websiteCapabilities.capabilities?.length || 0}`);
    }

    // Build context for AI
    const targetContext = buildTargetContext(targetReport);
    const sourceContext = buildSourceContext(sourceFiles || []);
    const websiteContext = websiteCapabilities
      ? buildWebsiteContext(websiteCapabilities)
      : '⚠️ NO WEBSITE SELECTED - You cannot use website automation. Use only source files.';

    console.log('[Build Planner] Context lengths:');
    console.log('  - Target:', targetContext.length, 'chars');
    console.log('  - Source:', sourceContext.length, 'chars');
    console.log('  - Website:', websiteContext.length, 'chars');

    const prompt = `You are an automation script generator. Create EXECUTABLE automation steps to build a report using browser automation, Excel operations, and data transformations.

## TARGET REPORT TO BUILD

${targetContext}

## AVAILABLE AUTOMATION RESOURCES

### Source Files (Excel) - Available NOW
${sourceContext}

### Website Automation Capabilities - Available NOW
${websiteContext}

## CRITICAL RULES - YOU MUST FOLLOW THESE

1. **ONLY generate AUTOMATABLE steps** - No human tasks allowed
   ❌ NO: "Consult stakeholders", "Interview users", "Review documentation"
   ✅ YES: "Load Excel", "Navigate to URL", "Click button", "Extract data"

2. **Use EXACT resources provided above**
   - Reference EXACT column names from source files
   - Reference EXACT website sections from capabilities list
   - Reference EXACT data fields from website capabilities

3. **Generate CONCRETE browser automation actions**
   - "Navigate to [exact section from capabilities]"
   - "Click [exact button/link name]"
   - "Apply filter [exact field]: [value]"
   - "Download Excel from [exact section]"
   - "Extract columns: [exact column names]"

4. **Each step MUST be executable by automation**
   - Browser navigation (Playwright)
   - Excel file operations (read/write)
   - Data transformations (formulas, joins, aggregations)
   - No steps requiring human judgment or input

5. **Map source → target explicitly**
   - Which Excel file provides which target section
   - Which website section provides which data
   - How data flows from source to target

## OUTPUT FORMAT - EXECUTABLE AUTOMATION STEPS

Create 6-12 steps that can be EXECUTED by browser automation + Excel scripts.

**Example Step Format:**

\`\`\`json
{
  "step": 1,
  "phase": "Data Extraction",
  "actionType": "NAVIGATE_WEBSITE",
  "action": "Download sales transaction data from ECOUNT",
  "source": "회계 I - 판매조회",
  "parameters": {
    "websiteSection": "회계 I - 판매조회",
    "filters": [
      {"field": "거래일자", "value": "2026-02-01 to 2026-02-28"}
    ],
    "columns": ["거래일자", "금액", "거래처", "품목"]
  },
  "output": "ecount_sales_feb2026.xlsx"
}
\`\`\`

**Required Action Types:**
- NAVIGATE_WEBSITE: Browser navigates to website section, downloads Excel
- LOAD_EXCEL_FILE: Load Excel file into memory
- EXTRACT_COLUMNS: Extract specific columns from loaded file
- JOIN_DATA: Join two datasets on common column
- CALCULATE: Apply formula/calculation
- AGGREGATE: Group and sum/average data
- CREATE_REPORT: Create new Excel with target structure
- FORMAT_CELLS: Apply number formats, styling

**CRITICAL RULES:**
1. Use EXACT section names from "Website Automation Capabilities" above
2. Use EXACT column names from "Source Files" above
3. NO human tasks (no "consult", "review", "clarify", "interview")
4. Every step must be executable by:
   - Playwright browser automation (for website steps)
   - ExcelJS / xlsx library (for Excel steps)
   - JavaScript/Python data processing (for transformations)

**Example Full Workflow:**

Step 1 (NAVIGATE_WEBSITE): Navigate to "회계 I - 판매조회", download Excel
Step 2 (LOAD_EXCEL_FILE): Load "판매현황.xlsx" columns [고객명, 매출액]
Step 3 (JOIN_DATA): Join on "거래처"
Step 4 (CALCULATE): SUM(매출액) by 고객명
Step 5 (CREATE_REPORT): Build final report
Step 6 (FORMAT_CELLS): Apply formatting

**IMPORTANT CONSTRAINTS:**
- Generate MAXIMUM 8 steps (keep it focused and concise)
- Be brief in descriptions (10-15 words max per field)
- Combine related actions when possible
- Focus on the most critical steps only

Generate a concise, executable plan using EXACT resources provided above.`;

    const buildResult = await generateWithRookieAI({
      prompt,
      systemPrompt: 'You are an automation script generator. Create concise, executable automation plans with MAXIMUM 8 steps. Use brief descriptions (max 15 words per field).',
      model: 'gemini-2.5-flash',
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
                description: 'Brief overview (max 50 words)',
              },
              phases: {
                type: 'array',
                items: { type: 'string' },
                description: 'Main phases (4 max)',
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
                phase: {
                  type: 'string',
                  enum: ['Data Extraction', 'Data Loading', 'Data Transformation', 'Report Assembly'],
                  description: 'Which automation phase',
                },
                actionType: {
                  type: 'string',
                  enum: [
                    'NAVIGATE_WEBSITE',
                    'DOWNLOAD_EXCEL',
                    'LOAD_EXCEL_FILE',
                    'EXTRACT_COLUMNS',
                    'JOIN_DATA',
                    'CALCULATE',
                    'AGGREGATE',
                    'CREATE_REPORT',
                    'FORMAT_CELLS',
                  ],
                  description: 'Type of automation action',
                },
                action: { type: 'string', description: 'Brief description (max 15 words)' },
                source: {
                  type: 'string',
                  description: 'File name OR website section',
                },
                parameters: {
                  type: 'object',
                  description: 'Executable parameters',
                  properties: {
                    websiteSection: { type: 'string', description: 'Exact section name from capabilities' },
                    columns: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Exact column names to use/extract',
                    },
                    filters: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          field: { type: 'string' },
                          value: { type: 'string' },
                        },
                      },
                      description: 'Filters to apply before download',
                    },
                    joinOn: { type: 'string', description: 'Column name to join on' },
                    formula: { type: 'string', description: 'Excel formula or calculation logic' },
                  },
                },
                output: { type: 'string', description: 'What data/file this produces' },
              },
              required: ['step', 'phase', 'actionType', 'action', 'source', 'parameters', 'output'],
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
                    file: { type: 'string', description: 'Exact filename from available resources' },
                    columns: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Exact column names that will be used',
                    },
                    usage: {
                      type: 'string',
                      description: 'How this data maps to target report (specific sections/fields)',
                    },
                    targetMapping: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          sourceColumn: { type: 'string' },
                          targetField: { type: 'string' },
                        },
                      },
                      description: 'Explicit source column → target field mappings',
                    },
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
                    section: { type: 'string', description: 'Exact section name from capabilities list' },
                    fields: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Exact field names to extract from website',
                    },
                    usage: {
                      type: 'string',
                      description: 'How this website data enriches the report',
                    },
                    targetMapping: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          websiteField: { type: 'string' },
                          targetField: { type: 'string' },
                        },
                      },
                      description: 'Explicit website field → target field mappings',
                    },
                  },
                  required: ['site', 'section', 'fields', 'usage'],
                },
              },
            },
            required: ['sourceFiles', 'websiteData'],
          },
          summary: { type: 'string', description: 'Brief summary (max 30 words)' },
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
    return '⚠️ NO SOURCE FILES PROVIDED - You must work with website data only.';
  }

  const sections = ['**Available Excel Files:**\n'];

  sourceFiles.forEach((file, idx) => {
    const columnList = file.columns
      .map((col) => {
        if (typeof col === 'string') return col;
        return col.name || col.column || String(col);
      })
      .filter(Boolean);

    sections.push(`${idx + 1}. **File: ${file.name}**`);

    if (columnList.length > 0) {
      sections.push(`   Available Columns: ${columnList.join(', ')}`);
      sections.push(`   → Use these EXACT column names in your automation steps`);
    } else {
      sections.push(`   ⚠️ No columns detected - file may need to be loaded first`);
    }
    sections.push('');
  });

  return sections.join('\n');
}

/**
 * Build website context for AI
 */
function buildWebsiteContext(websiteCapabilities: any): string {
  const capabilities = websiteCapabilities?.capabilities || [];

  if (capabilities.length === 0) {
    return '⚠️ NO WEBSITE SELECTED - You cannot use website automation. Use only source files.';
  }

  const sections = [
    `**Website:** ${websiteCapabilities.siteName || 'Unknown'} (${websiteCapabilities.siteType || 'Unknown Type'})`,
    `**Auto-Login:** Credentials saved (automation will login automatically)`,
    `**Total Capabilities:** ${capabilities.length}`,
    '\n**BROWSER AUTOMATION CAPABILITIES:**',
    '\nUse these EXACT section names in your navigation steps:\n',
  ];

  // Group by section
  const grouped: Record<string, any[]> = {};
  capabilities.forEach((cap: any) => {
    const section = cap.section || 'Other';
    if (!grouped[section]) grouped[section] = [];
    grouped[section].push(cap);
  });

  Object.entries(grouped).forEach(([section, caps]) => {
    sections.push(`**Section: "${section}"** (${caps.length} options)`);

    caps.forEach((cap: any) => {
      sections.push(`  ↳ ${cap.description}`);
      if (cap.dataAvailable && cap.dataAvailable.length > 0) {
        sections.push(`    Available Fields: ${cap.dataAvailable.join(', ')}`);
        sections.push(`    → Browser Action: Navigate to "${section}", download Excel, extract these fields`);
      }
    });
    sections.push('');
  });

  sections.push('\n**AUTOMATION INSTRUCTIONS:**');
  sections.push('- Reference exact section names above in quotes');
  sections.push('- Specify which fields to extract from downloaded Excel');
  sections.push('- Browser automation will handle login, navigation, download automatically');

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
