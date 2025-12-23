/**
 * Apps Script Documentation Tool
 * Retrieves Google Apps Script class documentation for accurate code generation.
 * Returns method signatures, parameters, return types, and OAuth scopes.
 */

import type { ToolExecutor } from '../../types/ai-types';
import * as fs from 'fs';
import * as path from 'path';

// Documentation cache directory (relative to project root)
const DOCS_CACHE_DIR = path.join(__dirname, '../../../../../output');

// Available services and their URL patterns
const SERVICES: Record<string, string> = {
  spreadsheet: 'spreadsheet',
  sheets: 'spreadsheet',  // alias
  document: 'document',
  docs: 'document',  // alias
  drive: 'drive',
  gmail: 'gmail',
  calendar: 'calendar',
  forms: 'forms',
  slides: 'slides',
  contacts: 'contacts',
  groups: 'groups',
  maps: 'maps',
  mail: 'mail',
  utilities: 'utilities',
  urlfetch: 'url-fetch',
  properties: 'properties',
  cache: 'cache',
  lock: 'lock',
  script: 'script',
  html: 'html',
  content: 'content',
  charts: 'charts',
  jdbc: 'jdbc',
  xml: 'xml',
  optimization: 'optimization',
  base: 'base',
  card: 'card-service',
};

interface MethodDoc {
  name: string;
  signature: string;
  description: string;
  parameters: { name: string; type: string; description: string }[];
  returnType: string;
  requiredScopes: string[];
  scopeType: 'read' | 'write' | 'mixed';
}

interface ClassDoc {
  name: string;
  url: string;
  description: string;
  methods: MethodDoc[];
}

/**
 * Normalize service name to standard format
 */
function normalizeServiceName(service: string): string {
  const normalized = service.toLowerCase().replace(/[^a-z]/g, '');
  return SERVICES[normalized] || normalized;
}

/**
 * Normalize class name to expected format
 */
function normalizeClassName(className: string): string {
  // Remove common prefixes/suffixes
  return className
    .replace(/^Class\s+/i, '')
    .replace(/^Enum\s+/i, '')
    .trim();
}

/**
 * Get documentation file path
 */
function getDocFilePath(service: string, className: string): string {
  const normalizedService = normalizeServiceName(service);
  const normalizedClass = normalizeClassName(className).toLowerCase().replace(/\s+/g, '-');
  return path.join(DOCS_CACHE_DIR, `class-${normalizedClass}.json`);
}

/**
 * Get service index file path
 */
function getServiceIndexPath(service: string): string {
  const normalizedService = normalizeServiceName(service);
  return path.join(DOCS_CACHE_DIR, `${normalizedService}-index.json`);
}

/**
 * List available cached documentation
 */
function listCachedDocs(): { classes: string[]; services: string[] } {
  const classes: string[] = [];
  const services: string[] = [];
  
  if (!fs.existsSync(DOCS_CACHE_DIR)) {
    return { classes, services };
  }
  
  const files = fs.readdirSync(DOCS_CACHE_DIR);
  
  for (const file of files) {
    if (file.startsWith('class-') && file.endsWith('.json')) {
      const className = file.replace('class-', '').replace('.json', '');
      classes.push(className);
    } else if (file.endsWith('-index.json')) {
      const serviceName = file.replace('-index.json', '');
      services.push(serviceName);
    }
  }
  
  return { classes, services };
}

/**
 * Format method documentation for AI consumption
 */
function formatMethodForAI(method: MethodDoc): string {
  let output = `### ${method.signature}\n`;
  output += `${method.description}\n\n`;
  
  if (method.parameters.length > 0) {
    output += '**Parameters:**\n';
    for (const param of method.parameters) {
      output += `- \`${param.name}\` (${param.type}): ${param.description}\n`;
    }
    output += '\n';
  }
  
  if (method.returnType) {
    output += `**Returns:** \`${method.returnType}\`\n\n`;
  }
  
  if (method.requiredScopes.length > 0) {
    output += `**OAuth Scopes (${method.scopeType}):**\n`;
    for (const scope of method.requiredScopes) {
      output += `- ${scope}\n`;
    }
  }
  
  return output;
}

/**
 * Apps Script Documentation Lookup Tool
 */
export class AppsScriptDocsTool implements ToolExecutor {
  name = 'apps_script_docs';
  description = `Look up Google Apps Script class documentation for accurate code generation. 
Returns method signatures, parameters, return types, and OAuth scopes for a specific class.

Available services: spreadsheet, document, drive, gmail, calendar, forms, slides, etc.

Example usage:
- service: "spreadsheet", className: "Spreadsheet" - Get Spreadsheet class methods
- service: "spreadsheet", className: "Sheet" - Get Sheet class methods  
- service: "spreadsheet", className: "Range" - Get Range class methods

Use methodFilter to get specific methods only (e.g., "getValues" or "set*" for all set methods).`;
  
  dangerous = false;
  requiresConfirmation = false;

  async execute(
    params: { 
      service: string; 
      className: string;
      methodFilter?: string;  // Optional: filter methods by name pattern
    },
    signal?: AbortSignal,
    conversationId?: string
  ): Promise<string> {
    if (!params.service) {
      throw new Error('service parameter is required (e.g., "spreadsheet", "document", "drive")');
    }
    
    if (!params.className) {
      throw new Error('className parameter is required (e.g., "Spreadsheet", "Sheet", "Range")');
    }

    try {
      const docPath = getDocFilePath(params.service, params.className);
      
      // Check if documentation exists
      if (!fs.existsSync(docPath)) {
        const cached = listCachedDocs();
        const normalizedService = normalizeServiceName(params.service);
        
        let errorMsg = `Documentation for '${params.className}' in service '${params.service}' not found.\n\n`;
        
        if (cached.classes.length > 0) {
          errorMsg += `Available cached classes: ${cached.classes.join(', ')}\n\n`;
        }
        
        errorMsg += `To generate documentation, run the parser:\n`;
        errorMsg += `npx ts-node src/main/test-parsing.ts --playwright --class "https://developers.google.com/apps-script/reference/${normalizedService}/${params.className.toLowerCase()}"`;
        
        throw new Error(errorMsg);
      }
      
      // Read and parse documentation
      const docContent = fs.readFileSync(docPath, 'utf-8');
      const classDoc: ClassDoc = JSON.parse(docContent);
      
      // Filter methods if pattern provided
      let methods = classDoc.methods;
      if (params.methodFilter) {
        const pattern = params.methodFilter.replace(/\*/g, '.*');
        const regex = new RegExp(pattern, 'i');
        methods = methods.filter(m => regex.test(m.name) || regex.test(m.signature));
      }
      
      // Format output for AI
      let output = `# ${classDoc.name} Class Documentation\n\n`;
      output += `**URL:** ${classDoc.url}\n`;
      output += `**Description:** ${classDoc.description}\n\n`;
      output += `**Total Methods:** ${classDoc.methods.length}`;
      
      if (params.methodFilter) {
        output += ` (showing ${methods.length} matching "${params.methodFilter}")`;
      }
      output += '\n\n---\n\n';
      
      // Group methods by name (overloads)
      const methodGroups = new Map<string, MethodDoc[]>();
      for (const method of methods) {
        const existing = methodGroups.get(method.name) || [];
        existing.push(method);
        methodGroups.set(method.name, existing);
      }
      
      // Output methods
      for (const [name, overloads] of methodGroups) {
        if (overloads.length === 1) {
          output += formatMethodForAI(overloads[0]);
          output += '\n---\n\n';
        } else {
          output += `## ${name} (${overloads.length} overloads)\n\n`;
          for (const method of overloads) {
            output += formatMethodForAI(method);
            output += '\n';
          }
          output += '---\n\n';
        }
      }
      
      // Add summary of unique scopes
      const allScopes = new Set<string>();
      methods.forEach(m => m.requiredScopes.forEach(s => allScopes.add(s)));
      
      if (allScopes.size > 0) {
        output += `\n## Required OAuth Scopes Summary\n\n`;
        output += `The methods above require these scopes:\n`;
        Array.from(allScopes).sort().forEach(scope => {
          output += `- ${scope}\n`;
        });
      }
      
      console.log(`📚 Retrieved documentation for ${classDoc.name} (${methods.length} methods)`);
      return output;
      
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to retrieve documentation: ${String(error)}`);
    }
  }
}

/**
 * Apps Script Documentation List Tool
 * Lists available classes for a service
 */
export class AppsScriptDocsListTool implements ToolExecutor {
  name = 'apps_script_docs_list';
  description = `List available Google Apps Script classes for a service.
Returns the list of classes with brief descriptions that can be looked up with apps_script_docs.

Example: service: "spreadsheet" returns classes like Spreadsheet, Sheet, Range, etc.`;
  
  dangerous = false;
  requiresConfirmation = false;

  async execute(
    params: { service?: string },
    signal?: AbortSignal,
    conversationId?: string
  ): Promise<string> {
    try {
      const cached = listCachedDocs();
      
      if (params.service) {
        // Check for service index
        const indexPath = getServiceIndexPath(params.service);
        
        if (fs.existsSync(indexPath)) {
          const indexContent = fs.readFileSync(indexPath, 'utf-8');
          const serviceIndex = JSON.parse(indexContent);
          
          let output = `# ${serviceIndex.service} Service\n\n`;
          output += `**Description:** ${serviceIndex.description}\n\n`;
          output += `## Available Classes (${serviceIndex.classes?.length || 0})\n\n`;
          
          if (serviceIndex.classes) {
            for (const cls of serviceIndex.classes) {
              output += `- **${cls.name}**: ${cls.briefDescription}\n`;
            }
          }
          
          output += `\n## Usage\n\n`;
          output += `To get detailed documentation for a class, use:\n`;
          output += `\`apps_script_docs(service: "${params.service}", className: "ClassName")\``;
          
          return output;
        }
        
        // No index, check cached classes
        const normalizedService = normalizeServiceName(params.service);
        const serviceClasses = cached.classes.filter(c => 
          c.toLowerCase().includes(normalizedService.toLowerCase())
        );
        
        if (serviceClasses.length > 0) {
          let output = `# Cached Classes for ${params.service}\n\n`;
          output += serviceClasses.map(c => `- ${c}`).join('\n');
          return output;
        }
        
        return `No documentation found for service '${params.service}'. Run the parser to generate it.`;
      }
      
      // List all cached documentation
      let output = `# Available Apps Script Documentation\n\n`;
      
      output += `## Cached Service Indexes\n`;
      if (cached.services.length > 0) {
        output += cached.services.map(s => `- ${s}`).join('\n');
      } else {
        output += `None cached yet.\n`;
      }
      
      output += `\n\n## Cached Class Documentation\n`;
      if (cached.classes.length > 0) {
        output += cached.classes.map(c => `- ${c}`).join('\n');
      } else {
        output += `None cached yet.\n`;
      }
      
      output += `\n\n## Supported Services\n`;
      output += Object.keys(SERVICES).filter((k, i, arr) => 
        arr.indexOf(k) === i // Remove duplicates
      ).map(s => `- ${s}`).join('\n');
      
      return output;
      
    } catch (error) {
      throw new Error(`Failed to list documentation: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

