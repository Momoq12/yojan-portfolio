const crypto = require('crypto');

const COOKIE_NAME = 'yojan_admin';
const sessionSecret = () => process.env.SESSION_SECRET || '';
const sign = (value) => crypto.createHmac('sha256', sessionSecret()).update(value).digest('hex');

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function createSession() {
  const expires = Date.now() + 1000 * 60 * 60 * 12;
  return `${COOKIE_NAME}=${expires}.${sign(String(expires))}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`;
}

function isAuthenticated(req) {
  if (!sessionSecret()) return false;
  const cookies = Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map((part) => {
    const [key, ...value] = part.trim().split('=');
    return [key, value.join('=')];
  }));
  const [expires, signature] = (cookies[COOKIE_NAME] || '').split('.');
  return Boolean(expires && signature && Number(expires) > Date.now() && safeEqual(signature, sign(expires)));
}

function requireAuth(req, res) {
  if (isAuthenticated(req)) return true;
  res.status(401).json({ error: 'Please sign in to manage projects.' });
  return false;
}

module.exports = { COOKIE_NAME, createSession, isAuthenticated, requireAuth, safeEqual };
