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
