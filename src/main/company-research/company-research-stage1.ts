import * as cheerio from 'cheerio';
import { fetch } from 'undici';
import { generateTextWithAI, getGoogleApiKey } from '../gemini';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

/**
 * Stage 1: AI-Guided Intelligent Web Crawling
 * Translated from companyreport/Code.js
 */

export interface LinkWithContext {
  url: string;
  text: string;
  section: 'nav' | 'main' | 'header' | 'footer' | 'other';
}

export interface ScrapedPage {
  url: string;
  title: string;
  content: string;
  html?: string;
  depth: number;
}

export interface CrawlResult {
  domain: string;
  pageCount: number;
  pages: ScrapedPage[];
  error?: string;
  cached?: boolean;
}

const MAX_DEPTH = 4;
const CRAWL_TIMEOUT = 4 * 60 * 1000; // 4 minutes
const BATCH_SIZE = 10;

/**
 * Get the cache directory for company research results
 */
function getCacheDir(): string {
  const baseDir = app.getPath('userData');
  const cacheDir = path.join(baseDir, 'company-research-cache');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  return cacheDir;
}

/**
 * Save crawl result to disk
 */
function saveCrawlResult(domain: string, result: CrawlResult) {
  try {
    const fileName = `${domain.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    const filePath = path.join(getCacheDir(), fileName);
    fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
    console.log(`[Crawl] Result saved to: ${filePath}`);
  } catch (error) {
    console.error(`[Crawl] Failed to save result:`, error);
  }
}

/**
 * Load crawl result from disk if it exists and is not too old (e.g., 1 day)
 */
function loadCrawlResult(domain: string): CrawlResult | null {
  try {
    const fileName = `${domain.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    const filePath = path.join(getCacheDir(), fileName);
    
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      
      if (stats.mtimeMs > oneDayAgo) {
        const data = fs.readFileSync(filePath, 'utf8');
        const result = JSON.parse(data) as CrawlResult;
        
        // Sanitize: ensure no 'html' field exists in cached pages (prevent cloning errors)
        if (result.pages) {
          result.pages = result.pages.map(page => {
            if (page.html) {
              const { html, ...rest } = page;
              return rest;
            }
            return page;
          });
        }
        
        result.cached = true;
        console.log(`[Crawl] Loaded cached result from: ${filePath}`);
        return result;
      }
    }
  } catch (error) {
    console.warn(`[Crawl] Failed to load cached result:`, error);
  }
  return null;
}

/**
 * Main Stage 1 Function: Intelligent Crawler
 */
export async function crawlWebsiteIntelligent(domain: string, bypassCache: boolean = false): Promise<CrawlResult> {
  const startTime = Date.now();
  const visited = new Set<string>();
  const allPages: ScrapedPage[] = [];

  // Try to load from cache first unless bypassed
  if (!bypassCache) {
  const cachedResult = loadCrawlResult(domain);
  if (cachedResult) {
    return cachedResult;
    }
  }

  try {
    const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`;
    const domainForExtraction = baseUrl.replace(/^https?:\/\//, '').split('/')[0];
    
    console.log(`[Crawl] Depth 0: Fetching homepage ${baseUrl}...`);
    
    const response = await fetch(baseUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch homepage: ${baseUrl} (Status: ${response.status})`);
    }

    const homepageHtml = await response.text();
    const homepage = parseHTMLWithCheerio(homepageHtml, baseUrl, 0);
    if (!homepage) {
      throw new Error(`Failed to parse homepage: ${baseUrl}`);
    }
    visited.add(homepage.url);

    // Extract links WITH CONTEXT for Depth 0→1
    const depth0LinksWithContext = extractLinksWithContext(homepageHtml, domainForExtraction);

    // Store homepage without html
    const homepageToStore = { ...homepage };
    allPages.push(homepageToStore);

    if (Date.now() - startTime > CRAWL_TIMEOUT) {
      const result = { domain, pageCount: allPages.length, pages: allPages };
      saveCrawlResult(domain, result);
      return result;
    }

    const DEPTH_PURPOSES: Record<number, string> = {
      1: "회사 정보, 제품/서비스, 회사 소개, 기술 역량",
      2: "추가 상세 정보 (케이스 스터디, 프로젝트, 기술 스펙, 고객사례)",
      3: "심화 정보 (기술 문서, 제품 상세, 사례 연구 세부사항)",
      4: "최심화 정보 (세부 기술 스펙, 특수 프로젝트, 상세 고객 사례)"
    };

    let currentLinks: any[] = depth0LinksWithContext;

    for (let depth = 1; depth <= MAX_DEPTH; depth++) {
      if (Date.now() - startTime > CRAWL_TIMEOUT) {
        console.log(`[Crawl] Timeout reached before Depth ${depth}`);
        break;
      }

      let uniqueLinks: any[];
      let hasContext = false;

      if (depth === 1 && Array.isArray(currentLinks) && currentLinks[0]?.section) {
        hasContext = true;
        const uniqueUrls = new Set<string>();
        uniqueLinks = currentLinks.filter(linkObj => {
          const normalizedUrl = normalizeUrl(linkObj.url);
          if (visited.has(normalizedUrl)) return false;
          if (uniqueUrls.has(normalizedUrl)) return false;
          uniqueUrls.add(normalizedUrl);
          return true;
        });
      } else {
        uniqueLinks = [...new Set(currentLinks)].filter(l => !visited.has(normalizeUrl(l)));
      }

      if (uniqueLinks.length === 0) {
        console.log(`[Crawl] No new links available for Depth ${depth}`);
        break;
      }

      // AI Selection
      console.log(`[Crawl] Asking AI to select links for Depth ${depth} (out of ${uniqueLinks.length})...`);
      const selectedLinks = await askAIToSelectLinks(uniqueLinks, {
        purpose: DEPTH_PURPOSES[depth],
        hasContext
      });

      console.log(`[Crawl] AI selected ${selectedLinks.length} links for Depth ${depth}`);

      if (selectedLinks.length === 0) break;

      const selectedUrls = hasContext ? selectedLinks.map((obj: any) => obj.url) : selectedLinks;
      const linksToFetch = selectedUrls.filter((link: string) => {
        const normalized = normalizeUrl(link);
        if (visited.has(normalized)) return false;
        if (Date.now() - startTime > CRAWL_TIMEOUT) return false;
        return true;
      });

      if (linksToFetch.length === 0) break;

      console.log(`[Crawl] Fetching ${linksToFetch.length} URLs for Depth ${depth}...`);
      const nextDepthLinks: string[] = [];

      for (let i = 0; i < linksToFetch.length; i += BATCH_SIZE) {
        const batch = linksToFetch.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map(async url => {
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
            }
          });
          if (!response.ok) return null;
          const html = await response.text();
          const page = parseHTMLWithCheerio(html, url, depth);
          return { page, html };
        }));

        for (const res of results) {
          if (res && res.page) {
            const { page, html } = res;
            visited.add(normalizeUrl(page.url));
            const links = extractLinks(html, domain);
            nextDepthLinks.push(...links);
            
            allPages.push(page);
          }
        }
      }

      currentLinks = nextDepthLinks;
    }

    const finalResult = { domain, pageCount: allPages.length, pages: allPages };
    saveCrawlResult(domain, finalResult);
    return finalResult;
  } catch (error: any) {
    console.error(`[Crawl] Error: ${error.message}`);
    return { domain, pageCount: allPages.length, pages: allPages, error: error.message };
  }
}

function parseHTMLWithCheerio(html: string, url: string, depth: number): ScrapedPage | null {
  try {
    const $ = cheerio.load(html);
    
    const title = $('title').text().trim() || url;
    
    // Simple content extraction (remove scripts, styles)
    $('script, style, nav, footer, header').remove();
    const content = $('body').text().replace(/\s+/g, ' ').trim();

    return {
      url,
      title,
      content,
      depth
    };
  } catch (error) {
    console.error(`[Crawl] Failed to parse HTML for ${url}:`, error);
    return null;
  }
}

/**
 * Helper: Extract links from HTML (same domain only)
 */
function extractLinks(html: string, baseDomain: string): string[] {
  const $ = cheerio.load(html);
  const links = new Set<string>();
  const baseUrl = baseDomain.startsWith('http') ? baseDomain : `https://${baseDomain}`;

  $('a[href]').each((_, el) => {
    let href = $(el).attr('href');
    if (!href || href === '#' || href === '/') return;

    try {
      const absoluteUrl = new URL(href, baseUrl).href;
      if (absoluteUrl.includes(baseDomain)) {
        links.add(normalizeUrl(absoluteUrl));
      }
    } catch (e) {
      // Ignore invalid URLs
    }
  });

  return Array.from(links);
}

/**
 * Helper: Extract links with context (nav, main, etc.)
 */
function extractLinksWithContext(html: string, baseDomain: string): LinkWithContext[] {
  const $ = cheerio.load(html);
  const linkMap = new Map<string, LinkWithContext>();
  const baseUrl = baseDomain.startsWith('http') ? baseDomain : `https://${baseDomain}`;

  $('a[href]').each((_, el) => {
    let href = $(el).attr('href');
    if (!href || href === '#' || href === '/') return;

    try {
      const url = new URL(href, baseUrl).href;
      if (!url.includes(baseDomain)) return;
      const normalized = normalizeUrl(url);

      let section: LinkWithContext['section'] = 'other';
      let parent = $(el).parent();

      for (let i = 0; i < 10 && parent.length > 0; i++) {
        const tagName = parent.prop('tagName')?.toLowerCase() || '';
        const id = parent.attr('id') || '';
        const className = parent.attr('class') || '';

        if (tagName === 'nav' || id.includes('nav') || className.includes('nav')) {
          section = 'nav'; break;
        } else if (tagName === 'main' || id.includes('main') || className.includes('main')) {
          section = 'main'; break;
        } else if (tagName === 'header' || id.includes('header') || className.includes('header')) {
          section = 'header'; break;
        } else if (tagName === 'footer' || id.includes('footer') || className.includes('footer')) {
          section = 'footer'; break;
        }
        parent = parent.parent();
      }

      linkMap.set(normalized, {
        url: normalized,
        text: $(el).text().trim(),
        section
      });
    } catch (e) {}
  });

  return Array.from(linkMap.values());
}

/**
 * Helper: Ask AI to select links
 */
async function askAIToSelectLinks(links: any[], options: { purpose: string, hasContext: boolean }): Promise<any[]> {
  const { apiKey } = getGoogleApiKey();
  if (!apiKey) {
    console.warn('[Crawl] No API key for AI selection, returning first 5 links as fallback');
    return links.slice(0, 5);
  }

  const linkList = options.hasContext 
    ? links.slice(0, 150).map((l, i) => `${i + 1}. [${l.section.toUpperCase()}] ${l.url} "${l.text}"`).join('\n')
    : links.slice(0, 150).map((l, i) => `${i + 1}. ${l}`).join('\n');

  const prompt = `당신은 웹 크롤링 전문가입니다.
다음은 웹페이지에서 발견한 링크 목록입니다:

${linkList}

**임무**: 위 링크 중에서 "${options.purpose}"와 관련된 **중요한 링크를 모두 선택**하세요. 개수 제한은 없습니다.
${options.hasContext ? `
**섹션 우선순위** (CRITICAL - 반드시 따를 것):
1. **[MAIN]** 링크 최우선 선택 (메인 콘텐츠)
2. **[OTHER]** 링크 선택 가능 (컨텍스트에 따라)
3. **[HEADER]** 링크 최소화 (주요 페이지만)
4. **[NAV]** 링크 최소화 (메뉴 중복 방지)
5. **[FOOTER]** 링크 제외 (저작권, 개인정보처리방침 등 불필요)
` : ''}제외할 링크: 외부 사이트, PDF, 로그인, 약관, 블로그 포스트 등.
출력 형식: 선택한 링크의 번호만 쉼표로 구분하여 출력하세요 (예: 1,3,5).`;

  try {
    const result = await generateTextWithAI({
      prompt,
      model: 'gemini-2.5-flash-lite', // Updated to gemini-2.5-flash-lite
      temperature: 0.1,
      apiKey
    });

    const indices = result.text.split(',')
      .map(s => parseInt(s.trim()) - 1)
      .filter(i => i >= 0 && i < links.length);

    return indices.map(i => links[i]);
  } catch (error) {
    console.error('[Crawl] AI Selection Error:', error);
    return links.slice(0, 5);
  }
}

/**
 * Helper: Normalize URL
 */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    let href = u.origin + u.pathname;
    if (href.endsWith('/') && href.length > (u.origin.length + 1)) {
      href = href.slice(0, -1);
    }
    return href.toLowerCase();
  } catch (e) {
    return url.toLowerCase();
  }
}

