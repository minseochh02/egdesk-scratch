import retryWithBackoff from './retry';
import { ParsedContent } from './index';

/**
 * Generate structured blog content using Gemini AI with JSON output
 * @param {string} topic - The topic for the blog post
 * @returns {Promise<Object>} - The generated blog content as a structured object
 */
export default async function generateOutline(topic: string) {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY environment variable is required');
    }
    if (!topic) {
        throw new Error('Topic is required');
    }
      

    console.log(`🤖 Generating structured blog content for topic: "${topic}"`);
  
    // ESM-only project, must be loaded this way
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
  
    const config = {
      responseMimeType: 'application/json',
      generationConfig: {
        maxOutputTokens: 65536,
      },
      systemInstruction: [
        {
          text: `### Writing Rules
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
  - Include a compelling call-to-action at the end`,
        }
      ],
    };
  
    const model = 'gemini-2.5-flash';
    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: topic,
          },
        ],
      },
    ];
  
    try {
      // Use retry logic for the API call
      const response = await retryWithBackoff(async () => {
        return await ai.models.generateContentStream({
          model,
          config,
          contents,
        });
      }, 3, 2000); // 3 retries, 2 second base delay
  
      let fullContent = '';
      for await (const chunk of response) {
        fullContent += chunk.text;
        console.log(chunk.text);
      }
  
      // Parse the JSON response
      const parsedContent = JSON.parse(fullContent);
      console.log(`✅ Structured blog content generated successfully`);
        //   console.log(`📝 Title: ${parsedContent.title}`);
        //   console.log(`📄 Content length: ${parsedContent.content.length} characters`);
        //   console.log(`🏷️  Tags: ${parsedContent.tags.join(', ')}`);
        //   console.log(`📁 Categories: ${parsedContent.categories.join(', ')}`);
        //   console.log(`🖼️  Images requested: ${parsedContent.images.length}`);
      
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