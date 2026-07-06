const { getSql } = require('../lib/db');
const { hashPassword } = require('../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { code, newPassword } = req.body || {};

    if (code !== process.env.ADMIN_RESET_CODE) {
      return res.status(401).json({ error: 'Kode reset salah. Hanya admin yang memiliki kode ini.' });
    }
    if (!newPassword || String(newPassword).length < 4) {
      return res.status(400).json({ error: 'Password baru minimal 4 karakter.' });
    }

    const sql = getSql();
    const hash = hashPassword(newPassword);
    await sql`
      INSERT INTO settings (key, value) VALUES ('admin_password_hash', ${hash})
      ON CONFLICT (key) DO UPDATE SET value = ${hash}
    `;

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
