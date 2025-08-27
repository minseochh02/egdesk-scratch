# AI Keys Manager

A comprehensive management system for AI service API keys, similar to the WordPress configuration pattern in your application.

## Features

- **Multiple AI Providers**: Support for OpenAI, Anthropic, Google AI, Azure OpenAI, and custom providers
- **Secure Storage**: API keys are stored locally using electron-store with encryption
- **Real API Testing**: Test button actually validates API keys by making real API calls
- **Key Management**: Add, edit, delete, and toggle active status of API keys
- **Provider-specific Configuration**: Each provider has its own required fields and validation

## How the Test Button Works

The test button performs **real API calls** to validate your API keys:

### OpenAI
- Makes a GET request to `https://api.openai.com/v1/models`
- Validates your API key and shows available models
- Supports organization ID if configured

### Anthropic
- Makes a POST request to `https://api.anthropic.com/v1/messages`
- Tests with Claude 3 Haiku model
- Validates API key authentication

### Google AI
- Makes a GET request to `https://generativelanguage.googleapis.com/v1beta/models`
- Shows available Gemini and PaLM models
- Validates API key

### Azure OpenAI
- Makes a POST request to your custom endpoint
- Tests the specific deployment you configured
- Validates both API key and endpoint configuration

### Custom Provider
- Makes a GET request to your custom endpoint
- Tests basic connectivity and authentication
- Flexible for any API service

## Test Results

When you click the test button:

1. **Button shows "Testing..."** with a loading indicator
2. **Real API call is made** to the respective service
3. **Results are displayed** below the key card:
   - ✅ **Success**: Shows available models, deployment info, etc.
   - ❌ **Error**: Shows specific error message from the API
4. **Results auto-clear** after 5 seconds
5. **Last used timestamp** is updated on successful tests

## Security Features

- API keys are stored locally on your computer
- Keys are encrypted using electron-store
- No keys are sent to external servers (except for testing)
- Test calls use minimal data (e.g., "Hello" message for chat APIs)

## Usage

1. **Add a new key**: Click "Add New Key" and select your AI provider
2. **Configure fields**: Fill in required API key and provider-specific settings
3. **Test the key**: Click the "🧪 Test" button to validate
4. **View results**: See real-time test results with detailed information
5. **Manage keys**: Edit, delete, or toggle active status as needed

## Example Test Results

### Successful OpenAI Test
```
✅ OpenAI API key is valid. Available models: 67
Details:
{
  "models": ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo", "dall-e-3", "whisper-1"],
  "totalModels": 67
}
```

### Failed Test
```
❌ OpenAI API test failed: Invalid API key
Details:
{
  "error": {
    "message": "Invalid API key",
    "type": "invalid_request_error"
  }
}
```

## Technical Details

- Built with React and TypeScript
- Uses electron-store for secure local storage
- Implements proper error handling and user feedback
- Responsive design that works on all screen sizes
- Follows the same patterns as your WordPress connector
