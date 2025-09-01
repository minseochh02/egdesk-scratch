/**
 * Example usage of Gemini 2.0 models in CodespaceVectorService
 * 
 * This file demonstrates how to use the enhanced Gemini 2.0 support
 * for codespace vector analysis and AI-powered search.
 */

import { CodespaceVectorService, GEMINI_2_0_MODELS } from './codespaceVectorService';
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
export async function analyzeCodespaceWithGemini2() {
  const service = CodespaceVectorService.getInstance();
  
  // Configure AI with Gemini 2.0 Flash Lite (free tier)
  service.configureAI(exampleAIKey, GEMINI_2_0_MODELS.FLASH_LITE);
  
  // Get available Gemini 2.0 models
  const availableModels = service.getAvailableGemini2Models();
  console.log('Available Gemini 2.0 models for codespace analysis:', availableModels);
  
  // Get recommended model for codespace analysis
  const recommendedModel = service.getRecommendedGemini2ModelForCodespace();
  console.log('Recommended model for codespace analysis:', recommendedModel);
  
  // Get current AI configuration
  const aiConfig = service.getAIConfig();
  console.log('Current AI configuration:', aiConfig);
  
  // Get performance metrics
  const metrics = service.getGemini2PerformanceMetrics();
  console.log('Gemini 2.0 performance metrics:', metrics);
  
  try {
    // Analyze codespace (this will use the configured AI model)
    const workspacePath = '/path/to/your/project';
    const context = await service.analyzeCodespace(workspacePath);
    
    console.log('Codespace analyzed:', {
      totalFiles: context.totalFiles,
      totalLines: context.totalLines,
      languages: context.languages
    });
    
    // Perform AI-powered search
    const searchResults = await service.searchCodespace('Find authentication and user management files', 10);
    console.log('AI search results:', searchResults);
    
    // Get AI-powered insights about the codespace
    const insights = await service.getCodespaceInsights('Analyze this project structure and identify key components');
    if (insights.success) {
      console.log('AI-generated insights:', insights.insights);
    } else {
      console.error('Failed to get insights:', insights.error);
    }
    
    // Get cache status with AI configuration
    const cacheStatus = service.getCacheStatus();
    console.log('Cache status with AI config:', cacheStatus);
    
  } catch (error) {
    console.error('Error analyzing codespace with Gemini 2.0:', error);
  }
}

// Example of switching between different Gemini 2.0 models
export async function compareGemini2ModelsForCodespace() {
  const service = CodespaceVectorService.getInstance();
  
  const models = [
    GEMINI_2_0_MODELS.FLASH_LITE,      // Free tier
    GEMINI_2_0_MODELS.FLASH,           // Paid tier
    GEMINI_2_0_MODELS.FLASH_EXP        // Experimental
  ];
  
  for (const model of models) {
    console.log(`\n--- Testing ${model} ---`);
    
    // Configure the service with this model
    service.configureAI(exampleAIKey, model);
    
    // Get performance metrics
    const metrics = service.getGemini2PerformanceMetrics();
    console.log('Performance metrics:', {
      model: metrics.currentModel,
      costPerSearch: metrics.costAnalysis.costPerSearch,
      recommendations: metrics.recommendations
    });
    
    // Test a simple search
    try {
      const results = await service.searchCodespace('Find main entry point', 5);
      console.log(`Search results with ${model}:`, results.length, 'files found');
    } catch (error) {
      console.error(`Search failed with ${model}:`, error);
    }
  }
}

// Example of cost optimization
export async function optimizeGemini2Costs() {
  const service = CodespaceVectorService.getInstance();
  
  // Start with the most expensive model
  service.configureAI(exampleAIKey, GEMINI_2_0_MODELS.FLASH);
  
  // Get initial cost analysis
  let metrics = service.getGemini2PerformanceMetrics();
  console.log('Initial cost analysis:', metrics.costAnalysis);
  
  // If cost is too high, switch to free tier
  if (metrics.costAnalysis.costPerSearch > 0.01) {
    console.log('💰 Cost too high, switching to free tier...');
    service.configureAI(exampleAIKey, GEMINI_2_0_MODELS.FLASH_LITE);
    
    metrics = service.getGemini2PerformanceMetrics();
    console.log('New cost analysis:', metrics.costAnalysis);
    console.log('Recommendations:', metrics.recommendations);
  }
}

// Example of getting insights for different aspects
export async function getComprehensiveCodespaceInsights() {
  const service = CodespaceVectorService.getInstance();
  service.configureAI(exampleAIKey, GEMINI_2_0_MODELS.FLASH_LITE);
  
  const insightQueries = [
    'Analyze the project architecture and identify main components',
    'Find potential security vulnerabilities in the codebase',
    'Identify code duplication and suggest refactoring opportunities',
    'Analyze the database structure and relationships',
    'Find performance bottlenecks and optimization opportunities'
  ];
  
  for (const query of insightQueries) {
    console.log(`\n🔍 Getting insights for: ${query}`);
    
    try {
      const insights = await service.getCodespaceInsights(query);
      if (insights.success) {
        console.log('✅ Insights generated successfully');
        console.log('Model used:', insights.model);
        console.log('Timestamp:', insights.timestamp);
        // You could display this in the UI
        console.log('Insights:', insights.insights);
      } else {
        console.error('❌ Failed to get insights:', insights.error);
      }
    } catch (error) {
      console.error('❌ Error getting insights:', error);
    }
  }
}

// Example of enabling/disabling AI search
export async function toggleAISearch() {
  const service = CodespaceVectorService.getInstance();
  
  // Disable AI search
  service.setAISearchEnabled(false);
  console.log('AI search disabled');
  
  // This will now use basic search instead of AI-powered search
  const results = await service.searchCodespace('Find configuration files', 5);
  console.log('Basic search results:', results.length, 'files found');
  
  // Re-enable AI search
  service.setAISearchEnabled(true);
  console.log('AI search re-enabled');
  
  // This will now use AI-powered search again
  const aiResults = await service.searchCodespace('Find configuration files', 5);
  console.log('AI search results:', aiResults.length, 'files found');
}

// Export the constants for easy access
export { GEMINI_2_0_MODELS };
