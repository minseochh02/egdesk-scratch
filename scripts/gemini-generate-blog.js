#!/usr/bin/env node

/**
 * Gemini Blog Content Generation Script
 * This script generates blog content using Google Gemini AI
 * To run this code you need to install the following dependencies:
 * npm install @google/genai mime-types
 * npm install -D @types/node
 */

const { GoogleGenAI } = require('@google/genai');
const mime = require('mime-types');
const { writeFile, writeFileSync } = require('fs');
const path = require('path');

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise<any>} - Result of the function
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
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
 * Save binary file to filesystem
 * @param {string} fileName - The filename to save
 * @param {Buffer} content - The binary content to save
 */
function saveBinaryFile(fileName, content) {
  writeFile(fileName, content, 'utf8', (err) => {
    if (err) {
      console.error(`Error writing file ${fileName}:`, err);
      return;
    }
    console.log(`File ${fileName} saved to file system.`);
  });
}

/**
 * Generate images using Gemini AI
 * @param {string} prompt - The image generation prompt
 * @param {number} count - Number of images to generate
 * @returns {Promise<Array>} - Array of generated image data
 */
async function generateImages(prompt, count = 1) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }

  console.log(`🎨 Generating ${count} image(s) with prompt: "${prompt}"`);

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

  const generatedImages = [];
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
      
      // Save to filesystem for debugging
      saveBinaryFile(imageData.fileName, buffer);
      
      console.log(`✅ Generated image: ${imageData.fileName} (${imageData.size} bytes)`);
    } else if (chunk.text) {
      console.log('📝 Image generation response:', chunk.text);
    }
  }

  console.log(`🎉 Generated ${generatedImages.length} image(s) successfully`);
  return generatedImages;
}

/**
 * Generate blog content using Gemini AI
 * @param {string} topic - The topic for the blog post
 * @returns {Promise<string>} - The generated blog content
 */
async function generateBlogContent(topic) {
  if (!topic) {
    throw new Error('Topic is required');
  }

  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }

  console.log(`🤖 Generating blog content for topic: "${topic}"`);

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  const config = {
    thinkingConfig: {
      thinkingBudget: -1,
    },
    generationConfig: {
      maxOutputTokens: 65536,
    },
    tools: [
      {
        googleSearchRetrieval: {
          dynamicRetrievalConfig: {
            mode: "MODE_DYNAMIC",
            dynamicThreshold: 0.7,
          },
        },
      },
    ],
    systemInstruction: [
      {
        text: `When given a topic, select the most appropriate blog type from the list below and return the corresponding detailed guideline specifically filled with accurate, verifiable information related to that topic. Use Google Search to find the most current and accurate information. Return **ONLY** the formatted guideline text.

1. **Product Explainer** (e.g., "What is a [Product]?")  
  - Intro: Define the product briefly and clearly, addressing the core reader pain point specific to this product.  
  - How It Works: Provide a simple explanation with reference to diagrams or visuals where applicable.  
  - Types / Variants: List specific, well-known sub-categories or variants of the product.  
  - Advantages & Limitations: State balanced pros and cons based on documented sources to build trust.  
  - Applications: List real-world industries and uses with concrete examples.  
  - How to Choose: Provide specific technical criteria used when buying or selecting the product.

2. **Comparison Blog** (e.g., "[Product A] vs [Product B]: Which One Should You Use?")  
  - Intro: State the problem of choosing between the specific products.  
  - Feature Comparison Table: Compare specific, factual features side-by-side.  
  - Use Case Fit: Explain clearly when to use each option based on documented suitability.  
  - Cost & Maintenance: Discuss verified differences in costs and upkeep.  
  - Decision Checklist: Provide concise, factual criteria for decision-making.

3. **How-To / Tutorial** (e.g., "How to [Specific Action with Product]")  
  - Intro: Explain why correct execution of the action is necessary.  
  - Step-By-Step Guide: Numbered steps with reference to photos or diagrams as available.  
  - Common Mistakes & Troubleshooting: List specific known error points and solutions.  
  - Safety Notes: Highlight safety protocols based on standards or best practices.

4. **Buyer's Guide** (e.g., "Choosing the Right [Product Type]")  
  - Intro: Outline the challenge of selecting the right product type.  
  - Key Factors to Consider: List technical factors with references to standards or industry best practices.  
  - Industry Standards: Enumerate relevant certifications or compliance requirements.  
  - Comparison of Popular Models: Include data from trustworthy sources.  
  - Downloadable Checklist: Provide a detailed checklist for product selection.

5. **Application Blog** (e.g., "[Product] in [Specific Industry/Application]")  
  - Intro: Identify the industry challenge or problem.  
  - Why It Matters: Explain the consequences of ignoring the problem, factually supported.  
  - Solution Overview: Describe how the product addresses the challenge.  
  - Case Example: Share a verified real-world installation or use case.  
  - Technical Considerations: Give specific technical details such as ratios, accuracy, or safety.  
  - Future Outlook: Summarize trends in the specific application based on industry reports.

6. **Thought Leadership** (e.g., "Future of [Industry Topic]: [Emerging Technologies]")  
  - Intro: Discuss why the topic is changing or evolving.  
  - Trend #1, #2, #3: Provide 2-3 specific emerging trends supported by evidence or reports.  
  - Impact on Industry: Detail effects on specific sectors.  
  - What's Next: Explain how companies can prepare or innovate.

***

**Refinement notes:**  
- Use Google Search to find the most current and accurate information about the topic
- Prompt explicitly requires fact-based, source-backed content to avoid fabricated detail  
- Bracketed placeholders for topic-specific info should be filled only with verified facts from search results
- Avoid open-ended or generic instructions that invite speculation  
- Restrict to one blog type per prompt for focus
- Always cite sources and include current data, statistics, and recent developments when available

This approach minimizes hallucination by embedding factual accuracy emphasis, structured detail requirements, and real-time search verification.

If a topic lacks verified data for some sections, those sections should be omitted rather than guessed.`,
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

    console.log(`✅ Blog content generated successfully (${fullContent.length} characters)`);
    return fullContent;

  } catch (error) {
    console.error('❌ Error generating blog content:', error.message);
    throw error;
  }
}

/**
 * Main execution function for testing
 */
async function main() {
  try {
    // Get topic from command line argument or use default
    const topic = process.argv[2] || 'Artificial Intelligence in Healthcare';
    const useStructured = process.argv[3] === '--structured';
    const testImages = process.argv[4] === '--test-images';
    
    console.log('🚀 Starting Gemini blog content generation...');
    console.log(`📝 Topic: ${topic}`);
    console.log(`🔧 Mode: ${useStructured ? 'Structured JSON' : 'Plain Text'}`);
    console.log(`🎨 Image Generation: ${testImages ? 'Enabled' : 'Disabled'}`);
    
    if (testImages) {
      // Test image generation only
      console.log('🎨 Testing image generation...');
      const images = await generateImages('A futuristic AI robot writing code on a computer screen, digital art style', 2);
      console.log(`🎉 Generated ${images.length} test images successfully!`);
    } else if (useStructured) {
      const content = await generateStructuredBlogContent(topic);
      console.log('🎉 Structured blog content generation completed successfully!');
    } else {
      const content = await generateBlogContent(topic);
      console.log('🎉 Blog content generation completed successfully!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  main();
}

module.exports = { generateBlogContent, generateStructuredBlogContent, generateImages };
  

/**
 * Generate structured blog content using Gemini AI with JSON output
 * @param {string} topic - The topic for the blog post
 * @returns {Promise<Object>} - The generated blog content as a structured object
 */
async function generateStructuredBlogContent(topic) {
  if (!topic) {
    throw new Error('Topic is required');
  }

  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }

  console.log(`🤖 Generating structured blog content for topic: "${topic}"`);

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
      
      const generatedImages = [];
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
        } catch (error) {
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

    // Save the content to a JSON file for WordPress uploader
    const outputDir = path.join(__dirname, '..', 'output');
    if (!require('fs').existsSync(outputDir)) {
      require('fs').mkdirSync(outputDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = path.join(outputDir, `blog-content-${timestamp}.json`);
    
    writeFileSync(outputFile, JSON.stringify(parsedContent, null, 2));
    console.log(`💾 Blog content saved to: ${outputFile}`);
    
    // Also save a simple version for WordPress uploader
    const simpleOutputFile = path.join(outputDir, 'latest-blog-content.json');
    writeFileSync(simpleOutputFile, JSON.stringify(parsedContent, null, 2));
    console.log(`💾 Latest blog content saved to: ${simpleOutputFile}`);

    return parsedContent;

  } catch (error) {
    console.error('❌ Error generating structured blog content:', error.message);
    throw error;
  }
}
  