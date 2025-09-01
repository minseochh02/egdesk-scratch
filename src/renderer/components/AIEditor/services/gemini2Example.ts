/**
 * Example usage of Gemini 2.0 models in AISemanticKeywordService
 * 
 * This file demonstrates how to use the enhanced Gemini 2.0 support
 * for semantic keyword generation.
 */

import { AISemanticKeywordService, GEMINI_2_0_MODELS } from './aiSemanticKeywordService';
import { AIKey } from '../../AIKeysManager/types';

// Example AI key for Google/Gemini
const exampleAIKey: AIKey = {
  id: 'gemini-key-1',
  name: 'Gemini API Key',
  providerId: 'google',
  fields: {
    apiKey: 'your-gemini-api-key-here'
  }
};

// Example usage function
export async function generateKeywordsWithGemini2() {
  const service = AISemanticKeywordService.getInstance();
  
  // Get available Gemini 2.0 models
  const availableModels = service.getAvailableGemini2Models();
  console.log('Available Gemini 2.0 models:', availableModels);
  
  // Get recommended model for keyword generation
  const recommendedModel = service.getRecommendedGemini2ModelForKeywords();
  console.log('Recommended model for keywords:', recommendedModel);
  
  // Example request
  const request = {
    userRequest: 'Find authentication and user management related files',
    context: 'Web application with user login, registration, and profile management',
    projectStructure: `
      src/
      ├── components/
      │   ├── Auth/
      │   │   ├── Login.tsx
      │   │   ├── Register.tsx
      │   │   └── Profile.tsx
      │   └── Layout/
      ├── services/
      │   ├── auth.ts
      │   └── user.ts
      ├── pages/
      │   ├── login.tsx
      │   └── dashboard.tsx
      └── utils/
          └── validation.ts
    `,
    targetLanguage: 'TypeScript/React',
    maxKeywords: 10,
    includeSynonyms: true,
    includeTechnicalTerms: true,
    includeFilePatterns: true
  };
  
  try {
    // Generate keywords using Gemini 2.0 Flash Lite (free tier)
    const response = await service.generateKeywords(
      exampleAIKey,
      GEMINI_2_0_MODELS.FLASH_LITE,
      request
    );
    
    if (response.success) {
      console.log('Generated keywords:', response.keywords);
      console.log('Model used:', response.metadata?.model);
      console.log('Processing time:', response.metadata?.processingTime, 'ms');
    } else {
      console.error('Failed to generate keywords:', response.error);
    }
    
  } catch (error) {
    console.error('Error generating keywords:', error);
  }
}

// Example of model validation
export function validateGeminiModels() {
  const service = AISemanticKeywordService.getInstance();
  
  const testModels = [
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-2.0-pro',
    'invalid-model',
    'gemini-1.5-pro'
  ];
  
  testModels.forEach(model => {
    const validation = service.validateGemini2Model(model);
    console.log(`Model "${model}":`, validation);
  });
}

// Example of comparing different Gemini 2.0 models
export function compareGemini2Models() {
  const service = AISemanticKeywordService.getInstance();
  
  const models = [
    GEMINI_2_0_MODELS.FLASH,
    GEMINI_2_0_MODELS.FLASH_LITE,
    GEMINI_2_0_MODELS.PRO_EXP
  ];
  
  models.forEach(model => {
    const config = service.getGemini2Config(model);
    if (config) {
      console.log(`${model}:`, {
        maxTokens: config.maxTokens,
        contextWindow: config.contextWindow,
        cost: config.cost,
        supportsReasoning: config.supportsReasoning
      });
    }
  });
}

// Export the constants for easy access
export { GEMINI_2_0_MODELS };
