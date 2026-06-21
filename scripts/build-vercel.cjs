// Build script: generates Vercel Build Output API v3 structure
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = __dirname + '/..';
const OUTPUT = ROOT + '/.vercel/output';
const STATIC = OUTPUT + '/static';
const FUNC_DIR = OUTPUT + '/functions/api/sync.func';

// 1. Run Vite build
console.log('[1/4] Running vite build...');
execSync('npx vite build', { cwd: ROOT, stdio: 'inherit' });

// 2. Clean and create output directories
console.log('[2/4] Creating .vercel/output...');
fs.rmSync(OUTPUT, { recursive: true, force: true });
fs.mkdirSync(STATIC, { recursive: true });
fs.mkdirSync(FUNC_DIR, { recursive: true });

// 3. Copy static files from dist/
console.log('[3/4] Copying static files...');
copyDir(ROOT + '/dist', STATIC);

// 4. Create serverless function
console.log('[4/4] Creating serverless function...');

// .vc-config.json
fs.writeFileSync(FUNC_DIR + '/.vc-config.json', JSON.stringify({
  runtime: 'nodejs22.x',
  handler: 'index.mjs',
  launcherType: 'Nodejs',
  shouldAddHelpers: true,
  shouldAddSourcemapSupport: false,
}, null, 2));

// index.mjs - ESM function
fs.writeFileSync(FUNC_DIR + '/index.mjs', `
export default async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const url = new URL(req.url, 'http://localhost');
  const doc = url.searchParams.get('doc');

  if (!doc || !['tasks', 'notes'].includes(doc)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'doc must be tasks or notes' }));
  }

  const { createConnection } = await import('mysql2/promise');
  const conn = await createConnection({
    host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
    port: 4000,
    user: '2e3Zv8Kes7yg8Lk.root',
    password: process.env.TIDB_PASSWORD,
    database: 'sigma',
    ssl: { rejectUnauthorized: true },
  });

  try {
    if (req.method === 'GET') {
      const [rows] = await conn.execute('SELECT data FROM sync_data WHERE doc_type = ?', [doc]);
      const raw = rows.length ? rows[0].data : null;
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ data }));
    }

    if (req.method === 'PATCH') {
      const body = await new Promise((resolve) => {
        let d = '';
        req.on('data', (c) => { d += c; });
        req.on('end', () => resolve(d));
      });
      const { data: taskData, updatedAt } = JSON.parse(body);
      await conn.execute(
        \`INSERT INTO sync_data (doc_type, data, updated_at) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = VALUES(updated_at)\`,
        [doc, taskData, updatedAt],
      );
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ ok: true }));
    }

    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'method not allowed' }));
  } finally {
    await conn.end();
  }
};
`.trim() + '\n');

// config.json with routes
fs.writeFileSync(OUTPUT + '/config.json', JSON.stringify({
  version: 3,
  routes: [
    { handle: 'filesystem' },
    { src: '^/(.*)$', dest: '/index.html' },
  ],
}, null, 2));

console.log('Done! .vercel/output ready.');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
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
