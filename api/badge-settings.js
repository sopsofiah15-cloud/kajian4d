const { getSql } = require('../lib/db');
const { checkToken } = require('../lib/auth');

const SETTINGS_KEY = 'badge_settings';

module.exports = async (req, res) => {
  try {
    const sql = getSql();

    if (req.method === 'GET') {
      const rows = await sql`SELECT value FROM settings WHERE key = ${SETTINGS_KEY}`;
      let badges = {};
      if (rows.length && rows[0].value) {
        try {
          badges = JSON.parse(rows[0].value);
        } catch (e) {
          badges = {};
        }
      }
      return res.status(200).json({ badges });
    }

    if (req.method === 'POST') {
      if (!checkToken(req)) return res.status(401).json({ error: 'Unauthorized' });
      const { badges } = req.body || {};
      if (!badges || typeof badges !== 'object') {
        return res.status(400).json({ error: 'Data badge tidak valid' });
      }
      const value = JSON.stringify(badges);
      await sql`
        INSERT INTO settings (key, value) VALUES (${SETTINGS_KEY}, ${value})
        ON CONFLICT (key) DO UPDATE SET value = ${value}
      `;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
