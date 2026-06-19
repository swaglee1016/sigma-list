const API_KEY = 'AIzaSyA75VRzI-eE2mC2rXsY_biUZwye0GbKHPw';
const BASE = 'https://firestore.googleapis.com/v1/projects/sigma-list/databases/(default)/documents/data';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  const url = new URL(req.url, 'https://sigma-list.vercel.app');
  const doc = url.searchParams.get('doc');

  if (!doc || !['tasks', 'notes'].includes(doc)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'doc must be tasks or notes' }));
  }

  try {
    const isWrite = req.method === 'PATCH' || req.method === 'POST';
    const fetchOpts = {
      method: isWrite ? 'PATCH' : 'GET',
      headers: isWrite ? { 'Content-Type': 'application/json' } : undefined,
    };

    if (isWrite) {
      const raw = await new Promise((resolve) => {
        let d = '';
        req.on('data', (c) => { d += c; });
        req.on('end', () => resolve(d));
      });
      fetchOpts.body = raw;
    }

    const upstream = await fetch(`${BASE}/${doc}?key=${API_KEY}`, fetchOpts);
    const data = await upstream.json();

    res.statusCode = upstream.status;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(data));
  } catch (e) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'unreachable', detail: e.message }));
  }
}
