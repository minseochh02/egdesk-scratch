import * as fs from 'fs';
import * as path from 'path';
import { WordPressPost, WordPressMedia } from './wordpress-sqlite-manager';

export interface ExportOptions {
  format: 'wordpress' | 'markdown' | 'html' | 'json';
  includeMedia: boolean;
  outputPath: string;
  siteId: string;
  siteName: string;
}

export class WordPressExportUtils {
  private sqliteManager: any; // Will be injected via dependency injection

  constructor(sqliteManager?: any) {
    this.sqliteManager = sqliteManager;
  }

  /**
   * Set the SQLite manager instance (for dependency injection)
   */
  setSQLiteManager(sqliteManager: any): void {
    this.sqliteManager = sqliteManager;
  }

  /**
   * Ensure SQLite manager is available
   */
  private ensureSQLiteManager(): void {
    if (!this.sqliteManager) {
      throw new Error('SQLite manager not initialized. Cannot perform export operations.');
    }
  }

  /**
   * Export WordPress data from SQLite to files
   */
  async exportToFiles(options: ExportOptions): Promise<{
    success: boolean;
    exportedFiles: string[];
    totalSize: number;
    error?: string;
  }> {
    try {
      this.ensureSQLiteManager();
      const { format, includeMedia, outputPath, siteId, siteName } = options;
      
      // Create output directory
      await fs.promises.mkdir(outputPath, { recursive: true });
      
      const exportedFiles: string[] = [];
      let totalSize = 0;

      // Get posts and media from SQLite
      const posts = this.sqliteManager.getPostsBySite(siteId);
      const media = includeMedia ? this.sqliteManager.getMediaBySite(siteId) : [];

      if (format === 'wordpress') {
        // Export as WordPress XML
        const xmlContent = this.generateWordPressXML(posts, siteName);
        const xmlPath = path.join(outputPath, 'wordpress-export.xml');
        await fs.promises.writeFile(xmlPath, xmlContent, 'utf8');
        exportedFiles.push(xmlPath);
        totalSize += Buffer.byteLength(xmlContent, 'utf8');

        // Export media files
        if (includeMedia) {
          const mediaDir = path.join(outputPath, 'media');
          await fs.promises.mkdir(mediaDir, { recursive: true });

          for (const mediaItem of media) {
            if (mediaItem.local_data) {
              const mediaPath = path.join(mediaDir, mediaItem.file_name);
              await fs.promises.writeFile(mediaPath, mediaItem.local_data);
              exportedFiles.push(mediaPath);
              totalSize += mediaItem.local_data.length;
            }
          }
        }

        // Create setup instructions
        const instructions = this.generateSetupInstructions(siteName, exportedFiles.length);
        const instructionsPath = path.join(outputPath, 'README-설정가이드.md');
        await fs.promises.writeFile(instructionsPath, instructions, 'utf8');
        exportedFiles.push(instructionsPath);
        totalSize += Buffer.byteLength(instructions, 'utf8');

      } else if (format === 'markdown') {
        // Export as individual Markdown files
        const postsDir = path.join(outputPath, 'posts');
        await fs.promises.mkdir(postsDir, { recursive: true });

        for (const post of posts) {
          const markdownContent = this.convertPostToMarkdown(post);
          const fileName = `${post.slug || post.id}.md`;
          const filePath = path.join(postsDir, fileName);
          await fs.promises.writeFile(filePath, markdownContent, 'utf8');
          exportedFiles.push(filePath);
          totalSize += Buffer.byteLength(markdownContent, 'utf8');
        }

        // Export media if requested
        if (includeMedia) {
          const mediaDir = path.join(outputPath, 'media');
          await fs.promises.mkdir(mediaDir, { recursive: true });

          for (const mediaItem of media) {
            if (mediaItem.local_data) {
              const mediaPath = path.join(mediaDir, mediaItem.file_name);
              await fs.promises.writeFile(mediaPath, mediaItem.local_data);
              exportedFiles.push(mediaPath);
              totalSize += mediaItem.local_data.length;
            }
          }
        }

      } else if (format === 'html') {
        // Export as HTML files
        const postsDir = path.join(outputPath, 'posts');
        await fs.promises.mkdir(postsDir, { recursive: true });

        for (const post of posts) {
          const htmlContent = this.convertPostToHTML(post);
          const fileName = `${post.slug || post.id}.html`;
          const filePath = path.join(postsDir, fileName);
          await fs.promises.writeFile(filePath, htmlContent, 'utf8');
          exportedFiles.push(filePath);
          totalSize += Buffer.byteLength(htmlContent, 'utf8');
        }

        // Export media if requested
        if (includeMedia) {
          const mediaDir = path.join(outputPath, 'media');
          await fs.promises.mkdir(mediaDir, { recursive: true });

          for (const mediaItem of media) {
            if (mediaItem.local_data) {
              const mediaPath = path.join(mediaDir, mediaItem.file_name);
              await fs.promises.writeFile(mediaPath, mediaItem.local_data);
              exportedFiles.push(mediaPath);
              totalSize += mediaItem.local_data.length;
            }
          }
        }

      } else if (format === 'json') {
        // Export as JSON
        const exportData = {
          site: {
            id: siteId,
            name: siteName,
            exported_at: new Date().toISOString()
          },
          posts: posts.map((post: WordPressPost) => ({
            ...post,
            meta: JSON.parse(post.meta || '{}')
          })),
          media: media.map((mediaItem: WordPressMedia) => ({
            ...mediaItem,
            local_data: mediaItem.local_data ? 'base64:' + mediaItem.local_data.toString('base64') : null
          }))
        };

        const jsonPath = path.join(outputPath, 'wordpress-export.json');
        await fs.promises.writeFile(jsonPath, JSON.stringify(exportData, null, 2), 'utf8');
        exportedFiles.push(jsonPath);
        totalSize += Buffer.byteLength(JSON.stringify(exportData), 'utf8');
      }

      return {
        success: true,
        exportedFiles,
        totalSize
      };

    } catch (error) {
      console.error('Error exporting WordPress data:', error);
      return {
        success: false,
        exportedFiles: [],
        totalSize: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate WordPress XML export
   */
  private generateWordPressXML(posts: WordPressPost[], siteName: string): string {
    const exportDate = new Date().toISOString();
    
    let xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0"
	xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
	xmlns:content="http://purl.org/rss/1.0/modules/content/"
	xmlns:wfw="http://wellformedweb.org/CommentAPI/"
	xmlns:dc="http://purl.org/dc/elements/1.1/"
	xmlns:wp="http://wordpress.org/export/1.2/">

<channel>
	<title>${siteName}</title>
	<link>https://example.com</link>
	<description>WordPress Export</description>
	<pubDate>${exportDate}</pubDate>
	<language>ko-KR</language>
	<wp:wxr_version>1.2</wp:wxr_version>
	<wp:base_site_url>https://example.com</wp:base_site_url>
	<wp:base_blog_url>https://example.com</wp:base_blog_url>

	<wp:author>
		<wp:author_id>1</wp:author_id>
		<wp:author_login>admin</wp:author_login>
		<wp:author_email>admin@example.com</wp:author_email>
		<wp:author_display_name>Administrator</wp:author_display_name>
		<wp:author_first_name></wp:author_first_name>
		<wp:author_last_name></wp:author_last_name>
	</wp:author>

`;

    // Add posts
    for (const post of posts) {
      xml += `	<item>
		<title><![CDATA[${post.title}]]></title>
		<link>${post.link}</link>
		<pubDate>${post.date}</pubDate>
		<dc:creator><![CDATA[admin]]></dc:creator>
		<guid isPermaLink="false">${post.guid}</guid>
		<description></description>
		<content:encoded><![CDATA[${post.content}]]></content:encoded>
		<excerpt:encoded><![CDATA[${post.excerpt}]]></excerpt:encoded>
		<wp:post_id>${post.id}</wp:post_id>
		<wp:post_date>${post.date}</wp:post_date>
		<wp:post_date_gmt>${post.date_gmt}</wp:post_date_gmt>
		<wp:post_modified>${post.modified}</wp:post_modified>
		<wp:post_modified_gmt>${post.modified_gmt}</wp:post_modified_gmt>
		<wp:comment_status>${post.comment_status}</wp:comment_status>
		<wp:ping_status>${post.ping_status}</wp:ping_status>
		<wp:post_name>${post.slug}</wp:post_name>
		<wp:status>${post.status}</wp:status>
		<wp:post_parent>${post.parent}</wp:post_parent>
		<wp:menu_order>${post.menu_order}</wp:menu_order>
		<wp:post_type>${post.type}</wp:post_type>
		<wp:post_password></wp:post_password>
		<wp:is_sticky>0</wp:is_sticky>
		<wp:post_meta>
			<wp:meta_key>_edit_last</wp:meta_key>
			<wp:meta_value><![CDATA[1]]></wp:meta_value>
		</wp:post_meta>
	</item>

`;
    }

    xml += `</channel>
</rss>`;

    return xml;
  }

  /**
   * Convert post to Markdown
   */
  private convertPostToMarkdown(post: WordPressPost): string {
    const frontMatter = `---
title: "${post.title}"
slug: "${post.slug}"
date: "${post.date}"
modified: "${post.modified}"
status: "${post.status}"
type: "${post.type}"
excerpt: "${post.excerpt}"
---

`;

    // Convert HTML content to Markdown (basic conversion)
    let markdownContent = post.content
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
      .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n')
      .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n')
      .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
      .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
      .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)')
      .replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)')
      .replace(/<ul[^>]*>(.*?)<\/ul>/gis, (match, content) => {
        return content.replace(/<li[^>]*>(.*?)<\/li>/gis, '- $1\n');
      })
      .replace(/<ol[^>]*>(.*?)<\/ol>/gis, (match, content) => {
        let counter = 1;
        return content.replace(/<li[^>]*>(.*?)<\/li>/gis, () => `${counter++}. $1\n`);
      })
      .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (match, content) => {
        return content.split('\n').map((line: string) => `> ${line}`).join('\n') + '\n';
      })
      .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
      .replace(/<pre[^>]*>(.*?)<\/pre>/gis, (match, content) => {
        return '```\n' + content + '\n```\n';
      })
      .replace(/<[^>]*>/g, '') // Remove remaining HTML tags
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Clean up multiple newlines
      .trim();

    return frontMatter + markdownContent;
  }

  /**
   * Convert post to HTML
   */
  private convertPostToHTML(post: WordPressPost): string {
    return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${post.title}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
        h1, h2, h3, h4, h5, h6 { color: #333; }
        .post-meta { color: #666; font-size: 0.9em; margin-bottom: 20px; }
        .post-content { margin-top: 20px; }
    </style>
</head>
<body>
    <article>
        <header>
            <h1>${post.title}</h1>
            <div class="post-meta">
                <time datetime="${post.date}">${new Date(post.date).toLocaleDateString('ko-KR')}</time>
                <span> • </span>
                <span>상태: ${post.status}</span>
            </div>
        </header>
        <div class="post-content">
            ${post.content}
        </div>
    </article>
</body>
</html>`;
  }

  /**
   * Export posts to WordPress XML format
   */
  async exportPostsToWordPressXML(siteId: string, outputPath: string): Promise<{
    success: boolean;
    filePath?: string;
    error?: string;
  }> {
    try {
      this.ensureSQLiteManager();
      
      const posts = this.sqliteManager.getPostsBySite(siteId);
      const siteName = `Site ${siteId}`;
      
      const xmlContent = this.generateWordPressXML(posts, siteName);
      const filePath = path.join(outputPath, 'wordpress-export.xml');
      
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, xmlContent, 'utf8');
      
      return { success: true, filePath };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Export posts to Markdown format
   */
  async exportPostsToMarkdown(siteId: string, outputPath: string): Promise<{
    success: boolean;
    exportedFiles: string[];
    error?: string;
  }> {
    try {
      this.ensureSQLiteManager();
      
      const posts = this.sqliteManager.getPostsBySite(siteId);
      const exportedFiles: string[] = [];
      
      await fs.promises.mkdir(outputPath, { recursive: true });
      
      for (const post of posts) {
        const filename = `${post.slug || post.id}.md`;
        const filePath = path.join(outputPath, filename);
        const markdownContent = this.generateMarkdownPost(post);
        
        await fs.promises.writeFile(filePath, markdownContent, 'utf8');
        exportedFiles.push(filePath);
      }
      
      return { success: true, exportedFiles };
    } catch (error) {
      return { 
        success: false, 
        exportedFiles: [],
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Export posts to HTML format
   */
  async exportPostsToHTML(siteId: string, outputPath: string): Promise<{
    success: boolean;
    exportedFiles: string[];
    error?: string;
  }> {
    try {
      this.ensureSQLiteManager();
      
      const posts = this.sqliteManager.getPostsBySite(siteId);
      const exportedFiles: string[] = [];
      
      await fs.promises.mkdir(outputPath, { recursive: true });
      
      for (const post of posts) {
        const filename = `${post.slug || post.id}.html`;
        const filePath = path.join(outputPath, filename);
        const htmlContent = this.generateHTMLPost(post);
        
        await fs.promises.writeFile(filePath, htmlContent, 'utf8');
        exportedFiles.push(filePath);
      }
      
      return { success: true, exportedFiles };
    } catch (error) {
      return { 
        success: false, 
        exportedFiles: [],
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Export posts to JSON format
   */
  async exportPostsToJSON(siteId: string, outputPath: string): Promise<{
    success: boolean;
    filePath?: string;
    error?: string;
  }> {
    try {
      this.ensureSQLiteManager();
      
      const posts = this.sqliteManager.getPostsBySite(siteId);
      const media = this.sqliteManager.getMediaBySite(siteId);
      
      const jsonData = {
        posts,
        media,
        exportedAt: new Date().toISOString(),
        siteId
      };
      
      const filePath = path.join(outputPath, 'posts-export.json');
      
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, JSON.stringify(jsonData, null, 2), 'utf8');
      
      return { success: true, filePath };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Generate Markdown content for a post
   */
  private generateMarkdownPost(post: WordPressPost): string {
    let markdown = `# ${post.title}\n\n`;
    
    if (post.excerpt) {
      markdown += `> ${post.excerpt}\n\n`;
    }
    
    markdown += `**Status:** ${post.status}  \n`;
    markdown += `**Type:** ${post.type}  \n`;
    markdown += `**Date:** ${new Date(post.date).toLocaleDateString()}  \n`;
    
    if (post.link) {
      markdown += `**Original URL:** [${post.link}](${post.link})  \n`;
    }
    
    markdown += `\n---\n\n`;
    
    // Convert HTML content to basic markdown (simple conversion)
    let content = post.content || '';
    content = content.replace(/<h([1-6])>/g, (match, level) => '#'.repeat(parseInt(level)) + ' ');
    content = content.replace(/<\/h[1-6]>/g, '\n\n');
    content = content.replace(/<p>/g, '').replace(/<\/p>/g, '\n\n');
    content = content.replace(/<br\s*\/?>/g, '\n');
    content = content.replace(/<strong>(.*?)<\/strong>/g, '**$1**');
    content = content.replace(/<em>(.*?)<\/em>/g, '*$1*');
    content = content.replace(/<[^>]*>/g, ''); // Remove remaining HTML tags
    
    markdown += content;
    
    return markdown;
  }

  /**
   * Generate HTML content for a post
   */
  private generateHTMLPost(post: WordPressPost): string {
    return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${post.title}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
        .meta { color: #666; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
        .content { margin-top: 20px; }
        .excerpt { background: #f5f5f5; padding: 15px; border-left: 4px solid #007cba; margin: 20px 0; font-style: italic; }
    </style>
</head>
<body>
    <article>
        <header>
            <h1>${post.title}</h1>
            <div class="meta">
                <p><strong>Status:</strong> ${post.status}</p>
                <p><strong>Type:</strong> ${post.type}</p>
                <p><strong>Date:</strong> ${new Date(post.date).toLocaleDateString()}</p>
                ${post.link ? `<p><strong>Original URL:</strong> <a href="${post.link}">${post.link}</a></p>` : ''}
            </div>
        </header>
        
        ${post.excerpt ? `<div class="excerpt">${post.excerpt}</div>` : ''}
        
        <div class="content">
            ${post.content || ''}
        </div>
    </article>
</body>
</html>`;
  }

  /**
   * Generate setup instructions
   */
  private generateSetupInstructions(siteName: string, fileCount: number): string {
    return `# ${siteName} - WordPress 로컬 테스트 가이드

## 📁 내보낸 파일
- **wordpress-export.xml**: WordPress 가져오기용 XML 파일
- **media/**: 다운로드된 미디어 파일들 (${fileCount}개 파일)

## 🚀 로컬 WordPress 설정 방법

### 1. 로컬 WordPress 환경 설정
- XAMPP, WAMP, MAMP 또는 Local by Flywheel 설치
- 새로운 WordPress 사이트 생성

### 2. 콘텐츠 가져오기
1. WordPress 관리자 페이지 접속
2. **도구 > 가져오기** 메뉴 선택
3. **WordPress** 선택 후 플러그인 설치
4. **wordpress-export.xml** 파일 업로드
5. 작성자 설정 후 가져오기 실행

### 3. 미디어 파일 업로드
1. **media/** 폴더의 모든 파일을
2. **/wp-content/uploads/** 디렉토리에 복사

### 4. 테스트
- 포스트와 미디어가 정상적으로 표시되는지 확인

---
*EGDesk WordPress Connector로 생성됨 - ${new Date().toLocaleString('ko-KR')}*
`;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.sqliteManager.close();
  }
}
