import { dialog, shell, app } from 'electron';
import fs from 'fs';
import path from 'path';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

/**
 * Stage 4: Exporting Reports
 * Handles saving the generated reports to the local filesystem.
 */

export interface ExportResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

export interface MultiExportResult {
  success: boolean;
  files: { type: string; filePath: string }[];
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

/**
 * Convert markdown content to DOCX document
 */
function markdownToDocx(content: string, title: string): Document {
  const lines = content.split('\n');
  const children: Paragraph[] = [];
  
  let inList = false;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines but add spacing
    if (!trimmedLine) {
      if (children.length > 0) {
        children.push(new Paragraph({ text: '' }));
      }
      inList = false;
      continue;
    }
    
    // Headers
    if (trimmedLine.startsWith('# ')) {
      children.push(new Paragraph({
        text: trimmedLine.substring(2),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 }
      }));
      inList = false;
    } else if (trimmedLine.startsWith('## ')) {
      children.push(new Paragraph({
        text: trimmedLine.substring(3),
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 }
      }));
      inList = false;
    } else if (trimmedLine.startsWith('### ')) {
      children.push(new Paragraph({
        text: trimmedLine.substring(4),
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 100 }
      }));
      inList = false;
    } else if (trimmedLine.startsWith('#### ')) {
      children.push(new Paragraph({
        text: trimmedLine.substring(5),
        heading: HeadingLevel.HEADING_4,
        spacing: { before: 150, after: 75 }
      }));
      inList = false;
    }
    // Bullet points
    else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
      const text = trimmedLine.substring(2);
      children.push(new Paragraph({
        text: `• ${cleanMarkdownFormatting(text)}`,
        indent: { left: 720 },
        spacing: { before: 50, after: 50 }
      }));
      inList = true;
    }
    // Numbered lists
    else if (/^\d+\.\s/.test(trimmedLine)) {
      const text = trimmedLine.replace(/^\d+\.\s/, '');
      children.push(new Paragraph({
        text: cleanMarkdownFormatting(text),
        numbering: { reference: 'default-numbering', level: 0 },
        spacing: { before: 50, after: 50 }
      }));
      inList = true;
    }
    // Regular paragraph
    else {
      children.push(new Paragraph({
        children: parseInlineFormatting(trimmedLine),
        spacing: { before: inList ? 50 : 100, after: inList ? 50 : 100 }
      }));
      inList = false;
    }
  }
  
  return new Document({
    title: title,
    sections: [{
      properties: {},
      children: children
    }]
  });
}

/**
 * Clean markdown formatting from text
 */
function cleanMarkdownFormatting(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1');
}

/**
 * Parse inline formatting (bold, italic) and return TextRun array
 */
function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let remaining = text;
  
  // Simple approach: find bold (**text**) and italic (*text*) patterns
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|__(.+?)__|_(.+?)_|`(.+?)`|\[(.+?)\]\(.+?\)|[^*_`\[]+)/g;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    const fullMatch = match[0];
    
    if (fullMatch.startsWith('**') && fullMatch.endsWith('**')) {
      runs.push(new TextRun({ text: fullMatch.slice(2, -2), bold: true }));
    } else if (fullMatch.startsWith('__') && fullMatch.endsWith('__')) {
      runs.push(new TextRun({ text: fullMatch.slice(2, -2), bold: true }));
    } else if (fullMatch.startsWith('*') && fullMatch.endsWith('*') && !fullMatch.startsWith('**')) {
      runs.push(new TextRun({ text: fullMatch.slice(1, -1), italics: true }));
    } else if (fullMatch.startsWith('_') && fullMatch.endsWith('_') && !fullMatch.startsWith('__')) {
      runs.push(new TextRun({ text: fullMatch.slice(1, -1), italics: true }));
    } else if (fullMatch.startsWith('`') && fullMatch.endsWith('`')) {
      runs.push(new TextRun({ text: fullMatch.slice(1, -1), font: 'Courier New' }));
    } else if (fullMatch.startsWith('[')) {
      // Link - extract text
      const linkMatch = /\[(.+?)\]/.exec(fullMatch);
      if (linkMatch) {
        runs.push(new TextRun({ text: linkMatch[1], color: '0066CC', underline: {} }));
      }
    } else {
      runs.push(new TextRun({ text: fullMatch }));
    }
  }
  
  if (runs.length === 0) {
    runs.push(new TextRun({ text }));
  }
  
  return runs;
}

/**
 * Export report as DOCX file
 */
export async function exportReportAsDocx(
  fileName: string,
  content: string,
  title: string
): Promise<ExportResult> {
  try {
    const reportsDir = path.join(app.getPath('userData'), 'CompanyReports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const safeFileName = fileName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filePath = path.join(reportsDir, `${safeFileName}.docx`);
    
    const doc = markdownToDocx(content, title);
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(filePath, buffer);
    
    console.log(`[Export] Saved DOCX report to: ${filePath}`);
    return { success: true, filePath };
  } catch (error: any) {
    console.error(`[Export] DOCX export failed:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Export both executive summary and detailed report as DOCX files
 */
export async function exportBothReportsAsDocx(
  domain: string,
  execSummaryContent: string | null,
  detailedReportContent: string | null
): Promise<MultiExportResult> {
  try {
    const reportsDir = path.join(app.getPath('userData'), 'CompanyReports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const safeDomain = domain.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = new Date().toISOString().split('T')[0];
    const files: { type: string; filePath: string }[] = [];

    if (execSummaryContent) {
      const execFileName = `${safeDomain}_executive_summary_${timestamp}`;
      const execPath = path.join(reportsDir, `${execFileName}.docx`);
      const execDoc = markdownToDocx(execSummaryContent, `Executive Summary - ${domain}`);
      const execBuffer = await Packer.toBuffer(execDoc);
      fs.writeFileSync(execPath, execBuffer);
      files.push({ type: 'executive', filePath: execPath });
      console.log(`[Export] Saved Executive Summary DOCX to: ${execPath}`);
    }

    if (detailedReportContent) {
      const detailedFileName = `${safeDomain}_detailed_report_${timestamp}`;
      const detailedPath = path.join(reportsDir, `${detailedFileName}.docx`);
      const detailedDoc = markdownToDocx(detailedReportContent, `Detailed Report - ${domain}`);
      const detailedBuffer = await Packer.toBuffer(detailedDoc);
      fs.writeFileSync(detailedPath, detailedBuffer);
      files.push({ type: 'detailed', filePath: detailedPath });
      console.log(`[Export] Saved Detailed Report DOCX to: ${detailedPath}`);
    }

    return { success: true, files };
  } catch (error: any) {
    console.error(`[Export] DOCX export failed:`, error);
    return { success: false, files: [], error: error.message };
  }
}

/**
 * Open folder containing the exported files
 */
export async function openReportsFolder(): Promise<void> {
  const reportsDir = path.join(app.getPath('userData'), 'CompanyReports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  await shell.openPath(reportsDir);
}
