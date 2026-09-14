const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;

function sign(payload) {
  if (!SECRET) throw new Error('JWT_SECRET is not set');
  return jwt.sign(payload, SECRET, { expiresIn: '12h' });
}

function verify(token) {
  if (!SECRET) return null;
  try {
    return jwt.verify(token, SECRET);
  } catch (e) {
    return null;
  }
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

function getUser(req) {
  const cookies = parseCookies(req);
  const token = cookies['session'];
  if (!token) return null;
  return verify(token);
}

const isProd = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';

function sessionCookie(token) {
  const parts = [
    `session=${token}`,
    'HttpOnly',
    'Path=/',
    'Max-Age=43200', // 12 hours
    'SameSite=Lax',
  ];
  if (isProd) parts.push('Secure');
  return parts.join('; ');
}

function clearCookie() {
  const parts = ['session=', 'HttpOnly', 'Path=/', 'Max-Age=0', 'SameSite=Lax'];
  if (isProd) parts.push('Secure');
  return parts.join('; ');
}

module.exports = { sign, verify, parseCookies, getUser, sessionCookie, clearCookie };
