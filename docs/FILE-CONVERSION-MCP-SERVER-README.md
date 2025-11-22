# File Conversion MCP Server - Implementation Guide

> **✅ STATUS**: Core dependencies installed and ready for EGDesk project!  
> **📦 Size Added**: ~23 MB  
> **🎯 Features Ready**: PDF ops, Image conversion, Word/Excel→PDF, HTML/Markdown→PDF

## Overview

This document provides a comprehensive guide for implementing an MCP (Model Context Protocol) server that performs file type conversions similar to [iLovePDF](https://www.ilovepdf.com/). This server will enable AI assistants to convert between various file formats including PDFs, images, documents, spreadsheets, and more.

**For EGDesk Project**: All core packages have been installed. You can now implement file conversion tools in your MCP server!

## Table of Contents

- [Architecture](#architecture)
- [Required Dependencies](#required-dependencies)
- [Tool Definitions](#tool-definitions)
- [Implementation Guide](#implementation-guide)
- [Security Considerations](#security-considerations)
- [Deployment Options](#deployment-options)
- [Example Usage](#example-usage)
- [Performance Optimization](#performance-optimization)
- [Troubleshooting](#troubleshooting)

---

## Architecture

### MCP Server Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Assistant (Client)                     │
│              (Claude Desktop, EGDesk, etc.)                  │
└───────────────────────┬─────────────────────────────────────┘
                        │ MCP Protocol
                        │ (stdio/HTTP/SSE)
┌───────────────────────▼─────────────────────────────────────┐
│              File Conversion MCP Server                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Tool Registry                           │   │
│  │  • pdf_to_image        • word_to_pdf                │   │
│  │  • image_to_pdf        • excel_to_pdf               │   │
│  │  • pdf_merge           • powerpoint_to_pdf          │   │
│  │  • pdf_split           • image_convert              │   │
│  │  • pdf_compress        • html_to_pdf                │   │
│  │  • pdf_unlock          • markdown_to_pdf            │   │
│  │  • pdf_rotate          • ocr_pdf                    │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Conversion Engine Layer                    │   │
│  │  • PDF Processing    • Image Processing             │   │
│  │  • OCR Engine        • Document Processing          │   │
│  │  • Compression       • Format Validation            │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │            File Management Layer                     │   │
│  │  • Temporary Storage  • File Cleanup                │   │
│  │  • Input Validation   • Output Generation           │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Integration with Existing Systems

This MCP server can be integrated with:
- **Claude Desktop**: Via stdio transport
- **EGDesk Application**: Via HTTP/SSE transport
- **Custom Applications**: Via any MCP-compatible client

---

## Required Dependencies

### ✅ Installation Status for EGDesk Project

**Already Installed:**
- ✅ `@modelcontextprotocol/sdk` (^1.20.0)
- ✅ `playwright` (^1.55.1) - **Saves ~180 MB!**
- ✅ `xlsx` (^0.18.5)
- ✅ `pdf-lib` (^1.17.1) - ✅ **INSTALLED**
- ✅ `sharp` (^0.34.4) - ✅ **INSTALLED**
- ✅ `mammoth` (^1.11.0) - ✅ **INSTALLED**
- ✅ `marked` (^16.4.1) - ✅ **INSTALLED**

**Total Added Size**: ~23 MB (23 packages added)  
**Status**: ✅ **ALL CORE DEPENDENCIES INSTALLED - READY TO USE!**

---

### Core Libraries (Pure Node.js - No System Dependencies)

> **Note**: This implementation uses **Playwright** instead of Puppeteer since most Electron/Desktop apps already have it installed. If you're already using Playwright, this saves ~170-200MB!

#### 1. PDF Processing
```json
{
  "pdf-lib": "^1.17.1"
}
```

**Size**: ~5 MB  
**Purpose**: Create, modify, merge, split, and manipulate PDFs  
**System Dependencies**: None ✅

#### 2. Image Processing
```json
{
  "sharp": "^0.33.0"
}
```

**Size**: ~15 MB  
**Purpose**: Convert, resize, compress, and manipulate images (PNG, JPG, WEBP, AVIF, TIFF)  
**System Dependencies**: None (includes prebuilt binaries) ✅

#### 3. Document Reading & Conversion
```json
{
  "mammoth": "^1.6.0",
  "xlsx": "^0.18.5",
  "marked": "^11.0.0"
}
```

**Size**: ~12 MB  
**Purpose**: Read Word documents, Excel spreadsheets, and parse Markdown  
**System Dependencies**: None ✅

#### 4. HTML/Document to PDF Rendering
```json
{
  "playwright": "^1.55.0"
}
```

**Size**: 0 MB if already installed, ~180 MB if new  
**Purpose**: Convert HTML, Markdown, and styled documents to PDF  
**System Dependencies**: Uses system Chrome/Chromium or auto-downloads  
**Note**: Can be replaced with `playwright-core` + system Chrome to save space

#### 5. OCR (Optional)
```json
{
  "tesseract.js": "^5.0.0"
}
```

**Size**: ~5 MB + 30 MB per language  
**Purpose**: Extract text from images and scanned PDFs  
**System Dependencies**: None (uses WebAssembly) ✅

#### 6. PDF to Image (Optional)
```json
{
  "canvas": "^2.11.0",
  "pdfjs-dist": "^3.11.0"
}
```

**Size**: ~30 MB  
**Purpose**: Convert PDF pages to images  
**System Dependencies**: None (includes native bindings) ✅

#### 7. MCP Protocol
```json
{
  "@modelcontextprotocol/sdk": "^1.20.0"
}
```

**Size**: ~2 MB  
**Purpose**: MCP server implementation

### Total Size Impact

| Configuration | Size | What You Get | Status |
|--------------|------|--------------|--------|
| **Core (EGDesk)** | ~23 MB | PDF + Image + Docs + HTML→PDF | ✅ **INSTALLED** |
| **+ PDF→Image** | +30 MB | PDF page to image conversion | Optional |
| **+ OCR** | +35 MB | Text extraction from images | Optional |

**For EGDesk Project**: ✅ All core functionality installed (~23 MB added)!

### No System Dependencies Required

This implementation is **100% pure Node.js** - no need to install:
- ❌ LibreOffice
- ❌ ImageMagick
- ❌ Ghostscript
- ❌ System Tesseract

Everything works with just `npm install`!

---

## Tool Definitions

### 1. PDF Tools

#### **pdf_to_image**
Convert PDF pages to images

```typescript
{
  name: 'pdf_to_image',
  description: 'Convert PDF pages to images (PNG, JPG, WEBP)',
  inputSchema: {
    type: 'object',
    properties: {
      pdfPath: {
        type: 'string',
        description: 'Path to the PDF file'
      },
      format: {
        type: 'string',
        enum: ['png', 'jpg', 'jpeg', 'webp'],
        description: 'Output image format',
        default: 'png'
      },
      pages: {
        type: 'array',
        items: { type: 'number' },
        description: 'Page numbers to convert (1-indexed). Empty = all pages'
      },
      dpi: {
        type: 'number',
        description: 'Resolution in DPI (default: 300)',
        default: 300,
        minimum: 72,
        maximum: 600
      },
      outputDir: {
        type: 'string',
        description: 'Directory to save images (default: temp directory)'
      }
    },
    required: ['pdfPath']
  }
}
```

#### **image_to_pdf**
Convert images to PDF

```typescript
{
  name: 'image_to_pdf',
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
        default: 'portrait'
      },
      fitToPage: {
        type: 'boolean',
        description: 'Fit images to page size',
        default: true
      }
    },
    required: ['imagePaths', 'outputPath']
  }
}
```

#### **pdf_merge**
Merge multiple PDFs into one

```typescript
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
      },
      addBookmarks: {
        type: 'boolean',
        description: 'Add bookmarks for each merged PDF',
        default: false
      }
    },
    required: ['pdfPaths', 'outputPath']
  }
}
```

#### **pdf_split**
Split PDF into multiple files

```typescript
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
      splitMode: {
        type: 'string',
        enum: ['pages', 'ranges', 'every_n'],
        description: 'Split mode'
      },
      pages: {
        type: 'array',
        items: { type: 'number' },
        description: 'Page numbers for split (for "pages" mode)'
      },
      ranges: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            start: { type: 'number' },
            end: { type: 'number' }
          }
        },
        description: 'Page ranges (for "ranges" mode)'
      },
      everyN: {
        type: 'number',
        description: 'Split every N pages (for "every_n" mode)'
      },
      outputDir: {
        type: 'string',
        description: 'Directory to save split PDFs'
      }
    },
    required: ['pdfPath', 'splitMode', 'outputDir']
  }
}
```

#### **pdf_compress**
Compress PDF file

```typescript
{
  name: 'pdf_compress',
  description: 'Compress PDF to reduce file size',
  inputSchema: {
    type: 'object',
    properties: {
      pdfPath: {
        type: 'string',
        description: 'Path to the PDF file to compress'
      },
      outputPath: {
        type: 'string',
        description: 'Output compressed PDF file path'
      },
      quality: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: 'Compression quality level',
        default: 'medium'
      },
      compressImages: {
        type: 'boolean',
        description: 'Compress embedded images',
        default: true
      },
      removeMetadata: {
        type: 'boolean',
        description: 'Remove PDF metadata',
        default: false
      }
    },
    required: ['pdfPath', 'outputPath']
  }
}
```

#### **pdf_unlock**
Remove password protection from PDF

```typescript
{
  name: 'pdf_unlock',
  description: 'Remove password protection from a PDF file',
  inputSchema: {
    type: 'object',
    properties: {
      pdfPath: {
        type: 'string',
        description: 'Path to the password-protected PDF'
      },
      password: {
        type: 'string',
        description: 'PDF password'
      },
      outputPath: {
        type: 'string',
        description: 'Output unlocked PDF file path'
      }
    },
    required: ['pdfPath', 'password', 'outputPath']
  }
}
```

#### **pdf_rotate**
Rotate PDF pages

```typescript
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
      rotation: {
        type: 'number',
        enum: [90, 180, 270],
        description: 'Rotation angle in degrees'
      },
      pages: {
        type: 'array',
        items: { type: 'number' },
        description: 'Page numbers to rotate (empty = all pages)'
      },
      outputPath: {
        type: 'string',
        description: 'Output PDF file path'
      }
    },
    required: ['pdfPath', 'rotation', 'outputPath']
  }
}
```

#### **ocr_pdf**
Extract text from scanned PDF

```typescript
{
  name: 'ocr_pdf',
  description: 'Perform OCR on a scanned PDF to extract text',
  inputSchema: {
    type: 'object',
    properties: {
      pdfPath: {
        type: 'string',
        description: 'Path to the scanned PDF file'
      },
      language: {
        type: 'string',
        description: 'OCR language code (e.g., "eng", "spa", "fra")',
        default: 'eng'
      },
      outputFormat: {
        type: 'string',
        enum: ['text', 'searchable_pdf'],
        description: 'Output format',
        default: 'text'
      },
      outputPath: {
        type: 'string',
        description: 'Output file path'
      }
    },
    required: ['pdfPath', 'outputPath']
  }
}
```

### 2. Image Conversion Tools

#### **image_convert**
Convert between image formats

```typescript
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
        enum: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff', 'svg'],
        description: 'Target image format'
      },
      quality: {
        type: 'number',
        description: 'Image quality (1-100)',
        minimum: 1,
        maximum: 100,
        default: 90
      },
      resize: {
        type: 'object',
        properties: {
          width: { type: 'number' },
          height: { type: 'number' },
          fit: {
            type: 'string',
            enum: ['cover', 'contain', 'fill', 'inside', 'outside']
          }
        }
      }
    },
    required: ['inputPath', 'outputPath', 'format']
  }
}
```

#### **image_compress**
Compress image files

```typescript
{
  name: 'image_compress',
  description: 'Compress image to reduce file size',
  inputSchema: {
    type: 'object',
    properties: {
      inputPath: {
        type: 'string',
        description: 'Path to the input image'
      },
      outputPath: {
        type: 'string',
        description: 'Output compressed image path'
      },
      quality: {
        type: 'number',
        description: 'Compression quality (1-100)',
        minimum: 1,
        maximum: 100,
        default: 80
      }
    },
    required: ['inputPath', 'outputPath']
  }
}
```

### 3. Document Conversion Tools

#### **word_to_pdf**
Convert Word documents to PDF

```typescript
{
  name: 'word_to_pdf',
  description: 'Convert Word documents (DOC, DOCX) to PDF',
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
      },
      preserveFormatting: {
        type: 'boolean',
        description: 'Preserve document formatting',
        default: true
      }
    },
    required: ['inputPath', 'outputPath']
  }
}
```

#### **excel_to_pdf**
Convert Excel spreadsheets to PDF

```typescript
{
  name: 'excel_to_pdf',
  description: 'Convert Excel spreadsheets (XLS, XLSX) to PDF',
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
        description: 'Specific sheet to convert (empty = all sheets)'
      },
      fitToPage: {
        type: 'boolean',
        description: 'Fit content to page width',
        default: true
      }
    },
    required: ['inputPath', 'outputPath']
  }
}
```

#### **powerpoint_to_pdf**
Convert PowerPoint presentations to PDF

```typescript
{
  name: 'powerpoint_to_pdf',
  description: 'Convert PowerPoint presentations (PPT, PPTX) to PDF',
  inputSchema: {
    type: 'object',
    properties: {
      inputPath: {
        type: 'string',
        description: 'Path to the PowerPoint file'
      },
      outputPath: {
        type: 'string',
        description: 'Output PDF file path'
      },
      includeNotes: {
        type: 'boolean',
        description: 'Include speaker notes',
        default: false
      }
    },
    required: ['inputPath', 'outputPath']
  }
}
```

#### **html_to_pdf**
Convert HTML to PDF

```typescript
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
        default: 'A4'
      },
      printBackground: {
        type: 'boolean',
        description: 'Print background graphics',
        default: true
      },
      margin: {
        type: 'object',
        properties: {
          top: { type: 'string' },
          right: { type: 'string' },
          bottom: { type: 'string' },
          left: { type: 'string' }
        }
      }
    },
    required: ['source', 'outputPath']
  }
}
```

#### **markdown_to_pdf**
Convert Markdown to PDF

```typescript
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
      },
      includeTableOfContents: {
        type: 'boolean',
        description: 'Generate table of contents',
        default: false
      }
    },
    required: ['inputPath', 'outputPath']
  }
}
```

---

## Implementation Guide

### 1. Project Setup

```bash
# Create project directory
mkdir file-conversion-mcp-server
cd file-conversion-mcp-server

# Initialize npm project
npm init -y

# Install core dependencies (Essential - ~35 MB)
npm install @modelcontextprotocol/sdk pdf-lib sharp

# Install document support (Recommended - +12 MB)
npm install mammoth xlsx marked

# Install Playwright for HTML/Markdown→PDF (Optional - +180 MB if not installed)
# Note: If you already have Playwright in your project, skip this!
npm install playwright
# OR use playwright-core + system Chrome to save space:
# npm install playwright-core

# Install OCR support (Optional - +35 MB)
npm install tesseract.js

# Install PDF→Image support (Optional - +30 MB)
npm install canvas pdfjs-dist

# Install dev dependencies
npm install -D typescript @types/node ts-node

# Initialize TypeScript
npx tsc --init
```

### 2. Server Implementation

Create `src/server.ts`:

```typescript
#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Import conversion handlers
import { handlePdfToImage } from './handlers/pdf-to-image.js';
import { handleImageToPdf } from './handlers/image-to-pdf.js';
import { handlePdfMerge } from './handlers/pdf-merge.js';
import { handlePdfSplit } from './handlers/pdf-split.js';
import { handlePdfCompress } from './handlers/pdf-compress.js';
import { handleImageConvert } from './handlers/image-convert.js';
import { handleWordToPdf } from './handlers/word-to-pdf.js';
import { handleExcelToPdf } from './handlers/excel-to-pdf.js';
import { handleHtmlToPdf } from './handlers/html-to-pdf.js';
import { handleMarkdownToPdf } from './handlers/markdown-to-pdf.js';
import { handleOcrPdf } from './handlers/ocr-pdf.js';

// Create MCP server
const server = new Server(
  {
    name: 'file-conversion-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // PDF Tools
      {
        name: 'pdf_to_image',
        description: 'Convert PDF pages to images (PNG, JPG, WEBP)',
        inputSchema: {
          type: 'object',
          properties: {
            pdfPath: { type: 'string', description: 'Path to the PDF file' },
            format: {
              type: 'string',
              enum: ['png', 'jpg', 'jpeg', 'webp'],
              default: 'png',
            },
            pages: {
              type: 'array',
              items: { type: 'number' },
              description: 'Page numbers to convert (empty = all)',
            },
            dpi: { type: 'number', default: 300, minimum: 72, maximum: 600 },
            outputDir: { type: 'string' },
          },
          required: ['pdfPath'],
        },
      },
      {
        name: 'image_to_pdf',
        description: 'Convert one or multiple images to PDF',
        inputSchema: {
          type: 'object',
          properties: {
            imagePaths: {
              type: 'array',
              items: { type: 'string' },
              description: 'Paths to image files',
            },
            outputPath: { type: 'string' },
            pageSize: {
              type: 'string',
              enum: ['A4', 'Letter', 'Legal', 'A3', 'A5'],
              default: 'A4',
            },
            orientation: {
              type: 'string',
              enum: ['portrait', 'landscape'],
              default: 'portrait',
            },
          },
          required: ['imagePaths', 'outputPath'],
        },
      },
      {
        name: 'pdf_merge',
        description: 'Merge multiple PDF files into one',
        inputSchema: {
          type: 'object',
          properties: {
            pdfPaths: {
              type: 'array',
              items: { type: 'string' },
            },
            outputPath: { type: 'string' },
            addBookmarks: { type: 'boolean', default: false },
          },
          required: ['pdfPaths', 'outputPath'],
        },
      },
      {
        name: 'pdf_compress',
        description: 'Compress PDF to reduce file size',
        inputSchema: {
          type: 'object',
          properties: {
            pdfPath: { type: 'string' },
            outputPath: { type: 'string' },
            quality: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              default: 'medium',
            },
          },
          required: ['pdfPath', 'outputPath'],
        },
      },
      {
        name: 'image_convert',
        description: 'Convert images between formats',
        inputSchema: {
          type: 'object',
          properties: {
            inputPath: { type: 'string' },
            outputPath: { type: 'string' },
            format: {
              type: 'string',
              enum: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff'],
            },
            quality: { type: 'number', minimum: 1, maximum: 100, default: 90 },
          },
          required: ['inputPath', 'outputPath', 'format'],
        },
      },
      {
        name: 'word_to_pdf',
        description: 'Convert Word documents to PDF',
        inputSchema: {
          type: 'object',
          properties: {
            inputPath: { type: 'string' },
            outputPath: { type: 'string' },
          },
          required: ['inputPath', 'outputPath'],
        },
      },
      {
        name: 'html_to_pdf',
        description: 'Convert HTML to PDF',
        inputSchema: {
          type: 'object',
          properties: {
            source: { type: 'string', description: 'HTML file or URL' },
            outputPath: { type: 'string' },
            pageSize: {
              type: 'string',
              enum: ['A4', 'Letter', 'Legal'],
              default: 'A4',
            },
          },
          required: ['source', 'outputPath'],
        },
      },
      {
        name: 'markdown_to_pdf',
        description: 'Convert Markdown to PDF',
        inputSchema: {
          type: 'object',
          properties: {
            inputPath: { type: 'string' },
            outputPath: { type: 'string' },
            theme: {
              type: 'string',
              enum: ['default', 'github', 'dark'],
              default: 'default',
            },
          },
          required: ['inputPath', 'outputPath'],
        },
      },
      {
        name: 'ocr_pdf',
        description: 'Perform OCR on scanned PDF',
        inputSchema: {
          type: 'object',
          properties: {
            pdfPath: { type: 'string' },
            language: { type: 'string', default: 'eng' },
            outputFormat: {
              type: 'string',
              enum: ['text', 'searchable_pdf'],
              default: 'text',
            },
            outputPath: { type: 'string' },
          },
          required: ['pdfPath', 'outputPath'],
        },
      },
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'pdf_to_image':
        return await handlePdfToImage(args);
      case 'image_to_pdf':
        return await handleImageToPdf(args);
      case 'pdf_merge':
        return await handlePdfMerge(args);
      case 'pdf_split':
        return await handlePdfSplit(args);
      case 'pdf_compress':
        return await handlePdfCompress(args);
      case 'image_convert':
        return await handleImageConvert(args);
      case 'word_to_pdf':
        return await handleWordToPdf(args);
      case 'excel_to_pdf':
        return await handleExcelToPdf(args);
      case 'html_to_pdf':
        return await handleHtmlToPdf(args);
      case 'markdown_to_pdf':
        return await handleMarkdownToPdf(args);
      case 'ocr_pdf':
        return await handleOcrPdf(args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('File Conversion MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
```

### 3. Example Handler Implementation

Create `src/handlers/pdf-to-image.ts`:

```typescript
import { createCanvas } from 'canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

export async function handlePdfToImage(args: any) {
  const {
    pdfPath,
    format = 'png',
    pages = [],
    dpi = 300,
    outputDir = os.tmpdir(),
  } = args;

  try {
    // Validate input file exists
    await fs.access(pdfPath);

    // Load PDF
    const data = new Uint8Array(await fs.readFile(pdfPath));
    const loadingTask = getDocument({ data });
    const pdfDoc = await loadingTask.promise;
    const pageCount = pdfDoc.numPages;

    // Determine which pages to convert
    const pagesToConvert = pages.length > 0 ? pages : Array.from({ length: pageCount }, (_, i) => i + 1);

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    const outputFiles: string[] = [];
    const scale = dpi / 72; // Convert DPI to scale

    // Convert each page
    for (const pageNum of pagesToConvert) {
      if (pageNum < 1 || pageNum > pageCount) {
        throw new Error(`Invalid page number: ${pageNum}`);
      }

      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      // Create canvas
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');

      // Render PDF page to canvas
      await page.render({
        canvasContext: context as any,
        viewport: viewport,
      }).promise;

      // Save as image
      const outputPath = path.join(outputDir, `page_${pageNum}.${format}`);
      const buffer = canvas.toBuffer(format === 'jpg' || format === 'jpeg' ? 'image/jpeg' : 'image/png');
      await fs.writeFile(outputPath, buffer);
      
      outputFiles.push(outputPath);
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: `Converted ${outputFiles.length} page(s) to ${format}`,
          files: outputFiles,
        }, null, 2),
      }],
    };
  } catch (error) {
    throw new Error(`PDF to Image conversion failed: ${error.message}`);
  }
}
```

Create `src/handlers/image-to-pdf.ts`:

```typescript
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { promises as fs } from 'fs';

export async function handleImageToPdf(args: any) {
  const {
    imagePaths,
    outputPath,
    pageSize = 'A4',
    orientation = 'portrait',
    fitToPage = true,
  } = args;

  try {
    const pdfDoc = await PDFDocument.create();

    // Page dimensions in points (1 point = 1/72 inch)
    const pageSizes: Record<string, [number, number]> = {
      A4: [595, 842],
      Letter: [612, 792],
      Legal: [612, 1008],
      A3: [842, 1191],
      A5: [420, 595],
    };

    let [pageWidth, pageHeight] = pageSizes[pageSize];
    if (orientation === 'landscape') {
      [pageWidth, pageHeight] = [pageHeight, pageWidth];
    }

    for (const imagePath of imagePaths) {
      // Read and process image
      const imageBuffer = await fs.readFile(imagePath);
      const metadata = await sharp(imageBuffer).metadata();

      // Embed image in PDF
      let image;
      if (imagePath.toLowerCase().endsWith('.png')) {
        image = await pdfDoc.embedPng(imageBuffer);
      } else if (
        imagePath.toLowerCase().endsWith('.jpg') ||
        imagePath.toLowerCase().endsWith('.jpeg')
      ) {
        image = await pdfDoc.embedJpg(imageBuffer);
      } else {
        // Convert to PNG if not supported
        const pngBuffer = await sharp(imageBuffer).png().toBuffer();
        image = await pdfDoc.embedPng(pngBuffer);
      }

      const page = pdfDoc.addPage([pageWidth, pageHeight]);

      // Calculate dimensions to fit
      let imgWidth = image.width;
      let imgHeight = image.height;

      if (fitToPage) {
        const scale = Math.min(
          pageWidth / imgWidth,
          pageHeight / imgHeight
        );
        imgWidth = imgWidth * scale;
        imgHeight = imgHeight * scale;
      }

      // Center image on page
      const x = (pageWidth - imgWidth) / 2;
      const y = (pageHeight - imgHeight) / 2;

      page.drawImage(image, {
        x,
        y,
        width: imgWidth,
        height: imgHeight,
      });
    }

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    await fs.writeFile(outputPath, pdfBytes);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: `Created PDF with ${imagePaths.length} image(s)`,
          outputPath,
        }, null, 2),
      }],
    };
  } catch (error) {
    throw new Error(`Image to PDF conversion failed: ${error.message}`);
  }
}
```

Create `src/handlers/word-to-pdf.ts`:

```typescript
import mammoth from 'mammoth';
import { chromium } from 'playwright';
import { promises as fs } from 'fs';

export async function handleWordToPdf(args: any) {
  const { inputPath, outputPath, preserveFormatting = true } = args;

  try {
    // Extract HTML from Word document
    const result = await mammoth.convertToHtml({ path: inputPath });
    
    // Style the HTML to look like a Word document
    const styledHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            @page {
              size: Letter;
              margin: 1in;
            }
            body {
              font-family: 'Calibri', 'Arial', sans-serif;
              font-size: 11pt;
              line-height: 1.5;
              color: #000;
              margin: 0;
              padding: 0;
            }
            p {
              margin: 0 0 12pt 0;
              text-align: justify;
            }
            h1 {
              font-size: 18pt;
              font-weight: bold;
              margin: 24pt 0 12pt 0;
            }
            h2 {
              font-size: 16pt;
              font-weight: bold;
              margin: 18pt 0 12pt 0;
            }
            h3 {
              font-size: 14pt;
              font-weight: bold;
              margin: 14pt 0 12pt 0;
            }
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
            ul, ol {
              margin: 0 0 12pt 0;
              padding-left: 30pt;
            }
            li {
              margin-bottom: 6pt;
            }
            img {
              max-width: 100%;
              height: auto;
            }
            strong {
              font-weight: bold;
            }
            em {
              font-style: italic;
            }
          </style>
        </head>
        <body>${result.value}</body>
      </html>
    `;

    // Convert HTML to PDF using Playwright
    const browser = await chromium.launch({ headless: true });
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
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: 'Word document converted to PDF',
          outputPath,
          warnings: result.messages.length > 0 ? result.messages : undefined,
        }, null, 2),
      }],
    };
  } catch (error) {
    throw new Error(`Word to PDF conversion failed: ${error.message}`);
  }
}
```

Create `src/handlers/excel-to-pdf.ts`:

```typescript
import XLSX from 'xlsx';
import { chromium } from 'playwright';

export async function handleExcelToPdf(args: any) {
  const { inputPath, outputPath, sheetName, fitToPage = true } = args;

  try {
    // Read Excel file
    const workbook = XLSX.readFile(inputPath);
    const sheet = sheetName 
      ? workbook.Sheets[sheetName]
      : workbook.Sheets[workbook.SheetNames[0]];

    if (!sheet) {
      throw new Error(`Sheet "${sheetName || 'first sheet'}" not found`);
    }

    // Convert to HTML
    const html = XLSX.utils.sheet_to_html(sheet);
    
    // Style the HTML
    const styledHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            @page {
              size: Letter landscape;
              margin: 0.5in;
            }
            body {
              font-family: 'Calibri', 'Arial', sans-serif;
              font-size: 10pt;
              margin: 0;
              padding: 0;
            }
            table {
              border-collapse: collapse;
              width: 100%;
              table-layout: ${fitToPage ? 'fixed' : 'auto'};
            }
            td, th {
              border: 1px solid #000;
              padding: 4pt 8pt;
              text-align: left;
              word-wrap: break-word;
            }
            th {
              background-color: #4472C4;
              color: white;
              font-weight: bold;
            }
            tr:nth-child(even) {
              background-color: #f2f2f2;
            }
          </style>
        </head>
        <body>${html}</body>
      </html>
    `;

    // Convert to PDF using Playwright
    const browser = await chromium.launch({ headless: true });
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
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: 'Excel spreadsheet converted to PDF',
          outputPath,
          sheetConverted: sheetName || workbook.SheetNames[0],
        }, null, 2),
      }],
    };
  } catch (error) {
    throw new Error(`Excel to PDF conversion failed: ${error.message}`);
  }
}
```

Create `src/handlers/markdown-to-pdf.ts`:

```typescript
import { marked } from 'marked';
import { chromium } from 'playwright';
import { promises as fs } from 'fs';

export async function handleMarkdownToPdf(args: any) {
  const { inputPath, outputPath, theme = 'default', includeTableOfContents = false } = args;

  try {
    // Read markdown file
    const markdown = await fs.readFile(inputPath, 'utf-8');
    
    // Convert markdown to HTML
    const content = marked(markdown);
    
    // Generate table of contents if requested
    let toc = '';
    if (includeTableOfContents) {
      const tokens = marked.lexer(markdown);
      const headings = tokens.filter((t: any) => t.type === 'heading');
      toc = '<div class="toc"><h2>Table of Contents</h2><ul>';
      headings.forEach((h: any) => {
        const indent = '  '.repeat(h.depth - 1);
        toc += `${indent}<li><a href="#${h.text.toLowerCase().replace(/\s+/g, '-')}">${h.text}</a></li>`;
      });
      toc += '</ul></div>';
    }

    // Theme styles
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
            body {
              line-height: 1.6;
              margin: 0;
              padding: 20px;
              max-width: 800px;
            }
            h1 { font-size: 2em; margin: 0.67em 0; page-break-after: avoid; }
            h2 { font-size: 1.5em; margin: 0.75em 0; page-break-after: avoid; }
            h3 { font-size: 1.17em; margin: 0.83em 0; }
            p { margin: 1em 0; }
            code {
              font-family: 'Courier New', monospace;
              padding: 2px 6px;
              border-radius: 3px;
              font-size: 0.9em;
            }
            pre {
              padding: 15px;
              border-radius: 5px;
              overflow-x: auto;
              page-break-inside: avoid;
            }
            pre code {
              background: none;
              padding: 0;
            }
            blockquote {
              border-left: 4px solid #ddd;
              padding-left: 16px;
              margin-left: 0;
              color: #666;
            }
            table {
              border-collapse: collapse;
              width: 100%;
              margin: 1em 0;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 8px 12px;
              text-align: left;
            }
            th { background: #f5f5f5; font-weight: bold; }
            img { max-width: 100%; height: auto; }
            .toc { 
              background: #f9f9f9;
              padding: 16px;
              margin-bottom: 32px;
              border-radius: 8px;
            }
            .toc ul { list-style: none; padding-left: 0; }
            .toc li { margin: 4px 0; }
            .toc a { text-decoration: none; color: #0066cc; }
            ${themes[theme as keyof typeof themes] || themes.default}
          </style>
        </head>
        <body>
          ${toc}
          ${content}
        </body>
      </html>
    `;

    // Convert to PDF using Playwright
    const browser = await chromium.launch({ headless: true });
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
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: 'Markdown converted to PDF',
          outputPath,
          theme,
        }, null, 2),
      }],
    };
  } catch (error) {
    throw new Error(`Markdown to PDF conversion failed: ${error.message}`);
  }
}
```

Create `src/handlers/html-to-pdf.ts`:

```typescript
import { chromium } from 'playwright';
import { promises as fs } from 'fs';

export async function handleHtmlToPdf(args: any) {
  const {
    source,
    outputPath,
    pageSize = 'A4',
    printBackground = true,
    margin = { top: '1in', right: '1in', bottom: '1in', left: '1in' },
  } = args;

  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Check if source is a URL or file path
    if (source.startsWith('http://') || source.startsWith('https://')) {
      // Load URL
      await page.goto(source, { waitUntil: 'networkidle' });
    } else {
      // Load HTML file
      const html = await fs.readFile(source, 'utf-8');
      await page.setContent(html, { waitUntil: 'networkidle' });
    }

    // Generate PDF
    await page.pdf({
      path: outputPath,
      format: pageSize as any,
      margin,
      printBackground,
    });

    await browser.close();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: 'HTML converted to PDF',
          outputPath,
          source,
        }, null, 2),
      }],
    };
  } catch (error) {
    throw new Error(`HTML to PDF conversion failed: ${error.message}`);
  }
}
```

### 4. Package.json Configuration

```json
{
  "name": "file-conversion-mcp-server",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "file-conversion-mcp": "./dist/server.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/server.js",
    "dev": "ts-node src/server.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.20.0",
    "pdf-lib": "^1.17.1",
    "sharp": "^0.33.0",
    "playwright": "^1.55.0",
    "mammoth": "^1.6.0",
    "xlsx": "^0.18.5",
    "marked": "^11.0.0"
  },
  "optionalDependencies": {
    "canvas": "^2.11.0",
    "pdfjs-dist": "^3.11.0",
    "tesseract.js": "^5.0.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.0.0",
    "ts-node": "^10.9.0"
  }
}
```

**Note**: 
- Core dependencies (~47 MB) provide 90% of functionality
- Optional dependencies add PDF→Image and OCR support if needed
- If you already have `playwright` in your project, the total addition is only ~40 MB!

---

## Security Considerations

### 1. File Access Control

```typescript
// Implement path validation
function validatePath(filePath: string, allowedDirs: string[]): boolean {
  const resolvedPath = path.resolve(filePath);
  return allowedDirs.some(dir => resolvedPath.startsWith(path.resolve(dir)));
}

// Usage in handlers
if (!validatePath(pdfPath, ['/home/user/documents', '/tmp'])) {
  throw new Error('Access denied: Path not allowed');
}
```

### 2. File Size Limits

```typescript
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

async function validateFileSize(filePath: string) {
  const stats = await fs.stat(filePath);
  if (stats.size > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${stats.size} bytes (max: ${MAX_FILE_SIZE})`);
  }
}
```

### 3. Temporary File Cleanup

```typescript
import { promises as fs } from 'fs';
import path from 'path';

class TempFileManager {
  private tempFiles: Set<string> = new Set();

  async createTempFile(prefix: string, extension: string): Promise<string> {
    const tempDir = os.tmpdir();
    const fileName = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}${extension}`;
    const filePath = path.join(tempDir, fileName);
    this.tempFiles.add(filePath);
    return filePath;
  }

  async cleanup() {
    for (const file of this.tempFiles) {
      try {
        await fs.unlink(file);
      } catch (error) {
        console.error(`Failed to delete temp file ${file}:`, error);
      }
    }
    this.tempFiles.clear();
  }
}

// Use in handlers
const tempManager = new TempFileManager();
process.on('exit', () => tempManager.cleanup());
process.on('SIGINT', () => {
  tempManager.cleanup();
  process.exit();
});
```

### 4. Input Validation

```typescript
import { z } from 'zod';

const PdfToImageSchema = z.object({
  pdfPath: z.string().min(1),
  format: z.enum(['png', 'jpg', 'jpeg', 'webp']).default('png'),
  pages: z.array(z.number().positive()).optional(),
  dpi: z.number().min(72).max(600).default(300),
  outputDir: z.string().optional(),
});

export async function handlePdfToImage(args: any) {
  // Validate input
  const validatedArgs = PdfToImageSchema.parse(args);
  // ... rest of implementation
}
```

### 5. Rate Limiting

```typescript
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private maxRequests: number = 10;
  private windowMs: number = 60000; // 1 minute

  canMakeRequest(clientId: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(clientId) || [];
    
    // Filter out old requests
    const recentRequests = requests.filter(
      timestamp => now - timestamp < this.windowMs
    );
    
    if (recentRequests.length >= this.maxRequests) {
      return false;
    }
    
    recentRequests.push(now);
    this.requests.set(clientId, recentRequests);
    return true;
  }
}
```

---

## Deployment Options

### 1. Claude Desktop Configuration

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "file-conversion": {
      "command": "node",
      "args": ["/path/to/file-conversion-mcp-server/dist/server.js"],
      "env": {
        "MAX_FILE_SIZE": "104857600",
        "ALLOWED_DIRS": "/home/user/documents,/tmp"
      }
    }
  }
}
```

### 2. EGDesk Integration

Configure in EGDesk settings:

```typescript
{
  "mcpServers": [
    {
      "name": "File Conversion",
      "transport": "stdio",
      "command": "node",
      "args": ["/path/to/file-conversion-mcp-server/dist/server.js"],
      "icon": "file-conversion-icon.svg",
      "category": "utilities"
    }
  ]
}
```

### 3. HTTP Server (for Web Access)

Create `src/http-server.ts`:

```typescript
import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

const app = express();
app.use(express.json());

const server = new Server(
  { name: 'file-conversion-server', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// Setup MCP handlers (same as stdio version)
// ...

app.get('/sse', async (req, res) => {
  const transport = new SSEServerTransport('/messages', res);
  await server.connect(transport);
});

app.post('/messages', async (req, res) => {
  // Handle incoming messages
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`File Conversion HTTP Server running on port ${PORT}`);
});
```

### 4. Docker Deployment

Create `Dockerfile`:

```dockerfile
FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    imagemagick \
    ghostscript \
    libreoffice \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/server.js"]
```

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  file-conversion-mcp:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      - ./temp:/tmp/conversions
    environment:
      - MAX_FILE_SIZE=104857600
      - ALLOWED_DIRS=/app/data
    restart: unless-stopped
```

---

## Example Usage

### Via Claude Desktop

```
User: Convert this PDF to images
Assistant: I'll use the pdf_to_image tool to convert your PDF.

[Calls pdf_to_image with parameters]

The PDF has been converted to 5 PNG images at 300 DPI.
Output files are in /tmp/conversions/
```

### Via API

```bash
# Convert image to PDF
curl -X POST http://localhost:3000/api/convert \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "image_to_pdf",
    "args": {
      "imagePaths": ["/path/to/image1.jpg", "/path/to/image2.jpg"],
      "outputPath": "/path/to/output.pdf",
      "pageSize": "A4"
    }
  }'
```

### Programmatic Usage

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const client = new Client(
  { name: 'file-conversion-client', version: '1.0.0' },
  { capabilities: {} }
);

const transport = new StdioClientTransport({
  command: 'node',
  args: ['/path/to/server.js'],
});

await client.connect(transport);

// List available tools
const tools = await client.listTools();
console.log('Available tools:', tools);

// Call a tool
const result = await client.callTool({
  name: 'pdf_to_image',
  arguments: {
    pdfPath: '/path/to/document.pdf',
    format: 'png',
    dpi: 300,
  },
});

console.log('Conversion result:', result);
```

---

## Performance Optimization

### 1. Caching

```typescript
import { LRUCache } from 'lru-cache';

const conversionCache = new LRUCache<string, Buffer>({
  max: 50, // Maximum 50 cached conversions
  maxSize: 500 * 1024 * 1024, // 500 MB
  sizeCalculation: (value) => value.length,
  ttl: 1000 * 60 * 60, // 1 hour
});

function getCacheKey(tool: string, args: any): string {
  return `${tool}:${JSON.stringify(args)}`;
}
```

### 2. Parallel Processing

```typescript
import { Worker } from 'worker_threads';

async function processInWorker(task: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./conversion-worker.js', {
      workerData: task,
    });
    
    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}
```

### 3. Streaming for Large Files

```typescript
import { pipeline } from 'stream/promises';

async function streamConversion(inputPath: string, outputPath: string) {
  const readStream = fs.createReadStream(inputPath);
  const writeStream = fs.createWriteStream(outputPath);
  
  await pipeline(
    readStream,
    transformStream, // Your conversion logic
    writeStream
  );
}
```

---

## Troubleshooting

### Common Issues

#### 1. PDF Library Not Working
```bash
# Solution: Install required system dependencies
sudo apt-get install ghostscript poppler-utils
```

#### 2. Image Processing Fails
```bash
# Solution: Install ImageMagick
sudo apt-get install imagemagick

# Update ImageMagick policy for PDF support
sudo sed -i '/PDF/s/none/read|write/' /etc/ImageMagick-6/policy.xml
```

#### 3. OCR Not Working
```bash
# Solution: Install Tesseract with language data
sudo apt-get install tesseract-ocr tesseract-ocr-eng

# For additional languages
sudo apt-get install tesseract-ocr-spa tesseract-ocr-fra
```

#### 4. Memory Issues with Large Files
```typescript
// Solution: Increase Node.js memory limit
// package.json
{
  "scripts": {
    "start": "node --max-old-space-size=4096 dist/server.js"
  }
}
```

### Debug Mode

```typescript
const DEBUG = process.env.DEBUG === 'true';

function debug(message: string, data?: any) {
  if (DEBUG) {
    console.error(`[DEBUG] ${message}`, data || '');
  }
}

// Usage
debug('Converting PDF to image', { pdfPath, format, dpi });
```

---

## Additional Resources

### Libraries & Tools
- **PDF Processing**: https://pdf-lib.js.org/
- **Image Processing**: https://sharp.pixelplumbing.com/
- **Document Conversion**: https://github.com/puppeteer/puppeteer
- **OCR**: https://tesseract.projectnaptha.com/
- **MCP SDK**: https://github.com/modelcontextprotocol/sdk

### Related Documentation
- iLovePDF API: https://developer.ilovepdf.com/
- Ghostscript: https://www.ghostscript.com/
- LibreOffice Headless: https://wiki.documentfoundation.org/Faq/General/007

---

## License

This implementation guide is provided as-is. Refer to individual library licenses for usage restrictions.

---

## Support & Contribution

For questions or contributions to this implementation:
- File issues on your repository
- Refer to MCP documentation: https://modelcontextprotocol.io/
- Check library-specific documentation for conversion engines

---

**Last Updated**: October 2025
**Version**: 1.0.0

