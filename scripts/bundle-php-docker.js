const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function runDockerBundling() {
  console.log('🐳 Docker-based PHP Cross-Platform Bundling');
  console.log('==========================================');
  
  try {
    // Check if Docker is available
    console.log('🔍 Checking Docker availability...');
    execSync('docker --version', { stdio: 'pipe' });
    console.log('✅ Docker is available');
    
    // Check if docker-compose is available
    try {
      execSync('docker-compose --version', { stdio: 'pipe' });
      console.log('✅ Docker Compose is available');
    } catch (error) {
      console.log('⚠️  Docker Compose not found, trying docker compose...');
      try {
        execSync('docker compose version', { stdio: 'pipe' });
        console.log('✅ Docker Compose (new syntax) is available');
      } catch (error2) {
        throw new Error('Docker Compose not available. Please install Docker Desktop or Docker Compose.');
      }
    }
    
    // Create output directory
    const outputDir = path.join(__dirname, '..', 'php-bundle');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    console.log('\n🚀 Starting Docker-based PHP bundling...');
    
    // Run Linux x64 bundling
    console.log('\n--- Linux x64 ---');
    try {
      execSync('docker run --rm -v "' + outputDir + ':/output" php:8.3-cli sh -c "mkdir -p /output/linux/x64 && cp /usr/local/bin/php /output/linux/x64/php && chmod +x /output/linux/x64/php && echo \'#!/bin/bash\' > /output/linux/x64/php-launcher && echo \'SCRIPT_DIR=\\"\\$$(cd \\"\\$$(dirname \\"\\$${BASH_SOURCE[0]}\\")\\" && pwd)\\"\' >> /output/linux/x64/php-launcher && echo \'exec \\"\\$${SCRIPT_DIR}/php\\" \\"\\$$@\\"\' >> /output/linux/x64/php-launcher && chmod +x /output/linux/x64/php-launcher && /output/linux/x64/php --version"', { stdio: 'inherit' });
      console.log('✅ Linux x64 PHP bundled successfully!');
    } catch (error) {
      console.error('❌ Failed to bundle Linux x64 PHP:', error.message);
    }
    
    // Run Linux ARM64 bundling
    console.log('\n--- Linux ARM64 ---');
    try {
      execSync('docker run --rm --platform linux/arm64 -v "' + outputDir + ':/output" php:8.3-cli sh -c "mkdir -p /output/linux/arm64 && cp /usr/local/bin/php /output/linux/arm64/php && chmod +x /output/linux/arm64/php && echo \'#!/bin/bash\' > /output/linux/arm64/php-launcher && echo \'SCRIPT_DIR=\\"\\$$(cd \\"\\$$(dirname \\"\\$${BASH_SOURCE[0]}\\")\\" && pwd)\\"\' >> /output/linux/arm64/php-launcher && echo \'exec \\"\\$${SCRIPT_DIR}/php\\" \\"\\$$@\\"\' >> /output/linux/arm64/php-launcher && chmod +x /output/linux/arm64/php-launcher && /output/linux/arm64/php --version"', { stdio: 'inherit' });
      console.log('✅ Linux ARM64 PHP bundled successfully!');
    } catch (error) {
      console.error('❌ Failed to bundle Linux ARM64 PHP:', error.message);
    }
    
    // Create macOS Intel placeholder (since we can't cross-compile macOS binaries in Docker)
    console.log('\n--- macOS Intel (Placeholder) ---');
    try {
      const macosDir = path.join(outputDir, 'macos', 'x64');
      fs.mkdirSync(macosDir, { recursive: true });
      
      // Create a placeholder script
      const placeholderScript = `#!/bin/bash
# macOS Intel PHP Placeholder
# This is a placeholder for macOS Intel PHP binary
# To get the actual binary, run this script on an Intel Mac:
# npm run php:bundle

echo "⚠️  macOS Intel PHP placeholder - requires actual Intel Mac to build"
echo "Run 'npm run php:bundle' on an Intel Mac to get the real binary"
exit 1
`;
      
      fs.writeFileSync(path.join(macosDir, 'php'), placeholderScript);
      fs.chmodSync(path.join(macosDir, 'php'), '755');
      
      const launcherScript = `#!/bin/bash
# PHP Bundle Launcher Script
SCRIPT_DIR="$(cd "$(dirname "\\$0")" && pwd)"
exec "\\${SCRIPT_DIR}/php" "\\$@"
`;
      
      fs.writeFileSync(path.join(macosDir, 'php-launcher'), launcherScript);
      fs.chmodSync(path.join(macosDir, 'php-launcher'), '755');
      
      console.log('✅ macOS Intel placeholder created');
    } catch (error) {
      console.error('❌ Failed to create macOS Intel placeholder:', error.message);
    }
    
    // Show results
    console.log('\n📋 Bundling Results:');
    console.log('===================');
    
    const platforms = [
      { name: 'macOS ARM64', path: 'macos/arm64' },
      { name: 'macOS Intel', path: 'macos/x64' },
      { name: 'Windows x64', path: 'windows/x64' },
      { name: 'Windows x86', path: 'windows/x86' },
      { name: 'Linux x64', path: 'linux/x64' },
      { name: 'Linux ARM64', path: 'linux/arm64' }
    ];
    
    for (const platform of platforms) {
      const platformPath = path.join(outputDir, platform.path);
      if (fs.existsSync(platformPath)) {
        const phpPath = path.join(platformPath, 'php');
        if (fs.existsSync(phpPath)) {
          console.log(`✅ ${platform.name}: ${platformPath}`);
        } else {
          console.log(`⚠️  ${platform.name}: ${platformPath} (incomplete)`);
        }
      } else {
        console.log(`❌ ${platform.name}: Not found`);
      }
    }
    
    console.log('\n💡 Next Steps:');
    console.log('- Linux binaries are ready to use');
    console.log('- Windows binaries are already available');
    console.log('- macOS Intel: Run on an Intel Mac to get real binary');
    console.log('- macOS ARM64: Already bundled from your system');
    
  } catch (error) {
    console.error('\n❌ Docker bundling failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure Docker is installed and running');
    console.log('2. Try: docker --version');
    console.log('3. Try: docker run hello-world');
    console.log('4. On Apple Silicon Macs, you might need: docker run --platform linux/amd64 hello-world');
    
    process.exit(1);
  }
}

if (require.main === module) {
  runDockerBundling().catch(console.error);
}

module.exports = { runDockerBundling };
