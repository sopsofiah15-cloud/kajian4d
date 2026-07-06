const { getSql } = require('../lib/db');

function escapeHtml(str) {
  return (str || '').toString().replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[m]));
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const slug = req.query.slug;

  try {
    const sql = getSql();
    const rows = await sql`SELECT * FROM articles WHERE slug = ${slug} LIMIT 1`;
    const a = rows[0];

    if (!a) {
      res.status(404).send(`<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
        <title>Berita tidak ditemukan - KAJIAN4D</title>
        <link rel="icon" href="https://ik.imagekit.io/ehc8d8fve/icon-kajian4d.png?updatedAt=1781622585259"></head>
        <body style="background:#08090a;color:#e9e7e0;font-family:sans-serif;text-align:center;padding:100px 20px;">
        <h1 style="color:#e8c766;">404</h1><p>Artikel tidak ditemukan.</p>
        <a href="/berita" style="color:#c9a53d;">&larr; Kembali ke daftar berita</a></body></html>`);
      return;
    }

    const tanggal = a.tanggal
      ? new Date(a.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(a.judul)} - KAJIAN4D</title>
<meta name="description" content="${escapeHtml(a.excerpt || '')}">
<meta property="og:title" content="${escapeHtml(a.judul)}">
<meta property="og:description" content="${escapeHtml(a.excerpt || '')}">
${a.thumbnail ? `<meta property="og:image" content="${escapeHtml(a.thumbnail)}">` : ''}
<link rel="canonical" href="https://${req.headers.host}/berita/${escapeHtml(a.slug)}">
<link rel="icon" type="image/png" href="https://ik.imagekit.io/ehc8d8fve/icon-kajian4d.png?updatedAt=1781622585259">
<style>
  *{box-sizing:border-box;}
  body{margin:0;background:#08090a;color:#e9e7e0;font-family:'Segoe UI',Roboto,Arial,sans-serif;line-height:1.75;}
  .wrap{max-width:760px;margin:0 auto;padding:32px 20px 90px;}
  .back{color:#c9a53d;text-decoration:none;font-size:13px;}
  .back:hover{color:#e8c766;}
  h1{font-size:27px;color:#e8c766;margin:18px 0 8px;line-height:1.35;}
  .meta{color:#9a978d;font-size:12px;margin-bottom:18px;display:flex;gap:10px;align-items:center;}
  .pill{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;background:#1c1d20;color:#e8c766;border:1px solid #2a2b2e;}
  img.thumb{width:100%;height:auto;max-height:420px;object-fit:cover;border-radius:12px;margin:16px 0;display:block;}
  .content{font-size:15px;}
  .content img{max-width:100%;height:auto;border-radius:8px;margin:10px 0;}
  .content a{color:#e8c766;}
  footer{margin-top:60px;text-align:center;color:#57554d;font-size:12px;}
</style>
</head>
<body>
<div class="wrap">
  <a class="back" href="/berita">&larr; Semua Berita</a>
  <div class="meta"><span class="pill">${escapeHtml(a.kategori || '')}</span><span>${tanggal}</span></div>
  <h1>${escapeHtml(a.judul)}</h1>
  ${a.thumbnail ? `<img class="thumb" src="${escapeHtml(a.thumbnail)}" alt="${escapeHtml(a.judul)}">` : ''}
  <div class="content">${a.konten || ''}</div>
  <footer>&copy; KAJIAN4D</footer>
</div>
</body>
</html>`;
    res.status(200).send(html);
  } catch (err) {
    res.status(500).send(`<pre style="color:#e9e7e0;background:#08090a;padding:20px;">Terjadi kesalahan server: ${escapeHtml(err.message)}</pre>`);
  }
};
