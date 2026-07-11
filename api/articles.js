const { getSql } = require('../lib/db');
const { checkToken } = require('../lib/auth');

// Normalisasi input kategori: terima array, string koma-separated, atau string tunggal
function normalizeKategori(input) {
  if (Array.isArray(input)) {
    return input.map((k) => String(k).trim().toUpperCase()).filter(Boolean);
  }
  if (typeof input === 'string' && input.trim()) {
    return input
      .split(',')
      .map((k) => k.trim().toUpperCase())
      .filter(Boolean);
  }
  return [];
}

module.exports = async (req, res) => {
  try {
    const sql = getSql();

    if (req.method === 'GET') {
      const { slug, kategori, highlight } = req.query;

      // Ambil satu artikel by slug (dipakai halaman detail)
      if (slug) {
        const rows = await sql`SELECT * FROM articles WHERE slug = ${slug} LIMIT 1`;
        if (!rows[0]) return res.status(404).json({ error: 'Artikel tidak ditemukan.' });
        return res.status(200).json(rows[0]);
      }

      // Filter khusus artikel highlight (tab "HIGHLIGHT" di menu)
      if (highlight === '1' || highlight === 'true') {
        const rows = await sql`
          SELECT id, judul, slug, excerpt, kategori, tanggal, thumbnail, konten, is_highlight, views, updated_at
          FROM articles
          WHERE is_highlight = true
          ORDER BY tanggal DESC NULLS LAST, updated_at DESC
        `;
        return res.status(200).json(rows);
      }

      // Filter by kategori spesifik (tab kategori di menu, mis. "SEPAK BOLA")
      if (kategori && kategori.toUpperCase() !== 'SEMUA') {
        const kat = kategori.toUpperCase();
        const rows = await sql`
          SELECT id, judul, slug, excerpt, kategori, tanggal, thumbnail, konten, is_highlight, views, updated_at
          FROM articles
          WHERE ${kat} = ANY(kategori)
          ORDER BY tanggal DESC NULLS LAST, updated_at DESC
        `;
        return res.status(200).json(rows);
      }

      // "SEMUA" atau tanpa filter -> seluruh artikel, campur semua kategori
      const rows = await sql`
        SELECT id, judul, slug, excerpt, kategori, tanggal, thumbnail, konten, is_highlight, views, updated_at
        FROM articles
        ORDER BY tanggal DESC NULLS LAST, updated_at DESC
      `;
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      if (!checkToken(req)) return res.status(401).json({ error: 'Unauthorized' });

      const { judul, slug, excerpt, kategori, tanggal, thumbnail, konten, is_highlight } = req.body || {};
      if (!judul || !slug) {
        return res.status(400).json({ error: 'Judul dan slug wajib diisi.' });
      }

      const kategoriArr = normalizeKategori(kategori);
      const highlightBool = is_highlight === true || is_highlight === 'true' || is_highlight === 1;

      await sql`
        INSERT INTO articles (judul, slug, excerpt, kategori, tanggal, thumbnail, konten, is_highlight, updated_at)
        VALUES (${judul}, ${slug}, ${excerpt || ''}, ${kategoriArr}, ${tanggal || null}, ${thumbnail || ''}, ${konten || ''}, ${highlightBool}, now())
        ON CONFLICT (slug) DO UPDATE SET
          judul = EXCLUDED.judul,
          excerpt = EXCLUDED.excerpt,
          kategori = EXCLUDED.kategori,
          tanggal = EXCLUDED.tanggal,
          thumbnail = EXCLUDED.thumbnail,
          konten = EXCLUDED.konten,
          is_highlight = EXCLUDED.is_highlight,
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
