#!/usr/bin/env node

/**
 * Test Date Handling Script
 * This script tests the date handling in environment variables
 */

function testDateHandling() {
  console.log('🧪 Testing date handling in environment variables...');
  
  // Test TASK_CREATED_AT
  if (process.env.TASK_CREATED_AT) {
    console.log(`✅ TASK_CREATED_AT: ${process.env.TASK_CREATED_AT}`);
    const createdDate = new Date(process.env.TASK_CREATED_AT);
    console.log(`   Parsed as: ${createdDate.toISOString()}`);
  } else {
    console.log('❌ TASK_CREATED_AT not found');
  }
  
  // Test TASK_UPDATED_AT
  if (process.env.TASK_UPDATED_AT) {
    console.log(`✅ TASK_UPDATED_AT: ${process.env.TASK_UPDATED_AT}`);
    const updatedDate = new Date(process.env.TASK_UPDATED_AT);
    console.log(`   Parsed as: ${updatedDate.toISOString()}`);
  } else {
    console.log('❌ TASK_UPDATED_AT not found');
  }
  
  // Test TASK_LAST_RUN
  if (process.env.TASK_LAST_RUN) {
    console.log(`✅ TASK_LAST_RUN: ${process.env.TASK_LAST_RUN}`);
    const lastRunDate = new Date(process.env.TASK_LAST_RUN);
    console.log(`   Parsed as: ${lastRunDate.toISOString()}`);
  } else {
    console.log('ℹ️  TASK_LAST_RUN not set (task may not have run yet)');
  }
  
  // Test TASK_NEXT_RUN
  if (process.env.TASK_NEXT_RUN) {
    console.log(`✅ TASK_NEXT_RUN: ${process.env.TASK_NEXT_RUN}`);
    const nextRunDate = new Date(process.env.TASK_NEXT_RUN);
    console.log(`   Parsed as: ${nextRunDate.toISOString()}`);
  } else {
    console.log('ℹ️  TASK_NEXT_RUN not set');
  }
  
  // Test TASK_METADATA
  if (process.env.TASK_METADATA) {
    console.log(`✅ TASK_METADATA: ${process.env.TASK_METADATA}`);
    try {
      const metadata = JSON.parse(process.env.TASK_METADATA);
      console.log(`   Parsed metadata:`, JSON.stringify(metadata, null, 2));
    } catch (error) {
      console.log(`   ❌ Error parsing metadata: ${error.message}`);
    }
  } else {
    console.log('❌ TASK_METADATA not found');
  }
  
  console.log('\n🎉 Date handling test completed!');
}

// Run the test
testDateHandling();
