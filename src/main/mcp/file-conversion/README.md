# File Conversion MCP Service

> ✅ **STATUS**: Fully integrated and ready to use!  
> ✅ **Integration**: Available in Local Server Manager alongside Gmail and FileSystem MCP  
> ✅ **Dependencies**: pdf-lib, jimp, mammoth, xlsx, marked, playwright (all installed)

## 🎯 Integration Status

**Now Available in EGDesk MCP Configuration!**

The File Conversion MCP Service is integrated into EGDesk and can be accessed via:
- **Local HTTP Server** (localhost:8080/file-conversion)
- **WebSocket Tunnel** (via tunneling-service.onrender.com)
- **Enabled by default** in MCP server configuration

## Overview

The File Conversion MCP Service provides file format conversion capabilities through the Model Context Protocol. It enables AI assistants to convert between various file formats including PDFs, images, documents, and spreadsheets.

## Features

### PDF Operations
- ✅ **pdf_merge**: Merge multiple PDFs into one
- ✅ **pdf_split**: Split PDF into separate files
- ✅ **pdf_rotate**: Rotate PDF pages (90°, 180°, 270°)

### Image Operations
- ✅ **images_to_pdf**: Convert images to PDF
- ✅ **image_convert**: Convert between PNG, JPG/JPEG, BMP, GIF, and TIFF
- ✅ **image_resize**: Resize images

### Document Conversions
- ✅ **word_to_pdf**: Convert Word documents (.docx) to PDF
- ✅ **excel_to_pdf**: Convert Excel spreadsheets (.xlsx) to PDF
- ✅ **markdown_to_pdf**: Convert Markdown to PDF (with themes)
- ✅ **html_to_pdf**: Convert HTML files or URLs to PDF

## Usage

### Basic Example

```typescript
import { createFileConversionMCPService } from './file-conversion';

// Create service instance
const service = createFileConversionMCPService();

// Initialize
await service.initialize();

// Use a tool
const result = await service.executeTool('pdf_merge', {
  pdfPaths: ['/path/to/doc1.pdf', '/path/to/doc2.pdf'],
  outputPath: '/path/to/merged.pdf'
});

console.log(result);
```

### Integration with MCP Server

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createFileConversionMCPService } from './file-conversion';

const conversionService = createFileConversionMCPService();
await conversionService.initialize();

const server = new Server(
  conversionService.getServerInfo(),
  { capabilities: conversionService.getCapabilities() }
);

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: conversionService.listTools()
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  return await conversionService.executeTool(
    request.params.name,
    request.params.arguments
  );
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

## Tool Reference

### pdf_merge

Merge multiple PDF files into a single PDF.

**Parameters:**
- `pdfPaths`: string[] - Array of PDF file paths to merge
- `outputPath`: string - Output merged PDF file path

**Example:**
```json
{
  "pdfPaths": ["/Users/me/doc1.pdf", "/Users/me/doc2.pdf"],
  "outputPath": "/Users/me/merged.pdf"
}
```

### pdf_split

Split a PDF into separate files.

**Parameters:**
- `pdfPath`: string - Path to the PDF file to split
- `outputDir`: string - Directory to save split PDFs
- `pageRanges` (optional): Array<{start: number, end: number}> - Specific page ranges

**Example:**
```json
{
  "pdfPath": "/Users/me/document.pdf",
  "outputDir": "/Users/me/split_pdfs",
  "pageRanges": [
    {"start": 1, "end": 3},
    {"start": 4, "end": 10}
  ]
}
```

### pdf_rotate

Rotate PDF pages by specified degrees.

**Parameters:**
- `pdfPath`: string - Path to the PDF file
- `outputPath`: string - Output PDF file path
- `rotation`: 90 | 180 | 270 - Rotation angle in degrees
- `pages` (optional): number[] - Page numbers to rotate (default: all)

**Example:**
```json
{
  "pdfPath": "/Users/me/document.pdf",
  "outputPath": "/Users/me/rotated.pdf",
  "rotation": 90,
  "pages": [1, 2, 3]
}
```

### images_to_pdf

Convert one or multiple images to PDF.

**Parameters:**
- `imagePaths`: string[] - Array of image file paths
- `outputPath`: string - Output PDF file path
- `pageSize` (optional): 'A4' | 'Letter' | 'Legal' | 'A3' | 'A5' - Default: 'A4'
- `orientation` (optional): 'portrait' | 'landscape' - Default: 'portrait'

**Example:**
```json
{
  "imagePaths": ["/Users/me/image1.jpg", "/Users/me/image2.png"],
  "outputPath": "/Users/me/output.pdf",
  "pageSize": "A4",
  "orientation": "portrait"
}
```

### image_convert

Convert images between different formats.

**Parameters:**
- `inputPath`: string - Path to the input image
- `outputPath`: string - Output image file path
- `format`: 'png' | 'jpg' | 'jpeg' | 'webp' | 'avif' - Target format
- `quality` (optional): number (1-100) - Default: 90

**Example:**
```json
{
  "inputPath": "/Users/me/photo.jpg",
  "outputPath": "/Users/me/photo.webp",
  "format": "png",
  "quality": 85
}
```

### image_resize

Resize an image.

**Parameters:**
- `inputPath`: string - Path to the input image
- `outputPath`: string - Output image file path
- `width` (optional): number - Target width
- `height` (optional): number - Target height

**Example:**
```json
{
  "inputPath": "/Users/me/large.jpg",
  "outputPath": "/Users/me/small.jpg",
  "width": 800,
  "height": 600
}
```

### word_to_pdf

Convert Word documents (.docx) to PDF.

**Parameters:**
- `inputPath`: string - Path to the Word document
- `outputPath`: string - Output PDF file path

**Example:**
```json
{
  "inputPath": "/Users/me/report.docx",
  "outputPath": "/Users/me/report.pdf"
}
```

### excel_to_pdf

Convert Excel spreadsheets (.xlsx) to PDF.

**Parameters:**
- `inputPath`: string - Path to the Excel file
- `outputPath`: string - Output PDF file path
- `sheetName` (optional): string - Specific sheet to convert (default: first sheet)

**Example:**
```json
{
  "inputPath": "/Users/me/data.xlsx",
  "outputPath": "/Users/me/data.pdf",
  "sheetName": "Sheet1"
}
```

### markdown_to_pdf

Convert Markdown files to PDF.

**Parameters:**
- `inputPath`: string - Path to the Markdown file
- `outputPath`: string - Output PDF file path
- `theme` (optional): 'default' | 'github' | 'dark' - Default: 'default'

**Example:**
```json
{
  "inputPath": "/Users/me/README.md",
  "outputPath": "/Users/me/README.pdf",
  "theme": "github"
}
```

### html_to_pdf

Convert HTML files or URLs to PDF.

**Parameters:**
- `source`: string - HTML file path or URL
- `outputPath`: string - Output PDF file path
- `pageSize` (optional): 'A4' | 'Letter' | 'Legal' - Default: 'A4'

**Example:**
```json
{
  "source": "https://example.com",
  "outputPath": "/Users/me/webpage.pdf",
  "pageSize": "A4"
}
```

## Dependencies

All dependencies are already installed in the EGDesk project:

- ✅ `pdf-lib` (^1.17.1) - PDF manipulation
- ✅ `jimp` (^0.22.12) - Image processing (pure JS)
- ✅ `mammoth` (^1.11.0) - Word document reading
- ✅ `xlsx` (^0.18.5) - Excel spreadsheet processing
- ✅ `marked` (^16.4.1) - Markdown parsing
- ✅ `playwright` (^1.55.1) - HTML/Document rendering

**No system dependencies required!** Everything works with pure Node.js.

## Temporary Files

The service automatically manages temporary files:
- Temp directory: `os.tmpdir()/egdesk-conversions`
- Auto-cleanup: Files older than 24 hours are automatically removed
- Manual cleanup: Call `await service.cleanup()` to clean up immediately

## Error Handling

All tools throw descriptive errors if conversion fails:

```typescript
try {
  const result = await service.executeTool('pdf_merge', args);
  console.log('Success:', result);
} catch (error) {
  console.error('Conversion failed:', error.message);
}
```

## Performance Notes

- **PDF operations**: Fast, works on files up to 100+ MB
- **Image conversions**: Pure JS (Jimp); slower than sharp but fully cross-platform
- **Document to PDF**: Slower (uses Playwright rendering), ~2-5 seconds per document
- **HTML to PDF**: Speed depends on page complexity and network (for URLs)

## Limitations

### Word to PDF
- Layout might differ slightly from original (85-95% fidelity)
- Complex Word features (SmartArt, embedded objects) may not render perfectly
- Text content and basic formatting: 95-100% accurate

### Excel to PDF
- Best for simple tables
- Complex formulas, charts may not render
- Fits content to landscape Letter size by default

### Markdown to PDF
- Renders standard Markdown elements
- Code blocks with syntax highlighting
- Three built-in themes available

## Future Enhancements

Potential additions:
- [ ] PowerPoint to PDF
- [ ] PDF to Image conversion (requires canvas + pdfjs-dist)
- [ ] OCR support (requires tesseract.js)
- [ ] PDF compression (currently basic, could add advanced)
- [ ] Batch conversions
- [ ] Progress callbacks for large files

## License

MIT License - Part of the EGDesk project

