#!/usr/bin/env node

/**
 * Simple Gemini 2.5 Flash Test (without complex config)
 */

const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

async function testSimpleGemini25() {
  console.log('🧪 Testing Gemini 2.5 Flash with simple configuration...');
  
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY environment variable is required');
    process.exit(1);
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    console.log('📡 Sending simple request to Gemini 2.5 Flash...');
    
    const response = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: 'Write a short paragraph about the benefits of remote work.',
            },
          ],
        },
      ],
    });

    console.log('✅ Response:');
    console.log('─'.repeat(50));
    
    for await (const chunk of response) {
      if (chunk.text) {
        process.stdout.write(chunk.text);
      }
    }
    
    console.log('\n' + '─'.repeat(50));
    console.log('🎉 Simple test completed successfully!');
    
  } catch (error) {
    console.error('❌ Simple test failed:');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

testSimpleGemini25();
