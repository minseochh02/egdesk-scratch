const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Your existing PHP binary
const SYSTEM_PHP = '/opt/homebrew/bin/php';

async function bundleExistingPHP() {
  console.log('🐘 Bundling existing PHP binary...');

  // Create bundle directory
  const bundleDir = path.join(__dirname, '..', 'php-bundle');
  fs.mkdirSync(bundleDir, { recursive: true });

  try {
    // Check if PHP exists and works
    console.log('📋 Testing PHP binary...');
    const version = execSync(`${SYSTEM_PHP} --version`, { encoding: 'utf8' });
    console.log('✅ PHP Version:', version.split('\n')[0]);

    // Check dependencies
    console.log('\n🔍 Checking PHP dependencies...');
    const deps = execSync(`otool -L ${SYSTEM_PHP}`, { encoding: 'utf8' });
    console.log(deps);

    // Copy PHP binary
    const targetPHP = path.join(bundleDir, 'php');
    fs.copyFileSync(SYSTEM_PHP, targetPHP);
    fs.chmodSync(targetPHP, '755');
    console.log(`✅ PHP binary copied to: ${targetPHP}`);

    // Check if we need to bundle libraries
    const libLines = deps
      .split('\n')
      .filter(
        (line) =>
          line.includes('/opt/homebrew/') || line.includes('/usr/local/'),
      );

    if (libLines.length > 1) {
      // More than just the binary itself
      console.log('\n📚 Found Homebrew dependencies that need bundling:');
      libLines.forEach((line) => console.log('  ', line.trim()));

      // Create lib directory and copy dependencies
      const libDir = path.join(bundleDir, 'lib');
      fs.mkdirSync(libDir, { recursive: true });

      for (const line of libLines) {
        const match = line.match(/\s+(\S+\.dylib)/);
        if (match && match[1].includes('/opt/homebrew/')) {
          const libPath = match[1];
          const libName = path.basename(libPath);
          const targetLib = path.join(libDir, libName);

          try {
            fs.copyFileSync(libPath, targetLib);
            console.log(`✅ Copied library: ${libName}`);
          } catch (error) {
            console.log(`⚠️  Could not copy ${libName}: ${error.message}`);
          }
        }
      }

      // Create launcher script that sets up library paths
      const launcherScript = `#!/bin/bash
# PHP Bundle Launcher Script
SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
export DYLD_LIBRARY_PATH="\${SCRIPT_DIR}/lib:\${DYLD_LIBRARY_PATH}"
exec "\${SCRIPT_DIR}/php" "$@"
`;

      const launcherPath = path.join(bundleDir, 'php-launcher');
      fs.writeFileSync(launcherPath, launcherScript);
      fs.chmodSync(launcherPath, '755');
      console.log(`✅ Created launcher: ${launcherPath}`);
    } else {
      console.log('✅ PHP binary appears to be self-contained!');
    }

    // Test the bundled PHP
    console.log('\n🧪 Testing bundled PHP...');
    const testResult = execSync(`${targetPHP} --version`, { encoding: 'utf8' });
    console.log('✅ Bundled PHP works!');
    console.log(testResult.split('\n')[0]);

    // Get bundle size
    const bundleSize = execSync(`du -sh ${bundleDir}`, { encoding: 'utf8' });
    console.log(`📦 Bundle size: ${bundleSize.trim().split('\t')[0]}`);

    return bundleDir;
  } catch (error) {
    console.error('❌ Failed to bundle PHP:', error.message);
    throw error;
  }
}

async function createPortablePHPBundle() {
  console.log('🚀 Creating portable PHP bundle...');

  try {
    const bundleDir = await bundleExistingPHP();

    console.log('\n✅ PHP bundle created successfully!');
    console.log(`📁 Bundle location: ${bundleDir}`);
    console.log('\n📋 Usage:');
    console.log(`  Direct: ${path.join(bundleDir, 'php')} script.php`);
    if (fs.existsSync(path.join(bundleDir, 'php-launcher'))) {
      console.log(
        `  With launcher: ${path.join(bundleDir, 'php-launcher')} script.php`,
      );
    }
    console.log('\n💡 This bundle can be distributed with your app!');

    return bundleDir;
  } catch (error) {
    console.error('\n❌ Bundle creation failed:', error.message);
    console.log('\n🔧 Alternative approaches:');
    console.log('1. Use static-php-cli to build a truly static binary');
    console.log('2. Create an app installer that installs PHP via Homebrew');
    console.log('3. Use Docker to containerize your PHP app');

    process.exit(1);
  }
}

if (require.main === module) {
  createPortablePHPBundle().catch(console.error);
}

module.exports = { bundleExistingPHP, createPortablePHPBundle };
