import { spawn, exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { app } from 'electron';
// GoogleGenAI will be imported dynamically to avoid CommonJS/ESM issues
import * as mime from 'mime-types';
import * as https from 'https';
import { URL } from 'url';

/**
 * Retry function with exponential backoff
 */
async function retryWithBackoff(fn: () => Promise<any>, maxRetries = 3, baseDelay = 1000): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRetryableError = error.message.includes('UNAVAILABLE') || 
                              error.message.includes('overloaded') ||
                              error.message.includes('503') ||
                              error.message.includes('429') ||
                              error.message.includes('quota') ||
                              error.message.includes('rate limit');
      
      if (!isRetryableError || attempt === maxRetries) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      console.log(`⚠️  Attempt ${attempt} failed, retrying in ${Math.round(delay)}ms...`);
      console.log(`   Error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Generate images using Gemini AI
 */
async function generateImages(prompt: string, count = 1): Promise<any[]> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }

  console.log(`🎨 Generating ${count} image(s) with prompt: "${prompt}"`);

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  const config = {
    responseModalities: ['IMAGE', 'TEXT'],
  };

  const model = 'gemini-2.5-flash-image-preview';
  const contents = [
    {
      role: 'user',
      parts: [
        {
          text: prompt,
        },
      ],
    },
  ];

  // Use retry logic for the API call
  const response = await retryWithBackoff(async () => {
    return await ai.models.generateContentStream({
      model,
      config,
      contents,
    });
  }, 3, 2000); // 3 retries, 2 second base delay

  const generatedImages: any[] = [];
  let fileIndex = 0;

  for await (const chunk of response) {
    if (!chunk.candidates || !chunk.candidates[0].content || !chunk.candidates[0].content.parts) {
      continue;
    }

    if (chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
      const fileName = `gemini_image_${Date.now()}_${fileIndex++}`;
      const inlineData = chunk.candidates[0].content.parts[0].inlineData;
      const fileExtension = mime.extension(inlineData.mimeType || 'image/png');
      const buffer = Buffer.from(inlineData.data || '', 'base64');
      
      const imageData = {
        fileName: `${fileName}.${fileExtension}`,
        mimeType: inlineData.mimeType || 'image/png',
        data: inlineData.data,
        buffer: buffer,
        size: buffer.length
      };

      generatedImages.push(imageData);
      console.log(`✅ Generated image: ${imageData.fileName} (${imageData.size} bytes)`);
    } else if (chunk.text) {
      console.log('📝 Image generation response:', chunk.text);
    }
  }

  console.log(`🎉 Generated ${generatedImages.length} image(s) successfully`);
  return generatedImages;
}

/**
 * Generate structured blog content using Gemini AI with JSON output
 */
async function generateStructuredBlogContent(topic: string): Promise<any> {
  if (!topic) {
    throw new Error('Topic is required');
  }

  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }

  console.log(`🤖 Generating structured blog content for topic: "${topic}"`);

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
    console.log(`📝 Title: ${parsedContent.title}`);
    console.log(`📄 Content length: ${parsedContent.content.length} characters`);
    console.log(`🏷️  Tags: ${parsedContent.tags.join(', ')}`);
    console.log(`📁 Categories: ${parsedContent.categories.join(', ')}`);
    console.log(`🖼️  Images requested: ${parsedContent.images.length}`);

    // Generate images if any are requested
    if (parsedContent.images && parsedContent.images.length > 0) {
      console.log(`🎨 Starting image generation for ${parsedContent.images.length} image(s)...`);
      
      const generatedImages: any[] = [];
      for (let i = 0; i < parsedContent.images.length; i++) {
        const imageRequest = parsedContent.images[i];
        try {
          console.log(`🎨 Generating image ${i + 1}/${parsedContent.images.length}: ${imageRequest.description}`);
          
          const images = await generateImages(imageRequest.description, 1);
          if (images.length > 0) {
            const generatedImage = images[0];
            generatedImages.push({
              ...imageRequest,
              fileName: generatedImage.fileName,
              mimeType: generatedImage.mimeType,
              data: generatedImage.data,
              buffer: generatedImage.buffer,
              size: generatedImage.size,
              generated: true
            });
          }
        } catch (error: any) {
          console.error(`❌ Failed to generate image ${i + 1}:`, error.message);
          generatedImages.push({
            ...imageRequest,
            generated: false,
            error: error.message
          });
        }
      }
      
      // Update the parsed content with generated image data
      parsedContent.generatedImages = generatedImages;
      console.log(`🎉 Image generation completed: ${generatedImages.filter(img => img.generated).length}/${parsedContent.images.length} successful`);
    }

    return parsedContent;

  } catch (error: any) {
    console.error('❌ Error generating structured blog content:', error.message);
    throw error;
  }
}

/**
 * Upload media to WordPress using multipart/form-data
 */
async function uploadMediaToWordPress(fileBuffer: Buffer, filename: string, mimeType: string, options: any = {}): Promise<any> {
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
  const formData = createMultipartFormData(fileBuffer, filename, mimeType, boundary, options);

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
function createMultipartFormData(fileBuffer: Buffer, filename: string, mimeType: string, boundary: string, options: any): Buffer {
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
async function uploadImagesToWordPress(images: any[]): Promise<any[]> {
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
      
      const uploadedMedia = await uploadMediaToWordPress(
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
 * Replace image markers in content with WordPress image shortcodes
 */
function replaceImageMarkers(content: string, uploadedImages: any[]): string {
  let updatedContent = content;
  let imageIndex = 0;
  
  console.log(`🔄 Replacing image markers in content...`);
  console.log(`📊 Available uploaded images: ${uploadedImages.length}`);
  
  // Replace [IMAGE:description:placement] markers with WordPress image shortcodes
  const imageMarkerRegex = /\[IMAGE:([^:]+):([^\]]+)\]/g;
  
  // Keep track of which uploaded images we've used
  const usedImages = new Set();
  
  updatedContent = updatedContent.replace(imageMarkerRegex, (match, description, placement) => {
    console.log(`🔍 Looking for image with description: "${description.trim()}"`);
    
    // Try multiple matching strategies
    let uploadedImage = uploadedImages.find(img => 
      img.description === description.trim() && img.uploaded && !usedImages.has(img.mediaId)
    );
    
    // If exact match fails, try partial match
    if (!uploadedImage) {
      uploadedImage = uploadedImages.find(img => 
        img.description && img.description.includes(description.trim()) && img.uploaded && !usedImages.has(img.mediaId)
      );
    }
    
    // If still no match, try altText match
    if (!uploadedImage) {
      uploadedImage = uploadedImages.find(img => 
        img.altText === description.trim() && img.uploaded && !usedImages.has(img.mediaId)
      );
    }
    
    // If still no match, use the next available uploaded image by order
    if (!uploadedImage) {
      uploadedImage = uploadedImages.find(img => img.uploaded && !usedImages.has(img.mediaId));
      if (uploadedImage) {
        console.log(`⚠️  No exact match found, using next available image: ${uploadedImage.description || 'Unknown'}`);
      }
    }
    
    if (uploadedImage) {
      imageIndex++;
      usedImages.add(uploadedImage.mediaId);
      console.log(`✅ Found matching image: ${uploadedImage.description || uploadedImage.altText} (Media ID: ${uploadedImage.mediaId})`);
      
      // Use WordPress image shortcode with media ID
      return `[caption id="attachment_${uploadedImage.mediaId}" align="aligncenter" width="800"]<img class="wp-image-${uploadedImage.mediaId}" src="${uploadedImage.wordpressUrl}" alt="${uploadedImage.altText || description.trim()}" width="800" height="auto" /> ${uploadedImage.caption || ''}[/caption]`;
    } else {
      console.log(`❌ No matching uploaded image found for: "${description.trim()}" - removing from content`);
      // Remove the image marker completely if upload failed
      return '';
    }
  });
  
  console.log(`🎉 Image marker replacement completed. ${imageIndex} images replaced.`);
  return updatedContent;
}

/**
 * Create a blog post in WordPress
 */
async function createWordPressPost(postData: any, uploadedImages: any[] = []): Promise<any> {
  const WORDPRESS_URL = process.env.WORDPRESS_URL;
  const WORDPRESS_USERNAME = process.env.WORDPRESS_USERNAME;
  const WORDPRESS_PASSWORD = process.env.WORDPRESS_PASSWORD;

  if (!WORDPRESS_URL || !WORDPRESS_USERNAME || !WORDPRESS_PASSWORD) {
    throw new Error('Missing WordPress configuration');
  }

  console.log(`📝 Creating WordPress post: ${postData.title}`);

  const baseUrl = WORDPRESS_URL.replace(/\/$/, '');
  const endpoint = `${baseUrl}/wp-json/wp/v2/posts`;

  // Find featured image (first image with placement 'featured' or first image)
  const featuredImage = uploadedImages.find(img => img.placement === 'featured') || uploadedImages[0];
  const featuredMediaId = featuredImage?.mediaId;

  // Replace image markers in content
  let updatedContent = postData.content;
  if (uploadedImages.length > 0) {
    console.log(`🔄 Replacing image markers in content...`);
    updatedContent = replaceImageMarkers(postData.content, uploadedImages);
  }

  // Add timestamp and unique identifier to ensure each post is unique
  const now = new Date();
  const timestamp = now.toISOString();
  const uniqueId = `${now.getTime()}-${Math.random().toString(36).substr(2, 9)}`;

  const payload = {
    title: postData.title,
    content: updatedContent,
    status: 'publish',
    excerpt: postData.excerpt || '',
    ...(featuredMediaId && { featured_media: featuredMediaId }),
  };

  const auth = Buffer.from(`${WORDPRESS_USERNAME}:${WORDPRESS_PASSWORD}`).toString('base64');
  
  const postDataJson = JSON.stringify(payload);

  const options = {
    hostname: new URL(endpoint).hostname,
    port: new URL(endpoint).port || 443,
    path: new URL(endpoint).pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`,
      'Content-Length': Buffer.byteLength(postDataJson)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        const statusCode = res.statusCode || 0;
        console.log(`📊 WordPress Post API Response: ${statusCode}`);
        
        try {
          const parsed = JSON.parse(responseData);
          if (statusCode >= 200 && statusCode < 300) {
            console.log(`✅ Successfully created WordPress post`);
            console.log(`🔗 Post ID: ${parsed.id}`);
            console.log(`🔗 Post URL: ${parsed.link}`);
            if (featuredMediaId) {
              console.log(`🖼️  Featured image ID: ${featuredMediaId}`);
            }
            resolve(parsed);
          } else {
            console.error(`❌ WordPress Post API Error: ${statusCode}`);
            console.error(`📄 Response:`, parsed);
            reject(new Error(`WordPress Post API request failed: ${statusCode} - ${parsed.message || responseData}`));
          }
        } catch (error: any) {
          console.error(`❌ Failed to parse WordPress response:`, error.message);
          console.error(`📄 Raw response:`, responseData);
          reject(new Error(`Failed to parse WordPress response: ${error.message}`));
        }
      });
    });

    req.on('error', (error: any) => {
      console.error(`❌ WordPress Post API request error:`, error.message);
      reject(new Error(`WordPress Post API request error: ${error.message}`));
    });

    req.write(postDataJson);
    req.end();
  });
}

/**
 * Main function to process blog content and upload to WordPress
 */
async function processBlogContent(blogContent: any): Promise<any> {
  try {
    console.log('🚀 Starting WordPress blog processing...');
    console.log(`📝 Title: ${blogContent.title}`);
    console.log(`📄 Content length: ${blogContent.content.length} characters`);
    console.log(`🖼️  Images to process: ${blogContent.generatedImages ? blogContent.generatedImages.length : 0}`);

    let uploadedImages: any[] = [];
    
    // Upload images if any were generated
    if (blogContent.generatedImages && blogContent.generatedImages.length > 0) {
      console.log('📤 Uploading generated images to WordPress...');
      uploadedImages = await uploadImagesToWordPress(blogContent.generatedImages);
    }

    // Create the blog post
    console.log('📝 Creating WordPress blog post...');
    const postResult = await createWordPressPost(blogContent, uploadedImages);
    
    console.log('🎉 Blog processing completed successfully!');
    console.log(`🔗 Post URL: ${postResult.link}`);
    
    return {
      success: true,
      post: postResult,
      uploadedImages: uploadedImages
    };

  } catch (error: any) {
    console.error('❌ Blog processing failed:', error.message);
    throw error;
  }
}

/**
 * Select a topic based on the selection mode
 */
function selectTopic(topics: any[], mode = 'least-used'): any {
  if (!topics || topics.length === 0) {
    throw new Error('No topics available for selection');
  }

  switch (mode) {
    case 'random':
      return selectRandomTopic(topics);
    case 'round-robin':
      return selectRoundRobinTopic(topics);
    case 'least-used':
    default:
      return selectLeastUsedTopic(topics);
  }
}

/**
 * Select topic using round-robin (sequential) method
 */
function selectRoundRobinTopic(topics: any[]): any {
  // Find the topic that was used least recently
  const sortedTopics = topics.sort((a, b) => {
    if (!a.lastUsed && !b.lastUsed) return 0;
    if (!a.lastUsed) return -1;
    if (!b.lastUsed) return 1;
    return new Date(a.lastUsed).getTime() - new Date(b.lastUsed).getTime();
  });
  
  return sortedTopics[0];
}

/**
 * Select topic randomly
 */
function selectRandomTopic(topics: any[]): any {
  const randomIndex = Math.floor(Math.random() * topics.length);
  return topics[randomIndex];
}

/**
 * Select the least used topic
 */
function selectLeastUsedTopic(topics: any[]): any {
  const sortedTopics = topics.sort((a, b) => (a.count || 0) - (b.count || 0));
  return sortedTopics[0];
}

/**
 * Update topic usage tracking
 */
function updateTopicUsage(topics: any[], selectedTopicText: string): any[] {
  const now = new Date().toISOString();
  
  console.log(`🔄 Updating topic usage for: "${selectedTopicText}"`);
  console.log(`📊 Total topics to process: ${topics.length}`);
  
  const updatedTopics = topics.map(topic => {
    if (topic.topic === selectedTopicText) {
      const oldCount = topic.count || 0;
      const newCount = oldCount + 1;
      console.log(`📊 Topic usage count: ${oldCount} > ${newCount}`);
      console.log(`⏰ Last used updated to: ${now}`);
      
      return {
        ...topic,
        lastUsed: now,
        count: newCount
      };
    }
    return topic;
  });
  
  // Verify the update worked
  const updatedTopic = updatedTopics.find(t => t.topic === selectedTopicText);
  if (updatedTopic) {
    console.log(`✅ Verification - Updated topic: "${updatedTopic.topic}", count: ${updatedTopic.count}, lastUsed: ${updatedTopic.lastUsed}`);
  } else {
    console.error(`❌ ERROR - Could not find updated topic: "${selectedTopicText}"`);
  }
  
  return updatedTopics;
}

/**
 * Update task metadata in the tasks file
 */
function updateTaskMetadata(taskId: string, updatedMetadata: any, selectedTopicText: string | null = null): void {
  try {
    // Look for the tasks file in the correct location
    const tasksFilePath = path.join(os.homedir(), '.egdesk-scheduler', 'tasks.json');
    
    console.log(`📁 Tasks file path: ${tasksFilePath}`);
    
    if (!fs.existsSync(tasksFilePath)) {
      console.warn('⚠️  Tasks file not found, cannot update metadata');
      return;
    }
    
    console.log('📖 Reading tasks file...');
    const tasks = JSON.parse(fs.readFileSync(tasksFilePath, 'utf8'));
    console.log(`📊 Found ${tasks.length} tasks in file`);
    
    // Find and update the task by extracting task ID from command field
    const taskIndex = tasks.findIndex((t: any) => {
      if (t.command && typeof t.command === 'string') {
        // Extract task ID from command string like: node script.js "task-1234567890-abc123"
        const match = t.command.match(/"([^"]+)"/);
        return match && match[1] === taskId;
      }
      return false;
    });
    if (taskIndex !== -1) {
      console.log(`🔍 Found task at index ${taskIndex}`);
      
      // Log current topic counts before update
      if (selectedTopicText && tasks[taskIndex].metadata && tasks[taskIndex].metadata.topics) {
        const currentTopics = tasks[taskIndex].metadata.topics;
        const selectedTopic = currentTopics.find((t: any) => t.topic === selectedTopicText);
        if (selectedTopic) {
          console.log(`📊 Current count for "${selectedTopic.topic}": ${selectedTopic.count}`);
        }
      }
      
      // Merge the updated metadata with the existing metadata to preserve other fields
      tasks[taskIndex].metadata = {
        ...tasks[taskIndex].metadata,
        ...updatedMetadata
      };
      tasks[taskIndex].updatedAt = new Date().toISOString();
      
      // Log updated topic counts after update
      if (selectedTopicText && tasks[taskIndex].metadata && tasks[taskIndex].metadata.topics) {
        const updatedTopics = tasks[taskIndex].metadata.topics;
        const selectedTopic = updatedTopics.find((t: any) => t.topic === selectedTopicText);
        if (selectedTopic) {
          console.log(`📊 Updated count for "${selectedTopic.topic}": ${selectedTopic.count}`);
        }
      }
      
      console.log('💾 Writing updated tasks to file...');
      // Save the updated tasks back to file
      fs.writeFileSync(tasksFilePath, JSON.stringify(tasks, null, 2));
      console.log('✅ Task metadata updated successfully');
      console.log(`📊 Updated topics count for task ${taskId}`);
      
    } else {
      console.warn('⚠️  Task not found for metadata update');
    }
    
  } catch (error: any) {
    console.error('❌ Error updating task metadata:', error.message);
    console.error('❌ Stack trace:', error.stack);
  }
}

/**
 * Main function to generate and upload blog content
 */
async function generateAndUploadBlog(topic: string, metadata: any = null): Promise<any> {
  try {
    console.log('🚀 Starting combined blog generation and upload...');
    console.log(`📝 Topic: ${topic}`);
    
    // Step 1: Generate blog content with Gemini
    console.log('\n🤖 Step 1: Generating blog content with Gemini AI...');
    const blogContent = await generateStructuredBlogContent(topic);
    
    // Step 2: Upload to WordPress
    console.log('\n📤 Step 2: Uploading to WordPress...');
    const result = await processBlogContent(blogContent);
    
    console.log('\n🎉 Blog generation and upload completed successfully!');
    console.log(`🔗 Post URL: ${result.post.link}`);
    console.log(`🖼️  Images uploaded: ${result.uploadedImages.filter((img: any) => img.uploaded).length}/${result.uploadedImages.length}`);
    
    return result;
    
  } catch (error: any) {
    console.error('❌ Error in combined process:', error.message);
    throw error;
  }
}

/**
 * Main execution function - can be called directly with metadata or from command line
 */
async function main(providedMetadata: any = null, providedTaskId: string | null = null): Promise<void> {
  try {
    let taskId: string, metadata: any;
    
    if (providedMetadata && providedTaskId) {
      // Called directly with parameters (from scheduler)
      taskId = providedTaskId;
      metadata = providedMetadata;
      console.log('🚀 Starting Gemini blog generation and WordPress upload...');
      console.log(`🆔 Task ID: ${taskId}`);
    } else {
      throw new Error('Metadata and task ID are required for blog generation');
    }
    
    if (!metadata.topics || !Array.isArray(metadata.topics) || metadata.topics.length === 0) {
      throw new Error('Topics array not found in task metadata');
    }
    
    // Select topic based on selection mode
    const selectedTopic = selectTopic(metadata.topics, metadata.topicSelectionMode || 'least-used');
    console.log(`📝 Selected Topic: ${selectedTopic.topic}`);
    console.log(`📊 Topic Selection Mode: ${metadata.topicSelectionMode || 'least-used'}`);
    
    // Update topic usage tracking
    console.log('\n🔄 Updating topic usage tracking...');
    const updatedTopics = updateTopicUsage(metadata.topics, selectedTopic.topic);
    
    // Update metadata with new usage data
    metadata.topics = updatedTopics;
    console.log(`📊 Updated metadata with ${updatedTopics.length} topics`);
    
    // Update environment variables from metadata if available
    if (metadata.wordpressSite) {
      process.env.WORDPRESS_URL = metadata.wordpressSite.url;
      process.env.WORDPRESS_USERNAME = metadata.wordpressSite.username;
      // Note: Password should be passed via environment variable for security
    }
    
    if (metadata.aiSettings) {
      process.env.IMAGE_GENERATION_ENABLED = metadata.aiSettings.imageGenerationEnabled ? 'true' : 'false';
      process.env.IMAGE_PROVIDER = metadata.aiSettings.imageProvider || 'gemini';
      process.env.IMAGE_QUALITY = metadata.aiSettings.imageQuality || 'standard';
      process.env.IMAGE_SIZE = metadata.aiSettings.imageSize || '1024x1024';
      process.env.IMAGE_STYLE = metadata.aiSettings.imageStyle || 'realistic';
      process.env.IMAGE_ASPECT_RATIO = metadata.aiSettings.imageAspectRatio || 'landscape';
    }
    
    // Check for required environment variables
    const requiredVars = [
      'GEMINI_API_KEY',
      'WORDPRESS_URL',
      'WORDPRESS_USERNAME',
      'WORDPRESS_PASSWORD'
    ];

    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        throw new Error(`${varName} environment variable is required`);
      }
    }
    
    // Update task metadata with new usage data FIRST (before blog generation)
    console.log('\n💾 Saving updated topic usage to tasks.json...');
    try {
      updateTaskMetadata(taskId, metadata, selectedTopic.topic);
    } catch (error: any) {
      console.error('❌ Error updating task metadata:', error.message);
      console.error('❌ Stack trace:', error.stack);
    }
    
    // Generate and upload blog
    let result;
    try {
      result = await generateAndUploadBlog(selectedTopic.topic, metadata);
    } catch (error: any) {
      console.error('❌ Error during blog generation:', error.message);
      // Metadata was already updated above
    }
    
    console.log('✅ Process completed successfully!');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

export interface ScheduledTask {
  id: string;
  name: string;
  description?: string;
  command: string;
  schedule: string; // cron expression or interval
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  createdAt: Date;
  updatedAt: Date;
  workingDirectory?: string;
  environment?: Record<string, string>;
  outputFile?: string;
  errorFile?: string;
  metadata?: Record<string, any>; // For storing task-specific data like topics, WordPress settings, etc.
}

export interface TaskExecution {
  id: string;
  taskId: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  exitCode?: number;
  output?: string;
  error?: string;
  pid?: number;
}

export class SchedulerManager {
  private tasks: Map<string, ScheduledTask> = new Map();

  private executions: Map<string, TaskExecution> = new Map();

  private runningTasks: Map<string, any> = new Map(); // PID to process mapping

  private intervalId?: NodeJS.Timeout;

  private cronJobs: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.loadTasks();
    this.startScheduler();
  }

  private loadTasks() {
    try {
      const tasksPath = path.join(
        os.homedir(),
        '.egdesk-scheduler',
        'tasks.json',
      );
      if (fs.existsSync(tasksPath)) {
        const data = fs.readFileSync(tasksPath, 'utf8');
        const tasks: ScheduledTask[] = JSON.parse(data);
        tasks.forEach((task) => {
          this.tasks.set(task.id, {
            ...task,
            createdAt: new Date(task.createdAt),
            updatedAt: new Date(task.updatedAt),
            lastRun: task.lastRun ? new Date(task.lastRun) : undefined,
            nextRun: task.nextRun ? new Date(task.nextRun) : undefined,
          });
        });
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  }

  private saveTasks() {
    try {
      const tasksDir = path.join(os.homedir(), '.egdesk-scheduler');
      if (!fs.existsSync(tasksDir)) {
        fs.mkdirSync(tasksDir, { recursive: true });
      }

      const tasksPath = path.join(tasksDir, 'tasks.json');
      const tasks = Array.from(this.tasks.values());
      fs.writeFileSync(tasksPath, JSON.stringify(tasks, null, 2));
    } catch (error) {
      console.error('Error saving tasks:', error);
    }
  }

  private startScheduler() {
    // Check for tasks every minute
    this.intervalId = setInterval(() => {
      this.checkScheduledTasks();
    }, 60000);

    // Check immediately on startup
    this.checkScheduledTasks();
  }

  private checkScheduledTasks() {
    const now = new Date();

    for (const [taskId, task] of this.tasks.entries()) {
      if (!task.enabled) continue;

      if (this.shouldRunTask(task, now)) {
        this.executeTask(task);
      }
    }
  }

  private shouldRunTask(task: ScheduledTask, now: Date): boolean {
    if (task.schedule.startsWith('interval:')) {
      // Handle interval-based tasks (e.g., "interval:300000" for 5 minutes)
      const interval = parseInt(task.schedule.replace('interval:', ''));
      if (!task.lastRun) return true;

      const timeSinceLastRun = now.getTime() - task.lastRun.getTime();
      return timeSinceLastRun >= interval;
    }
    if (task.schedule.startsWith('cron:')) {
      // Handle cron expressions (simplified implementation)
      const cronExpression = task.schedule.replace('cron:', '');
      return this.evaluateCronExpression(cronExpression, now);
    }

    return false;
  }

  private evaluateCronExpression(cronExpression: string, now: Date): boolean {
    // Simplified cron evaluation - in a real implementation, you'd use a proper cron library
    const parts = cronExpression.split(' ');
    if (parts.length !== 5) return false;

    const [minute, hour, day, month, weekday] = parts;

    // Check if current time matches cron expression
    const currentMinute = now.getMinutes();
    const currentHour = now.getHours();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth() + 1;
    const currentWeekday = now.getDay();

    return (
      this.matchesCronField(minute, currentMinute) &&
      this.matchesCronField(hour, currentHour) &&
      this.matchesCronField(day, currentDay) &&
      this.matchesCronField(month, currentMonth) &&
      this.matchesCronField(weekday, currentWeekday)
    );
  }

  private matchesCronField(field: string, value: number): boolean {
    if (field === '*') return true;
    if (field.includes(',')) {
      return field.split(',').map(Number).includes(value);
    }
    if (field.includes('-')) {
      const [start, end] = field.split('-').map(Number);
      return value >= start && value <= end;
    }
    if (field.includes('/')) {
      const [base, step] = field.split('/').map(Number);
      return value % step === 0;
    }
    return parseInt(field) === value;
  }

  private async executeTask(task: ScheduledTask) {
    const executionId = `${task.id}-${Date.now()}`;
    const execution: TaskExecution = {
      id: executionId,
      taskId: task.id,
      startTime: new Date(),
      status: 'running',
    };

    this.executions.set(executionId, execution);

    try {
      // Update task's last run time
      task.lastRun = new Date();
      task.updatedAt = new Date();
      this.tasks.set(task.id, task);
      this.saveTasks();

      // Prepare command and environment
      const { command } = task;
      // Use app directory as default working directory for better script resolution
      const workingDir = task.workingDirectory || app.getAppPath();
      
      console.log(`📁 Working directory: ${workingDir}`);
      console.log(`📁 App path: ${app.getAppPath()}`);
      console.log(`📁 NODE_ENV: ${process.env.NODE_ENV}`);
      console.log(`📁 App is packaged: ${app.isPackaged}`);
      
      if (app.isPackaged) {
        console.log(`📁 Process resources path: ${process.resourcesPath}`);
        console.log(`📁 Resources directory contents: ${fs.existsSync(process.resourcesPath) ? fs.readdirSync(process.resourcesPath).join(', ') : 'Not found'}`);
        
        const scriptsDir = path.join(process.resourcesPath, 'scripts');
        console.log(`📁 Scripts directory: ${scriptsDir}`);
        console.log(`📁 Scripts directory exists: ${fs.existsSync(scriptsDir)}`);
        if (fs.existsSync(scriptsDir)) {
          console.log(`📁 Scripts directory contents: ${fs.readdirSync(scriptsDir).join(', ')}`);
        }
      }

      // Check if this is an Electron script command
      if (command.startsWith('ELECTRON_SCRIPT:')) {
        const scriptPath = command.replace('ELECTRON_SCRIPT:', '');
        
        console.log(`🚀 Executing Electron script: ${scriptPath}`);
        
        // Execute the blog generator directly instead of requiring external scripts
        let originalEnv = { ...process.env };
        try {
          // Set up environment variables from task
          Object.assign(process.env, task.environment);
          
          console.log(`🔧 Environment variables set: ${Object.keys(task.environment || {}).join(', ')}`);
          
          // Execute the blog generator main function directly
          console.log(`🚀 Executing blog generator for task: ${task.id}`);
          
          // Get task metadata
          const metadata = task.metadata || {};
          
          // Execute the blog generator main function with metadata and task ID
          const result = await main(metadata, task.id);
          
          // Mark execution as completed
          execution.endTime = new Date();
          execution.status = 'completed';
          execution.exitCode = 0;
          execution.output = `Blog generation completed successfully. Result: ${JSON.stringify(result, null, 2)}`;
          
          console.log(`✅ Task ${task.name} completed successfully`);
          
        } catch (error) {
          execution.endTime = new Date();
          execution.status = 'failed';
          execution.exitCode = 1;
          execution.error = `Script execution error: ${error instanceof Error ? error.message : String(error)}\nStack: ${error instanceof Error ? error.stack || 'No stack trace available' : 'No stack trace available'}`;
          
          console.error(`❌ Task ${task.name} failed:`, error);
        } finally {
          // Restore original environment
          process.env = originalEnv;
          
          // Clean up
          this.executions.set(executionId, execution);
          this.runningTasks.delete(task.id);
          
          // Save output to files if specified
          if (task.outputFile && execution.output) {
            fs.writeFileSync(task.outputFile, execution.output);
          }
          if (task.errorFile && execution.error) {
            fs.writeFileSync(task.errorFile, execution.error);
          }
          
          // Update task's next run time
          this.updateNextRunTime(task);
        }
      } else {
        // Execute the command normally
        const env = { ...process.env, ...task.environment };
        const childProcess = spawn(command, [], {
          cwd: workingDir,
          env,
          shell: true,
          detached: false,
        });

        execution.pid = childProcess.pid;
        this.runningTasks.set(task.id, childProcess);

        // Handle output
        let output = '';
        let error = '';

        childProcess.stdout?.on('data', (data: Buffer) => {
          output += data.toString();
        });

        childProcess.stderr?.on('data', (data: Buffer) => {
          error += data.toString();
        });

        // Handle process completion
        childProcess.on('close', (code: number | null) => {
          execution.endTime = new Date();
          execution.status = code === 0 ? 'completed' : 'failed';
          execution.exitCode = code || 0;
          execution.output = output;
          execution.error = error;

          // Add debugging information
          if (code !== 0) {
            console.error(`Task ${task.name} failed with exit code ${code}`);
            console.error(`Output: ${output}`);
            console.error(`Error: ${error}`);
          }

          this.executions.set(executionId, execution);
          this.runningTasks.delete(task.id);

          // Save output to files if specified
          if (task.outputFile && output) {
            fs.writeFileSync(task.outputFile, output);
          }
          if (task.errorFile && error) {
            fs.writeFileSync(task.errorFile, error);
          }

          // Update task's next run time
          this.updateNextRunTime(task);
        });

        childProcess.on('error', (err: Error) => {
          execution.endTime = new Date();
          execution.status = 'failed';
          execution.error = `Process error: ${err.message}\nStack: ${err.stack || 'No stack trace available'}`;
          this.executions.set(executionId, execution);
          this.runningTasks.delete(task.id);
          console.error(`Task ${task.name} failed with error:`, err);
        });
      }
    } catch (error) {
      execution.endTime = new Date();
      execution.status = 'failed';
      execution.error = error instanceof Error 
        ? `Execution error: ${error.message}\nStack: ${error.stack || 'No stack trace available'}`
        : `Unknown error: ${String(error)}`;
      this.executions.set(executionId, execution);
      console.error(`Task ${task.name} execution failed:`, error);
    }
  }

  private updateNextRunTime(task: ScheduledTask) {
    if (task.schedule.startsWith('interval:')) {
      const interval = parseInt(task.schedule.replace('interval:', ''));
      task.nextRun = new Date(Date.now() + interval);
    } else if (task.schedule.startsWith('cron:')) {
      // For cron jobs, calculate next run time (simplified)
      task.nextRun = new Date(Date.now() + 60000); // Next minute
    }

    task.updatedAt = new Date();
    this.tasks.set(task.id, task);
    this.saveTasks();
  }

  // Public API methods
  public createTask(
    taskData: Omit<ScheduledTask, 'id' | 'createdAt' | 'updatedAt'>,
  ): ScheduledTask {
    const task: ScheduledTask = {
      ...taskData,
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.tasks.set(task.id, task);
    this.saveTasks();
    return task;
  }

  public updateTask(
    taskId: string,
    updates: Partial<ScheduledTask>,
  ): ScheduledTask | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    const updatedTask = {
      ...task,
      ...updates,
      id: taskId, // Ensure ID doesn't change
      updatedAt: new Date(),
    };

    this.tasks.set(taskId, updatedTask);
    this.saveTasks();
    return updatedTask;
  }

  public deleteTask(taskId: string): boolean {
    // Cancel running task if exists
    const runningProcess = this.runningTasks.get(taskId);
    if (runningProcess) {
      runningProcess.kill();
      this.runningTasks.delete(taskId);
    }

    // Remove cron job if exists
    const cronJob = this.cronJobs.get(taskId);
    if (cronJob) {
      clearTimeout(cronJob);
      this.cronJobs.delete(taskId);
    }

    // Remove task from memory
    const deleted = this.tasks.delete(taskId);
    
    // Save tasks to persist the deletion
    if (deleted) {
      this.saveTasks();
    }
    
    return deleted;
  }

  public getTask(taskId: string): ScheduledTask | null {
    return this.tasks.get(taskId) || null;
  }

  public getAllTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  public getTaskExecutions(taskId?: string): TaskExecution[] {
    const executions = Array.from(this.executions.values());
    if (taskId) {
      return executions.filter((exec) => exec.taskId === taskId);
    }
    return executions;
  }

  public runTaskNow(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    this.executeTask(task);
    return true;
  }

  public stopTask(taskId: string): boolean {
    const runningProcess = this.runningTasks.get(taskId);
    if (!runningProcess) return false;

    runningProcess.kill();
    this.runningTasks.delete(taskId);
    return true;
  }

  public getTaskMetadata(taskId: string): Record<string, any> | null {
    const task = this.tasks.get(taskId);
    return task?.metadata || null;
  }

  public getSystemInfo() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      totalTasks: this.tasks.size,
      runningTasks: this.runningTasks.size,
      totalExecutions: this.executions.size,
    };
  }

  public cleanup() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    // Kill all running tasks
    for (const [taskId, process] of this.runningTasks.entries()) {
      process.kill();
    }
    this.runningTasks.clear();

    // Clear all cron jobs
    for (const cronJob of this.cronJobs.values()) {
      clearTimeout(cronJob);
    }
    this.cronJobs.clear();
  }
}

// Export singleton instance
export const schedulerManager = new SchedulerManager();
