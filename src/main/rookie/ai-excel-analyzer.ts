/**
 * AI Excel Analyzer
 *
 * Uses Gemini AI to analyze Korean Excel files with complex "island table" structures
 */

import { generateWithRookieAI } from './rookie-ai-handler';

export interface DataNeed {
  field: string; // Simple field name (e.g., "거래일자", "금액", "거래처명")
  sources: string[]; // Simple list of possible sources (e.g., ["NH Bank", "Woori Bank"])
}

export interface TableSummary {
  name: string; // Table name/title
  purpose: string; // What this table is for
  dataNeeds: DataNeed[]; // What data this table needs
}

export interface ExcelAnalysisResult {
  success: boolean;
  tables: TableSummary[];
  totalTables: number;
  sheetName: string;
  summary: string;
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
}): Promise<ExcelAnalysisResult> {
  try {
    console.log('[AI Excel Analyzer] Analyzing Excel structure...');
    console.log('  - Sheet:', params.sheetName);
    console.log('  - HTML length:', params.html.length, 'chars');
    console.log('  - Has screenshot:', !!params.screenshot);

    // Build the prompt text - SIMPLIFIED for faster response
    let promptText = `You are analyzing a Korean Excel file to identify what data it needs.

HTML structure of the Excel sheet:
\`\`\`html
${params.html}
\`\`\`

Provide a SIMPLE analysis:

1. **Identify each table** - What is the table name/title?
2. **What is the purpose** of each table? (1 sentence)
3. **What data does it need?** - List the key data fields (like "거래일자", "금액", "거래처명", etc.)
4. **Where could this data come from?** - For each field, list 1-3 possible sources

**Keep it concise!** Just identify:
- Table names
- Data field names (from headers)
- Possible sources (simple names like "NH Bank", "Naver", "ERP System")

**Example format:**
- Table: "월별 매출 현황"
  - Purpose: "Track monthly sales"
  - Needs: "날짜" (sources: Manual), "매출액" (sources: POS System, Naver Shopping), "거래처" (sources: ERP)

Focus on WHAT data is needed and WHERE it might come from. Keep responses short.`;

    if (params.screenshot) {
      promptText = `[Image: Screenshot of Excel file]\n\n${promptText}`;
    }

    // Define SIMPLIFIED response schema for structured JSON output
    const responseSchema = {
      type: 'object',
      properties: {
        tables: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              purpose: { type: 'string' },
              dataNeeds: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    field: { type: 'string' },
                    sources: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                  },
                  required: ['field', 'sources'],
                },
              },
            },
            required: ['name', 'purpose', 'dataNeeds'],
          },
        },
        summary: { type: 'string' },
      },
      required: ['tables', 'summary'],
    };

    // Call Gemini API using dedicated Rookie AI handler
    const result = await generateWithRookieAI({
      prompt: promptText,
      apiKey: params.apiKey,
      model: 'gemini-2.5-flash',
      temperature: 0,
      maxOutputTokens: 32768, // Keep high for safety
      responseSchema,
    });

    console.log('[AI Excel Analyzer] Gemini API response received');

    if (!result.json) {
      throw new Error('Failed to parse JSON response from Gemini');
    }

    const analysis = result.json;

    console.log('[AI Excel Analyzer] Analysis complete');
    console.log('  - Tables found:', analysis.tables?.length || 0);

    return {
      success: true,
      tables: analysis.tables || [],
      totalTables: analysis.tables?.length || 0,
      sheetName: params.sheetName,
      summary: analysis.summary || 'No summary provided',
      suggestions: analysis.suggestions,
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
