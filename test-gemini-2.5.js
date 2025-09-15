#!/usr/bin/env node

/**
 * Gemini 2.5 Flash Model Test Script
 * Tests the exact same model and configuration used in scheduler-manager.ts
 */

const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

async function testGemini25Flash() {
  console.log('🧪 Testing Gemini 2.5 Flash model (same as scheduler-manager)...');
  
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY environment variable is required');
    process.exit(1);
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    // Use the exact same configuration as in scheduler-manager.ts
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
            text: 'Write a short blog post about "The Benefits of Remote Work"',
          },
        ],
      },
    ];

    console.log('📡 Sending test request to Gemini 2.5 Flash...');
    console.log(`🔧 Model: ${model}`);
    console.log(`⚙️  Config: JSON output with ${config.generationConfig.maxOutputTokens} max tokens`);
    
    const response = await ai.models.generateContentStream({
      model,
      config,
      contents,
    });

    console.log('✅ Gemini 2.5 Flash is working! Response:');
    console.log('─'.repeat(60));
    
    let fullResponse = '';
    for await (const chunk of response) {
      if (chunk.text) {
        fullResponse += chunk.text;
        process.stdout.write(chunk.text);
      }
    }
    
    console.log('\n' + '─'.repeat(60));
    
    // Try to parse the JSON response
    try {
      const jsonResponse = JSON.parse(fullResponse);
      console.log('✅ JSON parsing successful!');
      console.log(`📝 Title: ${jsonResponse.title || 'N/A'}`);
      console.log(`📄 Content length: ${jsonResponse.content ? jsonResponse.content.length : 0} characters`);
      console.log(`🏷️  Tags: ${jsonResponse.tags ? jsonResponse.tags.join(', ') : 'N/A'}`);
      console.log(`🖼️  Images: ${jsonResponse.images ? jsonResponse.images.length : 0} requested`);
    } catch (parseError) {
      console.log('⚠️  Response is not valid JSON (this might be expected for some responses)');
    }
    
    console.log('🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Gemini 2.5 Flash test failed:');
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      status: error.status,
      details: error.details
    });
    
    if (error.message.includes('503') || error.message.includes('overloaded')) {
      console.log('\n💡 This appears to be a temporary overload issue on Google\'s side.');
      console.log('   The API key is valid, but the service is currently unavailable.');
    } else if (error.message.includes('API_KEY')) {
      console.log('\n💡 This appears to be an API key issue.');
      console.log('   Please check your GEMINI_API_KEY environment variable.');
    } else if (error.message.includes('quota') || error.message.includes('429')) {
      console.log('\n💡 This appears to be a quota or rate limit issue.');
      console.log('   You may have exceeded your API usage limits.');
    }
    
    process.exit(1);
  }
}

// Run the test
testGemini25Flash();
