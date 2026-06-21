const express = require('express');
const serverless = require('serverless-http');
const { createConnection } = require('mysql2/promise');

const app = express();
app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// GET /api/sync?doc=tasks
app.get('/api/sync', async (req, res) => {
  const doc = req.query.doc;
  if (!doc || !['tasks', 'notes'].includes(doc)) {
    return res.status(400).json({ error: 'doc must be tasks or notes' });
  }
  const conn = await createConnection({
    host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
    port: 4000,
    user: '2e3Zv8Kes7yg8Lk.root',
    password: process.env.TIDB_PASSWORD,
    database: 'sigma',
    ssl: { rejectUnauthorized: true },
  });
  try {
    const [rows] = await conn.execute('SELECT data FROM sync_data WHERE doc_type = ?', [doc]);
    const raw = rows.length ? rows[0].data : null;
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    res.json({ data });
  } finally {
    await conn.end();
  }
});

// PATCH /api/sync?doc=tasks
app.patch('/api/sync', async (req, res) => {
  const doc = req.query.doc;
  if (!doc || !['tasks', 'notes'].includes(doc)) {
    return res.status(400).json({ error: 'doc must be tasks or notes' });
  }
  const { data, updatedAt } = req.body;
  const conn = await createConnection({
    host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
    port: 4000,
    user: '2e3Zv8Kes7yg8Lk.root',
    password: process.env.TIDB_PASSWORD,
    database: 'sigma',
    ssl: { rejectUnauthorized: true },
  });
  try {
    await conn.execute(
      'INSERT INTO sync_data (doc_type, data, updated_at) VALUES (?, ?, ?) ' +
      'ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = VALUES(updated_at)',
      [doc, data, updatedAt],
    );
    res.json({ ok: true });
  } finally {
    await conn.end();
  }
});

module.exports = serverless(app);
