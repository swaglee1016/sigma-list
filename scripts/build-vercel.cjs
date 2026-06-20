// Build script: generates Vercel Build Output API v3 structure
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = __dirname + '/..';
const OUTPUT = ROOT + '/.vercel/output';
const STATIC = OUTPUT + '/static';
const FUNC_DIR = OUTPUT + '/functions/api/sync.func';

// 1. Run Vite build
console.log('[1/5] Running vite build...');
execSync('npx vite build', { cwd: ROOT, stdio: 'inherit' });

// 2. Clean and create directories
console.log('[2/5] Creating output directories...');
fs.rmSync(OUTPUT, { recursive: true, force: true });
fs.mkdirSync(STATIC, { recursive: true });
fs.mkdirSync(FUNC_DIR, { recursive: true });

// 3. Copy static files from dist/
console.log('[3/5] Copying static files...');
copyDir(ROOT + '/dist', STATIC);

// 4. Copy and wrap API function
console.log('[4/5] Setting up serverless function...');

// .vc-config.json
const vcConfig = {
  runtime: 'nodejs22.x',
  handler: 'index.mjs',
  launcherType: 'Nodejs',
  shouldAddHelpers: true,
};
fs.writeFileSync(FUNC_DIR + '/.vc-config.json', JSON.stringify(vcConfig, null, 2));

// index.mjs — Vercel Node.js runtime entry point
// It imports our sync module and calls it
const funcCode = fs.readFileSync(ROOT + '/api/sync.mjs', 'utf8');
fs.writeFileSync(FUNC_DIR + '/index.mjs', funcCode);
console.log('   Function code written');

// 5. Generate config.json
console.log('[5/5] Generating config.json...');
const config = {
  version: 3,
  routes: [
    { src: '/api/(.*)', dest: '/api/$1', check: true },
    { handle: 'filesystem' },
    { src: '/.*', dest: '/index.html' },
  ],
};
fs.writeFileSync(OUTPUT + '/config.json', JSON.stringify(config, null, 2));

console.log('Done! .vercel/output/ is ready.');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
