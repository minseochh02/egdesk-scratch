import { dialog, shell, app } from 'electron';
import fs from 'fs';
import path from 'path';

/**
 * Stage 4: Exporting Reports
 * Handles saving the generated reports to the local filesystem.
 */

export interface ExportResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

/**
 * Automatically saves a report to the application's default reports directory.
 */
export async function autoSaveReport(
  fileName: string,
  content: string,
  extension: 'md' | 'txt' = 'md'
): Promise<ExportResult> {
  try {
    const reportsDir = path.join(app.getPath('userData'), 'CompanyReports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const safeFileName = fileName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filePath = path.join(reportsDir, `${safeFileName}.${extension}`);
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[Export] Automatically saved report to: ${filePath}`);
    
    return { success: true, filePath };
  } catch (error: any) {
    console.error(`[Export] Auto-save failed:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Allows the user to manually save a report using a system dialog.
 */
export async function exportReportToUserPath(
  fileName: string, 
  content: string, 
  extension: 'md' | 'txt' = 'md'
): Promise<ExportResult> {
  try {
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'Save Company Research Report',
      defaultPath: path.join(app.getPath('documents'), `${fileName}.${extension}`),
      filters: [
        { name: 'Markdown', extensions: ['md'] },
        { name: 'Text', extensions: ['txt'] }
      ]
    });

    if (canceled || !filePath) {
      return { success: false, error: 'User canceled export' };
    }

    fs.writeFileSync(filePath, content, 'utf8');
    return { success: true, filePath };
  } catch (error: any) {
    console.error(`[Export] Manual export failed:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Compatibility wrapper for the existing export IPC
 */
export async function exportReport(
  fileName: string, 
  content: string, 
  destination: 'local', // We now only support local
  options?: { 
    extension?: 'md' | 'txt';
  }
): Promise<ExportResult> {
  return exportReportToUserPath(fileName, content, options?.extension);
}
