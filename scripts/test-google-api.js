#!/usr/bin/env node

/**
 * Test Google AI API call directly
 */

const https = require('https');

// Test with a real API key (replace with actual key for testing)
const API_KEY = process.env.GOOGLE_API_KEY || 'test-key';
const MODEL = 'gemini-2.5-flash';

function testGoogleAPI() {
  const baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  const endpoint = `/models/${MODEL}:generateContent?key=${API_KEY}`;
  
  const requestData = {
    contents: [{
      parts: [{
        text: 'Hello, write a short blog post about interior design.'
      }]
    }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 100
    }
  };

  const postData = JSON.stringify(requestData);
  const url = new URL(endpoint, baseUrl);

  console.log('Testing Google AI API:');
  console.log('URL:', url.toString());
  console.log('Request data:', JSON.stringify(requestData, null, 2));

  const options = {
    hostname: url.hostname,
    port: 443,
    path: url.pathname + url.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = https.request(options, (res) => {
    let responseData = '';

    res.on('data', (chunk) => {
      responseData += chunk;
    });

    res.on('end', () => {
      console.log('Response status:', res.statusCode);
      console.log('Response headers:', res.headers);
      console.log('Response data:', responseData);
      
      try {
        const parsed = JSON.parse(responseData);
        console.log('Parsed response:', JSON.stringify(parsed, null, 2));
      } catch (error) {
        console.log('Failed to parse JSON:', error.message);
      }
    });
  });

  req.on('error', (error) => {
    console.error('Request error:', error.message);
  });

  req.write(postData);
  req.end();
}

testGoogleAPI();
