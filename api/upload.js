const { put } = require('@vercel/blob');
const { checkToken } = require('../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!checkToken(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const { filename, dataBase64, contentType } = req.body || {};
    if (!filename || !dataBase64) {
      return res.status(400).json({ error: 'File tidak lengkap.' });
    }
    const buffer = Buffer.from(dataBase64, 'base64');
    const safeName = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const blob = await put(`kajian4d/${Date.now()}-${safeName}`, buffer, {
      access: 'public',
      contentType: contentType || 'application/octet-stream',
    });
    return res.status(200).json({ url: blob.url });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
