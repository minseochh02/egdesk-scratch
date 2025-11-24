import { ParsedContent } from './index';
import { generateTextWithAI } from '../gemini';

/**
 * Generate structured blog content using Gemini AI with JSON output
 * @param {string} topic - The topic for the blog post
 * @returns {Promise<Object>} - The generated blog content as a structured object
 */
export default async function generateOutline(topic: string) {
    if (!topic) {
        throw new Error('Topic is required');
    }

    console.log(`🤖 Generating structured blog content for topic: "${topic}"`);
  
    const systemPrompt = `### Writing Rules
  - **Use only HTML tags**: <strong>, <em>, <h2>~<h6> (H1 prohibited)
  - **Markdown prohibited**: **bold**, *italic* usage prohibited
  - Use only inline styles without HEAD, BODY tags
  
  ## Output Format:
  Return your response in the following JSON format:
  {
    "title": "Blog post title",
    "content": "Full blog post content in HTML format with [IMAGE:description:placement] markers",
    "excerpt": "Brief summary of the post",
    "tags": ["tag1", "tag2", "tag3"],
    "categories": ["category1", "category2"],
    "seoTitle": "SEO optimized title",
    "metaDescription": "Meta description for search engines",
    "images": [
      {
        "description": "Detailed description of the image for AI generation",
        "altText": "Alt text for accessibility",
        "caption": "Image caption",
        "placement": "featured|header|content|footer"
      }
    ]
  }
  
  ## Image Marker Format:
  Use [IMAGE:description:placement] markers in your content where images should be inserted:
  - [IMAGE:A professional headshot of a business person:header] - for header images
  - [IMAGE:A detailed infographic showing the process:content] - for content images
  - [IMAGE:A call-to-action banner:footer] - for footer images
  - [IMAGE:A featured image representing the main topic:featured] - for featured images
  
  ## Content Requirements:
  - Create engaging, informative content that provides real value
  - Include practical examples and actionable advice
  - Use proper HTML formatting for headings, paragraphs, and lists
  - Integrate keywords naturally without keyword stuffing
  - Make it SEO-friendly and user-friendly
  - Include a compelling call-to-action at the end`;

    try {
      const result = await generateTextWithAI({
        prompt: topic,
        systemPrompt,
        model: 'gemini-2.5-flash',
        maxOutputTokens: 65536,
        streaming: false, // Use non-streaming for structured output (prevents markdown wrapping)
        useRetry: true,
        maxRetries: 3,
        retryBaseDelay: 2000,
        package: 'genai',
        parseJson: true,
        // Note: responseSchema will be set via responseMimeType in the system prompt
        // The structured output mode will be used automatically
      });

      if (!result.json) {
        throw new Error('Failed to parse JSON response from AI');
      }

      const parsedContent = result.json as ParsedContent;
      console.log(`✅ Structured blog content generated successfully`);
      
      return await generateUUIDforImages(parsedContent);
  
    } catch (error: any) {
      console.error('❌ Error generating structured blog content:', error.message);
      throw error;
    }
  }

  async function generateUUIDforImages(parsedContent: ParsedContent) {
    const { v4: uuidv4 } = await import('uuid');
    
    // Ensure markers and images arrays are initialized
    if (!parsedContent.markers) {
      parsedContent.markers = [];
    }
    if (!parsedContent.images) {
      parsedContent.images = [];
    }
    
    // find all [IMAGE:description:placement] markers in the content and generate a UUID for each one
    const imageMarkers = parsedContent.content.match(/\[IMAGE:([^:]+):([^\]]+)\]/g);
    if (!imageMarkers) {
      return parsedContent;
    }
    
    imageMarkers.forEach((marker: string) => {
      const uuid = uuidv4();
      parsedContent.markers.push({
        description: marker.split(':')[1],
        placement: marker.split(':')[2],
        uuid: uuid,
      });
      parsedContent.images.push({
        uuid: uuid,
        description: marker.split(':')[1],
        altText: null,
        caption: null,
        placement: marker.split(':')[2],
      });
    });
    return parsedContent;
  }