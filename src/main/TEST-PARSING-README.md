# Apps Script Documentation Parser - Test Script

This test script demonstrates a **two-phase** approach to parsing Google Apps Script reference documentation.

## Two-Phase Architecture

### Phase 1: Service Index Parsing
Parse the main service page (`/apps-script/reference/{service}`) to extract:
- Service metadata (name, description, URL)
- **List of classes** with brief descriptions and URLs
- Class count

### Phase 2: Class Page Parsing (To Be Implemented)
For each class URL from Phase 1, parse individual class pages to extract:
- Full class description
- Methods with signatures, parameters, return types
- OAuth authorization scopes per method
- Properties and enums
- Code examples

## Why Two-Phase?

Service index pages (like `/apps-script/reference/spreadsheet`) **only contain a table of classes**, not the full method details. Each class (like `Spreadsheet`, `Sheet`, `Range`) requires visiting its own page to get complete documentation.

## Features

### Phase 1 (Implemented) ✅
- ✅ Parse HTML metadata (title, description, canonical URL)
- ✅ Extract breadcrumb navigation
- ✅ **Extract classes table from service index**
- ✅ Service name detection
- ✅ Support for both local files (jsdom) and live URLs (Playwright)
- ✅ JSON output generation

### Phase 2 (Implemented) ✅
- ✅ Parse individual class pages
- ✅ Extract methods with signatures
- ✅ **Parse OAuth authorization scopes per method**
- ✅ Classify scopes as read/write
- ✅ Extract parameters and return types
- ✅ Aggregate unique scopes for class

### To Be Implemented ⏳
- ⏳ Extract code examples
- ⏳ Parse enums and properties  
- ⏳ Batch processing (all classes in a service)
- ⏳ Aggregate all classes into complete service documentation

## Installation

The script uses Playwright which is already included in the project dependencies. Optionally, you can install jsdom for faster local file parsing:

```bash
npm install jsdom
```

## Usage

### Phase 1: Extract Class List from Service Index (Recommended)

Parse the service index page to get a list of all classes:

```bash
# Parse Spreadsheet Service index to get class list
npx ts-node src/main/test-parsing.ts --playwright --phase1 https://developers.google.com/apps-script/reference/spreadsheet

# Parse Forms Service index
npx ts-node src/main/test-parsing.ts --playwright --phase1 https://developers.google.com/apps-script/reference/forms

# Parse Gmail Service index
npx ts-node src/main/test-parsing.ts --playwright --phase1 https://developers.google.com/apps-script/reference/gmail
```

**Output**: Creates `{service}-index.json` with list of classes and their URLs.

### Phase 2: Parse Individual Class Pages (Implemented)

After getting the class list, parse each class page for method details and OAuth scopes:

```bash
# Parse Spreadsheet class page
npx ts-node src/main/test-parsing.ts --playwright --class https://developers.google.com/apps-script/reference/spreadsheet/spreadsheet

# Parse Sheet class page
npx ts-node src/main/test-parsing.ts --playwright --class https://developers.google.com/apps-script/reference/spreadsheet/sheet

# Parse Range class page
npx ts-node src/main/test-parsing.ts --playwright --class https://developers.google.com/apps-script/reference/spreadsheet/range
```

**Output**: Creates `class-{classname}.json` with:
- All methods with signatures
- Parameters and return types
- **OAuth scopes per method** (method-level, not class-level!)
- Scope type classification (read/write)

### Legacy: Single Page Parsing

Parse a single page (limited information):

```bash
npx ts-node src/main/test-parsing.ts --playwright https://developers.google.com/apps-script/reference/document
```

## Output

The script generates JSON files in the `output/` directory:

```
output/
├── spreadsheet-index.json      # Phase 1: Class list
├── forms-index.json
├── gmail-index.json
└── ... (more services)
```

### Phase 1 Output Structure (Service Index)

```json
{
  "service": "Spreadsheet",
  "url": "https://developers.google.com/apps-script/reference/spreadsheet",
  "description": "Access and modify Google Sheets files.",
  "lastScraped": "2025-12-22T12:00:00Z",
  "classCount": 15,
  "classes": [
    {
      "name": "Spreadsheet",
      "url": "https://developers.google.com/apps-script/reference/spreadsheet/spreadsheet",
      "briefDescription": "Access and modify Spreadsheet files."
    },
    {
      "name": "Sheet",
      "url": "https://developers.google.com/apps-script/reference/spreadsheet/sheet",
      "briefDescription": "Access and modify spreadsheet sheets."
    },
    {
      "name": "Range",
      "url": "https://developers.google.com/apps-script/reference/spreadsheet/range",
      "briefDescription": "Access and modify spreadsheet ranges."
    }
  ]
}
```

### Phase 2 Output Structure (Complete Service - To Be Implemented)

```json
{
  "service": "Spreadsheet",
  "url": "https://developers.google.com/apps-script/reference/spreadsheet",
  "description": "Access and modify Google Sheets files.",
  "lastScraped": "2025-12-22T12:00:00Z",
  "requiredScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/spreadsheets.readonly"
  ],
  "classes": [
    {
      "name": "Spreadsheet",
      "url": "...",
      "description": "...",
      "methods": [
        {
          "name": "getActiveSheet",
          "signature": "getActiveSheet()",
          "parameters": [],
          "returnType": "Sheet",
          "requiredScopes": ["..."],
          "example": "..."
        }
      ]
    }
  ],
  "enums": []
}
```

## OAuth Scope Detection

The script automatically detects and validates OAuth scopes:

### Supported Scope Patterns
- `https://www.googleapis.com/auth/*` - Standard Google API scopes
- `https://www.google.com/*/feeds` - Legacy GData API scopes
- `https://mail.google.com/` - Gmail full access scope

### Service-Specific Scopes

The script includes mappings for common scopes:

| Service | Common Scopes |
|---------|---------------|
| **Calendar** | `auth/calendar`, `auth/calendar.readonly`, `calendar/feeds` |
| **Gmail** | `auth/gmail.readonly`, `auth/gmail.modify`, `mail.google.com/` |
| **Drive** | `auth/drive`, `auth/drive.file`, `auth/drive.readonly` |
| **Sheets** | `auth/spreadsheets`, `auth/spreadsheets.readonly` |
| **Docs** | `auth/documents`, `auth/documents.readonly` |
| **Forms** | `auth/forms`, `auth/forms.currentonly` |
| **Slides** | `auth/presentations`, `auth/presentations.readonly` |
| **Contacts** | `auth/contacts`, `m8/feeds` |
| **Script** | `auth/script.projects`, `auth/script.scriptapp` |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Apps Script Doc Parser                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Input: HTML File or URL                                │
│    ↓                                                     │
│  Parser: jsdom or Playwright                            │
│    ↓                                                     │
│  Extract:                                               │
│    • Metadata (title, description, URL)                 │
│    • OAuth Scopes                                       │
│    • Service Information                                │
│    ↓                                                     │
│  Validate:                                              │
│    • Scope URL format                                   │
│    • Required fields present                            │
│    ↓                                                     │
│  Output: JSON File                                      │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## HTML Structure Patterns

### Google DevSite Framework

Apps Script documentation uses custom web components:
- `<devsite-header>` - Page header
- `<devsite-tabs>` - Navigation tabs
- `<devsite-progress>` - Loading indicator

### Metadata Extraction
```html
<title>Service Name | Apps Script | Google for Developers</title>
<meta name="description" content="...">
<link rel="canonical" href="...">
<script type="application/ld+json">
  { "@type": "BreadcrumbList", ... }
</script>
```

### Authorization Sections
```html
<h2>Authorization</h2>
<p>Scripts that use this method require authorization...</p>
<ul>
  <li>https://www.googleapis.com/auth/calendar</li>
  <li>https://www.google.com/calendar/feeds</li>
</ul>
```

## Next Steps

### 1. Implement Body Content Parsing
- Parse class definitions from main content area
- Extract method signatures and descriptions
- Parse parameter tables

### 2. Method-Level Details
- Extract method parameters with types
- Parse return types and descriptions
- Extract code examples

### 3. Full Service Coverage
- Iterate through all 38 Apps Script services
- Build service manifest/index
- Generate combined output file

### 4. Build MCP Server
- Expose documentation via MCP protocol
- Enable AI assistants to query documentation
- Support scope lookup and manifest generation

## Testing

Run the test script on different services to verify parsing:

```bash
# Test on multiple services
npx ts-node src/main/test-parsing.ts --playwright https://developers.google.com/apps-script/reference/spreadsheet
npx ts-node src/main/test-parsing.ts --playwright https://developers.google.com/apps-script/reference/gmail
npx ts-node src/main/test-parsing.ts --playwright https://developers.google.com/apps-script/reference/calendar
npx ts-node src/main/test-parsing.ts --playwright https://developers.google.com/apps-script/reference/drive
```

## Troubleshooting

### Playwright Not Found
```bash
npx playwright install chromium
```

### jsdom Not Found (for local files)
```bash
npm install jsdom
```

### HTML File Not Found
Ensure the HTML file is in the project root directory with the exact filename, or use `--playwright` flag to parse from URL.

## References

- [Apps Script Documentation Parser Plan](../../../appsscriptMCPserver.md)
- [Google Apps Script Reference](https://developers.google.com/apps-script/reference)
- [OAuth 2.0 Scopes](https://developers.google.com/identity/protocols/oauth2/scopes)

