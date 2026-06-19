const API_KEY = 'AIzaSyA75VRzI-eE2mC2rXsY_biUZwye0GbKHPw';
const BASE = 'https://firestore.googleapis.com/v1/projects/sigma-list/databases/(default)/documents/data';

// Vercel Edge Function — runs at the edge, no Node.js runtime needed.
// Uses standard Web API (Request/Response).

export const config = { runtime: 'edge' };

export default async function handler(request) {
  const url = new URL(request.url);
  const doc = url.searchParams.get('doc');

  if (!doc || !['tasks', 'notes'].includes(doc)) {
    return new Response(JSON.stringify({ error: 'doc must be tasks or notes' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  const upstreamUrl = `${BASE}/${doc}?key=${API_KEY}`;

  try {
    const fetchOptions = { method: request.method === 'GET' ? 'GET' : 'PATCH' };
    if (request.method === 'PATCH' || request.method === 'POST') {
      fetchOptions.headers = { 'Content-Type': 'application/json' };
      fetchOptions.body = await request.text();
    }

    const upstream = await fetch(upstreamUrl, fetchOptions);
    const data = await upstream.json();

    return new Response(JSON.stringify(data), {
      status: upstream.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Firestore unreachable', detail: e.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
