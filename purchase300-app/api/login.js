const { sign, sessionCookie } = require('./_lib/auth');

module.exports = (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = req.body || {};
  const username = (body.username || '').trim();
  const password = body.password || '';

  const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  const VIEWER_USERNAME = process.env.VIEWER_USERNAME;
  const VIEWER_PASSWORD = process.env.VIEWER_PASSWORD;

  let role = null;
  if (ADMIN_USERNAME && ADMIN_PASSWORD && username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    role = 'admin';
  } else if (VIEWER_USERNAME && VIEWER_PASSWORD && username === VIEWER_USERNAME && password === VIEWER_PASSWORD) {
    role = 'viewer';
  }

  if (!role) {
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }

  let token;
  try {
    token = sign({ username, role });
  } catch (e) {
    res.status(500).json({ error: 'Server is misconfigured (missing JWT_SECRET).' });
    return;
  }

  res.setHeader('Set-Cookie', sessionCookie(token));
  res.status(200).json({ ok: true, role });
};
