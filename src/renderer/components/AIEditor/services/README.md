# AI Semantic Keyword Service - Gemini 2.0 Support

This service provides enhanced support for Google's Gemini 2.0 models for semantic keyword generation in code search and analysis.

## Available Gemini 2.0 Models

### 1. **Gemini 2.0 Flash** (`gemini-2.0-flash`)
- **Cost**: $0.10 per 1M input tokens, $0.40 per 1M output tokens
- **Context Window**: 1M tokens
- **Best for**: Production applications requiring fast, reliable performance
- **Features**: Fast response times, good quality output

### 2. **Gemini 2.0 Flash Lite** (`gemini-2.0-flash-lite`)
- **Cost**: FREE
- **Context Window**: 1M tokens
- **Best for**: Development, testing, and cost-sensitive applications
- **Features**: Free tier, good performance, sufficient quality for most use cases

### 3. **Gemini 2.0 Flash Lite Preview** (`gemini-2.0-flash-lite-preview-02-05`)
- **Cost**: $0.075 per 1M input tokens, $0.30 per 1M output tokens
- **Context Window**: 1M tokens
- **Best for**: Early access to new features
- **Features**: Preview version with reduced pricing

### 4. **Gemini 2.0 Pro Experimental** (`gemini-2.0-pro-exp-02-05`)
- **Cost**: FREE (during preview)
- **Context Window**: 1M tokens
- **Best for**: Advanced use cases requiring higher quality
- **Features**: Experimental pro model, free during preview period

### 5. **Gemini 2.0 Flash Experimental** (`gemini-2.0-flash-exp`)
- **Cost**: $0.07 per 1M input tokens, $0.16 per 1M output tokens
- **Context Window**: 1M tokens
- **Best for**: Cost-optimized production applications
- **Features**: Experimental flash model with reduced pricing

## Usage

### Basic Usage

```typescript
import { AISemanticKeywordService, GEMINI_2_0_MODELS } from './aiSemanticKeywordService';

const service = AISemanticKeywordService.getInstance();

// Generate keywords using Gemini 2.0 Flash Lite (free)
const response = await service.generateKeywords(
  aiKey,
  GEMINI_2_0_MODELS.FLASH_LITE,
  request
);
```

### Get Available Models

```typescript
const availableModels = service.getAvailableGemini2Models();
console.log('Available models:', availableModels);
```

### Get Recommended Model

```typescript
const recommendedModel = service.getRecommendedGemini2ModelForKeywords();
// Returns: 'gemini-2.0-flash-lite' (free tier)
```

### Validate Model Names

```typescript
const validation = service.validateGemini2Model('gemini-2.0-flash');
if (validation.isValid) {
  console.log('Valid Gemini 2.0 model');
} else if (validation.suggestions) {
  console.log('Suggestions:', validation.suggestions);
}
```

## Model Selection Guide

### For Development & Testing
- **Use**: `gemini-2.0-flash-lite`
- **Reason**: Free tier, sufficient quality for development

### For Production Applications
- **Use**: `gemini-2.0-flash`
- **Reason**: Reliable performance, good cost/quality balance

### For Cost Optimization
- **Use**: `gemini-2.0-flash-exp`
- **Reason**: Lowest cost among production-ready models

### For Early Access
- **Use**: `gemini-2.0-pro-exp-02-05`
- **Reason**: Free during preview, access to latest features

## API Enhancements

The service includes several Gemini 2.0 specific optimizations:

1. **Model-specific configurations**: Automatic token limits and context windows
2. **Enhanced error handling**: Better error messages for Gemini-specific issues
3. **Optimized parameters**: Automatic top-p, top-k, and candidate count settings
4. **Cost tracking**: Built-in cost information for each model
5. **Validation**: Model name validation with helpful suggestions

## Error Handling

The service provides enhanced error handling for Gemini 2.0 models:

```typescript
try {
  const response = await service.generateKeywords(aiKey, model, request);
  // Handle success
} catch (error) {
  if (service.isGemini2Model(model)) {
    console.error('Gemini 2.0 specific error:', error);
  }
  // Handle error
}
```

## Performance Considerations

- **Flash models**: Fastest response times, good for real-time applications
- **Pro models**: Higher quality output, slightly slower response times
- **Context window**: All models support 1M tokens for large projects
- **Token limits**: Automatic optimization based on model capabilities

## Cost Optimization

1. **Use Flash Lite for development**: Free tier with good performance
2. **Use Flash for production**: Reliable performance at reasonable cost
3. **Monitor usage**: Track input/output token usage for cost management
4. **Batch requests**: Combine multiple keyword requests when possible

## Examples

See `gemini2Example.ts` for complete usage examples including:
- Basic keyword generation
- Model validation
- Model comparison
- Error handling
- Cost analysis

## Migration from Gemini 1.5

If you're currently using Gemini 1.5 models, the transition is straightforward:

```typescript
// Old: gemini-1.5-flash
// New: gemini-2.0-flash

// The API remains the same, just update the model name
const response = await service.generateKeywords(
  aiKey,
  GEMINI_2_0_MODELS.FLASH, // Updated model name
  request
);
```

## Support

For issues specific to Gemini 2.0 models:
1. Check the model validation results
2. Verify your API key has access to Gemini 2.0
3. Review the error logs for Gemini-specific messages
4. Ensure you're using the correct model names from the constants
