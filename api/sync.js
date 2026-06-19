const PROJECT = 'sigma-list';
const API_KEY = 'AIzaSyA75VRzI-eE2mC2rXsY_biUZwye0GbKHPw';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/data`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { doc } = req.query;
  if (!doc || !['tasks', 'notes'].includes(doc)) {
    return res.status(400).json({ error: 'doc must be tasks or notes' });
  }

  const url = `${FIRESTORE_BASE}/${doc}?key=${API_KEY}`;

  try {
    const fetchOptions = {};
    if (req.method === 'PATCH' || req.method === 'POST') {
      fetchOptions.method = 'PATCH';
      fetchOptions.headers = { 'Content-Type': 'application/json' };
      fetchOptions.body = JSON.stringify(req.body);
    }

    const upstream = await fetch(url, fetchOptions);
    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (e) {
    return res.status(502).json({ error: 'Firestore unreachable', detail: e.message });
  }
}
