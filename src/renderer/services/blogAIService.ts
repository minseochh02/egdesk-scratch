import { ChatService } from '../components/ChatInterface/services/chatService';
import { AIKey } from '../components/AIKeysManager/types';
import { ChatMessage } from '../components/ChatInterface/types';

export interface BlogContentRequest {
  category: string;
  topic: string;
  keywords: string[];
  audience: string;
  tone: string;
  length: string;
  aiKey: AIKey;
  model: string;
}

export interface GeneratedBlogContent {
  title: string;
  content: string;
  excerpt: string;
  tags: string[];
  categories: string[];
  seoTitle: string;
  metaDescription: string;
}

export class BlogAIService {
  private static instance: BlogAIService;

  private constructor() {}

  static getInstance(): BlogAIService {
    if (!BlogAIService.instance) {
      BlogAIService.instance = new BlogAIService();
    }
    return BlogAIService.instance;
  }

  /**
   * Generate blog content using AI based on the provided parameters
   */
  async generateBlogContent(request: BlogContentRequest): Promise<GeneratedBlogContent> {
    try {
      console.log('🤖 Generating blog content with AI:', {
        category: request.category,
        topic: request.topic,
        keywords: request.keywords,
        audience: request.audience,
        model: request.model
      });

      const systemPrompt = this.buildSystemPrompt(request);
      const userPrompt = this.buildUserPrompt(request);

      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: userPrompt
        }
      ];

      const response = await ChatService.sendMessage(
        request.aiKey,
        request.model,
        messages,
        {
          temperature: 0.7,
          maxTokens: 4000,
          systemPrompt
        }
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to generate content');
      }

      return this.parseGeneratedContent(response.message, request);
    } catch (error) {
      console.error('❌ Blog content generation failed:', error);
      throw error;
    }
  }

  /**
   * Build system prompt for blog content generation
   */
  private buildSystemPrompt(request: BlogContentRequest): string {
    return `You are an expert blog writer and content creator. Your task is to create high-quality, engaging blog posts that are optimized for SEO and user engagement.

## Writing Guidelines:
- Write in Korean (한국어)
- Use a ${request.tone} tone
- Target audience: ${request.audience}
- Target length: ${request.length}
- Include practical examples and actionable advice
- Use proper headings and structure
- Make content engaging and easy to read
- Include relevant keywords naturally

## Content Structure:
1. Compelling title that includes main keywords
2. Brief excerpt/summary (2-3 sentences)
3. Well-structured content with clear headings
4. Practical examples and actionable tips
5. Natural keyword integration
6. Engaging conclusion with call-to-action

## Image Requirements:
- Suggest appropriate images for the blog post
- Provide detailed image descriptions for AI image generation
- Include image placement suggestions within the content
- Ensure images are relevant to the content and enhance readability
- Use specific image insertion markers in the content: [IMAGE:description:placement]
- Place images strategically throughout the content to break up text and enhance readability

## SEO Requirements:
- Include primary keywords in title and headings
- Use secondary keywords naturally throughout content
- Create meta description (150-160 characters)
- Suggest relevant tags and categories

## Output Format:
Return your response in the following JSON format:
{
  "title": "Blog post title",
  "content": "Full blog post content in HTML format with [IMAGE:description:placement] markers",
  "excerpt": "Brief summary of the post",
  "tags": ["tag1", "tag2", "tag3"],
  "categories": ["category1", "category2"],
  "seoTitle": "SEO optimized title",
  "metaDescription": "Meta description for search engines"
}

## Image Marker Format:
Use [IMAGE:description:placement] markers in your content where images should be inserted:
- [IMAGE:A professional headshot of a business person:header] - for header images
- [IMAGE:A detailed infographic showing the process:content] - for content images
- [IMAGE:A call-to-action banner:footer] - for footer images
- [IMAGE:A featured image representing the main topic:featured] - for featured images`;
  }

  /**
   * Build user prompt with specific requirements
   */
  private buildUserPrompt(request: BlogContentRequest): string {
    return `Please create a blog post with the following specifications:

**Category:** ${request.category}
**Topic:** ${request.topic}
**Keywords:** ${request.keywords.join(', ')}
**Audience:** ${request.audience}
**Tone:** ${request.tone}
**Target Length:** ${request.length}

**Requirements:**
- Write engaging, informative content that provides real value
- Include practical examples and actionable advice
- Use proper HTML formatting for headings, paragraphs, and lists
- Integrate keywords naturally without keyword stuffing
- Make it SEO-friendly and user-friendly
- Include a compelling call-to-action at the end

**Content Focus:**
- Provide practical, actionable information
- Include real-world examples and case studies when relevant
- Address common questions and pain points
- Offer step-by-step guidance where appropriate
- Make it shareable and engaging

Please generate the content following the JSON format specified in the system prompt.`;
  }

  /**
   * Parse AI-generated content into structured format
   */
  private parseGeneratedContent(content: string, request: BlogContentRequest): GeneratedBlogContent {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Process image markers in content
        const processedContent = this.processImageMarkers(parsed.content || content);
        const extractedImages = this.extractImagesFromContent(parsed.content || content);
        
        return {
          title: parsed.title || request.topic,
          content: processedContent,
          excerpt: parsed.excerpt || this.generateExcerpt(processedContent),
          tags: parsed.tags || request.keywords,
          categories: parsed.categories || [request.category],
          seoTitle: parsed.seoTitle || parsed.title || request.topic,
          metaDescription: parsed.metaDescription || this.generateMetaDescription(processedContent)
        };
      }
    } catch (error) {
      console.warn('Failed to parse JSON response, using fallback parsing:', error);
    }

    // Fallback parsing if JSON extraction fails
    const processedContent = this.processImageMarkers(content);
    const extractedImages = this.extractImagesFromContent(content);
    
    return {
      title: this.extractTitle(content) || request.topic,
      content: processedContent,
      excerpt: this.generateExcerpt(processedContent),
      tags: request.keywords,
      categories: [request.category],
      seoTitle: this.extractTitle(content) || request.topic,
      metaDescription: this.generateMetaDescription(processedContent)
    };
  }

  /**
   * Extract title from content
   */
  private extractTitle(content: string): string {
    const titleMatch = content.match(/<h1[^>]*>(.*?)<\/h1>/i) || 
                      content.match(/^#\s+(.+)$/m) ||
                      content.match(/^(.+)$/m);
    return titleMatch ? titleMatch[1].trim() : '';
  }

  /**
   * Generate excerpt from content
   */
  private generateExcerpt(content: string): string {
    // Remove HTML tags and get first 150 characters
    const plainText = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    return plainText.length > 150 ? plainText.substring(0, 150) + '...' : plainText;
  }

  /**
   * Generate meta description from content
   */
  private generateMetaDescription(content: string): string {
    const plainText = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    return plainText.length > 160 ? plainText.substring(0, 160) + '...' : plainText;
  }

  /**
   * Process image markers in content and convert them to HTML placeholders
   */
  private processImageMarkers(content: string): string {
    if (!content) return content;
    
    // Replace [IMAGE:description:placement] markers with HTML placeholders
    const imageMarkerRegex = /\[IMAGE:([^:]+):([^\]]+)\]/g;
    let imageIndex = 0;
    
    return content.replace(imageMarkerRegex, (match, description, placement) => {
      imageIndex++;
      const imageId = `image_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      return `<div class="image-placeholder" data-image-id="${imageId}" data-image-index="${imageIndex}" data-description="${description.trim()}" data-placement="${placement.trim()}">
        <div class="image-placeholder-content">
          <div class="image-placeholder-icon">🖼️</div>
          <div class="image-placeholder-text">
            <strong>이미지 순서:</strong> ${imageIndex}<br>
            <strong>이미지 위치:</strong> ${placement.trim()}<br>
            <strong>설명:</strong> ${description.trim()}
          </div>
        </div>
      </div>`;
    });
  }

  /**
   * Extract image information from content markers
   */
  private extractImagesFromContent(content: string): Array<{
    description: string;
    altText: string;
    caption: string;
    placement: string;
  }> {
    if (!content) return [];
    
    const images = [];
    const imageMarkerRegex = /\[IMAGE:([^:]+):([^\]]+)\]/g;
    let match;
    
    while ((match = imageMarkerRegex.exec(content)) !== null) {
      const description = match[1].trim();
      const placement = match[2].trim();
      
      images.push({
        description: description,
        altText: description,
        caption: description,
        placement: placement
      });
    }
    
    return images;
  }

  /**
   * Generate content for a specific template type
   */
  async generateTemplateContent(
    templateType: string,
    request: BlogContentRequest
  ): Promise<GeneratedBlogContent> {
    // Use default prompt since built-in templates are removed
    const templatePrompt = 'Create an engaging blog post on the given topic.';

    const enhancedRequest = {
      ...request,
      topic: `${templatePrompt} Topic: ${request.topic}`
    };

    return this.generateBlogContent(enhancedRequest);
  }
}

export default BlogAIService;
