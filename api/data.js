const { getUser } = require('./_lib/auth');
const { list } = require('@vercel/blob');

const DATA_KEY = 'purchase-data.json';

module.exports = async (req, res) => {
  const user = getUser(req);
  if (!user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  try {
    const { blobs } = await list({ prefix: DATA_KEY });
    if (!blobs.length) {
      res.status(200).json({ records: [], fileName: null, uploadedAt: null });
      return;
    }
    const blob = blobs[0];
    const response = await fetch(blob.url, { cache: 'no-store' });
    const json = await response.json();
    res.status(200).json(json);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load data: ' + err.message });
  }
};
