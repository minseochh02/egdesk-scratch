/**
 * RESOLVER v1.0 - Source-to-Report Mapping Agent
 *
 * Takes Rookie's comprehension + source data files
 * Returns: verified understanding + complete build recipe for the report
 */

import { generateWithRookieAI } from './rookie-ai-handler';
import { ExcelAnalysisResult } from './ai-excel-analyzer';
import { ExcelDataStore, queryExcelData, getDistinctValues } from './excel-query-tool';

// RESOLVER Output Interfaces

export interface SourceColumn {
  name: string;
  type: string; // numeric | text | date | code
  role: string; // dimension | measure
  sampleValues?: string[];
}

export interface SourceInventoryItem {
  file: string;
  origin: string;
  rowCount: number;
  dateRange?: string;
  columns: SourceColumn[];
  feedsTargetSections: string[];
}

export interface DimensionMap {
  targetLabel: string;
  sourceFile: string;
  sourceColumn: string;
  sourceValues: string[];
  filterExpression: string;
  confidence: 'high' | 'medium' | 'low';
  evidence: string;
}

export interface MetricMap {
  targetField: string;
  targetSection: string;
  sourceFile: string;
  sourceExpression: string;
  filtersApplied: string[];
  aggregation: string;
  verification: {
    testedRegions: string;
    sample: Record<string, string>;
  };
  confidence: 'confirmed' | 'probable' | 'unresolved';
}

export interface RookieReviewFormula {
  rookieClaim: string;
  verdict: 'CONFIRMED' | 'CORRECTED' | 'INCOMPLETE';
  detail: string;
}

export interface RookieReviewUnknown {
  rookieUnknownId: string;
  status: 'RESOLVED' | 'PARTIALLY_RESOLVED' | 'STILL_UNKNOWN';
  answer?: string;
  evidence?: string;
  remainingGap?: string;
}

export interface RookieReviewDiscovery {
  finding: string;
  impact: string;
  affectedSections: string[];
}

export interface RookieReview {
  formulas: RookieReviewFormula[];
  unknownsResolved: RookieReviewUnknown[];
  newDiscoveries: RookieReviewDiscovery[];
}

export interface BuildStep {
  step: number;
  targetSection: string;
  action: string;
  sourceFile: string;
  logic: string;
  fillsCells: string;
  postCheck: string;
  dependsOn?: number;
}

export interface BuildRecipe {
  prerequisites: {
    sourceFilesNeeded: Array<{
      file: string;
      description: string;
      whereToGet: string;
    }>;
    referenceValuesNeeded: Array<{
      item: string;
      whereToGet: string;
    }>;
  };
  steps: BuildStep[];
  postBuildValidation: Array<{
    check: string;
    expected: string;
  }>;
  unresolvedItems: Array<{
    item: string;
    reason: string;
    workaround: string;
  }>;
}

export interface TermResolution {
  term: string;
  answer: string; // Answer to what this term means
  foundIn: string; // Which file(s) contain this term
  column?: string; // Specific column name if applicable
  exampleValues?: string[]; // Sample values from the column
  confidence: 'confirmed' | 'likely' | 'not_found';
}

export interface ResolverResult {
  success: boolean;
  termResolutions?: TermResolution[]; // Answers to ROOKIE's unclear terms
  sourceInventory?: SourceInventoryItem[];
  dimensionMaps?: {
    regions?: DimensionMap[];
    timePeriods?: any[];
    categories?: any[];
  };
  metricMaps?: MetricMap[];
  rookieReview?: RookieReview;
  buildRecipe?: BuildRecipe;
  error?: string;
}

/**
 * Analyze source files and map them to target report
 */
export async function analyzeSourceMapping(params: {
  rookieAnalysis: ExcelAnalysisResult;
  targetHtml: string;
  sourceFilesData: Map<string, ExcelDataStore>; // Excel data accessible by fileId
  sourceFilesSchemas: Array<{
    fileId: string;
    fileName: string;
    sheetName: string;
    headers: string[];
    rowCount: number;
    sampleRows: any[][]; // First 5 rows for context
  }>;
  apiKey?: string;
}): Promise<ResolverResult> {
  try {
    console.log('[Resolver] Starting source-to-target mapping analysis...');
    console.log('  - Source files:', params.sourceFilesSchemas.length);
    console.log('  - Data store size:', params.sourceFilesData.size);

    // Build the RESOLVER v1.0 prompt for exploration phase
    const systemPrompt = `You are **Resolver**, the senior analyst who receives:
1. **Rookie's analysis** — a structural comprehension of the target report
2. **Source data files** — flat, tabular datasets (database exports, ERP data, transaction logs)

Your job: figure out exactly how flat source data gets transformed into the structured target report.

**You have access to query tools** to explore the source data:
- Use queryExcelData to filter, group, and aggregate data (like SQL SELECT, WHERE, GROUP BY, SUM)
- Use getDistinctValues to see unique values in columns (helps with dimension mapping)

**Operating Principles:**
1. Value-back matching is your primary weapon - use queryExcelData to reproduce target numbers
2. Test across all rows, not just one - query multiple dimension values
3. Be honest about mismatches
4. Use getDistinctValues to explore dimensions before mapping
5. Document all your findings - they will be used to create the final structured analysis`;

    const promptText = `Analyze how to build the target report from source data using RESOLVER v1.0 framework.

**TARGET REPORT (analyzed by Rookie):**
${JSON.stringify(params.rookieAnalysis, null, 2)}

${params.rookieAnalysis.unclearTerms && params.rookieAnalysis.unclearTerms.length > 0 ? `
**ROOKIE'S UNCLEAR TERMS (answer these first!):**
${params.rookieAnalysis.unclearTerms.map((term, i) => `${i + 1}. "${term}"`).join('\n')}

For each unclear term, use the query tools to find where it appears in the source data:
- Search column names with getDistinctValues
- Check if values match these terms
- Provide concrete answers: "Found in [file], column [name], values: [examples]"
` : ''}

**SOURCE DATA FILES (query these with tools!):**
${params.sourceFilesSchemas.map((src) => `
File ID: ${src.fileId}
Name: ${src.fileName} (Sheet: ${src.sheetName})
Rows: ${src.rowCount}
Headers: ${src.headers.join(', ')}

Sample data (first 5 rows):
${JSON.stringify(src.sampleRows, null, 2)}
`).join('\n')}

Execute these phases:

**PHASE 0: RESOLVE ROOKIE'S UNCLEAR TERMS (if any)**
For each unclear term from Rookie:
- Use getDistinctValues to search for columns containing these terms
- Provide answer: "Found in [file], column [column_name], example values: [...]"
- If not found, state: "Not found in source data - may need manual clarification"

**PHASE 1: SOURCE INVENTORY**
- For each source file: origin, row count, columns (name, type, role: dimension/measure), sample values
- Hypothesis: which target sections could this feed?

**PHASE 2: DIMENSION MAPPING**
- Map target row labels → source filter values (with value-back matching!)
- Map target time periods → source date filters
- Map target categories → source column names/values
- Show evidence and confidence for each mapping

**PHASE 3: METRIC MAPPING**
- For each target numeric field: find source column + aggregation
- Test across multiple rows with actual numbers
- Show verification: "SUM(col) = target_value ✓"

**PHASE 4: ROOKIE REVIEW**
- Verify/correct Rookie's formulas
- Resolve Rookie's unknowns with source data evidence
- Note new discoveries from source data

**PHASE 5: BUILD RECIPE**
- Prerequisites: what files/values are needed
- Steps: ordered sequence to build the report (with filters, groupings, aggregations)
- Post-build validation checks
- Unresolved items that still need manual work

Use the query tools extensively to explore and verify mappings. Document your findings in detail.`;

    // Define tools for AI to query Excel data
    const tools = [
      {
        functionDeclarations: [
          {
            name: 'queryExcelData',
            description: 'Query Excel data with filters, grouping, and aggregation (like SQL SELECT)',
            parameters: {
              type: 'object',
              properties: {
                fileId: {
                  type: 'string',
                  description: 'The file ID to query',
                },
                select: {
                  type: 'array',
                  description: 'Columns to select, or aggregations like "SUM(amount)", "AVG(price)"',
                  items: { type: 'string' },
                },
                where: {
                  type: 'array',
                  description: 'Filter conditions',
                  items: {
                    type: 'object',
                    properties: {
                      column: { type: 'string', description: 'Column name' },
                      operator: { type: 'string', description: 'Operator: =, !=, >, >=, <, <=, in, contains, between' },
                      value: { description: 'Value or array of values for "in" and "between"' },
                    },
                    required: ['column', 'operator', 'value'],
                  },
                },
                groupBy: {
                  type: 'array',
                  description: 'Columns to group by',
                  items: { type: 'string' },
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of rows to return',
                },
              },
              required: ['fileId', 'select'],
            },
          },
          {
            name: 'getDistinctValues',
            description: 'Get distinct/unique values from a column (useful for dimension mapping)',
            parameters: {
              type: 'object',
              properties: {
                fileId: {
                  type: 'string',
                  description: 'The file ID to query',
                },
                column: {
                  type: 'string',
                  description: 'Column name to get distinct values from',
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of distinct values to return (default: 100)',
                },
              },
              required: ['fileId', 'column'],
            },
          },
        ],
      },
    ];

    // Tool executor function (closes over sourceFilesData)
    const toolExecutor = async (toolName: string, args: any) => {
      console.log(`[Resolver] Executing tool: ${toolName}`, args);

      switch (toolName) {
        case 'queryExcelData':
          return queryExcelData(params.sourceFilesData, args);
        case 'getDistinctValues':
          return getDistinctValues(params.sourceFilesData, args.fileId, args.column, args.limit);
        default:
          return { success: false, error: `Unknown tool: ${toolName}` };
      }
    };

    // Response schema for final structured output (after tool calls complete)
    const responseSchema = {
      type: 'object',
      properties: {
        termResolutions: {
          type: 'array',
          description: 'Answers to ROOKIEs unclear terms',
          items: {
            type: 'object',
            properties: {
              term: { type: 'string', description: 'The unclear term from ROOKIE' },
              answer: { type: 'string', description: 'What this term means based on source data' },
              foundIn: { type: 'string', description: 'Which file(s) contain this' },
              column: { type: 'string', description: 'Column name if applicable' },
              exampleValues: { type: 'array', items: { type: 'string' }, description: 'Sample values' },
              confidence: { type: 'string', description: 'confirmed, likely, or not_found' },
            },
            required: ['term', 'answer', 'foundIn', 'confidence'],
          },
        },
        sourceInventory: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              file: { type: 'string' },
              origin: { type: 'string' },
              rowCount: { type: 'number' },
              dateRange: { type: 'string' },
              columns: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    type: { type: 'string' },
                    role: { type: 'string' },
                    sampleValues: { type: 'array', items: { type: 'string' } },
                  },
                  required: ['name', 'type', 'role'],
                },
              },
              feedsTargetSections: { type: 'array', items: { type: 'string' } },
            },
            required: ['file', 'origin', 'rowCount', 'columns', 'feedsTargetSections'],
          },
        },
        dimensionMaps: {
          type: 'string',
          description: 'Detailed description of dimension mappings (regions, time periods, categories)',
        },
        metricMaps: {
          type: 'string',
          description: 'Detailed description of metric mappings with verification results',
        },
        rookieReview: {
          type: 'string',
          description: 'Review of Rookies analysis - what was confirmed, corrected, or newly discovered',
        },
        buildRecipe: {
          type: 'object',
          properties: {
            steps: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  step: { type: 'number' },
                  targetSection: { type: 'string' },
                  action: { type: 'string' },
                  sourceFile: { type: 'string' },
                  logic: { type: 'string' },
                  fillsCells: { type: 'string' },
                  postCheck: { type: 'string' },
                },
                required: ['step', 'targetSection', 'action', 'sourceFile', 'logic', 'fillsCells', 'postCheck'],
              },
            },
            unresolvedItems: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  item: { type: 'string' },
                  reason: { type: 'string' },
                  workaround: { type: 'string' },
                },
                required: ['item', 'reason', 'workaround'],
              },
            },
          },
          required: ['steps'],
        },
      },
      required: ['sourceInventory'],
    };

    // FIRST AI CALL: Use tools to explore data
    console.log('[Resolver] STEP 1: Exploring data with tools...');
    const explorationResult = await generateWithRookieAI({
      prompt: promptText,
      systemPrompt,
      apiKey: params.apiKey,
      model: 'gemini-2.5-flash',
      temperature: 0,
      maxOutputTokens: 32768,
      tools,
      toolExecutor,
      maxToolCalls: 20,
      // No responseSchema - just explore with tools
    });

    console.log('[Resolver] Exploration complete');
    console.log('[Resolver] Tool calls made:', explorationResult.toolCalls?.length || 0);
    console.log('[Resolver] Findings length:', explorationResult.text?.length || 0);

    // SECOND AI CALL: Convert findings to structured JSON
    console.log('[Resolver] STEP 2: Converting findings to structured JSON...');
    const structuredPrompt = `Based on your exploration of the source data, provide a complete RESOLVER analysis in structured JSON format.

Your findings from exploration:
${explorationResult.text}

Tool calls you made:
${JSON.stringify(explorationResult.toolCalls?.map(tc => ({ tool: tc.name, args: tc.args, result: tc.result })), null, 2)}

Now provide the complete analysis in JSON format with these sections:

**CRITICAL: Include termResolutions FIRST**
- termResolutions: Answers to ROOKIE's unclear terms based on what you found in source data

Then the phases:
- sourceInventory
- dimensionMaps (simplified as strings)
- metricMaps (simplified as strings)
- rookieReview (simplified as string)
- buildRecipe (with steps array)

Focus on providing concrete term resolutions and actionable build steps.`;

    const structuredResult = await generateWithRookieAI({
      prompt: structuredPrompt,
      systemPrompt: 'You are converting exploration findings into structured JSON format.',
      apiKey: params.apiKey,
      model: 'gemini-2.5-flash',
      temperature: 0,
      maxOutputTokens: 32768,
      responseSchema, // Now we can use structured output!
    });

    console.log('[Resolver] Structured output received');

    // Save raw response for debugging
    const fs = await import('fs');
    const path = await import('path');
    const debugDir = process.cwd() + '/output/debug';
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    const debugFile = path.join(debugDir, `resolver-raw-${Date.now()}.json`);
    fs.writeFileSync(debugFile, JSON.stringify({
      exploration: explorationResult.text,
      toolCalls: explorationResult.toolCalls,
      structured: structuredResult.json,
    }, null, 2), 'utf-8');
    console.log('[Resolver] Full response saved to:', debugFile);

    if (!structuredResult.json) {
      throw new Error('Failed to parse JSON response from second AI call');
    }

    const analysis = structuredResult.json;

    console.log('[Resolver] Structured output received');

    if (!analysis) {
      throw new Error('No analysis returned from structured call');
    }

    console.log('[Resolver] Parsed JSON keys:', Object.keys(analysis));
    console.log('[Resolver] Analysis complete');
    console.log('  - Terms resolved:', analysis.termResolutions?.length || 0);
    console.log('  - Source files inventoried:', analysis.sourceInventory?.length || 0);
    console.log('  - Build recipe steps:', analysis.buildRecipe?.steps?.length || 0);

    // Log term resolutions
    if (analysis.termResolutions && analysis.termResolutions.length > 0) {
      console.log('[Resolver] Term resolutions:');
      analysis.termResolutions.forEach((tr: TermResolution) => {
        console.log(`  - "${tr.term}" → ${tr.answer} (${tr.confidence})`);
      });
    }

    return {
      success: true,
      termResolutions: analysis.termResolutions,
      sourceInventory: analysis.sourceInventory,
      dimensionMaps: analysis.dimensionMaps,
      metricMaps: analysis.metricMaps,
      rookieReview: analysis.rookieReview,
      buildRecipe: analysis.buildRecipe,
    };
  } catch (error: any) {
    console.error('[Resolver] Error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}
