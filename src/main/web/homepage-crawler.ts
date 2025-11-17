/**
 * Homepage Crawler for Business Identity
 * Extracts navigation links and identifies important pages from homepage
 */

import { URL } from 'url';
import { fetchWebsiteContent } from './content-fetcher';

export interface NavigationLink {
  href: string;
  text: string;
  title?: string;
  isInternal: boolean;
  normalizedUrl?: string; // Full URL for internal links
}

export interface HomepageCrawlResult {
  success: boolean;
  homepageUrl: string;
  navigation?: {
    main: NavigationLink[];
    footer: NavigationLink[];
  };
  discoveredPages?: {
    about?: string;
    contact?: string;
    products?: string;
    services?: string;
    blog?: string;
    careers?: string;
    pricing?: string;
  };
  allInternalLinks?: string[];
  error?: string;
}

/**
 * Extract links from HTML content
 */
function extractLinksFromHtml(html: string, baseUrl: string): NavigationLink[] {
  const links: NavigationLink[] = [];
  const baseUrlObj = new URL(baseUrl);

  // Match all anchor tags with href
  const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1].trim();
    const linkText = match[2]
      .replace(/<[^>]+>/g, '') // Remove HTML tags from link text
      .trim();

    // Skip empty links, anchors, javascript, mailto, tel
    if (
      !href ||
      href.startsWith('#') ||
      href.startsWith('javascript:') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:')
    ) {
      continue;
    }

    try {
      let fullUrl: string;
      let isInternal = false;

      if (href.startsWith('http://') || href.startsWith('https://')) {
        const linkUrl = new URL(href);
        isInternal = linkUrl.hostname === baseUrlObj.hostname;
        fullUrl = href;
      } else if (href.startsWith('/')) {
        // Absolute path
        fullUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}${href}`;
        isInternal = true;
      } else {
        // Relative path
        const basePath = baseUrlObj.pathname.endsWith('/')
          ? baseUrlObj.pathname
          : baseUrlObj.pathname.substring(0, baseUrlObj.pathname.lastIndexOf('/') + 1);
        fullUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}${basePath}${href}`;
        isInternal = true;
      }

      links.push({
        href,
        text: linkText,
        isInternal,
        normalizedUrl: isInternal ? fullUrl : undefined,
      });
    } catch (error) {
      // Skip invalid URLs
      console.warn(`[HomepageCrawler] Invalid URL: ${href}`);
    }
  }

  return links;
}

/**
 * Identify navigation sections (main nav vs footer)
 */
function categorizeLinks(links: NavigationLink[], html: string): {
  main: NavigationLink[];
  footer: NavigationLink[];
} {
  const main: NavigationLink[] = [];
  const footer: NavigationLink[] = [];

  // Try to identify footer section
  const footerRegex = /<footer[^>]*>([\s\S]*?)<\/footer>/i;
  const footerMatch = html.match(footerRegex);
  const footerHtml = footerMatch ? footerMatch[1] : '';

  // Common navigation selectors
  const navSelectors = [
    'nav',
    'header nav',
    '.navigation',
    '.nav',
    '.main-nav',
    '.primary-nav',
    '#navigation',
    '#nav',
  ];

  // Extract links that appear in navigation areas
  const navLinks = new Set<string>();
  
  // For now, we'll use a simple heuristic:
  // - Links in footer HTML are footer links
  // - Other internal links are main nav links
  // This can be improved with more sophisticated parsing

  links.forEach((link) => {
    if (!link.isInternal) return;

    // Check if link text appears in footer
    const isInFooter = footerHtml.includes(link.href) || footerHtml.includes(link.text);

    if (isInFooter) {
      footer.push(link);
    } else {
      main.push(link);
    }
  });

  return { main, footer };
}

/**
 * Identify important pages from discovered links
 */
function identifyImportantPages(links: NavigationLink[]): {
  about?: string;
  contact?: string;
  products?: string;
  services?: string;
  blog?: string;
  careers?: string;
  pricing?: string;
} {
  const pages: {
    about?: string;
    contact?: string;
    products?: string;
    services?: string;
    blog?: string;
    careers?: string;
    pricing?: string;
  } = {};

  // Patterns to match for each page type
  const patterns = {
    about: [
      /^\/about/i,
      /\/about-us/i,
      /\/company/i,
      /\/our-story/i,
      /\/who-we-are/i,
    ],
    contact: [
      /^\/contact/i,
      /\/contact-us/i,
      /\/get-in-touch/i,
      /\/reach-us/i,
    ],
    products: [
      /^\/products/i,
      /\/product/i,
      /\/shop/i,
      /\/store/i,
    ],
    services: [
      /^\/services/i,
      /\/service/i,
      /\/solutions/i,
      /\/offerings/i,
    ],
    blog: [
      /^\/blog/i,
      /\/news/i,
      /\/articles/i,
      /\/insights/i,
      /\/resources/i,
    ],
    careers: [
      /^\/careers/i,
      /\/jobs/i,
      /\/join-us/i,
      /\/we-are-hiring/i,
    ],
    pricing: [
      /^\/pricing/i,
      /\/plans/i,
      /\/packages/i,
      /\/prices/i,
    ],
  };

  links.forEach((link) => {
    if (!link.isInternal || !link.normalizedUrl) return;

    const urlPath = new URL(link.normalizedUrl).pathname.toLowerCase();

    // Check each pattern category
    for (const [category, regexPatterns] of Object.entries(patterns)) {
      if (pages[category as keyof typeof pages]) continue; // Already found

      for (const pattern of regexPatterns) {
        if (pattern.test(urlPath) || pattern.test(link.text.toLowerCase())) {
          pages[category as keyof typeof pages] = link.normalizedUrl;
          break;
        }
      }
    }
  });

  return pages;
}

/**
 * Crawl homepage and extract navigation links
 */
export async function crawlHomepageForBusinessIdentity(
  url: string
): Promise<HomepageCrawlResult> {
  try {
    if (!url || typeof url !== 'string') {
      return {
        success: false,
        homepageUrl: url,
        error: 'URL is required.',
      };
    }

    // Normalize URL
    let parsedUrl: URL;
    try {
      const normalizedUrl = url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`;
      parsedUrl = new URL(normalizedUrl);
    } catch {
      return {
        success: false,
        homepageUrl: url,
        error: 'Invalid URL format.',
      };
    }

    const homepageUrl = parsedUrl.toString();

    console.log('[HomepageCrawler] Fetching homepage:', homepageUrl);

    // Fetch homepage content
    const fetchResult = await fetchWebsiteContent(homepageUrl);
    if (!fetchResult.success || !fetchResult.content) {
      return {
        success: false,
        homepageUrl,
        error: fetchResult.error || 'Failed to fetch homepage content.',
      };
    }

    const html = fetchResult.content.html;

    // Extract all links
    const allLinks = extractLinksFromHtml(html, homepageUrl);

    // Filter to only internal links
    const internalLinks = allLinks.filter((link) => link.isInternal);

    // Categorize into main nav and footer
    const navigation = categorizeLinks(internalLinks, html);

    // Identify important pages
    const discoveredPages = identifyImportantPages(internalLinks);

    // Get all unique internal URLs
    const allInternalUrls = Array.from(
      new Set(
        internalLinks
          .map((link) => link.normalizedUrl)
          .filter((url): url is string => Boolean(url))
      )
    );

    console.log('[HomepageCrawler] Found links:', {
      total: allLinks.length,
      internal: internalLinks.length,
      mainNav: navigation.main.length,
      footer: navigation.footer.length,
      discoveredPages: Object.keys(discoveredPages).length,
    });

    return {
      success: true,
      homepageUrl,
      navigation,
      discoveredPages,
      allInternalLinks: allInternalUrls,
    };
  } catch (error) {
    console.error('[HomepageCrawler] Error crawling homepage:', error);
    return {
      success: false,
      homepageUrl: url,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

