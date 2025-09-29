// Scheduled Posts Executor Service
// This service handles the execution of scheduled blog posts

import * as schedule from 'node-schedule';
import { getSQLiteManager } from '../sqlite/manager';

export class ScheduledPostsExecutor {
  private sqliteManager = getSQLiteManager();
  private isRunning = false;
  private executionInterval: NodeJS.Timeout | null = null;
  private scheduledJobs: Map<string, schedule.Job> = new Map();
  
  constructor() {
    // TODO: Initialize scheduler service
  }

  /**
   * Check for any scheduled tasks currently running to prevent duplication
   */
  private async checkForRunningTasks(): Promise<boolean> {
    try {
      // Check if there are any scheduled posts currently being processed
      // This prevents multiple instances from running the same scheduled post
      const scheduledPostsManager = this.sqliteManager.getScheduledPostsManager();
      const allScheduledPosts = await scheduledPostsManager.getAllScheduledPosts();
      
      // Check if any scheduled post is currently being processed
      // (This could be enhanced with a "processing" status field in the future)
      const currentlyProcessing = allScheduledPosts.some(post => 
        post.enabled && post.nextRun && new Date(post.nextRun) <= new Date()
      );
      
      return currentlyProcessing;
    } catch (error) {
      console.error('Error checking for running tasks:', error);
      return false;
    }
  }

  /**
   * Start the scheduler service
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Scheduler service is already running');
      return;
    }

    // Check for any running tasks first
    const hasRunningTasks = await this.checkForRunningTasks();
    if (hasRunningTasks) {
      console.log('Scheduled tasks are already running, skipping start');
      return;
    }

    this.isRunning = true;
    console.log('Starting scheduled posts executor service...');
    
    // Fetch and log all scheduled posts
    await this.fetchAndLogScheduledPosts();
    
    // Schedule all enabled posts
    await this.scheduleAllPosts();
    
    // Set up periodic check for new/updated posts
    this.executionInterval = setInterval(async () => {
      await this.checkAndUpdateSchedules();
    }, 60000); // Check every minute
  }

  /**
   * Fetch scheduled posts from SQLite and console log them
   */
  private async fetchAndLogScheduledPosts(): Promise<void> {
    try {
      const scheduledPostsManager = this.sqliteManager.getScheduledPostsManager();
      const allScheduledPosts = await scheduledPostsManager.getAllScheduledPosts();
      
      console.log('📋 Fetched scheduled posts from SQLite:');
      console.log(`Total scheduled posts: ${allScheduledPosts.length}`);
      
      if (allScheduledPosts.length === 0) {
        console.log('No scheduled posts found');
        return;
      }

      allScheduledPosts.forEach((post, index) => {
        console.log(`\n--- Scheduled Post ${index + 1} ---`);
        console.log(`ID: ${post.id}`);
        console.log(`Title: ${post.title}`);
        console.log(`Connection: ${post.connectionName} (${post.connectionType})`);
        console.log(`Scheduled Time: ${post.scheduledTime}`);
        console.log(`Frequency: ${post.frequencyType} (${post.frequencyValue})`);
        console.log(`Enabled: ${post.enabled}`);
        console.log(`Last Run: ${post.lastRun || 'Never'}`);
        console.log(`Next Run: ${post.nextRun || 'Not scheduled'}`);
        console.log(`Run Count: ${post.runCount}`);
        console.log(`Success Count: ${post.successCount}`);
        console.log(`Failure Count: ${post.failureCount}`);
        console.log(`Created: ${post.createdAt}`);
        console.log(`Updated: ${post.updatedAt}`);
      });

      // Also fetch and log due posts specifically
      const duePosts = await scheduledPostsManager.getDueScheduledPosts();
      console.log(`\n⏰ Due scheduled posts: ${duePosts.length}`);
      
      if (duePosts.length > 0) {
        duePosts.forEach((post, index) => {
          console.log(`\n--- Due Post ${index + 1} ---`);
          console.log(`Title: ${post.title}`);
          console.log(`Next Run: ${post.nextRun}`);
          console.log(`Connection: ${post.connectionName}`);
        });
      }

    } catch (error) {
      console.error('❌ Error fetching scheduled posts:', error);
    }
  }

  /**
   * Schedule all enabled posts using node-schedule
   */
  private async scheduleAllPosts(): Promise<void> {
    try {
      const scheduledPostsManager = this.sqliteManager.getScheduledPostsManager();
      const allScheduledPosts = await scheduledPostsManager.getAllScheduledPosts();
      
      console.log('📅 Scheduling all enabled posts...');
      
      for (const post of allScheduledPosts) {
        if (post.enabled) {
          await this.schedulePost(post);
        }
      }
      
      console.log(`✅ Scheduled ${this.scheduledJobs.size} posts`);
    } catch (error) {
      console.error('❌ Error scheduling posts:', error);
    }
  }

  /**
   * Schedule a single post using node-schedule
   */
  private async schedulePost(post: any): Promise<void> {
    try {
      // Cancel existing job if it exists
      if (this.scheduledJobs.has(post.id)) {
        this.scheduledJobs.get(post.id)?.cancel();
        this.scheduledJobs.delete(post.id);
      }

      // Create cron expression based on frequency
      const cronExpression = this.createCronExpression(post);
      if (!cronExpression) {
        console.log(`⚠️ Skipping post "${post.title}" - invalid schedule`);
        return;
      }

      // Schedule the job
      const job = schedule.scheduleJob(cronExpression, async () => {
        console.log(`🚀 Executing scheduled post: ${post.title}`);
        await this.executeScheduledPost(post);
      });

      if (job) {
        this.scheduledJobs.set(post.id, job);
        console.log(`✅ Scheduled post "${post.title}" with cron: ${cronExpression}`);
      } else {
        console.log(`❌ Failed to schedule post "${post.title}"`);
      }
    } catch (error) {
      console.error(`❌ Error scheduling post "${post.title}":`, error);
    }
  }

  /**
   * Create cron expression from scheduled post frequency settings
   */
  private createCronExpression(post: any): string | null {
    const [hours, minutes] = post.scheduledTime.split(':').map(Number);
    
    switch (post.frequencyType) {
      case 'daily':
        return `${minutes} ${hours} * * *`; // Every day at specified time
        
      case 'weekly':
        if (post.weeklyDay !== undefined) {
          return `${minutes} ${hours} * * ${post.weeklyDay}`; // Weekly on specified day
        }
        break;
        
      case 'monthly':
        if (post.monthlyDay !== undefined) {
          return `${minutes} ${hours} ${post.monthlyDay} * *`; // Monthly on specified day
        }
        break;
        
      case 'custom':
        // For custom frequency, we'll use a daily check and handle the logic in execution
        return `${minutes} ${hours} * * *`; // Check daily, but only execute based on frequency
        
      default:
        console.log(`⚠️ Unknown frequency type: ${post.frequencyType}`);
        return null;
    }
    
    return null;
  }

  /**
   * Execute a scheduled post with full blog generation and upload
   */
  public async executeScheduledPost(post: any): Promise<void> {
    const startTime = Date.now();
    console.log(`\n🚀 ===== STARTING SCHEDULED POST EXECUTION =====`);
    console.log(`📝 Post: ${post.title}`);
    console.log(`🔗 Connection: ${post.connectionName} (${post.connectionType})`);
    console.log(`📋 Topics: ${post.topics?.join(', ') || 'None'}`);
    console.log(`⏰ Scheduled Time: ${post.scheduledTime}`);
    console.log(`🔄 Frequency: ${post.frequencyType} (${post.frequencyValue})`);
    console.log(`📊 Run Count: ${post.runCount || 0}`);
    console.log(`✅ Success Count: ${post.successCount || 0}`);
    console.log(`❌ Failure Count: ${post.failureCount || 0}`);
    console.log(`🕐 Execution started at: ${new Date().toISOString()}`);
    
    try {
      // Step 1: Get WordPress connection details
      console.log(`\n🔍 Step 1: Getting WordPress connection details...`);
      const connection = await this.getWordPressConnection(post.connectionId, post.connectionName);
      if (!connection) {
        throw new Error(`WordPress connection not found: ${post.connectionName}`);
      }
      console.log(`✅ Connection found: ${connection.url}`);

      // Step 2: Set up environment variables
      console.log(`\n⚙️ Step 2: Setting up environment variables...`);
      this.setupEnvironmentVariables(connection);
      console.log(`✅ Environment variables configured`);

      // Step 3: Select topic for blog generation
      console.log(`\n📝 Step 3: Selecting topic for blog generation...`);
      const selectedTopic = this.selectTopicForGeneration(post.topics);
      console.log(`✅ Selected topic: ${selectedTopic}`);

      // Step 4: Generate blog content
      console.log(`\n🤖 Step 4: Generating blog content...`);
      const blogContent = await this.generateBlogContent(selectedTopic);
      console.log(`✅ Blog content generated successfully`);
      console.log(`📄 Title: ${blogContent.title}`);
      console.log(`📝 Content length: ${blogContent.content?.length || 0} characters`);
      console.log(`🖼️ Images: ${blogContent.images?.length || 0}`);

      // Step 5: Upload to WordPress
      console.log(`\n📤 Step 5: Uploading to WordPress...`);
      const postUrl = await this.uploadToWordPress(blogContent);
      console.log(`✅ Successfully uploaded to WordPress`);
      console.log(`🔗 Post URL: ${postUrl}`);

      // Step 6: Update run statistics
      console.log(`\n📊 Step 6: Updating run statistics...`);
      await this.updateRunStatistics(post.id, true, postUrl);
      console.log(`✅ Run statistics updated`);

      // Step 7: Calculate next run time
      console.log(`\n⏰ Step 7: Calculating next run time...`);
      const nextRun = this.calculateNextRunTime(post);
      if (nextRun) {
        await this.updateNextRunTime(post.id, nextRun);
        console.log(`✅ Next run scheduled for: ${nextRun}`);
      } else {
        console.log(`⚠️ No next run time calculated (post may be disabled or completed)`);
      }

      const executionTime = Date.now() - startTime;
      console.log(`\n🎉 ===== SCHEDULED POST EXECUTION COMPLETED =====`);
      console.log(`✅ Post "${post.title}" executed successfully`);
      console.log(`🔗 Published at: ${postUrl}`);
      console.log(`⏱️ Execution time: ${executionTime}ms`);
      console.log(`🕐 Completed at: ${new Date().toISOString()}`);
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`\n💥 ===== SCHEDULED POST EXECUTION FAILED =====`);
      console.error(`❌ Post "${post.title}" failed to execute`);
      console.error(`⏱️ Execution time: ${executionTime}ms`);
      console.error(`🕐 Failed at: ${new Date().toISOString()}`);
      console.error(`📄 Error details:`, error);
      
      // Update failure statistics
      try {
        await this.updateRunStatistics(post.id, false, null, error instanceof Error ? error.message : 'Unknown error');
        console.log(`📊 Failure statistics updated`);
      } catch (updateError) {
        console.error(`❌ Failed to update failure statistics:`, updateError);
      }
      
      throw error; // Re-throw to be caught by the caller
    }
  }

  /**
   * Get WordPress connection details from storage
   */
  private async getWordPressConnection(connectionId: string, connectionName: string): Promise<any> {
    try {
      // Try to get from SQLite first
      const connections = this.sqliteManager.getWordPressConnections();
      let connection = connections.find(conn => conn.id === connectionId || conn.name === connectionName);
      
      if (!connection) {
        // Fallback to store if not found in SQLite
        const { getStore } = require('../storage');
        const store = getStore();
        const storeConnections = store.get('wordpressConnections', []);
        connection = storeConnections.find((conn: any) => conn.id === connectionId || conn.name === connectionName);
      }
      
      if (!connection) {
        throw new Error(`WordPress connection not found: ${connectionName} (ID: ${connectionId})`);
      }
      
      console.log(`🔍 Found connection: ${connection.name} (${connection.url})`);
      return connection;
    } catch (error) {
      console.error(`❌ Error getting WordPress connection:`, error);
      throw error;
    }
  }

  /**
   * Set up environment variables for AI and WordPress
   */
  private setupEnvironmentVariables(connection: any): void {
    try {
      // Set WordPress environment variables
      process.env.WORDPRESS_URL = connection.url;
      process.env.WORDPRESS_USERNAME = connection.username;
      process.env.WORDPRESS_PASSWORD = connection.password;
      
      // Get AI API keys from electron store
      const aiKeys = this.getAIApiKeys();
      if (aiKeys.length === 0) {
        throw new Error('No AI API keys found. Please configure AI keys in the AI Keys Manager.');
      }
      
      // Find the first active AI key (preferably Gemini)
      const activeKey = this.findBestAIKey(aiKeys);
      if (!activeKey) {
        throw new Error('No active AI API keys found. Please activate an AI key in the AI Keys Manager.');
      }
      
      // Set AI environment variables based on the selected key
      this.setupAIEnvironmentVariables(activeKey);
      
      console.log(`⚙️ WordPress URL: ${connection.url}`);
      console.log(`⚙️ WordPress Username: ${connection.username}`);
      console.log(`⚙️ AI Provider: ${process.env.AI_PROVIDER}`);
      console.log(`⚙️ AI Model: ${process.env.AI_MODEL}`);
      console.log(`⚙️ Image Generation: ${process.env.IMAGE_GENERATION_ENABLED}`);
      console.log(`🔑 Using AI Key: ${activeKey.name} (${activeKey.providerId})`);
    } catch (error) {
      console.error(`❌ Error setting up environment variables:`, error);
      throw error;
    }
  }

  /**
   * Get AI API keys from electron store
   */
  private getAIApiKeys(): any[] {
    try {
      const { getStore } = require('../storage');
      const store = getStore();
      const aiKeys = store.get('ai-keys', []);
      console.log(`🔍 Found ${aiKeys.length} AI keys in store`);
      return aiKeys;
    } catch (error) {
      console.error(`❌ Error getting AI keys from store:`, error);
      return [];
    }
  }

  /**
   * Find the best AI key to use (prefer active Google/Gemini keys)
   */
  private findBestAIKey(aiKeys: any[]): any | null {
    // First, try to find an active Google/Gemini key
    const googleKey = aiKeys.find(key => 
      key.isActive && 
      key.providerId === 'google' && 
      key.fields?.apiKey
    );
    
    if (googleKey) {
      console.log(`✅ Found active Google/Gemini key: ${googleKey.name}`);
      return googleKey;
    }
    
    // If no Google key, find any active key
    const activeKey = aiKeys.find(key => 
      key.isActive && 
      key.fields?.apiKey
    );
    
    if (activeKey) {
      console.log(`✅ Found active AI key: ${activeKey.name} (${activeKey.providerId})`);
      return activeKey;
    }
    
    console.warn(`⚠️ No active AI keys found`);
    return null;
  }

  /**
   * Set up AI environment variables based on the selected key
   */
  private setupAIEnvironmentVariables(aiKey: any): void {
    try {
      const providerId = aiKey.providerId;
      const fields = aiKey.fields || {};
      
      // Set the API key based on provider
      if (providerId === 'google') {
        process.env.GEMINI_API_KEY = fields.apiKey;
        process.env.AI_PROVIDER = 'gemini';
        process.env.AI_MODEL = fields.model || 'gemini-1.5-pro';
        process.env.IMAGE_GENERATION_ENABLED = 'true';
        process.env.IMAGE_PROVIDER = 'gemini';
        process.env.IMAGE_QUALITY = fields.imageQuality || 'high';
        process.env.IMAGE_SIZE = fields.imageSize || '1024x1024';
        process.env.IMAGE_STYLE = fields.imageStyle || 'photographic';
        process.env.IMAGE_ASPECT_RATIO = fields.imageAspectRatio || '1:1';
      } else if (providerId === 'openai') {
        process.env.OPENAI_API_KEY = fields.apiKey;
        process.env.AI_PROVIDER = 'openai';
        process.env.AI_MODEL = fields.model || 'gpt-4';
        process.env.IMAGE_GENERATION_ENABLED = 'true';
        process.env.IMAGE_PROVIDER = 'openai';
        process.env.IMAGE_QUALITY = fields.imageQuality || 'hd';
        process.env.IMAGE_SIZE = fields.imageSize || '1024x1024';
        process.env.IMAGE_STYLE = fields.imageStyle || 'vivid';
        process.env.IMAGE_ASPECT_RATIO = fields.imageAspectRatio || '1:1';
      } else if (providerId === 'anthropic') {
        process.env.ANTHROPIC_API_KEY = fields.apiKey;
        process.env.AI_PROVIDER = 'anthropic';
        process.env.AI_MODEL = fields.model || 'claude-3-sonnet-20240229';
        process.env.IMAGE_GENERATION_ENABLED = 'false'; // Anthropic doesn't do image generation
        process.env.IMAGE_PROVIDER = 'none';
      } else {
        // For custom providers, try to map common field names
        process.env.GEMINI_API_KEY = fields.apiKey || fields.geminiApiKey;
        process.env.AI_PROVIDER = providerId;
        process.env.AI_MODEL = fields.model || 'gemini-1.5-pro';
        process.env.IMAGE_GENERATION_ENABLED = 'true';
        process.env.IMAGE_PROVIDER = 'gemini';
      }
      
      // Update last used timestamp
      this.updateAIKeyLastUsed(aiKey.id);
      
      console.log(`🔑 Configured AI environment for ${providerId}:`);
      console.log(`   API Key: ${fields.apiKey ? '***' + fields.apiKey.slice(-4) : 'Not set'}`);
      console.log(`   Model: ${process.env.AI_MODEL}`);
      console.log(`   Image Generation: ${process.env.IMAGE_GENERATION_ENABLED}`);
      
    } catch (error) {
      console.error(`❌ Error setting up AI environment variables:`, error);
      throw error;
    }
  }

  /**
   * Update the last used timestamp for an AI key
   */
  private updateAIKeyLastUsed(keyId: string): void {
    try {
      const { getStore } = require('../storage');
      const store = getStore();
      const aiKeys = store.get('ai-keys', []);
      
      const keyIndex = aiKeys.findIndex((key: any) => key.id === keyId);
      if (keyIndex !== -1) {
        aiKeys[keyIndex].lastUsed = new Date().toISOString();
        store.set('ai-keys', aiKeys);
        console.log(`📅 Updated last used timestamp for AI key: ${keyId}`);
      }
    } catch (error) {
      console.error(`❌ Error updating AI key last used timestamp:`, error);
      // Don't throw here as this is not critical
    }
  }

  /**
   * Select topic for blog generation
   */
  private selectTopicForGeneration(topics: string[]): string {
    try {
      if (!topics || topics.length === 0) {
        throw new Error('No topics available for blog generation');
      }
      
      // For now, select the first topic
      // TODO: Implement more sophisticated topic selection logic
      const selectedTopic = topics[0];
      console.log(`📝 Available topics: ${topics.join(', ')}`);
      console.log(`📝 Selected topic: ${selectedTopic}`);
      
      return selectedTopic;
    } catch (error) {
      console.error(`❌ Error selecting topic:`, error);
      throw error;
    }
  }

  /**
   * Generate blog content using AI
   */
  private async generateBlogContent(topic: string): Promise<any> {
    try {
      console.log(`🤖 Starting AI blog generation for topic: ${topic}`);
      
      // Import the blog generation functions
      const generateOutline = require('../ai-blog/generate-outline').default;
      const generateImages = require('../ai-blog/generate-images').default;
      
      // Generate blog outline
      console.log(`📝 Generating blog outline...`);
      const outline = await generateOutline(topic);
      console.log(`✅ Blog outline generated`);
      
      // Generate images
      console.log(`🎨 Generating images...`);
      const blogContentWithImages = await generateImages(outline);
      console.log(`✅ Images generated: ${blogContentWithImages.images?.length || 0}`);
      
      return blogContentWithImages;
    } catch (error) {
      console.error(`❌ Error generating blog content:`, error);
      throw error;
    }
  }

  /**
   * Upload blog content to WordPress
   */
  private async uploadToWordPress(blogContent: any): Promise<string> {
    try {
      console.log(`📤 Starting WordPress upload...`);
      
      // Import the WordPress upload function (it's the default export)
      const createPost = require('../wordpress/generate-and-upload-blog').default;
      
      // Upload to WordPress
      const postUrl = await createPost(blogContent);
      console.log(`✅ WordPress upload completed: ${postUrl}`);
      
      return postUrl;
    } catch (error) {
      console.error(`❌ Error uploading to WordPress:`, error);
      throw error;
    }
  }

  /**
   * Update run statistics in SQLite
   */
  private async updateRunStatistics(postId: string, success: boolean, postUrl?: string | null, errorMessage?: string): Promise<void> {
    try {
      const scheduledPostsManager = this.sqliteManager.getScheduledPostsManager();
      
      if (success) {
        await scheduledPostsManager.updateScheduledPostStats(postId, true);
        console.log(`📊 Updated success statistics for post: ${postId}`);
      } else {
        await scheduledPostsManager.updateScheduledPostStats(postId, false);
        console.log(`📊 Updated failure statistics for post: ${postId}`);
        if (errorMessage) {
          console.log(`📄 Error message: ${errorMessage}`);
        }
      }
    } catch (error) {
      console.error(`❌ Error updating run statistics:`, error);
      throw error;
    }
  }

  /**
   * Calculate next run time based on frequency settings
   */
  private calculateNextRunTime(post: any): Date | null {
    try {
      if (!post.enabled) {
        return null;
      }
      
      const now = new Date();
      const [hours, minutes] = post.scheduledTime.split(':').map(Number);
      
      let nextRun: Date;
      
      switch (post.frequencyType) {
        case 'daily':
          nextRun = new Date(now);
          nextRun.setHours(hours, minutes, 0, 0);
          if (nextRun <= now) {
            nextRun.setDate(nextRun.getDate() + 1);
          }
          break;
          
        case 'weekly':
          if (post.weeklyDay !== undefined) {
            nextRun = new Date(now);
            nextRun.setHours(hours, minutes, 0, 0);
            const daysUntilNext = (post.weeklyDay - nextRun.getDay() + 7) % 7;
            nextRun.setDate(nextRun.getDate() + (daysUntilNext === 0 ? 7 : daysUntilNext));
          } else {
            return null;
          }
          break;
          
        case 'monthly':
          if (post.monthlyDay !== undefined) {
            nextRun = new Date(now);
            nextRun.setHours(hours, minutes, 0, 0);
            nextRun.setDate(post.monthlyDay);
            if (nextRun <= now) {
              nextRun.setMonth(nextRun.getMonth() + 1);
            }
          } else {
            return null;
          }
          break;
          
        case 'custom':
          // For custom frequency, calculate based on frequencyValue
          if (post.frequencyValue) {
            nextRun = new Date(now);
            nextRun.setHours(hours, minutes, 0, 0);
            nextRun.setDate(nextRun.getDate() + post.frequencyValue);
          } else {
            return null;
          }
          break;
          
        default:
          console.warn(`⚠️ Unknown frequency type: ${post.frequencyType}`);
          return null;
      }
      
      console.log(`⏰ Next run calculated: ${nextRun.toISOString()}`);
      return nextRun;
    } catch (error) {
      console.error(`❌ Error calculating next run time:`, error);
      return null;
    }
  }

  /**
   * Update next run time in SQLite
   */
  private async updateNextRunTime(postId: string, nextRun: Date): Promise<void> {
    try {
      const scheduledPostsManager = this.sqliteManager.getScheduledPostsManager();
      await scheduledPostsManager.updateScheduledPostNextRun(postId, nextRun);
      console.log(`⏰ Next run time updated: ${nextRun.toISOString()}`);
    } catch (error) {
      console.error(`❌ Error updating next run time:`, error);
      throw error;
    }
  }

  /**
   * Check for new or updated posts and update schedules
   */
  private async checkAndUpdateSchedules(): Promise<void> {
    try {
      // This method will be called every minute to check for changes
      // For now, just log that we're checking
      console.log('🔍 Checking for schedule updates...');
      
      // TODO: Implement logic to:
      // 1. Check for new scheduled posts
      // 2. Check for updated scheduled posts
      // 3. Check for deleted scheduled posts
      // 4. Update schedules accordingly
      
    } catch (error) {
      console.error('❌ Error checking schedule updates:', error);
    }
  }

  /**
   * Stop the scheduler service
   */
  public stop(): void {
    // Cancel all scheduled jobs
    console.log(`🛑 Cancelling ${this.scheduledJobs.size} scheduled jobs...`);
    for (const [postId, job] of this.scheduledJobs) {
      job.cancel();
      console.log(`   Cancelled job for post: ${postId}`);
    }
    this.scheduledJobs.clear();

    // Clear the interval
    if (this.executionInterval) {
      clearInterval(this.executionInterval);
      this.executionInterval = null;
    }
    
    this.isRunning = false;
    console.log('Scheduled posts executor service stopped');
  }

  /**
   * Cleanup method for app shutdown
   * Gracefully stops the scheduler and waits for any running tasks to complete
   */
  public async cleanup(): Promise<void> {
    console.log('Cleaning up scheduled posts executor service...');
    
    // Stop the scheduler first
    this.stop();
    
    // TODO: Add logic to wait for any currently running tasks to complete
    // This could include:
    // - Checking for tasks in "running" state
    // - Waiting for them to finish (with timeout)
    // - Marking them as cancelled if they don't complete in time
    
    console.log('Scheduled posts executor service cleanup completed');
  }
}
