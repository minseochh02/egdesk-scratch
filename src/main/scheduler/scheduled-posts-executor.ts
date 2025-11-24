// Scheduled Posts Executor Service
// This service handles the execution of scheduled blog posts

import * as schedule from 'node-schedule';
import { getSQLiteManager } from '../sqlite/manager';
import { generateSingleImage } from '../gemini';

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

    this.isRunning = true;
    console.log('Starting scheduled posts executor service...');
    
    // Fetch and log all scheduled posts (reduced verbosity for faster startup)
    await this.fetchAndLogScheduledPostsSummary();
    
    // Schedule all enabled posts
    await this.scheduleAllPosts();
    
    // Set up periodic check for new/updated posts with error handling
    this.executionInterval = setInterval(async () => {
      try {
      await this.checkAndUpdateSchedules();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ Error in periodic schedule check: ${errorMessage}`);
        // Don't let periodic check errors crash the scheduler
      }
    }, 60000); // Check every minute
  }

  /**
   * Fetch scheduled posts from SQLite and log a summary (reduced verbosity)
   */
  private async fetchAndLogScheduledPostsSummary(): Promise<void> {
    try {
      const scheduledPostsManager = this.sqliteManager.getScheduledPostsManager();
      const allScheduledPosts = await scheduledPostsManager.getAllScheduledPosts();
      
      const enabledCount = allScheduledPosts.filter(p => p.enabled).length;
      const duePosts = await scheduledPostsManager.getDueScheduledPosts();
      
      console.log(`📋 Scheduled posts: ${allScheduledPosts.length} total (${enabledCount} enabled, ${duePosts.length} due)`);
      
      // Only show details if in debug mode (set DEBUG_SCHEDULER env var)
      if (process.env.DEBUG_SCHEDULER === 'true') {
        this.fetchAndLogScheduledPostsDetailed(allScheduledPosts, duePosts);
      }
    } catch (error) {
      console.error('❌ Error fetching scheduled posts:', error);
    }
  }

  /**
   * Fetch scheduled posts from SQLite and console log them (detailed version for debugging)
   */
  private fetchAndLogScheduledPostsDetailed(allScheduledPosts: any[], duePosts: any[]): void {
    console.log('\n📋 Detailed scheduled posts:');
    
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
    });

    if (duePosts.length > 0) {
      console.log(`\n⏰ Due scheduled posts details:`);
      duePosts.forEach((post, index) => {
        console.log(`\n--- Due Post ${index + 1} ---`);
        console.log(`Title: ${post.title}`);
        console.log(`Next Run: ${post.nextRun}`);
        console.log(`Connection: ${post.connectionName}`);
      });
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
      const normalizedType = (post.connectionType || '').toLowerCase();
      if (normalizedType === 'business_identity' || normalizedType === 'business identity') {
        console.log(
          `Skipping scheduler registration for Business Identity post "${post.title}" (not automated yet).`,
        );
        return;
      }
      // Instagram and YouTube are now supported
      if (normalizedType === 'instagram' || normalizedType === 'youtube' || normalizedType === 'yt') {
        // Allow these to be scheduled
      }

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

      // Schedule the job with error handling
      const job = schedule.scheduleJob(cronExpression, async () => {
        try {
          console.log(`🚀 Executing scheduled post: ${post.title}`);
          await this.executeScheduledPost(post);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT') || errorMessage.includes('TIMEDOUT');
          const isNetworkError = errorMessage.includes('fetch failed') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND');
          
          console.error(`\n❌ ===== SCHEDULED POST EXECUTION ERROR =====`);
          console.error(`📝 Post: ${post.title}`);
          console.error(`🔗 Connection: ${post.connectionName} (${post.connectionType})`);
          console.error(`⏰ Scheduled Time: ${post.scheduledTime}`);
          console.error(`❌ Error Type: ${isTimeout ? 'TIMEOUT' : isNetworkError ? 'NETWORK_ERROR' : 'EXECUTION_ERROR'}`);
          console.error(`📄 Error Message: ${errorMessage}`);
          
          // Update failure statistics
          try {
            await this.updateRunStatistics(
              post.id, 
              false, 
              null, 
              `${isTimeout ? 'Timeout' : isNetworkError ? 'Network' : 'Execution'} error: ${errorMessage}`
            );
            console.log(`📊 Failure statistics updated`);
          } catch (updateError) {
            console.error(`❌ Failed to update failure statistics:`, updateError);
          }
          
          // Don't re-throw - let the scheduler continue running
          console.error(`⚠️ Post execution failed, but scheduler will continue running`);
        }
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
    // Route to appropriate execution method based on connection type
    const normalizedType = (post.connectionType || '').toLowerCase();

    if (post.connectionType === 'wordpress') {
      await this.executeWordPressScheduledPost(post);
    } else if (post.connectionType === 'naver' || post.connectionType === 'Naver Blog') {
      await this.executeNaverScheduledPost(post);
    } else if (normalizedType === 'instagram') {
      await this.executeInstagramScheduledPost(post);
    } else if (normalizedType === 'facebook' || normalizedType === 'fb') {
      await this.executeFacebookScheduledPost(post);
    } else if (normalizedType === 'youtube' || normalizedType === 'yt') {
      await this.executeYouTubeScheduledPost(post);
    } else if (normalizedType === 'business_identity' || normalizedType === 'business identity') {
      console.log(
        `Skipping Business Identity scheduled post "${post.title}" — automation not yet implemented.`,
      );
      return;
    } else {
      throw new Error(`Unsupported connection type: ${post.connectionType}`);
    }
  }

  /**
   * Execute a WordPress scheduled post
   */
  private async executeWordPressScheduledPost(post: any): Promise<void> {
    const startTime = Date.now();
    const startedAt = new Date();
    
    try {
      // Ensure topics are loaded for scheduled (cron) executions
      if (!post.topics || post.topics.length === 0) {
        const topics = await this.sqliteManager.getScheduledPostsManager().getScheduledPostTopics(post.id);
        post.topics = Array.isArray(topics) ? topics.map((t: any) => t.topicName) : [];
      }
    } catch (loadTopicsError) {
      console.warn('⚠️ Could not load topics for scheduled post, continuing:', loadTopicsError);
    }
    console.log(`\n🚀 ===== STARTING WORDPRESS SCHEDULED POST EXECUTION =====`);
    console.log(`📝 Post: ${post.title}`);
    console.log(`🔗 Connection: ${post.connectionName} (${post.connectionType})`);
    console.log(`📋 Topics: ${post.topics?.join(', ') || 'None'}`);
    console.log(`⏰ Scheduled Time: ${post.scheduledTime}`);
    console.log(`🔄 Frequency: ${post.frequencyType} (${post.frequencyValue})`);
    console.log(`📊 Run Count: ${post.runCount || 0}`);
    console.log(`✅ Success Count: ${post.successCount || 0}`);
    console.log(`❌ Failure Count: ${post.failureCount || 0}`);
    console.log(`🕐 Execution started at: ${new Date().toISOString()}`);
    
    let blogContent: any = null;
    let postUrl: string | null = null;
    
    try {
      // Step 1: Get connection details
      console.log(`\n🔍 Step 1: Getting connection details...`);
      const connection = await this.getConnection(post.connectionId, post.connectionName, post.connectionType);
      if (!connection) {
        throw new Error(`${post.connectionType} connection not found: ${post.connectionName}`);
      }
      console.log(`✅ Connection found: ${connection.name} (${post.connectionType})`);

      // Step 2: Set up environment variables
      console.log(`\n⚙️ Step 2: Setting up environment variables...`);
      this.setupEnvironmentVariables(connection, (post as any).aiKeyId || null, post.connectionType);
      console.log(`✅ Environment variables configured`);

      // Step 3: Select topic for blog generation
      console.log(`\n📝 Step 3: Selecting topic for blog generation...`);
      const selectedTopic = this.selectTopicForGeneration(post.topics);
      console.log(`✅ Selected topic: ${selectedTopic}`);

      // Step 4: Generate blog content with images (WordPress supports images)
      console.log(`\n🤖 Step 4: Generating blog content...`);
      blogContent = await this.generateBlogContentWithImages(selectedTopic);
      console.log(`✅ Blog content generated successfully`);
      console.log(`📄 Title: ${blogContent.title}`);
      console.log(`📝 Content length: ${blogContent.content?.length || 0} characters`);
      console.log(`🖼️ Images: ${blogContent.images?.length || 0}`);

      // Step 5: Upload to WordPress with error handling
      console.log(`\n📤 Step 5: Uploading to WordPress...`);
      try {
        postUrl = await this.uploadToWordPress(blogContent);
      console.log(`✅ Successfully uploaded to WordPress`);
      console.log(`🔗 Post URL: ${postUrl}`);
      } catch (uploadError) {
        const errorMessage = uploadError instanceof Error ? uploadError.message : String(uploadError);
        const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT');
        const isNetworkError = errorMessage.includes('fetch failed') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND');
        
        console.error(`❌ WordPress upload failed: ${errorMessage}`);
        if (isTimeout) {
          throw new Error(`WordPress upload timed out. The site may be slow or unreachable. Please check your WordPress site connection.`);
        } else if (isNetworkError) {
          throw new Error(`WordPress upload network error. Please check your WordPress site URL and network connection.`);
        }
        throw uploadError;
      }

      // Step 6: Create execution history record with success
      const completedAt = new Date();
      const duration = completedAt.getTime() - startedAt.getTime();
      try {
        const scheduledPostsManager = this.sqliteManager.getScheduledPostsManager();
        scheduledPostsManager.createExecution({
          scheduledPostId: post.id,
          status: 'success',
          startedAt,
          completedAt,
          duration,
          blogPostUrl: postUrl,
          topics: post.topics || [],
          generatedContent: blogContent ? {
            title: blogContent.title,
            excerpt: blogContent.content?.substring(0, 200) || '',
            wordCount: blogContent.content?.length || 0,
            imageCount: blogContent.images?.length || 0,
          } : undefined,
        });
        console.log(`📊 Created execution history record`);
      } catch (execError) {
        console.warn('⚠️ Failed to create execution history record:', execError);
      }

      // Step 7: Update run statistics
      console.log(`\n📊 Step 7: Updating run statistics...`);
      await this.updateRunStatistics(post.id, true, postUrl);
      console.log(`✅ Run statistics updated`);

      // Step 8: Calculate next run time
      console.log(`\n⏰ Step 8: Calculating next run time...`);
      const nextRun = this.calculateNextRunTime(post);
      if (nextRun) {
        await this.updateNextRunTime(post.id, nextRun);
        console.log(`✅ Next run scheduled for: ${nextRun}`);
      } else {
        console.log(`⚠️ No next run time calculated (post may be disabled or completed)`);
      }

      const executionTime = Date.now() - startTime;
      console.log(`\n🎉 ===== WORDPRESS SCHEDULED POST EXECUTION COMPLETED =====`);
      console.log(`✅ Post "${post.title}" executed successfully`);
      console.log(`🔗 Published at: ${postUrl}`);
      console.log(`⏱️ Execution time: ${executionTime}ms`);
      console.log(`🕐 Completed at: ${new Date().toISOString()}`);
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const completedAt = new Date();
      const duration = completedAt.getTime() - startedAt.getTime();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`\n💥 ===== WORDPRESS SCHEDULED POST EXECUTION FAILED =====`);
      console.error(`❌ Post "${post.title}" failed to execute`);
      console.error(`⏱️ Execution time: ${executionTime}ms`);
      console.error(`🕐 Failed at: ${new Date().toISOString()}`);
      console.error(`📄 Error details:`, error);
      
      // Create execution history record with failure
      try {
        const scheduledPostsManager = this.sqliteManager.getScheduledPostsManager();
        scheduledPostsManager.createExecution({
          scheduledPostId: post.id,
          status: 'failure',
          startedAt,
          completedAt,
          duration,
          errorMessage,
          topics: post.topics || [],
          generatedContent: blogContent ? {
            title: blogContent.title || '',
            excerpt: blogContent.content?.substring(0, 200) || '',
            wordCount: blogContent.content?.length || 0,
            imageCount: blogContent.images?.length || 0,
          } : undefined,
        });
        console.log(`📊 Created execution history record`);
      } catch (execError) {
        console.warn('⚠️ Failed to create execution history record:', execError);
      }
      
      // Update failure statistics
      try {
        await this.updateRunStatistics(post.id, false, null, errorMessage);
        console.log(`📊 Failure statistics updated`);
      } catch (updateError) {
        console.error(`❌ Failed to update failure statistics:`, updateError);
      }
      
      throw error; // Re-throw to be caught by the caller
    }
  }

  /**
   * Execute a Naver Blog scheduled post
   */
  private async executeNaverScheduledPost(post: any): Promise<void> {
    const startTime = Date.now();
    const startedAt = new Date();
    
    try {
      // Ensure topics are loaded for scheduled (cron) executions
      if (!post.topics || post.topics.length === 0) {
        const topics = await this.sqliteManager.getScheduledPostsManager().getScheduledPostTopics(post.id);
        post.topics = Array.isArray(topics) ? topics.map((t: any) => t.topicName) : [];
      }
    } catch (loadTopicsError) {
      console.warn('⚠️ Could not load topics for scheduled post, continuing:', loadTopicsError);
    }
    console.log(`\n🚀 ===== STARTING NAVER BLOG SCHEDULED POST EXECUTION =====`);
    console.log(`📝 Post: ${post.title}`);
    console.log(`🔗 Connection: ${post.connectionName} (${post.connectionType})`);
    console.log(`📋 Topics: ${post.topics?.join(', ') || 'None'}`);
    console.log(`⏰ Scheduled Time: ${post.scheduledTime}`);
    console.log(`🔄 Frequency: ${post.frequencyType} (${post.frequencyValue})`);
    console.log(`📊 Run Count: ${post.runCount || 0}`);
    console.log(`✅ Success Count: ${post.successCount || 0}`);
    console.log(`❌ Failure Count: ${post.failureCount || 0}`);
    console.log(`🕐 Execution started at: ${new Date().toISOString()}`);
    
    let blogContent: any = null;
    let postUrl: string | null = null;
    
    try {
      // Step 1: Get connection details
      console.log(`\n🔍 Step 1: Getting connection details...`);
      const connection = await this.getConnection(post.connectionId, post.connectionName, post.connectionType);
      if (!connection) {
        throw new Error(`${post.connectionType} connection not found: ${post.connectionName}`);
      }
      console.log(`✅ Connection found: ${connection.name} (${post.connectionType})`);

      // Step 2: Set up environment variables
      console.log(`\n⚙️ Step 2: Setting up environment variables...`);
      this.setupEnvironmentVariables(connection, (post as any).aiKeyId || null, post.connectionType);
      console.log(`✅ Environment variables configured`);

      // Step 3: Select topic for blog generation
      console.log(`\n📝 Step 3: Selecting topic for blog generation...`);
      const selectedTopic = this.selectTopicForGeneration(post.topics);
      console.log(`✅ Selected topic: ${selectedTopic}`);

      // Step 4: Generate blog content with images for Naver Blog
      console.log(`\n🤖 Step 4: Generating blog content...`);
      blogContent = await this.generateBlogContentWithImagesForNaver(selectedTopic);
      console.log(`✅ Blog content generated successfully`);
      console.log(`📄 Title: ${blogContent.title}`);
      console.log(`📝 Content length: ${blogContent.content?.length || 0} characters`);
      console.log(`🖼️ Images: ${blogContent.images?.length || 0}`);

      // Step 5: Upload to Naver Blog with error handling
      console.log(`\n📤 Step 5: Uploading to Naver Blog...`);
      const imagePaths = blogContent.images?.map((img: any) => img.filePath).filter(Boolean) || []; // Get all image paths
      try {
        postUrl = await Promise.race([
          this.uploadToNaverBlog(blogContent, connection, imagePaths),
          new Promise<string>((_, reject) => 
            setTimeout(() => reject(new Error('Naver Blog upload timeout after 300 seconds')), 300000)
          )
        ]);
      console.log(`✅ Successfully uploaded to Naver Blog`);
      console.log(`🔗 Post URL: ${postUrl}`);
      } catch (uploadError) {
        const errorMessage = uploadError instanceof Error ? uploadError.message : String(uploadError);
        const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT') || errorMessage.includes('Timeout');
        
        console.error(`❌ Naver Blog upload failed: ${errorMessage}`);
        if (isTimeout) {
          throw new Error(`Naver Blog upload timed out. The browser automation may be slow or the site may be unreachable.`);
        }
        throw uploadError;
      }

      // Step 6: Create execution history record with success
      const completedAt = new Date();
      const duration = completedAt.getTime() - startedAt.getTime();
      try {
        const scheduledPostsManager = this.sqliteManager.getScheduledPostsManager();
        scheduledPostsManager.createExecution({
          scheduledPostId: post.id,
          status: 'success',
          startedAt,
          completedAt,
          duration,
          blogPostUrl: postUrl,
          topics: post.topics || [],
          generatedContent: blogContent ? {
            title: blogContent.title,
            excerpt: blogContent.content?.substring(0, 200) || '',
            wordCount: blogContent.content?.length || 0,
            imageCount: blogContent.images?.length || 0,
          } : undefined,
        });
        console.log(`📊 Created execution history record`);
      } catch (execError) {
        console.warn('⚠️ Failed to create execution history record:', execError);
      }

      // Step 7: Update run statistics
      console.log(`\n📊 Step 7: Updating run statistics...`);
      await this.updateRunStatistics(post.id, true, postUrl);
      console.log(`✅ Run statistics updated`);

      // Step 8: Calculate next run time
      console.log(`\n⏰ Step 8: Calculating next run time...`);
      const nextRun = this.calculateNextRunTime(post);
      if (nextRun) {
        await this.updateNextRunTime(post.id, nextRun);
        console.log(`✅ Next run scheduled for: ${nextRun}`);
      } else {
        console.log(`⚠️ No next run time calculated (post may be disabled or completed)`);
      }

      const executionTime = Date.now() - startTime;
      console.log(`\n🎉 ===== NAVER BLOG SCHEDULED POST EXECUTION COMPLETED =====`);
      console.log(`✅ Post "${post.title}" executed successfully`);
      console.log(`🔗 Published at: ${postUrl}`);
      console.log(`⏱️ Execution time: ${executionTime}ms`);
      console.log(`🕐 Completed at: ${new Date().toISOString()}`);
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const completedAt = new Date();
      const duration = completedAt.getTime() - startedAt.getTime();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`\n💥 ===== NAVER BLOG SCHEDULED POST EXECUTION FAILED =====`);
      console.error(`❌ Post "${post.title}" failed to execute`);
      console.error(`⏱️ Execution time: ${executionTime}ms`);
      console.error(`🕐 Failed at: ${new Date().toISOString()}`);
      console.error(`📄 Error details:`, error);
      
      // Create execution history record with failure
      try {
        const scheduledPostsManager = this.sqliteManager.getScheduledPostsManager();
        scheduledPostsManager.createExecution({
          scheduledPostId: post.id,
          status: 'failure',
          startedAt,
          completedAt,
          duration,
          errorMessage,
          topics: post.topics || [],
          generatedContent: blogContent ? {
            title: blogContent.title || '',
            excerpt: blogContent.content?.substring(0, 200) || '',
            wordCount: blogContent.content?.length || 0,
            imageCount: blogContent.images?.length || 0,
          } : undefined,
        });
        console.log(`📊 Created execution history record`);
      } catch (execError) {
        console.warn('⚠️ Failed to create execution history record:', execError);
      }
      
      // Update failure statistics
      try {
        await this.updateRunStatistics(post.id, false, null, errorMessage);
        console.log(`📊 Failure statistics updated`);
      } catch (updateError) {
        console.error(`❌ Failed to update failure statistics:`, updateError);
      }
      
      throw error; // Re-throw to be caught by the caller
    }
  }

  /**
   * Execute an Instagram scheduled post
   */
  private async executeInstagramScheduledPost(post: any): Promise<void> {
    const startTime = Date.now();
    const startedAt = new Date();
    
    try {
      // Ensure topics are loaded for scheduled (cron) executions
      if (!post.topics || post.topics.length === 0) {
        const topics = await this.sqliteManager.getScheduledPostsManager().getScheduledPostTopics(post.id);
        post.topics = Array.isArray(topics) ? topics.map((t: any) => t.topicName) : [];
      }
    } catch (loadTopicsError) {
      console.warn('⚠️ Could not load topics for scheduled post, continuing:', loadTopicsError);
    }
    
    console.log(`\n🚀 ===== STARTING INSTAGRAM SCHEDULED POST EXECUTION =====`);
    console.log(`📝 Post: ${post.title}`);
    console.log(`🔗 Connection: ${post.connectionName} (${post.connectionType})`);
    console.log(`📋 Topics: ${post.topics?.join(', ') || 'None'}`);
    console.log(`⏰ Scheduled Time: ${post.scheduledTime}`);
    console.log(`🔄 Frequency: ${post.frequencyType} (${post.frequencyValue})`);
    console.log(`📊 Run Count: ${post.runCount || 0}`);
    console.log(`✅ Success Count: ${post.successCount || 0}`);
    console.log(`❌ Failure Count: ${post.failureCount || 0}`);
    console.log(`🕐 Execution started at: ${new Date().toISOString()}`);
    
    let generatedContent: any = null;
    
    try {
      // Step 1: Get connection details
      console.log(`\n🔍 Step 1: Getting connection details...`);
      const connection = await this.getConnection(post.connectionId, post.connectionName, post.connectionType);
      if (!connection) {
        throw new Error(`${post.connectionType} connection not found: ${post.connectionName}`);
      }
      console.log(`✅ Connection found: ${connection.name} (${post.connectionType})`);

      // Step 2: Set up environment variables
      console.log(`\n⚙️ Step 2: Setting up environment variables...`);
      this.setupEnvironmentVariables(connection, (post as any).aiKeyId || null, post.connectionType);
      console.log(`✅ Environment variables configured`);

      // Step 3: Fetch business identity data if planId is available
      console.log(`\n🔍 Step 3: Fetching business identity data...`);
      let businessIdentity: any = null;
      let snsPlan: any = null;
      
      if ((post as any).planId) {
        try {
          const biManager = this.sqliteManager.getBusinessIdentityManager();
          const plan = biManager.getPlan((post as any).planId);
          
          if (plan) {
            snsPlan = plan;
            console.log(`✅ Found SNS plan: ${plan.title}`);
            
            // Fetch the business identity snapshot
            const snapshot = biManager.getSnapshot(plan.snapshotId);
            if (snapshot && snapshot.identityJson) {
              try {
                businessIdentity = JSON.parse(snapshot.identityJson);
                console.log(`✅ Business identity loaded for brand: ${businessIdentity?.source?.title || 'Unknown'}`);
              } catch (parseError) {
                console.warn('[executeInstagramScheduledPost] Failed to parse identity JSON:', parseError);
              }
            } else {
              console.warn('[executeInstagramScheduledPost] No identity snapshot found for plan');
            }
          } else {
            console.warn('[executeInstagramScheduledPost] SNS plan not found for planId:', (post as any).planId);
          }
        } catch (error) {
          console.warn('[executeInstagramScheduledPost] Failed to fetch business identity:', error);
        }
      } else {
        console.log('⚠️ No planId provided, using minimal identity data');
      }

      // Step 4: Select topic for content generation
      console.log(`\n📝 Step 4: Selecting topic for content generation...`);
      const selectedTopic = this.selectTopicForGeneration(post.topics);
      console.log(`✅ Selected topic: ${selectedTopic}`);

      // Step 5: Generate Instagram content with full identity context
      console.log(`\n🤖 Step 5: Generating Instagram content...`);
      const { createBusinessIdentityInstagramPost } = await import('../sns/instagram/index');
      const { generateInstagramContent } = await import('../sns/instagram/generate-text-content');
      
      // Build structured prompt with business identity (similar to frontend buildInstagramStructuredPrompt)
      const identityPayload = businessIdentity?.identity
        ? {
            brandName: businessIdentity?.source?.title || connection.name,
            coreIdentity: businessIdentity.identity.coreIdentity,
            brandCategory: businessIdentity.identity.brandCategory,
            targetAudience: businessIdentity.identity.targetAudience,
            toneVoice: businessIdentity.identity.toneVoice,
            signatureProof: businessIdentity.identity.signatureProof,
            keywords: businessIdentity?.source?.keywords?.slice(0, 10),
            proofPoints: businessIdentity.identity.proofPoints,
          }
        : {
            brandName: connection.name,
            brandDescription: selectedTopic,
          };

      const recommendedCta =
        Array.isArray(businessIdentity?.recommendedActions) && businessIdentity?.recommendedActions.length > 0
          ? businessIdentity?.recommendedActions[0]?.detail
          : undefined;

      const structuredPrompt = {
        identity: identityPayload,
        plan: {
          channel: 'Instagram',
          title: snsPlan?.title || post.title || 'Scheduled Post',
          summary: snsPlan?.summary || selectedTopic,
          topics: post.topics || [selectedTopic],
          cta: recommendedCta,
          contentGoal: selectedTopic,
        },
        contentGoal: `Create an Instagram post about: ${selectedTopic}`,
        visualBrief: snsPlan?.format || 'Professional, engaging visual',
        preferredHashtags: businessIdentity?.source?.keywords?.slice(0, 15) || [],
        extraInstructions: 'Generate engaging Instagram content with hook, body, CTA, and relevant hashtags.',
      };

      // Generate content first to get caption and image prompt
      generatedContent = await generateInstagramContent(structuredPrompt);
      console.log(`✅ Instagram content generated successfully`);
      console.log(`📝 Caption length: ${generatedContent.caption?.length || 0} characters`);
      console.log(`🖼️ Image prompt: ${generatedContent.imagePrompt || 'None'}`);

      // Step 6: Post to Instagram
      console.log(`\n📤 Step 6: Posting to Instagram...`);
      const result = await createBusinessIdentityInstagramPost({
        username: connection.username,
        password: connection.password,
        structuredPrompt,
        planId: post.planId, // If available from SNS plan
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to post to Instagram');
      }

      console.log(`✅ Successfully posted to Instagram`);
      if (result.executionId) {
        console.log(`📊 Execution ID: ${result.executionId}`);
      }

      // Step 7: Create execution history record with success
      const completedAt = new Date();
      const duration = completedAt.getTime() - startedAt.getTime();
      try {
        const scheduledPostsManager = this.sqliteManager.getScheduledPostsManager();
        scheduledPostsManager.createExecution({
          scheduledPostId: post.id,
          status: 'success',
          startedAt,
          completedAt,
          duration,
          topics: post.topics || [],
          generatedContent: generatedContent ? {
            title: post.title || '',
            excerpt: generatedContent.caption?.substring(0, 200) || '',
            wordCount: generatedContent.caption?.length || 0,
            imageCount: generatedContent.imagePrompt ? 1 : 0,
          } : undefined,
        });
        console.log(`📊 Created execution history record`);
      } catch (execError) {
        console.warn('⚠️ Failed to create execution history record:', execError);
      }

      // Step 8: Update run statistics
      console.log(`\n📊 Step 8: Updating run statistics...`);
      await this.updateRunStatistics(post.id, true, 'Instagram post published');
      console.log(`✅ Run statistics updated`);

      // Step 9: Calculate next run time
      console.log(`\n⏰ Step 9: Calculating next run time...`);
      const nextRun = this.calculateNextRunTime(post);
      if (nextRun) {
        await this.updateNextRunTime(post.id, nextRun);
        console.log(`✅ Next run scheduled for: ${nextRun}`);
      } else {
        console.log(`⚠️ No next run time calculated (post may be disabled or completed)`);
      }

      const executionTime = Date.now() - startTime;
      console.log(`\n🎉 ===== INSTAGRAM SCHEDULED POST EXECUTION COMPLETED =====`);
      console.log(`✅ Post "${post.title}" executed successfully`);
      console.log(`⏱️ Execution time: ${executionTime}ms`);
      console.log(`🕐 Completed at: ${new Date().toISOString()}`);
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const completedAt = new Date();
      const duration = completedAt.getTime() - startedAt.getTime();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`\n💥 ===== INSTAGRAM SCHEDULED POST EXECUTION FAILED =====`);
      console.error(`❌ Post "${post.title}" failed to execute`);
      console.error(`⏱️ Execution time: ${executionTime}ms`);
      console.error(`🕐 Failed at: ${new Date().toISOString()}`);
      console.error(`📄 Error details:`, error);
      
      // Create execution history record with failure
      try {
        const scheduledPostsManager = this.sqliteManager.getScheduledPostsManager();
        scheduledPostsManager.createExecution({
          scheduledPostId: post.id,
          status: 'failure',
          startedAt,
          completedAt,
          duration,
          errorMessage,
          topics: post.topics || [],
          generatedContent: generatedContent ? {
            title: post.title || '',
            excerpt: generatedContent.caption?.substring(0, 200) || '',
            wordCount: generatedContent.caption?.length || 0,
            imageCount: generatedContent.imagePrompt ? 1 : 0,
          } : undefined,
        });
        console.log(`📊 Created execution history record`);
      } catch (execError) {
        console.warn('⚠️ Failed to create execution history record:', execError);
      }
      
      // Update failure statistics
      try {
        await this.updateRunStatistics(post.id, false, null, errorMessage);
        console.log(`📊 Failure statistics updated`);
      } catch (updateError) {
        console.error(`❌ Failed to update failure statistics:`, updateError);
      }
      
      throw error; // Re-throw to be caught by the caller
    }
  }

  /**
   * Execute a Facebook scheduled post
   */
  private async executeFacebookScheduledPost(post: any): Promise<void> {
    const startTime = Date.now();
    const startedAt = new Date();
    
    // Ensure topics are loaded for scheduled (cron) executions
    try {
      if (!post.topics || post.topics.length === 0) {
        const topics = await this.sqliteManager.getScheduledPostsManager().getScheduledPostTopics(post.id);
        post.topics = Array.isArray(topics) ? topics.map((t: any) => t.topicName) : [];
      }
    } catch (loadTopicsError) {
      console.warn('⚠️ Could not load topics for scheduled post, continuing:', loadTopicsError);
    }
    
    console.log(`\n🚀 ===== STARTING FACEBOOK SCHEDULED POST EXECUTION =====`);
    console.log(`📝 Post: ${post.title}`);
    console.log(`🔗 Connection: ${post.connectionName} (${post.connectionType})`);
    console.log(`📋 Topics: ${post.topics?.join(', ') || 'None'}`);
    console.log(`⏰ Scheduled Time: ${post.scheduledTime}`);
    console.log(`🔄 Frequency: ${post.frequencyType} (${post.frequencyValue})`);
    console.log(`📊 Run Count: ${post.runCount || 0}`);
    console.log(`✅ Success Count: ${post.successCount || 0}`);
    console.log(`❌ Failure Count: ${post.failureCount || 0}`);

    console.log(`🕐 Execution started at: ${new Date().toISOString()}`);
    
    let generatedContent: any = null;
    
    try {
      // Step 1: Get connection details
      console.log(`\n🔍 Step 1: Getting connection details...`);
      const connection = await this.getConnection(post.connectionId, post.connectionName, post.connectionType);
      if (!connection) {
        throw new Error(`${post.connectionType} connection not found: ${post.connectionName}`);
      }
      console.log(`✅ Connection found: ${connection.name} (${post.connectionType})`);

      // Step 2: Set up environment variables
      console.log(`\n⚙️ Step 2: Setting up environment variables...`);
      this.setupEnvironmentVariables(connection, (post as any).aiKeyId || null, post.connectionType);
      console.log(`✅ Environment variables configured`);

      // Step 3: Fetch business identity data if planId is available
      console.log(`\n🔍 Step 3: Fetching business identity data...`);
      let businessIdentity: any = null;
      let snsPlan: any = null;
      
      if ((post as any).planId) {
        try {
          const biManager = this.sqliteManager.getBusinessIdentityManager();
          const plan = biManager.getPlan((post as any).planId);
          
          if (plan) {
            snsPlan = plan;
            console.log(`✅ Found SNS plan: ${plan.title}`);
            
            // Fetch the business identity snapshot
            const snapshot = biManager.getSnapshot(plan.snapshotId);
            if (snapshot && snapshot.identityJson) {
              try {
                businessIdentity = JSON.parse(snapshot.identityJson);
                console.log(`✅ Business identity loaded for brand: ${businessIdentity?.source?.title || 'Unknown'}`);
              } catch (parseError) {
                console.warn('[executeFacebookScheduledPost] Failed to parse identity JSON:', parseError);
              }
            } else {
              console.warn('[executeFacebookScheduledPost] No identity snapshot found for plan');
            }
          } else {
            console.warn('[executeFacebookScheduledPost] SNS plan not found for planId:', (post as any).planId);
          }
        } catch (error) {
          console.warn('[executeFacebookScheduledPost] Failed to fetch business identity:', error);
        }
      } else {
        console.log('⚠️ No planId provided, using minimal identity data');
      }

      // Step 4: Select topic for content generation
      console.log(`\n📝 Step 4: Selecting topic for content generation...`);
      const selectedTopic = this.selectTopicForGeneration(post.topics);
      console.log(`✅ Selected topic: ${selectedTopic}`);

      // Step 5: Generate Facebook content with full identity context
      console.log(`\n🤖 Step 5: Generating Facebook content...`);
      const { generateFacebookContent } = await import('../sns/facebook/generate-text-content');
      const { getAuthenticatedPage } = await import('../sns/facebook/login');
      const { createFacebookPost } = await import('../sns/facebook/facebook-post');
      
      // Build structured prompt with business identity
      const identityPayload = businessIdentity?.identity
        ? {
            brandName: businessIdentity?.source?.title || connection.name,
            coreIdentity: businessIdentity.identity.coreIdentity,
            brandCategory: businessIdentity.identity.brandCategory,
            targetAudience: businessIdentity.identity.targetAudience,
            toneVoice: businessIdentity.identity.toneVoice,
            signatureProof: businessIdentity.identity.signatureProof,
            keywords: businessIdentity?.source?.keywords?.slice(0, 10),
            proofPoints: businessIdentity.identity.proofPoints,
          }
        : {
            brandName: connection.name,
            brandDescription: selectedTopic,
          };

      const recommendedCta =
        Array.isArray(businessIdentity?.recommendedActions) && businessIdentity?.recommendedActions.length > 0
          ? businessIdentity?.recommendedActions[0]?.detail
          : undefined;

      const structuredPrompt = {
        identity: identityPayload,
        plan: {
          channel: 'Facebook',
          title: snsPlan?.title || post.title || 'Scheduled Post',
          summary: snsPlan?.summary || selectedTopic,
          topics: post.topics || [selectedTopic],
          cta: recommendedCta,
          contentGoal: selectedTopic,
        },
        contentGoal: `Create a Facebook post about: ${selectedTopic}`,
        visualBrief: snsPlan?.format || 'Professional, engaging visual',
        preferredHashtags: businessIdentity?.source?.keywords?.slice(0, 3) || [], // Facebook uses fewer hashtags
        extraInstructions: 'Generate authentic Facebook content that feels conversational and genuine.',
      };

      // Generate content first to get text and image prompt
      generatedContent = await generateFacebookContent(structuredPrompt);
      console.log(`✅ Facebook content generated successfully`);
      console.log(`📝 Post text length: ${generatedContent.text?.length || 0} characters`);
      console.log(`🖼️ Image prompt: ${generatedContent.imagePrompt || 'None'}`);

      // Step 6: Post to Facebook
      console.log(`\n📤 Step 6: Posting to Facebook...`);
      
      // Get authenticated Facebook page
      const authContext = await getAuthenticatedPage({
        username: connection.username,
        password: connection.password,
      });

      try {
        // Create Facebook post
        await createFacebookPost(authContext.page, {
          text: generatedContent.text,
          imagePath: undefined, // TODO: Generate image if imagePrompt is available
          waitAfterPost: 10000,
        });

        console.log(`✅ Facebook post published successfully`);

        // Wait a moment for post to be fully processed
        await authContext.page.waitForTimeout(2000);

        // Bring page to front briefly so user can see the success
        try {
          await authContext.page.bringToFront();
          await authContext.page.waitForTimeout(1000);
        } catch (bringError) {
          console.warn('[executeFacebookScheduledPost] Failed to bring Playwright page to front:', bringError);
        }

        console.log('[executeFacebookScheduledPost] Facebook post created successfully. Closing browser...');

        // Close the browser after successful post
        try {
          await authContext.close();
          console.log('[executeFacebookScheduledPost] Browser closed successfully');
        } catch (closeError) {
          console.warn('[executeFacebookScheduledPost] Failed to close browser after successful post:', closeError);
        }
      } catch (postError) {
        // Make sure to close browser on error
        try {
          await authContext.close();
        } catch (closeError) {
          console.warn('[executeFacebookScheduledPost] Failed to close browser after error:', closeError);
        }
        throw postError;
      }

      // Step 7: Create execution history record with success
      const completedAt = new Date();
      const duration = completedAt.getTime() - startedAt.getTime();
      try {
        const scheduledPostsManager = this.sqliteManager.getScheduledPostsManager();
        scheduledPostsManager.createExecution({
          scheduledPostId: post.id,
          status: 'success',
          startedAt,
          completedAt,
          duration,
          topics: post.topics || [],
          generatedContent: generatedContent ? {
            title: post.title || '',
            excerpt: generatedContent.text?.substring(0, 200) || '',
            wordCount: generatedContent.text?.length || 0,
            imageCount: generatedContent.imagePrompt ? 1 : 0,
          } : undefined,
        });
        console.log(`📊 Created execution history record`);
      } catch (execError) {
        console.warn('⚠️ Failed to create execution history record:', execError);
      }

      // Step 8: Update success statistics
      const executionTime = Date.now() - startTime;
      await this.updateRunStatistics(post.id, true, new Date(), null);
      
      console.log(`\n✅ ===== FACEBOOK SCHEDULED POST EXECUTION COMPLETED =====`);
      console.log(`📝 Post "${post.title}" executed successfully`);
      console.log(`⏱️ Execution time: ${executionTime}ms`);
      console.log(`🕐 Completed at: ${new Date().toISOString()}`);
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const completedAt = new Date();
      const duration = completedAt.getTime() - startedAt.getTime();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`\n💥 ===== FACEBOOK SCHEDULED POST EXECUTION FAILED =====`);
      console.error(`❌ Post "${post.title}" failed to execute`);
      console.error(`⏱️ Execution time: ${executionTime}ms`);
      console.error(`🕐 Failed at: ${new Date().toISOString()}`);
      console.error(`📄 Error details:`, error);
      
      // Create execution history record with failure
      try {
        const scheduledPostsManager = this.sqliteManager.getScheduledPostsManager();
        scheduledPostsManager.createExecution({
          scheduledPostId: post.id,
          status: 'failure',
          startedAt,
          completedAt,
          duration,
          errorMessage,
          topics: post.topics || [],
          generatedContent: generatedContent ? {
            title: post.title || '',
            excerpt: generatedContent.text?.substring(0, 200) || '',
            wordCount: generatedContent.text?.length || 0,
            imageCount: generatedContent.imagePrompt ? 1 : 0,
          } : undefined,
        });
        console.log(`📊 Created execution history record`);
      } catch (execError) {
        console.warn('⚠️ Failed to create execution history record:', execError);
      }
      
      // Update failure statistics
      try {
        await this.updateRunStatistics(post.id, false, null, errorMessage);
        console.log(`📊 Failure statistics updated`);
      } catch (updateError) {
        console.error(`❌ Failed to update failure statistics:`, updateError);
      }
      
      throw error; // Re-throw to be caught by the caller
    }
  }

  /**
   * Execute a YouTube scheduled post
   */
  private async executeYouTubeScheduledPost(post: any): Promise<void> {
    const startTime = Date.now();
    const startedAt = new Date();
    
    // Ensure topics are loaded for scheduled (cron) executions
    try {
      if (!post.topics || post.topics.length === 0) {
        const topics = await this.sqliteManager.getScheduledPostsManager().getScheduledPostTopics(post.id);
        post.topics = Array.isArray(topics) ? topics.map((t: any) => t.topicName) : [];
      }
    } catch (loadTopicsError) {
      console.warn('⚠️ Could not load topics for scheduled post, continuing:', loadTopicsError);
    }
    
    console.log(`\n🚀 ===== STARTING YOUTUBE SCHEDULED POST EXECUTION =====`);
    console.log(`📝 Post: ${post.title}`);
    console.log(`🔗 Connection: ${post.connectionName} (${post.connectionType})`);
    console.log(`📋 Topics: ${post.topics?.join(', ') || 'None'}`);
    console.log(`⏰ Scheduled Time: ${post.scheduledTime}`);
    console.log(`🕐 Execution started at: ${new Date().toISOString()}`);
    
    let generatedContent: any = null;
    let videoUrl: string | null = null;
    
    try {
      // Step 1: Get connection details
      console.log(`\n🔍 Step 1: Getting connection details...`);
      const connection = await this.getConnection(post.connectionId, post.connectionName, post.connectionType);
      if (!connection) {
        throw new Error(`${post.connectionType} connection not found: ${post.connectionName}`);
      }
      console.log(`✅ Connection found: ${connection.name} (${post.connectionType})`);

      // Step 2: Set up environment variables
      console.log(`\n⚙️ Step 2: Setting up environment variables...`);
      this.setupEnvironmentVariables(connection, (post as any).aiKeyId || null, post.connectionType);
      console.log(`✅ Environment variables configured`);

      // Step 3: Fetch business identity data if planId is available
      console.log(`\n🔍 Step 3: Fetching business identity data...`);
      let businessIdentity: any = null;
      let snsPlan: any = null;
      
      if ((post as any).planId) {
        try {
          const biManager = this.sqliteManager.getBusinessIdentityManager();
          const plan = biManager.getPlan((post as any).planId);
          
          if (plan) {
            snsPlan = plan;
            console.log(`✅ Found SNS plan: ${plan.title}`);
            
            // Fetch the business identity snapshot
            const snapshot = biManager.getSnapshot(plan.snapshotId);
            if (snapshot && snapshot.identityJson) {
              try {
                businessIdentity = JSON.parse(snapshot.identityJson);
                console.log(`✅ Business identity loaded for brand: ${businessIdentity?.source?.title || 'Unknown'}`);
              } catch (parseError) {
                console.warn('[executeYouTubeScheduledPost] Failed to parse identity JSON:', parseError);
              }
            } else {
              console.warn('[executeYouTubeScheduledPost] No identity snapshot found for plan');
            }
          } else {
            console.warn('[executeYouTubeScheduledPost] SNS plan not found for planId:', (post as any).planId);
          }
        } catch (error) {
          console.warn('[executeYouTubeScheduledPost] Failed to fetch business identity:', error);
        }
      } else {
        console.log('⚠️ No planId provided, using minimal identity data');
      }

      // Step 4: Select topic for content generation
      console.log(`\n📝 Step 4: Selecting topic for content generation...`);
      const selectedTopic = this.selectTopicForGeneration(post.topics);
      console.log(`✅ Selected topic: ${selectedTopic}`);

      // Step 5: Generate YouTube content with full identity context
      console.log(`\n🤖 Step 5: Generating YouTube content...`);
      const { generateYouTubeContent } = await import('../sns/youtube/generate-youtube-content');
      const { getAuthenticatedPage } = await import('../sns/youtube/login');
      const { createYouTubePost } = await import('../sns/youtube/youtube-post');
      
      // Build structured prompt with business identity
      const identityPayload = businessIdentity?.identity
        ? {
            brandName: businessIdentity?.source?.title || connection.name,
            coreIdentity: businessIdentity.identity.coreIdentity,
            brandCategory: businessIdentity.identity.brandCategory,
            targetAudience: businessIdentity.identity.targetAudience,
            toneVoice: businessIdentity.identity.toneVoice,
            signatureProof: businessIdentity.identity.signatureProof,
            keywords: businessIdentity?.source?.keywords?.slice(0, 10),
            proofPoints: businessIdentity.identity.proofPoints,
          }
        : {
            brandName: connection.name,
            brandDescription: selectedTopic,
          };

      const structuredPrompt = {
        identity: identityPayload,
        plan: {
          channel: 'YouTube',
          title: snsPlan?.title || post.title || 'Scheduled Video',
          summary: snsPlan?.summary || selectedTopic,
          topics: post.topics || [selectedTopic],
          contentGoal: selectedTopic,
        },
        contentGoal: `Create a YouTube video about: ${selectedTopic}`,
        visualBrief: snsPlan?.format || 'Professional video content',
        preferredHashtags: businessIdentity?.source?.keywords?.slice(0, 10) || [],
        extraInstructions: 'Generate engaging YouTube video metadata with title, description, and relevant tags.',
      };

      // Generate content first to get title, description, and tags
      generatedContent = await generateYouTubeContent(structuredPrompt);
      console.log(`✅ YouTube content generated successfully`);
      console.log(`📝 Title: ${generatedContent.title || 'None'}`);
      console.log(`📄 Description length: ${generatedContent.description?.length || 0} characters`);
      console.log(`🏷️ Tags: ${generatedContent.tags?.join(', ') || 'None'}`);

      // Step 6: Upload video to YouTube
      console.log(`\n📤 Step 6: Uploading video to YouTube...`);
      
      // If video path is not provided, we'll auto-generate a YouTube Short
      if (!post.videoPath) {
        console.log('📹 No video path provided - will auto-generate YouTube Short');
      } else {
        console.log(`📹 Using provided video path: ${post.videoPath}`);
      }

      // Get authenticated YouTube page using Chrome profile (recommended) or credentials
      const loginOptions: any = {};
      
      if (connection.chromeUserDataDir && connection.chromeExecutablePath) {
        // Use Chrome profile approach (recommended - avoids CAPTCHA/2FA)
        console.log('[executeYouTubeScheduledPost] Using Chrome user data directory (persistent session)...');
        loginOptions.chromeUserDataDir = connection.chromeUserDataDir;
        loginOptions.chromeExecutablePath = connection.chromeExecutablePath;
      } else if (connection.username && connection.password) {
        // Fallback to automated login (may hit CAPTCHA/2FA)
        console.log('[executeYouTubeScheduledPost] Using automated login (may encounter CAPTCHA/2FA)...');
        loginOptions.username = connection.username;
        loginOptions.password = connection.password;
      } else {
        throw new Error('YouTube connection must have either chromeUserDataDir+chromeExecutablePath OR username+password');
      }

      const authContext = await getAuthenticatedPage(loginOptions);

      try {
        // Create YouTube post
        // If videoPath is not provided, generate a short video automatically using company info and prompts
        console.log(`📹 ${post.videoPath ? 'Using provided video' : 'Auto-generating YouTube Short from company info and prompts...'}`);
        
        await createYouTubePost(authContext.page, {
          videoPath: post.videoPath, // Optional - will generate if not provided
          title: generatedContent.title,
          description: generatedContent.description,
          tags: generatedContent.tags,
          visibility: (post as any).visibility || 'public',
          waitAfterPublish: 30000,
          generateVideo: !post.videoPath, // Generate video if path not provided
          structuredPrompt: structuredPrompt, // Pass structuredPrompt with company info for video generation
        });

        console.log(`✅ YouTube video uploaded successfully`);

        // Wait a moment for upload to be fully processed
        await authContext.page.waitForTimeout(2000);

        // Bring page to front briefly so user can see the success
        try {
          await authContext.page.bringToFront();
          await authContext.page.waitForTimeout(1000);
        } catch (bringError) {
          console.warn('[executeYouTubeScheduledPost] Failed to bring Playwright page to front:', bringError);
        }

        console.log('[executeYouTubeScheduledPost] YouTube video uploaded successfully. Closing browser...');

        // Close the browser after successful upload
        try {
          await authContext.close();
          console.log('[executeYouTubeScheduledPost] Browser closed successfully');
        } catch (closeError) {
          console.warn('[executeYouTubeScheduledPost] Failed to close browser after successful upload:', closeError);
        }
      } catch (postError) {
        // Make sure to close browser on error
        try {
          await authContext.close();
        } catch (closeError) {
          console.warn('[executeYouTubeScheduledPost] Failed to close browser after error:', closeError);
        }
        throw postError;
      }

      // Step 7: Create execution history record with success
      const completedAt = new Date();
      const duration = completedAt.getTime() - startedAt.getTime();
      try {
        const scheduledPostsManager = this.sqliteManager.getScheduledPostsManager();
        scheduledPostsManager.createExecution({
          scheduledPostId: post.id,
          status: 'success',
          startedAt,
          completedAt,
          duration,
          blogPostUrl: videoUrl || undefined,
          topics: post.topics || [],
          generatedContent: generatedContent ? {
            title: generatedContent.title || post.title || '',
            excerpt: generatedContent.description?.substring(0, 200) || '',
            wordCount: generatedContent.description?.length || 0,
            imageCount: 0, // YouTube videos don't have images
          } : undefined,
        });
        console.log(`📊 Created execution history record`);
      } catch (execError) {
        console.warn('⚠️ Failed to create execution history record:', execError);
      }

      // Step 8: Update success statistics
      const executionTime = Date.now() - startTime;
      await this.updateRunStatistics(post.id, true, new Date(), null);
      
      console.log(`\n✅ ===== YOUTUBE SCHEDULED POST EXECUTION COMPLETED =====`);
      console.log(`📝 Post "${post.title}" executed successfully`);
      console.log(`⏱️ Execution time: ${executionTime}ms`);
      console.log(`🕐 Completed at: ${new Date().toISOString()}`);
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const completedAt = new Date();
      const duration = completedAt.getTime() - startedAt.getTime();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`\n💥 ===== YOUTUBE SCHEDULED POST EXECUTION FAILED =====`);
      console.error(`❌ Post "${post.title}" failed to execute`);
      console.error(`⏱️ Execution time: ${executionTime}ms`);
      console.error(`🕐 Failed at: ${new Date().toISOString()}`);
      console.error(`📄 Error details:`, error);
      
      // Create execution history record with failure
      try {
        const scheduledPostsManager = this.sqliteManager.getScheduledPostsManager();
        scheduledPostsManager.createExecution({
          scheduledPostId: post.id,
          status: 'failure',
          startedAt,
          completedAt,
          duration,
          errorMessage,
          topics: post.topics || [],
          generatedContent: generatedContent ? {
            title: generatedContent.title || post.title || '',
            excerpt: generatedContent.description?.substring(0, 200) || '',
            wordCount: generatedContent.description?.length || 0,
            imageCount: 0,
          } : undefined,
        });
        console.log(`📊 Created execution history record`);
      } catch (execError) {
        console.warn('⚠️ Failed to create execution history record:', execError);
      }
      
      // Update failure statistics
      try {
        await this.updateRunStatistics(post.id, false, null, errorMessage);
        console.log(`📊 Failure statistics updated`);
      } catch (updateError) {
        console.error(`❌ Failed to update failure statistics:`, updateError);
      }
      
      throw error; // Re-throw to be caught by the caller
    }
  }

  /**
   * Get connection details from storage based on connection type
   */
  private async getConnection(connectionId: string, connectionName: string, connectionType: string): Promise<any> {
    try {
      console.log(`🔍 Getting connection: ID=${connectionId}, Name=${connectionName}, Type="${connectionType}"`);
      let connection: any = null;
      
      if (connectionType === 'wordpress') {
        // Try to get from SQLite first
        const connections = this.sqliteManager.getWordPressConnections();
        connection = connections.find(conn => conn.id === connectionId || conn.name === connectionName);
        
        if (!connection) {
          // Fallback to store if not found in SQLite
          const { getStore } = require('../storage');
          const store = getStore();
          const storeConnections = store.get('wordpressConnections', []);
          connection = storeConnections.find((conn: any) => conn.id === connectionId || conn.name === connectionName);
        }
      } else if (connectionType === 'naver' || connectionType === 'Naver Blog') {
        // Get Naver connections from store
        const { getStore } = require('../storage');
        const store = getStore();
        const storeConnections = store.get('naverConnections', []);
        console.log(`🔍 Looking for Naver connection: ID=${connectionId}, Name=${connectionName}`);
        console.log(`🔍 Available Naver connections:`, storeConnections.map((conn: any) => ({ id: conn.id, name: conn.name })));
        connection = storeConnections.find((conn: any) => conn.id === connectionId || conn.name === connectionName);
      } else if (connectionType === 'instagram') {
        // Get Instagram connections from store (stored via instagram-handler)
        const { getStore } = require('../storage');
        const store = getStore();
        const storeConnections = store.get('instagramConnections', []);
        console.log(`🔍 Looking for Instagram connection: ID=${connectionId}, Name=${connectionName}`);
        console.log(`🔍 Available Instagram connections:`, storeConnections.map((conn: any) => ({ id: conn.id, name: conn.name })));
        connection = storeConnections.find((conn: any) => conn.id === connectionId || conn.name === connectionName);
      } else if (connectionType === 'facebook' || connectionType === 'fb') {
        // Get Facebook connections from store (stored via facebook-handler)
        const { getStore } = require('../storage');
        const store = getStore();
        const storeConnections = store.get('facebookConnections', []);
        console.log(`🔍 Looking for Facebook connection: ID=${connectionId}, Name=${connectionName}`);
        console.log(`🔍 Available Facebook connections:`, storeConnections.map((conn: any) => ({ id: conn.id, name: conn.name })));
        connection = storeConnections.find((conn: any) => conn.id === connectionId || conn.name === connectionName);
      } else if (connectionType === 'youtube' || connectionType === 'yt') {
        // Get YouTube connections from store (stored via youtube-handler)
        const { getStore } = require('../storage');
        const store = getStore();
        const storeConnections = store.get('youtubeConnections', []);
        console.log(`🔍 Looking for YouTube connection: ID=${connectionId}, Name=${connectionName}`);
        console.log(`🔍 Available YouTube connections:`, storeConnections.map((conn: any) => ({ id: conn.id, name: conn.name })));
        connection = storeConnections.find((conn: any) => conn.id === connectionId || conn.name === connectionName);
      }
      
      if (!connection) {
        throw new Error(`${connectionType} connection not found: ${connectionName} (ID: ${connectionId})`);
      }
      
      console.log(`🔍 Found ${connectionType} connection: ${connection.name}`);
      return connection;
    } catch (error) {
      console.error(`❌ Error getting ${connectionType} connection:`, error);
      throw error;
    }
  }

  /**
   * Set up environment variables for AI and platform-specific settings
   */
  private setupEnvironmentVariables(connection: any, aiKeyId?: string | null, connectionType?: string): void {
    try {
      // Set platform-specific environment variables
      if (connectionType === 'wordpress') {
        process.env.WORDPRESS_URL = connection.url;
        process.env.WORDPRESS_USERNAME = connection.username;
        process.env.WORDPRESS_PASSWORD = connection.password;
      } else if (connectionType === 'naver' || connectionType === 'Naver Blog') {
        // Naver doesn't need environment variables for the browser controller
        // The credentials are passed directly to the browser controller
        console.log(`⚙️ Naver connection: ${connection.name}`);
      }
      
      // Get AI API keys from electron store
      const aiKeys = this.getAIApiKeys();
      if (aiKeys.length === 0) {
        throw new Error('No AI API keys found. Please configure AI keys in the AI Keys Manager.');
      }

      // If a specific key ID is provided, try to use that first
      let selectedKey: any | null = null;
      if (aiKeyId) {
        selectedKey = aiKeys.find((k: any) => k.id === aiKeyId);
        if (!selectedKey) {
          console.warn(`⚠️ AI key with id ${aiKeyId} not found. Falling back to active key selection.`);
        } else if (!selectedKey.fields?.apiKey) {
          console.warn(`⚠️ AI key ${aiKeyId} has no apiKey. Falling back to active key selection.`);
          selectedKey = null;
        } else {
          const masked = String(selectedKey.fields.apiKey || '')
            .replace(/^(....).*(....)$/s, '$1...$2');
          console.log(`🔑 Selected AI key by id: ${selectedKey.name} (${selectedKey.providerId}) — ${masked}`);
        }
      }

      // Fall back to best active key if none explicitly selected
      if (!selectedKey) {
        selectedKey = this.findBestAIKey(aiKeys);
        if (selectedKey) {
          const masked = String(selectedKey.fields?.apiKey || '')
            .replace(/^(....).*(....)$/s, '$1...$2');
          console.log(`🔄 Fallback to active AI key: ${selectedKey.name} (${selectedKey.providerId}) — ${masked}`);
        }
      }

      if (!selectedKey) {
        throw new Error('No usable AI API key found. Please configure/activate an AI key.');
      }

      // Set AI environment variables based on the selected key
      this.setupAIEnvironmentVariables(selectedKey);
      
      console.log(`⚙️ WordPress URL: ${connection.url}`);
      console.log(`⚙️ WordPress Username: ${connection.username}`);
      console.log(`⚙️ AI Provider: ${process.env.AI_PROVIDER}`);
      console.log(`⚙️ AI Model: ${process.env.AI_MODEL}`);
      console.log(`⚙️ Image Generation: ${process.env.IMAGE_GENERATION_ENABLED}`);
      console.log(`🔑 Using AI Key: ${selectedKey.name} (${selectedKey.providerId})`);
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
   * Generate blog content with images (for WordPress and Naver)
   */
  private async generateBlogContentWithImages(topic: string): Promise<any> {
    try {
      console.log(`🤖 Starting AI blog generation with images for topic: ${topic}`);
      
      // Import the blog generation functions
      const generateOutline = require('../ai-blog/generate-outline').default;
      const generateImages = require('../ai-blog/generate-images').default;
      
      // Generate blog outline with timeout handling
      console.log(`📝 Generating blog outline...`);
      let outline;
      try {
        outline = await Promise.race([
          generateOutline(topic),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Blog outline generation timeout after 120 seconds')), 120000)
          )
        ]);
      console.log(`✅ Blog outline generated`);
      } catch (outlineError) {
        const errorMessage = outlineError instanceof Error ? outlineError.message : String(outlineError);
        console.error(`❌ Blog outline generation failed: ${errorMessage}`);
        throw new Error(`Failed to generate blog outline: ${errorMessage}`);
      }
      
      // Generate images with timeout handling
      console.log(`🎨 Generating images...`);
      let blogContentWithImages;
      try {
        blogContentWithImages = await Promise.race([
          generateImages(outline),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Image generation timeout after 180 seconds')), 180000)
          )
        ]);
      console.log(`✅ Images generated: ${blogContentWithImages.images?.length || 0}`);
      } catch (imageError) {
        const errorMessage = imageError instanceof Error ? imageError.message : String(imageError);
        console.error(`❌ Image generation failed: ${errorMessage}`);
        // Fallback: return content without images
        console.log(`⚠️ Continuing with blog content without images`);
        blogContentWithImages = {
          ...outline,
          images: []
        };
      }
      
      // For Naver Blog, we need to save images locally and add filePath
      if (blogContentWithImages.images && blogContentWithImages.images.length > 0) {
        console.log(`💾 Saving images locally for Naver Blog...`);
        const fs = require('fs').promises;
        const path = require('path');
        
        for (let i = 0; i < blogContentWithImages.images.length; i++) {
          const image = blogContentWithImages.images[i];
          if (image.buffer && !image.filePath) {
            // Create output directory if it doesn't exist
            const outputDir = path.join(process.cwd(), 'output', 'generated-images');
            await fs.mkdir(outputDir, { recursive: true });
            
            // Generate filename
            const fileName = `naver_image_${Date.now()}_${i}`;
            const fileExtension = image.mimeType?.split('/')[1] || 'png';
            const fullFileName = `${fileName}.${fileExtension}`;
            const filePath = path.join(outputDir, fullFileName);
            
            // Save image to file
            await fs.writeFile(filePath, image.buffer);
            
            // Add filePath to image object
            blogContentWithImages.images[i].filePath = filePath;
            console.log(`💾 Saved image ${i + 1} to: ${filePath}`);
          }
        }
      }
      
      return blogContentWithImages;
    } catch (error) {
      console.error(`❌ Error generating blog content with images:`, error);
      throw error;
    }
  }

  /**
   * Generate blog content with images for Naver Blog (without WordPress upload)
   */
  private async generateBlogContentWithImagesForNaver(topic: string): Promise<any> {
    try {
      console.log(`🤖 Starting AI blog generation with images for Naver Blog: ${topic}`);
      
      // Import the blog generation functions
      const generateOutline = require('../ai-blog/generate-outline').default;
      
      // Generate blog outline with timeout handling
      console.log(`📝 Generating blog outline...`);
      let outline;
      try {
        outline = await Promise.race([
          generateOutline(topic),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Blog outline generation timeout after 120 seconds')), 120000)
          )
        ]);
      console.log(`✅ Blog outline generated`);
      } catch (outlineError) {
        const errorMessage = outlineError instanceof Error ? outlineError.message : String(outlineError);
        console.error(`❌ Blog outline generation failed: ${errorMessage}`);
        throw new Error(`Failed to generate blog outline: ${errorMessage}`);
      }
      
      // Generate images directly without WordPress upload with timeout handling
      console.log(`🎨 Generating images for Naver Blog...`);
      let blogContentWithImages;
      try {
        blogContentWithImages = await Promise.race([
          this.generateImagesForNaver(outline),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Image generation timeout after 180 seconds')), 180000)
          )
        ]);
      console.log(`✅ Images generated: ${blogContentWithImages.images?.length || 0}`);
      } catch (imageError) {
        const errorMessage = imageError instanceof Error ? imageError.message : String(imageError);
        console.error(`❌ Image generation failed: ${errorMessage}`);
        // Fallback: return content without images
        console.log(`⚠️ Continuing with blog content without images`);
        blogContentWithImages = {
          ...outline,
          images: []
        };
      }
      
      return blogContentWithImages;
    } catch (error) {
      console.error(`❌ Error generating blog content with images for Naver:`, error);
      throw error;
    }
  }

  /**
   * Generate images for Naver Blog (local files only, no WordPress upload)
   */
  private async generateImagesForNaver(parsedContent: any): Promise<any> {
    if (parsedContent.images && parsedContent.images.length > 0) {
      const fs = require('fs').promises;
      const path = require('path');
      const mime = require('mime-types');
      
      for (let i = 0; i < parsedContent.images.length; i++) {
        const imageRequest = parsedContent.images[i];
        try {
          console.log(`🎨 Generating image ${i + 1}/${parsedContent.images.length}: ${imageRequest.description}`);
          const images = await this.generateSingleImage(imageRequest.description, 1, { outputMimeType: 'image/png' });
          if (images.length > 0) {
            const generatedImage = images[0];
            
            // Create output directory if it doesn't exist
            const outputDir = path.join(process.cwd(), 'output', 'generated-images');
            await fs.mkdir(outputDir, { recursive: true });
            
            // Generate filename
            const fileName = `naver_image_${Date.now()}_${i}`;
            const fileExtension = mime.extension(generatedImage.mimeType || 'image/png') || 'png';
            const fullFileName = `${fileName}.${fileExtension}`;
            const filePath = path.join(outputDir, fullFileName);
            
            // Save image to file
            await fs.writeFile(filePath, generatedImage.buffer);
            
            // Update the image object with local file info
            parsedContent.images[i] = {
              ...imageRequest,
              fileName: fullFileName,
              mimeType: generatedImage.mimeType,
              size: generatedImage.size,
              buffer: generatedImage.buffer,
              filePath: filePath,
              generated: true
            };
            
            console.log(`✅ Generated and saved image ${i + 1}: ${filePath}`);
          }
        } catch (error: any) {
          console.error(`❌ Failed to generate image ${i + 1}:`, error.message);
          parsedContent.images[i] = {
            ...imageRequest,
            generated: false,
            error: error.message
          };
        }
      }
      
      const successCount = parsedContent.images.filter((img: any) => img.generated).length;
      console.log(`🎉 Image generation completed: ${successCount}/${parsedContent.images.length} successful`);
    }
    
    return parsedContent;
  }

  /**
   * Generate a single image using Gemini AI
   * @deprecated Use generateSingleImage from '../gemini' directly
   */
  private async generateSingleImage(prompt: string, count = 1, options?: { outputMimeType?: 'image/jpeg' | 'image/png' }): Promise<any[]> {
    const image = await generateSingleImage(prompt, {
      useRetry: false, // No retry in scheduled executor to fail fast
      outputMimeType: options?.outputMimeType || 'image/png', // Use PNG for Naver blog
    });
    return [image];
  }

  /**
   * Generate blog content without images (for Naver Blog)
   */
  private async generateBlogContentWithoutImages(topic: string): Promise<any> {
    try {
      console.log(`🤖 Starting AI blog generation without images for topic: ${topic}`);
      
      // Import only the blog outline generation function
      const generateOutline = require('../ai-blog/generate-outline').default;
      
      // Generate blog outline only (no images)
      console.log(`📝 Generating blog outline...`);
      const outline = await generateOutline(topic);
      console.log(`✅ Blog outline generated`);
      
      // Return the outline without processing images
      return {
        ...outline,
        images: [] // Explicitly set empty images array
      };
    } catch (error) {
      console.error(`❌ Error generating blog content without images:`, error);
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
      
      // Wrap upload in timeout handling
      const postUrl = await Promise.race([
        createPost(blogContent),
        new Promise<string>((_, reject) => 
          setTimeout(() => reject(new Error('WordPress upload timeout after 60 seconds')), 60000)
        )
      ]);
      console.log(`✅ WordPress upload completed: ${postUrl}`);
      return postUrl;
    } catch (error) {
      console.error(`❌ Error uploading to WordPress:`, error);
      throw error;
    }
  }

  /**
   * Upload blog content to Naver Blog
   */
  private async uploadToNaverBlog(blogContent: any, connection: any, imagePaths?: string[]): Promise<string> {
    try {
      console.log(`📤 Starting Naver Blog upload...`);
      console.log(`🖼️ Image paths: ${imagePaths?.length || 0} images`);
      
      // Import the Naver upload function
      const { runNaverBlogAutomation } = require('../naver/browser-controller');
      
      // Upload to Naver Blog
      const result = await runNaverBlogAutomation(
        {
          username: connection.username,
          password: connection.password,
          proxyUrl: connection.proxyUrl
        },
        {
          title: blogContent.title,
          content: blogContent.content,
          tags: `#ai #blog #naver`
        },
        imagePaths // Pass all image paths to browser-controller
      );
      
      if (!result.success) {
        throw new Error(`Naver Blog upload failed: ${result.error || 'Unknown error'}`);
      }
      
      console.log(`✅ Naver Blog upload completed successfully`);
      
      // Return the actual blog post URL if available, otherwise return generic blog URL
      if (result.blogUrl) {
        console.log(`🔗 Blog post URL: ${result.blogUrl}`);
        return result.blogUrl;
      } else {
        console.warn('⚠️ Blog post URL not available, returning generic blog URL');
        return 'https://blog.naver.com';
      }
    } catch (error) {
      console.error(`❌ Error uploading to Naver Blog:`, error);
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
      // Only log in debug mode to reduce console noise
      if (process.env.DEBUG_SCHEDULER === 'true') {
        console.log('🔍 Checking for schedule updates...');
      }
      
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
