/**
 * WordPress Media Service
 * Handles media uploads and management via WordPress REST API
 */

export interface WordPressMediaUpload {
  id: number;
  title: string;
  source_url: string;
  media_type: string;
  mime_type: string;
  alt_text?: string;
  caption?: string;
  description?: string;
}

export interface MediaUploadOptions {
  altText?: string;
  caption?: string;
  description?: string;
  title?: string;
}

export class WordPressMediaService {
  private baseUrl: string;
  private auth: string;

  constructor(wordpressUrl: string, username: string, password: string) {
    this.baseUrl = wordpressUrl.replace(/\/$/, '');
    this.auth = btoa(`${username}:${password}`);
  }

  /**
   * Extract rendered content from WordPress API response
   * Handles both string and object formats (with raw/rendered properties)
   */
  private extractRenderedContent(content: any): string {
    if (typeof content === 'string') {
      return content;
    }
    if (typeof content === 'object' && content !== null) {
      return content.rendered || content.raw || '';
    }
    return '';
  }

  /**
   * Upload media file to WordPress
   */
  async uploadMedia(
    file: File | Buffer,
    filename: string,
    mimeType: string,
    options: MediaUploadOptions = {}
  ): Promise<WordPressMediaUpload> {
    const formData = new FormData();
    
    // Add the file
    if (file instanceof File) {
      formData.append('file', file);
    } else {
      // Convert Buffer to Blob for FormData
      const blob = new Blob([file], { type: mimeType });
      formData.append('file', blob, filename);
    }

    // Add optional metadata
    if (options.altText) {
      formData.append('alt_text', options.altText);
    }
    if (options.caption) {
      formData.append('caption', options.caption);
    }
    if (options.description) {
      formData.append('description', options.description);
    }
    if (options.title) {
      formData.append('title', options.title);
    }

    const response = await fetch(`${this.baseUrl}/wp-json/wp/v2/media`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${this.auth}`,
        // Don't set Content-Type for FormData - let the browser set it with boundary
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Media upload failed: ${response.status} - ${
          errorData.message || response.statusText
        }`
      );
    }

    const rawResponse = await response.json();
    
    // Transform the response to handle WordPress API format
    return {
      id: rawResponse.id,
      title: this.extractRenderedContent(rawResponse.title),
      source_url: rawResponse.source_url,
      media_type: rawResponse.media_type,
      mime_type: rawResponse.mime_type,
      alt_text: this.extractRenderedContent(rawResponse.alt_text),
      caption: this.extractRenderedContent(rawResponse.caption),
      description: this.extractRenderedContent(rawResponse.description),
    };
  }

  /**
   * Upload image from URL (downloads and uploads to WordPress)
   */
  async uploadImageFromUrl(
    imageUrl: string,
    filename: string,
    options: MediaUploadOptions = {}
  ): Promise<WordPressMediaUpload> {
    try {
      // Download the image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status}`);
      }

      const imageBuffer = await response.arrayBuffer();
      const mimeType = response.headers.get('content-type') || 'image/jpeg';

      // Upload to WordPress
      return await this.uploadMedia(
        Buffer.from(imageBuffer),
        filename,
        mimeType,
        options
      );
    } catch (error) {
      throw new Error(`Failed to upload image from URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate and upload AI-generated image
   * This would integrate with image generation APIs like DALL-E, Midjourney, etc.
   */
  async generateAndUploadImage(
    prompt: string,
    filename: string,
    options: MediaUploadOptions = {}
  ): Promise<WordPressMediaUpload> {
    // For now, we'll use a placeholder service or return an error
    // In a real implementation, this would call an image generation API
    throw new Error(
      'Image generation not implemented yet. Please provide an image URL or file.'
    );
  }

  /**
   * Get media by ID
   */
  async getMedia(mediaId: number): Promise<WordPressMediaUpload> {
    const response = await fetch(`${this.baseUrl}/wp-json/wp/v2/media/${mediaId}`, {
      headers: {
        'Authorization': `Basic ${this.auth}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to get media: ${response.status} - ${
          errorData.message || response.statusText
        }`
      );
    }

    return await response.json();
  }

  /**
   * List media items
   */
  async listMedia(
    page: number = 1,
    perPage: number = 10,
    search?: string
  ): Promise<{ media: WordPressMediaUpload[]; totalPages: number }> {
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
    });

    if (search) {
      params.append('search', search);
    }

    const response = await fetch(
      `${this.baseUrl}/wp-json/wp/v2/media?${params}`,
      {
        headers: {
          'Authorization': `Basic ${this.auth}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to list media: ${response.status} - ${
          errorData.message || response.statusText
        }`
      );
    }

    const rawMedia = await response.json();
    const totalPages = parseInt(
      response.headers.get('X-WP-TotalPages') || '1'
    );

    // Transform WordPress API response to handle rendered properties
    const media = rawMedia.map((item: any) => ({
      id: item.id,
      title: this.extractRenderedContent(item.title),
      source_url: item.source_url,
      media_type: item.media_type,
      mime_type: item.mime_type,
      alt_text: this.extractRenderedContent(item.alt_text),
      caption: this.extractRenderedContent(item.caption),
      description: this.extractRenderedContent(item.description),
    }));

    return { media, totalPages };
  }

  /**
   * Delete media by ID
   */
  async deleteMedia(mediaId: number): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/wp-json/wp/v2/media/${mediaId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${this.auth}`,
        'Content-Type': 'application/json',
      },
    });

    return response.ok;
  }

  /**
   * Update media metadata
   */
  async updateMedia(
    mediaId: number,
    updates: Partial<MediaUploadOptions>
  ): Promise<WordPressMediaUpload> {
    const response = await fetch(`${this.baseUrl}/wp-json/wp/v2/media/${mediaId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${this.auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to update media: ${response.status} - ${
          errorData.message || response.statusText
        }`
      );
    }

    const rawResponse = await response.json();
    
    // Transform the response to handle WordPress API format
    return {
      id: rawResponse.id,
      title: this.extractRenderedContent(rawResponse.title),
      source_url: rawResponse.source_url,
      media_type: rawResponse.media_type,
      mime_type: rawResponse.mime_type,
      alt_text: this.extractRenderedContent(rawResponse.alt_text),
      caption: this.extractRenderedContent(rawResponse.caption),
      description: this.extractRenderedContent(rawResponse.description),
    };
  }
}

export default WordPressMediaService;
