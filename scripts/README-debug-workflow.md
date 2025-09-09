# Debug Workflow Script

This script implements the exact same logic as the debug workflow in `WordPressPostScheduler.tsx`. It performs the complete blog generation workflow:

1. **Generate blog content** with image markers
2. **Generate images** based on markers
3. **Upload images** to WordPress
4. **Edit blog content** to replace markers with media IDs
5. **Create WordPress post** with image references

## Usage

### Prerequisites

1. Ensure you have the required services available:
   - `BlogAIService` from `../src/renderer/services/blogAIService`
   - `BlogImageGenerator` from `../src/renderer/services/blogImageGenerator`
   - `WordPressMediaService` from `../src/renderer/services/wordpressMediaService`

2. Set up environment variables or modify the config object in the script.

### Running the Script

#### Method 1: Using npm script
```bash
npm run debug:workflow
```

#### Method 2: Direct execution
```bash
node scripts/debug-workflow.js
```

#### Method 3: With environment variables
```bash
WORDPRESS_URL="https://your-site.com" \
WORDPRESS_USERNAME="your-username" \
WORDPRESS_PASSWORD="your-password" \
AI_KEY="your-ai-key" \
AI_MODEL="gpt-3.5-turbo" \
AI_PROVIDER="openai" \
node scripts/debug-workflow.js
```

## Configuration

The script uses the following configuration (can be set via environment variables):

### WordPress Settings
- `WORDPRESS_URL`: Your WordPress site URL
- `WORDPRESS_USERNAME`: WordPress username
- `WORDPRESS_PASSWORD`: WordPress password

### AI Settings
- `AI_KEY`: Your AI API key
- `AI_MODEL`: AI model to use (default: gpt-3.5-turbo)
- `AI_PROVIDER`: AI provider (default: openai)

### Image Generation Settings
- `IMAGE_PROVIDER`: Image generation provider (default: dalle)
- `IMAGE_QUALITY`: Image quality (default: standard)
- `IMAGE_SIZE`: Image size (default: 1024x1024)
- `IMAGE_STYLE`: Image style (default: realistic)
- `IMAGE_ASPECT_RATIO`: Image aspect ratio (default: landscape)

## What the Script Does

### Step 1: Generate Blog Content
- Creates a blog post about "AI와 블로그 자동화의 미래" (AI and Blog Automation Future)
- Uses the specified AI model and key
- Generates content with image markers for later processing

### Step 2: Generate Images
- Analyzes the generated content for image markers
- Creates images using the specified image generation provider
- Generates images with appropriate descriptions and placements

### Step 3: Upload Images to WordPress
- Downloads generated images from their URLs
- Uploads them to WordPress using the WordPress REST API
- Retrieves WordPress media IDs for each uploaded image

### Step 4: Edit Blog Content
- Replaces image placeholders with actual WordPress media references
- Handles cases where image upload failed gracefully
- Creates proper HTML img tags with WordPress URLs

### Step 5: Create WordPress Post
- Creates or finds WordPress categories and tags
- Creates a new WordPress post with the processed content
- Sets the post status to "draft" for review
- Includes SEO metadata if available

## Output

The script provides detailed console output showing:
- Progress through each step
- Generated content details
- Image generation results
- Upload status for each image
- Final post creation results
- Summary of the entire workflow

## Error Handling

The script includes comprehensive error handling:
- Validates required configuration
- Handles API failures gracefully
- Continues processing even if some images fail to upload
- Provides detailed error messages for debugging

## Example Output

```
🚀 Starting Debug Workflow...

=== Step 1: 블로그 콘텐츠 생성 중... (이미지 마커 포함) ===
✅ Generated Content: {
  title: "AI와 블로그 자동화의 미래",
  categories: ["IT/기술"],
  tags: ["AI", "블로그", "자동화", "WordPress", "이미지 생성"],
  contentLength: 1543,
  hasImageMarkers: true,
  hasImagePlaceholders: true
}

=== Step 2: 이미지 생성 중... (마커 기반) ===
✅ Generated Images: {
  count: 2,
  images: [
    { id: "img-1", description: "AI automation concept", placement: "intro" },
    { id: "img-2", description: "WordPress dashboard", placement: "conclusion" }
  ]
}

=== Step 3: WordPress에 이미지 업로드 중... (미디어 ID 획득) ===
✅ Uploaded Media: {
  count: 2,
  total: 2,
  success: true,
  media: [
    { id: "img-1", wordpressId: 123, wordpressUrl: "https://site.com/wp-content/uploads/..." },
    { id: "img-2", wordpressId: 124, wordpressUrl: "https://site.com/wp-content/uploads/..." }
  ]
}

=== Step 4: 블로그 콘텐츠 편집 중... (이미지 마커를 미디어 ID로 교체) ===
✅ Processed Content: {
  originalLength: 1543,
  processedLength: 1587,
  hasImageReferences: true
}

=== Step 5: 블로그 포스트 생성 중... (이미지 참조 포함) ===
5.1. 카테고리 및 태그 처리 중...
Category IDs: [5]
Tag IDs: [12, 13, 14, 15, 16]
5.2. Creating WordPress post...
✅ Created Post: {
  id: 456,
  title: "AI와 블로그 자동화의 미래",
  status: "draft",
  link: "https://site.com/ai-blog-automation-future/"
}

🎉 Debug workflow completed successfully!

📊 Summary:
- Generated content: AI와 블로그 자동화의 미래
- Generated images: 2
- Uploaded images: 2
- Created post: 456 (draft)
- Post link: https://site.com/ai-blog-automation-future/

✅ Debug workflow completed successfully!
```

## Troubleshooting

### Common Issues

1. **Service Import Errors**: Make sure the required services are available and properly exported
2. **WordPress Authentication**: Verify your WordPress credentials and ensure the user has proper permissions
3. **AI API Issues**: Check your AI API key and model availability
4. **Image Generation Failures**: Verify your image generation provider settings and API access

### Debug Tips

- Check the console output for detailed error messages
- Verify all environment variables are set correctly
- Test WordPress API access manually using curl or Postman
- Check AI service connectivity and API limits
