/**
 * Download and prepare npm for bundling with the Electron app
 *
 * This script downloads the npm package from the registry and extracts it
 * to the resources directory so it can be bundled with the app.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const NPM_VERSION = '10.9.2'; // Latest stable version
const RESOURCES_DIR = path.join(__dirname, '../../resources');
const NPM_DIR = path.join(RESOURCES_DIR, 'npm');

/**
 * Download a file from URL to local path
 */
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`📥 Downloading from ${url}...`);

    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        return downloadFile(response.headers.location, dest)
          .then(resolve)
          .catch(reject);
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log('✅ Download complete');
        resolve();
      });
    }).on('error', (err) => {
      fs.unlinkSync(dest);
      reject(err);
    });
  });
}

/**
 * Extract tarball
 */
function extractTarball(tarballPath, destDir) {
  console.log(`📦 Extracting tarball to ${destDir}...`);

  try {
    // Create destination directory
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Extract using tar command
    execSync(`tar -xzf "${tarballPath}" -C "${destDir}" --strip-components=1`, {
      stdio: 'inherit'
    });

    console.log('✅ Extraction complete');
  } catch (error) {
    console.error('❌ Failed to extract tarball:', error);
    throw error;
  }
}

/**
 * Cleanup unnecessary files to reduce bundle size
 */
function cleanupNpm(npmDir) {
  console.log('🧹 Cleaning up unnecessary files...');

  const toRemove = [
    'docs',
    'man',
    'test',
    'tests',
    '.github',
    '*.md',
    'CHANGELOG*',
    'LICENSE*',
    'AUTHORS*',
  ];

  toRemove.forEach(pattern => {
    try {
      const matches = pattern.includes('*')
        ? execSync(`find "${npmDir}" -name "${pattern}"`, { encoding: 'utf8' }).trim().split('\n')
        : [path.join(npmDir, pattern)];

      matches.forEach(match => {
        if (match && fs.existsSync(match)) {
          fs.rmSync(match, { recursive: true, force: true });
          console.log(`  Removed: ${path.relative(npmDir, match)}`);
        }
      });
    } catch (err) {
      // Ignore errors (pattern might not match anything)
    }
  });

  console.log('✅ Cleanup complete');
}

/**
 * Verify npm installation
 */
function verifyNpm(npmDir) {
  console.log('🔍 Verifying npm installation...');

  const npmCliPath = path.join(npmDir, 'bin', 'npm-cli.js');
  const npxCliPath = path.join(npmDir, 'bin', 'npx-cli.js');

  if (!fs.existsSync(npmCliPath)) {
    throw new Error(`npm-cli.js not found at ${npmCliPath}`);
  }

  if (!fs.existsSync(npxCliPath)) {
    throw new Error(`npx-cli.js not found at ${npxCliPath}`);
  }

  console.log('✅ npm and npx found');
  console.log(`   npm: ${npmCliPath}`);
  console.log(`   npx: ${npxCliPath}`);
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting npm bundling process...');
  console.log(`📦 npm version: ${NPM_VERSION}`);

  try {
    // Create resources directory if it doesn't exist
    if (!fs.existsSync(RESOURCES_DIR)) {
      fs.mkdirSync(RESOURCES_DIR, { recursive: true });
    }

    // Remove existing npm directory
    if (fs.existsSync(NPM_DIR)) {
      console.log('🗑️  Removing existing npm directory...');
      fs.rmSync(NPM_DIR, { recursive: true, force: true });
    }

    // Download npm tarball
    const tarballUrl = `https://registry.npmjs.org/npm/-/npm-${NPM_VERSION}.tgz`;
    const tarballPath = path.join(RESOURCES_DIR, 'npm.tgz');

    await downloadFile(tarballUrl, tarballPath);

    // Extract tarball
    extractTarball(tarballPath, NPM_DIR);

    // Cleanup
    cleanupNpm(NPM_DIR);

    // Verify
    verifyNpm(NPM_DIR);

    // Remove tarball
    fs.unlinkSync(tarballPath);

    console.log('');
    console.log('✅ npm bundling complete!');
    console.log(`📁 npm installed at: ${NPM_DIR}`);

    // Get directory size
    const size = execSync(`du -sh "${NPM_DIR}"`, { encoding: 'utf8' }).split('\t')[0];
    console.log(`💾 Bundle size: ${size}`);

  } catch (error) {
    console.error('❌ Failed to bundle npm:', error);
    process.exit(1);
  }
}

main();
