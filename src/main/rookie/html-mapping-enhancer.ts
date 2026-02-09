/**
 * HTML Mapping Enhancer
 *
 * Adds resolver mapping metadata to HTML cells for interactive visualization
 * Enables hover tooltips showing source → operation → target mappings
 */

import * as cheerio from 'cheerio';

export interface DataMapping {
  mappingId: string;
  sourceFile: string;
  sourceColumn: string;
  operation: string;
  filters?: Array<{
    column: string;
    operator: string;
    value: string | string[];
  }>;
  groupBy?: string[];
  targetSection?: string;
  targetCell?: string;
  targetFieldName: string;
  sampleCalculation?: string;
  confidence: string;
}

export interface BuildStep {
  step: number;
  targetSection: string;
  action: string;
  mappings: DataMapping[];
  description: string;
  validation: string;
}

export interface ResolverData {
  buildRecipe?: {
    steps: BuildStep[];
  };
}

/**
 * Enhance HTML with mapping metadata from resolver analysis
 */
export function enhanceHtmlWithMappings(html: string, resolverData: ResolverData): string {
  if (!resolverData?.buildRecipe?.steps) {
    console.log('[HTML Enhancer] No resolver data, returning original HTML');
    return html;
  }

  console.log('[HTML Enhancer] Starting HTML enhancement...');

  // Extract all mappings from build steps
  const allMappings: DataMapping[] = [];
  for (const step of resolverData.buildRecipe.steps) {
    if (step.mappings && Array.isArray(step.mappings)) {
      allMappings.push(...step.mappings);
    }
  }

  console.log(`[HTML Enhancer] Found ${allMappings.length} total mappings`);

  if (allMappings.length === 0) {
    return html;
  }

  try {
    // Parse HTML with cheerio
    const $ = cheerio.load(html);

    let enhancedCount = 0;

    // Strategy 1: Match by cell coordinates (if targetCell is specified like "B5")
    for (const mapping of allMappings) {
      if (mapping.targetCell) {
        $('[data-cell]').each((i, elem) => {
          const cellCoord = $(elem).attr('data-cell');
          if (cellCoord === mapping.targetCell) {
            addMappingToElement($, elem, mapping);
            enhancedCount++;
            console.log(`[HTML Enhancer] ✓ Matched ${mapping.mappingId} to cell ${cellCoord}`);
          }
        });
      }
    }

    // Strategy 2: Match by field name (fuzzy text matching in cells)
    for (const mapping of allMappings) {
      if (!mapping.targetCell && mapping.targetFieldName) {
        // Find cells containing this field name
        $('td, th').each((i, elem) => {
          const cellText = $(elem).text().trim();

          // Skip if already has mapping
          if ($(elem).attr('data-mapping-id')) {
            return; // continue in cheerio
          }

          // Check if cell text matches target field name (fuzzy)
          if (fuzzyMatch(cellText, mapping.targetFieldName)) {
            addMappingToElement($, elem, mapping);
            enhancedCount++;
            console.log(`[HTML Enhancer] ✓ Matched ${mapping.mappingId} to text "${cellText}"`);
          }
        });
      }
    }

    console.log(`[HTML Enhancer] Enhanced ${enhancedCount} cells with mapping metadata`);

    // Add CSS for hover effects if we enhanced any cells
    if (enhancedCount > 0) {
      const styleContent = `
        /* Mapping hover effects */
        .has-mapping {
          cursor: help;
          position: relative;
        }

        .has-mapping:hover {
          background-color: rgba(46, 125, 50, 0.2) !important;
          outline: 2px solid #2E7D32;
          outline-offset: -2px;
        }

        .confidence-verified:hover {
          outline-color: #2E7D32;
        }

        .confidence-probable:hover {
          outline-color: #FFA726;
        }

        .confidence-needs_validation:hover {
          outline-color: #EF5350;
        }

        /* Optional: Add a small indicator icon */
        .has-mapping::after {
          content: '🔗';
          position: absolute;
          top: 2px;
          right: 2px;
          font-size: 10px;
          opacity: 0.5;
        }

        .has-mapping:hover::after {
          opacity: 1;
        }
      `;
      $('head').append(`<style>${styleContent}</style>`);
    }

    // Return enhanced HTML
    return $.html();
  } catch (error) {
    console.error('[HTML Enhancer] Error enhancing HTML:', error);
    return html; // Return original on error
  }
}

/**
 * Add mapping metadata to an HTML element (cheerio version)
 */
function addMappingToElement($: cheerio.CheerioAPI, element: cheerio.Element, mapping: DataMapping): void {
  const $elem = $(element);

  // Add data attributes for JavaScript access
  $elem.attr('data-mapping-id', mapping.mappingId);
  $elem.attr('data-source-file', mapping.sourceFile);
  $elem.attr('data-source-column', mapping.sourceColumn);
  $elem.attr('data-operation', mapping.operation);
  $elem.attr('data-confidence', mapping.confidence);

  if (mapping.targetFieldName) {
    $elem.attr('data-target-field', mapping.targetFieldName);
  }

  // Build filter string
  if (mapping.filters && mapping.filters.length > 0) {
    const filterStr = mapping.filters
      .map(f => `${f.column} ${f.operator} ${JSON.stringify(f.value)}`)
      .join(', ');
    $elem.attr('data-filters', filterStr);
  }

  // Build sample calculation
  if (mapping.sampleCalculation) {
    $elem.attr('data-sample', mapping.sampleCalculation);
  }

  // Build human-readable title for native tooltip
  const titleParts = [
    `📊 Source: ${mapping.sourceFile}`,
    `📋 Column: ${mapping.sourceColumn}`,
    `🔢 Operation: ${mapping.operation}`,
  ];

  if (mapping.filters && mapping.filters.length > 0) {
    const filterStr = mapping.filters
      .map(f => `${f.column} ${f.operator} ${f.value}`)
      .join(', ');
    titleParts.push(`🔍 Filters: ${filterStr}`);
  }

  if (mapping.sampleCalculation) {
    titleParts.push(`📝 Example: ${mapping.sampleCalculation}`);
  }

  titleParts.push(`✓ Confidence: ${mapping.confidence}`);

  $elem.attr('title', titleParts.join('\n'));

  // Add CSS class for styling
  $elem.addClass('has-mapping');
  $elem.addClass(`confidence-${mapping.confidence}`);
}

/**
 * Fuzzy match two strings (case-insensitive, ignoring extra spaces)
 */
function fuzzyMatch(text1: string, text2: string): boolean {
  const normalize = (str: string) =>
    str.toLowerCase()
       .replace(/\s+/g, ' ')
       .trim();

  const normalized1 = normalize(text1);
  const normalized2 = normalize(text2);

  // CRITICAL: Don't match empty strings
  if (!normalized1 || !normalized2) {
    return false;
  }

  // CRITICAL: Both strings should be reasonably long for fuzzy matching
  if (normalized1.length < 3 || normalized2.length < 3) {
    return false;
  }

  // Exact match
  if (normalized1 === normalized2) {
    return true;
  }

  // Contains match (for longer descriptions)
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    return true;
  }

  // Check if they share significant words
  const words1 = normalized1.split(' ');
  const words2 = normalized2.split(' ');

  // If they share more than 50% of words, consider it a match
  const sharedWords = words1.filter(w => words2.includes(w) && w.length > 2);
  const minWords = Math.min(words1.length, words2.length);

  if (minWords > 0 && sharedWords.length / minWords > 0.5) {
    return true;
  }

  return false;
}

/**
 * Get cell coordinate from row/column indices (0-based to Excel-style)
 */
export function getCellCoordinate(row: number, col: number): string {
  // Convert column index to letter (0 = A, 1 = B, etc.)
  let colLetter = '';
  let tempCol = col;
  while (tempCol >= 0) {
    colLetter = String.fromCharCode((tempCol % 26) + 65) + colLetter;
    tempCol = Math.floor(tempCol / 26) - 1;
  }

  // Row is 1-based in Excel
  return `${colLetter}${row + 1}`;
}

/**
 * Parse cell coordinate to row/column indices
 */
export function parseCellCoordinate(coord: string): { row: number; col: number } | null {
  const match = coord.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;

  const colLetter = match[1];
  const rowNum = parseInt(match[2], 10);

  // Convert column letter to index
  let col = 0;
  for (let i = 0; i < colLetter.length; i++) {
    col = col * 26 + (colLetter.charCodeAt(i) - 64);
  }
  col -= 1; // Make 0-based

  const row = rowNum - 1; // Make 0-based

  return { row, col };
}
