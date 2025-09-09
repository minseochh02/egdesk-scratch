#!/usr/bin/env node

/**
 * Dynamic Blog Content Generation Script
 * This script generates fresh AI content for each WordPress post task execution
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// Configuration from environment variables
const AI_KEY = process.env.AI_KEY;
const AI_MODEL = process.env.AI_MODEL;
const AI_PROVIDER = process.env.AI_PROVIDER;
const TEMPLATE_TYPE = process.env.TEMPLATE_TYPE;
const TEMPLATE_TITLE = process.env.TEMPLATE_TITLE;
const TEMPLATE_CONTENT = process.env.TEMPLATE_CONTENT;
const TEMPLATE_CATEGORIES = process.env.TEMPLATE_CATEGORIES;
const TEMPLATE_TAGS = process.env.TEMPLATE_TAGS;
const WORDPRESS_URL = process.env.WORDPRESS_URL;
const WORDPRESS_USERNAME = process.env.WORDPRESS_USERNAME;
const WORDPRESS_PASSWORD = process.env.WORDPRESS_PASSWORD;

// AI Provider configurations
const AI_PROVIDERS = {
  'openai': {
    baseUrl: 'https://api.openai.com/v1',
    headers: {
      'Authorization': `Bearer ${AI_KEY}`,
      'Content-Type': 'application/json'
    }
  },
  'anthropic': {
    baseUrl: 'https://api.anthropic.com/v1',
    headers: {
      'x-api-key': AI_KEY,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    }
  },
  'google': {
    baseUrl: 'https://generativelanguage.googleapis.com/v1',
    headers: {
      'Content-Type': 'application/json'
    }
  }
};

/**
 * Generate AI content using the specified provider and model
 */
async function generateAIContent() {
  if (!AI_KEY || !AI_MODEL || !AI_PROVIDER) {
    throw new Error('Missing AI configuration: AI_KEY, AI_MODEL, or AI_PROVIDER not set');
  }

  const provider = AI_PROVIDERS[AI_PROVIDER];
  if (!provider) {
    throw new Error(`Unsupported AI provider: ${AI_PROVIDER}`);
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt();

  let requestData;
  let endpoint;
  let headers = { ...provider.headers };

  if (AI_PROVIDER === 'google') {
    // Google Gemini API format - use the correct endpoint
    // Map the model name to the correct API model name
    const modelMap = {
      'gemini-1.5-flash-latest': 'gemini-2.0-flash',
      'gemini-1.5-flash': 'gemini-2.0-flash',
      'gemini-1.5-pro': 'gemini-2.0-pro',
      'gemini-2.0-flash': 'gemini-2.0-flash',
      'gemini-2.0-pro': 'gemini-2.0-pro'
    };
    const apiModel = modelMap[AI_MODEL] || 'gemini-2.0-flash';
    endpoint = `/models/${apiModel}:generateContent?key=${AI_KEY}`;
    requestData = {
      contents: [{
        parts: [{
          text: `${systemPrompt}\n\n${userPrompt}`
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4000
      }
    };
  } else {
    // OpenAI/Anthropic format
    endpoint = '/chat/completions';
    requestData = {
      model: AI_MODEL,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 4000
    };

    // Add system prompt for OpenAI
    if (AI_PROVIDER === 'openai') {
      requestData.messages.unshift({
        role: 'system',
        content: systemPrompt
      });
    }
  }

  // Debug: Log the request details
  console.log('Making API request:', {
    baseUrl: provider.baseUrl,
    endpoint: endpoint,
    provider: AI_PROVIDER,
    model: AI_MODEL
  });

  const response = await makeAPIRequest(provider.baseUrl, endpoint, requestData, headers);
  
  let content;
  if (AI_PROVIDER === 'google') {
    // Google Gemini response format
    if (!response.candidates || !response.candidates[0] || !response.candidates[0].content) {
      throw new Error('Invalid Google AI response format');
    }
    content = response.candidates[0].content.parts[0].text;
  } else {
    // OpenAI/Anthropic response format
    if (!response.choices || !response.choices[0] || !response.choices[0].message) {
      throw new Error('Invalid AI response format');
    }
    content = response.choices[0].message.content;
  }

  return parseGeneratedContent(content);
}

/**
 * Build system prompt for blog content generation
 */
function buildSystemPrompt() {
  return `You are an expert blog writer and content creator. Your task is to create high-quality, engaging blog posts that are optimized for SEO and user engagement.

## Writing Guidelines:
- Write in Korean (한국어)
- Use a 친근하고 실용적인 tone
- Target audience: 일반 독자
- Target length: 1200-1600 단어
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

## SEO Requirements:
- Include primary keywords in title and headings
- Use secondary keywords naturally throughout content
- Create meta description (150-160 characters)
- Suggest relevant tags and categories

## Output Format:
Return your response in the following JSON format:
{
  "title": "Blog post title",
  "content": "Full blog post content in HTML format",
  "excerpt": "Brief summary of the post",
  "tags": ["tag1", "tag2", "tag3"],
  "categories": ["category1", "category2"],
  "seoTitle": "SEO optimized title",
  "metaDescription": "Meta description for search engines"
}`;
}

/**
 * Build user prompt with specific requirements
 */
function buildUserPrompt() {
  const categories = TEMPLATE_CATEGORIES ? TEMPLATE_CATEGORIES.split(',').map(c => c.trim()) : ['일반'];
  const tags = TEMPLATE_TAGS ? TEMPLATE_TAGS.split(',').map(t => t.trim()) : [];

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

**Category:** ${categories[0] || '일반'}
**Topic:** ${TEMPLATE_TITLE || '일반적인 주제'}
**Keywords:** ${tags.join(', ')}
**Audience:** 일반 독자
**Tone:** 친근하고 실용적인
**Target Length:** 1200-1600 단어
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
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        title: parsed.title || TEMPLATE_TITLE || 'AI Generated Post',
        content: parsed.content || content,
        excerpt: parsed.excerpt || generateExcerpt(content),
        tags: parsed.tags || (TEMPLATE_TAGS ? TEMPLATE_TAGS.split(',').map(t => t.trim()) : []),
        categories: parsed.categories || (TEMPLATE_CATEGORIES ? TEMPLATE_CATEGORIES.split(',').map(c => c.trim()) : ['일반']),
        seoTitle: parsed.seoTitle || parsed.title || TEMPLATE_TITLE || 'AI Generated Post',
        metaDescription: parsed.metaDescription || generateMetaDescription(content)
      };
    }
  } catch (error) {
    console.warn('Failed to parse JSON response, using fallback parsing:', error);
  }

  // Fallback parsing if JSON extraction fails
  return {
    title: extractTitle(content) || TEMPLATE_TITLE || 'AI Generated Post',
    content: content,
    excerpt: generateExcerpt(content),
    tags: TEMPLATE_TAGS ? TEMPLATE_TAGS.split(',').map(t => t.trim()) : [],
    categories: TEMPLATE_CATEGORIES ? TEMPLATE_CATEGORIES.split(',').map(c => c.trim()) : ['일반'],
    seoTitle: extractTitle(content) || TEMPLATE_TITLE || 'AI Generated Post',
    metaDescription: generateMetaDescription(content)
  };
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
 * Make API request to AI provider
 */
function makeAPIRequest(baseUrl, endpoint, data, headers) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, baseUrl);
    const postData = JSON.stringify(data);

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search, // Include query parameters
      method: 'POST',
      headers: {
        ...headers,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = (url.protocol === 'https:' ? https : http).request(options, (res) => {
      let responseData = '';

      console.log('API Response received:', {
        statusCode: res.statusCode,
        headers: res.headers
      });

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        console.log('API Response complete:', {
          statusCode: res.statusCode,
          responseLength: responseData.length,
          responsePreview: responseData.substring(0, 200) + '...'
        });

        try {
          const parsed = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('API Success:', parsed);
            resolve(parsed);
          } else {
            console.error('API Error Response:', {
              statusCode: res.statusCode,
              responseData: responseData,
              parsed: parsed
            });
            reject(new Error(`API request failed: ${res.statusCode} - ${parsed.error?.message || responseData}`));
          }
        } catch (error) {
          console.error('JSON Parse Error:', {
            error: error.message,
            responseData: responseData.substring(0, 500) + '...'
          });
          reject(new Error(`Failed to parse API response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('API Request Error:', {
        error: error.message,
        code: error.code,
        errno: error.errno,
        syscall: error.syscall,
        hostname: error.hostname,
        port: error.port
      });
      reject(new Error(`API request error: ${error.message}`));
    });

    req.write(postData);
    req.end();

    // Add timeout to prevent hanging
    req.setTimeout(30000, () => {
      console.error('API Request Timeout');
      req.destroy();
      reject(new Error('API request timeout after 30 seconds'));
    });
  });
}

/**
 * Post content to WordPress
 */
async function postToWordPress(content) {
  if (!WORDPRESS_URL || !WORDPRESS_USERNAME || !WORDPRESS_PASSWORD) {
    throw new Error('Missing WordPress configuration');
  }

  const baseUrl = WORDPRESS_URL.replace(/\/$/, '');
  const endpoint = `${baseUrl}/wp-json/wp/v2/posts`;

  // Add timestamp and unique identifier to ensure each post is unique
  const now = new Date();
  const timestamp = now.toISOString();
  const uniqueId = `${now.getTime()}-${Math.random().toString(36).substr(2, 9)}`;

  const payload = {
    title: `${content.title} - ${now.toLocaleString()}`,
    content: content.content,
    status: 'publish',
    excerpt: content.excerpt,
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
        try {
          const parsed = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`WordPress API request failed: ${res.statusCode} - ${parsed.message || responseData}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse WordPress response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
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
    console.log('🤖 Starting AI content generation...');
    
    // Debug: Log environment variables
    console.log('🔍 Environment variables:');
    console.log('AI_KEY present:', !!AI_KEY);
    console.log('AI_MODEL:', AI_MODEL);
    console.log('AI_PROVIDER:', AI_PROVIDER);
    console.log('TEMPLATE_TYPE:', TEMPLATE_TYPE);
    console.log('TEMPLATE_TITLE:', TEMPLATE_TITLE);
    console.log('WORDPRESS_URL:', WORDPRESS_URL);
    console.log('WORDPRESS_USERNAME:', WORDPRESS_USERNAME);
    console.log('WORDPRESS_PASSWORD present:', !!WORDPRESS_PASSWORD);
    
    // Validate required environment variables
    if (!AI_KEY) {
      throw new Error('AI_KEY environment variable is required');
    }
    if (!AI_MODEL) {
      throw new Error('AI_MODEL environment variable is required');
    }
    if (!AI_PROVIDER) {
      throw new Error('AI_PROVIDER environment variable is required');
    }
    if (!WORDPRESS_URL) {
      throw new Error('WORDPRESS_URL environment variable is required');
    }
    if (!WORDPRESS_USERNAME) {
      throw new Error('WORDPRESS_USERNAME environment variable is required');
    }
    if (!WORDPRESS_PASSWORD) {
      throw new Error('WORDPRESS_PASSWORD environment variable is required');
    }
    
    // Generate AI content
    const content = await generateAIContent();
    console.log('✅ AI content generated successfully');
    console.log(`📝 Title: ${content.title}`);
    console.log(`📄 Content length: ${content.content.length} characters`);
    
    // Post to WordPress
    console.log('📤 Posting to WordPress...');
    const result = await postToWordPress(content);
    console.log('✅ Successfully posted to WordPress');
    console.log(`🔗 Post ID: ${result.id}`);
    console.log(`🔗 Post URL: ${result.link}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { generateAIContent, postToWordPress };
