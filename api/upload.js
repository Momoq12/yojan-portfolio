const { requireAuth } = require('./_auth');
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  if (!requireAuth(req, res)) return;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(503).json({ error: 'Image storage has not been connected yet.' });
  try {
    const { data, type, name } = req.body || {};
    if (!allowedTypes.has(type)) return res.status(400).json({ error: 'Use a JPG, PNG, or WebP image.' });
    const bytes = Buffer.from(String(data || '').replace(/^data:[^;]+;base64,/, ''), 'base64');
    if (!bytes.length || bytes.length > 3 * 1024 * 1024) return res.status(400).json({ error: 'The image must be smaller than 3 MB.' });
    const extension = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
    const safeName = String(name || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'project';
    const { put } = await import('@vercel/blob');
    const blob = await put(`projects/${Date.now()}-${safeName}.${extension}`, bytes, { access: 'public', contentType: type, token: process.env.BLOB_READ_WRITE_TOKEN });
    return res.status(200).json({ url: blob.url });
  } catch (error) {
    console.error('upload error', error);
    return res.status(500).json({ error: 'The image could not be uploaded.' });
  }
};
