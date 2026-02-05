/**
 * AI Excel Analyzer
 *
 * Uses Gemini AI to analyze Korean Excel files with complex "island table" structures
 */

import { generateWithRookieAI } from './rookie-ai-handler';

export interface DataField {
  fieldName: string; // Name of the data field
  header: string; // Column header text
  location: {
    row: number;
    col: number;
  };
  fieldType: 'input' | 'output' | 'calculated'; // Type of field
  dataType: string; // Expected data type (text, number, date, currency, etc.)
  sampleValue?: string; // Sample value if available
  dataSources: Array<{
    type: 'web' | 'app' | 'api' | 'manual' | 'file' | 'database';
    name: string; // Name of the source (e.g., "NH Bank Website", "ERP System")
    description: string; // How to get this data
    confidence: 'high' | 'medium' | 'low'; // Confidence in this source
  }>;
  description: string; // What this field represents
}

export interface ExcelTable {
  id: string;
  name: string;
  position: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  };
  headers: Array<{
    level: number;
    text: string;
    col: number;
    isMerged?: boolean;
  }>;
  dataRowCount: number;
  dataFields: DataField[]; // Detailed breakdown of data fields
  inputCells?: Array<{
    row: number;
    col: number;
    label: string;
  }>;
  outputCells?: Array<{
    row: number;
    col: number;
    label: string;
    formula?: string;
  }>;
}

export interface ExcelAnalysisResult {
  success: boolean;
  tables: ExcelTable[];
  totalTables: number;
  sheetName: string;
  summary: string;
  suggestions?: string[];
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

    // Build the prompt text
    let promptText = `You are an expert at analyzing Korean Excel files and identifying automation opportunities.

This is a Korean Excel file that may contain multiple separate tables on one sheet (called "island tables").
These tables often have:
- Merged cells for titles and headers
- Multi-level headers (headers with sub-headers)
- Mixed Korean and English text
- Visual spatial organization (tables separated by empty rows/columns)

HTML structure of the Excel sheet:
\`\`\`html
${params.html}
\`\`\`

Analyze this Excel file and provide a complete breakdown:

1. **Identify all separate tables** (if multiple tables exist on this sheet)
   - Where does each table start and end?
   - What is the title of each table (usually a merged cell)?

2. **For each table, identify ALL DATA FIELDS:**
   - Field name and header text
   - Location (row, column)
   - Field type: input (user fills), output (calculated), or calculated (formula-based)
   - Data type: text, number, date, currency, percentage, etc.
   - Sample value if visible in the HTML

3. **For each data field, identify WHERE THIS DATA COULD COME FROM:**
   - **Web sources**: Banking websites, government portals, e-commerce sites, etc.
   - **App sources**: Desktop applications, ERP systems, accounting software, etc.
   - **API sources**: REST APIs, web services, third-party integrations
   - **Manual input**: Data that must be entered by hand
   - **File sources**: Import from CSV, Excel, PDF, etc.
   - **Database sources**: SQL databases, cloud databases, etc.

   For each data source, provide:
   - Type of source (web/app/api/manual/file/database)
   - Name of the source (e.g., "NH Bank Website", "Naver", "Company ERP")
   - Description of how to get this data
   - Confidence level (high/medium/low) - how confident are you this is the right source

4. **Provide overall summary:**
   - Purpose of this spreadsheet
   - How the tables relate to each other (if applicable)
   - Automation opportunities

**IMPORTANT**: Be specific about data sources. If you see "거래내역" (transaction history), suggest banking websites.
If you see "매출" (sales), suggest e-commerce platforms or ERP systems. If you see dates, amounts, and descriptions,
these typically come from financial systems. Think about REAL-WORLD sources where this data actually exists.

Be thorough and detailed. This analysis will be used to automate data collection and entry into this Excel file.`;

    if (params.screenshot) {
      promptText = `[Image: Screenshot of Excel file]\n\n${promptText}`;
    }

    // Define response schema for structured JSON output
    const responseSchema = {
      type: 'object',
      properties: {
        tables: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              position: {
                type: 'object',
                properties: {
                  startRow: { type: 'number' },
                  startCol: { type: 'number' },
                  endRow: { type: 'number' },
                  endCol: { type: 'number' },
                },
                required: ['startRow', 'startCol', 'endRow', 'endCol'],
              },
              headers: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    level: { type: 'number' },
                    text: { type: 'string' },
                    col: { type: 'number' },
                    isMerged: { type: 'boolean' },
                  },
                  required: ['level', 'text', 'col'],
                },
              },
              dataRowCount: { type: 'number' },
              dataFields: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    fieldName: { type: 'string' },
                    header: { type: 'string' },
                    location: {
                      type: 'object',
                      properties: {
                        row: { type: 'number' },
                        col: { type: 'number' },
                      },
                      required: ['row', 'col'],
                    },
                    fieldType: {
                      type: 'string',
                      enum: ['input', 'output', 'calculated'],
                    },
                    dataType: { type: 'string' },
                    sampleValue: { type: 'string' },
                    dataSources: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          type: {
                            type: 'string',
                            enum: ['web', 'app', 'api', 'manual', 'file', 'database'],
                          },
                          name: { type: 'string' },
                          description: { type: 'string' },
                          confidence: {
                            type: 'string',
                            enum: ['high', 'medium', 'low'],
                          },
                        },
                        required: ['type', 'name', 'description', 'confidence'],
                      },
                    },
                    description: { type: 'string' },
                  },
                  required: ['fieldName', 'header', 'location', 'fieldType', 'dataType', 'dataSources', 'description'],
                },
              },
              inputCells: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    row: { type: 'number' },
                    col: { type: 'number' },
                    label: { type: 'string' },
                  },
                  required: ['row', 'col', 'label'],
                },
              },
              outputCells: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    row: { type: 'number' },
                    col: { type: 'number' },
                    label: { type: 'string' },
                    formula: { type: 'string' },
                  },
                  required: ['row', 'col', 'label'],
                },
              },
            },
            required: ['id', 'name', 'position', 'headers', 'dataRowCount', 'dataFields'],
          },
        },
        summary: { type: 'string' },
        suggestions: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['tables', 'summary'],
    };

    // Call Gemini API using dedicated Rookie AI handler
    const result = await generateWithRookieAI({
      prompt: promptText,
      apiKey: params.apiKey,
      model: 'gemini-2.0-flash-exp',
      temperature: 0,
      maxOutputTokens: 8192,
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
