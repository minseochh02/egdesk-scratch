import { ParsedContent, Image, ImageMarker } from '../ai-blog';
import generateStructuredBlogContent from '../ai-blog/generate-outline';
import generateImages from '../ai-blog/generate-images';
import { getSQLiteManager } from '../sqlite/manager';
import { SQLiteTaskManager } from '../sqlite/tasks';
import generateOutline from '../ai-blog/generate-outline';
import { ipcMain } from 'electron';
import https from 'https';
import { URL } from 'url';

/**
 * Select a topic based on the selection mode
 */
function selectTopic(topics: any[], mode: string = 'least-used') {
  if (!topics || topics.length === 0) {
    throw new Error('No topics available for selection');
  }

  switch (mode) {
    case 'random':
      return selectRandomTopic(topics);
    case 'round-robin':
      return selectRoundRobinTopic(topics);
    case 'least-used':
    default:
      return selectLeastUsedTopic(topics);
  }
}

function selectRoundRobinTopic(topics: any[]) {
  const sortedTopics = topics.sort((a, b) => {
    if (!a.lastUsed && !b.lastUsed) return 0;
    if (!a.lastUsed) return -1;
    if (!b.lastUsed) return 1;
    return new Date(a.lastUsed).getTime() - new Date(b.lastUsed).getTime();
  });
  return sortedTopics[0];
}

function selectRandomTopic(topics: any[]) {
  const randomIndex = Math.floor(Math.random() * topics.length);
  return topics[randomIndex];
}

function selectLeastUsedTopic(topics: any[]) {
  const sortedTopics = topics.sort((a, b) => (a.usageCount || 0) - (b.usageCount || 0));
  return sortedTopics[0];
}

/**
 * Generate and upload blog content
 */
ipcMain.handle('generate-and-upload-wordpress-blog', async (event, params: {
  taskId: string;
  topics?: any[];
  topicSelectionMode?: string;
  wordpressSettings?: any;
  aiSettings?: any;
}) => {
  try {
    const { taskId, topics, topicSelectionMode = 'least-used', wordpressSettings, aiSettings } = params;
    
    console.log('🚀 Starting blog generation and upload...');
    console.log(`🆔 Task ID: ${taskId}`);

    // Get SQLite task manager
    const sqliteManager = getSQLiteManager();
    if (!sqliteManager.isAvailable()) {
      throw new Error('SQLite not available');
    }
    
    const taskManager = sqliteManager.getTaskManager();
    
    // Get task from SQLite
    const task = taskManager.getTask(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    console.log(`📋 Task: ${task.name}`);

    let selectedTopic;
    let topicsToUpdate: any[] = [];

    if (topics && topics.length > 0) {
      // Use provided topics for selection
      selectedTopic = selectTopic(topics, topicSelectionMode);
      topicsToUpdate = topics;
      console.log(`📝 Selected topic from provided list: ${selectedTopic.name || selectedTopic.topic}`);
    } else {
      // Get topics from SQLite for this task
      const sqliteTopics = taskManager.getTopicsForTask(taskId);
      if (sqliteTopics.length === 0) {
        throw new Error('No topics found for this task');
      }
      
      // Use task's stored topic selection mode if not provided
      const selectionMode = topicSelectionMode || task.topicSelectionMode || 'least-used';
      selectedTopic = selectTopic(sqliteTopics, selectionMode);
      topicsToUpdate = sqliteTopics;
      console.log(`📝 Selected topic from SQLite: ${selectedTopic.name} (mode: ${selectionMode})`);
    }

    // Update topic usage in SQLite
    if (selectedTopic.id) {
      taskManager.incrementTopicUsage(selectedTopic.id);
      console.log(`📊 Updated usage count for topic: ${selectedTopic.name}`);
    }

    // Set up environment variables for AI and WordPress
    if (aiSettings) {
      process.env.GEMINI_API_KEY = aiSettings.apiKey;
      process.env.AI_PROVIDER = aiSettings.provider;
      process.env.AI_MODEL = aiSettings.model;
      process.env.IMAGE_GENERATION_ENABLED = aiSettings.imageGenerationEnabled ? 'true' : 'false';
      process.env.IMAGE_PROVIDER = aiSettings.imageProvider;
      process.env.IMAGE_QUALITY = aiSettings.imageQuality;
      process.env.IMAGE_SIZE = aiSettings.imageSize;
      process.env.IMAGE_STYLE = aiSettings.imageStyle;
      process.env.IMAGE_ASPECT_RATIO = aiSettings.imageAspectRatio;
    }

    if (wordpressSettings) {
      process.env.WORDPRESS_URL = wordpressSettings.url;
      process.env.WORDPRESS_USERNAME = wordpressSettings.username;
      process.env.WORDPRESS_PASSWORD = wordpressSettings.password;
    }

    // Check required environment variables
    const requiredVars = ['GEMINI_API_KEY', 'WORDPRESS_URL', 'WORDPRESS_USERNAME', 'WORDPRESS_PASSWORD'];
    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        throw new Error(`${varName} environment variable is required`);
      }
    }

    // Generate blog content
    console.log('\n🤖 Generating blog outline...');
    const topicText = selectedTopic.name || selectedTopic.topic;
    const outline = await generateOutline(topicText);
    
    console.log('\n🎨 Generating images...');
    const parsedContent = await generateImages(outline);

    // Create task execution record
    const { v4: uuidv4 } = require('uuid');
    const executionId = uuidv4();
    const execution = {
      id: executionId,
      taskId: taskId,
      startTime: new Date(),
      status: 'completed' as const,
      output: `Blog generated successfully for topic: ${topicText}`,
      createdAt: new Date()
    };

    taskManager.createExecution(execution);

    // Update task statistics
    const updatedTask = {
      ...task,
      lastRun: new Date(),
      runCount: task.runCount + 1,
      successCount: task.successCount + 1,
      nextRun: undefined // Will be calculated by scheduler
    };
    
    taskManager.updateTask(taskId, updatedTask);

    console.log('✅ Blog generation completed successfully!');
    
    return {
      success: true,
      data: {
        taskId,
        topic: topicText,
        content: parsedContent,
        executionId,
        imagesGenerated: parsedContent.images?.length || 0
      }
    };

  } catch (error) {
    console.error('❌ Error in blog generation:', error);
    
    // Create failed execution record
    if (params.taskId) {
      try {
        const sqliteManager = getSQLiteManager();
        if (sqliteManager.isAvailable()) {
          const taskManager = sqliteManager.getTaskManager();
          const { v4: uuidv4 } = require('uuid');
          const executionId = uuidv4();
          const execution = {
            id: executionId,
            taskId: params.taskId,
            startTime: new Date(),
            status: 'failed' as const,
            output: `Blog generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            error: error instanceof Error ? error.message : 'Unknown error',
            createdAt: new Date()
          };
          taskManager.createExecution(execution);

          // Update task failure count
          const task = taskManager.getTask(params.taskId);
          if (task) {
            const updatedTask = {
              ...task,
              lastRun: new Date(),
              runCount: task.runCount + 1,
              failureCount: task.failureCount + 1
            };
            taskManager.updateTask(params.taskId, updatedTask);
          }
        }
      } catch (updateError) {
        console.error('❌ Error updating task failure:', updateError);
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

export default async function constructBlog(topic: string) {
    const WORDPRESS_URL = process.env.WORDPRESS_URL;
    const WORDPRESS_USERNAME = process.env.WORDPRESS_USERNAME;
    const WORDPRESS_PASSWORD = process.env.WORDPRESS_PASSWORD;

    if (!WORDPRESS_URL || !WORDPRESS_USERNAME || !WORDPRESS_PASSWORD) {
        throw new Error('Missing WordPress configuration');
    }

    // generate blog content with image markers
    const blogContent = await generateStructuredBlogContent(topic);

    // generate images and upload to wordpress
    const blogContentWithImages = await generateImages(blogContent);

    const baseUrl = WORDPRESS_URL.replace(/\/$/, '');
    const endpoint = `${baseUrl}/wp-json/wp/v2/posts`;

    // Find featured image (first image with placement 'featured' or first image)
    const featuredImage = (blogContentWithImages.images || []).find((img: Image) => img.placement === 'featured') || (blogContentWithImages.images || [])[0];
    const featuredMediaId = featuredImage?.wordpress?.id ? Number(featuredImage.wordpress.id) : undefined;
    
    // Replace image markers in content using UUID mapping from markers → images
    let updatedContent = blogContentWithImages.content;
    if ((blogContentWithImages.images && blogContentWithImages.images.length > 0) && (blogContentWithImages.markers && blogContentWithImages.markers.length > 0)) {
        console.log(`🔄 Replacing image markers in content using UUID mapping...`);
        updatedContent = replaceImageMarkersByUuid(
          blogContentWithImages.content,
          blogContentWithImages.markers,
          blogContentWithImages.images
        );
    }

    
    return { blogContentWithImages };
}

function replaceImageMarkersByUuid(content: string, markers: ImageMarker[], images: Image[]) {
  // Replace [IMAGE:description:placement] markers with WordPress image shortcodes using marker/image UUID mapping
  const imageMarkerRegex = /\[IMAGE:([^:]+):([^\]]+)\]/g;
  const usedImages = new Set<string>();
  let replacedCount = 0;
  let markerIndex = 0;

  const updatedContent = content.replace(imageMarkerRegex, () => {
    const marker = markers[markerIndex++];
    if (!marker) {
      return '';
    }

    const uploadedImage = images.find(img => img.uuid === marker.uuid && img.wordpress && img.wordpress.id && img.wordpress.url);

    if (uploadedImage && uploadedImage.wordpress && uploadedImage.wordpress.id && !usedImages.has(uploadedImage.wordpress.id)) {
      usedImages.add(uploadedImage.wordpress.id);
      replacedCount++;
      const mediaId = uploadedImage.wordpress.id;
      const src = uploadedImage.wordpress.url;
      const alt = uploadedImage.altText || uploadedImage.description || '';
      const caption = uploadedImage.caption || '';
      return `[caption id="attachment_${mediaId}" align="aligncenter" width="800"]<img class="wp-image-${mediaId}" src="${src}" alt="${alt}" width="800" height="auto" /> ${caption}[/caption]`;
    }

    // If no uploaded image found for this marker's UUID, remove the marker
    return '';
  });

  console.log(`🎉 Image marker replacement (UUID) completed. ${replacedCount} images replaced.`);
  return updatedContent;
}




export async function createPost(blogContentWithImages: ParsedContent): Promise<string> {
    const WORDPRESS_URL = process.env.WORDPRESS_URL;
    const WORDPRESS_USERNAME = process.env.WORDPRESS_USERNAME;
    const WORDPRESS_PASSWORD = process.env.WORDPRESS_PASSWORD;

    if (!WORDPRESS_URL || !WORDPRESS_USERNAME || !WORDPRESS_PASSWORD) {
        throw new Error('Missing WordPress configuration');
    }

    const featuredImage = blogContentWithImages.images?.find((image: Image) => image.placement === 'featured');
    const featuredMediaId = featuredImage?.wordpress?.id ? Number(featuredImage.wordpress.id) : undefined;

    // Replace image markers in content using uploaded WordPress media
    let contentWithImages = blogContentWithImages.content;
    try {
        const markers = (blogContentWithImages as any).markers as ImageMarker[] | undefined;
        const images = blogContentWithImages.images as Image[] | undefined;
        if (markers && markers.length > 0 && images && images.length > 0) {
            console.log(`🔄 Replacing image markers in final content before WordPress post...`);
            contentWithImages = replaceImageMarkersByUuid(
              blogContentWithImages.content,
              markers,
              images
            );
        }
    } catch (e) {
        console.warn('⚠️ Failed to replace image markers, posting raw content:', e);
    }

    const payload = {
        title: blogContentWithImages.title,
        content: contentWithImages,
        status: 'publish',
        excerpt: blogContentWithImages.excerpt,
        ...(featuredMediaId && { featured_media: featuredMediaId }),
        // Note: categories and tags require integer IDs from WordPress API
        // categories: postData.categories,
        // tags: postData.tags
    }

    const auth = Buffer.from(`${WORDPRESS_USERNAME}:${WORDPRESS_PASSWORD}`).toString('base64');
    const postDataJson = JSON.stringify(payload);

    const baseUrl = WORDPRESS_URL.replace(/\/$/, '');
    const endpoint = `${baseUrl}/wp-json/wp/v2/posts`;

    const requestOptions = {
        hostname: new URL(endpoint).hostname,
        port: new URL(endpoint).port || 443,
        path: new URL(endpoint).pathname,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${auth}`,
            'Content-Length': Buffer.byteLength(postDataJson)
        }
    }
	return new Promise((resolve, reject) => {
        const makeRequest = (url: string, requestOptions: any) => {
          const req = https.request(requestOptions, (res) => {
            let responseData = '';
    
            res.on('data', (chunk) => {
              responseData += chunk;
            });
    
            res.on('end', () => {
              console.log(`📊 WordPress Post API Response: ${res.statusCode}`);
              
              // Handle redirects
              if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                console.log(`🔄 Following redirect to: ${res.headers.location}`);
                const redirectUrl = new URL(res.headers.location, url);
                const redirectOptions = {
                  ...requestOptions,
                  hostname: redirectUrl.hostname,
                  port: redirectUrl.port || 443,
                  path: redirectUrl.pathname + redirectUrl.search
                };
                makeRequest(redirectUrl.toString(), redirectOptions);
                return;
              }
              
				try {
                const parsed = JSON.parse(responseData);
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                  console.log(`✅ Successfully created WordPress post`);
                  console.log(`🔗 Post ID: ${parsed.id}`);
                  console.log(`🔗 Post URL: ${parsed.link}`);
                  if (featuredMediaId) {
                    console.log(`🖼️  Featured image ID: ${featuredMediaId}`);
                  }
						resolve(parsed.link);
                } else {
                  console.error(`❌ WordPress Post API Error: ${res.statusCode}`);
                  console.error(`📄 Response:`, parsed);
                  reject(new Error(`WordPress Post API request failed: ${res.statusCode} - ${parsed.message || responseData}`));
                }
              } catch (error: any) {
                console.error(`❌ Failed to parse WordPress response:`, error.message);
                console.error(`📄 Raw response:`, responseData);
                
                if (responseData.includes('302 Found') || responseData.includes('expiration.html')) {
                  reject(new Error(`WordPress site appears to be expired or suspended. The domain is redirecting to an expiration page. Please check your hosting status.`));
                } else {
                  reject(new Error(`Failed to parse WordPress response: ${error.message}`));
                }
              }
            });
          });
    
          req.on('error', (error) => {
            console.error(`❌ WordPress Post API request error:`, error.message);
            reject(new Error(`WordPress Post API request error: ${error.message}`));
          });
    
          req.write(postDataJson);
          req.end();
        };
    
		makeRequest(endpoint, requestOptions);
      });

      
}