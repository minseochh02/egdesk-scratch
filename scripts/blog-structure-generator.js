#!/usr/bin/env node

/**
 * Blog Structure Generator (Phase 1)
 * Generates HTML structure with content placeholders for blog posts
 * This is the first phase of the three-phase blog generation process
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
const TEMPLATE_CATEGORIES = process.env.TEMPLATE_CATEGORIES;
const TEMPLATE_TAGS = process.env.TEMPLATE_TAGS;
const TEMPLATE_AUDIENCE = process.env.TEMPLATE_AUDIENCE;
const TEMPLATE_WORD_LENGTH = process.env.TEMPLATE_WORD_LENGTH;
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
 * PHASE 1: Generate HTML structure with content placeholders
 */
async function generateBlogStructure() {
  console.log(`🏗️ PHASE 1: Generating blog structure with ${AI_PROVIDER}`);
  
  if (!AI_KEY || !AI_MODEL || !AI_PROVIDER) {
    throw new Error('Missing AI configuration: AI_KEY, AI_MODEL, or AI_PROVIDER not set');
  }
  
  const client = await initializeAIClient();
  const systemPrompt = buildStructureSystemPrompt();
  const userPrompt = buildStructureUserPrompt();

  let structureContent;
  try {
    switch (AI_PROVIDER) {
      case 'openai':
        structureContent = await generateOpenAIContent(client, systemPrompt, userPrompt, 2000);
        break;
      case 'anthropic':
        structureContent = await generateAnthropicContent(client, systemPrompt, userPrompt, 2000);
        break;
      case 'google':
        structureContent = await generateGoogleContent(client, systemPrompt, userPrompt, 2000);
        break;
    }
  } catch (error) {
    console.error(`❌ Structure generation failed:`, error.message);
    throw error;
  }

  return parseStructureContent(structureContent);
}

/**
 * Generate content using OpenAI with token limit
 */
async function generateOpenAIContent(client, systemPrompt, userPrompt, maxTokens = 2000) {
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
async function generateAnthropicContent(client, systemPrompt, userPrompt, maxTokens = 2000) {
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
async function generateGoogleContent(client, systemPrompt, userPrompt, maxTokens = 2000) {
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
 * Build system prompt for PHASE 1: Structure generation
 */
function buildStructureSystemPrompt() {
  const targetAudience = TEMPLATE_AUDIENCE || 'general readers';
  const targetLength = TEMPLATE_WORD_LENGTH || '1200-1600 words';
  const tone = TEMPLATE_TONE || 'friendly and practical';
  
  return `You are an expert blog structure architect. Your job is to create a comprehensive HTML structure for a blog post with clearly marked placeholders for content.

## Your Role:
- Create semantic HTML structure with proper headings hierarchy
- Design logical content flow with clear sections
- Plan strategic image placements
- Create content placeholders that will be filled later
- Ensure SEO-friendly structure

## Guidelines:
- Write in English for all text elements
- Use semantic HTML5 tags (article, section, header, main, aside)
- Create proper heading hierarchy (h1, h2, h3)
- Use ${tone} tone for titles and headings
- Target audience: ${targetAudience}
- Plan for ${targetLength} total content

## Structure Requirements:
1. Create 4-7 main sections with clear purposes
2. Each section should have:
   - Unique ID (section_1, section_2, etc.)
   - Proper heading (h2 or h3)
   - Content placeholder: <!-- CONTENT_PLACEHOLDER:section_id:instructions -->
   - Image placeholders where appropriate: <!-- IMAGE_PLACEHOLDER:description -->
3. Include introduction and conclusion sections
4. Plan logical content flow and transitions

## Output Format:
Return ONLY clean HTML structure - no explanations, no JSON:

<article class="blog-post">
  <header>
    <h1>Blog Post Title</h1>
    <div class="meta">
      <span class="excerpt">Brief excerpt here</span>
    </div>
  </header>
  
  <main>
    <section id="section_1" class="intro-section">
      <h2>Introduction Heading</h2>
      <!-- IMAGE_PLACEHOLDER:Hero image showing the main topic -->
      <!-- CONTENT_PLACEHOLDER:section_1:Write an engaging introduction that hooks readers and introduces the main topic. Include why this topic matters and what readers will learn. -->
    </section>
    
    <section id="section_2" class="main-content">
      <h2>Main Content Heading</h2>
      <!-- CONTENT_PLACEHOLDER:section_2:Provide detailed information about [specific topic]. Include practical examples and actionable advice. -->
      <!-- IMAGE_PLACEHOLDER:Illustration showing the key concept -->
    </section>
    
    <!-- More sections... -->
    
    <section id="conclusion" class="conclusion-section">
      <h2>Conclusion</h2>
      <!-- CONTENT_PLACEHOLDER:conclusion:Summarize key points and provide a strong call-to-action. -->
    </section>
  </main>
</article>

Remember: 
- Use proper English for all headings and visible text
- Make content placeholders specific and actionable
- Plan image placements strategically
- Keep the structure clean and semantic`;
}

/**
 * Build user prompt for PHASE 1: Structure generation
 */
function buildStructureUserPrompt() {
  const categories = TEMPLATE_CATEGORIES ? TEMPLATE_CATEGORIES.split(',').map(c => c.trim()) : ['General'];
  const tags = TEMPLATE_TAGS ? TEMPLATE_TAGS.split(',').map(t => t.trim()) : [];
  const targetLength = TEMPLATE_WORD_LENGTH || '1200-1600 words';

  let templateInstructions = '';
  if (TEMPLATE_TYPE) {
    const instructions = {
      'bw_weekly_update': 'Create a weekly update format structure including highlights, challenges, metrics, and future plans.',
      'bw_how_to': 'Create a step-by-step guide format including prerequisites, step-by-step explanations, common issues, and next steps.',
      'bw_listicle': 'Create a top 10 list format with clear item separation and conclusion.',
      'bw_announcement': 'Create a product announcement format including new features, benefits, getting started guide, and support links.',
      'bw_case_study': 'Create a case study format including background, problems, solutions, results, and learnings.',
      'custom': 'Create a practical and engaging structure for the given topic.'
    };
    templateInstructions = instructions[TEMPLATE_TYPE] || instructions['custom'];
  }

  return `Please generate an HTML structure for a blog post according to the following specifications:

**Topic:** ${TEMPLATE_TITLE || 'General Topic'}
**Category:** ${categories[0] || 'General'}
**Tags:** ${tags.join(', ') || 'None'}
**Target Length:** ${targetLength}
**Template Type:** ${templateInstructions || 'General blog post'}

**Structure Requirements:**
- Logical and readable section composition
- Include specific content guidelines for each section
- Strategic image placement planning
- SEO-friendly heading structure
- Mobile-friendly design

**Content Focus:**
- Provide practical and actionable information
- Include tips and advice that readers can immediately apply
- Include specific examples and case studies
- Create engaging composition that encourages reader participation

Return only clean HTML structure - no explanations or additional text needed.`;
}

/**
 * Parse structure content from PHASE 1
 */
function parseStructureContent(content) {
  try {
    console.log(`🔍 Parsing structure content (${content.length} characters)`);
    
    // Extract title and excerpt from HTML
    const titleMatch = content.match(/<h1[^>]*>(.*?)<\/h1>/i);
    const excerptMatch = content.match(/<span class="excerpt"[^>]*>(.*?)<\/span>/i);
    
    const title = titleMatch ? titleMatch[1].trim() : TEMPLATE_TITLE || 'AI Generated Post';
    const excerpt = excerptMatch ? excerptMatch[1].trim() : '';
    
    // Extract sections with content placeholders
    const sections = [];
    const sectionRegex = /<section[^>]*id="([^"]*)"[^>]*>([\s\S]*?)<\/section>/gi;
    let sectionMatch;
    
    while ((sectionMatch = sectionRegex.exec(content)) !== null) {
      const sectionId = sectionMatch[1];
      const sectionContent = sectionMatch[2];
      
      // Extract content placeholder instructions
      const placeholderMatch = sectionContent.match(/<!--\s*CONTENT_PLACEHOLDER:([^:]*):([^-]*)\s*-->/i);
      const instructions = placeholderMatch ? placeholderMatch[2].trim() : 'Write engaging content for this section.';
      
      sections.push({
        id: sectionId,
        instructions: instructions,
        originalContent: sectionContent
      });
    }
    
    console.log(`✅ Parsed structure: ${title}`);
    console.log(`📄 Sections found: ${sections.length}`);
    sections.forEach((section, i) => {
      console.log(`   ${i + 1}. ${section.id}: "${section.instructions.substring(0, 50)}..."`);
    });
    
    // Extract image placeholders
    const images = [];
    const imageRegex = /<!--\s*IMAGE_PLACEHOLDER:([^-]*)\s*-->/gi;
    let imageMatch;
    
    while ((imageMatch = imageRegex.exec(content)) !== null) {
      const description = imageMatch[1].trim();
      images.push({
        id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        description: description,
        altText: description,
        caption: description
      });
    }
    
    console.log(`🖼️ Images found: ${images.length}`);
    
    return {
      title: title,
      excerpt: excerpt || `Provides useful information about ${title}.`,
      seoTitle: title.length > 60 ? title.substring(0, 57) + '...' : title,
      metaDescription: excerpt || generateMetaDescription(title),
      tags: TEMPLATE_TAGS ? TEMPLATE_TAGS.split(',').map(t => t.trim()) : [],
      categories: TEMPLATE_CATEGORIES ? TEMPLATE_CATEGORIES.split(',').map(c => c.trim()) : ['General'],
      structure: content,
      sections: sections,
      images: images
    };
    
  } catch (error) {
    console.error('❌ Failed to parse structure content:', error.message);
    throw new Error(`Structure parsing failed: ${error.message}`);
  }
}

/**
 * Generate meta description from content
 */
function generateMetaDescription(content) {
  const plainText = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  return plainText.length > 160 ? plainText.substring(0, 160) + '...' : plainText;
}

/**
 * Main execution function for testing
 */
async function main() {
  try {
    console.log('🚀 Starting Blog Structure Generation (Phase 1)...');
    
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
    
    // Generate blog structure
    console.log('🏗️ Generating blog structure...');
    const structure = await generateBlogStructure();
    console.log('✅ Blog structure generated successfully');
    console.log(`📝 Title: ${structure.title}`);
    console.log(`📄 Sections: ${structure.sections.length}`);
    console.log(`🖼️ Images planned: ${structure.images.length}`);
    
    // Save structure to file for debugging
    const outputFile = path.join(__dirname, `blog-structure-${Date.now()}.html`);
    fs.writeFileSync(outputFile, structure.structure);
    console.log(`💾 Structure saved to: ${outputFile}`);
    
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
  generateBlogStructure, 
  parseStructureContent,
  buildStructureSystemPrompt,
  buildStructureUserPrompt
};
