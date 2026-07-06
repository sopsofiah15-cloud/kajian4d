const { getSql } = require('../lib/db');
const { hashPassword } = require('../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { id, password } = req.body || {};

    if (id !== process.env.ADMIN_ID) {
      return res.status(401).json({ error: 'ID atau password salah.' });
    }

    const sql = getSql();
    const rows = await sql`SELECT value FROM settings WHERE key = 'admin_password_hash'`;
    const storedHash =
      rows[0]?.value || hashPassword(process.env.ADMIN_DEFAULT_PASSWORD || '');

    if (hashPassword(password) !== storedHash) {
      return res.status(401).json({ error: 'ID atau password salah.' });
    }

    return res.status(200).json({ ok: true, token: process.env.ADMIN_API_TOKEN });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
