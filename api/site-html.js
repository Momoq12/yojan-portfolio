const { requireAuth } = require('./_auth');
const DATA_PATH = 'portfolio-data/site-html.json';
const blobApi = () => import('@vercel/blob');

async function findBlob() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  const { list } = await blobApi();
  const result = await list({ prefix: DATA_PATH, limit: 1, token: process.env.BLOB_READ_WRITE_TOKEN });
  return result.blobs.find((item) => item.pathname === DATA_PATH) || null;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const blob = await findBlob();
      if (!blob) return res.status(200).json({ html: null, updatedAt: null });
      const response = await fetch(`${blob.url}?v=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return res.status(200).json({ html: null, updatedAt: null });
      return res.status(200).json(await response.json());
    }
    if (!requireAuth(req, res)) return;
    if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(503).json({ error: 'Site storage has not been connected yet.' });
    if (req.method === 'PUT') {
      const html = String(req.body?.html || '').trim();
      if (!html) return res.status(400).json({ error: 'HTML cannot be empty.' });
      if (Buffer.byteLength(html, 'utf8') > 250 * 1024) return res.status(400).json({ error: 'HTML must be smaller than 250 KB.' });
      if (!/<section[\s>]/i.test(html)) return res.status(400).json({ error: 'Keep at least one <section> in the page HTML.' });
      const updatedAt = new Date().toISOString();
      const { put } = await blobApi();
      await put(DATA_PATH, JSON.stringify({ html, updatedAt }), {
        access: 'public', addRandomSuffix: false, allowOverwrite: true,
        contentType: 'application/json', token: process.env.BLOB_READ_WRITE_TOKEN
      });
      return res.status(200).json({ ok: true, updatedAt });
    }
    if (req.method === 'DELETE') {
      const blob = await findBlob();
      if (blob) {
        const { del } = await blobApi();
        await del(blob.url, { token: process.env.BLOB_READ_WRITE_TOKEN });
      }
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    console.error('site html error', error);
    return res.status(500).json({ error: 'The site HTML could not be updated.' });
  }
};
