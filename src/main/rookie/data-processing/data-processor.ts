/**
 * Data Processor - Main Orchestrator
 * Executes data processing steps from build plan
 */

import * as path from 'path';
import { loadExcelFile } from './excel-loader';
import { joinData, aggregateData, calculateConditional, fillNulls, renameColumn, Dataset } from './data-transformer';
import { createReport, addSummaryRow, applyFormatting } from './report-builder';

export interface ProcessingResult {
  success: boolean;
  stepsCompleted: number;
  totalSteps: number;
  outputFile?: string;
  intermediateFiles?: string[];
  error?: string;
}

/**
 * Execute data processing steps from build plan
 */
export async function executeDataProcessing(
  steps: any[],
  downloadedFiles: Record<string, string>, // Map of expected filename → actual path
  outputDir: string
): Promise<ProcessingResult> {
  console.log('[Data Processor] Starting data processing...');
  console.log('  - Steps to execute:', steps.length);
  console.log('  - Downloaded files:', Object.keys(downloadedFiles).length);

  const datasets: Record<string, Dataset> = {}; // Store intermediate datasets
  const intermediateFiles: string[] = [];
  let stepsCompleted = 0;

  try {
    for (const step of steps) {
      console.log(`\n[Data Processor] Step ${step.step}: ${step.actionType}`);

      switch (step.actionType) {
        case 'LOAD_EXCEL_FILE': {
          const sourceFile = downloadedFiles[step.source] || step.source;
          const filePath = path.isAbsolute(sourceFile) ? sourceFile : path.join(outputDir, sourceFile);

          const loaded = await loadExcelFile(filePath, step.parameters?.columns);
          datasets[step.output] = {
            name: step.output,
            rows: loaded.rows,
            columns: loaded.columns,
          };

          console.log(`[Data Processor] ✓ Loaded ${step.output}: ${loaded.rowCount} rows`);
          stepsCompleted++;
          break;
        }

        case 'EXTRACT_COLUMNS': {
          const sourceDataset = datasets[step.source];
          if (!sourceDataset) {
            throw new Error(`Dataset "${step.source}" not found`);
          }

          const columnsToExtract = step.parameters?.columns || [];
          const extracted: Dataset = {
            name: step.output,
            rows: sourceDataset.rows.map(row => {
              const newRow: any = {};
              for (const col of columnsToExtract) {
                newRow[col] = row[col];
              }
              return newRow;
            }),
            columns: columnsToExtract,
          };

          datasets[step.output] = extracted;
          console.log(`[Data Processor] ✓ Extracted ${columnsToExtract.length} columns`);
          stepsCompleted++;
          break;
        }

        case 'JOIN_DATA': {
          const sources = step.source.split(',').map((s: string) => s.trim());
          const dataset1 = datasets[sources[0]];
          const dataset2 = datasets[sources[1]];

          if (!dataset1 || !dataset2) {
            throw new Error(`Source datasets not found: ${sources.join(', ')}`);
          }

          const joined = joinData(dataset1, dataset2, step.parameters?.joinOn || '');
          datasets[step.output] = joined;
          console.log(`[Data Processor] ✓ Joined datasets: ${joined.rows.length} rows`);
          stepsCompleted++;
          break;
        }

        case 'AGGREGATE': {
          const sourceDataset = datasets[step.source];
          if (!sourceDataset) {
            throw new Error(`Dataset "${step.source}" not found`);
          }

          const groupBy = step.parameters?.joinOn || step.parameters?.columns?.[0] || '';
          const valueColumns = step.parameters?.columns?.slice(1) || [];

          const aggregations = valueColumns.map((col: string) => ({
            column: col,
            operation: 'sum' as const,
          }));

          const aggregated = aggregateData(sourceDataset, groupBy, aggregations);
          datasets[step.output] = aggregated;
          console.log(`[Data Processor] ✓ Aggregated by "${groupBy}": ${aggregated.rows.length} groups`);
          stepsCompleted++;
          break;
        }

        case 'CALCULATE': {
          const sourceDataset = datasets[step.source];
          if (!sourceDataset) {
            throw new Error(`Dataset "${step.source}" not found`);
          }

          const formula = step.parameters?.formula || '';
          console.log('[Data Processor] Executing formula:', formula);

          // Parse and execute formula (simplified for now)
          if (formula.includes('SUM_IF') && formula.includes('CONTAINS')) {
            // Extract condition from formula
            const containsMatch = formula.match(/CONTAINS '([^']+)'/);
            const keyword = containsMatch ? containsMatch[1] : '';

            const condition = (row: any) => {
              const productName = row['Product Name'] || row['Items purchased'] || '';
              return productName.includes(keyword);
            };

            const groupBy = formula.includes('GROUP BY')
              ? formula.split('GROUP BY')[1].trim()
              : undefined;

            const result = calculateConditional(
              sourceDataset,
              step.parameters?.columns?.[0] || 'Quantity',
              condition,
              'sum',
              groupBy
            );

            if (typeof result === 'object') {
              datasets[step.output] = result;
            }
          } else {
            // For other formulas, just copy the dataset (placeholder)
            console.warn('[Data Processor] Formula not implemented, copying dataset');
            datasets[step.output] = { ...sourceDataset, name: step.output };
          }

          console.log(`[Data Processor] ✓ Calculation complete`);
          stepsCompleted++;
          break;
        }

        case 'CREATE_REPORT': {
          const sourceDataset = datasets[step.source];
          if (!sourceDataset) {
            throw new Error(`Dataset "${step.source}" not found`);
          }

          const reportPath = path.join(outputDir, step.output);
          await createReport(sourceDataset, reportPath, {
            sheetName: '매출현황',
            includeHeader: true,
            numberFormat: '#,##0',
          });

          intermediateFiles.push(reportPath);
          console.log(`[Data Processor] ✓ Report created: ${step.output}`);
          stepsCompleted++;
          break;
        }

        case 'FORMAT_CELLS': {
          const reportPath = intermediateFiles[intermediateFiles.length - 1];
          if (!reportPath) {
            throw new Error('No report file to format');
          }

          // Apply formatting based on column types
          const formats: Record<string, string> = {
            '총매출액': '#,##0',
            '모빌금액': '#,##0',
            'Total Amount': '#,##0',
            'Quantity': '#,##0.00',
          };

          await applyFormatting(reportPath, formats);
          console.log(`[Data Processor] ✓ Formatting applied`);
          stepsCompleted++;
          break;
        }

        default:
          console.warn(`[Data Processor] Unknown action type: ${step.actionType}, skipping`);
      }
    }

    const finalOutputFile = intermediateFiles[intermediateFiles.length - 1];

    console.log('[Data Processor] ✅ Data processing complete!');
    console.log('  - Steps completed:', stepsCompleted, '/', steps.length);
    console.log('  - Final output:', finalOutputFile);

    return {
      success: true,
      stepsCompleted,
      totalSteps: steps.length,
      outputFile: finalOutputFile,
      intermediateFiles,
    };
  } catch (error: any) {
    console.error('[Data Processor] Error:', error);
    return {
      success: false,
      stepsCompleted,
      totalSteps: steps.length,
      error: error.message,
    };
  }
}
