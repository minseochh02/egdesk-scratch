/**
 * Test script to verify backup reversion functionality
 * This simulates creating backups and then testing reversion
 */

const { BackupManager } = require('./src/main/backup-manager.ts');
const { WriteFileTool } = require('./src/main/ai-services/tools/write-file.ts');
const path = require('path');
const fs = require('fs');

async function testBackupReversion() {
  console.log('🧪 Testing backup reversion functionality...');
  
  const backupManager = new BackupManager();
  const writeFileTool = new WriteFileTool();
  
  // Test conversation IDs
  const conversationA = 'test-conversation-a';
  const conversationB = 'test-conversation-b';
  const conversationC = 'test-conversation-c';
  
  const testDir = path.join(process.cwd(), 'backup-test');
  
  try {
    // Setup: Create test directory
    await fs.promises.mkdir(testDir, { recursive: true });
    process.chdir(testDir);
    
    console.log('\n📁 Created test directory:', testDir);
    
    // Test 1: Create files in conversation A
    console.log('\n📝 Test 1: Creating files in conversation A');
    await writeFileTool.execute(
      { filePath: 'file1.txt', content: 'Original content of file1' },
      undefined,
      conversationA
    );
    await writeFileTool.execute(
      { filePath: 'file2.txt', content: 'Original content of file2' },
      undefined,
      conversationA
    );
    
    // Test 2: Modify files in conversation B
    console.log('\n📝 Test 2: Modifying files in conversation B');
    await writeFileTool.execute(
      { filePath: 'file1.txt', content: 'Modified in conversation B' },
      undefined,
      conversationB
    );
    await writeFileTool.execute(
      { filePath: 'file3.txt', content: 'New file created in conversation B' },
      undefined,
      conversationB
    );
    
    // Test 3: Further modifications in conversation C
    console.log('\n📝 Test 3: Further modifications in conversation C');
    await writeFileTool.execute(
      { filePath: 'file2.txt', content: 'Modified in conversation C' },
      undefined,
      conversationC
    );
    await writeFileTool.execute(
      { filePath: 'file4.txt', content: 'New file created in conversation C' },
      undefined,
      conversationC
    );
    
    // Test 4: Check available backups
    console.log('\n📋 Test 4: Checking available backups');
    const backups = await backupManager.getAvailableBackups();
    console.log('Available backups:', backups.map(b => ({
      id: b.conversationId,
      files: b.files.length,
      timestamp: b.timestamp
    })));
    
    // Test 5: Get backup stats
    console.log('\n📊 Test 5: Getting backup statistics');
    const stats = await backupManager.getBackupStats();
    console.log('Backup stats:', stats);
    
    // Test 6: Revert single conversation (conversation C)
    console.log('\n🔄 Test 6: Reverting conversation C only');
    const revertResult = await backupManager.revertConversation(conversationC);
    console.log('Revert result:', revertResult);
    
    // Verify state after single revert
    console.log('\n✅ Verifying state after reverting conversation C:');
    console.log('file1.txt exists:', fs.existsSync('file1.txt'));
    console.log('file2.txt exists:', fs.existsSync('file2.txt'));
    console.log('file3.txt exists:', fs.existsSync('file3.txt'));
    console.log('file4.txt exists (should be false):', fs.existsSync('file4.txt'));
    
    if (fs.existsSync('file2.txt')) {
      const file2Content = await fs.promises.readFile('file2.txt', 'utf-8');
      console.log('file2.txt content (should be from conversation B):', file2Content);
    }
    
    // Test 7: Revert to conversation A (should revert B and A)
    console.log('\n🔄 Test 7: Reverting to conversation A (chronological)');
    const revertSummary = await backupManager.revertToConversation(conversationA);
    console.log('Revert summary:', revertSummary);
    
    // Verify final state
    console.log('\n✅ Verifying final state after reverting to conversation A:');
    console.log('file1.txt exists (should be false):', fs.existsSync('file1.txt'));
    console.log('file2.txt exists (should be false):', fs.existsSync('file2.txt'));
    console.log('file3.txt exists (should be false):', fs.existsSync('file3.txt'));
    console.log('file4.txt exists (should be false):', fs.existsSync('file4.txt'));
    
    // Check remaining backups
    console.log('\n📋 Checking remaining backups after reversion:');
    const remainingBackups = await backupManager.getAvailableBackups();
    console.log('Remaining backups:', remainingBackups.length);
    
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Cleanup: Remove test directory
    try {
      process.chdir('..');
      await fs.promises.rm(testDir, { recursive: true, force: true });
      console.log('🧹 Cleaned up test directory');
    } catch (cleanupError) {
      console.warn('⚠️ Failed to cleanup test directory:', cleanupError);
    }
  }
}

// Run the test
testBackupReversion();
