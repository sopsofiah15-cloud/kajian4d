const { getSql } = require('../lib/db');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

async function verifyGoogleToken(idToken) {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!res.ok) throw new Error('Token Google tidak valid.');
  const payload = await res.json();

  if (payload.aud !== GOOGLE_CLIENT_ID) {
    throw new Error('Token bukan untuk aplikasi ini.');
  }
  if (!payload.email || payload.email_verified !== 'true') {
    throw new Error('Email Google belum terverifikasi.');
  }
  return {
    email: payload.email,
    name: payload.name || payload.email.split('@')[0],
    picture: payload.picture || '',
  };
}

module.exports = async (req, res) => {
  try {
    const sql = getSql();

    if (req.method === 'GET') {
      const { slug } = req.query;
      if (!slug) return res.status(400).json({ error: 'Slug wajib diisi.' });

      const rows = await sql`
        SELECT id, user_name, user_photo, content, created_at
        FROM comments
        WHERE article_slug = ${slug}
        ORDER BY created_at DESC
      `;
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const { slug, content, id_token } = req.body || {};

      if (!slug || !content || !id_token) {
        return res.status(400).json({ error: 'Data tidak lengkap.' });
      }
      const trimmed = String(content).trim();
      if (trimmed.length < 2) {
        return res.status(400).json({ error: 'Komentar terlalu pendek.' });
      }
      if (trimmed.length > 1000) {
        return res.status(400).json({ error: 'Komentar terlalu panjang (maks 1000 karakter).' });
      }

      let user;
      try {
        user = await verifyGoogleToken(id_token);
      } catch (e) {
        return res.status(401).json({ error: 'Login Google tidak valid, silakan login ulang.' });
      }

      const rows = await sql`
        INSERT INTO comments (article_slug, user_email, user_name, user_photo, content)
        VALUES (${slug}, ${user.email}, ${user.name}, ${user.picture}, ${trimmed})
        RETURNING id, user_name, user_photo, content, created_at
      `;
      return res.status(200).json(rows[0]);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
