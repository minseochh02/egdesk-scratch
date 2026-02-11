/**
 * RESOLVER v1.0 - Source-to-Report Mapping Agent
 *
 * Takes Rookie's comprehension + source data files
 * Returns: verified understanding + complete build recipe for the report
 */

import { generateWithRookieAI } from './rookie-ai-handler';
import { ExcelAnalysisResult } from './ai-excel-analyzer';
import { ExcelDataStore, queryExcelData, getDistinctValues } from './excel-query-tool';
import { enhanceHtmlWithMappings } from './html-mapping-enhancer';

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

export interface DataMapping {
  mappingId: string; // Unique ID like "mapping_1"
  sourceFile: string; // Exact file name (not "source1, source2")
  sourceColumn: string; // Exact column name
  operation: 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX' | 'CONCAT' | 'FIRST' | 'LAST' | 'VLOOKUP' | 'FILTER' | 'DIRECT'; // Specific operation
  filters?: Array<{
    column: string;
    operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'IN' | 'CONTAINS';
    value: string | string[];
  }>; // Optional filters for aggregation
  groupBy?: string[]; // Columns to group by (for aggregations)
  targetSection: string; // HTML table/section name from target
  targetCell?: string; // Cell reference (e.g., "B5") or field name
  targetFieldName: string; // Human-readable target field
  sampleCalculation?: string; // Example: "SUM(공급가액 WHERE 거래처='화성') = 5,200,000"
  confidence: 'verified' | 'probable' | 'needs_validation';
}

export interface BuildStep {
  step: number;
  targetSection: string;
  action: string;
  mappings: DataMapping[]; // Detailed source-to-target mappings
  description: string; // Human-readable description
  validation: string; // How to verify this step worked
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
  enhancedHtml?: string; // Target HTML with mapping metadata added
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

**queryExcelData**: Filter, group, and aggregate data
- fileId: file ID to query
- select: comma-separated columns/aggregations (e.g., "col1, SUM(col2), AVG(col3)")
- whereJson: JSON string of filters (e.g., '[{"column":"거래처","operator":"=","value":"화성"}]')
- groupBy: comma-separated columns (e.g., "region, product")
- limit: max rows

**getDistinctValues**: Get unique values from a column
- fileId: file ID
- column: column name
- limit: max values

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

**PHASE 2.5: UNDERSTAND CROSS-TABULATION STRUCTURE** ← CRITICAL
ROOKIE has analyzed the table structure:

${params.rookieAnalysis.tableStructure?.isCrossTabulation ? `
✅ **ROOKIE IDENTIFIED THIS AS CROSS-TABULATION (PIVOT TABLE)**

**Table Description:**
${params.rookieAnalysis.tableStructure.tableDescription}

**Rows represent:**
${params.rookieAnalysis.tableStructure.rowsRepresent}

**Columns represent:**
${params.rookieAnalysis.tableStructure.columnsRepresent}

**How to read cells:**
${params.rookieAnalysis.tableStructure.cellMeaning}

**Example - ${params.rookieAnalysis.tableStructure.exampleCellE7}**

**Metric Columns:**
${params.rookieAnalysis.tableStructure.metricColumns?.map((col: any) =>
  `- Column ${col.column} (${col.headerCell}): "${col.header}"`
).join('\n')}

**CRITICAL INSTRUCTIONS FOR CROSS-TABULATION:**

Each cell in a cross-tab = SUM(base_metric WHERE row_filter AND column_filters)

Your job is to DECOMPOSE each column header into:
1. **Base metric**: What are we measuring? (e.g., 중량, 금액)
2. **Column filters**: What conditions apply? (e.g., product type, transaction type)
3. **Row filter**: Which row category? (from leftmost column)

**Example for cell E7 (플래그십 판매 중량 for 화성):**

Step 1: Decompose column header "플래그십 판매 중량":
- Base metric: 중량 (weight)
- Product filter: 플래그십 → Use getDistinctValues to find which source column/value (e.g., 품목그룹3코드='FAL')
- Transaction type: 판매 (sales)

Step 2: Identify row filter "화성":
- Use getDistinctValues to find how "화성" appears in source (e.g., 거래처그룹1명='화성사업소')

Step 3: Combine into mapping:
{
  "targetCell": "E7",
  "sourceColumn": "중량",
  "operation": "SUM",
  "filters": [
    {"column": "거래처그룹1명", "operator": "=", "value": "화성사업소"},
    {"column": "품목그룹3코드", "operator": "=", "value": "FAL"}
  ]
}

**You MUST use query tools to discover:**
- Which source columns contain row labels (화성, 창원, etc.)
- Which source columns/values represent column categories (모빌, 플래그십, etc.)
- Which source column contains the base metric (중량, 금액)
` : `
⚠️ Not identified as cross-tabulation - proceed with regular mapping
`}

**PHASE 3: CREATE STRATEGIC EXAMPLE MAPPINGS**

**IMPORTANT: Create 5-10 EXAMPLE mappings that show the PATTERN, not every cell!**

For cross-tabulation tables, create TEMPLATE mappings:
- Pick 2-3 representative cells from DIFFERENT rows and columns
- Show the pattern of how row × column filters combine
- Others can be extrapolated from the pattern

For each example mapping:
- sourceFile: EXACT filename (not "source1, source2" - pick ONE file per mapping)
- sourceColumn: EXACT column name from that file
- operation: EXACT operation (SUM, AVG, COUNT, FIRST, DIRECT, etc.)
- filters: If aggregating, specify exact filters (e.g., [{"column": "거래처", "operator": "=", "value": "화성사업소"}])
- groupBy: Columns to group by (if applicable)
- targetSection: Which HTML table/section from target report
- targetCell: EXACT cell coordinate (e.g., "E7")
- targetFieldName: Human-readable name in target
- sampleCalculation: Show example with actual values

**CRITICAL**: Focus on QUALITY examples that demonstrate the pattern, not exhaustive mapping of every cell.

Example mapping:
{
  "mappingId": "map_001",
  "sourceFile": "매출현황_DB.xlsx",
  "sourceColumn": "공급가액",
  "operation": "SUM",
  "filters": [{"column": "거래처그룹1명", "operator": "=", "value": "화성사업소"}],
  "targetSection": "Sales Summary Table",
  "targetFieldName": "화성사업소 Net Sales",
  "sampleCalculation": "SUM(공급가액 WHERE 거래처그룹1명='화성사업소') = 5,200,000",
  "confidence": "verified"
}

**PHASE 4: ROOKIE REVIEW**
- Verify/correct Rookie's formulas
- Resolve Rookie's unknowns with source data evidence
- Note new discoveries from source data

**PHASE 5: BUILD RECIPE WITH DETAILED MAPPINGS**
Create build steps, where EACH step contains:
- step: number
- targetSection: which target section this builds
- action: brief description
- mappings: ARRAY of DataMapping objects (from Phase 3)
- description: human-readable explanation
- validation: how to verify correctness

Group related mappings into logical build steps.

Use the query tools extensively to explore and verify mappings. Document your findings in detail.`;

    // SIMPLIFIED tools - avoid "too many states" error by using simple string types
    const tools = [
      {
        functionDeclarations: [
          {
            name: 'queryExcelData',
            description: 'Query Excel data',
            parameters: {
              type: 'object',
              properties: {
                fileId: { type: 'string' },
                select: { type: 'string' }, // Comma-separated: "col1, SUM(col2)"
                whereJson: { type: 'string' }, // JSON string: '[{"column":"x","operator":"=","value":"y"}]'
                groupBy: { type: 'string' }, // Comma-separated: "col1, col2"
                limit: { type: 'number' },
              },
              required: ['fileId', 'select'],
            },
          },
          {
            name: 'getDistinctValues',
            description: 'Get distinct values from column',
            parameters: {
              type: 'object',
              properties: {
                fileId: { type: 'string' },
                column: { type: 'string' },
                limit: { type: 'number' },
              },
              required: ['fileId', 'column'],
            },
          },
        ],
      },
    ];

    // Tool executor - parse simplified string formats back to expected types
    const toolExecutor = async (toolName: string, args: any) => {
      console.log(`[Resolver] Executing tool: ${toolName}`, args);

      switch (toolName) {
        case 'queryExcelData': {
          const queryArgs: any = {
            fileId: args.fileId,
            select: [],
            where: undefined,
            groupBy: undefined,
            limit: args.limit,
          };

          // Parse select (comma-separated string to array)
          if (typeof args.select === 'string') {
            queryArgs.select = args.select.split(',').map((s: string) => s.trim());
          } else if (Array.isArray(args.select)) {
            queryArgs.select = args.select;
          }

          // Parse whereJson (JSON string to array)
          if (args.whereJson && typeof args.whereJson === 'string') {
            try {
              queryArgs.where = JSON.parse(args.whereJson);
            } catch (e) {
              console.warn(`[Resolver] Failed to parse whereJson:`, args.whereJson);
            }
          } else if (args.where) {
            queryArgs.where = args.where;
          }

          // Parse groupBy (comma-separated string to array)
          if (typeof args.groupBy === 'string') {
            queryArgs.groupBy = args.groupBy.split(',').map((s: string) => s.trim());
          } else if (Array.isArray(args.groupBy)) {
            queryArgs.groupBy = args.groupBy;
          }

          return queryExcelData(params.sourceFilesData, queryArgs);
        }
        case 'getDistinctValues':
          return getDistinctValues(params.sourceFilesData, args.fileId, args.column, args.limit);
        default:
          return { success: false, error: `Unknown tool: ${toolName}` };
      }
    };

    // NOTE: No responseSchema - Gemini structured output rejects complex schemas
    // We'll use plain text JSON generation and parse manually

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

    // STEP 1.5: Summarize exploration findings
    console.log('[Resolver] STEP 1.5: Summarizing exploration findings...');
    const summaryPrompt = `Summarize your exploration findings concisely (max 2000 characters).

Focus on:
1. Key columns found in each source file
2. How row labels (e.g., 화성, 창원) map to source columns/values
3. How column metrics (e.g., 플래그십 판매 중량) map to source columns/values
4. Critical discoveries about data structure

Your full exploration:
${explorationResult.text}

Provide a concise summary focusing ONLY on the mapping insights.`;

    const summaryResult = await generateWithRookieAI({
      prompt: summaryPrompt,
      systemPrompt: 'You are a technical summarizer. Extract only the key mapping insights in 2000 characters or less.',
      apiKey: params.apiKey,
      model: 'gemini-2.5-flash',
      temperature: 0,
      maxOutputTokens: 2048,
    });

    console.log('[Resolver] Summary complete, length:', summaryResult.text.length);

    // SECOND AI CALL: Generate structured mappings from summary
    console.log('[Resolver] STEP 2: Generating structured mappings from summary...');
    const structuredPrompt = `Based on the summary of exploration findings, generate a CONCISE RESOLVER analysis.

**Summary of key findings:**
${summaryResult.text}

**Tool calls made (for reference):**
${JSON.stringify(explorationResult.toolCalls?.slice(0, 5).map(tc => ({ tool: tc.name, args: tc.args })), null, 2)}

Now provide the complete analysis in JSON format with these sections:

**CRITICAL: Include termResolutions FIRST**
- termResolutions: Answers to ROOKIE's unclear terms based on what you found in source data

Then the phases:
- sourceInventory (omit sampleValues to save space)
- dimensionMaps (brief 1-2 sentence summary)
- metricMaps (brief 1-2 sentence summary)
- rookieReview (brief 1-2 sentence summary)
- buildRecipe (with 3-5 strategic steps showing patterns)

**CRITICAL FOR buildRecipe.steps:**

**CREATE ONLY 3-5 STEPS WITH 2-3 EXAMPLE MAPPINGS EACH (10-15 total mappings max)**

For cross-tabulation tables:
- Don't map every single cell
- Show 2-3 example cells that demonstrate the pattern
- Focus on cells from different row/column combinations

Each step MUST contain a "mappings" array with detailed DataMapping objects.

Example step:
{
  "step": 1,
  "targetSection": "Sales Summary Table",
  "action": "Calculate sales by region",
  "mappings": [
    {
      "mappingId": "map_001",
      "sourceFile": "매출현황_DB.xlsx",
      "sourceColumn": "공급가액",
      "operation": "SUM",
      "filters": [
        {"column": "거래처그룹1명", "operator": "=", "value": "화성사업소"}
      ],
      "targetCell": "E7",
      "targetFieldName": "화성사업소 Net Sales",
      "sampleCalculation": "SUM(공급가액 WHERE 거래처='화성') = 5200000"
    }
  ],
  "description": "Aggregate sales by business unit",
  "validation": "Verify totals match"
}

**RULES:**
1. Use EXACT filenames from sourceInventory (not "source1", "source2")
2. Create ONE mapping per source→target connection
3. If one target field uses multiple sources, create MULTIPLE mappings
4. Always specify the operation type explicitly
5. Include filters when aggregating data
6. Provide sample calculations with actual values you found
7. **FOCUS ON QUALITY OVER QUANTITY**: Create 2-5 example mappings per step, NOT every possible mapping
8. **PRIORITIZE KEY CELLS**: Focus on cells with actual data, skip empty cells and totals unless specifically needed
9. **BE CONCISE**: Omit sampleValues from columns to reduce JSON size

Focus on providing concrete, executable mappings that can be visualized and automated. Keep JSON response under 50KB.`;

    const structuredResult = await generateWithRookieAI({
      prompt: structuredPrompt + '\n\nReturn a valid JSON object with the sections described. Keep it concise.',
      systemPrompt: 'Generate concise JSON. Max 10-15 mappings total, brief summaries only.',
      apiKey: params.apiKey,
      model: 'gemini-2.5-flash',
      temperature: 0,
      maxOutputTokens: 32768,
    });

    console.log('[Resolver] Structured output received');

    // Parse JSON from text response (no schema validation)
    let analysis: any;
    try {
      const jsonText = structuredResult.text.trim();
      // Remove markdown code blocks if present
      const cleaned = jsonText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
      analysis = JSON.parse(cleaned);
      console.log('[Resolver] ✓ Successfully parsed JSON from text response');
    } catch (parseError: any) {
      console.error('[Resolver] Failed to parse JSON:', parseError);
      throw new Error(`Failed to parse JSON response: ${parseError.message}`);
    }

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
      structured: analysis,
    }, null, 2), 'utf-8');
    console.log('[Resolver] Full response saved to:', debugFile);

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

    // Enhance HTML with mapping metadata
    let enhancedHtml: string | undefined;
    if (params.targetHtml && analysis.buildRecipe) {
      console.log('[Resolver] Enhancing HTML with mapping metadata...');
      try {
        enhancedHtml = enhanceHtmlWithMappings(params.targetHtml, {
          buildRecipe: analysis.buildRecipe,
        });
        console.log('[Resolver] ✓ HTML enhanced with mappings');
      } catch (error) {
        console.error('[Resolver] Failed to enhance HTML:', error);
        // Continue without enhanced HTML
      }
    }

    return {
      success: true,
      termResolutions: analysis.termResolutions,
      sourceInventory: analysis.sourceInventory,
      dimensionMaps: analysis.dimensionMaps,
      metricMaps: analysis.metricMaps,
      rookieReview: analysis.rookieReview,
      buildRecipe: analysis.buildRecipe,
      enhancedHtml: enhancedHtml || params.targetHtml, // Fall back to original HTML
    };
  } catch (error: any) {
    console.error('[Resolver] Error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}
