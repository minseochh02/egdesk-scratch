import WordPressMediaService from './wordpressMediaService';
import { aiKeysStore } from '../components/AIKeysManager/store/aiKeysStore';
import { AIKey } from '../components/AIKeysManager/types';

export interface BlogImageRequest {
  title: string;
  content: string;
  excerpt?: string;
  keywords?: string[];
  category?: string;
  style?: 'realistic' | 'illustration' | 'minimalist' | 'artistic' | 'photographic';
  aspectRatio?: 'square' | 'landscape' | 'portrait' | 'wide';
  count?: number; // Number of images to generate
  customPrompts?: string[]; // Custom image prompts
}

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  description: string;
  altText: string;
  caption: string;
  placement: 'featured' | 'header' | 'content' | 'footer';
  style: string;
  aspectRatio: string;
}

export interface ImageGenerationOptions {
  provider: 'openai' | 'stability' | 'midjourney' | 'dalle' | 'placeholder';
  apiKey?: string;
  model?: string;
  size?: string;
  quality?: 'standard' | 'hd';
  style?: string;
}

export class BlogImageGenerator {
  private mediaService: WordPressMediaService;
  private options: ImageGenerationOptions;

  constructor(
    mediaService: WordPressMediaService,
    options: ImageGenerationOptions = {
      provider: 'dalle',
      quality: 'standard',
      size: '1024x1024'
    }
  ) {
    this.mediaService = mediaService;
    this.options = options;
  }

  /**
   * Get available AI keys for prompt generation
   */
  private getAvailableAIKeys(): { openai?: AIKey; gemini?: AIKey } {
    const openaiKeys = aiKeysStore.getKeysByProvider('openai').filter(key => key.isActive);
    const geminiKeys = aiKeysStore.getKeysByProvider('google').filter(key => key.isActive);
    
    return {
      openai: openaiKeys[0],
      gemini: geminiKeys[0]
    };
  }

  /**
   * Generate AI-powered image prompt using OpenAI or Gemini
   */
  private async generateAIImagePrompt(
    context: {
      title: string;
      excerpt: string;
      keywords?: string[];
      category?: string;
      style: string;
      type: 'featured' | 'header' | 'content';
    }
  ): Promise<string> {
    const { openai, gemini } = this.getAvailableAIKeys();
    
    // Try OpenAI first, then Gemini, then fallback to basic prompt
    if (openai) {
      try {
        return await this.generatePromptWithOpenAI(openai, context);
      } catch (error) {
        console.warn('OpenAI prompt generation failed:', error);
      }
    }
    
    if (gemini) {
      try {
        return await this.generatePromptWithGemini(gemini, context);
      } catch (error) {
        console.warn('Gemini prompt generation failed:', error);
      }
    }
    
    // Fallback to basic prompt generation
    return this.generateBasicImagePrompt(context);
  }

  /**
   * Generate prompt using OpenAI
   */
  private async generatePromptWithOpenAI(
    key: AIKey,
    context: {
      title: string;
      excerpt: string;
      keywords?: string[];
      category?: string;
      style: string;
      type: 'featured' | 'header' | 'content';
    }
  ): Promise<string> {
    const { apiKey } = key.fields;
    const { organization } = key.fields;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    if (organization) {
      headers['OpenAI-Organization'] = organization;
    }

    const systemPrompt = `You are an expert image prompt generator for blog posts. Create detailed, specific prompts that will generate high-quality images for blog content.

Guidelines:
- Be specific and descriptive
- Include visual style, composition, lighting, and mood
- Consider the blog post context and target audience
- Use professional photography and design terminology
- Make prompts actionable for AI image generators
- Keep prompts under 200 words
- Focus on visual elements that would make the image engaging and relevant`;

    const userPrompt = `Create an image prompt for a blog post with these details:

Title: "${context.title}"
Content excerpt: "${context.excerpt}"
Category: ${context.category || 'General'}
Style: ${context.style}
Image type: ${context.type}
Keywords: ${context.keywords?.join(', ') || 'None'}

Generate a detailed, specific prompt that would create an engaging ${context.type} image for this blog post.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content?.trim() || this.generateBasicImagePrompt(context);
  }

  /**
   * Generate prompt using Gemini
   */
  private async generatePromptWithGemini(
    key: AIKey,
    context: {
      title: string;
      excerpt: string;
      keywords?: string[];
      category?: string;
      style: string;
      type: 'featured' | 'header' | 'content';
    }
  ): Promise<string> {
    const { apiKey } = key.fields;

    const systemPrompt = `You are an expert image prompt generator for blog posts. Create detailed, specific prompts that will generate high-quality images for blog content.

Guidelines:
- Be specific and descriptive
- Include visual style, composition, lighting, and mood
- Consider the blog post context and target audience
- Use professional photography and design terminology
- Make prompts actionable for AI image generators
- Keep prompts under 200 words
- Focus on visual elements that would make the image engaging and relevant`;

    const userPrompt = `Create an image prompt for a blog post with these details:

Title: "${context.title}"
Content excerpt: "${context.excerpt}"
Category: ${context.category || 'General'}
Style: ${context.style}
Image type: ${context.type}
Keywords: ${context.keywords?.join(', ') || 'None'}

Generate a detailed, specific prompt that would create an engaging ${context.type} image for this blog post.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `${systemPrompt}\n\n${userPrompt}`
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 300,
        }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || this.generateBasicImagePrompt(context);
  }

  /**
   * Generate images for a blog post based on content analysis
   */
  async generateBlogImages(
    blogRequest: BlogImageRequest,
    wordpressSite: { url: string; username: string; password: string }
  ): Promise<GeneratedImage[]> {
    try {
      // Analyze blog content to determine image needs
      const imageRequirements = this.analyzeContentForImages(blogRequest);
      
      // Generate images based on requirements
      const generatedImages: GeneratedImage[] = [];
      
      for (const requirement of imageRequirements) {
        try {
          const image = await this.generateSingleImage(requirement, blogRequest);
          if (image) {
            generatedImages.push(image);
          }
        } catch (error) {
          console.error(`Failed to generate image for ${requirement.placement}:`, error);
        }
      }

      // Upload images to WordPress if media service is available
      if (this.mediaService) {
        const uploadedImages = await this.uploadImagesToWordPress(generatedImages, wordpressSite);
        return uploadedImages;
      }

      return generatedImages;
    } catch (error) {
      throw new Error(`Failed to generate blog images: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate images and process content with image placeholders
   */
  async generateBlogImagesWithContent(
    blogRequest: BlogImageRequest,
    wordpressSite: { url: string; username: string; password: string }
  ): Promise<{
    images: GeneratedImage[];
    processedContent: string;
  }> {
    try {
      // Generate images
      const generatedImages = await this.generateBlogImages(blogRequest, wordpressSite);
      
      // Process content to replace placeholders with actual images
      const processedContent = this.replaceImagePlaceholders(blogRequest.content, generatedImages);
      
      return {
        images: generatedImages,
        processedContent: processedContent
      };
    } catch (error) {
      throw new Error(`Failed to generate blog images with content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate images without uploading to WordPress (to avoid CORS issues)
   */
  async generateBlogImagesWithoutUpload(blogRequest: BlogImageRequest): Promise<GeneratedImage[]> {
    try {
      // Analyze blog content to determine image needs
      const imageRequirements = this.analyzeContentForImages(blogRequest);
      
      // Generate images based on requirements
      const generatedImages: GeneratedImage[] = [];
      
      for (const requirement of imageRequirements) {
        try {
          const image = await this.generateSingleImage(requirement, blogRequest);
          if (image) {
            generatedImages.push(image);
          }
        } catch (error) {
          console.error(`Failed to generate image for ${requirement.placement}:`, error);
        }
      }

      // Return images without uploading to WordPress
      return generatedImages;
    } catch (error) {
      throw new Error(`Failed to generate blog images: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze blog content to determine what images are needed
   */
  private analyzeContentForImages(blogRequest: BlogImageRequest): Array<{
    placement: 'featured' | 'header' | 'content' | 'footer';
    description: string;
    prompt: string;
    style: string;
    aspectRatio: string;
  }> {
    const requirements: Array<{
      placement: 'featured' | 'header' | 'content' | 'footer';
      description: string;
      prompt: string;
      style: string;
      aspectRatio: string;
    }> = [];
    const { title, content, excerpt, keywords, category, style, aspectRatio, customPrompts } = blogRequest;

    // First, check for image markers in content
    const imageMarkers = this.extractImageMarkersFromContent(content);
    
    if (imageMarkers.length > 0) {
      // Use image markers from content
      imageMarkers.forEach((marker, index) => {
        requirements.push({
          placement: marker.placement as 'featured' | 'header' | 'content' | 'footer',
          description: marker.description,
          prompt: marker.description, // Use description as prompt
          style: style || 'realistic',
          aspectRatio: this.getAspectRatioForPlacement(marker.placement) || aspectRatio || 'landscape'
        });
      });
      return requirements;
    }

    // If custom prompts are provided, use them
    if (customPrompts && customPrompts.length > 0) {
      customPrompts.forEach((prompt, index) => {
        const placements: ('featured' | 'header' | 'content' | 'footer')[] = ['featured', 'header', 'content', 'footer'];
        const placement = placements[index] || 'content';
        
        requirements.push({
          placement,
          description: `Custom image ${index + 1} for "${title}"`,
          prompt: prompt.trim(),
          style: style || 'realistic',
          aspectRatio: aspectRatio || 'landscape'
        });
      });
      return requirements;
    }

    // Fallback: Generate featured image (always needed)
    const featuredPrompt = this.generateBasicImagePrompt({
      title,
      excerpt: excerpt || content.substring(0, 200),
      keywords,
      category,
      style: style || 'realistic',
      type: 'featured'
    });

    requirements.push({
      placement: 'featured',
      description: `Featured image for "${title}"`,
      prompt: featuredPrompt,
      style: style || 'realistic',
      aspectRatio: aspectRatio || 'landscape'
    });

    // Add header image if content is long enough
    if (content.length > 1000) {
      const headerPrompt = this.generateBasicImagePrompt({
        title,
        excerpt: content.substring(0, 300),
        keywords,
        category,
        style: style || 'realistic',
        type: 'header'
      });

      requirements.push({
        placement: 'header',
        description: `Header image for "${title}"`,
        prompt: headerPrompt,
        style: style || 'realistic',
        aspectRatio: 'wide'
      });
    }

    return requirements;
  }

  /**
   * Extract image markers from content
   */
  private extractImageMarkersFromContent(content: string): Array<{
    description: string;
    placement: string;
  }> {
    const markers: Array<{ description: string; placement: string }> = [];
    
    if (!content) return markers;
    
    // Look for [IMAGE:description:placement] markers
    const imageMarkerRegex = /\[IMAGE:([^:]+):([^\]]+)\]/g;
    let match;
    
    while ((match = imageMarkerRegex.exec(content)) !== null) {
      markers.push({
        description: match[1].trim(),
        placement: match[2].trim()
      });
    }
    
    return markers;
  }

  /**
   * Get appropriate aspect ratio for image placement
   */
  private getAspectRatioForPlacement(placement: string): string {
    switch (placement.toLowerCase()) {
      case 'featured':
        return 'landscape';
      case 'header':
        return 'wide';
      case 'content':
        return 'landscape';
      case 'footer':
        return 'wide';
      default:
        return 'landscape';
    }
  }

  /**
   * Analyze content structure to identify sections that need images
   */
  private analyzeContentStructure(content: string): {
    sections: Array<{
      content: string;
      needsImage: boolean;
    }>;
  } {
    const sections = [];
    
    // Split content by headings (h1, h2, h3)
    const headingRegex = /<(h[1-3])[^>]*>(.*?)<\/h[1-3]>/gi;
    const parts = content.split(headingRegex);
    
    let currentSection = { content: '', needsImage: false };
    
    for (let i = 0; i < parts.length; i += 3) {
      const beforeHeading = parts[i];
      const headingTag = parts[i + 1];
      const headingText = parts[i + 2];
      
      if (beforeHeading && beforeHeading.trim()) {
        currentSection.content += beforeHeading;
      }
      
      if (headingTag && headingText) {
        // Save previous section
        if (currentSection.content.trim()) {
          currentSection.needsImage = this.shouldSectionHaveImage(currentSection.content);
          sections.push(currentSection);
        }
        
        // Start new section
        currentSection = {
          content: '',
          needsImage: false
        };
      }
    }
    
    // Add final section
    if (currentSection.content.trim()) {
      currentSection.needsImage = this.shouldSectionHaveImage(currentSection.content);
      sections.push(currentSection);
    }
    
    return { sections };
  }

  /**
   * Determine if a content section should have an image
   */
  private shouldSectionHaveImage(content: string): boolean {
    const cleanContent = content.replace(/<[^>]*>/g, '').toLowerCase();
    
    // Check for image-related keywords
    const imageKeywords = [
      'image', 'photo', 'picture', 'graphic', 'diagram', 'chart',
      'illustration', 'visual', 'screenshot', 'example', 'demo',
      'show', 'display', 'see', 'look', 'view'
    ];
    
    const hasImageKeywords = imageKeywords.some(keyword => 
      cleanContent.includes(keyword)
    );
    
    // Check content length (longer sections are more likely to need images)
    const isLongEnough = cleanContent.length > 200;
    
    // Check for lists or structured content
    const hasStructuredContent = /<ul>|<ol>|<table>|<blockquote>/i.test(content);
    
    return hasImageKeywords || (isLongEnough && hasStructuredContent);
  }

  /**
   * Generate a single image based on requirements
   */
  private async generateSingleImage(
    requirement: {
      placement: string;
      description: string;
      prompt: string;
      style: string;
      aspectRatio: string;
    },
    blogRequest: BlogImageRequest
  ): Promise<GeneratedImage | null> {
    try {
      let imageUrl: string;
      let actualPrompt = requirement.prompt;

      switch (this.options.provider) {
        case 'openai':
        case 'dalle':
          imageUrl = await this.generateWithOpenAI(actualPrompt, requirement.aspectRatio);
          break;
        case 'stability':
          imageUrl = await this.generateWithStabilityAI(actualPrompt, requirement.aspectRatio);
          break;
        case 'midjourney':
          imageUrl = await this.generateWithMidjourney(actualPrompt, requirement.aspectRatio);
          break;
        case 'placeholder':
        default:
          imageUrl = await this.generatePlaceholderImage(actualPrompt, requirement.aspectRatio);
          break;
      }

      return {
        id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        url: imageUrl,
        prompt: actualPrompt,
        description: requirement.description,
        altText: this.generateAltText(blogRequest.title, requirement.placement),
        caption: this.generateCaption(blogRequest.title, requirement.placement),
        placement: requirement.placement as any,
        style: requirement.style,
        aspectRatio: requirement.aspectRatio
      };
    } catch (error) {
      console.error('Failed to generate image:', error);
      return null;
    }
  }

  /**
   * Generate image prompt based on blog content
   */
  private async generateImagePrompt(context: {
    title: string;
    excerpt: string;
    keywords?: string[];
    category?: string;
    style: string;
    type: 'featured' | 'header' | 'content';
  }): Promise<string> {
    // Use AI-powered prompt generation if available
    try {
      return await this.generateAIImagePrompt(context);
    } catch (error) {
      console.warn('AI prompt generation failed, using basic prompt:', error);
      return this.generateBasicImagePrompt(context);
    }
  }

  /**
   * Generate basic image prompt (fallback)
   */
  private generateBasicImagePrompt(context: {
    title: string;
    excerpt: string;
    keywords?: string[];
    category?: string;
    style: string;
    type: 'featured' | 'header' | 'content';
  }): string {
    const { title, excerpt, keywords, category, style, type } = context;
    
    // Extract key concepts from title and excerpt
    const keyConcepts = this.extractKeyConcepts(title, excerpt);
    
    // Build base prompt
    let prompt = '';
    
    // Add style modifiers
    const styleModifiers = {
      realistic: 'photorealistic, high quality, detailed',
      illustration: 'illustration, artistic, colorful, creative',
      minimalist: 'minimalist, clean, simple, modern',
      artistic: 'artistic, creative, unique, expressive',
      photographic: 'professional photography, high resolution, sharp focus'
    };
    
    prompt += styleModifiers[style as keyof typeof styleModifiers] || styleModifiers.realistic;
    
    // Add type-specific elements
    if (type === 'featured') {
      prompt += ', main subject, eye-catching, engaging';
    } else if (type === 'header') {
      prompt += ', wide format, banner style, professional';
    } else if (type === 'content') {
      prompt += ', supporting visual, informative, clear';
    }
    
    // Add key concepts
    if (keyConcepts.length > 0) {
      prompt += `, ${keyConcepts.join(', ')}`;
    }
    
    // Add keywords if available
    if (keywords && keywords.length > 0) {
      prompt += `, ${keywords.slice(0, 3).join(', ')}`;
    }
    
    // Add category context
    if (category) {
      prompt += `, ${category} related`;
    }
    
    // Add quality and technical specifications
    prompt += ', high resolution, professional quality, well-lit, good composition';
    
    return prompt.trim();
  }

  /**
   * Extract key concepts from title and excerpt
   */
  private extractKeyConcepts(title: string, excerpt: string): string[] {
    const text = `${title} ${excerpt}`.toLowerCase();
    
    // Common concept patterns
    const conceptPatterns = [
      // Technology
      /\b(ai|artificial intelligence|machine learning|tech|technology|digital|software|app|application|programming|coding|development)\b/g,
      // Business
      /\b(business|marketing|sales|strategy|management|leadership|entrepreneur|startup|company|corporate)\b/g,
      // Design
      /\b(design|ui|ux|user experience|interface|visual|graphic|creative|brand|logo)\b/g,
      // Lifestyle
      /\b(lifestyle|health|fitness|wellness|travel|food|cooking|home|family|personal)\b/g,
      // Education
      /\b(education|learning|tutorial|guide|tips|advice|how to|tutorial|course|training)\b/g,
      // Finance
      /\b(money|finance|investment|budget|saving|financial|economy|trading|crypto|bitcoin)\b/g
    ];
    
    const concepts = new Set<string>();
    
    conceptPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => concepts.add(match));
      }
    });
    
    return Array.from(concepts).slice(0, 5); // Limit to 5 concepts
  }

  /**
   * Generate alt text for accessibility
   */
  private generateAltText(title: string, placement: string): string {
    const placementDescriptions = {
      featured: 'Featured image for',
      header: 'Header image for',
      content: 'Content image for',
      footer: 'Footer image for'
    };
    
    return `${placementDescriptions[placement as keyof typeof placementDescriptions]} "${title}"`;
  }

  /**
   * Generate caption for the image
   */
  private generateCaption(title: string, placement: string): string {
    const placementCaptions = {
      featured: `Featured image: ${title}`,
      header: `Header image: ${title}`,
      content: `Related to: ${title}`,
      footer: `Footer image: ${title}`
    };
    
    return placementCaptions[placement as keyof typeof placementCaptions];
  }

  /**
   * Upload generated images to WordPress
   */
  private async uploadImagesToWordPress(
    images: GeneratedImage[],
    wordpressSite: { url: string; username: string; password: string }
  ): Promise<GeneratedImage[]> {
    const uploadedImages: GeneratedImage[] = [];
    
    for (const image of images) {
      try {
        // Download the image
        const response = await fetch(image.url);
        if (!response.ok) continue;
        
        const imageBuffer = await response.arrayBuffer();
        const mimeType = response.headers.get('content-type') || 'image/jpeg';
        
        // Upload to WordPress
        const uploadedMedia = await this.mediaService.uploadMedia(
          Buffer.from(imageBuffer),
          `${image.id}.${mimeType.split('/')[1]}`,
          mimeType,
          {
            altText: image.altText,
            caption: image.caption,
            description: image.description,
            title: image.description
          }
        );
        
        // Update the image with WordPress URL
        uploadedImages.push({
          ...image,
          url: uploadedMedia.source_url,
          id: uploadedMedia.id.toString()
        });
        
      } catch (error) {
        console.error(`Failed to upload image ${image.id}:`, error);
        // Keep original image if upload fails
        uploadedImages.push(image);
      }
    }
    
    return uploadedImages;
  }

  /**
   * Replace image placeholders in content with actual image HTML
   */
  replaceImagePlaceholders(content: string, generatedImages: GeneratedImage[]): string {
    if (!content || generatedImages.length === 0) return content;
    
    let processedContent = content;
    
    // Replace image placeholders with actual images using index-based matching
    const placeholderRegex = /<div class="image-placeholder"[^>]*data-image-id="([^"]*)"[^>]*data-image-index="([^"]*)"[^>]*data-description="([^"]*)"[^>]*data-placement="([^"]*)"[^>]*>[\s\S]*?<\/div>/g;
    
    processedContent = processedContent.replace(placeholderRegex, (match, imageId, imageIndex, description, placement) => {
      const index = parseInt(imageIndex) - 1; // Convert to 0-based index
      const matchingImage = generatedImages[index];
      
      if (matchingImage && matchingImage.url) {
        return `<img src="${matchingImage.url}" alt="${matchingImage.altText}" class="blog-image blog-image-${placement}" style="max-width: 100%; height: auto; margin: 20px 0;" />`;
      }
      
      // If no matching image found, keep the placeholder but make it more visible
      return `<div class="image-placeholder-missing" style="border: 2px dashed #ccc; padding: 20px; text-align: center; margin: 20px 0; background: #f9f9f9;">
        <div style="font-size: 24px; margin-bottom: 10px;">🖼️</div>
        <div><strong>이미지 순서:</strong> ${imageIndex}</div>
        <div><strong>이미지 위치:</strong> ${placement}</div>
        <div><strong>설명:</strong> ${description}</div>
        <div style="color: #666; font-size: 12px; margin-top: 10px;">이미지 생성 중...</div>
      </div>`;
    });
    
    return processedContent;
  }

  // Image generation methods for different providers
  private async generateWithOpenAI(prompt: string, aspectRatio: string): Promise<string> {
    try {
      // Get OpenAI API key
      const openaiKeys = aiKeysStore.getKeysByProvider('openai').filter(key => key.isActive);
      if (openaiKeys.length === 0) {
        throw new Error('No OpenAI API key found. Please add an OpenAI API key in the AI Keys Manager.');
      }

      const apiKey = openaiKeys[0].fields.apiKey;
      const organization = openaiKeys[0].fields.organization;

      // Map aspect ratio to DALL-E size
      const sizeMap: { [key: string]: string } = {
        'square': '1024x1024',
        'landscape': '1792x1024',
        'portrait': '1024x1792',
        'wide': '1792x1024'
      };

      const dalleSize = sizeMap[aspectRatio] || '1024x1024';

      // Call DALL-E API
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...(organization && { 'OpenAI-Organization': organization })
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: prompt,
          n: 1,
          size: dalleSize,
          quality: this.options.quality || 'standard',
          style: 'vivid' // or 'natural'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`DALL-E API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      
      if (data.data && data.data.length > 0) {
        return data.data[0].url;
      }

      throw new Error('No image generated by DALL-E');
    } catch (error) {
      console.error('DALL-E generation failed:', error);
      // Don't fallback to placeholder - throw the error to debug the real issue
      throw new Error(`DALL-E image generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async generateWithStabilityAI(prompt: string, aspectRatio: string): Promise<string> {
    // Implementation for Stability AI
    throw new Error('Stability AI integration not implemented yet');
  }

  private async generateWithMidjourney(prompt: string, aspectRatio: string): Promise<string> {
    // Implementation for Midjourney
    throw new Error('Midjourney integration not implemented yet');
  }

  private async generatePlaceholderImage(prompt: string, aspectRatio: string): Promise<string> {
    // Generate a placeholder image using a service like placeholder.com or create SVG
    const dimensions = this.getAspectRatioDimensions(aspectRatio);
    const encodedPrompt = encodeURIComponent(prompt.substring(0, 50));
    
    // Using placeholder.com with custom text
    return `https://via.placeholder.com/${dimensions}/4f46e5/ffffff?text=${encodedPrompt}`;
  }

  private getAspectRatioDimensions(aspectRatio: string): string {
    const dimensions = {
      square: '1024x1024',
      landscape: '1024x768',
      portrait: '768x1024',
      wide: '1280x720'
    };
    
    return dimensions[aspectRatio as keyof typeof dimensions] || dimensions.square;
  }
}

export default BlogImageGenerator;
