const { getUser } = require('./_lib/auth');
const { put } = require('@vercel/blob');

const DATA_KEY = 'purchase-data.json';

function isAuthorized(req) {
  // Option 1: a script/automation sends a secret key header (no browser login needed)
  const apiKey = req.headers['x-upload-key'];
  if (apiKey && process.env.UPLOAD_API_KEY && apiKey === process.env.UPLOAD_API_KEY) {
    return { username: 'automation', role: 'admin' };
  }
  // Option 2: a logged-in admin using the browser (cookie session)
  const user = getUser(req);
  if (user && user.role === 'admin') return user;
  return null;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const user = isAuthorized(req);
  if (!user) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  const body = req.body || {};
  const records = body.records;
  const fileName = body.fileName || 'unknown.xlsx';

  if (!Array.isArray(records) || records.length === 0) {
    res.status(400).json({ error: 'No records received' });
    return;
  }

  const payload = {
    records,
    fileName,
    uploadedAt: new Date().toISOString(),
    uploadedBy: user.username,
  };

  try {
    await put(DATA_KEY, JSON.stringify(payload), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    });
    res.status(200).json({ ok: true, rows: records.length });
  } catch (err) {
    res.status(500).json({ error: 'Upload failed: ' + err.message });
  }
};
