import { URL } from 'url';

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

    let response: Response;
    try {
      response = await fetch(parsedUrl.toString(), {
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': options.userAgent ?? DEFAULT_USER_AGENT,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        },
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timed out while fetching website.',
        };
      }
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unexpected network error while fetching website.',
      };
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
    const language = extractLanguage(cleanedHtml);
    const text = htmlToPlainText(cleanedHtml);
    const textPreview = text.slice(0, 800).trim();
    const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;

    return {
      success: true,
      content: {
        url: parsedUrl.toString(),
        finalUrl: response.url ?? parsedUrl.toString(),
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
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message || 'Failed to fetch website content.'
          : 'Failed to fetch website content.',
    };
  }
}

function stripUnwantedTags(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');
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

function extractLanguage(html: string): string | null {
  const match = html.match(META_LANG_REGEX);
  if (!match) return null;
  return match[1]?.trim() ?? null;
}

function htmlToPlainText(html: string): string {
  if (!html) return '';

  const withLineBreaks = html
    .replace(/<(?:br|hr)\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|header|footer|li|h[1-6])>/gi, '\n');

  const withoutTags = withLineBreaks.replace(/<[^>]+>/g, ' ');
  const decoded = decodeEntities(withoutTags);
  const normalized = normalizeWhitespace(decoded);

  return normalized;
}

function normalizeWhitespace(input: string): string {
  return input.replace(/\r?\n+/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&hellip;/gi, '…');
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

