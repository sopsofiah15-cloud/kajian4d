const { getSql } = require('../lib/db');
const { checkToken } = require('../lib/auth');

module.exports = async (req, res) => {
  try {
    const sql = getSql();

    if (req.method === 'GET') {
      const { slug } = req.query;
      if (slug) {
        const rows = await sql`SELECT * FROM articles WHERE slug = ${slug} LIMIT 1`;
        if (!rows[0]) return res.status(404).json({ error: 'Artikel tidak ditemukan.' });
        return res.status(200).json(rows[0]);
      }
      const rows = await sql`
        SELECT id, judul, slug, excerpt, kategori, tanggal, thumbnail, konten, updated_at
        FROM articles
        ORDER BY tanggal DESC NULLS LAST, updated_at DESC
      `;
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      if (!checkToken(req)) return res.status(401).json({ error: 'Unauthorized' });
      const { judul, slug, excerpt, kategori, tanggal, thumbnail, konten } = req.body || {};
      if (!judul || !slug) {
        return res.status(400).json({ error: 'Judul dan slug wajib diisi.' });
      }
      await sql`
        INSERT INTO articles (judul, slug, excerpt, kategori, tanggal, thumbnail, konten, updated_at)
        VALUES (${judul}, ${slug}, ${excerpt || ''}, ${kategori || ''}, ${tanggal || null}, ${thumbnail || ''}, ${konten || ''}, now())
        ON CONFLICT (slug) DO UPDATE SET
          judul = EXCLUDED.judul,
          excerpt = EXCLUDED.excerpt,
          kategori = EXCLUDED.kategori,
          tanggal = EXCLUDED.tanggal,
          thumbnail = EXCLUDED.thumbnail,
          konten = EXCLUDED.konten,
          updated_at = now()
      `;
      return res.status(200).json({ ok: true, slug });
    }

    if (req.method === 'DELETE') {
      if (!checkToken(req)) return res.status(401).json({ error: 'Unauthorized' });
      const { slug } = req.query;
      if (!slug) return res.status(400).json({ error: 'Slug wajib diisi.' });
      await sql`DELETE FROM articles WHERE slug = ${slug}`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
