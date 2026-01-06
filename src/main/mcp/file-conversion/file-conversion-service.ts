/**
 * File Conversion Service
 * Core service for file format conversions
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { PDFDocument } from 'pdf-lib';
import Jimp from 'jimp';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { marked } from 'marked';
import { chromium } from 'playwright-core';

export interface ConversionResult {
  success: boolean;
  outputPath: string;
  message: string;
  warnings?: string[];
}

export class FileConversionService {
  private tempDir: string;

  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'egdesk-conversions');
    this.ensureTempDir();
  }

  private async ensureTempDir(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create temp directory:', error);
    }
  }

  /**
   * Get a temporary file path
   */
  private getTempPath(filename: string): string {
    return path.join(this.tempDir, `${Date.now()}_${filename}`);
  }

  /**
   * Validate file exists
   */
  private async validateFile(filePath: string): Promise<void> {
    try {
      await fs.access(filePath);
    } catch (error) {
      throw new Error(`File not found: ${filePath}`);
    }
  }

  /**
   * Merge multiple PDFs into one
   */
  async mergePDFs(pdfPaths: string[], outputPath: string): Promise<ConversionResult> {
    try {
      // Validate all input files
      for (const pdfPath of pdfPaths) {
        await this.validateFile(pdfPath);
      }

      const mergedPdf = await PDFDocument.create();

      for (const pdfPath of pdfPaths) {
        const pdfBytes = await fs.readFile(pdfPath);
        const pdf = await PDFDocument.load(pdfBytes);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPages().map((_, i) => i));
        copiedPages.forEach(page => mergedPdf.addPage(page));
      }

      const mergedBytes = await mergedPdf.save();
      await fs.writeFile(outputPath, mergedBytes);

      return {
        success: true,
        outputPath,
        message: `Successfully merged ${pdfPaths.length} PDFs`
      };
    } catch (error) {
      throw new Error(`PDF merge failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Split PDF into separate files
   */
  async splitPDF(pdfPath: string, outputDir: string, pageRanges?: Array<{ start: number; end: number }>): Promise<ConversionResult> {
    try {
      await this.validateFile(pdfPath);
      await fs.mkdir(outputDir, { recursive: true });

      const pdfBytes = await fs.readFile(pdfPath);
      const pdf = await PDFDocument.load(pdfBytes);
      const totalPages = pdf.getPageCount();

      const ranges = pageRanges || Array.from({ length: totalPages }, (_, i) => ({ start: i + 1, end: i + 1 }));
      const outputFiles: string[] = [];

      for (let i = 0; i < ranges.length; i++) {
        const { start, end } = ranges[i];
        const newPdf = await PDFDocument.create();
        
        for (let pageNum = start; pageNum <= end && pageNum <= totalPages; pageNum++) {
          const [copiedPage] = await newPdf.copyPages(pdf, [pageNum - 1]);
          newPdf.addPage(copiedPage);
        }

        const outputPath = path.join(outputDir, `split_${i + 1}.pdf`);
        const newPdfBytes = await newPdf.save();
        await fs.writeFile(outputPath, newPdfBytes);
        outputFiles.push(outputPath);
      }

      return {
        success: true,
        outputPath: outputDir,
        message: `Successfully split PDF into ${outputFiles.length} files`
      };
    } catch (error) {
      throw new Error(`PDF split failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Rotate PDF pages
   */
  async rotatePDF(pdfPath: string, outputPath: string, rotation: 90 | 180 | 270, pages?: number[]): Promise<ConversionResult> {
    try {
      await this.validateFile(pdfPath);

      const pdfBytes = await fs.readFile(pdfPath);
      const pdf = await PDFDocument.load(pdfBytes);
      const totalPages = pdf.getPageCount();
      const pagesToRotate = pages || Array.from({ length: totalPages }, (_, i) => i + 1);

      for (const pageNum of pagesToRotate) {
        if (pageNum >= 1 && pageNum <= totalPages) {
          const page = pdf.getPage(pageNum - 1);
          page.setRotation({ angle: rotation, type: 'degrees' });
        }
      }

      const rotatedBytes = await pdf.save();
      await fs.writeFile(outputPath, rotatedBytes);

      return {
        success: true,
        outputPath,
        message: `Successfully rotated ${pagesToRotate.length} page(s)`
      };
    } catch (error) {
      throw new Error(`PDF rotation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert images to PDF
   */
  async imagesToPDF(imagePaths: string[], outputPath: string, pageSize: string = 'A4', orientation: 'portrait' | 'landscape' = 'portrait'): Promise<ConversionResult> {
    try {
      // Validate all images exist
      for (const imagePath of imagePaths) {
        await this.validateFile(imagePath);
      }

      const pdfDoc = await PDFDocument.create();
      const pageSizes: Record<string, [number, number]> = {
        A4: [595, 842],
        Letter: [612, 792],
        Legal: [612, 1008],
        A3: [842, 1191],
        A5: [420, 595],
      };

      let [pageWidth, pageHeight] = pageSizes[pageSize] || pageSizes.A4;
      if (orientation === 'landscape') {
        [pageWidth, pageHeight] = [pageHeight, pageWidth];
      }

      for (const imagePath of imagePaths) {
        const imageBuffer = await fs.readFile(imagePath);
        let image;

        if (imagePath.toLowerCase().endsWith('.png')) {
          image = await pdfDoc.embedPng(imageBuffer);
        } else if (imagePath.toLowerCase().endsWith('.jpg') || imagePath.toLowerCase().endsWith('.jpeg')) {
          image = await pdfDoc.embedJpg(imageBuffer);
        } else {
          // Convert to PNG if not supported
          const jimpImage = await Jimp.read(imageBuffer);
          const pngBuffer = await jimpImage.getBufferAsync(Jimp.MIME_PNG);
          image = await pdfDoc.embedPng(pngBuffer);
        }

        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        const scale = Math.min(pageWidth / image.width, pageHeight / image.height);
        const imgWidth = image.width * scale;
        const imgHeight = image.height * scale;
        const x = (pageWidth - imgWidth) / 2;
        const y = (pageHeight - imgHeight) / 2;

        page.drawImage(image, { x, y, width: imgWidth, height: imgHeight });
      }

      const pdfBytes = await pdfDoc.save();
      await fs.writeFile(outputPath, pdfBytes);

      return {
        success: true,
        outputPath,
        message: `Successfully converted ${imagePaths.length} image(s) to PDF`
      };
    } catch (error) {
      throw new Error(`Image to PDF conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert image formats
   */
  async convertImage(inputPath: string, outputPath: string, format: string, quality: number = 90): Promise<ConversionResult> {
    try {
      await this.validateFile(inputPath);

      const normalizedFormat = format.toLowerCase();
      const supportedFormats: Record<string, string> = {
        png: Jimp.MIME_PNG,
        jpg: Jimp.MIME_JPEG,
        jpeg: Jimp.MIME_JPEG,
        bmp: Jimp.MIME_BMP,
        tif: Jimp.MIME_TIFF,
        tiff: Jimp.MIME_TIFF,
        gif: Jimp.MIME_GIF,
      };

      const targetMime = supportedFormats[normalizedFormat];

      if (!targetMime) {
        throw new Error(`Unsupported format: ${format}. Supported formats: png, jpg, jpeg, bmp, tif, tiff, gif`);
      }

      const jimpImage = await Jimp.read(inputPath);
      const outputExt = path.extname(outputPath).toLowerCase();
      const normalizedExt = outputExt.startsWith('.') ? outputExt.slice(1) : outputExt;

      if (normalizedExt && normalizedExt !== normalizedFormat && !(normalizedFormat === 'jpg' && normalizedExt === 'jpeg')) {
        throw new Error(`Output path extension (${outputExt}) does not match requested format (${normalizedFormat})`);
      }

      if (targetMime === Jimp.MIME_JPEG) {
        const clampedQuality = Math.max(1, Math.min(quality, 100));
        jimpImage.quality(clampedQuality);
      }

      await jimpImage.writeAsync(outputPath);

      return {
        success: true,
        outputPath,
        message: `Successfully converted image to ${format}`
      };
    } catch (error) {
      throw new Error(`Image conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Resize image
   */
  async resizeImage(inputPath: string, outputPath: string, width?: number, height?: number): Promise<ConversionResult> {
    try {
      await this.validateFile(inputPath);

      const image = await Jimp.read(inputPath);
      const originalWidth = image.bitmap.width;
      const originalHeight = image.bitmap.height;

      let targetWidth = originalWidth;
      let targetHeight = originalHeight;

      if (width && height) {
        const ratio = Math.min(width / originalWidth, height / originalHeight);
        targetWidth = Math.max(1, Math.round(originalWidth * ratio));
        targetHeight = Math.max(1, Math.round(originalHeight * ratio));
      } else if (width) {
        const ratio = width / originalWidth;
        targetWidth = width;
        targetHeight = Math.max(1, Math.round(originalHeight * ratio));
      } else if (height) {
        const ratio = height / originalHeight;
        targetHeight = height;
        targetWidth = Math.max(1, Math.round(originalWidth * ratio));
      }

      if (targetWidth !== originalWidth || targetHeight !== originalHeight) {
        image.resize(targetWidth, targetHeight);
      }

      await image.writeAsync(outputPath);

      return {
        success: true,
        outputPath,
        message: `Successfully resized image${width ? ` to width ${width}` : ''}${height ? ` to height ${height}` : ''}`
      };
    } catch (error) {
      throw new Error(`Image resize failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert Word document to PDF
   */
  async wordToPDF(inputPath: string, outputPath: string): Promise<ConversionResult> {
    try {
      await this.validateFile(inputPath);

      // Extract HTML from Word document
      const result = await mammoth.convertToHtml({ path: inputPath });
      const warnings = result.messages.map(m => m.message);

      // Style the HTML
      const styledHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              @page { size: Letter; margin: 1in; }
              body {
                font-family: 'Calibri', 'Arial', sans-serif;
                font-size: 11pt;
                line-height: 1.5;
                margin: 0;
                padding: 0;
              }
              p { margin: 0 0 12pt 0; }
              h1 { font-size: 18pt; font-weight: bold; margin: 24pt 0 12pt 0; }
              h2 { font-size: 16pt; font-weight: bold; margin: 18pt 0 12pt 0; }
              h3 { font-size: 14pt; font-weight: bold; margin: 14pt 0 12pt 0; }
              table {
                border-collapse: collapse;
                width: 100%;
                margin: 12pt 0;
              }
              td, th {
                border: 1px solid #000;
                padding: 6pt 8pt;
                text-align: left;
              }
              th {
                background-color: #f0f0f0;
                font-weight: bold;
              }
            </style>
          </head>
          <body>${result.value}</body>
        </html>
      `;

      // Convert HTML to PDF using Playwright
      const browser = await chromium.launch({ 
        headless: true,
        channel: 'chrome'
      });
      const page = await browser.newPage();
      await page.setContent(styledHtml, { waitUntil: 'networkidle' });
      await page.pdf({
        path: outputPath,
        format: 'Letter',
        margin: { top: '1in', right: '1in', bottom: '1in', left: '1in' },
        printBackground: true,
      });
      await browser.close();

      return {
        success: true,
        outputPath,
        message: 'Successfully converted Word document to PDF',
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      throw new Error(`Word to PDF conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert Excel spreadsheet to PDF
   */
  async excelToPDF(inputPath: string, outputPath: string, sheetName?: string): Promise<ConversionResult> {
    try {
      await this.validateFile(inputPath);

      // Read file as buffer first (avoids XLSX.readFile sync file access issues)
      const fileBuffer = await fs.readFile(inputPath);
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheet = sheetName 
        ? workbook.Sheets[sheetName]
        : workbook.Sheets[workbook.SheetNames[0]];

      if (!sheet) {
        throw new Error(`Sheet "${sheetName || 'first sheet'}" not found`);
      }

      const html = XLSX.utils.sheet_to_html(sheet);
      
      const styledHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              @page { size: Letter landscape; margin: 0.5in; }
              body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 10pt; margin: 0; padding: 0; }
              table { border-collapse: collapse; width: 100%; table-layout: fixed; }
              td, th { border: 1px solid #000; padding: 4pt 8pt; text-align: left; word-wrap: break-word; }
              th { background-color: #4472C4; color: white; font-weight: bold; }
              tr:nth-child(even) { background-color: #f2f2f2; }
            </style>
          </head>
          <body>${html}</body>
        </html>
      `;

      const browser = await chromium.launch({ 
        headless: true,
        channel: 'chrome'
      });
      const page = await browser.newPage();
      await page.setContent(styledHtml);
      await page.pdf({
        path: outputPath,
        format: 'Letter',
        landscape: true,
        margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
        printBackground: true,
      });
      await browser.close();

      return {
        success: true,
        outputPath,
        message: `Successfully converted Excel spreadsheet to PDF (sheet: ${sheetName || workbook.SheetNames[0]})`
      };
    } catch (error) {
      throw new Error(`Excel to PDF conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert Markdown to PDF
   */
  async markdownToPDF(inputPath: string, outputPath: string, theme: 'default' | 'github' | 'dark' = 'default'): Promise<ConversionResult> {
    try {
      await this.validateFile(inputPath);

      const markdown = await fs.readFile(inputPath, 'utf-8');
      const content = marked(markdown);

      const themes = {
        default: `
          body { font-family: 'Georgia', serif; color: #333; }
          code { background: #f4f4f4; color: #c7254e; }
          pre { background: #f8f8f8; border: 1px solid #ddd; }
        `,
        github: `
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #24292e; }
          code { background: #f6f8fa; color: #d73a49; padding: 0.2em 0.4em; border-radius: 3px; }
          pre { background: #f6f8fa; padding: 16px; border-radius: 6px; }
        `,
        dark: `
          body { font-family: 'Consolas', monospace; background: #1e1e1e; color: #d4d4d4; }
          code { background: #2d2d2d; color: #ce9178; }
          pre { background: #2d2d2d; border: 1px solid #555; }
          a { color: #4fc3f7; }
        `,
      };

      const styledHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              @page { size: Letter; margin: 1in; }
              body { line-height: 1.6; margin: 0; padding: 20px; }
              h1 { font-size: 2em; margin: 0.67em 0; }
              h2 { font-size: 1.5em; margin: 0.75em 0; }
              code { font-family: 'Courier New', monospace; padding: 2px 6px; border-radius: 3px; }
              pre { padding: 15px; border-radius: 5px; overflow-x: auto; }
              ${themes[theme]}
            </style>
          </head>
          <body>${content}</body>
        </html>
      `;

      const browser = await chromium.launch({ 
        headless: true,
        channel: 'chrome'
      });
      const page = await browser.newPage();
      await page.setContent(styledHtml, { waitUntil: 'networkidle' });
      await page.pdf({
        path: outputPath,
        format: 'Letter',
        margin: { top: '1in', right: '1in', bottom: '1in', left: '1in' },
        printBackground: true,
      });
      await browser.close();

      return {
        success: true,
        outputPath,
        message: `Successfully converted Markdown to PDF (theme: ${theme})`
      };
    } catch (error) {
      throw new Error(`Markdown to PDF conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert HTML to PDF
   */
  async htmlToPDF(source: string, outputPath: string, pageSize: string = 'A4'): Promise<ConversionResult> {
    try {
      const browser = await chromium.launch({ 
        headless: true,
        channel: 'chrome'
      });
      const page = await browser.newPage();

      if (source.startsWith('http://') || source.startsWith('https://')) {
        await page.goto(source, { waitUntil: 'networkidle' });
      } else {
        await this.validateFile(source);
        const html = await fs.readFile(source, 'utf-8');
        await page.setContent(html, { waitUntil: 'networkidle' });
      }

      await page.pdf({
        path: outputPath,
        format: pageSize as any,
        margin: { top: '1in', right: '1in', bottom: '1in', left: '1in' },
        printBackground: true,
      });
      await browser.close();

      return {
        success: true,
        outputPath,
        message: `Successfully converted HTML to PDF`
      };
    } catch (error) {
      throw new Error(`HTML to PDF conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clean up temp directory
   */
  async cleanup(): Promise<void> {
    try {
      const files = await fs.readdir(this.tempDir);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtimeMs > maxAge) {
          await fs.unlink(filePath);
        }
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }
}

export function createFileConversionService(): FileConversionService {
  return new FileConversionService();
}

