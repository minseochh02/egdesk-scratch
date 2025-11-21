import { URL } from 'url';

export interface FormField {
  name?: string;
  type?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
}

export interface WebsiteContent {
  url: string;
  finalUrl: string;
  status: number;
  contentType?: string | null;
  language?: string | null;
  title?: string | null;
  description?: string | null;
  html: string;
  text: string;
  textPreview: string;
  wordCount: number;
  fetchedAt: string;
  isFormPage?: boolean;
  formFields?: FormField[];
  formCount?: number;
}

export interface FetchWebsiteContentOptions {
  maxBytes?: number;
  timeoutMs?: number;
  userAgent?: string;
}

export interface FetchWebsiteContentResult {
  success: boolean;
  content?: WebsiteContent;
  error?: string;
}

const DEFAULT_MAX_BYTES = 750_000; // ~750 KB
const DEFAULT_TIMEOUT = 15_000;
const DEFAULT_USER_AGENT =
  'EGDeskContentFetcher/1.0 (+https://github.com/taesung/egdesk)';

const META_DESCRIPTION_REGEX =
  /<meta\s+(?:name|property)=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i;
const META_OG_DESCRIPTION_REGEX =
  /<meta\s+(?:name|property)=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i;
const META_LANG_REGEX = /<html[^>]*lang=["']([^"']+)["']/i;

const STOP_WORDS = new Set(
  [
    'the',
    'and',
    'that',
    'with',
    'from',
    'into',
    'your',
    'about',
    'this',
    'have',
    'will',
    'what',
    'when',
    'were',
    'there',
    'their',
    'which',
    'while',
    'where',
    'those',
    'these',
    'each',
    'also',
    'through',
    'over',
    'under',
    'just',
    'more',
    'than',
    'some',
    'only',
    'being',
    'such',
    'make',
    'made',
    'most',
    'very',
    'much',
    'like',
    'them',
    'they',
    'been',
    'case',
    'into',
    'upon',
    'because',
    'could',
    'should',
    'would',
    'might',
    'many',
  ].map((word) => word.toLowerCase()),
);

export async function fetchWebsiteContent(
  rawUrl: string,
  options: FetchWebsiteContentOptions = {},
): Promise<FetchWebsiteContentResult> {
  try {
    if (!rawUrl || typeof rawUrl !== 'string') {
      return {
        success: false,
        error: 'URL is required.',
      };
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl.trim());
    } catch {
      return {
        success: false,
        error: 'Invalid URL format.',
      };
    }

    if (!/^https?:$/.test(parsedUrl.protocol)) {
      return {
        success: false,
        error: 'Only HTTP(S) URLs are supported.',
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT);

    let response: Response | undefined;
    let lastError: unknown;
    const originalUrl = parsedUrl.toString();
    
    try {
      response = await fetch(originalUrl, {
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': options.userAgent ?? DEFAULT_USER_AGENT,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        },
      });
    } catch (error) {
      lastError = error;
      
      // If it's a connection timeout on HTTPS and the domain doesn't have www,
      // try with www subdomain as a fallback (some domains like quus.cloud have
      // HTTPS issues on non-www but work fine with www)
      if (
        parsedUrl.protocol === 'https:' &&
        !parsedUrl.hostname.startsWith('www.') &&
        error instanceof Error
      ) {
        const cause = (error as { cause?: unknown })?.cause;
        const causeError = cause as NodeJS.ErrnoException | undefined;
        const isConnectionTimeout = 
          causeError?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
          (error.message && error.message.includes('Connect Timeout'));
        
        if (isConnectionTimeout) {
          // Try with www subdomain
          const wwwUrl = new URL(originalUrl);
          wwwUrl.hostname = 'www.' + wwwUrl.hostname;
          
          try {
            console.log(`[content-fetcher] Retrying ${originalUrl} with www subdomain: ${wwwUrl.toString()}`);
            response = await fetch(wwwUrl.toString(), {
              redirect: 'follow',
              signal: controller.signal,
              headers: {
                'User-Agent': options.userAgent ?? DEFAULT_USER_AGENT,
                Accept:
                  'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
              },
            });
            // Success with www, continue with response
          } catch (wwwError) {
            // www also failed, fall through to return original error
            lastError = wwwError;
          }
        }
      }
      
      // If we still don't have a response, return the error
      if (!response) {
        clearTimeout(timeout);
        if (lastError instanceof Error && lastError.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timed out while fetching website.',
        };
      }
      return {
        success: false,
          error: formatNetworkError(lastError),
      };
      }
    } finally {
      clearTimeout(timeout);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && !contentType.toLowerCase().startsWith('text/html')) {
      return {
        success: false,
        error: `Unsupported content type: ${contentType}`,
      };
    }

    const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    const contentLength = response.headers.get('content-length');
    if (contentLength && Number.parseInt(contentLength, 10) > maxBytes) {
      return {
        success: false,
        error: 'Website content is larger than the allowed limit.',
      };
    }

    const html = await readResponseBody(response, maxBytes);

    const cleanedHtml = stripUnwantedTags(html);
    const title = extractTitle(cleanedHtml);
    const description = extractDescription(cleanedHtml);
    
    // Detect and extract form information
    const formInfo = extractFormInfo(cleanedHtml);
    const isFormPage = formInfo.isFormPage;
    const formFields = formInfo.fields;
    const formCount = formInfo.formCount;
    
    // For form pages, extract form field information as text
    let text = htmlToPlainText(cleanedHtml);
    
    // Extract language after we have the text content for better detection
    const language = extractLanguage(cleanedHtml, response.headers, text);
    
    // If it's primarily a form page, enhance text with form field info
    if (isFormPage && formFields.length > 0) {
      const formFieldsText = formFields
        .map((field) => {
          const parts: string[] = [];
          if (field.label) parts.push(`Label: ${field.label}`);
          if (field.placeholder) parts.push(`Placeholder: ${field.placeholder}`);
          if (field.name) parts.push(`Field: ${field.name} (${field.type || 'text'})`);
          if (field.required) parts.push('Required');
          return parts.join(' | ');
        })
        .join('\n');
      
      // Prepend form field information to the text
      text = `Contact Form Fields:\n${formFieldsText}\n\n---\n\n${text}`;
    }
    
    const textPreview = text.slice(0, 800).trim();
    const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;

    return {
      success: true,
      content: {
        url: originalUrl, // Preserve the original URL the user requested
        finalUrl: response.url ?? originalUrl,
        status: response.status,
        contentType,
        language,
        title,
        description,
        html: cleanedHtml,
        text,
        textPreview,
        wordCount,
        fetchedAt: new Date().toISOString(),
        isFormPage,
        formFields,
        formCount,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: formatNetworkError(error, 'Failed to fetch website content.'),
    };
  }
}

function formatNetworkError(error: unknown, fallback = 'Unexpected network error while fetching website.'): string {
  if (error instanceof Error) {
    const details: string[] = [];
    if (error.message) {
      details.push(error.message);
    }
    // Capture common Node.js network error codes (e.g., ENOTFOUND, ECONNRESET)
    const code = (error as NodeJS.ErrnoException).code;
    if (code) {
      details.push(`code=${code}`);
    }
    const cause = (error as { cause?: unknown })?.cause;
    if (cause && typeof cause === 'object' && cause !== null) {
      const causeCode = (cause as NodeJS.ErrnoException).code;
      if (causeCode) {
        details.push(`cause=${causeCode}`);
      }
      const causeMessage = (cause as { message?: string }).message;
      if (causeMessage && causeMessage !== error.message) {
        details.push(`causeMessage=${causeMessage}`);
      }
    }
    return details.length ? details.join(' | ') : fallback;
  }
  return fallback;
}

function stripUnwantedTags(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
    // Remove navigation elements (but keep their text content)
    .replace(/<nav\b[^>]*>/gi, '<div>')
    .replace(/<\/nav>/gi, '</div>')
    // Remove header/footer but keep content
    .replace(/<header\b[^>]*>/gi, '<div>')
    .replace(/<\/header>/gi, '</div>')
    .replace(/<footer\b[^>]*>/gi, '<div>')
    .replace(/<\/footer>/gi, '</div>');
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;
  return normalizeWhitespace(decodeEntities(match[1]));
}

function extractDescription(html: string): string | null {
  const descriptionMatch = html.match(META_DESCRIPTION_REGEX);
  if (descriptionMatch) {
    return normalizeWhitespace(decodeEntities(descriptionMatch[1]));
  }
  const ogMatch = html.match(META_OG_DESCRIPTION_REGEX);
  if (ogMatch) {
    return normalizeWhitespace(decodeEntities(ogMatch[1]));
  }
  return null;
}

/**
 * Extract language from multiple sources with fallback to content-based detection
 * Priority:
 * 1. HTML lang attribute
 * 2. HTTP Content-Language header
 * 3. Content-based detection (Korean character patterns)
 */
function extractLanguage(
  html: string,
  headers?: Headers,
  textContent?: string
): string | null {
  // 1. Check HTML lang attribute
  const htmlMatch = html.match(META_LANG_REGEX);
  if (htmlMatch && htmlMatch[1]) {
    const lang = htmlMatch[1].trim().toLowerCase();
    if (lang) {
      return normalizeLanguageCode(lang);
    }
  }

  // 2. Check HTTP Content-Language header
  if (headers) {
    const contentLanguage = headers.get('content-language');
    if (contentLanguage) {
      // Content-Language can be like "ko-KR" or "ko, en;q=0.9"
      const lang = contentLanguage.split(',')[0].trim().split('-')[0].toLowerCase();
      if (lang) {
        return normalizeLanguageCode(lang);
      }
    }
  }

  // 3. Content-based detection (fallback)
  if (textContent) {
    const detectedLang = detectLanguageFromContent(textContent);
    if (detectedLang) {
      return detectedLang;
    }
  }

  return null;
}

/**
 * Normalize language codes to standard format (e.g., "ko-KR" -> "ko", "en-US" -> "en")
 */
function normalizeLanguageCode(lang: string): string {
  // Extract primary language code (before hyphen)
  const primary = lang.split('-')[0].toLowerCase();
  
  // Map common variations
  const langMap: Record<string, string> = {
    'kr': 'ko', // Korean
    'jp': 'ja', // Japanese
    'cn': 'zh', // Chinese
  };

  return langMap[primary] || primary;
}

/**
 * Detect language from content using character patterns
 * Specifically optimized for Korean (Hangul) detection
 */
function detectLanguageFromContent(text: string): string | null {
  if (!text || text.length === 0) {
    return null;
  }

  // Sample a reasonable chunk of text for analysis (first 5000 chars)
  const sample = text.slice(0, 5000);
  
  // Count Korean (Hangul) characters
  // Hangul syllables: AC00-D7AF (가-힣)
  // Hangul Jamo: 1100-11FF (initial consonants), 3130-318F (compatibility)
  const hangulRegex = /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/g;
  const hangulMatches = sample.match(hangulRegex);
  const hangulCount = hangulMatches ? hangulMatches.length : 0;
  
  // Count total characters (excluding whitespace and punctuation)
  const totalChars = sample.replace(/[\s\p{P}]/gu, '').length;
  
  if (totalChars === 0) {
    return null;
  }

  // If more than 30% of characters are Hangul, likely Korean
  const hangulRatio = hangulCount / totalChars;
  if (hangulRatio > 0.3) {
    return 'ko';
  }

  // Check for common Korean words/patterns
  const koreanPatterns = [
    /[가-힣]{2,}/g, // Korean words (2+ characters)
    /입니다|입니다\.|입니다!/g, // Common Korean sentence endings
    /합니다|합니다\.|합니다!/g,
    /있습니다|있습니다\.|있습니다!/g,
  ];

  let koreanPatternMatches = 0;
  for (const pattern of koreanPatterns) {
    const matches = sample.match(pattern);
    if (matches) {
      koreanPatternMatches += matches.length;
    }
  }

  // If we find multiple Korean sentence patterns, likely Korean
  if (koreanPatternMatches >= 3) {
    return 'ko';
  }

  // Default to null if we can't confidently detect
  return null;
}

function htmlToPlainText(html: string): string {
  if (!html) return '';

  // Try to extract main content first (prioritize semantic HTML5 elements)
  let contentHtml = html;
  
  // Look for main content areas (main, article, or content containers)
  // Use a more robust approach that handles nested tags
  let mainContentMatch: RegExpMatchArray | null = null;
  
  // Try <main> tag first (most semantic)
  mainContentMatch = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  
  // Try <article> tag
  if (!mainContentMatch) {
    mainContentMatch = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  }
  
  // Try content containers by class or id
  if (!mainContentMatch) {
    const contentDivRegex = /<div[^>]*(?:class|id)=["'][^"']*(?:content|main|post|entry|body)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i;
    mainContentMatch = html.match(contentDivRegex);
  }
  
  if (mainContentMatch && mainContentMatch[1] && mainContentMatch[1].trim().length > 100) {
    // Use main content area if found and has substantial content
    contentHtml = mainContentMatch[1];
  } else {
    // Remove common non-content areas before processing
    contentHtml = html
      .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<aside\b[^>]*>[\s\S]*?<\/aside>/gi, '')
      // Remove common navigation/header patterns
      .replace(/<div[^>]*(?:class|id)=["'][^"']*(?:nav|menu|header|footer|sidebar)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '');
  }

  // First, handle block-level elements that should create line breaks
  let processed = contentHtml
    // Replace block-level closing tags with newlines
    .replace(/<\/(p|div|section|article|main|aside|li|h[1-6]|tr|td|th|blockquote|pre|address|dl|dt|dd|ul|ol)>/gi, '\n')
    // Replace self-closing block elements
    .replace(/<(?:br|hr)\s*\/?>/gi, '\n')
    // Replace opening block elements that might have content before them
    .replace(/<(p|div|section|article|main|aside|li|h[1-6]|blockquote|pre|address)[^>]*>/gi, '\n')
    // Remove list markers and navigation links (common patterns)
    .replace(/<a\b[^>]*class=["'][^"']*nav[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, '')
    .replace(/<a\b[^>]*class=["'][^"']*menu[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, '');

  // Remove all remaining HTML tags (including self-closing, comments, etc.)
  processed = processed
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags (should already be removed, but just in case)
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Remove style tags (should already be removed, but just in case)
    .replace(/<!--[\s\S]*?-->/g, '') // Remove HTML comments
    .replace(/<[^>]+>/g, ' '); // Remove all remaining tags

  // Decode HTML entities
  const decoded = decodeEntities(processed);
  
  // Normalize whitespace more aggressively
  const normalized = normalizeWhitespace(decoded);

  return normalized;
}

function normalizeWhitespace(input: string): string {
  return input
    .replace(/\r?\n+/g, '\n') // Normalize line breaks
    .replace(/[ \t]+/g, ' ') // Normalize spaces and tabs
    .replace(/\n[ \t]+/g, '\n') // Remove leading whitespace on lines
    .replace(/[ \t]+\n/g, '\n') // Remove trailing whitespace on lines
    .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines
    .replace(/^\s+|\s+$/gm, '') // Trim each line
    .trim(); // Trim the whole string
}

function decodeEntities(text: string): string {
  // First decode numeric entities (decimal and hex)
  let decoded = text
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  // Then decode named entities (order matters - &amp; must be last)
  decoded = decoded
    .replace(/&nbsp;/gi, ' ')
    .replace(/&ensp;/gi, ' ')
    .replace(/&emsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&hellip;/gi, '…')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&copy;/gi, '©')
    .replace(/&reg;/gi, '®')
    .replace(/&trade;/gi, '™')
    .replace(/&amp;/gi, '&'); // Must be last to avoid double-decoding

  return decoded;
}

async function readResponseBody(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) {
    return await response.text();
  }

  const reader = response.body.getReader();
  let receivedBytes = 0;
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    if (!value) continue;

    receivedBytes += value.length;
    if (receivedBytes > maxBytes) {
      reader.cancel();
      throw new Error('Website content exceeded the allowed size limit.');
    }
    chunks.push(value);
  }

  const decoder = new TextDecoder('utf-8');
  return decoder.decode(concatenateChunks(chunks));
}

function concatenateChunks(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

/**
 * Extract form information from HTML
 */
function extractFormInfo(html: string): {
  isFormPage: boolean;
  formCount: number;
  fields: FormField[];
} {
  // Count forms
  const formMatches = html.match(/<form\b[^>]*>/gi);
  const formCount = formMatches ? formMatches.length : 0;
  
  const fields: FormField[] = [];
  
  if (formCount === 0) {
    return { isFormPage: false, formCount: 0, fields: [] };
  }
  
  // Extract all input, textarea, and select elements
  const inputRegex = /<(input|textarea|select)\b([^>]*)>/gi;
  let match;
  
  while ((match = inputRegex.exec(html)) !== null) {
    const tagName = match[1].toLowerCase();
    const attributes = match[2];
    
    const field: FormField = {
      type: tagName === 'input' ? extractAttribute(attributes, 'type') || 'text' : tagName,
      name: extractAttribute(attributes, 'name') || undefined,
      label: undefined,
      placeholder: extractAttribute(attributes, 'placeholder') || undefined,
      required: /required/i.test(attributes),
    };
    
    // Try to find associated label
    if (field.name) {
      // Look for <label for="fieldName"> or <label><input name="fieldName">
      const labelRegex = new RegExp(
        `<label[^>]*(?:for=["']${field.name}["']|>[^<]*<[^>]*name=["']${field.name}["'])[^>]*>([\\s\\S]*?)<\\/label>`,
        'i'
      );
      const labelMatch = html.match(labelRegex);
      if (labelMatch && labelMatch[1]) {
        const labelText = htmlToPlainText(labelMatch[1]).trim();
        if (labelText) {
          field.label = labelText;
        }
      }
    }
    
    // Only add fields that have some identifying information
    if (field.name || field.label || field.placeholder) {
      fields.push(field);
    }
  }
  
  // Determine if this is primarily a form page
  // A page is considered a form page if:
  // 1. It has at least one form AND
  // 2. It has at least 3 form fields AND
  // 3. The text content (excluding form fields) is relatively small
  const textContent = htmlToPlainText(html.replace(/<form\b[^>]*>[\s\S]*?<\/form>/gi, ''));
  const textWordCount = textContent.split(/\s+/).filter(Boolean).length;
  const isFormPage = formCount > 0 && fields.length >= 3 && textWordCount < 200;
  
  return { isFormPage, formCount, fields };
}

/**
 * Extract attribute value from HTML attributes string
 */
function extractAttribute(attributes: string, attrName: string): string | null {
  const regex = new RegExp(`${attrName}=["']([^"']+)["']`, 'i');
  const match = attributes.match(regex);
  return match ? match[1] : null;
}

export function extractTopKeywords(text: string, max = 5): string[] {
  if (!text) return [];
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/gi, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !STOP_WORDS.has(token));

  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([word]) => word);
}

export type { WebsiteContent as WebsiteContentSummary };

