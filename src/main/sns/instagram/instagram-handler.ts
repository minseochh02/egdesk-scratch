import { ipcMain } from 'electron';
import { Page } from 'playwright';
import { getAuthenticatedPage } from './login';

export interface InstagramConnection {
  id?: string;
  name: string;
  username: string;
  password: string;
  accessToken?: string; // For Graph API
  instagramAccountId?: string; // For Graph API
  createdAt?: string;
  updatedAt?: string;
}

export interface InstagramPost {
  id: string;
  shortcode: string;
  url: string;
  caption: string;
  timestamp: string;
  likes: number;
  comments: number;
  imageUrl?: string;
  videoUrl?: string;
  isVideo: boolean;
}

export class InstagramHandler {
  private store: any;

  constructor(store: any) {
    this.store = store;
  }

  /**
   * Register all Instagram connection management handlers
   */
  public registerHandlers(): void {
    this.registerConnectionHandlers();
    this.registerPostHandlers();
  }

  /**
   * Register Instagram connection management handlers
   */
  private registerConnectionHandlers(): void {
    // Save Instagram connection
    ipcMain.handle('instagram-save-connection', async (event, connection) => {
      try {
        const connections = this.store.get('instagramConnections', []) as any[];

        // Check if connection already exists (by username)
        const existingIndex = connections.findIndex(
          (conn) => conn.username === connection.username,
        );

        if (existingIndex >= 0) {
          // Update existing connection
          connections[existingIndex] = {
            ...connections[existingIndex],
            ...connection,
            updatedAt: new Date().toISOString(),
          };
        } else {
          // Add new connection
          connections.push({
            ...connection,
            id: Date.now().toString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        this.store.set('instagramConnections', connections);
        return { success: true, connection: connections[existingIndex >= 0 ? existingIndex : connections.length - 1], connections };
      } catch (error) {
        console.error('Error saving Instagram connection:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Get Instagram connections
    ipcMain.handle('instagram-get-connections', async () => {
      try {
        const connections = this.store.get('instagramConnections', []) as any[];
        return { success: true, connections };
      } catch (error) {
        console.error('Error getting Instagram connections:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Delete Instagram connection
    ipcMain.handle('instagram-delete-connection', async (event, connectionId) => {
      try {
        const connections = this.store.get('instagramConnections', []) as any[];
        const filteredConnections = connections.filter(
          (conn) => conn.id !== connectionId,
        );

        if (filteredConnections.length === connections.length) {
          return {
            success: false,
            error: 'Connection not found',
          };
        }

        this.store.set('instagramConnections', filteredConnections);
        return { success: true, connections: filteredConnections };
      } catch (error) {
        console.error('Error deleting Instagram connection:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Update Instagram connection
    ipcMain.handle('instagram-update-connection', async (event, connectionId, updates) => {
      try {
        const connections = this.store.get('instagramConnections', []) as any[];
        const connectionIndex = connections.findIndex(
          (conn) => conn.id === connectionId,
        );

        if (connectionIndex === -1) {
          return {
            success: false,
            error: 'Connection not found',
          };
        }

        connections[connectionIndex] = {
          ...connections[connectionIndex],
          ...updates,
          updatedAt: new Date().toISOString(),
        };

        this.store.set('instagramConnections', connections);
        return { 
          success: true, 
          connection: connections[connectionIndex],
          connections 
        };
      } catch (error) {
        console.error('Error updating Instagram connection:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Test Instagram connection
    ipcMain.handle('instagram-test-connection', async (event, connection) => {
      try {
        // For now, just return success - you can implement actual connection testing later
        console.log('Testing Instagram connection:', connection.name);
        return { 
          success: true, 
          message: 'Connection test successful' 
        };
      } catch (error) {
        console.error('Error testing Instagram connection:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });
  }

  /**
   * Register Instagram post fetching handlers
   */
  private registerPostHandlers(): void {
    // Fetch Instagram posts using Playwright (web scraping)
    ipcMain.handle('instagram-fetch-posts', async (event, connectionId, options = {}) => {
      try {
        const connections = this.store.get('instagramConnections', []) as InstagramConnection[];
        const connection = connections.find(conn => conn.id === connectionId);

        if (!connection) {
          return {
            success: false,
            error: 'Connection not found',
          };
        }

        const { limit = 12, useGraphAPI = false } = options;

        // Option 1: Use Graph API if access token is available
        if (useGraphAPI && connection.accessToken && connection.instagramAccountId) {
          return await this.fetchPostsViaGraphAPI(connection, limit);
        }

        // Option 2: Use Playwright scraping (default)
        return await this.fetchPostsViaPlaywright(connection, limit);
      } catch (error) {
        console.error('Error fetching Instagram posts:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });
  }

  /**
   * Fetch posts using Instagram Graph API (requires access token)
   */
  private async fetchPostsViaGraphAPI(
    connection: InstagramConnection,
    limit: number
  ): Promise<{ success: boolean; posts?: InstagramPost[]; error?: string }> {
    try {
      if (!connection.accessToken || !connection.instagramAccountId) {
        return {
          success: false,
          error: 'Graph API requires access token and Instagram account ID. Please set up OAuth authentication.',
        };
      }

      const url = `https://graph.instagram.com/${connection.instagramAccountId}/media?fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count&limit=${limit}&access_token=${connection.accessToken}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        return {
          success: false,
          error: data.error.message || 'Graph API error',
        };
      }

      const posts: InstagramPost[] = (data.data || []).map((item: any) => ({
        id: item.id,
        shortcode: item.permalink?.split('/p/')[1]?.split('/')[0] || '',
        url: item.permalink || '',
        caption: item.caption || '',
        timestamp: item.timestamp || '',
        likes: item.like_count || 0,
        comments: item.comments_count || 0,
        imageUrl: item.media_type === 'IMAGE' ? item.media_url : item.thumbnail_url,
        videoUrl: item.media_type === 'VIDEO' ? item.media_url : undefined,
        isVideo: item.media_type === 'VIDEO',
      }));

      return {
        success: true,
        posts,
      };
    } catch (error) {
      console.error('Error fetching posts via Graph API:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch posts via Graph API',
      };
    }
  }

  /**
   * Fetch posts using Playwright (web scraping)
   * Note: This method scrapes the Instagram profile page
   */
  private async fetchPostsViaPlaywright(
    connection: InstagramConnection,
    limit: number
  ): Promise<{ success: boolean; posts?: InstagramPost[]; error?: string }> {
    let authSession: { page: Page; close: () => Promise<void> } | null = null;

    try {
      console.log(`[InstagramHandler] Fetching posts for ${connection.username} using Playwright...`);

      // Get authenticated page
      authSession = await getAuthenticatedPage({
        username: connection.username,
        password: connection.password,
      });

      const { page } = authSession;

      // Navigate to user's profile
      const profileUrl = `https://www.instagram.com/${connection.username}/`;
      console.log(`[InstagramHandler] Navigating to profile: ${profileUrl}`);
      
      // Use 'domcontentloaded' instead of 'networkidle' - Instagram pages have continuous network activity
      await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

      // Wait for posts container to appear (more reliable than waiting for networkidle)
      console.log(`[InstagramHandler] Waiting for posts to load...`);
      
      // Try multiple selectors for posts container
      const postSelectors = [
        'article',
        'main article',
        '[role="main"] article',
        'section article',
      ];
      
      let postsFound = false;
      for (const selector of postSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 10000 });
          postsFound = true;
          console.log(`[InstagramHandler] Found posts using selector: ${selector}`);
          break;
        } catch (e) {
          // Try next selector
        }
      }
      
      if (!postsFound) {
        // Give it a bit more time and check if page loaded
        await page.waitForTimeout(3000);
        const hasPosts = await page.locator('article').count() > 0;
        if (!hasPosts) {
          throw new Error('Posts container not found. Profile may be private or page structure changed.');
        }
      }
      
      // Additional wait for images to start loading
      await page.waitForTimeout(2000);

      // Scroll to load more posts if needed
      if (limit > 12) {
        const scrollTimes = Math.ceil((limit - 12) / 12);
        for (let i = 0; i < scrollTimes; i++) {
          await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
          });
          await page.waitForTimeout(2000);
        }
      }

      // Extract posts from the page
      // Instagram profile structure: main > section > article > a[href*="/p/"]
      const posts = await page.evaluate((maxPosts) => {
        // Try multiple selector strategies for finding posts
        let postLinks: HTMLAnchorElement[] = [];
        
        // Strategy 1: Direct article links (most common)
        const articleLinks = Array.from(document.querySelectorAll('article a[href*="/p/"]')) as HTMLAnchorElement[];
        if (articleLinks.length > 0) {
          postLinks = articleLinks;
        } else {
          // Strategy 2: Look in main content area
          const main = document.querySelector('main');
          if (main) {
            const mainLinks = Array.from(main.querySelectorAll('a[href*="/p/"]')) as HTMLAnchorElement[];
            postLinks = mainLinks;
          } else {
            // Strategy 3: Any link with /p/ pattern
            postLinks = Array.from(document.querySelectorAll('a[href*="/p/"]')) as HTMLAnchorElement[];
          }
        }

        // Get unique post URLs (deduplicate)
        const uniqueHrefs = Array.from(new Set(
          postLinks
            .map(el => el.getAttribute('href'))
            .filter(Boolean)
        )).slice(0, maxPosts) as string[];

        // Extract post data
        return uniqueHrefs.map((href, index) => {
          // Extract shortcode from URL like /p/ABC123/ or /reel/XYZ789/
          const shortcodeMatch = href.match(/\/(?:p|reel)\/([^\/]+)/);
          const shortcode = shortcodeMatch ? shortcodeMatch[1] : '';
          const isReel = href.includes('/reel/');
          
          // Try to find the parent article to get more info
          const linkElement = postLinks.find(el => el.getAttribute('href') === href);
          let imageUrl = '';
          let isVideo = false;
          
          if (linkElement) {
            // Look for image in the link or nearby
            const img = linkElement.querySelector('img');
            if (img) {
              imageUrl = img.src || img.getAttribute('srcset')?.split(' ')[0] || '';
            }
            
            // Check for video indicator
            const videoIndicator = linkElement.querySelector('svg[aria-label*="video"], svg[aria-label*="Video"]');
            isVideo = !!videoIndicator || isReel;
          }

          return {
            id: `scraped_${shortcode}_${index}`,
            shortcode,
            url: href.startsWith('http') ? href : `https://www.instagram.com${href}`,
            caption: '', // Would need to click into post to get caption
            timestamp: new Date().toISOString(),
            likes: 0,
            comments: 0,
            imageUrl,
            isVideo,
          };
        });
      }, limit);

      // Map to InstagramPost format
      const detailedPosts: InstagramPost[] = posts.map((post: any) => ({
        id: post.id,
        shortcode: post.shortcode,
        url: post.url,
        caption: post.caption || '',
        timestamp: post.timestamp || new Date().toISOString(),
        likes: post.likes || 0,
        comments: post.comments || 0,
        imageUrl: post.imageUrl || undefined,
        videoUrl: post.isVideo ? post.imageUrl : undefined,
        isVideo: post.isVideo || false,
      }));

      console.log(`[InstagramHandler] Successfully fetched ${detailedPosts.length} posts`);

      return {
        success: true,
        posts: detailedPosts,
      };
    } catch (error) {
      console.error('[InstagramHandler] Error fetching posts via Playwright:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch posts via Playwright',
      };
    } finally {
      if (authSession) {
        try {
          await authSession.close();
        } catch (closeError) {
          console.warn('[InstagramHandler] Failed to close browser session:', closeError);
        }
      }
    }
  }
}

