import { getSQLiteManager } from '../sqlite/sqlite-manager';
import { SQLiteTaskManager } from '../sqlite/tasks';
import generateOutline from '../ai-blog/generate-outline';
import generateImages from '../ai-blog/generate-images';
import { ParsedContent, Image } from '../ai-blog/index';
import { ipcMain } from 'electron';

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
ipcMain.handle('generate-and-upload-blog', async (event, params: {
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