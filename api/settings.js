const { getSql } = require('../lib/db');
const { checkToken } = require('../lib/auth');

module.exports = async (req, res) => {
  try {
    const sql = getSql();

    if (req.method === 'GET') {
      const rows = await sql`SELECT key, value FROM settings WHERE key IN ('header_image','custom_html')`;
      const out = { header_image: '', custom_html: '' };
      rows.forEach((r) => {
        out[r.key] = r.value || '';
      });
      return res.status(200).json(out);
    }

    if (req.method === 'POST') {
      if (!checkToken(req)) return res.status(401).json({ error: 'Unauthorized' });
      const { header_image, custom_html } = req.body || {};
      await sql`
        INSERT INTO settings (key, value) VALUES ('header_image', ${header_image || ''})
        ON CONFLICT (key) DO UPDATE SET value = ${header_image || ''}
      `;
      await sql`
        INSERT INTO settings (key, value) VALUES ('custom_html', ${custom_html || ''})
        ON CONFLICT (key) DO UPDATE SET value = ${custom_html || ''}
      `;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
