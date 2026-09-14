const { getUser } = require('./_lib/auth');

module.exports = (req, res) => {
  const user = getUser(req);
  if (!user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  res.status(200).json({ username: user.username, role: user.role });
};
