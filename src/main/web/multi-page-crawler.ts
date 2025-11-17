/**
 * Multi-Page Crawler for Business Identity
 * Crawls homepage and top important pages, then combines content for AI analysis
 */

import { crawlHomepageForBusinessIdentity, HomepageCrawlResult } from './homepage-crawler';
import { fetchWebsiteContent } from './content-fetcher';

export interface CrawledPage {
  url: string;
  path: string; // e.g., "/about"
  pageType: 'homepage' | 'about' | 'contact' | 'products' | 'services' | 'blog' | 'careers' | 'pricing' | 'other';
  title: string | null;
  description: string | null;
  content: {
    text: string;
    wordCount: number;
  };
  metadata: {
    status: number;
    language: string | null;
    fetchedAt: string;
  };
  priority: 'high' | 'medium' | 'low';
}

export interface MultiPageCrawlResult {
  success: boolean;
  domain: string;
  baseUrl: string;
  pages: CrawledPage[];
  siteStructure: {
    navigation: {
      main: number;
      footer: number;
    };
    commonPages: {
      about?: string;
      contact?: string;
      products?: string;
      services?: string;
      blog?: string;
      careers?: string;
      pricing?: string;
    };
  };
  combinedContent: {
    text: string;
    totalWordCount: number;
    pagesCrawled: number;
  };
  error?: string;
}

/**
 * Determine page type from URL path
 */
function determinePageType(url: string, discoveredPages: HomepageCrawlResult['discoveredPages']): CrawledPage['pageType'] {
  const urlPath = new URL(url).pathname.toLowerCase();

  if (discoveredPages?.about && url === discoveredPages.about) return 'about';
  if (discoveredPages?.contact && url === discoveredPages.contact) return 'contact';
  if (discoveredPages?.products && url === discoveredPages.products) return 'products';
  if (discoveredPages?.services && url === discoveredPages.services) return 'services';
  if (discoveredPages?.blog && url === discoveredPages.blog) return 'blog';
  if (discoveredPages?.careers && url === discoveredPages.careers) return 'careers';
  if (discoveredPages?.pricing && url === discoveredPages.pricing) return 'pricing';

  if (urlPath === '/' || urlPath === '/index' || urlPath === '/index.html') return 'homepage';

  return 'other';
}

/**
 * Determine priority based on page type
 */
function getPagePriority(pageType: CrawledPage['pageType']): 'high' | 'medium' | 'low' {
  const highPriority: CrawledPage['pageType'][] = ['homepage', 'about', 'contact', 'products', 'services'];
  const mediumPriority: CrawledPage['pageType'][] = ['blog', 'careers', 'pricing'];

  if (highPriority.includes(pageType)) return 'high';
  if (mediumPriority.includes(pageType)) return 'medium';
  return 'low';
}

/**
 * Crawl multiple pages for business identity analysis
 */
export async function crawlMultiplePagesForBusinessIdentity(
  url: string,
  options: {
    maxPages?: number; // Maximum number of pages to crawl (default: 5)
    includePages?: ('about' | 'contact' | 'products' | 'services' | 'blog' | 'careers' | 'pricing')[]; // Specific pages to include
  } = {}
): Promise<MultiPageCrawlResult> {
  try {
    const maxPages = options.maxPages ?? 5;

    console.log('[MultiPageCrawler] Starting multi-page crawl for:', url);
    console.log('[MultiPageCrawler] Max pages:', maxPages);

    // Step 1: Crawl homepage to discover important pages
    const homepageResult = await crawlHomepageForBusinessIdentity(url);
    if (!homepageResult.success) {
      return {
        success: false,
        domain: new URL(url).hostname,
        baseUrl: url,
        pages: [],
        siteStructure: {
          navigation: { main: 0, footer: 0 },
          commonPages: {},
        },
        combinedContent: {
          text: '',
          totalWordCount: 0,
          pagesCrawled: 0,
        },
        error: homepageResult.error || 'Failed to crawl homepage',
      };
    }

    const baseUrl = homepageResult.homepageUrl;
    const domain = new URL(baseUrl).hostname;
    const discoveredPages = homepageResult.discoveredPages || {};

    // Step 2: Build list of pages to crawl (prioritized)
    const pagesToCrawl: Array<{ url: string; pageType: CrawledPage['pageType']; priority: 'high' | 'medium' | 'low' }> = [];

    // Always include homepage
    pagesToCrawl.push({
      url: baseUrl,
      pageType: 'homepage',
      priority: 'high',
    });

    // Add discovered important pages (high priority)
    const highPriorityPages = [
      { key: 'about' as const, pageType: 'about' as const },
      { key: 'contact' as const, pageType: 'contact' as const },
      { key: 'products' as const, pageType: 'products' as const },
      { key: 'services' as const, pageType: 'services' as const },
    ];

    for (const { key, pageType } of highPriorityPages) {
      if (discoveredPages[key] && !pagesToCrawl.find((p) => p.url === discoveredPages[key])) {
        pagesToCrawl.push({
          url: discoveredPages[key]!,
          pageType,
          priority: 'high',
        });
      }
    }

    // Add medium priority pages if we haven't reached maxPages
    const mediumPriorityPages = [
      { key: 'blog' as const, pageType: 'blog' as const },
      { key: 'careers' as const, pageType: 'careers' as const },
      { key: 'pricing' as const, pageType: 'pricing' as const },
    ];

    for (const { key, pageType } of mediumPriorityPages) {
      if (pagesToCrawl.length >= maxPages) break;
      if (discoveredPages[key] && !pagesToCrawl.find((p) => p.url === discoveredPages[key])) {
        pagesToCrawl.push({
          url: discoveredPages[key]!,
          pageType,
          priority: 'medium',
        });
      }
    }

    // Filter by includePages if specified
    const finalPagesToCrawl = options.includePages
      ? pagesToCrawl.filter((p) => {
          if (p.pageType === 'homepage') return true;
          return options.includePages!.includes(p.pageType as any);
        })
      : pagesToCrawl.slice(0, maxPages);

    console.log('[MultiPageCrawler] Pages to crawl:', finalPagesToCrawl.length);
    finalPagesToCrawl.forEach((p) => {
      console.log(`  - ${p.pageType}: ${p.url} (${p.priority} priority)`);
    });

    // Step 3: Crawl each page
    const crawledPages: CrawledPage[] = [];

    for (const pageInfo of finalPagesToCrawl) {
      try {
        console.log(`[MultiPageCrawler] Fetching: ${pageInfo.url}`);
        const fetchResult = await fetchWebsiteContent(pageInfo.url);

        if (!fetchResult.success || !fetchResult.content) {
          console.warn(`[MultiPageCrawler] Failed to fetch ${pageInfo.url}:`, fetchResult.error);
          continue;
        }

        const content = fetchResult.content;
        const urlObj = new URL(pageInfo.url);

        // Validate that we got actual text content
        if (!content.text || content.text.trim().length === 0) {
          console.warn(`[MultiPageCrawler] Warning: ${pageInfo.url} returned empty text content`);
        }

        crawledPages.push({
          url: pageInfo.url,
          path: urlObj.pathname,
          pageType: pageInfo.pageType,
          title: content.title,
          description: content.description,
          content: {
            text: content.text,
            wordCount: content.wordCount,
          },
          metadata: {
            status: content.status,
            language: content.language,
            fetchedAt: content.fetchedAt,
            isFormPage: (content as any).isFormPage || false,
            formCount: (content as any).formCount || 0,
            formFields: (content as any).formFields || [],
          },
          priority: pageInfo.priority,
        });

        console.log(`[MultiPageCrawler] ✅ Crawled ${pageInfo.pageType}: ${content.wordCount} words, ${content.text.length} chars`);
      } catch (error) {
        console.error(`[MultiPageCrawler] Error crawling ${pageInfo.url}:`, error);
        // Continue with other pages
      }
    }

    // Step 4: Combine content for AI analysis
    const combinedText = crawledPages
      .map((page) => {
        const sections: string[] = [];
        sections.push(`=== ${page.pageType.toUpperCase()} PAGE: ${page.path} ===`);
        sections.push(`URL: ${page.url}`);
        if (page.title) sections.push(`Title: ${page.title}`);
        if (page.description) sections.push(`Description: ${page.description}`);
        
        // Add form page indicator if applicable
        const metadata = page.metadata as any;
        if (metadata?.isFormPage) {
          sections.push(`[FORM PAGE - ${metadata.formCount || 0} form(s), ${metadata.formFields?.length || 0} field(s)]`);
        }
        
        sections.push(`\nContent:\n${page.content.text}`);
        return sections.join('\n');
      })
      .join('\n\n' + '='.repeat(80) + '\n\n');

    const totalWordCount = crawledPages.reduce((sum, page) => sum + page.content.wordCount, 0);

    console.log('[MultiPageCrawler] Multi-page crawl completed:', {
      pagesCrawled: crawledPages.length,
      totalWordCount,
    });

    return {
      success: true,
      domain,
      baseUrl,
      pages: crawledPages,
      siteStructure: {
        navigation: {
          main: homepageResult.navigation?.main?.length || 0,
          footer: homepageResult.navigation?.footer?.length || 0,
        },
        commonPages: discoveredPages,
      },
      combinedContent: {
        text: combinedText,
        totalWordCount,
        pagesCrawled: crawledPages.length,
      },
    };
  } catch (error) {
    console.error('[MultiPageCrawler] Error in multi-page crawl:', error);
    return {
      success: false,
      domain: new URL(url).hostname,
      baseUrl: url,
      pages: [],
      siteStructure: {
        navigation: { main: 0, footer: 0 },
        commonPages: {},
      },
      combinedContent: {
        text: '',
        totalWordCount: 0,
        pagesCrawled: 0,
      },
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

