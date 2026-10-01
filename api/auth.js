const { COOKIE_NAME, createSession, isAuthenticated, safeEqual } = require('./_auth');

module.exports = async function handler(req, res) {
  if (req.method === 'GET') return res.status(200).json({ authenticated: isAuthenticated(req), configured: Boolean(process.env.ADMIN_PASSWORD && process.env.SESSION_SECRET && process.env.BLOB_READ_WRITE_TOKEN) });
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
    return res.status(200).json({ ok: true });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  if (!process.env.ADMIN_PASSWORD || !process.env.SESSION_SECRET) return res.status(503).json({ error: 'Dashboard access has not been configured yet.' });
  if (!safeEqual(req.body?.password || '', process.env.ADMIN_PASSWORD)) return res.status(401).json({ error: 'Incorrect password.' });
  res.setHeader('Set-Cookie', createSession());
  return res.status(200).json({ ok: true });
};
