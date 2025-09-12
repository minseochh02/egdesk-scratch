#!/usr/bin/env node

/**
 * Dynamic Blog Content Generation Script
 * This script generates fresh AI content for each WordPress post task execution
 * Uses official AI provider SDKs for reliability
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

// Configuration from environment variables
const AI_KEY = process.env.AI_KEY;
const AI_MODEL = process.env.AI_MODEL;
const AI_PROVIDER = process.env.AI_PROVIDER;
const TEMPLATE_TYPE = process.env.TEMPLATE_TYPE;
const TEMPLATE_TITLE = process.env.TEMPLATE_TITLE;
const TEMPLATE_CONTENT = process.env.TEMPLATE_CONTENT;
const TEMPLATE_CATEGORIES = process.env.TEMPLATE_CATEGORIES;
const TEMPLATE_TAGS = process.env.TEMPLATE_TAGS;
const TEMPLATE_AUDIENCE = process.env.TEMPLATE_AUDIENCE;
const TEMPLATE_WORD_LENGTH = process.env.TEMPLATE_WORD_LENGTH;
const TEMPLATE_TONE = process.env.TEMPLATE_TONE;
const WORDPRESS_URL = process.env.WORDPRESS_URL;
const WORDPRESS_USERNAME = process.env.WORDPRESS_USERNAME;
const WORDPRESS_PASSWORD = process.env.WORDPRESS_PASSWORD;
// Image generation settings
const IMAGE_GENERATION_ENABLED = process.env.IMAGE_GENERATION_ENABLED === 'true';
const IMAGE_PROVIDER = process.env.IMAGE_PROVIDER || 'placeholder';
const IMAGE_QUALITY = process.env.IMAGE_QUALITY || 'standard';
const IMAGE_SIZE = process.env.IMAGE_SIZE || '400x300';
const IMAGE_STYLE = process.env.IMAGE_STYLE || 'realistic';
const IMAGE_ASPECT_RATIO = process.env.IMAGE_ASPECT_RATIO || 'landscape';
const OPENAI_KEY = process.env.OPENAI_KEY;

/**
 * Initialize AI clients based on provider
 */
async function initializeAIClient() {
  try {
    switch (AI_PROVIDER) {
      case 'openai': {
        const { OpenAI } = require('openai');
        return new OpenAI({
          apiKey: AI_KEY,
        });
      }
      case 'anthropic': {
        const { Anthropic } = require('@anthropic-ai/sdk');
        return new Anthropic({
          apiKey: AI_KEY,
        });
      }
      case 'google': {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        return new GoogleGenerativeAI(AI_KEY);
      }
      default:
        throw new Error(`Unsupported AI provider: ${AI_PROVIDER}`);
    }
  } catch (error) {
    console.error('Failed to initialize AI client:', error.message);
    throw new Error(`Failed to initialize ${AI_PROVIDER} client: ${error.message}`);
  }
}

/**
 * Generate AI content using the specified provider and model
 */
async function generateAIContent() {
  if (!AI_KEY || !AI_MODEL || !AI_PROVIDER) {
    throw new Error('Missing AI configuration: AI_KEY, AI_MODEL, or AI_PROVIDER not set');
  }

  console.log(`🤖 Initializing ${AI_PROVIDER} client with model: ${AI_MODEL}`);
  const client = await initializeAIClient();

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt();

  console.log(`📝 Generating content for template: ${TEMPLATE_TYPE}`);
  console.log(`🎯 Title: ${TEMPLATE_TITLE}`);

  let content;

  try {
    switch (AI_PROVIDER) {
      case 'openai':
        content = await generateOpenAIContent(client, systemPrompt, userPrompt);
        break;
      case 'anthropic':
        content = await generateAnthropicContent(client, systemPrompt, userPrompt);
        break;
      case 'google':
        content = await generateGoogleContent(client, systemPrompt, userPrompt);
        break;
      default:
        throw new Error(`Unsupported AI provider: ${AI_PROVIDER}`);
    }
  } catch (error) {
    console.error(`❌ AI generation failed:`, error.message);
    throw error;
  }

  return parseGeneratedContent(content);
}

/**
 * Generate content using OpenAI
 */
async function generateOpenAIContent(client, systemPrompt, userPrompt) {
  try {
    console.log(`🔄 Calling OpenAI API with model: ${AI_MODEL}`);
    
    const response = await client.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    console.log(`✅ OpenAI API call successful`);
    console.log(`📊 Usage: ${response.usage?.total_tokens || 'N/A'} tokens`);
    
    return response.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('OpenAI API Error:', {
      message: error.message,
      type: error.type,
      code: error.code,
      status: error.status
    });
    throw new Error(`OpenAI API failed: ${error.message}`);
  }
}

/**
 * Generate content using Anthropic
 */
async function generateAnthropicContent(client, systemPrompt, userPrompt) {
  try {
    console.log(`🔄 Calling Anthropic API with model: ${AI_MODEL}`);
    
    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 4000,
      temperature: 0.7,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ],
    });

    console.log(`✅ Anthropic API call successful`);
    console.log(`📊 Usage: ${response.usage?.input_tokens || 'N/A'} input + ${response.usage?.output_tokens || 'N/A'} output tokens`);
    
    return response.content[0]?.text || '';
  } catch (error) {
    console.error('Anthropic API Error:', {
      message: error.message,
      type: error.type,
      status: error.status
    });
    throw new Error(`Anthropic API failed: ${error.message}`);
  }
}

/**
 * Generate content using Google Gemini
 */
async function generateGoogleContent(client, systemPrompt, userPrompt) {
  try {
    console.log(`🔄 Calling Google Gemini API with model: ${AI_MODEL}`);
    
    const model = client.getGenerativeModel({ 
      model: AI_MODEL,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4000,
      },
    });

    const prompt = `${systemPrompt}\n\n${userPrompt}`;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    console.log(`✅ Google Gemini API call successful`);
    
    return response.text();
  } catch (error) {
    console.error('Google Gemini API Error:', {
      message: error.message,
      status: error.status
    });
    throw new Error(`Google Gemini API failed: ${error.message}`);
  }
}

/**
 * Build system prompt for blog content generation
 */
function buildSystemPrompt() {
  const targetAudience = TEMPLATE_AUDIENCE || 'general readers';
  const targetLength = TEMPLATE_WORD_LENGTH || '1200-1600 words';
  const tone = TEMPLATE_TONE || 'friendly and practical';
  
  return `You are an expert blog writer and content creator. Your task is to create high-quality, engaging blog posts that are optimized for SEO and user engagement.

## Writing Guidelines:
- Write in English
- Use a ${tone} tone
- Target audience: ${targetAudience}
- Target length: ${targetLength}
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
- [IMAGE:A featured image representing the main topic:featured] - for featured images`;
}

/**
 * Build user prompt with specific requirements
 */
function buildUserPrompt() {
  const categories = TEMPLATE_CATEGORIES ? TEMPLATE_CATEGORIES.split(',').map(c => c.trim()) : ['General'];
  const tags = TEMPLATE_TAGS ? TEMPLATE_TAGS.split(',').map(t => t.trim()) : [];
  const targetAudience = TEMPLATE_AUDIENCE || 'general readers';
  const targetLength = TEMPLATE_WORD_LENGTH || '1200-1600 words';
  const tone = TEMPLATE_TONE || 'friendly and practical';

  let templatePrompt = '';
  if (TEMPLATE_TYPE) {
    const templatePrompts = {
      'bw_weekly_update': 'Create a weekly update blog post that summarizes key highlights, challenges, metrics, and upcoming priorities.',
      'bw_how_to': 'Create a comprehensive how-to guide with step-by-step instructions, prerequisites, common issues, and next steps.',
      'bw_listicle': 'Create a top 10 listicle with engaging items, clear selection criteria, and actionable conclusions.',
      'bw_announcement': 'Create a product announcement post highlighting new features, benefits, getting started guide, and support links.',
      'bw_case_study': 'Create a detailed case study with background, challenges, solutions, results, and key learnings.',
      'custom': 'Create an engaging blog post on the given topic with practical, actionable information.'
    };
    templatePrompt = templatePrompts[TEMPLATE_TYPE] || 'Create an engaging blog post on the given topic with practical, actionable information.';
  }

  return `Please create a blog post with the following specifications:

**Category:** ${categories[0] || 'General'}
**Topic:** ${TEMPLATE_TITLE || 'General Topic'}
**Keywords:** ${tags.join(', ')}
**Audience:** ${targetAudience}
**Tone:** ${tone}
**Target Length:** ${targetLength}
${templatePrompt ? `**Template Type:** ${templatePrompt}` : ''}

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
function parseGeneratedContent(content) {
  try {
    // Try to extract JSON from the response - look for JSON block
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      let jsonStr = jsonMatch[0];
      
      // Clean up common JSON issues
      jsonStr = jsonStr
        .replace(/\\n/g, '\\n')  // Fix newlines
        .replace(/\\t/g, '\\t')  // Fix tabs
        .replace(/\\"/g, '\\"')  // Fix quotes
        .replace(/\\'/g, "\\'")  // Fix single quotes
        .replace(/\\\\/g, '\\\\'); // Fix backslashes
      
      const parsed = JSON.parse(jsonStr);
      console.log(`✅ Successfully parsed JSON response`);
      
      // Process image markers in content
      const processedContent = processImageMarkers(parsed.content || content);
      const extractedImages = extractImagesFromContent(parsed.content || content);
      
      return {
        title: parsed.title || TEMPLATE_TITLE || 'AI Generated Post',
        content: processedContent,
        excerpt: parsed.excerpt || generateExcerpt(processedContent),
        tags: parsed.tags || (TEMPLATE_TAGS ? TEMPLATE_TAGS.split(',').map(t => t.trim()) : []),
        categories: parsed.categories || (TEMPLATE_CATEGORIES ? TEMPLATE_CATEGORIES.split(',').map(c => c.trim()) : ['General']),
        seoTitle: parsed.seoTitle || parsed.title || TEMPLATE_TITLE || 'AI Generated Post',
        metaDescription: parsed.metaDescription || generateMetaDescription(processedContent),
        images: [...(parsed.images || []), ...extractedImages]
      };
    }
  } catch (error) {
    console.warn('⚠️  Failed to parse JSON response, using fallback parsing:', error.message);
    console.log('📄 Raw content preview:', content.substring(0, 500));
  }

  // Fallback parsing if JSON extraction fails
  console.log(`🔄 Using fallback content parsing`);
  const processedContent = processImageMarkers(content);
  const extractedImages = extractImagesFromContent(content);
  
  return {
    title: extractTitle(processedContent) || TEMPLATE_TITLE || 'AI Generated Post',
    content: processedContent,
    excerpt: generateExcerpt(processedContent),
    tags: TEMPLATE_TAGS ? TEMPLATE_TAGS.split(',').map(t => t.trim()) : [],
    categories: TEMPLATE_CATEGORIES ? TEMPLATE_CATEGORIES.split(',').map(c => c.trim()) : ['General'],
    seoTitle: extractTitle(processedContent) || TEMPLATE_TITLE || 'AI Generated Post',
    metaDescription: generateMetaDescription(processedContent),
    images: extractedImages
  };
}

/**
 * Process image markers in content and convert them to HTML placeholders
 */
function processImageMarkers(content) {
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
          <strong>Image Order:</strong> ${imageIndex}<br>
          <strong>Image Position:</strong> ${placement.trim()}<br>
          <strong>Description:</strong> ${description.trim()}
        </div>
      </div>
    </div>`;
  });
}

/**
 * Extract image information from content markers
 */
function extractImagesFromContent(content) {
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
 * Extract title from content
 */
function extractTitle(content) {
  const titleMatch = content.match(/<h1[^>]*>(.*?)<\/h1>/i) || 
                    content.match(/^#\s+(.+)$/m) ||
                    content.match(/^(.+)$/m);
  return titleMatch ? titleMatch[1].trim() : '';
}

/**
 * Generate excerpt from content
 */
function generateExcerpt(content) {
  const plainText = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  return plainText.length > 150 ? plainText.substring(0, 150) + '...' : plainText;
}

/**
 * Generate meta description from content
 */
function generateMetaDescription(content) {
  const plainText = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  return plainText.length > 160 ? plainText.substring(0, 160) + '...' : plainText;
}

/**
 * Upload media to WordPress using multipart/form-data
 */
async function uploadMediaToWordPress(fileBuffer, filename, mimeType, options = {}) {
  if (!WORDPRESS_URL || !WORDPRESS_USERNAME || !WORDPRESS_PASSWORD) {
    throw new Error('Missing WordPress configuration for media upload');
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
        console.log(`📊 WordPress Media API Response: ${res.statusCode}`);
        
        try {
          const parsed = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`✅ Successfully uploaded media: ${filename}`);
            console.log(`🆔 Media ID: ${parsed.id}`);
            console.log(`🔗 Media URL: ${parsed.source_url}`);
            resolve(parsed);
          } else {
            console.error(`❌ WordPress Media API Error: ${res.statusCode}`);
            console.error(`📄 Response:`, parsed);
            reject(new Error(`WordPress Media API request failed: ${res.statusCode} - ${parsed.message || responseData}`));
          }
        } catch (error) {
          console.error(`❌ Failed to parse WordPress response:`, error.message);
          console.error(`📄 Raw response:`, responseData);
          reject(new Error(`Failed to parse WordPress response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
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
function createMultipartFormData(fileBuffer, filename, mimeType, boundary, options) {
  const parts = [];

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
 * Get MIME type based on file extension
 */
function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp',
    '.tiff': 'image/tiff',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Generate a placeholder image for testing (SVG format for WordPress compatibility)
 */
function generatePlaceholderImage(width = 800, height = 600, text = 'Blog Image') {
  // Create a simple SVG placeholder image
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#f0f0f0"/>
    <text x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="Arial, sans-serif" font-size="24" fill="#666">
      ${text}
    </text>
  </svg>`;
  
  return Buffer.from(svg, 'utf8');
}

/**
 * Download images using the same logic as the debug workflow
 */
async function downloadImages(images) {
  const { spawn } = require('child_process');
  const path = require('path');
  const fs = require('fs');
  const os = require('os');

  return new Promise((resolve, reject) => {
    console.log(`🚀 Starting image download via Node.js script...`);
    console.log(`Images to download: ${images.length}`);

    // Create a temporary file with image data to avoid command line argument issues
    const tempInputFile = path.join(os.tmpdir(), `image-download-input-${Date.now()}.json`);
    const imageData = images.map(img => ({
      id: img.id || `img_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
      url: img.url
    }));

    try {
      fs.writeFileSync(tempInputFile, JSON.stringify(imageData, null, 2));
      console.log(`📝 Created input file: ${tempInputFile}`);
    } catch (error) {
      reject(new Error(`Failed to create input file: ${error.message}`));
      return;
    }

    const scriptPath = path.join(__dirname, 'download-images.js');
    const child = spawn('node', [scriptPath, '--input', tempInputFile], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let tempFilePath = '';

    child.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log('[Download Script]', output.trim());
      
      // Parse temp file path from stdout
      const lines = output.split('\n');
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('/') && trimmedLine.includes('download-results-') && trimmedLine.endsWith('.json')) {
          tempFilePath = trimmedLine;
          console.log(`[Download Script] Captured temp file path: ${tempFilePath}`);
          break;
        }
      }
    });

    child.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      console.error('[Download Script Error]', output.trim());
    });

    child.on('close', (code) => {
      // Clean up input file
      try {
        if (fs.existsSync(tempInputFile)) {
          fs.unlinkSync(tempInputFile);
          console.log(`Cleaned up input file: ${tempInputFile}`);
        }
      } catch (error) {
        console.warn(`Failed to clean up input file: ${error.message}`);
      }

      if (code === 0) {
        if (!tempFilePath) {
          reject(new Error('No temp file path received from download script'));
          return;
        }

        try {
          console.log(`Reading results from temp file: ${tempFilePath}`);
          const resultsContent = fs.readFileSync(tempFilePath, 'utf8');
          const results = JSON.parse(resultsContent);
          fs.unlinkSync(tempFilePath); // Clean up
          console.log(`Cleaned up temp file: ${tempFilePath}`);
          
          resolve({ success: true, results: results.results, summary: results.summary });
        } catch (error) {
          reject(new Error(`Failed to read download results: ${error.message}`));
        }
      } else {
        reject(new Error(`Download script exited with code ${code}: ${stderr}`));
      }
    });

    child.on('error', (error) => {
      reject(new Error(`Failed to start download script: ${error.message}`));
    });
  });
}

/**
 * Generate images using DALL-E (same logic as debug workflow)
 */
async function generateImagesWithDALLE(images, aiKey) {
  const https = require('https');
  const uploadedImages = [];

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    try {
      console.log(`🎨 Generating DALL-E image ${i + 1}/${images.length}: ${image.description}`);
      
      const imageRequest = {
        prompt: image.description,
        n: 1,
        size: '1024x1024'
      };

      const postData = JSON.stringify(imageRequest);
      const options = {
        hostname: 'api.openai.com',
        port: 443,
        path: '/v1/images/generations',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiKey}`,
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const dalleResponse = await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let responseData = '';
          res.on('data', (chunk) => {
            responseData += chunk;
          });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(responseData);
              if (res.statusCode >= 200 && res.statusCode < 300) {
                resolve(parsed);
              } else {
                reject(new Error(`DALL-E API error: ${res.statusCode} - ${parsed.error?.message || responseData}`));
              }
            } catch (error) {
              reject(new Error(`Failed to parse DALL-E response: ${error.message}`));
            }
          });
        });

        req.on('error', (error) => {
          reject(new Error(`DALL-E API request error: ${error.message}`));
        });

        req.write(postData);
        req.end();
      });

      if (dalleResponse.data && dalleResponse.data.length > 0) {
        const generatedImage = dalleResponse.data[0];
        uploadedImages.push({
          ...image,
          url: generatedImage.url,
          isDalle: true,
          isPlaceholder: false
        });
        console.log(`✅ Generated DALL-E image: ${generatedImage.url}`);
      } else {
        throw new Error('No image generated by DALL-E');
      }

    } catch (error) {
      console.error(`❌ Failed to generate DALL-E image ${i + 1}:`, error.message);
      uploadedImages.push({
        ...image,
        uploaded: false,
        error: error.message
      });
    }
  }

  return uploadedImages;
}

/**
 * Upload images for the blog post using the same logic as debug workflow
 */
async function uploadBlogImages(images, postTitle) {
  const uploadedImages = [];
  
  // Handle image generation based on settings
  let generatedImages = images;
  
  if (!IMAGE_GENERATION_ENABLED) {
    console.log('📷 Image generation disabled, skipping images');
    generatedImages = [];
  } else if (IMAGE_PROVIDER === 'dalle' && OPENAI_KEY) {
    console.log('🎨 Generating images with DALL-E...');
    generatedImages = await generateImagesWithDALLE(images, OPENAI_KEY);
  } else {
    console.log(`📷 Using ${IMAGE_PROVIDER} images (${IMAGE_SIZE})`);
    // Generate placeholder images for testing (optimized for memory)
    const [width, height] = IMAGE_SIZE.split('x').map(Number);
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      // Generate smaller placeholder images to save memory
      const placeholderImage = generatePlaceholderImage(width || 400, height || 300, `Image ${i + 1}`);
      const filename = `blog-image-${Date.now()}-${i + 1}.png`;
      const mimeType = 'image/png';
      
      generatedImages.push({
        ...image,
        url: `data:image/png;base64,${placeholderImage.toString('base64')}`,
        isDalle: false,
        isPlaceholder: true
      });
    }
  }

  // Download images using the same Node.js script as debug workflow
  if (generatedImages.some(img => img.url && !img.isPlaceholder)) {
    console.log('📥 Downloading generated images...');
    const realImages = generatedImages.filter(img => img.url && !img.isPlaceholder);
    try {
      const downloadResult = await downloadImages(realImages);
      console.log(`✅ Downloaded ${downloadResult.summary.successful}/${downloadResult.summary.total} images`);
      
      // Update generated images with download results
      for (let i = 0; i < downloadResult.results.length; i++) {
        const result = downloadResult.results[i];
        const image = generatedImages[i]; // Match by index instead of URL
        if (image && result.success) {
          image.downloadedData = result.data;
          image.downloadedMimeType = result.mimeType;
          image.downloadedSize = result.size;
          console.log(`✅ Updated image ${i + 1} with downloaded data: ${result.size} bytes`);
        } else {
          console.log(`⚠️  Failed to update image ${i + 1}: ${result.error || 'No matching image'}`);
        }
      }
    } catch (error) {
      console.error('❌ Image download failed:', error.message);
    }
  }
  
  // Upload images to WordPress
  for (let i = 0; i < generatedImages.length; i++) {
    const image = generatedImages[i];
    try {
      console.log(`🖼️  Processing image ${i + 1}/${generatedImages.length}: ${image.description}`);
      
      let fileBuffer;
      let filename;
      let mimeType;

      if (image.downloadedData) {
        // Use downloaded real image data
        const binaryString = Buffer.from(image.downloadedData, 'base64');
        fileBuffer = binaryString;
        filename = `blog-image-${Date.now()}-${i + 1}.${image.downloadedMimeType.split('/')[1]}`;
        mimeType = image.downloadedMimeType;
        console.log(`📤 Uploading real image: ${filename} (${image.downloadedSize} bytes)`);
      } else {
        // Use placeholder image
        fileBuffer = generatePlaceholderImage(800, 600, image.description);
        filename = `blog-image-${Date.now()}-${i + 1}.png`;
        mimeType = 'image/png';
        console.log(`📤 Uploading placeholder image: ${filename}`);
      }
      
      const uploadOptions = {
        altText: image.altText || image.description,
        caption: image.caption || '',
        description: image.description,
        title: image.title || `${postTitle} - Image ${i + 1}`
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
        url: uploadedMedia.source_url,
        uploaded: true
      });
      
    } catch (error) {
      console.error(`❌ Failed to upload image ${i + 1}:`, error.message);
      uploadedImages.push({
        ...image,
        uploaded: false,
        error: error.message
      });
    }
  }
  
  return uploadedImages;
}

/**
 * Post content to WordPress
 */
async function postToWordPress(content, uploadedImages = []) {
  if (!WORDPRESS_URL || !WORDPRESS_USERNAME || !WORDPRESS_PASSWORD) {
    throw new Error('Missing WordPress configuration');
  }

  console.log(`📤 Posting to WordPress: ${WORDPRESS_URL}`);

  const baseUrl = WORDPRESS_URL.replace(/\/$/, '');
  const endpoint = `${baseUrl}/wp-json/wp/v2/posts`;

  // Add timestamp and unique identifier to ensure each post is unique
  const now = new Date();
  const timestamp = now.toISOString();
  const uniqueId = `${now.getTime()}-${Math.random().toString(36).substr(2, 9)}`;

  // Find featured image (first image with placement 'featured' or first image)
  const featuredImage = uploadedImages.find(img => img.placement === 'featured') || uploadedImages[0];
  const featuredMediaId = featuredImage?.mediaId;

  // Update content with actual image URLs
  let updatedContent = content.content;
  
  console.log(`🔄 Processing ${uploadedImages.length} uploaded images for content replacement`);
  console.log(`📄 Content length before replacement: ${updatedContent.length} characters`);
  
  if (uploadedImages.length > 0) {
    uploadedImages.forEach((image, index) => {
      if (image.uploaded && image.url) {
        const imageIndex = index + 1; // 1-based indexing to match placeholder
        console.log(`🖼️  Processing image ${imageIndex}/${uploadedImages.length}: ${image.description}`);
        console.log(`🔗 Image URL: ${image.url}`);
        
        // Replace image placeholder divs with actual image tags using index-based matching
        const imageTag = `<img src="${image.url}" alt="${image.altText || image.description}" title="${image.caption || ''}" style="max-width: 100%; height: auto;" />`;
        
        // Find and replace the placeholder div for this image by matching the index
        const placeholderRegex = new RegExp(
          `<div class="image-placeholder"[^>]*data-image-index="${imageIndex}"[^>]*>.*?</div>`,
          'gs'
        );
        
        const beforeReplace = updatedContent;
        updatedContent = updatedContent.replace(placeholderRegex, imageTag);
        
        // Log if replacement was made
        if (beforeReplace !== updatedContent) {
          console.log(`✅ Replaced image placeholder ${imageIndex} for: ${image.description}`);
        } else {
          console.log(`⚠️  Could not find placeholder ${imageIndex} for image: ${image.description} - will be removed from content`);
          // Remove any remaining placeholders for failed images
          const placeholderRegex = new RegExp(
            `<div class="image-placeholder"[^>]*data-image-index="${imageIndex}"[^>]*>.*?</div>`,
            'gs'
          );
          updatedContent = updatedContent.replace(placeholderRegex, '');
        }
      }
    });
  }
  
  // Clean up any remaining placeholders for failed images
  console.log('🧹 Cleaning up remaining placeholders for failed images...');
  const remainingPlaceholders = updatedContent.match(/<div class="image-placeholder"[^>]*>.*?<\/div>/gs);
  if (remainingPlaceholders) {
    console.log(`🔍 Found ${remainingPlaceholders.length} remaining placeholders to remove`);
    updatedContent = updatedContent.replace(/<div class="image-placeholder"[^>]*>.*?<\/div>/gs, '');
  }
  
  console.log(`📄 Content length after replacement: ${updatedContent.length} characters`);

  const payload = {
    title: content.title,
    content: updatedContent,
    status: 'publish',
    excerpt: content.excerpt,
    ...(featuredMediaId && { featured_media: featuredMediaId }),
    // Note: categories and tags require integer IDs from WordPress API
    // categories: content.categories,
    // tags: content.tags
  };

  const auth = Buffer.from(`${WORDPRESS_USERNAME}:${WORDPRESS_PASSWORD}`).toString('base64');
  
  const postData = JSON.stringify(payload);

  const options = {
    hostname: new URL(endpoint).hostname,
    port: new URL(endpoint).port || 443,
    path: new URL(endpoint).pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`,
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        console.log(`📊 WordPress API Response: ${res.statusCode}`);
        
        try {
          const parsed = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`✅ Successfully posted to WordPress`);
            console.log(`🔗 Post ID: ${parsed.id}`);
            console.log(`🔗 Post URL: ${parsed.link}`);
            if (featuredMediaId) {
              console.log(`🖼️  Featured image ID: ${featuredMediaId}`);
            }
            resolve(parsed);
          } else {
            console.error(`❌ WordPress API Error: ${res.statusCode}`);
            console.error(`📄 Response:`, parsed);
            reject(new Error(`WordPress API request failed: ${res.statusCode} - ${parsed.message || responseData}`));
          }
        } catch (error) {
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

    req.write(postData);
    req.end();
  });
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log('🚀 Starting AI blog content generation...');
    
    // Debug: Log environment variables
    console.log('🔍 Environment variables:');
    console.log('AI_KEY present:', !!AI_KEY);
    console.log('AI_MODEL:', AI_MODEL);
    console.log('AI_PROVIDER:', AI_PROVIDER);
    console.log('TEMPLATE_TYPE:', TEMPLATE_TYPE);
    console.log('TEMPLATE_TITLE:', TEMPLATE_TITLE);
    console.log('TEMPLATE_CATEGORIES:', TEMPLATE_CATEGORIES);
    console.log('TEMPLATE_TAGS:', TEMPLATE_TAGS);
    console.log('TEMPLATE_AUDIENCE:', TEMPLATE_AUDIENCE);
    console.log('TEMPLATE_WORD_LENGTH:', TEMPLATE_WORD_LENGTH);
    console.log('TEMPLATE_TONE:', TEMPLATE_TONE);
    console.log('WORDPRESS_URL:', WORDPRESS_URL);
    console.log('WORDPRESS_USERNAME:', WORDPRESS_USERNAME);
    console.log('WORDPRESS_PASSWORD present:', !!WORDPRESS_PASSWORD);
    console.log('IMAGE_GENERATION_ENABLED:', IMAGE_GENERATION_ENABLED);
    console.log('IMAGE_PROVIDER:', IMAGE_PROVIDER);
    console.log('IMAGE_SIZE:', IMAGE_SIZE);
    console.log('OPENAI_KEY present:', !!OPENAI_KEY);
    
    // Validate required environment variables
    const requiredVars = [
      { name: 'AI_KEY', value: AI_KEY },
      { name: 'AI_MODEL', value: AI_MODEL },
      { name: 'AI_PROVIDER', value: AI_PROVIDER },
      { name: 'WORDPRESS_URL', value: WORDPRESS_URL },
      { name: 'WORDPRESS_USERNAME', value: WORDPRESS_USERNAME },
      { name: 'WORDPRESS_PASSWORD', value: WORDPRESS_PASSWORD }
    ];

    for (const { name, value } of requiredVars) {
      if (!value) {
        throw new Error(`${name} environment variable is required`);
      }
    }
    
    // Generate AI content
    console.log('🤖 Generating AI content...');
    const content = await generateAIContent();
    console.log('✅ AI content generated successfully');
    console.log(`📝 Title: ${content.title}`);
    console.log(`📄 Content length: ${content.content.length} characters`);
    console.log(`🏷️  Tags: ${content.tags.join(', ')}`);
    console.log(`📁 Categories: ${content.categories.join(', ')}`);
    console.log(`🖼️  Images requested: ${content.images.length}`);
    
    // Upload images if any
    let uploadedImages = [];
    if (content.images && content.images.length > 0) {
      console.log('📤 Uploading images to WordPress...');
      uploadedImages = await uploadBlogImages(content.images, content.title);
      console.log(`✅ Uploaded ${uploadedImages.filter(img => img.uploaded).length}/${content.images.length} images`);
    }
    
    // Post to WordPress
    const result = await postToWordPress(content, uploadedImages);
    console.log('🎉 Blog post creation completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('📚 Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { generateAIContent, postToWordPress };