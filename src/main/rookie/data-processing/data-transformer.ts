/**
 * Data Transformer Module
 * Handles calculations, aggregations, joins, and transformations
 */

export interface Dataset {
  name: string;
  rows: any[];
  columns: string[];
}

/**
 * Join two datasets on a common column
 */
export function joinData(
  dataset1: Dataset,
  dataset2: Dataset,
  joinColumn: string,
  joinType: 'inner' | 'left' | 'right' | 'outer' = 'left'
): Dataset {
  console.log('[Data Transformer] Joining datasets...');
  console.log('  - Dataset 1:', dataset1.name, '(', dataset1.rows.length, 'rows)');
  console.log('  - Dataset 2:', dataset2.name, '(', dataset2.rows.length, 'rows)');
  console.log('  - Join on:', joinColumn);
  console.log('  - Join type:', joinType);

  const joined: any[] = [];

  for (const row1 of dataset1.rows) {
    const key1 = row1[joinColumn];
    const matchingRows = dataset2.rows.filter(row2 => row2[joinColumn] === key1);

    if (matchingRows.length > 0) {
      for (const row2 of matchingRows) {
        joined.push({ ...row1, ...row2 });
      }
    } else if (joinType === 'left' || joinType === 'outer') {
      joined.push({ ...row1 });
    }
  }

  // For outer join, add unmatched rows from dataset2
  if (joinType === 'outer') {
    for (const row2 of dataset2.rows) {
      const key2 = row2[joinColumn];
      const hasMatch = dataset1.rows.some(row1 => row1[joinColumn] === key2);
      if (!hasMatch) {
        joined.push({ ...row2 });
      }
    }
  }

  const allColumns = Array.from(
    new Set([...dataset1.columns, ...dataset2.columns])
  );

  console.log('[Data Transformer] ✓ Join complete:', joined.length, 'rows');

  return {
    name: `${dataset1.name}_joined_${dataset2.name}`,
    rows: joined,
    columns: allColumns,
  };
}

/**
 * Aggregate data by grouping and summing
 */
export function aggregateData(
  dataset: Dataset,
  groupByColumn: string,
  aggregations: Array<{ column: string; operation: 'sum' | 'avg' | 'count' | 'min' | 'max' }>
): Dataset {
  console.log('[Data Transformer] Aggregating data...');
  console.log('  - Group by:', groupByColumn);
  console.log('  - Aggregations:', aggregations.length);

  const groups: Record<string, any[]> = {};

  // Group rows
  for (const row of dataset.rows) {
    const key = row[groupByColumn];
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(row);
  }

  console.log('[Data Transformer] Created', Object.keys(groups).length, 'groups');

  // Aggregate each group
  const aggregated: any[] = [];

  for (const [key, rows] of Object.entries(groups)) {
    const aggRow: any = {
      [groupByColumn]: key,
    };

    for (const agg of aggregations) {
      const values = rows.map(r => Number(r[agg.column]) || 0);

      switch (agg.operation) {
        case 'sum':
          aggRow[agg.column] = values.reduce((a, b) => a + b, 0);
          break;
        case 'avg':
          aggRow[agg.column] = values.reduce((a, b) => a + b, 0) / values.length;
          break;
        case 'count':
          aggRow[agg.column] = values.length;
          break;
        case 'min':
          aggRow[agg.column] = Math.min(...values);
          break;
        case 'max':
          aggRow[agg.column] = Math.max(...values);
          break;
      }
    }

    aggregated.push(aggRow);
  }

  console.log('[Data Transformer] ✓ Aggregated to', aggregated.length, 'rows');

  return {
    name: `${dataset.name}_aggregated`,
    rows: aggregated,
    columns: [groupByColumn, ...aggregations.map(a => a.column)],
  };
}

/**
 * Execute conditional calculation (e.g., SUM_IF)
 */
export function calculateConditional(
  dataset: Dataset,
  valueColumn: string,
  condition: (row: any) => boolean,
  operation: 'sum' | 'count' | 'avg' = 'sum',
  groupByColumn?: string
): Dataset | number {
  console.log('[Data Transformer] Conditional calculation...');
  console.log('  - Value column:', valueColumn);
  console.log('  - Operation:', operation);

  const filteredRows = dataset.rows.filter(condition);
  console.log('[Data Transformer] Filtered to', filteredRows.length, 'rows');

  if (groupByColumn) {
    // Group and aggregate
    const groups: Record<string, number[]> = {};

    for (const row of filteredRows) {
      const key = row[groupByColumn];
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(Number(row[valueColumn]) || 0);
    }

    const result: any[] = [];
    for (const [key, values] of Object.entries(groups)) {
      let aggregatedValue = 0;
      switch (operation) {
        case 'sum':
          aggregatedValue = values.reduce((a, b) => a + b, 0);
          break;
        case 'avg':
          aggregatedValue = values.reduce((a, b) => a + b, 0) / values.length;
          break;
        case 'count':
          aggregatedValue = values.length;
          break;
      }

      result.push({
        [groupByColumn]: key,
        [valueColumn]: aggregatedValue,
      });
    }

    return {
      name: `${dataset.name}_conditional_${operation}`,
      rows: result,
      columns: [groupByColumn, valueColumn],
    };
  } else {
    // Single value
    const values = filteredRows.map(r => Number(r[valueColumn]) || 0);
    let result = 0;
    switch (operation) {
      case 'sum':
        result = values.reduce((a, b) => a + b, 0);
        break;
      case 'avg':
        result = values.reduce((a, b) => a + b, 0) / values.length;
        break;
      case 'count':
        result = values.length;
        break;
    }
    return result;
  }
}

/**
 * Fill null values with a default
 */
export function fillNulls(dataset: Dataset, defaultValue: any = 0): Dataset {
  console.log('[Data Transformer] Filling null values with:', defaultValue);

  const filled = dataset.rows.map(row => {
    const newRow: any = {};
    for (const col of dataset.columns) {
      newRow[col] = row[col] ?? defaultValue;
    }
    return newRow;
  });

  return {
    ...dataset,
    rows: filled,
  };
}

/**
 * Rename column
 */
export function renameColumn(
  dataset: Dataset,
  oldName: string,
  newName: string
): Dataset {
  console.log('[Data Transformer] Renaming column:', oldName, '→', newName);

  const newRows = dataset.rows.map(row => {
    const newRow: any = {};
    for (const [key, value] of Object.entries(row)) {
      newRow[key === oldName ? newName : key] = value;
    }
    return newRow;
  });

  const newColumns = dataset.columns.map(col => (col === oldName ? newName : col));

  return {
    ...dataset,
    rows: newRows,
    columns: newColumns,
  };
}
