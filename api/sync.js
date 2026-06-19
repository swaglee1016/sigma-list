const PROJECT = 'sigma-list';
const API_KEY = 'AIzaSyA75VRzI-eE2mC2rXsY_biUZwye0GbKHPw';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/data`;

function parseQuery(url) {
  const q = {};
  const idx = url.indexOf('?');
  if (idx === -1) return q;
  for (const part of url.slice(idx + 1).split('&')) {
    const [k, v] = part.split('=');
    q[decodeURIComponent(k)] = decodeURIComponent(v || '');
  }
  return q;
}

async function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data)); } catch { resolve(null); }
    });
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  const q = parseQuery(req.url);
  const doc = q.doc;
  if (!doc || !['tasks', 'notes'].includes(doc)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'doc must be tasks or notes' }));
  }

  const url = `${FIRESTORE_BASE}/${doc}?key=${API_KEY}`;

  try {
    const fetchOptions = { method: req.method === 'GET' ? 'GET' : 'PATCH' };
    if (req.method === 'PATCH' || req.method === 'POST') {
      const body = await readBody(req);
      fetchOptions.headers = { 'Content-Type': 'application/json' };
      fetchOptions.body = JSON.stringify(body);
    }

    const upstream = await fetch(url, fetchOptions);
    const data = await upstream.json();
    res.statusCode = upstream.status;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(data));
  } catch (e) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Firestore unreachable', detail: e.message }));
  }
}
