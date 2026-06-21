export default async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const doc = url.searchParams.get('doc');
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: true, doc, env: !!process.env.TIDB_PASSWORD }));
};
