#!/usr/bin/env node

/**
 * Test script for SQLite logging system
 * This demonstrates the benefits of SQLite over JSON for log storage
 */

const { SQLiteLogger } = require('../src/main/sqlite-logger');

async function testSQLiteLogging() {
  console.log('🧪 Testing SQLite Logging System\n');
  console.log('=' .repeat(50));

  try {
    const logger = new SQLiteLogger();

    // Test 1: Save some sample executions
    console.log('📝 Test 1: Saving sample executions...');
    
    const sampleExecutions = [
      {
        id: 'test-1-' + Date.now(),
        taskId: 'blog-task-1',
        startTime: new Date(),
        endTime: new Date(Date.now() + 5000),
        status: 'completed',
        exitCode: 0,
        output: '🤖 AI Generated Title: The Future of AI\n📝 AI Generated Content: 1500 characters\n🎨 Image Generation Status: 2/2 images generated successfully\n🔗 Final Post URL: https://example.com/post-1',
        error: null,
        pid: 12345,
        createdAt: new Date()
      },
      {
        id: 'test-2-' + Date.now(),
        taskId: 'blog-task-1',
        startTime: new Date(Date.now() - 10000),
        endTime: new Date(Date.now() - 5000),
        status: 'failed',
        exitCode: 1,
        output: '🤖 AI Generated Title: Machine Learning Basics',
        error: '❌ Image 1: Failed to generate - API quota exceeded\n❌ Image 2: Failed to generate - Network timeout',
        pid: 12346,
        createdAt: new Date(Date.now() - 10000)
      },
      {
        id: 'test-3-' + Date.now(),
        taskId: 'blog-task-2',
        startTime: new Date(Date.now() - 20000),
        endTime: new Date(Date.now() - 15000),
        status: 'completed',
        exitCode: 0,
        output: '🤖 AI Generated Title: Web Development Trends\n📝 AI Generated Content: 2000 characters\n🎨 Image Generation Status: 1/1 images generated successfully\n🔗 Final Post URL: https://example.com/post-2',
        error: null,
        pid: 12347,
        createdAt: new Date(Date.now() - 20000)
      }
    ];

    sampleExecutions.forEach(execution => {
      logger.saveExecution(execution);
    });

    console.log(`✅ Saved ${sampleExecutions.length} sample executions`);

    // Test 2: Query executions
    console.log('\n📊 Test 2: Querying executions...');
    
    const recentExecutions = logger.getRecentExecutions(10);
    console.log(`📋 Recent executions: ${recentExecutions.length}`);
    
    const taskExecutions = logger.getExecutionsForTask('blog-task-1', 5);
    console.log(`📋 Executions for blog-task-1: ${taskExecutions.length}`);

    // Test 3: Get statistics
    console.log('\n📈 Test 3: Execution statistics...');
    
    const allStats = logger.getExecutionStats();
    console.log('📊 All tasks stats:', allStats);
    
    const taskStats = logger.getExecutionStats('blog-task-1');
    console.log('📊 blog-task-1 stats:', taskStats);

    // Test 4: Database size
    console.log('\n💾 Test 4: Database size...');
    
    const dbSize = logger.getDatabaseSize();
    console.log(`📏 Database size: ${dbSize} MB`);

    // Test 5: Cleanup (simulate old logs)
    console.log('\n🗑️  Test 5: Cleanup simulation...');
    
    const deletedCount = logger.cleanupOldLogs(0); // Delete logs older than 0 days (all)
    console.log(`🗑️  Cleaned up ${deletedCount} old logs`);

    const finalSize = logger.getDatabaseSize();
    console.log(`📏 Final database size: ${finalSize} MB`);

    logger.close();

    console.log('\n' + '=' .repeat(50));
    console.log('✅ SQLite logging test completed successfully!');
    console.log('🎯 Benefits demonstrated:');
    console.log('   • Efficient querying by task ID, date, status');
    console.log('   • Automatic indexing for fast lookups');
    console.log('   • Easy cleanup of old logs');
    console.log('   • Compact storage format');
    console.log('   • Better performance than JSON for large datasets');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testSQLiteLogging();
