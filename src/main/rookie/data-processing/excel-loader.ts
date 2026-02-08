/**
 * Excel Loader Module
 * Handles loading Excel files and extracting data
 */

import ExcelJS from 'exceljs';
import * as fs from 'fs';

export interface LoadedData {
  fileName: string;
  sheetName: string;
  rows: any[];
  columns: string[];
  rowCount: number;
}

/**
 * Load Excel file and extract specified columns
 */
export async function loadExcelFile(
  filePath: string,
  columns?: string[]
): Promise<LoadedData> {
  console.log('[Excel Loader] Loading file:', filePath);
  console.log('[Excel Loader] Extract columns:', columns || 'All');

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  // Use first sheet
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('No worksheets found in Excel file');
  }

  const sheetName = worksheet.name;
  console.log('[Excel Loader] Sheet name:', sheetName);

  // Extract header row
  const headerRow = worksheet.getRow(1);
  const allColumns: string[] = [];
  headerRow.eachCell((cell, colNumber) => {
    allColumns.push(cell.text || `Column${colNumber}`);
  });

  console.log('[Excel Loader] Available columns:', allColumns);

  // Determine which columns to extract
  const columnsToExtract = columns && columns.length > 0 ? columns : allColumns;
  const columnIndices: number[] = [];

  for (const col of columnsToExtract) {
    const index = allColumns.indexOf(col);
    if (index !== -1) {
      columnIndices.push(index);
    } else {
      console.warn(`[Excel Loader] Column "${col}" not found, skipping`);
    }
  }

  if (columnIndices.length === 0) {
    throw new Error('No matching columns found');
  }

  // Extract data rows
  const rows: any[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    const rowData: any = {};
    columnIndices.forEach((colIndex) => {
      const columnName = allColumns[colIndex];
      const cell = row.getCell(colIndex + 1); // ExcelJS is 1-indexed
      rowData[columnName] = cell.value;
    });

    rows.push(rowData);
  });

  console.log('[Excel Loader] ✓ Loaded', rows.length, 'rows');
  console.log('[Excel Loader] ✓ Extracted columns:', columnsToExtract);

  return {
    fileName: filePath.split('/').pop() || filePath,
    sheetName,
    rows,
    columns: columnsToExtract,
    rowCount: rows.length,
  };
}

/**
 * Load multiple Excel files
 */
export async function loadMultipleFiles(
  files: Array<{ path: string; columns?: string[] }>
): Promise<LoadedData[]> {
  console.log('[Excel Loader] Loading', files.length, 'files...');

  const results = await Promise.all(
    files.map(file => loadExcelFile(file.path, file.columns))
  );

  console.log('[Excel Loader] ✓ All files loaded');
  return results;
}

/**
 * Get column names from Excel file without loading full data
 */
export async function getColumnNames(filePath: string): Promise<string[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const columns: string[] = [];
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell((cell, colNumber) => {
    columns.push(cell.text || `Column${colNumber}`);
  });

  return columns;
}
