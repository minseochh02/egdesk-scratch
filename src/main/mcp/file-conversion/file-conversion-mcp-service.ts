/**
 * File Conversion MCP Service
 * Implements the IMCPService interface for file conversion operations
 */

import { IMCPService, MCPTool, MCPServerInfo, MCPCapabilities, MCPToolResult } from '../types/mcp-service';
import { FileConversionService } from './file-conversion-service';
import path from 'path';
import os from 'os';

/**
 * File Conversion MCP Service
 * Provides file format conversion tools via MCP protocol
 */
export class FileConversionMCPService implements IMCPService {
  private conversionService: FileConversionService;

  constructor() {
    this.conversionService = new FileConversionService();
  }

  getServerInfo(): MCPServerInfo {
    return {
      name: 'file-conversion-mcp-server',
      version: '1.0.0'
    };
  }

  getCapabilities(): MCPCapabilities {
    return {
      tools: {},
    };
  }

  listTools(): MCPTool[] {
    return [
      {
        name: 'pdf_merge',
        description: 'Merge multiple PDF files into a single PDF',
        inputSchema: {
          type: 'object',
          properties: {
            pdfPaths: {
              type: 'array',
              items: { type: 'string' },
              description: 'Paths to PDF files to merge (in order)'
            },
            outputPath: {
              type: 'string',
              description: 'Output merged PDF file path'
            }
          },
          required: ['pdfPaths', 'outputPath']
        }
      },
      {
        name: 'pdf_split',
        description: 'Split PDF into separate files',
        inputSchema: {
          type: 'object',
          properties: {
            pdfPath: {
              type: 'string',
              description: 'Path to the PDF file to split'
            },
            outputDir: {
              type: 'string',
              description: 'Directory to save split PDFs'
            },
            pageRanges: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  start: { type: 'number' },
                  end: { type: 'number' }
                }
              },
              description: 'Page ranges to split (optional, default: split each page)'
            }
          },
          required: ['pdfPath', 'outputDir']
        }
      },
      {
        name: 'pdf_rotate',
        description: 'Rotate PDF pages by specified degrees',
        inputSchema: {
          type: 'object',
          properties: {
            pdfPath: {
              type: 'string',
              description: 'Path to the PDF file'
            },
            outputPath: {
              type: 'string',
              description: 'Output PDF file path'
            },
            rotation: {
              type: 'number',
              enum: [90, 180, 270],
              description: 'Rotation angle in degrees'
            },
            pages: {
              type: 'array',
              items: { type: 'number' },
              description: 'Page numbers to rotate (optional, default: all pages)'
            }
          },
          required: ['pdfPath', 'outputPath', 'rotation']
        }
      },
      {
        name: 'images_to_pdf',
        description: 'Convert one or multiple images to PDF',
        inputSchema: {
          type: 'object',
          properties: {
            imagePaths: {
              type: 'array',
              items: { type: 'string' },
              description: 'Paths to image files to convert'
            },
            outputPath: {
              type: 'string',
              description: 'Output PDF file path'
            },
            pageSize: {
              type: 'string',
              enum: ['A4', 'Letter', 'Legal', 'A3', 'A5'],
              description: 'PDF page size',
              default: 'A4'
            },
            orientation: {
              type: 'string',
              enum: ['portrait', 'landscape'],
              description: 'Page orientation',
              default: 'portrait'
            }
          },
          required: ['imagePaths', 'outputPath']
        }
      },
      {
        name: 'image_convert',
        description: 'Convert images between different formats',
        inputSchema: {
          type: 'object',
          properties: {
            inputPath: {
              type: 'string',
              description: 'Path to the input image'
            },
            outputPath: {
              type: 'string',
              description: 'Output image file path'
            },
            format: {
              type: 'string',
              enum: ['png', 'jpg', 'jpeg', 'webp', 'avif'],
              description: 'Target image format'
            },
            quality: {
              type: 'number',
              description: 'Image quality (1-100)',
              minimum: 1,
              maximum: 100,
              default: 90
            }
          },
          required: ['inputPath', 'outputPath', 'format']
        }
      },
      {
        name: 'image_resize',
        description: 'Resize an image',
        inputSchema: {
          type: 'object',
          properties: {
            inputPath: {
              type: 'string',
              description: 'Path to the input image'
            },
            outputPath: {
              type: 'string',
              description: 'Output image file path'
            },
            width: {
              type: 'number',
              description: 'Target width (optional)'
            },
            height: {
              type: 'number',
              description: 'Target height (optional)'
            }
          },
          required: ['inputPath', 'outputPath']
        }
      },
      {
        name: 'word_to_pdf',
        description: 'Convert Word documents (DOCX) to PDF',
        inputSchema: {
          type: 'object',
          properties: {
            inputPath: {
              type: 'string',
              description: 'Path to the Word document'
            },
            outputPath: {
              type: 'string',
              description: 'Output PDF file path'
            }
          },
          required: ['inputPath', 'outputPath']
        }
      },
      {
        name: 'excel_to_pdf',
        description: 'Convert Excel spreadsheets (XLSX) to PDF',
        inputSchema: {
          type: 'object',
          properties: {
            inputPath: {
              type: 'string',
              description: 'Path to the Excel file'
            },
            outputPath: {
              type: 'string',
              description: 'Output PDF file path'
            },
            sheetName: {
              type: 'string',
              description: 'Specific sheet to convert (optional, default: first sheet)'
            }
          },
          required: ['inputPath', 'outputPath']
        }
      },
      {
        name: 'markdown_to_pdf',
        description: 'Convert Markdown files to PDF',
        inputSchema: {
          type: 'object',
          properties: {
            inputPath: {
              type: 'string',
              description: 'Path to the Markdown file'
            },
            outputPath: {
              type: 'string',
              description: 'Output PDF file path'
            },
            theme: {
              type: 'string',
              enum: ['default', 'github', 'dark'],
              description: 'PDF styling theme',
              default: 'default'
            }
          },
          required: ['inputPath', 'outputPath']
        }
      },
      {
        name: 'html_to_pdf',
        description: 'Convert HTML files or URLs to PDF',
        inputSchema: {
          type: 'object',
          properties: {
            source: {
              type: 'string',
              description: 'HTML file path or URL'
            },
            outputPath: {
              type: 'string',
              description: 'Output PDF file path'
            },
            pageSize: {
              type: 'string',
              enum: ['A4', 'Letter', 'Legal'],
              description: 'PDF page size',
              default: 'A4'
            }
          },
          required: ['source', 'outputPath']
        }
      }
    ];
  }

  async executeTool(name: string, args: Record<string, any>): Promise<MCPToolResult> {
    try {
      let result;

      switch (name) {
        case 'pdf_merge':
          result = await this.conversionService.mergePDFs(args.pdfPaths, args.outputPath);
          break;

        case 'pdf_split':
          result = await this.conversionService.splitPDF(args.pdfPath, args.outputDir, args.pageRanges);
          break;

        case 'pdf_rotate':
          result = await this.conversionService.rotatePDF(args.pdfPath, args.outputPath, args.rotation, args.pages);
          break;

        case 'images_to_pdf':
          result = await this.conversionService.imagesToPDF(
            args.imagePaths,
            args.outputPath,
            args.pageSize || 'A4',
            args.orientation || 'portrait'
          );
          break;

        case 'image_convert':
          result = await this.conversionService.convertImage(
            args.inputPath,
            args.outputPath,
            args.format,
            args.quality || 90
          );
          break;

        case 'image_resize':
          result = await this.conversionService.resizeImage(
            args.inputPath,
            args.outputPath,
            args.width,
            args.height
          );
          break;

        case 'word_to_pdf':
          result = await this.conversionService.wordToPDF(args.inputPath, args.outputPath);
          break;

        case 'excel_to_pdf':
          result = await this.conversionService.excelToPDF(args.inputPath, args.outputPath, args.sheetName);
          break;

        case 'markdown_to_pdf':
          result = await this.conversionService.markdownToPDF(
            args.inputPath,
            args.outputPath,
            args.theme || 'default'
          );
          break;

        case 'html_to_pdf':
          result = await this.conversionService.htmlToPDF(
            args.source,
            args.outputPath,
            args.pageSize || 'A4'
          );
          break;

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: result.success,
            message: result.message,
            outputPath: result.outputPath,
            warnings: result.warnings
          }, null, 2)
        }]
      };
    } catch (error) {
      throw new Error(`Failed to execute ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    // Perform any initialization if needed
    console.log('File Conversion MCP Service initialized');
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.conversionService.cleanup();
  }
}

export function createFileConversionMCPService(): FileConversionMCPService {
  return new FileConversionMCPService();
}

