/**
 * Bundle the OpenClaw Kakao plugin into the app's resources directory.
 *
 * Copies dist/, package.json, and openclaw.plugin.json from the plugin source
 * into resources/openclaw-kakao-plugin/ so it can be installed at runtime via
 * `openclaw plugins install <resourcesPath>/openclaw-kakao-plugin`.
 *
 * Run: node scripts/build/bundle-kakao-plugin.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '../..');
const PLUGIN_SRC = path.join(ROOT, 'packages/openclaw-kakao-plugin');
const DEST = path.join(ROOT, 'resources/openclaw-kakao-plugin');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

// ── 0. Guard: skip if plugin source isn't checked out ─────────────────────
if (!fs.existsSync(PLUGIN_SRC)) {
  console.log(`Kakao plugin source not found at ${PLUGIN_SRC}, skipping.`);
  process.exit(0);
}

// ── 1. Compile the plugin ──────────────────────────────────────────────────
console.log('Compiling kakao plugin…');

// Install dependencies
console.log('Installing dependencies in plugin directory…');
execSync('npm install --no-save', { cwd: PLUGIN_SRC, stdio: 'inherit' });

// Compile
console.log('Running npm run build…');
execSync('npm run build', { cwd: PLUGIN_SRC, stdio: 'inherit' });
console.log('Compiled.');

// Cleanup node_modules to prevent conflicts with OpenClaw's loader
console.log('Cleaning up plugin node_modules…');
if (fs.existsSync(path.join(PLUGIN_SRC, 'node_modules'))) {
  fs.rmSync(path.join(PLUGIN_SRC, 'node_modules'), { recursive: true, force: true });
}

// ── 2. Copy into resources/ ────────────────────────────────────────────────
console.log(`Copying to ${DEST}…`);
if (fs.existsSync(DEST)) fs.rmSync(DEST, { recursive: true });
fs.mkdirSync(DEST, { recursive: true });

// dist/ (compiled output)
copyDir(path.join(PLUGIN_SRC, 'dist'), path.join(DEST, 'dist'));

// package.json + openclaw.plugin.json
for (const f of ['package.json', 'openclaw.plugin.json']) {
  fs.copyFileSync(path.join(PLUGIN_SRC, f), path.join(DEST, f));
}

console.log('Done. resources/openclaw-kakao-plugin/ is ready.');
