# Naver Blog Automation with AI-Generated Images

This document describes the new functionality that allows generating AI-created dog images using Gemini and automatically pasting them into Naver Blog posts.

## Features

- 🐕 **AI Image Generation**: Generate high-quality dog images using Gemini AI
- 📋 **Clipboard Integration**: Automatically copy generated images to clipboard
- 📝 **Blog Automation**: Seamlessly integrate image generation with Naver Blog posting
- 🎨 **Custom Prompts**: Support for custom image generation prompts
- 🔄 **Fallback Support**: Graceful handling when Chrome is not available

## Components

### 1. Image Generation (`src/main/ai-blog/generate-dog-image.ts`)

Generates dog images using Gemini AI and handles clipboard operations.

**Key Functions:**
- `generateDogImage(prompt?)`: Generates a dog image with optional custom prompt
- `copyImageToClipboard(imagePath)`: Copies image to clipboard (macOS)
- `generateAndCopyDogImage(prompt?)`: Complete workflow for generation and clipboard copy

### 2. Enhanced Automation (`src/main/naver-blog-with-image.js`)

Enhanced version of the Naver Blog automation that includes image pasting functionality.

**Key Features:**
- Automatic image generation before blog posting
- Clipboard-based image pasting into blog editor
- Enhanced error handling and logging
- Support for custom image prompts

### 3. IPC Handlers (`src/main/naver-blog-handlers.ts`)

Electron IPC handlers for the new functionality.

**Available Handlers:**
- `naver-blog-generate-dog-image`: Generate and copy dog image to clipboard
- `naver-blog-automation-with-image`: Complete blog automation with image
- `naver-blog-generate-dog-image-only`: Generate image without automation

## Usage

### Prerequisites

1. Set up your Gemini API key:
   ```bash
   export GEMINI_API_KEY="your-gemini-api-key"
   ```

2. Ensure you have Chrome installed (or the system will fall back to Chromium)

### Basic Usage

#### 1. Generate Dog Image Only

```javascript
const { generateAndCopyDogImage } = require('./src/main/ai-blog/generate-dog-image');

// Generate with default prompt
const result = await generateAndCopyDogImage();

// Generate with custom prompt
const result = await generateAndCopyDogImage('A cute poodle in a park');
```

#### 2. Complete Blog Automation with Image

```javascript
const { runNaverBlogWithImage } = require('./src/main/naver-blog-with-image');

const result = await runNaverBlogWithImage(
  'your-naver-username',
  'your-naver-password',
  null, // proxy URL (optional)
  'My Blog Post with AI Dog Image',
  'This post features an AI-generated dog image!',
  '#ai #dog #blog',
  true, // include dog image
  'A golden retriever playing in a garden' // custom prompt
);
```

#### 3. Using IPC Handlers (from Renderer Process)

```javascript
// Generate dog image and copy to clipboard
const imageResult = await window.electronAPI.invoke('naver-blog-generate-dog-image', {
  prompt: 'A cute labrador puppy'
});

// Run complete automation
const automationResult = await window.electronAPI.invoke('naver-blog-automation-with-image', {
  username: 'your-username',
  password: 'your-password',
  title: 'AI Dog Image Post',
  content: 'Check out this AI-generated dog!',
  tags: '#ai #dog',
  includeDogImage: true,
  dogImagePrompt: 'A friendly golden retriever'
});
```

### Testing

Run the test script to verify functionality:

```bash
# Set environment variables
export GEMINI_API_KEY="your-api-key"
export NAVER_USERNAME="your-username"
export NAVER_PASSWORD="your-password"

# Run test
node scripts/test-naver-blog-with-image.js
```

## Configuration

### Environment Variables

- `GEMINI_API_KEY`: Required for image generation
- `NAVER_USERNAME`: Your Naver account username
- `NAVER_PASSWORD`: Your Naver account password
- `PROXY_URL`: Optional proxy URL for automation

### Image Generation Settings

The image generation uses the following default settings:
- **Model**: `gemini-2.5-flash-image-preview`
- **Default Prompt**: "A cute, friendly golden retriever dog sitting in a park, high quality, photorealistic, professional photography style, bright and cheerful lighting"
- **Output Format**: PNG (with fallback to detected format)
- **Retry Logic**: 3 retries with 2-second base delay

## File Structure

```
src/main/
├── ai-blog/
│   └── generate-dog-image.ts          # Image generation logic
├── naver-blog-with-image.js           # Enhanced automation
├── naver-blog-handlers.ts             # IPC handlers
└── main.ts                            # Updated with new handlers

scripts/
└── test-naver-blog-with-image.js      # Test script

docs/
└── naver-blog-image-automation.md     # This documentation
```

## Error Handling

The system includes comprehensive error handling:

1. **API Errors**: Retry logic for Gemini API calls
2. **Browser Errors**: Fallback to Chromium if Chrome unavailable
3. **Clipboard Errors**: Graceful degradation if clipboard copy fails
4. **Network Errors**: Timeout handling for page loads and element interactions

## Troubleshooting

### Common Issues

1. **"GEMINI_API_KEY environment variable is required"**
   - Set your Gemini API key: `export GEMINI_API_KEY="your-key"`

2. **"Chrome not found, using default Chromium"**
   - Install Chrome or the system will use bundled Chromium

3. **"Failed to copy image to clipboard"**
   - Ensure you're running on macOS (clipboard functionality is macOS-specific)
   - Check file permissions for the generated image

4. **"Failed to paste image"**
   - Ensure the image was successfully copied to clipboard
   - Check that the blog editor is ready to receive paste operations

### Debug Mode

Enable detailed logging by setting:
```bash
export DEBUG=naver-blog:*
```

## Future Enhancements

- [ ] Support for other image types (not just dogs)
- [ ] Multiple image generation and pasting
- [ ] Cross-platform clipboard support
- [ ] Image optimization before pasting
- [ ] Integration with other blog platforms

## Contributing

When adding new features:

1. Follow the existing code structure
2. Add comprehensive error handling
3. Include logging for debugging
4. Update this documentation
5. Add test cases for new functionality
