#!/usr/bin/env node

/**
 * Combined Blog Generation and WordPress Upload Script
 * This script generates blog content using Gemini AI and uploads it to WordPress
 * To run this code you need to install the following dependencies:
 * npm install @google/genai mime
 */

const { generateStructuredBlogContent } = require('./gemini-generate-blog');
const { processBlogContent } = require('./wordpress-uploader');
const { getTaskMetadata } = require('../debug/get-task-metadata');
const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * Select a topic based on the selection mode
 * @param {Array} topics - Array of topic objects
 * @param {string} mode - Selection mode: 'round-robin', 'random', or 'least-used'
 * @returns {Object} - Selected topic object
 */
function selectTopic(topics, mode = 'least-used') {
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

/**
 * Select topic using round-robin (sequential) method
 */
function selectRoundRobinTopic(topics) {
  // Find the topic that was used least recently
  const sortedTopics = topics.sort((a, b) => {
    if (!a.lastUsed && !b.lastUsed) return 0;
    if (!a.lastUsed) return -1;
    if (!b.lastUsed) return 1;
    return new Date(a.lastUsed) - new Date(b.lastUsed);
  });
  
  return sortedTopics[0];
}

/**
 * Select topic randomly
 */
function selectRandomTopic(topics) {
  const randomIndex = Math.floor(Math.random() * topics.length);
  return topics[randomIndex];
}

/**
 * Select the least used topic
 */
function selectLeastUsedTopic(topics) {
  const sortedTopics = topics.sort((a, b) => (a.count || 0) - (b.count || 0));
  return sortedTopics[0];
}

/**
 * Update topic usage tracking
 * @param {Array} topics - Array of topic objects
 * @param {string} selectedTopicText - The topic text that was selected
 * @returns {Array} - Updated topics array
 */
function updateTopicUsage(topics, selectedTopicText) {
  const now = new Date().toISOString();
  
  console.log(`🔄 Updating topic usage for: "${selectedTopicText}"`);
  console.log(`📊 Total topics to process: ${topics.length}`);
  
  const updatedTopics = topics.map(topic => {
    if (topic.topic === selectedTopicText) {
      const oldCount = topic.count || 0;
      const newCount = oldCount + 1;
      console.log(`📊 Topic usage count: ${oldCount} > ${newCount}`);
      console.log(`⏰ Last used updated to: ${now}`);
      
      return {
        ...topic,
        lastUsed: now,
        count: newCount
      };
    }
    return topic;
  });
  
  // Verify the update worked
  const updatedTopic = updatedTopics.find(t => t.topic === selectedTopicText);
  if (updatedTopic) {
    console.log(`✅ Verification - Updated topic: "${updatedTopic.topic}", count: ${updatedTopic.count}, lastUsed: ${updatedTopic.lastUsed}`);
  } else {
    console.error(`❌ ERROR - Could not find updated topic: "${selectedTopicText}"`);
  }
  
  return updatedTopics;
}

/**
 * Update task metadata in the tasks file
 * @param {string} taskId - The task ID
 * @param {Object} updatedMetadata - The updated metadata
 * @param {string} selectedTopicText - The topic that was selected/updated (for verification)
 */
function updateTaskMetadata(taskId, updatedMetadata, selectedTopicText = null) {
  try {
    // Look for the tasks file in the correct location
    const tasksFilePath = path.join(os.homedir(), '.egdesk-scheduler', 'tasks.json');
    
    console.log(`📁 Tasks file path: ${tasksFilePath}`);
    
    if (!fs.existsSync(tasksFilePath)) {
      console.warn('⚠️  Tasks file not found, cannot update metadata');
      return;
    }
    
    console.log('📖 Reading tasks file...');
    const tasks = JSON.parse(fs.readFileSync(tasksFilePath, 'utf8'));
    console.log(`📊 Found ${tasks.length} tasks in file`);
    
    // Find and update the task by extracting task ID from command field
    const taskIndex = tasks.findIndex(t => {
      if (t.command && typeof t.command === 'string') {
        // Extract task ID from command string like: node script.js "task-1234567890-abc123"
        const match = t.command.match(/"([^"]+)"/);
        return match && match[1] === taskId;
      }
      return false;
    });
    if (taskIndex !== -1) {
      console.log(`🔍 Found task at index ${taskIndex}`);
      
      // Log current topic counts before update
      if (selectedTopicText && tasks[taskIndex].metadata && tasks[taskIndex].metadata.topics) {
        const currentTopics = tasks[taskIndex].metadata.topics;
        const selectedTopic = currentTopics.find(t => t.topic === selectedTopicText);
        if (selectedTopic) {
          console.log(`📊 Current count for "${selectedTopic.topic}": ${selectedTopic.count}`);
        }
      }
      
      // Merge the updated metadata with the existing metadata to preserve other fields
      tasks[taskIndex].metadata = {
        ...tasks[taskIndex].metadata,
        ...updatedMetadata
      };
      tasks[taskIndex].updatedAt = new Date().toISOString();
      
      // Log updated topic counts after update
      if (selectedTopicText && tasks[taskIndex].metadata && tasks[taskIndex].metadata.topics) {
        const updatedTopics = tasks[taskIndex].metadata.topics;
        const selectedTopic = updatedTopics.find(t => t.topic === selectedTopicText);
        if (selectedTopic) {
          console.log(`📊 Updated count for "${selectedTopic.topic}": ${selectedTopic.count}`);
        }
      }
      
      console.log('💾 Writing updated tasks to file...');
      // Save the updated tasks back to file
      fs.writeFileSync(tasksFilePath, JSON.stringify(tasks, null, 2));
      console.log('✅ Task metadata updated successfully');
      console.log(`📊 Updated topics count for task ${taskId}`);
      
      // Verify the write worked by reading back the file
      console.log('🔍 Verifying file write...');
      const verifyTasks = JSON.parse(fs.readFileSync(tasksFilePath, 'utf8'));
      const verifyTask = verifyTasks.find(t => {
        if (t.command && typeof t.command === 'string') {
          const match = t.command.match(/"([^"]+)"/);
          return match && match[1] === taskId;
        }
        return false;
      });
      if (selectedTopicText && verifyTask && verifyTask.metadata && verifyTask.metadata.topics) {
        const verifyTopic = verifyTask.metadata.topics.find(t => t.topic === selectedTopicText);
        if (verifyTopic) {
          console.log(`✅ Verification - File contains updated count for "${verifyTopic.topic}": ${verifyTopic.count}`);
        }
      }
      
    } else {
      console.warn('⚠️  Task not found for metadata update');
    }
    
  } catch (error) {
    console.error('❌ Error updating task metadata:', error.message);
    console.error('❌ Stack trace:', error.stack);
  }
}

/**
 * Main function to generate and upload blog content
 */
async function generateAndUploadBlog(topic, metadata = null) {
  try {
    console.log('🚀 Starting combined blog generation and upload...');
    console.log(`📝 Topic: ${topic}`);
    
    // Step 1: Generate blog content with Gemini
    console.log('\n🤖 Step 1: Generating blog content with Gemini AI...');
    const blogContent = await generateStructuredBlogContent(topic);
    
    // Step 2: Upload to WordPress
    console.log('\n📤 Step 2: Uploading to WordPress...');
    const result = await processBlogContent(blogContent);
    
    console.log('\n🎉 Blog generation and upload completed successfully!');
    console.log(`🔗 Post URL: ${result.post.link}`);
    console.log(`🖼️  Images uploaded: ${result.uploadedImages.filter(img => img.uploaded).length}/${result.uploadedImages.length}`);
    
    return result;
    
  } catch (error) {
    console.error('❌ Error in combined process:', error.message);
    throw error;
  }
}

/**
 * Main execution function - can be called directly with metadata or from command line
 */
async function main(providedMetadata = null, providedTaskId = null) {
  try {
    let taskId, metadata;
    
    if (providedMetadata && providedTaskId) {
      // Called directly with parameters (from scheduler)
      taskId = providedTaskId;
      metadata = providedMetadata;
      console.log('🚀 Starting Gemini blog generation and WordPress upload...');
      console.log(`🆔 Task ID: ${taskId}`);
    } else {
      // Called from command line (legacy support)
      taskId = process.argv[2];
      
      if (!taskId) {
        throw new Error('Task ID is required as command line argument');
      }
      
      console.log('🚀 Starting Gemini blog generation and WordPress upload...');
      console.log(`🆔 Task ID: ${taskId}`);
      
      // Retrieve task metadata
      metadata = getTaskMetadata(taskId);
      
      if (!metadata) {
        throw new Error('Failed to retrieve task metadata');
      }
    }
    
    if (!metadata.topics || !Array.isArray(metadata.topics) || metadata.topics.length === 0) {
      throw new Error('Topics array not found in task metadata');
    }
    
    // Select topic based on selection mode
    const selectedTopic = selectTopic(metadata.topics, metadata.topicSelectionMode || 'least-used');
    console.log(`📝 Selected Topic: ${selectedTopic.topic}`);
    console.log(`📊 Topic Selection Mode: ${metadata.topicSelectionMode || 'least-used'}`);
    
    // Update topic usage tracking
    console.log('\n🔄 Updating topic usage tracking...');
    const updatedTopics = updateTopicUsage(metadata.topics, selectedTopic.topic);
    
    // Update metadata with new usage data
    metadata.topics = updatedTopics;
    console.log(`📊 Updated metadata with ${updatedTopics.length} topics`);
    
    // Update environment variables from metadata if available
    if (metadata.wordpressSite) {
      process.env.WORDPRESS_URL = metadata.wordpressSite.url;
      process.env.WORDPRESS_USERNAME = metadata.wordpressSite.username;
      // Note: Password should be passed via environment variable for security
    }
    
    if (metadata.aiSettings) {
      process.env.IMAGE_GENERATION_ENABLED = metadata.aiSettings.imageGenerationEnabled ? 'true' : 'false';
      process.env.IMAGE_PROVIDER = metadata.aiSettings.imageProvider || 'gemini';
      process.env.IMAGE_QUALITY = metadata.aiSettings.imageQuality || 'standard';
      process.env.IMAGE_SIZE = metadata.aiSettings.imageSize || '1024x1024';
      process.env.IMAGE_STYLE = metadata.aiSettings.imageStyle || 'realistic';
      process.env.IMAGE_ASPECT_RATIO = metadata.aiSettings.imageAspectRatio || 'landscape';
    }
    
    // Check for required environment variables
    const requiredVars = [
      'GEMINI_API_KEY',
      'WORDPRESS_URL',
      'WORDPRESS_USERNAME',
      'WORDPRESS_PASSWORD'
    ];

    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        throw new Error(`${varName} environment variable is required`);
      }
    }
    
    // Update task metadata with new usage data FIRST (before blog generation)
    console.log('\n💾 Saving updated topic usage to tasks.json...');
    try {
      updateTaskMetadata(taskId, metadata, selectedTopic.topic);
    } catch (error) {
      console.error('❌ Error updating task metadata:', error.message);
      console.error('❌ Stack trace:', error.stack);
    }
    
    // Generate and upload blog
    let result;
    try {
      result = await generateAndUploadBlog(selectedTopic.topic, metadata);
    } catch (error) {
      console.error('❌ Error during blog generation:', error.message);
      // Metadata was already updated above
    }
    
    console.log('✅ Process completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  main();
}

module.exports = { generateAndUploadBlog, updateTaskMetadata, main };
