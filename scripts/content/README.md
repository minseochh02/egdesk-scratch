# Content Generation Scripts

This directory contains scripts for automated blog content generation and upload to WordPress sites.

## Scripts

### `generate-and-upload-blog.js`

Main script for generating AI-powered blog content and uploading it to WordPress.

**Purpose:** 
- Generate structured blog content using AI (Gemini)
- Generate accompanying images using AI
- Upload images to WordPress media library
- Create and publish blog posts with embedded images
- Track topic usage for balanced content generation

**Usage:**
```bash
# Run directly (for testing)
node scripts/content/generate-and-upload-blog.js

# Run with task ID (when called by scheduler)
node scripts/content/generate-and-upload-blog.js <task-id>
```

**Required Environment Variables:**
- `GEMINI_API_KEY`: Google Gemini API key for content/image generation
- `WORDPRESS_URL`: WordPress site URL (e.g., https://example.com)
- `WORDPRESS_USERNAME`: WordPress username
- `WORDPRESS_PASSWORD`: WordPress password or application password

**Optional Environment Variables:**
- `AI_PROVIDER`: AI provider (default: google)
- `AI_MODEL`: AI model to use (default: gemini-2.5-flash)
- `IMAGE_GENERATION_ENABLED`: Enable image generation (default: true)
- `IMAGE_PROVIDER`: Image provider (gemini/dalle)
- `IMAGE_QUALITY`: Image quality (standard/hd)
- `IMAGE_SIZE`: Image size (1024x1024, etc.)
- `IMAGE_STYLE`: Image style (realistic, etc.)
- `IMAGE_ASPECT_RATIO`: Image aspect ratio (landscape/square/portrait)

**Features:**
- **Topic Selection**: Supports multiple topic selection modes:
  - `least-used`: Selects topics that have been used the least
  - `round-robin`: Cycles through topics sequentially
  - `random`: Random topic selection
- **Image Generation**: Automatically generates relevant images using AI
- **WordPress Integration**: Full integration with WordPress REST API
- **Error Handling**: Robust error handling with retry logic
- **Metadata Tracking**: Tracks topic usage and updates task metadata
- **Debugging**: Saves output files for debugging and monitoring

**Dependencies:**
The script imports TypeScript modules from `src/main/blog/`:
- `outline-generator`: Generates structured blog content
- `image-generator`: Generates AI images
- `content-generator`: Utility functions for content processing

**Output:**
- Creates blog posts on WordPress site
- Uploads generated images to WordPress media library
- Saves debug files to `output/` directory:
  - `blog-content-{timestamp}.json`: Generated content data
  - `blog-result-{timestamp}.json`: Final result data
  - `blog-error-{timestamp}.json`: Error information (if any)
  - `latest-*`: Latest versions of above files

**Integration with Scheduler:**
This script is designed to be executed by the EGDesk scheduler system:
1. Scheduler creates tasks with topic metadata
2. Script receives task ID as command line argument
3. Script loads topics from task metadata
4. Script updates topic usage back to task metadata
5. Scheduler manages execution timing and environment variables

**Error Handling:**
- Exponential backoff retry for API calls
- Graceful degradation if image generation fails
- Comprehensive error logging
- Non-zero exit codes for scheduler integration

## File Structure

```
scripts/content/
├── README.md                      # This file
└── generate-and-upload-blog.js    # Main blog generation script

src/main/blog/                     # TypeScript modules (compiled to dist/)
├── outline-generator.ts           # AI content generation
├── image-generator.ts             # AI image generation
├── content-generator.ts           # Content processing utilities
└── utils.ts                       # Common utilities

output/                            # Generated debug files
├── blog-content-*.json            # Generated content data
├── blog-result-*.json             # Execution results
├── blog-error-*.json              # Error logs
└── latest-*.json                  # Latest versions
```

## Development

**Prerequisites:**
1. TypeScript modules must be compiled: `npm run build`
2. Required npm packages: `mime`, `node-fetch`, `form-data`
3. Valid API keys configured in environment

**Testing:**
1. Set required environment variables
2. Run script directly: `node scripts/content/generate-and-upload-blog.js`
3. Check output files in `output/` directory
4. Verify WordPress post creation

**Debugging:**
- Check output files for detailed execution logs
- Verify environment variables are set correctly
- Test WordPress API access manually
- Check Gemini API quota and limits

## Maintenance

**Regular Tasks:**
- Monitor output files for errors
- Check topic usage balance
- Update AI model versions as needed
- Verify WordPress API credentials

**Updates:**
- Modify topic selection logic in `content-generator.ts`
- Update AI prompts in `outline-generator.ts`
- Adjust image generation parameters in `image-generator.ts`
- Update WordPress integration as needed
