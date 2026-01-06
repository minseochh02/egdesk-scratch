const fs = require('fs');
const path = require('path');

// Files to update based on grep results
const filesToUpdate = [
  'src/main/chrome-handlers.ts',
  'src/main/seo/seo-analyzer.ts', 
  'src/main/sns/instagram/index.ts',
  'src/main/naver/browser-controller.ts',
  'src/main/test-parsing.ts',
  'src/main/sns/instagram/instagram-handler.ts',
  'src/main/sns/instagram/instagram-post.ts',
  'src/main/sns/instagram/login.ts',
  'src/main/main.ts',
  'src/main/sns/facebook/facebook-post.ts',
  'src/main/sns/facebook/login.ts',
  'src/main/sns/twitter/login.ts',
  'src/main/sns/youtube/youtube-post.ts',
  'src/main/sns/youtube/login.ts',
  'src/main/automator.js',
  'src/main/financehub/core/BaseBankAutomator.js',
  'src/main/mcp/file-conversion/file-conversion-service.ts',
  'src/main/financehub/types/index.ts'
];

const rootDir = '/Users/minseocha/Desktop/projects/Taesung/EGDesk-scratch/egdesk-scratch';

console.log('Updating playwright imports to playwright-core...\n');

filesToUpdate.forEach(file => {
  const filePath = path.join(rootDir, file);
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Replace various import patterns
    content = content.replace(/require\(['"]playwright['"]\)/g, "require('playwright-core')");
    content = content.replace(/from ['"]playwright['"]/g, "from 'playwright-core'");
    content = content.replace(/import\s+\{[^}]+\}\s+from\s+['"]playwright['"]/g, (match) => {
      return match.replace('playwright', 'playwright-core');
    });
    
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Updated: ${file}`);
    } else {
      console.log(`⏭️  No changes needed: ${file}`);
    }
  } catch (error) {
    console.error(`❌ Error updating ${file}: ${error.message}`);
  }
});

// Also update the one in the generated code template
const chromeHandlersPath = path.join(rootDir, 'src/main/chrome-handlers.ts');
try {
  let content = fs.readFileSync(chromeHandlersPath, 'utf8');
  
  // Update the template string that generates code
  content = content.replace(
    "const { chromium } = require('playwright');",
    "const { chromium } = require('playwright-core');"
  );
  
  fs.writeFileSync(chromeHandlersPath, content);
  console.log('\n✅ Updated code generation template in chrome-handlers.ts');
} catch (error) {
  console.error(`❌ Error updating template: ${error.message}`);
}

console.log('\n✨ Import update complete!');