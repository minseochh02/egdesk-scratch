/**
 * Test script for Partial Edit Tool
 * This file can be used to test the partial edit functionality
 */

import { PartialEditTool } from './partial-edit';
import * as fs from 'fs';
import * as path from 'path';

async function testPartialEdit() {
  console.log('🧪 Testing Partial Edit Tool...');
  
  const tool = new PartialEditTool();
  
  // Create a test file
  const testFilePath = path.join(process.cwd(), 'test-partial-edit.txt');
  const testContent = `function hello() {
  console.log("Hello World");
  return "Hello";
}

function goodbye() {
  console.log("Goodbye World");
  return "Goodbye";
}

// Another hello function
function helloAgain() {
  console.log("Hello Again");
  return "Hello Again";
}`;

  try {
    // Write test file
    await fs.promises.writeFile(testFilePath, testContent, 'utf-8');
    console.log('✅ Created test file:', testFilePath);

    // Test 1: Exact replacement
    console.log('\n🔍 Test 1: Exact replacement');
    const result1 = await tool.execute({
      filePath: testFilePath,
      oldString: 'function hello() {\n  console.log("Hello World");\n  return "Hello";\n}',
      newString: 'function hello() {\n  console.log("Hello Universe");\n  return "Hello";\n}',
      expectedReplacements: 1
    });
    console.log('✅ Result:', result1);

    // Test 2: Flexible replacement (should match despite whitespace differences)
    console.log('\n🔍 Test 2: Flexible replacement');
    const result2 = await tool.execute({
      filePath: testFilePath,
      oldString: 'console.log("Goodbye World");',
      newString: '// console.log("Goodbye World");',
      expectedReplacements: 1,
      flexibleMatching: true
    });
    console.log('✅ Result:', result2);

    // Test 3: Multiple replacements
    console.log('\n🔍 Test 3: Multiple replacements');
    const result3 = await tool.execute({
      filePath: testFilePath,
      oldString: 'console.log',
      newString: '// console.log',
      expectedReplacements: 2
    });
    console.log('✅ Result:', result3);

    // Read final content
    const finalContent = await fs.promises.readFile(testFilePath, 'utf-8');
    console.log('\n📄 Final file content:');
    console.log(finalContent);

    // Clean up
    await fs.promises.unlink(testFilePath);
    console.log('\n🧹 Cleaned up test file');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testPartialEdit().catch(console.error);
}

export { testPartialEdit };
