const os = require('os');
const fs = require('fs');
const path = require('path');

function testSystemDetection() {
  console.log('🧪 Testing PHP System Detection');
  console.log('================================');

  const platform = os.platform();
  const arch = os.arch();

  console.log(`Current System: ${platform}-${arch}`);
  console.log(`Node.js Platform: ${process.platform}`);
  console.log(`Node.js Architecture: ${process.arch}`);

  // Test platform detection logic
  let platformKey;
  let archDir;
  let phpBinaryName;
  let launcherName;

  if (platform === 'win32') {
    platformKey = 'windows';
    phpBinaryName = 'php.exe';
    launcherName = 'php.bat';
  } else if (platform === 'darwin') {
    platformKey = 'macos';
    phpBinaryName = 'php';
    launcherName = 'php-launcher';
  } else {
    platformKey = 'linux';
    phpBinaryName = 'php';
    launcherName = 'php-launcher';
  }

  // Determine architecture directory
  if (arch === 'x64' || arch === 'amd64') {
    archDir = 'x64';
  } else if (arch === 'arm64' || arch === 'aarch64') {
    archDir = 'arm64';
  } else if (arch === 'x86' || arch === 'ia32') {
    archDir = 'x86';
  } else {
    archDir = 'x64'; // Default fallback
  }

  console.log(`\n📁 Expected PHP Paths:`);
  console.log(`Platform Key: ${platformKey}`);
  console.log(`Architecture Dir: ${archDir}`);
  console.log(`PHP Binary: ${phpBinaryName}`);
  console.log(`Launcher: ${launcherName}`);

  // Check development directory
  const devPhpDir = path.join(
    __dirname,
    '..',
    'php-bundle',
    platformKey,
    archDir,
  );
  const devPhpPath = path.join(devPhpDir, phpBinaryName);
  const devLauncher = path.join(devPhpDir, launcherName);

  console.log(`\n🔍 Checking Development Paths:`);
  console.log(`Directory: ${devPhpDir}`);
  console.log(`PHP Path: ${devPhpPath}`);
  console.log(`Launcher Path: ${devLauncher}`);

  // Check if paths exist
  console.log(`\n✅ File Existence Check:`);
  console.log(`Directory exists: ${fs.existsSync(devPhpDir)}`);
  console.log(`PHP exists: ${fs.existsSync(devPhpPath)}`);
  console.log(`Launcher exists: ${fs.existsSync(devLauncher)}`);

  if (fs.existsSync(devPhpDir)) {
    console.log(`\n📋 Directory Contents:`);
    try {
      const files = fs.readdirSync(devPhpDir);
      files.forEach((file) => {
        const filePath = path.join(devPhpDir, file);
        const stats = fs.statSync(filePath);
        console.log(`  ${file} (${stats.isDirectory() ? 'dir' : 'file'})`);
      });
    } catch (error) {
      console.log(`  Error reading directory: ${error.message}`);
    }
  }

  // Check production paths (simulated)
  console.log(`\n🏭 Production Paths (simulated):`);
  const prodPhpDir = `[App Resources]/php-bundle/${platformKey}/${archDir}`;
  console.log(`Production Directory: ${prodPhpDir}`);
  console.log(`Production PHP: ${prodPhpDir}/${phpBinaryName}`);
  console.log(`Production Launcher: ${prodPhpDir}/${launcherName}`);

  // Test all available platforms
  console.log(`\n🌍 All Available Platforms:`);
  const allPlatforms = [
    { platform: 'darwin', arch: 'arm64', name: 'macOS ARM64' },
    { platform: 'darwin', arch: 'x64', name: 'macOS Intel' },
    { platform: 'win32', arch: 'x64', name: 'Windows x64' },
    { platform: 'win32', arch: 'x86', name: 'Windows x86' },
    { platform: 'linux', arch: 'x64', name: 'Linux x64' },
    { platform: 'linux', arch: 'arm64', name: 'Linux ARM64' },
  ];

  for (const p of allPlatforms) {
    const pPlatformKey =
      p.platform === 'win32'
        ? 'windows'
        : p.platform === 'darwin'
          ? 'macos'
          : p.platform;
    const pArchDir =
      p.arch === 'x64' ? 'x64' : p.arch === 'arm64' ? 'arm64' : 'x86';
    const pPhpDir = path.join(
      __dirname,
      '..',
      'php-bundle',
      pPlatformKey,
      pArchDir,
    );
    const pPhpPath = path.join(
      pPhpDir,
      p.platform === 'win32' ? 'php.exe' : 'php',
    );

    console.log(
      `  ${p.name}: ${fs.existsSync(pPhpPath) ? '✅' : '❌'} ${pPhpDir}`,
    );
  }

  console.log(`\n💡 Summary:`);
  console.log(
    `- Current system will look for: ${platformKey}/${archDir}/${phpBinaryName}`,
  );
  console.log(`- Development path: ${devPhpPath}`);
  console.log(
    `- Production path: [App Resources]/php-bundle/${platformKey}/${archDir}/${phpBinaryName}`,
  );
  console.log(`- Fallback to launcher: ${devLauncher}`);
}

if (require.main === module) {
  testSystemDetection();
}

module.exports = { testSystemDetection };
