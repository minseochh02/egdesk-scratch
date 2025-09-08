const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

// Cross-platform PHP bundling script
const PLATFORMS = {
  'darwin-arm64': {
    name: 'macOS ARM64 (Apple Silicon)',
    phpPath: '/opt/homebrew/bin/php',
    bundleDir: 'macos/arm64',
    executable: 'php',
    launcher: 'php-launcher',
  },
  'darwin-x64': {
    name: 'macOS Intel (x64)',
    phpPath: '/usr/local/bin/php', // Homebrew on Intel Mac
    bundleDir: 'macos/x64',
    executable: 'php',
    launcher: 'php-launcher',
  },
  'win32-x64': {
    name: 'Windows x64',
    phpPath: null, // Use pre-downloaded binaries
    bundleDir: 'windows/x64',
    executable: 'php.exe',
    launcher: 'php.bat',
  },
  'win32-x86': {
    name: 'Windows x86',
    phpPath: null, // Use pre-downloaded binaries
    bundleDir: 'windows/x86',
    executable: 'php.exe',
    launcher: 'php.bat',
  },
  'linux-x64': {
    name: 'Linux x64',
    phpPath: '/usr/bin/php',
    bundleDir: 'linux/x64',
    executable: 'php',
    launcher: 'php-launcher',
  },
};

function detectSystem() {
  const platform = os.platform();
  const arch = os.arch();

  const archMap = {
    x64: 'x64',
    x86: 'x86',
    arm64: 'arm64',
  };

  return `${platform}-${archMap[arch] || arch}`;
}

async function bundleSystemPHP(platformInfo, systemKey) {
  console.log(`🐘 Bundling PHP for ${platformInfo.name}...`);

  const bundleDir = path.join(
    __dirname,
    '..',
    'php-bundle',
    platformInfo.bundleDir,
  );
  fs.mkdirSync(bundleDir, { recursive: true });

  try {
    if (platformInfo.phpPath && fs.existsSync(platformInfo.phpPath)) {
      // Bundle system PHP (macOS/Linux)
      console.log(`📋 Testing system PHP: ${platformInfo.phpPath}`);
      const version = execSync(`${platformInfo.phpPath} --version`, {
        encoding: 'utf8',
      });
      console.log('✅ PHP Version:', version.split('\n')[0]);

      // Copy PHP binary
      const targetPHP = path.join(bundleDir, platformInfo.executable);
      fs.copyFileSync(platformInfo.phpPath, targetPHP);
      fs.chmodSync(targetPHP, '755');
      console.log(`✅ PHP binary copied to: ${targetPHP}`);

      // Check dependencies and copy libraries
      if (os.platform() === 'darwin') {
        const deps = execSync(`otool -L ${platformInfo.phpPath}`, {
          encoding: 'utf8',
        });
        const libLines = deps
          .split('\n')
          .filter(
            (line) =>
              line.includes('/opt/homebrew/') || line.includes('/usr/local/'),
          );

        if (libLines.length > 1) {
          console.log('\n📚 Found dependencies that need bundling...');

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

          // Create launcher script
          const launcherScript = `#!/bin/bash
# PHP Bundle Launcher Script
SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
export DYLD_LIBRARY_PATH="\${SCRIPT_DIR}/lib:\${DYLD_LIBRARY_PATH}"
exec "\${SCRIPT_DIR}/${platformInfo.executable}" "$@"
`;

          const launcherPath = path.join(bundleDir, platformInfo.launcher);
          fs.writeFileSync(launcherPath, launcherScript);
          fs.chmodSync(launcherPath, '755');
          console.log(`✅ Created launcher: ${launcherPath}`);
        }
      }
    } else if (
      os.platform() === 'win32' ||
      platformInfo.bundleDir.startsWith('windows/')
    ) {
      // Use pre-downloaded Windows binaries
      console.log('📦 Using pre-downloaded Windows PHP binaries...');

      // The Windows binaries are already extracted in the correct directories
      // We just need to create a batch launcher
      const launcherScript = `@echo off
REM PHP Bundle Launcher Script
set SCRIPT_DIR=%~dp0
set PATH=%SCRIPT_DIR%;%PATH%
"%SCRIPT_DIR%${platformInfo.executable}" %*
`;

      const launcherPath = path.join(bundleDir, platformInfo.launcher);
      fs.writeFileSync(launcherPath, launcherScript);
      console.log(`✅ Created Windows launcher: ${launcherPath}`);
    } else {
      throw new Error(`No PHP found for ${platformInfo.name}`);
    }

    // Test the bundled PHP
    console.log('\n🧪 Testing bundled PHP...');
    const testCommand =
      os.platform() === 'win32'
        ? `"${path.join(bundleDir, platformInfo.executable)}" --version`
        : `${path.join(bundleDir, platformInfo.executable)} --version`;

    try {
      const testResult = execSync(testCommand, { encoding: 'utf8' });
      console.log('✅ Bundled PHP works!');
      console.log(testResult.split('\n')[0]);
    } catch (error) {
      console.log('⚠️  Could not test PHP binary, but bundling completed');
    }

    // Get bundle size
    const bundleSize = execSync(`du -sh ${bundleDir}`, { encoding: 'utf8' });
    console.log(`📦 Bundle size: ${bundleSize.trim().split('\t')[0]}`);

    return bundleDir;
  } catch (error) {
    console.error(
      `❌ Failed to bundle PHP for ${platformInfo.name}:`,
      error.message,
    );
    throw error;
  }
}

async function bundleAllPlatforms() {
  console.log('🚀 Cross-Platform PHP Bundling');
  console.log('================================');

  const currentSystem = detectSystem();
  console.log(`Current system: ${currentSystem}`);

  const results = {};

  for (const [systemKey, platformInfo] of Object.entries(PLATFORMS)) {
    try {
      console.log(`\n--- ${platformInfo.name} ---`);

      if (systemKey === currentSystem) {
        // Bundle for current system
        results[systemKey] = await bundleSystemPHP(platformInfo, systemKey);
      } else if (systemKey.startsWith('win32')) {
        // Windows binaries are already downloaded
        console.log('📦 Windows binaries already available');
        results[systemKey] = path.join(
          __dirname,
          '..',
          'php-bundle',
          platformInfo.bundleDir,
        );
      } else {
        console.log(`⏭️  Skipping ${platformInfo.name} (not current system)`);
        results[systemKey] = null;
      }
    } catch (error) {
      console.error(`❌ Failed to bundle ${platformInfo.name}:`, error.message);
      results[systemKey] = null;
    }
  }

  console.log('\n✅ Cross-platform PHP bundling completed!');
  console.log('\n📋 Results:');

  for (const [systemKey, result] of Object.entries(results)) {
    const platformInfo = PLATFORMS[systemKey];
    if (result) {
      console.log(`  ✅ ${platformInfo.name}: ${result}`);
    } else {
      console.log(`  ❌ ${platformInfo.name}: Not bundled`);
    }
  }

  console.log('\n💡 Usage:');
  console.log('- Current system: Use the bundled PHP directly');
  console.log('- Other platforms: Run this script on those systems');
  console.log('- Windows: Binaries are ready to use');

  return results;
}

if (require.main === module) {
  bundleAllPlatforms().catch(console.error);
}

module.exports = {
  bundleAllPlatforms,
  bundleSystemPHP,
  detectSystem,
  PLATFORMS,
};
