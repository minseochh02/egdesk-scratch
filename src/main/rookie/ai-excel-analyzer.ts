/**
 * AI Excel Analyzer
 *
 * Uses Claude AI to analyze Korean Excel files with complex "island table" structures
 */

import Anthropic from '@anthropic-ai/sdk';

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
 * Analyze Excel structure using Claude AI
 */
export async function analyzeExcelStructure(params: {
  html: string;
  sheetName: string;
  apiKey: string;
  screenshot?: string; // base64 PNG (optional)
}): Promise<ExcelAnalysisResult> {
  try {
    const anthropic = new Anthropic({
      apiKey: params.apiKey,
    });

    console.log('[AI Excel Analyzer] Analyzing Excel structure...');
    console.log('  - Sheet:', params.sheetName);
    console.log('  - HTML length:', params.html.length, 'chars');
    console.log('  - Has screenshot:', !!params.screenshot);

    // Build the prompt
    const content: any[] = [];

    // Add screenshot if available (multimodal analysis)
    if (params.screenshot) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/png',
          data: params.screenshot,
        },
      });
    }

    // Add text prompt with HTML
    content.push({
      type: 'text',
      text: `You are an expert at analyzing Korean Excel files with complex layouts.

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

2. **For each table, identify:**
   - Headers and sub-headers (hierarchical structure)
   - Which cells are likely INPUT cells (user fills these)
   - Which cells are likely OUTPUT cells (formulas, calculations, summaries)
   - Data row structure

3. **Provide overall summary:**
   - Purpose of this spreadsheet
   - How the tables relate to each other (if applicable)
   - Any patterns you notice

Return your analysis as a JSON object with this structure:
\`\`\`json
{
  "tables": [
    {
      "id": "table_1",
      "name": "Table title in Korean/English",
      "position": {
        "startRow": 1,
        "startCol": 1,
        "endRow": 10,
        "endCol": 5
      },
      "headers": [
        { "level": 1, "text": "Header text", "col": 1, "isMerged": false }
      ],
      "dataRowCount": 5,
      "inputCells": [
        { "row": 3, "col": 2, "label": "Description of what goes here" }
      ],
      "outputCells": [
        { "row": 10, "col": 5, "label": "Total", "formula": "SUM" }
      ]
    }
  ],
  "summary": "Overall description of spreadsheet purpose",
  "suggestions": ["Optional suggestions for automation"]
}
\`\`\`

Be thorough and detailed. This analysis will be used to automate data entry into this Excel file.`,
    });

    // Call Claude API (using latest model - Sonnet 4.5)
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4000,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content,
        },
      ],
    });

    console.log('[AI Excel Analyzer] Claude API response received');

    // Extract JSON from response
    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Parse JSON (may be wrapped in markdown code blocks)
    let jsonText = textContent.text.trim();

    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const analysis = JSON.parse(jsonText);

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
