import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as mime from 'mime-types';
import { getSQLiteManager } from '../sqlite/manager';
import { WordPressPost, WordPressMedia, SyncOperation, SyncFileDetail } from '../sqlite/wordpress-sqlite-manager';

export interface WordPressConnection {
  id?: string;
  url: string;
  username: string;
  password?: string;
  name?: string;
  posts_count?: number;
  pages_count?: number;
  media_count?: number;
  local_sync_path?: string;
  createdAt?: string;
  updatedAt?: string;
}


export class WordPressHandler {
  private store: any;
  private mainWindow: BrowserWindow | null;

  constructor(store: any, mainWindow: BrowserWindow | null) {
    this.store = store;
    this.mainWindow = mainWindow;
  }

  /**
   * Initialize the WordPress handler
   */
  public async initialize(): Promise<void> {
    // WordPress handler initialization
  }

  /**
   * Get SQLite manager instance
   */
  private getSQLiteManager() {
    return getSQLiteManager();
  }

  /**
   * Check if SQLite is available
   */
  private isSQLiteAvailable(): boolean {
    return this.getSQLiteManager().isAvailable();
  }

  /**
   * Register all WordPress-related IPC handlers
   */
  public registerHandlers(): void {
    this.registerConnectionHandlers();
    this.registerSyncHandlers();
  }

  /**
   * Register WordPress connection management handlers
   */
  private registerConnectionHandlers(): void {
    // Save WordPress connection
    ipcMain.handle('wp-save-connection', async (event, connection) => {
      try {
        const connections = this.store.get('wordpressConnections', []) as any[];

        // Check if connection already exists (by URL)
        const existingIndex = connections.findIndex(
          (conn) => conn.url === connection.url,
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

        this.store.set('wordpressConnections', connections);
        return { success: true, connections };
      } catch (error) {
        console.error('Error saving WordPress connection:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Get WordPress connections
    ipcMain.handle('wp-get-connections', async () => {
      try {
        const connections = this.store.get('wordpressConnections', []) as any[];
        return { success: true, connections };
      } catch (error) {
        console.error('Error getting WordPress connections:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Delete WordPress connection
    ipcMain.handle('wp-delete-connection', async (event, connectionId) => {
      try {
        const connections = this.store.get('wordpressConnections', []) as any[];
        const filteredConnections = connections.filter(
          (conn) => conn.id !== connectionId,
        );
        this.store.set('wordpressConnections', filteredConnections);
        return { success: true, connections: filteredConnections };
      } catch (error) {
        console.error('Error deleting WordPress connection:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Update WordPress connection
    ipcMain.handle('wp-update-connection', async (event, connectionId, updates) => {
      try {
        const connections = this.store.get('wordpressConnections', []) as any[];
        const connectionIndex = connections.findIndex(
          (conn) => conn.id === connectionId,
        );

        if (connectionIndex >= 0) {
          connections[connectionIndex] = {
            ...connections[connectionIndex],
            ...updates,
            updatedAt: new Date().toISOString(),
          };
          this.store.set('wordpressConnections', connections);
          return { success: true, connection: connections[connectionIndex] };
        }
        return { success: false, error: 'Connection not found' };
      } catch (error) {
        console.error('Error updating WordPress connection:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Notify renderer about file sync completion
    ipcMain.handle('notify-sync-completion', async (event, syncData) => {
      try {
        // Broadcast to all renderer processes
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('sync-completed', syncData);
        }
        return { success: true };
      } catch (error) {
        console.error('Error notifying sync completion:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Navigate to synced folder in Finder UI
    ipcMain.handle(
      'wp-navigate-to-synced-folder',
      async (event, navigationData) => {
        try {
          // Send navigation request to renderer process
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send(
              'navigate-to-synced-folder',
              navigationData,
            );
          }
          return { success: true };
        } catch (error) {
          console.error('Error navigating to synced folder:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
    );
  }


  /**
   * Fetch posts from WordPress REST API and save to SQLite
   */
  async fetchPostsFromWordPress(connection: WordPressConnection, options: {
    perPage?: number;
    page?: number;
    status?: string;
    after?: string;
    before?: string;
  } = {}): Promise<{
    success: boolean;
    posts?: any[];
    total?: number;
    error?: string;
  }> {
    try {
      const {
        perPage = 100,
        page = 1,
        status = 'publish',
        after,
        before
      } = options;

      console.log(`🔄 Fetching posts from WordPress: ${connection.url}`);
      
      const baseUrl = connection.url.replace(/\/$/, '');
      const endpoint = `${baseUrl}/wp-json/wp/v2/posts`;
      
      // Build query parameters
      const queryParams = new URLSearchParams({
        per_page: perPage.toString(),
        page: page.toString(),
        status: status,
        ...(after && { after }),
        ...(before && { before })
      });

      const fullUrl = `${endpoint}?${queryParams.toString()}`;
      console.log(`📡 Fetching from: ${fullUrl}`);

      const auth = Buffer.from(`${connection.username}:${connection.password}`).toString('base64');
      
      const requestOptions = {
        hostname: new URL(fullUrl).hostname,
        port: new URL(fullUrl).port || 443,
        path: new URL(fullUrl).pathname + new URL(fullUrl).search,
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'User-Agent': 'EGDesk-WordPress-Sync/1.0',
          'Accept': 'application/json'
        }
      };

      return new Promise((resolve, reject) => {
        const req = https.request(requestOptions, (res) => {
          let responseData = '';

          res.on('data', (chunk) => {
            responseData += chunk;
          });

          res.on('end', () => {
            try {
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                const posts = JSON.parse(responseData);
                const total = parseInt(res.headers['x-wp-total'] as string) || posts.length;
                const totalPages = parseInt(res.headers['x-wp-totalpages'] as string) || 1;

                console.log(`✅ Successfully fetched ${posts.length} posts (page ${page}/${totalPages}, total: ${total})`);

                // Save posts to SQLite
                this.savePostsToSQLite(posts, connection.id!);

                resolve({
                  success: true,
                  posts,
                  total
                });
              } else {
                console.error(`❌ WordPress API Error: ${res.statusCode}`);
                console.error(`📄 Response:`, responseData);
                reject(new Error(`WordPress API request failed: ${res.statusCode} - ${responseData}`));
              }
            } catch (error: any) {
              console.error(`❌ Failed to parse WordPress response:`, error.message);
              console.error(`📄 Raw response:`, responseData);
              reject(new Error(`Failed to parse WordPress response: ${error.message}`));
            }
          });
        });

        req.on('error', (error) => {
          console.error(`❌ WordPress API request error:`, error.message);
          reject(new Error(`WordPress API request error: ${error.message}`));
        });

        req.setTimeout(30000, () => {
          req.destroy();
          reject(new Error('WordPress API request timeout'));
        });

        req.end();
      });
    } catch (error) {
      console.error('Error fetching posts from WordPress:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Save fetched posts to SQLite
   */
  private savePostsToSQLite(posts: any[], siteId: string): void {
    try {
      console.log(`💾 Saving ${posts.length} posts to SQLite for site ${siteId}`);
      
      for (const post of posts) {
        const wordpressPost: WordPressPost = {
          id: post.id,
          title: post.title?.rendered || post.title || 'Untitled',
          content: post.content?.rendered || post.content || '',
          excerpt: post.excerpt?.rendered || post.excerpt || '',
          slug: post.slug || '',
          status: post.status || 'publish',
          type: post.type || 'post',
          author: post.author || 1,
          featured_media: post.featured_media || 0,
          parent: post.parent || 0,
          menu_order: post.menu_order || 0,
          comment_status: post.comment_status || 'open',
          ping_status: post.ping_status || 'open',
          template: post.template || '',
          format: post.format || 'standard',
          meta: post.meta ? JSON.stringify(post.meta) : null,
          date: post.date || null,
          date_gmt: post.date_gmt || null,
          modified: post.modified || null,
          modified_gmt: post.modified_gmt || null,
          link: post.link || null,
          guid: post.guid?.rendered || post.guid || null,
          wordpress_site_id: siteId,
          synced_at: new Date().toISOString(),
          local_content: post.content?.rendered || post.content || '',
          export_format: 'wordpress'
        };

        this.getSQLiteManager().savePost(wordpressPost);
      }

      console.log(`✅ Successfully saved ${posts.length} posts to SQLite`);
    } catch (error) {
      console.error('Error saving posts to SQLite:', error);
      throw error;
    }
  }

  /**
   * Fetch media from WordPress REST API and save to SQLite
   */
  async fetchMediaFromWordPress(connection: WordPressConnection, options: {
    perPage?: number;
    page?: number;
    mimeType?: string;
    after?: string;
    before?: string;
  } = {}): Promise<{
    success: boolean;
    media?: any[];
    total?: number;
    error?: string;
  }> {
    try {
      const {
        perPage = 100,
        page = 1,
        mimeType,
        after,
        before
      } = options;

      console.log(`🔄 Fetching media from WordPress: ${connection.url}`);
      
      const baseUrl = connection.url.replace(/\/$/, '');
      const endpoint = `${baseUrl}/wp-json/wp/v2/media`;
      
      // Build query parameters
      const queryParams = new URLSearchParams({
        per_page: perPage.toString(),
        page: page.toString(),
        ...(mimeType && { media_type: mimeType }),
        ...(after && { after }),
        ...(before && { before })
      });

      const fullUrl = `${endpoint}?${queryParams.toString()}`;
      console.log(`📡 Fetching media from: ${fullUrl}`);

      const auth = Buffer.from(`${connection.username}:${connection.password}`).toString('base64');
      
      const requestOptions = {
        hostname: new URL(fullUrl).hostname,
        port: new URL(fullUrl).port || 443,
        path: new URL(fullUrl).pathname + new URL(fullUrl).search,
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'User-Agent': 'EGDesk-WordPress-Sync/1.0',
          'Accept': 'application/json'
        }
      };

      return new Promise((resolve, reject) => {
        const req = https.request(requestOptions, (res) => {
          let responseData = '';

          res.on('data', (chunk) => {
            responseData += chunk;
          });

          res.on('end', () => {
            try {
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                const media = JSON.parse(responseData);
                const total = parseInt(res.headers['x-wp-total'] as string) || media.length;
                const totalPages = parseInt(res.headers['x-wp-totalpages'] as string) || 1;

                console.log(`✅ Successfully fetched ${media.length} media items (page ${page}/${totalPages}, total: ${total})`);

                // Save media to SQLite
                this.saveMediaToSQLite(media, connection.id!);

                resolve({
                  success: true,
                  media,
                  total
                });
              } else {
                console.error(`❌ WordPress Media API Error: ${res.statusCode}`);
                console.error(`📄 Response:`, responseData);
                reject(new Error(`WordPress Media API request failed: ${res.statusCode} - ${responseData}`));
              }
            } catch (error: any) {
              console.error(`❌ Failed to parse WordPress media response:`, error.message);
              console.error(`📄 Raw response:`, responseData);
              reject(new Error(`Failed to parse WordPress media response: ${error.message}`));
            }
          });
        });

        req.on('error', (error) => {
          console.error(`❌ WordPress Media API request error:`, error.message);
          reject(new Error(`WordPress Media API request error: ${error.message}`));
        });

        req.setTimeout(30000, () => {
          req.destroy();
          reject(new Error('WordPress Media API request timeout'));
        });

        req.end();
      });
    } catch (error) {
      console.error('Error fetching media from WordPress:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Save fetched media to SQLite
   */
  private saveMediaToSQLite(media: any[], siteId: string): void {
    try {
      console.log(`💾 Saving ${media.length} media items to SQLite for site ${siteId}`);
      
      for (const mediaItem of media) {
        const wordpressMedia: WordPressMedia = {
          id: mediaItem.id,
          title: mediaItem.title?.rendered || mediaItem.title || '',
          description: mediaItem.description?.rendered || mediaItem.description || '',
          caption: mediaItem.caption?.rendered || mediaItem.caption || '',
          alt_text: mediaItem.alt_text || '',
          source_url: mediaItem.source_url || mediaItem.guid?.rendered || '',
          mime_type: mediaItem.mime_type || 'image/jpeg',
          file_name: mediaItem.slug || path.basename(mediaItem.source_url || ''),
          file_size: mediaItem.media_details?.filesize || 0,
          width: mediaItem.media_details?.width || 0,
          height: mediaItem.media_details?.height || 0,
          wordpress_site_id: siteId,
          synced_at: new Date().toISOString(),
          local_data: null // We don't download the actual file data in this implementation
        };

        this.getSQLiteManager().saveMedia(wordpressMedia);
      }

      console.log(`✅ Successfully saved ${media.length} media items to SQLite`);
    } catch (error) {
      console.error('Error saving media to SQLite:', error);
      throw error;
    }
  }

  /**
   * Fetch comments from WordPress REST API and save to SQLite
   */
  async fetchCommentsFromWordPress(connection: WordPressConnection, options: {
    perPage?: number;
    page?: number;
    status?: string;
    post?: number;
    after?: string;
    before?: string;
  } = {}): Promise<{
    success: boolean;
    comments?: any[];
    total?: number;
    error?: string;
  }> {
    try {
      const {
        perPage = 100,
        page = 1,
        status,
        post,
        after,
        before
      } = options;

      console.log(`🔄 Fetching comments from WordPress: ${connection.url}`);
      
      const baseUrl = connection.url.replace(/\/$/, '');
      const endpoint = `${baseUrl}/wp-json/wp/v2/comments`;
      
      // Build query parameters
      const queryParams = new URLSearchParams({
        per_page: perPage.toString(),
        page: page.toString(),
        ...(status && { status }),
        ...(post && { post: post.toString() }),
        ...(after && { after }),
        ...(before && { before })
      });

      const fullUrl = `${endpoint}?${queryParams.toString()}`;
      console.log(`📡 Fetching comments from: ${fullUrl}`);

      const auth = Buffer.from(`${connection.username}:${connection.password}`).toString('base64');
      
      const requestOptions = {
        hostname: new URL(fullUrl).hostname,
        port: new URL(fullUrl).port || 443,
        path: new URL(fullUrl).pathname + new URL(fullUrl).search,
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'User-Agent': 'EGDesk-WordPress-Sync/1.0',
          'Accept': 'application/json'
        }
      };

      return new Promise((resolve, reject) => {
        const req = https.request(requestOptions, (res) => {
          let responseData = '';

          res.on('data', (chunk) => {
            responseData += chunk;
          });

          res.on('end', () => {
            try {
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                const comments = JSON.parse(responseData);
                const total = parseInt(res.headers['x-wp-total'] as string) || comments.length;
                const totalPages = parseInt(res.headers['x-wp-totalpages'] as string) || 1;

                console.log(`✅ Successfully fetched ${comments.length} comments (page ${page}/${totalPages}, total: ${total})`);

                // Save comments to SQLite
                this.saveCommentsToSQLite(comments, connection.id!);

                resolve({
                  success: true,
                  comments,
                  total
                });
              } else {
                console.error(`❌ WordPress Comments API Error: ${res.statusCode}`);
                console.error(`📄 Response:`, responseData);
                reject(new Error(`WordPress Comments API request failed: ${res.statusCode} - ${responseData}`));
              }
            } catch (error: any) {
              console.error(`❌ Failed to parse WordPress comments response:`, error.message);
              console.error(`📄 Raw response:`, responseData);
              reject(new Error(`Failed to parse WordPress comments response: ${error.message}`));
            }
          });
        });

        req.on('error', (error) => {
          console.error(`❌ WordPress Comments API request error:`, error.message);
          reject(new Error(`WordPress Comments API request error: ${error.message}`));
        });

        req.setTimeout(30000, () => {
          req.destroy();
          reject(new Error('WordPress Comments API request timeout'));
        });

        req.end();
      });
    } catch (error) {
      console.error('Error fetching comments from WordPress:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Save fetched comments to SQLite
   */
  private saveCommentsToSQLite(comments: any[], siteId: string): void {
    try {
      console.log(`💾 Saving ${comments.length} comments to SQLite for site ${siteId}`);
      
      for (const comment of comments) {
        const wordpressComment: any = {
          id: comment.id,
          post_id: comment.post,
          parent: comment.parent || 0,
          author_name: comment.author_name || '',
          author_email: comment.author_email || '',
          author_url: comment.author_url || '',
          author_ip: comment.author_ip || '',
          content: comment.content?.rendered || comment.content || '',
          status: comment.status || 'hold',
          type: comment.type || 'comment',
          karma: comment.karma || 0,
          date: comment.date || null,
          date_gmt: comment.date_gmt || null,
          link: comment.link || '',
          wordpress_site_id: siteId,
          synced_at: new Date().toISOString()
        };

        this.getSQLiteManager().saveComment(wordpressComment);
      }

      console.log(`✅ Successfully saved ${comments.length} comments to SQLite`);
    } catch (error) {
      console.error('Error saving comments to SQLite:', error);
      throw error;
    }
  }

  /**
   * Fetch all comments from WordPress (with pagination)
   */
  async fetchAllCommentsFromWordPress(connection: WordPressConnection, options: {
    perPage?: number;
    status?: string;
    post?: number;
    after?: string;
    before?: string;
  } = {}): Promise<{
    success: boolean;
    totalComments?: number;
    error?: string;
  }> {
    try {
      const { perPage = 100, status, post, after, before } = options;
      
      console.log(`🔄 Fetching all comments from WordPress: ${connection.url}`);
      
      let allComments: any[] = [];
      let currentPage = 1;
      let totalPages = 1;
      let hasMorePages = true;

      while (hasMorePages) {
        console.log(`📄 Fetching comments page ${currentPage}/${totalPages}`);
        
        const result = await this.fetchCommentsFromWordPress(connection, {
          perPage,
          page: currentPage,
          status,
          post,
          after,
          before
        });

        if (!result.success) {
          return {
            success: false,
            error: result.error
          };
        }

        allComments = allComments.concat(result.comments || []);
        totalPages = Math.ceil((result.total || 0) / perPage);
        hasMorePages = currentPage < totalPages;
        currentPage++;

        // Add a small delay to avoid overwhelming the server
        if (hasMorePages) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`✅ Successfully fetched all ${allComments.length} comments from WordPress`);
      
      return {
        success: true,
        totalComments: allComments.length
      };
    } catch (error) {
      console.error('Error fetching all comments from WordPress:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Fetch all media from WordPress (with pagination)
   */
  async fetchAllMediaFromWordPress(connection: WordPressConnection, options: {
    perPage?: number;
    mimeType?: string;
    after?: string;
    before?: string;
  } = {}): Promise<{
    success: boolean;
    totalMedia?: number;
    error?: string;
  }> {
    try {
      const { perPage = 100, mimeType, after, before } = options;
      
      console.log(`🔄 Fetching all media from WordPress: ${connection.url}`);
      
      let allMedia: any[] = [];
      let currentPage = 1;
      let totalPages = 1;
      let hasMorePages = true;

      while (hasMorePages) {
        console.log(`📄 Fetching media page ${currentPage}/${totalPages}`);
        
        const result = await this.fetchMediaFromWordPress(connection, {
          perPage,
          page: currentPage,
          mimeType,
          after,
          before
        });

        if (!result.success) {
          return {
            success: false,
            error: result.error
          };
        }

        allMedia = allMedia.concat(result.media || []);
        totalPages = Math.ceil((result.total || 0) / perPage);
        hasMorePages = currentPage < totalPages;
        currentPage++;

        // Add a small delay to avoid overwhelming the server
        if (hasMorePages) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`✅ Successfully fetched all ${allMedia.length} media items from WordPress`);
      
      return {
        success: true,
        totalMedia: allMedia.length
      };
    } catch (error) {
      console.error('Error fetching all media from WordPress:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Fetch all posts from WordPress (with pagination)
   */
  async fetchAllPostsFromWordPress(connection: WordPressConnection, options: {
    perPage?: number;
    status?: string;
    after?: string;
    before?: string;
  } = {}): Promise<{
    success: boolean;
    totalPosts?: number;
    error?: string;
  }> {
    try {
      const { perPage = 100, status = 'publish', after, before } = options;
      
      console.log(`🔄 Fetching all posts from WordPress: ${connection.url}`);
      
      let allPosts: any[] = [];
      let currentPage = 1;
      let totalPages = 1;
      let hasMorePages = true;

      while (hasMorePages) {
        console.log(`📄 Fetching page ${currentPage}/${totalPages}`);
        
        const result = await this.fetchPostsFromWordPress(connection, {
          perPage,
          page: currentPage,
          status,
          after,
          before
        });

        if (!result.success) {
          return {
            success: false,
            error: result.error
          };
        }

        allPosts = allPosts.concat(result.posts || []);
        totalPages = Math.ceil((result.total || 0) / perPage);
        hasMorePages = currentPage < totalPages;
        currentPage++;

        // Add a small delay to avoid overwhelming the server
        if (hasMorePages) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`✅ Successfully fetched all ${allPosts.length} posts from WordPress`);
      
      return {
        success: true,
        totalPosts: allPosts.length
      };
    } catch (error) {
      console.error('Error fetching all posts from WordPress:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Register WordPress sync file operations handlers
   */
  private registerSyncHandlers(): void {
    // Skip SQLite handlers if SQLite is not available
    if (!this.isSQLiteAvailable()) {
      console.warn('⚠️ SQLite not available - skipping sync handlers');
      
      // Register minimal fallback handlers
      ipcMain.handle('wp-sync-get-operations', async () => ({ success: true, operations: [] }));
      ipcMain.handle('wp-sync-get-stats', async () => ({ success: true, stats: null }));
      ipcMain.handle('wp-sync-get-posts', async () => ({ success: true, posts: [] }));
      ipcMain.handle('wp-sync-get-media', async () => ({ success: true, media: [] }));
      return;
    }
    // Create sync operation
    ipcMain.handle('wp-sync-create-operation', async (event, operationData) => {
      try {
        const operation: Omit<SyncOperation, 'id' | 'created_at'> = {
          site_id: operationData.siteId,
          site_name: operationData.siteName,
          operation_type: operationData.operationType || 'full_sync',
          status: 'pending',
          start_time: new Date().toISOString(),
          total_posts: operationData.totalPosts || 0,
          synced_posts: 0,
          total_media: operationData.totalMedia || 0,
          synced_media: 0,
          errors: '[]',
          export_format: operationData.exportFormat || 'wordpress',
          local_path: operationData.localPath
        };

        const operationId = this.getSQLiteManager().createSyncOperation(operation);
        return { success: true, operationId };
      } catch (error) {
        console.error('Error creating sync operation:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Update sync operation
    ipcMain.handle('wp-sync-update-operation', async (event, operationId, updates) => {
      try {
        this.getSQLiteManager().updateSyncOperation(operationId, updates);
        return { success: true };
      } catch (error) {
        console.error('Error updating sync operation:', error);
          return {
            success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Save WordPress post to SQLite
    ipcMain.handle('wp-sync-save-post', async (event, postData) => {
      try {
        const post: WordPressPost = {
          id: postData.id,
          title: postData.title,
          content: postData.content,
          excerpt: postData.excerpt || '',
          slug: postData.slug,
          status: postData.status || 'publish',
          type: postData.type || 'post',
          author: postData.author || 1,
          featured_media: postData.featured_media || 0,
          parent: postData.parent || 0,
          menu_order: postData.menu_order || 0,
          comment_status: postData.comment_status || 'open',
          ping_status: postData.ping_status || 'open',
          template: postData.template || '',
          format: postData.format || 'standard',
          meta: JSON.stringify(postData.meta || {}),
          date: postData.date,
          date_gmt: postData.date_gmt,
          modified: postData.modified,
          modified_gmt: postData.modified_gmt,
          link: postData.link,
          guid: postData.guid,
          wordpress_site_id: postData.wordpress_site_id,
          synced_at: new Date().toISOString(),
          local_content: postData.local_content,
          export_format: postData.export_format
        };

        this.getSQLiteManager().savePost(post);
        return { success: true, size: post.content.length };
      } catch (error) {
        console.error('Error saving post to SQLite:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Download and save media to SQLite
    ipcMain.handle('wp-sync-download-media', async (event, mediaData) => {
      try {
        const { mediaUrl, mediaInfo, siteId } = mediaData;
        
        // Download media data
        const mediaBuffer = await this.downloadMediaBuffer(mediaUrl);
        
        const media: WordPressMedia = {
          id: mediaInfo.id,
          title: mediaInfo.title || '',
          description: mediaInfo.description || '',
          caption: mediaInfo.caption || '',
          alt_text: mediaInfo.alt_text || '',
          source_url: mediaUrl,
          mime_type: mediaInfo.mime_type || 'image/jpeg',
          file_name: mediaInfo.file_name || path.basename(mediaUrl),
          file_size: mediaBuffer.length,
          width: mediaInfo.width || 0,
          height: mediaInfo.height || 0,
          wordpress_site_id: siteId,
          synced_at: new Date().toISOString(),
          local_data: mediaBuffer
        };

        this.getSQLiteManager().saveMedia(media);
        return { success: true, size: mediaBuffer.length };
      } catch (error) {
        console.error('Error downloading media to SQLite:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Get posts by site
    ipcMain.handle('wp-sync-get-posts', async (event, siteId, limit = 100, offset = 0) => {
      try {
        const posts = this.getSQLiteManager().getPostsBySite(siteId, limit, offset);
        return { success: true, posts };
      } catch (error) {
        console.error('Error getting posts from SQLite:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Get media by site
    ipcMain.handle('wp-sync-get-media', async (event, siteId, limit = 100, offset = 0) => {
      try {
        const media = this.getSQLiteManager().getMediaBySite(siteId, limit, offset);
        return { success: true, media };
      } catch (error) {
        console.error('Error getting media from SQLite:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Get sync operations
    ipcMain.handle('wp-sync-get-operations', async (event, siteId, limit = 50) => {
      try {
        const operations = this.getSQLiteManager().getSyncOperationsBySite(siteId, limit);
        return { success: true, operations };
      } catch (error) {
        console.error('Error getting sync operations from SQLite:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Get sync statistics
    ipcMain.handle('wp-sync-get-stats', async (event, siteId) => {
      try {
        const stats = this.getSQLiteManager().getSyncStats(siteId);
        return { success: true, stats };
      } catch (error) {
        console.error('Error getting sync stats from SQLite:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Add sync file detail
    ipcMain.handle('wp-sync-add-file-detail', async (event, fileDetailData) => {
      try {
        const fileDetail: Omit<SyncFileDetail, 'id'> = {
          sync_operation_id: fileDetailData.syncOperationId,
          file_type: fileDetailData.fileType,
          file_name: fileDetailData.fileName,
          file_path: fileDetailData.filePath,
          file_size: fileDetailData.fileSize || 0,
          status: fileDetailData.status || 'pending',
          error_message: fileDetailData.errorMessage,
          synced_at: fileDetailData.syncedAt,
          wordpress_id: fileDetailData.wordpressId,
          wordpress_url: fileDetailData.wordpressUrl
        };

        const fileDetailId = this.getSQLiteManager().addSyncFileDetail(fileDetail);
        return { success: true, fileDetailId };
      } catch (error) {
        console.error('Error adding sync file detail:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Update sync file detail
    ipcMain.handle('wp-sync-update-file-detail', async (event, fileDetailId, status, errorMessage) => {
      try {
        this.getSQLiteManager().updateSyncFileDetail(fileDetailId, status, errorMessage);
        return { success: true };
      } catch (error) {
        console.error('Error updating sync file detail:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Get sync file details
    ipcMain.handle('wp-sync-get-file-details', async (event, operationId) => {
        try {
        const fileDetails = this.getSQLiteManager().getSyncFileDetails(operationId);
        return { success: true, fileDetails };
        } catch (error) {
        console.error('Error getting sync file details:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
    });

    // Export SQLite data to files
    ipcMain.handle('wp-sync-export-to-files', async (event, exportOptions) => {
      try {
        const result = await this.getSQLiteManager().exportToFiles(exportOptions);
        return result;
      } catch (error) {
        console.error('Error exporting to files:', error);
        return {
          success: false,
          exportedFiles: [],
          totalSize: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Fetch posts from WordPress REST API
    ipcMain.handle('wp-fetch-posts', async (event, connectionId, options = {}) => {
      try {
        // Get connection details
        const connections = this.store.get('wordpressConnections', []) as any[];
        const connection = connections.find(conn => conn.id === connectionId);
        
        if (!connection) {
          return {
            success: false,
            error: 'Connection not found'
          };
        }

        const result = await this.fetchPostsFromWordPress(connection, options);
        return result;
      } catch (error) {
        console.error('Error fetching posts from WordPress:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Fetch all posts from WordPress (with pagination)
    ipcMain.handle('wp-fetch-all-posts', async (event, connectionId, options = {}) => {
      try {
        // Get connection details
        const connections = this.store.get('wordpressConnections', []) as any[];
        const connection = connections.find(conn => conn.id === connectionId);
        
        if (!connection) {
          return {
            success: false,
            error: 'Connection not found'
          };
        }

        const result = await this.fetchAllPostsFromWordPress(connection, options);
        return result;
      } catch (error) {
        console.error('Error fetching all posts from WordPress:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Fetch media from WordPress REST API
    ipcMain.handle('wp-fetch-media', async (event, connectionId, options = {}) => {
      try {
        // Get connection details
        const connections = this.store.get('wordpressConnections', []) as any[];
        const connection = connections.find(conn => conn.id === connectionId);
        
        if (!connection) {
          return {
            success: false,
            error: 'Connection not found'
          };
        }

        const result = await this.fetchMediaFromWordPress(connection, options);
        return result;
      } catch (error) {
        console.error('Error fetching media from WordPress:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Fetch all media from WordPress (with pagination)
    ipcMain.handle('wp-fetch-all-media', async (event, connectionId, options = {}) => {
      try {
        // Get connection details
        const connections = this.store.get('wordpressConnections', []) as any[];
        const connection = connections.find(conn => conn.id === connectionId);
        
        if (!connection) {
          return {
            success: false,
            error: 'Connection not found'
          };
        }

        const result = await this.fetchAllMediaFromWordPress(connection, options);
        return result;
      } catch (error) {
        console.error('Error fetching all media from WordPress:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Fetch comments from WordPress REST API
    ipcMain.handle('wp-fetch-comments', async (event, connectionId, options = {}) => {
      try {
        // Get connection details
        const connections = this.store.get('wordpressConnections', []) as any[];
        const connection = connections.find(conn => conn.id === connectionId);
        
        if (!connection) {
          return {
            success: false,
            error: 'Connection not found'
          };
        }

        const result = await this.fetchCommentsFromWordPress(connection, options);
        return result;
      } catch (error) {
        console.error('Error fetching comments from WordPress:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Fetch all comments from WordPress (with pagination)
    ipcMain.handle('wp-fetch-all-comments', async (event, connectionId, options = {}) => {
      try {
        // Get connection details
        const connections = this.store.get('wordpressConnections', []) as any[];
        const connection = connections.find(conn => conn.id === connectionId);
        
        if (!connection) {
          return {
            success: false,
            error: 'Connection not found'
          };
        }

        const result = await this.fetchAllCommentsFromWordPress(connection, options);
        return result;
      } catch (error) {
        console.error('Error fetching all comments from WordPress:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Get comments by site
    ipcMain.handle('wp-get-comments', async (event, connectionId, limit = 100, offset = 0) => {
      try {
        const comments = this.getSQLiteManager().getCommentsBySite(connectionId, limit, offset);
        return { success: true, comments };
      } catch (error) {
        console.error('Error getting comments from SQLite:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Update comment status
    ipcMain.handle('wp-update-comment-status', async (event, connectionId, commentId, status) => {
      try {
        this.getSQLiteManager().updateCommentStatus(commentId, connectionId, status);
        return { success: true };
      } catch (error) {
        console.error('Error updating comment status:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Delete comment
    ipcMain.handle('wp-delete-comment', async (event, connectionId, commentId) => {
      try {
        this.getSQLiteManager().deleteComment(commentId, connectionId);
        return { success: true };
      } catch (error) {
        console.error('Error deleting comment:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
  }


  /**
   * Upload media to WordPress using multipart/form-data
   */
  async uploadMediaToWordPress(fileBuffer: Buffer, filename: string, mimeType: string, options: any = {}): Promise<any> {
    const WORDPRESS_URL = process.env.WORDPRESS_URL;
    const WORDPRESS_USERNAME = process.env.WORDPRESS_USERNAME;
    const WORDPRESS_PASSWORD = process.env.WORDPRESS_PASSWORD;

    if (!WORDPRESS_URL || !WORDPRESS_USERNAME || !WORDPRESS_PASSWORD) {
      throw new Error('Missing WordPress configuration: WORDPRESS_URL, WORDPRESS_USERNAME, or WORDPRESS_PASSWORD not set');
    }

    console.log(`📤 Uploading media to WordPress: ${filename}`);

    const baseUrl = WORDPRESS_URL.replace(/\/$/, '');
    const endpoint = `${baseUrl}/wp-json/wp/v2/media`;

    // Create multipart form data
    const boundary = `----formdata-${Date.now()}`;
    const formData = this.createMultipartFormData(fileBuffer, filename, mimeType, boundary, options);

    const auth = Buffer.from(`${WORDPRESS_USERNAME}:${WORDPRESS_PASSWORD}`).toString('base64');

    const requestOptions = {
      hostname: new URL(endpoint).hostname,
      port: new URL(endpoint).port || 443,
      path: new URL(endpoint).pathname,
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': formData.length
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(requestOptions, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          const statusCode = res.statusCode || 0;
          console.log(`📊 WordPress Media API Response: ${statusCode}`);
          
          try {
            const parsed = JSON.parse(responseData);
            if (statusCode >= 200 && statusCode < 300) {
              console.log(`✅ Successfully uploaded media: ${filename}`);
              console.log(`🆔 Media ID: ${parsed.id}`);
              console.log(`🔗 Media URL: ${parsed.source_url}`);
              resolve(parsed);
            } else {
              console.error(`❌ WordPress Media API Error: ${statusCode}`);
              console.error(`📄 Response:`, parsed);
              reject(new Error(`WordPress Media API request failed: ${statusCode} - ${parsed.message || responseData}`));
            }
          } catch (error: any) {
            console.error(`❌ Failed to parse WordPress response:`, error.message);
            console.error(`📄 Raw response:`, responseData);
            
            // Handle 403 Forbidden and other HTML error responses
            if (responseData.includes('<html>') || responseData.includes('403 Forbidden')) {
              reject(new Error(`WordPress upload forbidden (403) - check file permissions or upload limits. Raw response: ${responseData.substring(0, 200)}...`));
                } else {
              reject(new Error(`Failed to parse WordPress response: ${error.message}`));
            }
                }
              });
          });

      req.on('error', (error: any) => {
        console.error(`❌ WordPress Media API request error:`, error.message);
        reject(new Error(`WordPress Media API request error: ${error.message}`));
      });

      req.write(formData);
      req.end();
    });
  }

  /**
   * Create multipart form data
   */
  private createMultipartFormData(fileBuffer: Buffer, filename: string, mimeType: string, boundary: string, options: any): Buffer {
    const parts: any[] = [];

    // Add file part
    parts.push(`--${boundary}`);
    parts.push(`Content-Disposition: form-data; name="file"; filename="${filename}"`);
    parts.push(`Content-Type: ${mimeType}`);
    parts.push('');
    parts.push(fileBuffer);
    parts.push('');

    // Add optional metadata
    if (options.altText) {
      parts.push(`--${boundary}`);
      parts.push(`Content-Disposition: form-data; name="alt_text"`);
      parts.push('');
      parts.push(options.altText);
      parts.push('');
    }

    if (options.caption) {
      parts.push(`--${boundary}`);
      parts.push(`Content-Disposition: form-data; name="caption"`);
      parts.push('');
      parts.push(options.caption);
      parts.push('');
    }

    if (options.description) {
      parts.push(`--${boundary}`);
      parts.push(`Content-Disposition: form-data; name="description"`);
      parts.push('');
      parts.push(options.description);
      parts.push('');
    }

    if (options.title) {
      parts.push(`--${boundary}`);
      parts.push(`Content-Disposition: form-data; name="title"`);
      parts.push('');
      parts.push(options.title);
      parts.push('');
    }

    // Close boundary
    parts.push(`--${boundary}--`);

    return Buffer.concat(parts.map(part => 
      typeof part === 'string' ? Buffer.from(part + '\r\n', 'utf8') : part
    ));
  }

  /**
   * Upload images to WordPress and return media IDs
   */
  async uploadImagesToWordPress(images: any[]): Promise<any[]> {
    const uploadedImages: any[] = [];
    
    console.log(`🖼️  Starting upload of ${images.length} image(s) to WordPress...`);
    
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      try {
        console.log(`📤 Uploading image ${i + 1}/${images.length}: ${image.description || image.fileName}`);
        
        // Convert base64 data to buffer if needed
        let fileBuffer: Buffer;
        if (image.buffer) {
          fileBuffer = image.buffer;
        } else if (image.data) {
          fileBuffer = Buffer.from(image.data, 'base64');
        } else {
          throw new Error('No image data available');
        }
        
        const filename = image.fileName || `image-${Date.now()}-${i + 1}.${mime.extension(image.mimeType || 'image/png')}`;
        const mimeType = image.mimeType || 'image/png';
        
        const uploadOptions = {
          altText: image.altText || image.description || '',
          caption: image.caption || '',
          description: image.description || '',
          title: image.title || `${image.description || 'Generated Image'} ${i + 1}`
        };
        
        const uploadedMedia = await this.uploadMediaToWordPress(
          fileBuffer,
          filename,
          mimeType,
          uploadOptions
        );
        
        uploadedImages.push({
          ...image,
          mediaId: uploadedMedia.id,
          wordpressUrl: uploadedMedia.source_url,
          uploaded: true
        });
        
        console.log(`✅ Image ${i + 1} uploaded successfully (Media ID: ${uploadedMedia.id})`);
        
      } catch (error: any) {
        console.error(`❌ Failed to upload image ${i + 1}:`, error.message);
        uploadedImages.push({
          ...image,
          uploaded: false,
          error: error.message
        });
      }
    }
    
    const successCount = uploadedImages.filter(img => img.uploaded).length;
    console.log(`🎉 Image upload completed: ${successCount}/${images.length} successful`);
    
    return uploadedImages;
  }

  /**
   * Download media buffer from URL
   */
  private async downloadMediaBuffer(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https:') ? https : require('http');
      
      protocol.get(url, (response: any) => {
        if (response.statusCode === 200) {
          const chunks: Buffer[] = [];
          
          response.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
          });
          
          response.on('end', () => {
            resolve(Buffer.concat(chunks));
          });
          
          response.on('error', (error: any) => {
            reject(new Error(`Download error: ${error.message}`));
          });
        } else {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        }
      }).on('error', (error: any) => {
        reject(new Error(`Request error: ${error.message}`));
      });
    });
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    // SQLite cleanup is handled by the central SQLite manager
    // No need to cleanup here as it's managed centrally
  }
}
