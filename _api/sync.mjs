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
        'INSERT INTO sync_data (doc_type, data, updated_at) VALUES (?, ?, ?) ' +
        'ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = VALUES(updated_at)',
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
