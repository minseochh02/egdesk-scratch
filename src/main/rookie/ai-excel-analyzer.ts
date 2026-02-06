/**
 * AI Excel Analyzer
 *
 * Uses Gemini AI to analyze Korean Excel files with complex "island table" structures
 */

import { generateWithRookieAI } from './rookie-ai-handler';

// DATA-ORIENTED ROOKIE Interfaces

export interface ReportContext {
  company: string;
  reportPurpose: string;
  period: string;
  dataStory: string;
}

export interface Dimension {
  name: string;
  values: string[];
  description: string;
  unclearTerms?: string[]; // Terms in this dimension that are unclear
}

export interface Measure {
  name: string;
  unit: string;
  description: string;
  questions?: string[]; // What's unclear about this measure
}

export interface Calculation {
  name: string;
  logic: string;
  example?: string;
  unclear?: string; // What's unclear about this calculation
}

export interface RawDataNeeds {
  description: string;
  fields: string[];
  sources: string[];
}

export interface ExcelAnalysisResult {
  success: boolean;
  sheetName: string;
  reportContext?: ReportContext;
  dimensions?: Dimension[];
  measures?: Measure[];
  calculations?: Calculation[];
  rawDataNeeds?: RawDataNeeds;
  unclearTerms?: string[]; // Overall list of terms that need research
  error?: string;
}

/**
 * Analyze Excel structure using Gemini AI
 */
export async function analyzeExcelStructure(params: {
  html: string;
  sheetName: string;
  apiKey?: string;
  screenshot?: string; // base64 PNG (optional)
  availableSourceFiles?: string[]; // Names of available source files
}): Promise<ExcelAnalysisResult> {
  try {
    console.log('[AI Excel Analyzer] Analyzing Excel structure...');
    console.log('  - Sheet:', params.sheetName);
    console.log('  - HTML length:', params.html.length, 'chars');
    console.log('  - Has screenshot:', !!params.screenshot);

    // Build the prompt text - DATA-ORIENTED ROOKIE
    const systemPrompt = `You are **Rookie**, a brand new analyst on day 1 at this company.

You have NEVER seen their systems, reports, or terminology before.

**Your mindset:**
- You DON'T understand company-specific abbreviations, codes, or terms
- You DON'T know what their Korean business terminology means
- You CAN observe patterns (groupings, sums, time periods)
- You MUST flag every unclear term as something to research

**When you see an unfamiliar term:**
- Don't assume what it means
- Don't make up a plausible explanation
- Just note: "UNCLEAR: [term] - need to research what this means"

Think like a real new hire: observe patterns, copy exact terms, ask questions about what's unclear.`;


    let promptText = `You're seeing this company's report for the FIRST TIME. You don't know what their specific terms mean.

Report: "${params.sheetName}"

${params.availableSourceFiles && params.availableSourceFiles.length > 0 ? `
**AVAILABLE SOURCE FILES:**
${params.availableSourceFiles.map((f, i) => `${i + 1}. ${f}`).join('\n')}

You can see what source files are available. Use these file names as hints when guessing where data might come from.
` : ''}

\`\`\`html
${params.html}
\`\`\`

Analyze as a genuinely NEW person would:

**1. BASIC CONTEXT**
What can you infer without knowing their terminology?
- Company/business
- Report purpose (sales? inventory? financial?)
- Time period visible
- General data story

**2. DATA DIMENSIONS**
For each way data is broken down:
- Pattern name: [your hypothesis - geography? time? product?]
- Values seen: [copy EXACT terms from report]
- Description: [what you THINK this might be]
- **Unclear terms**: [list ANY terms/abbreviations you don't understand - don't assume meanings!]

If you see an abbreviation, code, or Korean term you don't recognize - FLAG IT. Don't guess.

**3. MEASURES**
For each number tracked:
- Name: [EXACT term from report]
- Unit: [if clear, specify. If unclear, say "UNKNOWN"]
- Description: [what you think it measures - or "UNCLEAR" if you can't tell]
- **Questions**: [What is confusing about this measure?]

**4. CALCULATIONS**
Observe patterns in the numbers:
- Describe what you SEE (row sums, cumulative totals, etc.)
- Don't explain HOW they work unless obvious
- Note what's UNCLEAR

**5. RAW DATA NEEDS**
Based purely on the patterns you observe, what would raw data need?
- Expected fields
- Possible sources

**CRITICAL RULE: If you don't understand a term, say "UNCLEAR: [term]" and add it to your questions. Do NOT make up meanings for abbreviations or domain-specific terms.`;

    if (params.screenshot) {
      promptText = `[Image: Screenshot of Excel file]\n\n${promptText}`;
    }

    // Define DATA-ORIENTED response schema
    const responseSchema = {
      type: 'object',
      properties: {
        reportContext: {
          type: 'object',
          properties: {
            company: { type: 'string' },
            reportPurpose: { type: 'string' },
            period: { type: 'string' },
            dataStory: { type: 'string' },
          },
          required: ['company', 'reportPurpose', 'period', 'dataStory'],
        },
        dimensions: {
          type: 'array',
          description: 'Data dimensions (how data is broken down)',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Your hypothesis for dimension name' },
              values: { type: 'array', items: { type: 'string' }, description: 'EXACT values from report' },
              description: { type: 'string', description: 'What you THINK this represents' },
              unclearTerms: { type: 'array', items: { type: 'string' }, description: 'Terms you dont understand' },
            },
            required: ['name', 'values', 'description'],
          },
        },
        measures: {
          type: 'array',
          description: 'Numeric data being tracked',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'EXACT term from report' },
              unit: { type: 'string', description: 'Unit if clear, or UNKNOWN' },
              description: { type: 'string', description: 'What you think it measures, or UNCLEAR' },
              questions: { type: 'array', items: { type: 'string' }, description: 'Questions about this measure' },
            },
            required: ['name', 'unit', 'description'],
          },
        },
        calculations: {
          type: 'array',
          description: 'Calculations observed',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              logic: { type: 'string', description: 'What you observe, not assumed logic' },
              example: { type: 'string' },
              unclear: { type: 'string', description: 'What is unclear about this' },
            },
            required: ['name', 'logic'],
          },
        },
        unclearTerms: {
          type: 'array',
          items: { type: 'string' },
          description: 'Overall list of all unclear terms/abbreviations that need research',
        },
        rawDataNeeds: {
          type: 'object',
          properties: {
            description: { type: 'string', description: 'What raw data would someone need to build this?' },
            fields: { type: 'array', items: { type: 'string' }, description: 'Field names the raw data should have' },
            sources: { type: 'array', items: { type: 'string' }, description: 'Where this data might come from' },
          },
          required: ['description', 'fields', 'sources'],
        },
        unclearTerms: {
          type: 'array',
          items: { type: 'string' },
          description: 'All unclear terms/abbreviations/codes that need research',
        },
      },
      required: ['reportContext', 'dimensions', 'measures', 'calculations', 'rawDataNeeds'],
    };

    // Call Gemini API using dedicated Rookie AI handler
    const result = await generateWithRookieAI({
      prompt: promptText,
      systemPrompt,
      apiKey: params.apiKey,
      model: 'gemini-2.5-flash',
      temperature: 0,
      maxOutputTokens: 32768, // Keep high for comprehensive analysis
      responseSchema,
    });

    console.log('[AI Excel Analyzer] Gemini API response received');

    if (!result.json) {
      throw new Error('Failed to parse JSON response from Gemini');
    }

    const analysis = result.json;

    console.log('[AI Excel Analyzer] ROOKIE data-oriented analysis complete');
    console.log('  - Dimensions found:', analysis.dimensions?.length || 0);
    console.log('  - Measures found:', analysis.measures?.length || 0);
    console.log('  - Calculations found:', analysis.calculations?.length || 0);
    console.log('  - Unclear terms:', analysis.unclearTerms?.length || 0);

    return {
      success: true,
      sheetName: params.sheetName,
      reportContext: analysis.reportContext,
      dimensions: analysis.dimensions,
      measures: analysis.measures,
      calculations: analysis.calculations,
      rawDataNeeds: analysis.rawDataNeeds,
      unclearTerms: analysis.unclearTerms,
    };
  } catch (error: any) {
    console.error('[AI Excel Analyzer] Error:', error);
    return {
      success: false,
      tables: [],
      totalTables: 0,
      sheetName: params.sheetName,
      summary: '',
      error: error.message,
    };
  }
}
