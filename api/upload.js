const { getUser } = require('./_lib/auth');
const { put } = require('@vercel/blob');

const DATA_KEY = 'purchase-data.json';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Allow automated uploads via secret key, bypassing session login
  const uploadKey = req.headers['x-upload-key'];
  const isKeyAuth = uploadKey && process.env.UPLOAD_API_KEY && uploadKey === process.env.UPLOAD_API_KEY;

  let uploadedBy = 'automation';
  if (!isKeyAuth) {
    const user = getUser(req);
    if (!user || user.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    uploadedBy = user.username;
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
    uploadedBy,
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
