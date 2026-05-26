/**
 * Debug script: finds the kakao plugin path and optionally installs it.
 * Run with: node scripts/debug/debug-kakao-plugin-path.js
 * Run with install: node scripts/debug/debug-kakao-plugin-path.js --install
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

const doInstall = process.argv.includes('--install');

// Candidate paths to check
const candidates = [
  // Windows per-user NSIS (most common)
  path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'EGDesk', 'resources', 'openclaw-kakao-plugin'),
  // Windows per-machine
  'C:\\Program Files\\EGDesk\\resources\\openclaw-kakao-plugin',
  // Mac
  '/Applications/EGDesk.app/Contents/Resources/openclaw-kakao-plugin',
  // Dev (running from source)
  path.join(__dirname, '..', '..', 'resources', 'openclaw-kakao-plugin'),
];

console.log('=== Kakao Plugin Path Debug ===\n');
console.log('Platform:', process.platform);
console.log('Home dir:', os.homedir());
console.log('');

let foundPath = null;

for (const candidate of candidates) {
  const exists = fs.existsSync(candidate);
  const hasIndex = exists && fs.existsSync(path.join(candidate, 'package.json'));
  const hasDist = exists && fs.existsSync(path.join(candidate, 'dist', 'channel.js'));
  console.log(`[${exists ? '✓' : '✗'}] ${candidate}`);
  if (exists) {
    console.log(`     package.json: ${hasIndex ? '✓' : '✗'}  dist/channel.js: ${hasDist ? '✓' : '✗'}`);
    if (!foundPath) foundPath = candidate;
  }
}

console.log('');

const extensionDir = path.join(os.homedir(), '.openclaw', 'extensions', 'kakao');
const extensionExists = fs.existsSync(extensionDir);
const extensionHasDeps = fs.existsSync(path.join(extensionDir, 'node_modules'));
console.log('=== Installed Extension ===');
console.log(`Extension dir: ${extensionDir}`);
console.log(`Exists: ${extensionExists ? '✓' : '✗'}`);
if (extensionExists) {
  console.log(`node_modules: ${extensionHasDeps ? '✓' : '✗'}`);
  try {
    const files = fs.readdirSync(extensionDir);
    console.log(`Files: ${files.join(', ')}`);
  } catch (e) {}
}

console.log('');

if (!foundPath) {
  console.log('✗ No plugin path found. Is EGDesk installed?');
  process.exit(1);
}

console.log(`Found plugin at: ${foundPath}`);

if (doInstall) {
  console.log('\n=== Running openclaw plugins install ===');
  try {
    const result = execSync(`openclaw plugins install --force "${foundPath}"`, { encoding: 'utf-8' });
    console.log(result);

    if (fs.existsSync(path.join(extensionDir, 'package.json'))) {
      console.log('\n=== Running npm install --production ===');
      const npmResult = execSync('npm install --production', { cwd: extensionDir, encoding: 'utf-8' });
      console.log(npmResult);
    }

    console.log('\n✓ Done. Restart the openclaw gateway.');
  } catch (e) {
    console.error('✗ Install failed:', e.message);
  }
} else {
  console.log('\nTo install, run:');
  console.log(`  node scripts/debug/debug-kakao-plugin-path.js --install`);
  console.log('\nOr manually:');
  console.log(`  openclaw plugins install --force "${foundPath}"`);
  console.log(`  cd "${extensionDir}" && npm install --production`);
}
