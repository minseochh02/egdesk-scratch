import { ColumnSchema } from './types';

/**
 * Auto-detect unique key columns based on schema
 * 
 * Strategy:
 * 1. Always include DATE columns (transaction dates are key)
 * 2. Include amount/price/value columns (financial uniqueness)
 * 3. Include ID columns (explicit identifiers)
 * 4. Include description/name columns (content uniqueness)
 * 
 * Result: Compound key like [date, amount, merchant] for transactions
 */
export function autoDetectUniqueKeyColumns(schema: ColumnSchema[]): string[] {
  const uniqueColumns: string[] = [];
  
  // Priority 1: ID columns (highest priority - usually unique by themselves)
  const idColumns = schema.filter(col => 
    /^(id|.*_id|transaction_id|order_id|거래번호|주문번호)$/i.test(col.name) &&
    col.type !== 'DATE' // Exclude date columns from ID matching
  );
  
  if (idColumns.length > 0) {
    // If we have explicit ID columns, use them
    uniqueColumns.push(...idColumns.map(c => c.name));
    return uniqueColumns; // IDs alone should be sufficient
  }
  
  // Priority 2: DATE columns (very important for temporal uniqueness)
  const dateColumns = schema.filter(col => 
    col.type === 'DATE' ||
    /date|날짜|일자|거래일|승인일|결제일|시간/i.test(col.name)
  );
  uniqueColumns.push(...dateColumns.map(c => c.name));
  
  // Priority 3: Amount/Price columns (financial transactions)
  const amountColumns = schema.filter(col => 
    (col.type === 'INTEGER' || col.type === 'REAL') &&
    /amount|price|cost|금액|가격|원|won|usd|krw|total|sum|합계/i.test(col.name)
  );
  if (amountColumns.length > 0) {
    uniqueColumns.push(amountColumns[0].name); // Take first amount column
  }
  
  // Priority 4: Description/Name/Merchant columns (content uniqueness)
  const descriptionColumns = schema.filter(col => 
    col.type === 'TEXT' &&
    /desc|description|name|merchant|store|vendor|가맹점|상호|내역|상세|품목|제목/i.test(col.name)
  );
  if (descriptionColumns.length > 0) {
    uniqueColumns.push(descriptionColumns[0].name); // Take first description
  }
  
  // If we found some unique columns, return them
  if (uniqueColumns.length > 0) {
    return uniqueColumns;
  }
  
  // Fallback: No clear unique columns found
  // Don't return anything - let user manually configure if needed
  return [];
}

/**
 * Check if duplicate detection is recommended for this schema
 */
export function shouldEnableDuplicateDetection(schema: ColumnSchema[]): boolean {
  const uniqueColumns = autoDetectUniqueKeyColumns(schema);
  
  // Enable if we found at least 2 columns (compound key is more reliable)
  // OR if we found an ID column (single column is sufficient)
  return uniqueColumns.length >= 1;
}

/**
 * Get recommended duplicate action based on schema
 */
export function getRecommendedDuplicateAction(schema: ColumnSchema[]): 'skip' | 'update' | 'allow' {
  // Check if schema has status/state columns (suggests mutable data)
  const hasStatusColumn = schema.some(col => 
    /status|state|상태|진행/i.test(col.name)
  );
  
  if (hasStatusColumn) {
    return 'update'; // Likely order/tracking data that changes
  }
  
  // Check if schema has ID column (suggests entity data that might update)
  const hasIdColumn = schema.some(col => 
    /^(id|.*_id|transaction_id|order_id)$/i.test(col.name)
  );
  
  if (hasIdColumn) {
    return 'update'; // Entity data that might be updated
  }
  
  // Default: skip duplicates (most common for transaction imports)
  return 'skip';
}

/**
 * Format unique key columns for display
 */
export function formatUniqueKeyDisplay(columns: string[]): string {
  if (columns.length === 0) return 'None';
  if (columns.length === 1) return columns[0];
  if (columns.length === 2) return columns.join(' + ');
  return `${columns.slice(0, 2).join(' + ')} + ${columns.length - 2} more`;
}
