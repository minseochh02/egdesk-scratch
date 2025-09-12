#!/usr/bin/env node

/**
 * Blog Content Generator (Phase 2)
 * Generates content for individual sections based on structure placeholders
 * This is the second phase of the three-phase blog generation process
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
const TEMPLATE_AUDIENCE = process.env.TEMPLATE_AUDIENCE;
const TEMPLATE_TONE = process.env.TEMPLATE_TONE;

/**
 * Initialize AI clients based on provider
 */
async function initializeAIClient() {
  try {
    switch (AI_PROVIDER) {
      case 'openai': {
        const { OpenAI } = require('openai');
        return new OpenAI({ apiKey: AI_KEY });
      }
      case 'anthropic': {
        const { Anthropic } = require('@anthropic-ai/sdk');
        return new Anthropic({ apiKey: AI_KEY });
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
 * PHASE 2: Fill individual sections with content
 */
async function fillSectionContent(section, context) {
  console.log(`📝 PHASE 2: Filling section content: ${section.id}`);
  
  if (!AI_KEY || !AI_MODEL || !AI_PROVIDER) {
    throw new Error('Missing AI configuration: AI_KEY, AI_MODEL, or AI_PROVIDER not set');
  }
  
  const client = await initializeAIClient();
  const systemPrompt = buildContentSystemPrompt();
  const userPrompt = buildContentUserPrompt(section, context);

  let sectionContent;
  try {
    switch (AI_PROVIDER) {
      case 'openai':
        sectionContent = await generateOpenAIContent(client, systemPrompt, userPrompt, 1000);
        break;
      case 'anthropic':
        sectionContent = await generateAnthropicContent(client, systemPrompt, userPrompt, 1000);
        break;
      case 'google':
        sectionContent = await generateGoogleContent(client, systemPrompt, userPrompt, 1000);
        break;
    }
  } catch (error) {
    console.error(`❌ Content generation failed for ${section.id}:`, error.message);
    throw error;
  }

  return {
    id: section.id,
    content: sectionContent.trim()
  };
}

/**
 * Generate content for multiple sections in sequence
 */
async function fillAllSections(sections, context) {
  console.log(`📝 PHASE 2: Filling ${sections.length} sections with content`);
  
  const filledSections = [];
  
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    console.log(`📝 Processing section ${i + 1}/${sections.length}: ${section.id}`);
    
    try {
      const filledSection = await fillSectionContent(section, {
        blogTitle: context.blogTitle,
        blogDescription: context.blogDescription,
        totalSections: sections.length,
        currentIndex: i
      });
      
      filledSections.push(filledSection);
      console.log(`✅ Filled section ${section.id}: ${filledSection.content.length} characters`);
      
      // Add a small delay between sections to avoid rate limiting
      if (i < sections.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      console.error(`❌ Failed to fill section ${section.id}:`, error.message);
      // Add a fallback section with error content
      filledSections.push({
        id: section.id,
        content: `<p>An error occurred while generating content for this section. Please try again later.</p>`
      });
    }
  }
  
  return filledSections;
}

/**
 * Generate content using OpenAI with token limit
 */
async function generateOpenAIContent(client, systemPrompt, userPrompt, maxTokens = 1000) {
  try {
    console.log(`🔥 Calling OpenAI API with model: ${AI_MODEL} (max_tokens: ${maxTokens})`);
    
    const response = await client.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
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
 * Generate content using Anthropic with token limit
 */
async function generateAnthropicContent(client, systemPrompt, userPrompt, maxTokens = 1000) {
  try {
    console.log(`🔥 Calling Anthropic API with model: ${AI_MODEL} (max_tokens: ${maxTokens})`);
    
    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: maxTokens,
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
 * Generate content using Google Gemini with token limit
 */
async function generateGoogleContent(client, systemPrompt, userPrompt, maxTokens = 1000) {
  try {
    console.log(`🔥 Calling Google Gemini API with model: ${AI_MODEL} (max_tokens: ${maxTokens})`);
    
    const model = client.getGenerativeModel({ 
      model: AI_MODEL,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: maxTokens,
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
 * Build system prompt for PHASE 2: Content generation
 */
function buildContentSystemPrompt() {
  const targetAudience = TEMPLATE_AUDIENCE || 'general readers';
  const tone = TEMPLATE_TONE || 'friendly and practical';
  
  return `You are an expert content writer. Your job is to write engaging, high-quality content for ONE specific section of a blog post.

## Your Role:
- Write compelling content for the given section only
- Follow the specific instructions provided in the content placeholder
- Create engaging, readable content with practical value
- Use proper HTML formatting within the section

## Writing Guidelines:
- Write in English
- Use ${tone} tone
- Target audience: ${targetAudience}
- Include practical examples and actionable advice
- Write engaging content that provides real value
- Use proper HTML tags: <p>, <ul>, <li>, <strong>, <em>
- Keep paragraphs concise (2-4 sentences)

## Content Requirements:
- Write 100-300 words depending on section importance
- Cover the topic thoroughly but concisely
- Include specific details and examples
- Make it scannable with lists where appropriate
- End naturally without connecting to other sections

## Output Format:
Return ONLY the HTML content for this section - no explanations, no wrappers:

<p>Your engaging opening paragraph that introduces the topic...</p>

<p>Continue with detailed information, examples, and advice...</p>

<ul>
<li>Practical tip or example</li>
<li>Another actionable point</li>
</ul>

<p>Concluding paragraph for this section...</p>

Important: 
- NO section headings (they're already in the structure)
- NO div wrappers or containers
- Just the inner content HTML
- Keep it focused on the specific section topic`;
}

/**
 * Build user prompt for PHASE 2: Content generation
 */
function buildContentUserPrompt(section, context) {
  return `Please write content for the following blog section:

**Blog Title:** ${context.blogTitle}
**Section ID:** ${section.id}
**Section ${context.currentIndex + 1}/${context.totalSections}**

**Section Instructions:**
${section.instructions}

**Context:**
This section is part of a blog post titled "${context.blogTitle}". 
Please write content that fulfills the role this section should play, considering the overall flow of the blog post.

**Writing Requirements:**
- Focus only on this section's content
- Include practical and specific information
- Write content that is easy for readers to understand and actionable
- Use appropriate HTML formatting (p, ul, li, strong, em, etc.)
- Write approximately 100-300 words

Return only the HTML content for this section - exclude titles or containers, just the pure content.`;
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
 * Main execution function for testing
 */
async function main() {
  try {
    console.log('🚀 Starting Blog Content Generation (Phase 2)...');
    
    // Validate required environment variables
    const requiredVars = [
      { name: 'AI_KEY', value: AI_KEY },
      { name: 'AI_MODEL', value: AI_MODEL },
      { name: 'AI_PROVIDER', value: AI_PROVIDER }
    ];

    for (const { name, value } of requiredVars) {
      if (!value) {
        throw new Error(`${name} environment variable is required`);
      }
    }
    
    // Mock sections for testing
    const mockSections = [
      {
        id: 'section_1',
        instructions: 'Write an engaging introduction that captures readers\' attention and emphasizes the importance of blog writing. Explain why blogging matters and what readers will learn from this guide.'
      },
      {
        id: 'section_2',
        instructions: 'Explain specific methodologies including creating target audience personas, popular topic research methods, and keyword analysis tools with practical examples.'
      },
      {
        id: 'section_3',
        instructions: 'Present specific guidelines for writing click-worthy titles, logical content structure, and subheading strategies using real success and failure case studies.'
      }
    ];
    
    const context = {
      blogTitle: 'Effective Blog Writing Methods: Complete Guide for Beginners',
      blogDescription: 'Learn all the methods for creating successful blog posts, from basics to advanced techniques.',
      totalSections: mockSections.length
    };
    
    // Generate content for all sections
    console.log('📝 Generating content for all sections...');
    const filledSections = await fillAllSections(mockSections, context);
    
    console.log('✅ Content generation completed successfully');
    console.log(`📄 Generated content for ${filledSections.length} sections`);
    
    // Save results to file for inspection
    const outputFile = path.join(__dirname, `blog-content-${Date.now()}.json`);
    fs.writeFileSync(outputFile, JSON.stringify({
      context,
      sections: filledSections
    }, null, 2));
    console.log(`💾 Content saved to: ${outputFile}`);
    
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

module.exports = { 
  fillSectionContent, 
  fillAllSections,
  buildContentSystemPrompt,
  buildContentUserPrompt,
  processImageMarkers,
  extractImagesFromContent
};
