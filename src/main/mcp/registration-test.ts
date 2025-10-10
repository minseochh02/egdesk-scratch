/**
 * MCP Registration Test
 * Example usage of the MCP registration service
 */

import { MCPRegistrationService, registerEGDeskMCP, testEGDeskMCPConnection } from './registration-service';

/**
 * Test MCP registration with a unique name
 */
export async function testMCPRegistration(): Promise<void> {
  console.log('🧪 Starting MCP Registration Test...');
  
  // First, test the connection
  console.log('📡 Testing connection to Supabase Edge Function...');
  const connectionOk = await testEGDeskMCPConnection();
  
  if (!connectionOk) {
    console.error('❌ Connection test failed. Check your Supabase Edge Function deployment.');
    return;
  }
  
  console.log('✅ Connection test passed!');
  
  // Generate a unique name for testing
  const timestamp = Date.now();
  const testName = `egdesk-test-${timestamp}`;
  
  console.log(`🔗 Registering MCP server with name: ${testName}`);
  
  try {
    const result = await registerEGDeskMCP(testName);
    
    if (result.success) {
      console.log('✅ MCP registration successful!');
      console.log('📊 Registration details:', {
        name: result.name,
        ip: result.ip,
        timestamp: result.timestamp,
        id: result.id,
      });
    } else if (result.status === 'name_taken') {
      console.log('⚠️ MCP name already taken');
      console.log('📊 Existing record:', result.existing_record);
    } else {
      console.error('❌ MCP registration failed:', result.message);
    }
  } catch (error: any) {
    console.error('❌ MCP registration error:', error);
  }
}

/**
 * Test with a specific name (useful for testing name conflicts)
 */
export async function testMCPRegistrationWithName(name: string): Promise<void> {
  console.log(`🧪 Testing MCP Registration with name: ${name}`);
  
  try {
    const result = await registerEGDeskMCP(name);
    
    if (result.success) {
      console.log('✅ MCP registration successful!');
      console.log('📊 Registration details:', {
        name: result.name,
        ip: result.ip,
        timestamp: result.timestamp,
        id: result.id,
      });
    } else if (result.status === 'name_taken') {
      console.log('⚠️ MCP name already taken');
      console.log('📊 Existing record:', result.existing_record);
    } else {
      console.error('❌ MCP registration failed:', result.message);
    }
  } catch (error: any) {
    console.error('❌ MCP registration error:', error);
  }
}

/**
 * Run comprehensive MCP registration tests
 */
export async function runMCPRegistrationTests(): Promise<void> {
  console.log('🚀 Running comprehensive MCP registration tests...');
  
  // Test 1: Connection test
  console.log('\n📡 Test 1: Connection Test');
  await testMCPRegistration();
  
  // Test 2: Name conflict test
  console.log('\n📡 Test 2: Name Conflict Test');
  await testMCPRegistrationWithName('test-conflict-name');
  
  // Test 3: Another unique registration
  console.log('\n📡 Test 3: Another Unique Registration');
  await testMCPRegistration();
  
  console.log('\n✅ All MCP registration tests completed!');
}

// Export for use in other modules
export default {
  testMCPRegistration,
  testMCPRegistrationWithName,
  runMCPRegistrationTests,
};
