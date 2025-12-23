/**
 * Test Parsing Script for Apps Script Documentation
 * 
 * This script tests parsing of Google Apps Script reference documentation
 * to extract structured data including classes, methods, parameters, and OAuth scopes.
 * 
 * Based on: appsscriptMCPserver.md documentation
 * 
 * Usage:
 *   npm install jsdom  # If not already installed
 *   npx ts-node src/main/test-parsing.ts
 * 
 * Or use Playwright for JavaScript-rendered content:
 *   npx playwright install chromium
 */

import * as fs from 'fs';
import * as path from 'path';

// Try to import jsdom, but make it optional
let JSDOM: any;
try {
  const jsdomModule = require('jsdom');
  JSDOM = jsdomModule.JSDOM;
} catch (e) {
  console.warn('⚠️  jsdom not found. Install with: npm install jsdom');
  console.warn('   Alternatively, use Playwright for better JavaScript rendering support');
}

// ==================== Data Models ====================

interface OAuthScope {
  url: string;
  description?: string;
}

interface ClassSummary {
  name: string;
  url: string;
  briefDescription: string;
}

interface ServiceIndex {
  service: string;
  url: string;
  description: string;
  lastScraped: string;
  classCount: number;
  classes: ClassSummary[];
}

interface Parameter {
  name: string;
  type: string;
  description: string;
}

interface MethodDefinition {
  name: string;
  signature: string;
  description: string;
  parameters: Parameter[];
  returnType: string;
  returnDescription?: string;
  example?: string;
  requiredScopes: string[]; // Method-specific scopes (not inherited from class/service)
  scopeType?: 'read' | 'write' | 'mixed'; // Categorization based on scope analysis
  deprecated?: boolean;
}

interface PropertyDefinition {
  name: string;
  type: string;
  description: string;
}

interface ClassDefinition {
  name: string;
  url: string;
  description: string;
  methods: MethodDefinition[];
  properties: PropertyDefinition[];
}

interface EnumDefinition {
  name: string;
  values: string[];
  description?: string;
}

interface ServiceDocumentation {
  service: string;
  url: string;
  description: string;
  lastScraped: string;
  requiredScopes: string[]; // Aggregated list (union of all method scopes)
  scopeBreakdown?: {
    read: string[];  // Readonly scopes
    write: string[]; // Full access scopes
  };
  classes: ClassDefinition[];
  enums: EnumDefinition[];
}

// ==================== Parser Functions ====================

/**
 * Parse metadata from HTML head section
 */
function parseMetadata(document: Document): {
  title: string;
  description: string;
  canonicalUrl: string;
  breadcrumbs: string[];
} {
  // Extract title
  const titleElement = document.querySelector('title');
  const title = titleElement?.textContent?.trim() || '';

  // Extract description from meta tag
  const descriptionMeta = document.querySelector('meta[name="description"]');
  const description = descriptionMeta?.getAttribute('content') || '';

  // Extract canonical URL
  const canonicalLink = document.querySelector('link[rel="canonical"]');
  const canonicalUrl = canonicalLink?.getAttribute('href') || '';

  // Extract breadcrumbs from JSON-LD structured data
  const breadcrumbs: string[] = [];
  const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
  
  jsonLdScripts.forEach((script) => {
    try {
      const data = JSON.parse(script.textContent || '{}');
      if (data['@type'] === 'BreadcrumbList' && data.itemListElement) {
        data.itemListElement.forEach((item: any) => {
          breadcrumbs.push(item.name);
        });
      }
    } catch (e) {
      console.warn('Failed to parse JSON-LD:', e);
    }
  });

  return {
    title,
    description,
    canonicalUrl,
    breadcrumbs,
  };
}

/**
 * Extract OAuth scopes from authorization sections
 */
function parseAuthorizationScopes(element: Element): string[] {
  const scopes: string[] = [];
  
  // Look for Authorization heading and following content
  const authHeadings = element.querySelectorAll('h2, h3, h4');
  
  authHeadings.forEach((heading) => {
    if (heading.textContent?.toLowerCase().includes('authorization')) {
      // Get next sibling elements until next heading
      let currentElement = heading.nextElementSibling;
      
      while (currentElement && !['H1', 'H2', 'H3', 'H4'].includes(currentElement.tagName)) {
        // Look for scope URLs in list items or paragraphs
        const text = currentElement.textContent || '';
        
        // Match Google OAuth scope patterns
        const scopePatterns = [
          /https:\/\/www\.googleapis\.com\/auth\/[\w.]+/g,
          /https:\/\/www\.google\.com\/[\w]+\/feeds/g,
          /https:\/\/mail\.google\.com\//g,
        ];
        
        scopePatterns.forEach((pattern) => {
          const matches = text.match(pattern);
          if (matches) {
            matches.forEach((scope) => {
              if (!scopes.includes(scope)) {
                scopes.push(scope);
              }
            });
          }
        });
        
        currentElement = currentElement.nextElementSibling;
      }
    }
  });
  
  return scopes;
}

/**
 * Parse service name from title
 */
function parseServiceName(title: string): string {
  // Pattern: "Service Name | Apps Script | Google for Developers"
  const parts = title.split('|');
  if (parts.length > 0) {
    return parts[0].trim().replace(' Service', '');
  }
  return '';
}

/**
 * Extract classes table from service index page
 */
function extractClassesTable(document: Document): ClassSummary[] {
  const classes: ClassSummary[] = [];
  
  // Find the "Classes" heading
  const headings = Array.from(document.querySelectorAll('h2, h3, h4'));
  const classesHeading = headings.find((heading) => {
    const text = heading.textContent?.toLowerCase() || '';
    return text.includes('classes');
  });
  
  if (!classesHeading) {
    console.warn('❌ Classes heading not found');
    return classes;
  }
  
  console.log('✓ Found Classes heading:', classesHeading.textContent?.trim());
  
  // Find the table after the heading (may not be immediate sibling)
  let currentElement = classesHeading.nextElementSibling;
  let attempts = 0;
  let foundTable = false;
  
  while (currentElement && attempts < 10) {
    console.log(`  Checking element: ${currentElement.tagName}${currentElement.className ? ' class="' + currentElement.className + '"' : ''}`);
    
    if (currentElement.tagName === 'TABLE') {
      foundTable = true;
      console.log('  ✓ Found TABLE element');
      
      // Found the classes table - check for rows
      const rows = currentElement.querySelectorAll('tbody tr');
      
      rows.forEach((row: Element, index: number) => {
        // Skip header row
        if (index === 0) return;
        
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          const nameCell = cells[0];
          const descCell = cells[1];
          
          const link = nameCell.querySelector('a');
          if (link) {
            const name = link.textContent?.trim() || '';
            const href = link.getAttribute('href') || '';
            const url = href.startsWith('http') ? href : `https://developers.google.com${href}`;
            const briefDescription = descCell.textContent?.trim() || '';
            
            classes.push({
              name,
              url,
              briefDescription,
            });
          }
        }
      });
      
      break;
    }
    
    currentElement = currentElement.nextElementSibling;
    attempts++;
  }
  
  if (!foundTable) {
    console.warn('❌ No TABLE element found after Classes heading');
  } else if (classes.length === 0) {
    console.warn('⚠️  TABLE found but extracted 0 classes');
  }
  
  return classes;
}

/**
 * Extract common OAuth scopes for known services
 */
function getCommonScopesForService(serviceName: string): string[] {
  const scopeMap: { [key: string]: string[] } = {
    'Calendar': [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.google.com/calendar/feeds',
    ],
    'Gmail': [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://mail.google.com/',
    ],
    'Drive': [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
    'Spreadsheet': [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/spreadsheets.readonly',
    ],
    'Document': [
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/documents.readonly',
    ],
    'Forms': [
      'https://www.googleapis.com/auth/forms',
      'https://www.googleapis.com/auth/forms.currentonly',
    ],
    'Slides': [
      'https://www.googleapis.com/auth/presentations',
      'https://www.googleapis.com/auth/presentations.readonly',
    ],
    'Contacts': [
      'https://www.googleapis.com/auth/contacts',
      'https://www.google.com/m8/feeds',
    ],
    'Script': [
      'https://www.googleapis.com/auth/script.projects',
      'https://www.googleapis.com/auth/script.scriptapp',
    ],
  };

  return scopeMap[serviceName] || [];
}

/**
 * Validate OAuth scope URL format
 */
function isValidOAuthScope(url: string): boolean {
  const validPatterns = [
    /^https:\/\/www\.googleapis\.com\/auth\/[\w.]+$/,
    /^https:\/\/www\.google\.com\/[\w]+\/feeds$/,
    /^https:\/\/mail\.google\.com\/$/,
  ];

  return validPatterns.some((pattern) => pattern.test(url));
}

/**
 * Parse service index page (Phase 1)
 */
function parseServiceIndex(htmlPath: string): ServiceIndex | null {
  try {
    if (!JSDOM) {
      console.error('❌ jsdom is required for parsing. Install with: npm install jsdom');
      return null;
    }

    // Read HTML file
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    
    // Parse with JSDOM
    const dom = new JSDOM(htmlContent);
    const document = dom.window.document;

    // Extract metadata
    const metadata = parseMetadata(document);
    const serviceName = parseServiceName(metadata.title);

    console.log('\n=== Service Index (Phase 1) ===');
    console.log('Service Name:', serviceName);
    console.log('URL:', metadata.canonicalUrl);

    // Extract classes table
    const classes = extractClassesTable(document);
    console.log('Classes found:', classes.length);

    return {
      service: serviceName,
      url: metadata.canonicalUrl,
      description: metadata.description,
      lastScraped: new Date().toISOString(),
      classCount: classes.length,
      classes,
    };
  } catch (error) {
    console.error('Error parsing service index:', error);
    return null;
  }
}

/**
 * Main parsing function (legacy - for single page parsing)
 */
function parseAppsScriptDocumentation(htmlPath: string): ServiceDocumentation | null {
  try {
    if (!JSDOM) {
      console.error('❌ jsdom is required for parsing. Install with: npm install jsdom');
      return null;
    }

    // Read HTML file
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    
    // Parse with JSDOM
    const dom = new JSDOM(htmlContent);
    const document = dom.window.document;

    // Extract metadata
    const metadata = parseMetadata(document);
    console.log('\n=== Metadata ===');
    console.log('Title:', metadata.title);
    console.log('Description:', metadata.description);
    console.log('Canonical URL:', metadata.canonicalUrl);
    console.log('Breadcrumbs:', metadata.breadcrumbs.join(' > '));

    // Parse service name
    const serviceName = parseServiceName(metadata.title);
    console.log('\n=== Service ===');
    console.log('Service Name:', serviceName);

    // Extract OAuth scopes from document
    const documentScopes = parseAuthorizationScopes(document.body);
    console.log('\n=== OAuth Scopes (from document) ===');
    console.log('Found scopes:', documentScopes);

    // Get common scopes for this service
    const commonScopes = getCommonScopesForService(serviceName);
    console.log('\n=== Common Scopes (from service mapping) ===');
    console.log('Common scopes:', commonScopes);

    // Validate scopes
    const allScopes = [...new Set([...documentScopes, ...commonScopes])];
    console.log('\n=== Scope Validation ===');
    allScopes.forEach((scope) => {
      const isValid = isValidOAuthScope(scope);
      console.log(`${isValid ? '✓' : '✗'} ${scope}`);
    });

    // Create service documentation structure
    const serviceDoc: ServiceDocumentation = {
      service: serviceName,
      url: metadata.canonicalUrl,
      description: metadata.description,
      lastScraped: new Date().toISOString(),
      requiredScopes: allScopes.filter((scope) => isValidOAuthScope(scope)),
      classes: [], // TODO: Implement class parsing from body content
      enums: [], // TODO: Implement enum parsing
    };

    // Check for DevSite components
    console.log('\n=== DevSite Framework Check ===');
    const devsiteElements = document.querySelectorAll('[class*="devsite"]');
    console.log('DevSite elements found:', devsiteElements.length);

    const customElements = document.querySelectorAll('devsite-header, devsite-tabs, devsite-progress');
    console.log('Custom web components found:', customElements.length);

    if (customElements.length > 0) {
      console.log('⚠️  JavaScript rendering likely required (Playwright/Puppeteer)');
    }

    return serviceDoc;
  } catch (error) {
    console.error('Error parsing documentation:', error);
    return null;
  }
}

/**
 * Save parsed documentation to JSON
 */
function saveToJson(data: ServiceDocumentation | ServiceIndex, outputPath: string): void {
  try {
    const jsonContent = JSON.stringify(data, null, 2);
    fs.writeFileSync(outputPath, jsonContent, 'utf-8');
    console.log(`\n✓ Saved to: ${outputPath}`);
  } catch (error) {
    console.error('Error saving JSON:', error);
  }
}

/**
 * Parse service index using Playwright (Phase 1)
 */
async function parseServiceIndexWithPlaywright(url: string): Promise<ServiceIndex | null> {
  try {
    const { chromium } = require('playwright');
    
    console.log('\n🎭 Launching Playwright browser...');
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    console.log(`📄 Loading: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle' });
    
    // Wait for content to load - specifically wait for tables
    try {
      await page.waitForSelector('table.member, table', { timeout: 15000 });
      console.log('✓ Page content loaded');
    } catch (e) {
      console.log('⚠️  Timeout waiting for table, continuing anyway...');
    }
    
    // Additional wait for JavaScript rendering
    await page.waitForTimeout(2000);
    
    // Extract metadata
    const title = await page.title();
    const description = await page.getAttribute('meta[name="description"]', 'content') || '';
    const canonicalUrl = await page.getAttribute('link[rel="canonical"]', 'href') || url;
    const serviceName = parseServiceName(title);

    console.log('\n=== Service Index (Phase 1 - Playwright) ===');
    console.log('Service Name:', serviceName);
    console.log('URL:', canonicalUrl);
    
    // Extract classes table
    const classes = await page.evaluate(() => {
      const classList: { name: string; url: string; briefDescription: string }[] = [];
      const logs: string[] = [];
      
      // Strategy 1: Find table anywhere with class.member.type
      let table = document.querySelector('table.member.type');
      
      if (table) {
        logs.push('✓ Found table with class="member type"');
      } else {
        // Strategy 2: Find "Classes" heading and search nearby
        const headings = Array.from(document.querySelectorAll('h2, h3, h4'));
        const classesHeading = headings.find((heading) => {
          const text = heading.textContent?.toLowerCase() || '';
          return text.includes('classes');
        });
        
        if (!classesHeading) {
          logs.push('❌ Classes heading not found');
          return { classList, logs };
        }
        
        logs.push(`✓ Found Classes heading: ${classesHeading.textContent?.trim()}`);
        
        // Look for table in following siblings OR within following divs
        let current = classesHeading.nextElementSibling;
        let attempts = 0;
        
        while (current && attempts < 20) {
          logs.push(`  Checking: ${current.tagName}${current.className ? ' class="' + current.className + '"' : ''}`);
          
          // Check if current element is a table
          if (current.tagName === 'TABLE') {
            table = current;
            logs.push('  ✓ Found TABLE as sibling');
            break;
          }
          
          // Check if table is nested inside current element
          const nestedTable = current.querySelector('table');
          if (nestedTable) {
            table = nestedTable;
            logs.push(`  ✓ Found TABLE nested in ${current.tagName}`);
            break;
          }
          
          current = current.nextElementSibling;
          attempts++;
        }
      }
      
      if (!table) {
        logs.push('❌ No TABLE element found');
        return { classList, logs };
      }
      
      // Extract data from table
      const rows = table.querySelectorAll('tbody tr');
      logs.push(`  Found ${rows.length} rows in tbody`);
      
      rows.forEach((row: any, index: any) => {
        if (index === 0) {
          // Check if first row is header
          const ths = row.querySelectorAll('th');
          if (ths.length > 0) return; // Skip header row
        }
        
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          const link = cells[0].querySelector('a');
          if (link) {
            const name = link.textContent?.trim() || '';
            const href = link.getAttribute('href') || '';
            const url = href.startsWith('http') ? href : `https://developers.google.com${href}`;
            const briefDescription = cells[1].textContent?.trim() || '';
            
            classList.push({ name, url, briefDescription });
          }
        }
      });
      
      if (classList.length === 0) {
        logs.push('⚠️  TABLE found but extracted 0 classes');
      } else {
        logs.push(`✓ Successfully extracted ${classList.length} classes`);
      }
      
      return { classList, logs };
    });
    
    // Print logs from page evaluation
    if (classes.logs) {
      classes.logs.forEach((log: string) => console.log(log));
    }
    
    const classList = classes.classList || classes;
    
    console.log(`\nClasses found: ${classList.length}`);
    
    await browser.close();
    
    return {
      service: serviceName,
      url: canonicalUrl,
      description,
      lastScraped: new Date().toISOString(),
      classCount: classList.length,
      classes: classList,
    };
  } catch (error) {
    console.error('Error parsing service index with Playwright:', error);
    return null;
  }
}

/**
 * Phase 2: Parse individual class page to extract methods with OAuth scopes
 * URL pattern: https://developers.google.com/apps-script/reference/{service}/{class}
 */
async function parseClassPageWithPlaywright(classUrl: string): Promise<ClassDefinition | null> {
  try {
    const { chromium } = require('playwright');
    
    console.log('\n🎭 Launching Playwright browser...');
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    console.log(`📄 Loading class page: ${classUrl}`);
    await page.goto(classUrl, { waitUntil: 'networkidle' });
    
    // Wait for content to load
    try {
      await page.waitForSelector('article, .devsite-article', { timeout: 15000 });
      console.log('✓ Page content loaded');
    } catch (e) {
      console.log('⚠️  Timeout waiting for content, continuing anyway...');
    }
    
    // Additional wait for JavaScript rendering
    await page.waitForTimeout(2000);
    
    // Extract class data
    const classData = await page.evaluate(() => {
      const methods: any[] = [];
      const logs: string[] = [];
      
      // Get class name from title and clean it
      const title = document.title;
      let className = title.split('|')[0].trim();
      // Remove "Class " or "Enum " prefix using regex
      className = className.replace(/^(Class|Enum)\s+/i, '');
      logs.push(`Class name: ${className}`);
      
      // Get class description
      const descMeta = document.querySelector('meta[name="description"]');
      const description = descMeta?.getAttribute('content') || '';
      
      // Find the "Detailed documentation" section
      const detailedDocHeading = Array.from(document.querySelectorAll('h2')).find(
        h => h.textContent?.toLowerCase().includes('detailed documentation')
      );
      
      if (!detailedDocHeading) {
        logs.push('⚠️  "Detailed documentation" section not found');
        return { className, description, methods, logs };
      }
      
      logs.push('✓ Found "Detailed documentation" section');
      
      // Find all method divs with class "function doc"
      const methodDivs = document.querySelectorAll('div.function.doc');
      logs.push(`Found ${methodDivs.length} method divs (div.function.doc)`);
      
      methodDivs.forEach((methodDiv: any) => {
        // Get method signature from h3 > code
        const h3 = methodDiv.querySelector('h3');
        const codeEl = h3?.querySelector('code');
        const signature = codeEl?.textContent?.trim() || h3?.textContent?.trim() || '';
        
        // Extract method name from signature (before the parenthesis)
        const methodName = signature.split('(')[0].trim();
        
        if (!methodName) return;
        
        // Get method description (first p inside the div, after h3)
        const descP = methodDiv.querySelector('div > p');
        const methodDescription = descP?.textContent?.trim() || '';
        
        // Find Parameters table
        const parameters: { name: string; type: string; description: string }[] = [];
        const paramTable = methodDiv.querySelector('table.function.param');
        if (paramTable) {
          const rows = paramTable.querySelectorAll('tbody tr');
          rows.forEach((row: any) => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 2) {
              const paramName = cells[0]?.textContent?.trim() || '';
              const paramType = cells[1]?.textContent?.trim() || '';
              const paramDesc = cells[2]?.textContent?.trim() || '';
              if (paramName) {
                parameters.push({ name: paramName, type: paramType, description: paramDesc });
              }
            }
          });
        }
        
        // Find Return type (h4#return followed by p with code)
        let returnType = '';
        const returnH4 = Array.from(methodDiv.querySelectorAll('h4')).find(
          (h: any) => h.textContent?.toLowerCase().includes('return')
        ) as Element | undefined;
        if (returnH4) {
          const returnP = returnH4.nextElementSibling as Element | null;
          if (returnP) {
            const returnCode = returnP.querySelector('code');
            if (returnCode) {
              returnType = returnCode.textContent?.trim() || '';
            }
          }
        }
        
        // Find Authorization section and extract scopes
        const requiredScopes: string[] = [];
        const authH4 = Array.from(methodDiv.querySelectorAll('h4')).find(
          (h: any) => h.textContent?.toLowerCase().includes('authorization')
        ) as Element | undefined;
        if (authH4) {
          // Scopes are in the following ul > li elements
          let scopeElement: Element | null = authH4.nextElementSibling;
          while (scopeElement) {
            if (scopeElement.tagName === 'H4' || scopeElement.tagName === 'H3' || 
                scopeElement.tagName === 'H2') break;
            
            // Check for scope URLs in list items or code blocks
            const scopeItems = scopeElement.querySelectorAll('li, code');
            scopeItems.forEach((item: any) => {
              const text = item.textContent || '';
              // Match Google OAuth scope patterns
              const scopeMatch = text.match(/https:\/\/www\.googleapis\.com\/auth\/[\w.]+/);
              const legacyMatch = text.match(/https:\/\/www\.google\.com\/[\w]+\/feeds/);
              const mailMatch = text.match(/https:\/\/mail\.google\.com\//);
              
              [scopeMatch, legacyMatch, mailMatch].forEach(match => {
                if (match && match[0] && !requiredScopes.includes(match[0])) {
                  requiredScopes.push(match[0]);
                }
              });
            });
            
            scopeElement = scopeElement.nextElementSibling;
          }
        }
        
        // Determine scope type based on scopes found
        let scopeType: 'read' | 'write' | 'mixed' = 'read';
        const hasReadonly = requiredScopes.some(s => s.includes('readonly'));
        const hasFullAccess = requiredScopes.some(s => !s.includes('readonly'));
        if (hasReadonly && hasFullAccess) {
          scopeType = 'read'; // If both readonly and full, it's effectively a read operation
        } else if (hasFullAccess && !hasReadonly) {
          scopeType = 'write'; // Only full access = write operation
        }
        
        methods.push({
          name: methodName,
          signature,
          description: methodDescription,
          parameters,
          returnType,
          requiredScopes,
          scopeType,
        });
      });
      
      logs.push(`Extracted ${methods.length} methods`);
      
      // Count methods with scopes
      const methodsWithScopes = methods.filter(m => m.requiredScopes.length > 0).length;
      logs.push(`Methods with OAuth scopes: ${methodsWithScopes}`);
      
      return {
        className,
        description,
        methods,
        logs,
      };
    });
    
    // Print logs
    if (classData.logs) {
      classData.logs.forEach((log: string) => console.log(log));
    }
    
    await browser.close();
    
    return {
      name: classData.className,
      url: classUrl,
      description: classData.description,
      methods: classData.methods,
      properties: [], // TODO: Extract properties
    };
  } catch (error) {
    console.error('Error parsing class page with Playwright:', error);
    return null;
  }
}

/**
 * Alternative: Parse using Playwright (for JavaScript-rendered content - legacy)
 */
async function parseAppsScriptDocumentationWithPlaywright(url: string): Promise<ServiceDocumentation | null> {
  try {
    const { chromium } = require('playwright');
    
    console.log('\n🎭 Launching Playwright browser...');
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    console.log(`📄 Loading: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle' });
    
    // Wait for content to load
    await page.waitForSelector('main, article, .devsite-article', { timeout: 10000 });
    
    // Extract metadata
    const title = await page.title();
    const description = await page.getAttribute('meta[name="description"]', 'content') || '';
    const canonicalUrl = await page.getAttribute('link[rel="canonical"]', 'href') || url;
    
    // Extract breadcrumbs
    const breadcrumbs: string[] = [];
    const breadcrumbElements = await page.$$('nav[aria-label="breadcrumb"] a, .devsite-breadcrumb-link');
    for (const element of breadcrumbElements) {
      const text = await element.textContent();
      if (text) breadcrumbs.push(text.trim());
    }
    
    // Extract OAuth scopes using the same logic as local parser but in-page
    const scopes = await page.evaluate(() => {
      const foundScopes: string[] = [];
      const headings = document.querySelectorAll('h2, h3, h4');
      
      headings.forEach((heading) => {
        const text = heading.textContent?.toLowerCase() || '';
        if (text.includes('authorization')) {
          let current = heading.nextElementSibling;
          while (current && !['H1', 'H2', 'H3', 'H4'].includes(current.tagName)) {
            const content = current.textContent || '';
            const patterns = [
              /https:\/\/www\.googleapis\.com\/auth\/[\w.]+/g,
              /https:\/\/www\.google\.com\/[\w]+\/feeds/g,
              /https:\/\/mail\.google\.com\//g,
            ];
            
            patterns.forEach(pattern => {
              const matches = content.match(pattern);
              if (matches) {
                matches.forEach(m => {
                  if (!foundScopes.includes(m)) foundScopes.push(m);
                });
              }
            });
            current = current.nextElementSibling;
          }
        }
      });
      return foundScopes;
    });
    
    await browser.close();
    
    const serviceName = parseServiceName(title);
    const commonScopes = getCommonScopesForService(serviceName);
    const allScopes = [...new Set([...scopes, ...commonScopes])];
    
    console.log('\n=== Metadata (Playwright) ===');
    console.log('Title:', title);
    console.log('Description:', description);
    console.log('Service:', serviceName);
    console.log('Scopes found:', allScopes.length);
    
    return {
      service: serviceName,
      url: canonicalUrl,
      description,
      lastScraped: new Date().toISOString(),
      requiredScopes: allScopes.filter((scope) => isValidOAuthScope(scope)),
      classes: [],
      enums: [],
    };
  } catch (error) {
    console.error('Error parsing with Playwright:', error);
    return null;
  }
}

// ==================== Main Execution ====================

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  Apps Script Documentation Parser - Test Script       ║');
  console.log('╚════════════════════════════════════════════════════════╝');

  // Check command line arguments
  const args = process.argv.slice(2);
  const usePlaywright = args.includes('--playwright');
  const useUrl = args.includes('--url');
  const phaseOne = args.includes('--phase1') || args.includes('--index');
  const phaseTwo = args.includes('--phase2') || args.includes('--class') || args.includes('--class-url');
  
  if (useUrl || usePlaywright) {
    // Parse from URL using Playwright
    const targetUrl = args.find(arg => arg.startsWith('http')) || 
                      'https://developers.google.com/apps-script/reference/document';
    
    console.log('\n🌐 Mode: Playwright (JavaScript-rendered content)');
    console.log('URL:', targetUrl);
    
    if (phaseTwo) {
      // Phase 2: Parse individual class page for methods and OAuth scopes
      console.log('📋 Phase 2: Parsing class page for methods and OAuth scopes\n');
      
      const result = await parseClassPageWithPlaywright(targetUrl);
      
      if (result) {
        const outputDir = path.join(__dirname, '../../../output');
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Extract class name for filename
        const className = result.name.toLowerCase().replace(/\s+/g, '-');
        const outputPath = path.join(outputDir, `class-${className}.json`);
        saveToJson(result as any, outputPath);
        
        console.log('\n✅ Class parsing complete');
        console.log(`\nClass: ${result.name}`);
        console.log(`Methods found: ${result.methods.length}`);
        
        // Show methods with OAuth scopes
        const methodsWithScopes = result.methods.filter((m: MethodDefinition) => m.requiredScopes.length > 0);
        console.log(`Methods with OAuth scopes: ${methodsWithScopes.length}`);
        
        if (methodsWithScopes.length > 0) {
          console.log('\nMethods and their OAuth scopes:');
          methodsWithScopes.slice(0, 10).forEach((m: MethodDefinition) => {
            console.log(`  • ${m.name}() [${m.scopeType}]`);
            m.requiredScopes.forEach((scope: string) => {
              console.log(`      └─ ${scope}`);
            });
          });
          if (methodsWithScopes.length > 10) {
            console.log(`  ... and ${methodsWithScopes.length - 10} more methods`);
          }
        }
        
        // Aggregate all unique scopes
        const allScopes = new Set<string>();
        result.methods.forEach((m: MethodDefinition) => {
          m.requiredScopes.forEach((s: string) => allScopes.add(s));
        });
        
        console.log(`\nUnique OAuth scopes for this class (${allScopes.size}):`);
        Array.from(allScopes).sort().forEach((scope: string) => {
          console.log(`  • ${scope}`);
        });
      }
    } else if (phaseOne) {
      // Phase 1: Parse service index to get list of classes
      console.log('📋 Phase 1: Parsing service index for class list\n');
      
      const result = await parseServiceIndexWithPlaywright(targetUrl);
      
      if (result) {
        const outputDir = path.join(__dirname, '../../../output');
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const outputPath = path.join(outputDir, `${result.service.toLowerCase()}-index.json`);
        saveToJson(result, outputPath);
        
        console.log('\n✅ Service index parsing complete');
        console.log(`\nFound ${result.classCount} classes:`);
        result.classes.forEach((cls, i) => {
          console.log(`  ${i + 1}. ${cls.name} - ${cls.briefDescription.substring(0, 60)}...`);
        });
        console.log('\n💡 Next step: Parse each class page individually (Phase 2)');
      }
    } else {
      // Legacy: Single-page parsing
      const result = await parseAppsScriptDocumentationWithPlaywright(targetUrl);
      
      if (result) {
        const outputDir = path.join(__dirname, '../../../output');
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const outputPath = path.join(outputDir, `${result.service.toLowerCase()}-service.json`);
        saveToJson(result, outputPath);
        
        console.log('\n✅ Parsing complete with Playwright');
      }
    }
  } else {
    // Parse from local file using jsdom
    console.log('\n📁 Mode: Local file (jsdom)');
    
    const htmlPath = path.join(__dirname, '../../../Document Service  _  Apps Script  _  Google for Developers.html');
    console.log('Input file:', htmlPath);
    
    // Check if file exists
    if (!fs.existsSync(htmlPath)) {
      console.error('❌ Error: HTML file not found at:', htmlPath);
      console.log('\nOptions:');
      console.log('1. Download the HTML file to project root');
      console.log('2. Use --playwright flag to parse from URL');
      console.log('\nExample: npx ts-node src/main/test-parsing.ts --playwright');
      return;
    }

    // Parse documentation
    const result = parseAppsScriptDocumentation(htmlPath);

    if (result) {
      // Save to output directory
      const outputDir = path.join(__dirname, '../../../output');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const outputPath = path.join(outputDir, `${result.service.toLowerCase()}-service.json`);
      saveToJson(result, outputPath);

      console.log('\n✅ Parsing complete');
    }
  }

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  Usage Guide                                           ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('\n📋 Phase 1 - Get list of classes from service index:');
  console.log('  npx ts-node src/main/test-parsing.ts --playwright --phase1 https://developers.google.com/apps-script/reference/spreadsheet');
  console.log('\n📋 Phase 2 - Parse individual class page for methods & OAuth scopes:');
  console.log('  npx ts-node src/main/test-parsing.ts --playwright --class https://developers.google.com/apps-script/reference/spreadsheet/spreadsheet');
  console.log('\n📋 Workflow:');
  console.log('  1. Run Phase 1 to get list of all classes in a service');
  console.log('  2. Run Phase 2 for each class URL to get method details & OAuth scopes');
  console.log('  3. Aggregate all class data into complete service documentation');
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

// Export functions for testing
export {
  // Metadata parsing
  parseMetadata,
  parseServiceName,
  
  // Phase 1: Service Index
  parseServiceIndex,
  parseServiceIndexWithPlaywright,
  extractClassesTable,
  
  // Phase 2: Class parsing (methods & OAuth scopes)
  parseClassPageWithPlaywright,
  
  // Legacy parsing
  parseAppsScriptDocumentation,
  parseAppsScriptDocumentationWithPlaywright,
  
  // OAuth scopes
  parseAuthorizationScopes,
  getCommonScopesForService,
  isValidOAuthScope,
};

