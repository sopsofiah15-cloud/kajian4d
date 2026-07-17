const { getSql } = require('../lib/db');
const { put } = require('@vercel/blob');

// ============ CARA PAKAI ============
// 1. Taruh file ini di folder /api, sejajar dengan articles.js, upload.js, dll
//    Nama filenya: api/migrate-thumbnails.js
//
// 2. Buka Vercel Dashboard -> project kamu -> Settings -> Environment Variables
//    Tambahkan variable baru:
//      Name  : MIGRATION_SECRET
//      Value : (bikin sendiri, bebas, contoh: kajian4d-rahasia-2026)
//    Ini semacam "password" supaya orang lain tidak bisa sembarangan
//    menjalankan endpoint ini.
//
// 3. Commit & push file ini ke GitHub seperti biasa. Tunggu Vercel selesai deploy.
//
// 4. Buka browser, akses URL berikut untuk PREVIEW dulu (belum ada yang berubah):
//    https://kajian4d.vercel.app/api/migrate-thumbnails?secret=ISI_SECRET_KAMU&dryRun=true
//
// 5. Baca hasil JSON yang muncul. Kalau sudah sesuai harapan, jalankan lagi
//    dengan dryRun=false untuk eksekusi BENERAN:
//    https://kajian4d.vercel.app/api/migrate-thumbnails?secret=ISI_SECRET_KAMU&dryRun=false
//
// 6. SETELAH SELESAI DIPAKAI, HAPUS FILE INI dari project (dan push lagi ke GitHub),
//    atau minimal hapus MIGRATION_SECRET dari Vercel. Endpoint ini cukup sensitif
//    karena bisa mengubah data, jadi jangan dibiarkan aktif selamanya.

function isImgurUrl(url) {
  return typeof url === 'string' && /imgur\.com/i.test(url);
}

function guessContentType(url) {
  const ext = url.split('.').pop().toLowerCase().split('?')[0];
  const map = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
  return map[ext] || 'image/jpeg';
}

async function downloadImage(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    },
  });
  if (!res.ok) throw new Error(`Gagal download (status ${res.status})`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

module.exports = async (req, res) => {
  const { secret, dryRun } = req.query;

  // Cek "password" dulu
  if (!process.env.MIGRATION_SECRET || secret !== process.env.MIGRATION_SECRET) {
    return res.status(401).json({ error: 'Secret salah atau belum di-set di Environment Variables.' });
  }

  const isDryRun = dryRun !== 'false'; // default: dry run, kecuali eksplisit "false"

  try {
    const sql = getSql();
    const rows = await sql`
      SELECT id, slug, judul, thumbnail
      FROM articles
      WHERE thumbnail ILIKE '%imgur.com%'
      ORDER BY id
    `;

    const results = [];

    for (const row of rows) {
      const { id, slug, judul, thumbnail } = row;

      if (!isImgurUrl(thumbnail)) continue;

      try {
        const buffer = await downloadImage(thumbnail);
        const filename = thumbnail.split('/').pop().split('?')[0];
        const contentType = guessContentType(thumbnail);

        if (isDryRun) {
          results.push({
            id,
            judul,
            status: 'PREVIEW',
            url_lama: thumbnail,
            ukuran_bytes: buffer.length,
            catatan: 'Belum ada perubahan, ini baru preview.',
          });
          continue;
        }

        const blob = await put(`kajian4d/${slug}-${filename}`, buffer, {
          access: 'public',
          contentType,
        });

        await sql`UPDATE articles SET thumbnail = ${blob.url}, updated_at = now() WHERE id = ${id}`;

        results.push({
          id,
          judul,
          status: 'BERHASIL',
          url_lama: thumbnail,
          url_baru: blob.url,
        });
      } catch (err) {
        results.push({ id, judul, status: 'GAGAL', url_lama: thumbnail, error: err.message });
      }
    }

    return res.status(200).json({
      mode: isDryRun ? 'DRY_RUN (preview, tidak ada perubahan)' : 'EKSEKUSI_NYATA',
      total_ditemukan: rows.length,
      total_diproses: results.length,
      detail: results,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
