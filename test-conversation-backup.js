/**
 * Test script to verify conversation-based backups work correctly
 * This simulates multiple write_file calls in a single conversation
 */

const { WriteFileTool } = require('./src/main/ai-services/tools/write-file.ts');
const { CreateHistoryManager } = require('./src/main/create-history.ts');

async function testConversationBackups() {
  console.log('🧪 Testing conversation-based backups...');
  
  const conversationId = 'test-conversation-123';
  const writeFileTool = new WriteFileTool();
  const createHistoryManager = new CreateHistoryManager();
  
  try {
    // Test 1: First write_file call
    console.log('\n📝 Test 1: First write_file call');
    const result1 = await writeFileTool.execute(
      { filePath: 'test-file-1.txt', content: 'First file content' },
      undefined,
      conversationId
    );
    console.log('✅ Result 1:', result1);
    
    // Test 2: Second write_file call in same conversation
    console.log('\n📝 Test 2: Second write_file call (same conversation)');
    const result2 = await writeFileTool.execute(
      { filePath: 'test-file-2.txt', content: 'Second file content' },
      undefined,
      conversationId
    );
    console.log('✅ Result 2:', result2);
    
    // Test 3: Third write_file call in same conversation
    console.log('\n📝 Test 3: Third write_file call (same conversation)');
    const result3 = await writeFileTool.execute(
      { filePath: 'test-file-3.txt', content: 'Third file content' },
      undefined,
      conversationId
    );
    console.log('✅ Result 3:', result3);
    
    // Test 4: Different conversation ID
    console.log('\n📝 Test 4: Different conversation ID');
    const differentConversationId = 'test-conversation-456';
    const result4 = await writeFileTool.execute(
      { filePath: 'test-file-4.txt', content: 'Different conversation content' },
      undefined,
      differentConversationId
    );
    console.log('✅ Result 4:', result4);
    
    console.log('\n🎉 All tests completed! Check the .backup directory structure:');
    console.log('Expected structure:');
    console.log('  .backup/');
    console.log('    conversation-test-conversation-123-backup/');
    console.log('      test-file-1.txt');
    console.log('      test-file-2.txt');
    console.log('      test-file-3.txt');
    console.log('    conversation-test-conversation-456-backup/');
    console.log('      test-file-4.txt');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testConversationBackups();
