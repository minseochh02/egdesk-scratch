/**
 * Excel Query Tool - SQL-like querying for Excel data
 * Allows AI to query Excel files without loading all data into context
 */

export interface ExcelDataStore {
  fileName: string;
  sheetName: string;
  headers: string[];
  rows: any[][];
}

/**
 * Query Excel data with filters, grouping, and aggregation
 */
export function queryExcelData(
  dataStore: Map<string, ExcelDataStore>,
  params: {
  fileId: string;
  select: string[]; // Column names to return, or aggregation expressions like "SUM(amount)"
  where?: Array<{ column: string; operator: string; value: any }>; // Filters
  groupBy?: string[]; // Columns to group by
  limit?: number; // Max rows to return
}
): { success: boolean; data?: any[]; error?: string; stats?: { totalRows: number; filteredRows: number; resultRows: number } } {
  try {
    const excelData = dataStore.get(params.fileId);
    if (!excelData) {
      return { success: false, error: `File not found: ${params.fileId}` };
    }

    console.log(`[ExcelQueryTool] Query on ${params.fileId}:`, {
      select: params.select,
      where: params.where,
      groupBy: params.groupBy,
      limit: params.limit,
    });

    const { headers, rows } = excelData;
    const totalRows = rows.length;

    // Get column indices
    const getColumnIndex = (colName: string): number => {
      const idx = headers.findIndex(h => h.toLowerCase() === colName.toLowerCase());
      if (idx === -1) {
        throw new Error(`Column not found: ${colName}`);
      }
      return idx;
    };

    // Step 1: Apply WHERE filters
    let filteredRows = rows;
    if (params.where && params.where.length > 0) {
      filteredRows = rows.filter(row => {
        return params.where!.every(condition => {
          const colIdx = getColumnIndex(condition.column);
          const cellValue = row[colIdx];

          switch (condition.operator.toLowerCase()) {
            case '=':
            case 'equals':
              return cellValue === condition.value;
            case '!=':
            case 'not_equals':
              return cellValue !== condition.value;
            case '>':
              return Number(cellValue) > Number(condition.value);
            case '>=':
              return Number(cellValue) >= Number(condition.value);
            case '<':
              return Number(cellValue) < Number(condition.value);
            case '<=':
              return Number(cellValue) <= Number(condition.value);
            case 'in':
              return Array.isArray(condition.value) && condition.value.includes(cellValue);
            case 'contains':
              return String(cellValue).toLowerCase().includes(String(condition.value).toLowerCase());
            case 'between':
              return Array.isArray(condition.value) &&
                     Number(cellValue) >= Number(condition.value[0]) &&
                     Number(cellValue) <= Number(condition.value[1]);
            default:
              return true;
          }
        });
      });
    }

    const filteredRowsCount = filteredRows.length;

    // Step 2: Parse SELECT expressions
    const selectExpressions = params.select.map(expr => {
      const trimmed = expr.trim();

      // Check if it's an aggregation function
      const aggMatch = trimmed.match(/^(SUM|AVG|COUNT|MIN|MAX)\((.+)\)$/i);
      if (aggMatch) {
        return {
          type: 'aggregation',
          function: aggMatch[1].toUpperCase(),
          column: aggMatch[2].trim(),
        };
      }

      // Otherwise it's a direct column reference
      return {
        type: 'column',
        column: trimmed,
      };
    });

    // Step 3: GROUP BY or aggregate all
    let resultData: any[];

    if (params.groupBy && params.groupBy.length > 0) {
      // Group by specified columns
      const groups = new Map<string, any[]>();

      for (const row of filteredRows) {
        const groupKey = params.groupBy.map(col => {
          const colIdx = getColumnIndex(col);
          return row[colIdx];
        }).join('|||');

        if (!groups.has(groupKey)) {
          groups.set(groupKey, []);
        }
        groups.get(groupKey)!.push(row);
      }

      // Aggregate each group
      resultData = Array.from(groups.entries()).map(([groupKey, groupRows]) => {
        const result: any = {};

        // Add group by columns
        const groupValues = groupKey.split('|||');
        params.groupBy!.forEach((col, idx) => {
          result[col] = groupValues[idx];
        });

        // Add select expressions
        selectExpressions.forEach((expr, idx) => {
          if (expr.type === 'aggregation') {
            const colIdx = getColumnIndex(expr.column);
            const values = groupRows.map(r => r[colIdx]).filter(v => v !== null && v !== undefined && v !== '');

            switch (expr.function) {
              case 'SUM':
                result[params.select[idx]] = values.reduce((sum, val) => sum + Number(val), 0);
                break;
              case 'AVG':
                result[params.select[idx]] = values.length > 0
                  ? values.reduce((sum, val) => sum + Number(val), 0) / values.length
                  : 0;
                break;
              case 'COUNT':
                result[params.select[idx]] = values.length;
                break;
              case 'MIN':
                result[params.select[idx]] = values.length > 0 ? Math.min(...values.map(Number)) : null;
                break;
              case 'MAX':
                result[params.select[idx]] = values.length > 0 ? Math.max(...values.map(Number)) : null;
                break;
            }
          } else {
            // Direct column - take first value from group
            const colIdx = getColumnIndex(expr.column);
            result[params.select[idx]] = groupRows[0][colIdx];
          }
        });

        return result;
      });
    } else {
      // No grouping - aggregate all filtered rows
      if (selectExpressions.some(e => e.type === 'aggregation')) {
        const result: any = {};

        selectExpressions.forEach((expr, idx) => {
          if (expr.type === 'aggregation') {
            const colIdx = getColumnIndex(expr.column);
            const values = filteredRows.map(r => r[colIdx]).filter(v => v !== null && v !== undefined && v !== '');

            switch (expr.function) {
              case 'SUM':
                result[params.select[idx]] = values.reduce((sum, val) => sum + Number(val), 0);
                break;
              case 'AVG':
                result[params.select[idx]] = values.length > 0
                  ? values.reduce((sum, val) => sum + Number(val), 0) / values.length
                  : 0;
                break;
              case 'COUNT':
                result[params.select[idx]] = values.length;
                break;
              case 'MIN':
                result[params.select[idx]] = values.length > 0 ? Math.min(...values.map(Number)) : null;
                break;
              case 'MAX':
                result[params.select[idx]] = values.length > 0 ? Math.max(...values.map(Number)) : null;
                break;
            }
          } else {
            // Can't select raw columns without grouping when aggregating
            result[params.select[idx]] = null;
          }
        });

        resultData = [result];
      } else {
        // Just return filtered rows with selected columns
        resultData = filteredRows.map(row => {
          const result: any = {};
          selectExpressions.forEach((expr, idx) => {
            const colIdx = getColumnIndex(expr.column);
            result[params.select[idx]] = row[colIdx];
          });
          return result;
        });
      }
    }

    // Step 4: Apply LIMIT
    if (params.limit && params.limit > 0) {
      resultData = resultData.slice(0, params.limit);
    }

    console.log(`[ExcelQueryTool] Query complete: ${totalRows} total → ${filteredRowsCount} filtered → ${resultData.length} result rows`);

    return {
      success: true,
      data: resultData,
      stats: {
        totalRows,
        filteredRows: filteredRowsCount,
        resultRows: resultData.length,
      },
    };
  } catch (error: any) {
    console.error('[ExcelQueryTool] Query error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get distinct values from a column
 */
export function getDistinctValues(
  dataStore: Map<string, ExcelDataStore>,
  fileId: string,
  column: string,
  limit = 100
): { success: boolean; values?: any[]; error?: string } {
  try {
    const excelData = dataStore.get(fileId);
    if (!excelData) {
      return { success: false, error: `File not found: ${fileId}` };
    }

    const colIdx = excelData.headers.findIndex(h => h.toLowerCase() === column.toLowerCase());
    if (colIdx === -1) {
      return { success: false, error: `Column not found: ${column}` };
    }

    const distinctValues = new Set<any>();
    for (const row of excelData.rows) {
      const value = row[colIdx];
      if (value !== null && value !== undefined && value !== '') {
        distinctValues.add(value);
      }
    }

    const values = Array.from(distinctValues).slice(0, limit);
    console.log(`[ExcelQueryTool] Distinct values for ${fileId}.${column}: ${values.length} unique values`);

    return {
      success: true,
      values,
    };
  } catch (error: any) {
    console.error('[ExcelQueryTool] Error getting distinct values:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}
