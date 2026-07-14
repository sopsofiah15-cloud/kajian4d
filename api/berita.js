const { getSql } = require('../lib/db');

const CATEGORIES = ['SEMUA', 'SEPAK BOLA', 'TEKNOLOGI', 'OLAHRAGA', 'HIBURAN', 'BISNIS', 'GAYA HIDUP', 'HIGHLIGHT'];
const BACA_JUGA_LIMIT = 6;

function escapeHtml(str) {
  return (str || '').toString().replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[m]));
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Kategori bisa tersimpan sebagai array (TEXT[]) ATAU string biasa (mis. "SEPAK BOLA" atau "SEPAK BOLA,HIGHLIGHT").
// Fungsi ini menormalkan keduanya jadi array, supaya tidak error apapun tipe kolomnya di database.
function katList(a) {
  if (Array.isArray(a.kategori)) return a.kategori.filter(Boolean).map((k) => String(k).toUpperCase());
  if (typeof a.kategori === 'string' && a.kategori.trim()) {
    return a.kategori.split(',').map((k) => k.trim().toUpperCase()).filter(Boolean);
  }
  return [];
}
function primaryKat(a) {
  const k = katList(a);
  return k.length ? k[0] : 'BERITA';
}

async function getSettings(sql) {
  try {
    const rows = await sql`SELECT key, value FROM settings`;
    const obj = {};
    rows.forEach((r) => { obj[r.key] = r.value; });
    return obj;
  } catch (e) {
    return {};
  }
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
        <link rel="icon" href="https://ik.imagekit.io/ehc8d8fve/kajian%20icon%20v5?updatedAt=1783465068596"></head>
        <body style="background:#0b0d10;color:#e7ebf0;font-family:sans-serif;text-align:center;padding:100px 20px;">
        <h1 style="color:#5fb3ff;">404</h1><p>Artikel tidak ditemukan.</p>
        <a href="/berita" style="color:#3a8fd9;">&larr; Kembali ke daftar berita</a></body></html>`);
      return;
    }
// Increment view count — real, bertambah setiap kali halaman ini di-request server
const viewResult = await sql`
  UPDATE articles SET views = views + 1 WHERE slug = ${slug} RETURNING views
`;
a.views = viewResult[0]?.views ?? 0;
    const settings = await getSettings(sql);

    // Ambil kandidat "Baca Juga": artikel lain, urutkan terbaru, lalu filter kategori di JS (aman utk tipe kolom apapun)
    const kat = primaryKat(a);
    let related = [];
    try {
      const candidates = await sql`
        SELECT judul, slug, kategori, tanggal, thumbnail
        FROM articles
        WHERE slug != ${slug}
        ORDER BY tanggal DESC NULLS LAST, updated_at DESC
        LIMIT 60
      `;
      related = candidates.filter((r) => katList(r).includes(kat)).slice(0, BACA_JUGA_LIMIT);
    } catch (e) { /* biarkan kosong kalau gagal, jangan sampai halaman detail ikut error */ }

    const tanggal = fmtDate(a.tanggal);
    const kategoriPillsHead = `<span class="badge">${escapeHtml(kat)}</span>`;

    const categoryTabs = CATEGORIES.filter((c) => c !== 'HIGHLIGHT')
      .map((c) => `<li><a href="/berita?kategori=${encodeURIComponent(c)}">${escapeHtml(c)}</a></li>`).join('');
    const footerChips = CATEGORIES.filter((c) => c !== 'SEMUA' && c !== 'HIGHLIGHT')
      .map((c) => `<a class="ftr2-chip" href="/berita?kategori=${encodeURIComponent(c)}">${escapeHtml(c)}</a>`).join('');

    const bannerImgTag = settings.header_image
      ? `<img class="banner-img" src="${escapeHtml(settings.header_image)}" alt="Banner promosi">`
      : '';
    const bannerFallback = settings.header_image ? '' : `<span class="banner-fallback-text">Cek Berita &amp; Skor Real-Time</span>`;
    const bannerHref = settings.banner_link ? escapeHtml(settings.banner_link) : '#';

    const bacaJugaHtml = related.length
      ? related.map((r) => `
        <a href="/berita/${escapeHtml(r.slug)}" class="bj-item">
          <div class="bj-thumb"><img src="${escapeHtml(r.thumbnail || '')}" alt=""></div>
          <div class="bj-body">
            <span class="badge" style="font-size:9px;padding:3px 8px;">${escapeHtml(primaryKat(r))}</span>
            <h4>${escapeHtml(r.judul)}</h4>
            <div class="bj-meta"><span>${fmtDate(r.tanggal)}</span></div>
          </div>
        </a>`).join('')
      : `<div class="bj-empty">Belum ada berita lain di kategori ini.</div>`;

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
<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'NewsArticle',
  headline: a.judul,
  description: a.excerpt || '',
  image: a.thumbnail ? [a.thumbnail] : [],
  datePublished: a.tanggal ? new Date(a.tanggal).toISOString() : new Date().toISOString(),
  dateModified: a.updated_at ? new Date(a.updated_at).toISOString() : new Date().toISOString(),
  author: { '@type': 'Organization', name: 'KAJIAN4D' },
  publisher: {
    '@type': 'Organization',
    name: 'KAJIAN4D',
    logo: {
      '@type': 'ImageObject',
      url: 'https://ik.imagekit.io/ehc8d8fve/kajian%20icon%20v5?updatedAt=1783465068596',
    },
  },
})}</script>
<link rel="icon" type="image/png" href="https://ik.imagekit.io/ehc8d8fve/kajian%20icon%20v5?updatedAt=1783465068596">
<script src="https://accounts.google.com/gsi/client" async defer></script>
<style>
  :root{
    --bg-carbon:#0b0d10; --bg-carbon-2:#14171b; --line-diag: rgba(255,255,255,0.025);
    --card-bg:#15181d; --card-border:rgba(58,143,217,0.18);
    --text-main:#e7ebf0; --text-dim:#8b96a3; --text-faint:#5b6572;
    --blue-navy:#0d2a4a; --blue-deep:#123a63; --blue-accent:#3a8fd9; --blue-bright:#5fb3ff;
    --font-display:'Georgia','Times New Roman',serif;
    --font-body:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  }
  *{box-sizing:border-box;margin:0;padding:0;}
  html{-webkit-text-size-adjust:100%;overflow-x:clip;}
  body{
    background-color:var(--bg-carbon);
    background-image:
      repeating-linear-gradient(135deg, var(--line-diag) 0px, var(--line-diag) 1px, transparent 1px, transparent 26px),
      radial-gradient(ellipse at top, #171b20 0%, #0b0d10 60%);
    color:var(--text-main); font-family:var(--font-body); line-height:1.6; min-height:100vh; overflow-x:clip;
  }
  a{color:inherit;text-decoration:none;}
  img{max-width:100%;display:block;}
  .wrap{max-width:1000px;margin:0 auto;padding:0 20px;width:100%;}

  header.site{border-bottom:1px solid rgba(58,143,217,0.15); background:linear-gradient(180deg, rgba(18,58,99,0.15), transparent);}
  .header-top{max-width:1240px;margin:0 auto;padding:20px 20px 16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:nowrap;gap:16px;}
  .brand{display:flex;align-items:center;gap:14px;flex:0 1 auto;min-width:0;}
  .brand-logo{width:54px;height:54px;border-radius:12px;background:linear-gradient(135deg, var(--blue-deep), var(--bg-carbon-2));border:1px solid var(--card-border);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;box-shadow:0 4px 12px rgba(58,143,217,0.15);}
  .brand-logo img{width:100%;height:100%;object-fit:contain;}
  .brand-name{display:flex;align-items:baseline;gap:6px;font-family:var(--font-display);flex-wrap:wrap;}
  .brand-name .txt-kajian, .brand-name .txt-news{font-size:22px;font-weight:700;letter-spacing:0.3px;}
  .brand-name .txt-news{color:var(--blue-accent);}
  .brand-name .badge-4d{display:inline-flex;align-items:baseline;gap:1px;}
  .brand-name .badge-4d .num4{font-size:26px;font-weight:800;color:var(--blue-accent);line-height:1;}
  .brand-name .badge-4d .letd{font-size:16px;font-weight:700;color:var(--blue-accent);}
  .brand-tagline{font-size:10.5px;color:var(--text-faint);letter-spacing:0.6px;margin-top:2px;}

  .header-banner{position:relative;overflow:hidden;flex:1 1 260px;min-width:0;max-width:700px;width:100%;height:60px;min-height:56px;border-radius:10px;display:flex;align-items:center;justify-content:center;padding:0 18px;border:1px solid var(--card-border);background:linear-gradient(135deg, var(--blue-navy) 0%, #0f2d4d 50%, var(--bg-carbon-2) 100%);box-shadow:0 4px 16px rgba(13,42,74,0.3);text-decoration:none;cursor:pointer;}
  .header-banner img.banner-img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:1;pointer-events:none;}
  .header-banner .banner-fallback-text{position:relative;z-index:2;pointer-events:none;font-size:13px;font-weight:500;color:var(--blue-bright);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center;}

  nav.categories{padding:14px 0;background:rgba(13,42,74,0.08);border-bottom:1px solid rgba(58,143,217,0.1);}
  nav.categories .wrap{max-width:1240px;}
  nav.categories ul{display:flex;flex-wrap:nowrap;gap:8px;list-style:none;align-items:center;overflow-x:auto;scrollbar-width:none;}
  nav.categories ul::-webkit-scrollbar{display:none;}
  nav.categories li{flex-shrink:0;}
  nav.categories a{white-space:nowrap;display:inline-block;font-size:12px;font-weight:600;color:var(--text-dim);background:var(--card-bg);border:1px solid var(--card-border);padding:7px 14px;border-radius:999px;cursor:pointer;transition:all .2s;}
  nav.categories a:hover{border-color:var(--blue-accent);color:var(--blue-bright);}

  @media(max-width:700px){
    .brand-logo{width:42px;height:42px;border-radius:9px;}
    .brand-name .txt-kajian, .brand-name .txt-news{font-size:15px;}
    .brand-name .badge-4d .num4{font-size:17px;}
    .brand-name .badge-4d .letd{font-size:11px;}
    .brand-tagline{display:none;}
    .header-banner{height:48px;min-height:44px;padding:0 10px;}
    .header-banner .banner-fallback-text{font-size:11px;}
  }

  .breadcrumb{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12.5px;color:var(--text-faint);margin:26px 0 20px;}
  .breadcrumb a{color:var(--text-dim);}
  .breadcrumb a:hover{color:var(--blue-bright);}
  .breadcrumb .sep{color:var(--text-faint);}
  .breadcrumb .current{color:var(--blue-bright);}

  .badge{background:var(--blue-accent);color:#fff;font-size:10px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;padding:5px 11px;border-radius:4px;display:inline-block;}
  .article-title{font-family:var(--font-display);font-size:30px;line-height:1.3;margin:14px 0 14px;color:var(--text-main);}
  @media(max-width:640px){.article-title{font-size:22px;}}
  .article-meta{display:flex;align-items:center;gap:16px;font-size:12.5px;color:var(--text-dim);flex-wrap:wrap;}

  .article-cover{width:100%;max-width:800px;border-radius:12px;overflow:hidden;margin:22px auto 28px;border:1px solid var(--card-border);background:var(--card-bg);}
.article-cover img{width:100%;height:auto;display:block;}

  .article-body{font-size:15.5px;color:#c9d2db;}
  .article-body p{margin-bottom:18px;}

  .share-row{display:flex;align-items:center;gap:10px;margin:30px 0 46px;padding-top:24px;border-top:1px solid rgba(255,255,255,0.06);flex-wrap:wrap;}
  .share-row span.lbl{font-size:12px;color:var(--text-faint);letter-spacing:0.5px;text-transform:uppercase;margin-right:6px;}
  .share-btn{font-size:12.5px;font-weight:600;color:var(--text-dim);background:var(--card-bg);border:1px solid var(--card-border);padding:8px 16px;border-radius:999px;cursor:pointer;transition:all .2s;}
  .share-btn:hover{border-color:var(--blue-accent);color:var(--blue-bright);}

  .section-label{display:flex;align-items:center;gap:10px;margin-bottom:18px;flex-wrap:wrap;}
  .section-label .tag{background:var(--blue-accent);color:#fff;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:5px 10px;border-radius:4px;}
  .section-label h2{font-family:var(--font-display);font-size:19px;color:var(--text-main);font-weight:400;}
  .section-label .kat-name{color:var(--blue-bright);}
  /* === LOGO BRAND DI SETIAP SECTION === */
.section-logo{
  height:1.7em; max-height:30px; width:auto; max-width:110px;
  object-fit:contain; margin-left:auto; flex-shrink:0;
  background:#fff; border-radius:5px; padding:3px 8px;
}
@media(max-width:480px){ .section-logo{ max-width:70px; max-height:22px; } }

  .bacajuga-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:56px;}
  @media(max-width:760px){.bacajuga-grid{grid-template-columns:repeat(2,1fr);}}
  @media(max-width:480px){.bacajuga-grid{grid-template-columns:1fr;}}
  .bj-item{background:var(--card-bg);border:1px solid var(--card-border);border-radius:10px;overflow:hidden;transition:border-color .2s, transform .2s;}
  .bj-item:hover{border-color:var(--blue-accent);transform:translateY(-3px);}
  .bj-thumb{width:100%;height:130px;overflow:hidden;background:var(--bg-carbon-2);}
  .bj-thumb img{width:100%;height:100%;object-fit:cover;}
  .bj-body{padding:12px 14px 16px;}
  .bj-body h4{font-size:13.5px;font-weight:600;line-height:1.35;margin:8px 0 8px;color:var(--text-main);}
  .bj-meta{display:flex;align-items:center;gap:10px;font-size:11px;color:var(--text-dim);flex-wrap:wrap;}
  .bj-empty{grid-column:1/-1;padding:30px 20px;text-align:center;color:var(--text-faint);font-size:13px;background:var(--card-bg);border:1px solid var(--card-border);border-radius:10px;}

  /* ====== SECTION BARU: SEMUA BERITA (LINTAS KATEGORI) ====== */
  .db-tabs{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px;}
  .db-tabs button{white-space:nowrap;font-family:inherit;font-size:12px;font-weight:600;color:var(--text-dim);background:var(--card-bg);border:1px solid var(--card-border);padding:7px 14px;border-radius:999px;cursor:pointer;transition:all .2s;}
  .db-tabs button:hover{border-color:var(--blue-accent);color:var(--blue-bright);}
  .db-tabs button.active{background:var(--blue-accent);color:#fff;border-color:var(--blue-accent);}

  .all-news-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:22px;}
@media(max-width:760px){.all-news-grid{grid-template-columns:repeat(2,1fr);}}
@media(max-width:480px){.all-news-grid{grid-template-columns:1fr;}}
.an-item{display:block;background:var(--card-bg);border:1px solid var(--card-border);border-radius:10px;overflow:hidden;transition:border-color .2s, transform .2s;}
.an-item:hover{border-color:var(--blue-accent);transform:translateY(-3px);}
.an-thumb{width:100%;height:130px;overflow:hidden;background:var(--bg-carbon-2);}
.an-thumb img{width:100%;height:100%;object-fit:cover;}
.an-body{padding:12px 14px 16px;}
.an-body h4{font-size:13.5px;font-weight:600;line-height:1.35;margin:8px 0 8px;color:var(--text-main);}
.an-meta{display:flex;align-items:center;gap:10px;font-size:11px;color:var(--text-dim);flex-wrap:wrap;}

  .pagination-bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;padding:6px 0 4px;}
  .pg-btn{font-family:inherit;font-size:12.5px;font-weight:600;color:var(--text-dim);background:var(--card-bg);border:1px solid var(--card-border);padding:8px 14px;border-radius:6px;cursor:pointer;transition:all .2s;}
  .pg-btn:hover:not(:disabled){border-color:var(--blue-accent);color:var(--blue-bright);}
  .pg-btn.active{background:var(--blue-accent);color:#fff;border-color:var(--blue-accent);}
  .pg-btn:disabled{opacity:.4;cursor:not-allowed;}
  .pg-num{min-width:38px;text-align:center;}

  footer.site.ftr2{position:relative;overflow:hidden;margin-top:20px;border-top:1px solid rgba(58,143,217,0.25);
    background:radial-gradient(circle at 15% 0%, rgba(58,143,217,0.14), transparent 45%),radial-gradient(circle at 85% 30%, rgba(95,179,255,0.10), transparent 50%),linear-gradient(180deg, rgba(13,42,74,0.35), var(--bg-carbon-2) 40%, var(--bg-carbon) 100%);}
  .ftr2-notice{max-width:860px;margin:0 auto;padding:30px 20px 26px;font-size:13px;color:var(--text-dim);text-align:center;line-height:1.7;border-bottom:1px solid rgba(255,255,255,0.06);}
  .ftr2-notice b{color:var(--blue-bright);}
  .ftr2-grid{max-width:1080px;margin:0 auto;padding:40px 20px 30px;display:grid;grid-template-columns:1.2fr 1.4fr 1fr;gap:40px;}
  @media(max-width:800px){.ftr2-grid{grid-template-columns:1fr;gap:32px;text-align:center;}}
  .ftr2-col h4{display:flex;align-items:center;gap:8px;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:var(--blue-bright);margin-bottom:18px;font-weight:700;}
  @media(max-width:800px){.ftr2-col h4{justify-content:center;}}
  .ftr2-ico{width:22px;height:22px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;background:rgba(58,143,217,0.15);border:1px solid rgba(58,143,217,0.3);font-size:12px;flex-shrink:0;}
  .ftr2-brand-row{display:flex;align-items:center;gap:12px;margin-bottom:14px;}
  @media(max-width:800px){.ftr2-brand-row{justify-content:center;}}
  .ftr2-brand-logo{width:46px;height:46px;border-radius:11px;overflow:hidden;flex-shrink:0;background:linear-gradient(135deg, var(--blue-deep), var(--bg-carbon-2));border:1px solid var(--card-border);display:flex;align-items:center;justify-content:center;}
  .ftr2-brand-logo img{width:100%;height:100%;object-fit:contain;}
  .ftr2-brand-name{font-family:var(--font-display);font-size:19px;font-weight:700;color:var(--text-main);}
  .ftr2-brand-name span{color:var(--blue-accent);}
  .ftr2-col p{font-size:13px;color:var(--text-dim);line-height:1.7;}
  .ftr2-chips{display:flex;flex-wrap:wrap;gap:9px;}
  @media(max-width:800px){.ftr2-chips{justify-content:center;}}
  .ftr2-chip{font-family:inherit;font-size:12px;font-weight:600;color:var(--text-dim);background:var(--card-bg);border:1px solid var(--card-border);padding:8px 14px;border-radius:999px;cursor:pointer;transition:all .2s;}
  .ftr2-chip:hover{border-color:var(--blue-accent);color:var(--blue-bright);transform:translateY(-2px);box-shadow:0 4px 12px rgba(58,143,217,0.2);}
  .ftr2-contact{list-style:none;display:flex;flex-direction:column;gap:10px;}
  .ftr2-contact li{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--text-dim);background:var(--card-bg);border:1px solid var(--card-border);border-radius:8px;padding:10px 14px;transition:all .2s;cursor:pointer;}
  @media(max-width:800px){.ftr2-contact li{justify-content:center;}}
  .ftr2-contact li:hover{border-color:var(--blue-accent);color:var(--blue-bright);}
  .ftr2-dot{width:7px;height:7px;border-radius:50%;background:var(--blue-accent);flex-shrink:0;box-shadow:0 0 8px rgba(58,143,217,0.7);}
  .ftr2-divider{max-width:1080px;margin:0 auto;height:1px;background:linear-gradient(90deg, transparent, rgba(58,143,217,0.35), transparent);}
  .ftr2-bottom{max-width:1080px;margin:0 auto;padding:28px 20px 34px;display:flex;align-items:center;justify-content:center;gap:20px;position:relative;}
  .ftr2-bottom-inner{text-align:center;}
  .ftr2-brand-big{font-family:var(--font-display);font-size:26px;letter-spacing:2px;font-weight:700;background:linear-gradient(90deg, var(--text-main), var(--blue-bright));-webkit-background-clip:text;background-clip:text;color:transparent;}
  .ftr2-brand-big span{color:var(--blue-accent);-webkit-text-fill-color:var(--blue-accent);}
  .ftr2-tagline{font-size:11.5px;color:var(--text-faint);margin:6px 0 14px;letter-spacing:0.5px;}
  .ftr2-copy{font-size:11px;color:var(--text-faint);margin-bottom:16px;}
  .ftr2-badges{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;}
  .ftr2-badges span{font-size:11px;padding:7px 14px;border:1px solid var(--card-border);border-radius:20px;color:var(--text-dim);background:rgba(255,255,255,0.02);}
  .ftr2-top-btn{position:absolute;right:20px;top:50%;transform:translateY(-50%);width:40px;height:40px;border-radius:50%;border:1px solid var(--card-border);background:var(--card-bg);color:var(--blue-bright);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;text-decoration:none;}
  .ftr2-top-btn:hover{background:var(--blue-accent);color:#fff;border-color:var(--blue-accent);}
  @media(max-width:700px){.ftr2-top-btn{display:none;}}
  /* ===== CARBON TEXTURE (untuk background section & sidebar) ===== */
.carbon-texture{
  position:relative; overflow:hidden; background-color: var(--bg-carbon);
  background-image:
    linear-gradient(115deg, transparent 0%, transparent 38%, rgba(95,179,255,0.10) 46%, rgba(180,220,255,0.16) 50%, rgba(95,179,255,0.10) 54%, transparent 62%, transparent 100%),
    repeating-linear-gradient(45deg, rgba(255,255,255,0.045) 0px, rgba(255,255,255,0.045) 2px, rgba(0,0,0,0.35) 2px, rgba(0,0,0,0.35) 4px, rgba(255,255,255,0.02) 4px, rgba(255,255,255,0.02) 6px, rgba(0,0,0,0.3) 6px, rgba(0,0,0,0.3) 8px),
    repeating-linear-gradient(-45deg, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px, rgba(255,255,255,0.015) 4px, rgba(255,255,255,0.015) 6px, rgba(0,0,0,0.28) 6px, rgba(0,0,0,0.28) 8px),
    radial-gradient(circle at 15% 0%, rgba(58,143,217,0.18), transparent 45%),
    radial-gradient(circle at 85% 30%, rgba(95,179,255,0.13), transparent 50%),
    linear-gradient(180deg, rgba(13,42,74,0.45), var(--bg-carbon-2) 40%, var(--bg-carbon) 100%);
  background-size: 220% 220%, 8px 8px, 8px 8px, auto, auto, auto;
  background-position: 0% 0%, 0 0, 0 0, center, center, center;
  animation: ftrCarbonShine 9s ease-in-out infinite;
}
@keyframes ftrCarbonShine{
  0%{ background-position: -40% -20%, 0 0, 0 0, center, center, center; }
  50%{ background-position: 140% 60%, 0 0, 0 0, center, center, center; }
  100%{ background-position: -40% -20%, 0 0, 0 0, center, center, center; }
}
.carbon-texture::before{
  content:''; position:absolute; inset:0; pointer-events:none; z-index:0;
  background: radial-gradient(ellipse at center, transparent 40%, rgba(11,13,16,0.55) 100%);
}
.carbon-texture > *{ position:relative; z-index:1; }

/* ===== TOP TICKER BAR ===== */
.top-ticker-bar{ background: rgba(13,42,74,0.35); border-bottom:1px solid rgba(58,143,217,0.15); overflow:hidden; }
.top-ticker-bar .running-text-box{ height:26px; min-height:26px; border:none; border-radius:0; background:transparent; box-shadow:none; width:100%; }
.top-ticker-bar .running-text-track{ font-size:11px; }
.running-text-box{ overflow:hidden; position:relative; display:flex; align-items:center; }
.running-text-track{ display:flex; flex-shrink:0; white-space:nowrap; font-size:12.5px; font-weight:600; color:var(--blue-bright); letter-spacing:0.3px; animation: runningTextMove 30s linear infinite; }
.running-text-track span{ padding-right:50px; }
@keyframes runningTextMove{ 0%{ transform:translateX(0%); } 100%{ transform:translateX(-50%); } }

/* ===== HOT NEWS BAR ===== */
.hotnews-bar{ display:flex; align-items:center; background: linear-gradient(90deg, rgba(58,143,217,0.18), rgba(13,42,74,0.22)); border-top:1px solid rgba(58,143,217,0.2); border-bottom:1px solid rgba(58,143,217,0.2); overflow:hidden; }
.hotnews-label{ flex-shrink:0; display:flex; align-items:center; gap:6px; background:var(--blue-accent); color:#fff; font-size:11px; font-weight:800; letter-spacing:0.8px; text-transform:uppercase; padding:0 16px; height:36px; white-space:nowrap; }
.hotnews-track-wrap{ flex:1; min-width:0; overflow:hidden; height:36px; display:flex; align-items:center; }
.hotnews-track{ display:flex; flex-shrink:0; white-space:nowrap; font-size:12.5px; font-weight:600; color:var(--text-main); animation: runningTextMove 32s linear infinite; }
.hotnews-track span{ padding-right:50px; }
.hotnews-track a{ color:inherit; text-decoration:none; }
.hotnews-track a:hover{ color:var(--blue-bright); }
@media(max-width:640px){
  .hotnews-label{ font-size:10px; padding:0 10px; }
  .hotnews-track{ font-size:11.5px; }
  .top-ticker-bar .running-text-track{ font-size:10px; }
}

/* ===== STICKY HEADER WRAPPER ===== */
.sticky-top-wrap{ position:sticky; top:0; z-index:100; background:var(--bg-carbon); }

/* ===== LAYOUT 2 KOLOM + SIDEBAR ===== */
.layout{ display:grid; grid-template-columns: 1fr 300px; gap:32px; padding:30px 0 20px; align-items:start; }
@media(max-width:900px){ .layout{ grid-template-columns:1fr; } }

aside.sidebar{
  border:1px solid var(--card-border); border-radius:12px; padding:20px;
  position:sticky; top:calc(var(--sticky-header-h, 0px) + 20px);
  max-height:calc(100vh - var(--sticky-header-h, 0px) - 40px);
  overflow-y:auto;
}
aside.sidebar::-webkit-scrollbar{ width:5px; }
aside.sidebar::-webkit-scrollbar-thumb{ background:var(--card-border); border-radius:10px; }
.sidebar-title{
  font-size:12px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:var(--blue-bright);
  margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid rgba(58,143,217,0.2);
}
.accordion-item{ border-bottom:1px solid rgba(255,255,255,0.06); }
.accordion-item:last-child{ border-bottom:none; }
.accordion-head{
  width:100%; background:none; border:none; color:var(--text-main); cursor:pointer;
  display:flex; align-items:center; justify-content:space-between; padding:13px 2px;
  font-size:13.5px; font-weight:600; text-align:left; font-family:inherit;
}
.accordion-head .count{ color:var(--text-faint); font-weight:400; font-size:12px; }
.accordion-head .chevron{ transition:transform .2s; color:var(--blue-accent); font-size:11px; }
.accordion-item.open .chevron{ transform:rotate(180deg); }
.accordion-body{ max-height:0; overflow:hidden; transition:max-height .25s ease; }
.accordion-item.open .accordion-body{ max-height:600px; }
.arch-item{ display:flex; gap:10px; padding:10px 2px; align-items:flex-start; }
.arch-thumb{ width:56px; aspect-ratio:4/3; height:auto; border-radius:5px; overflow:hidden; flex-shrink:0; border:1px solid var(--card-border); background:var(--bg-carbon-2); }
.arch-thumb img{ width:100%; height:100%; object-fit:cover; }
.arch-item-body{ min-width:0; flex:1; }
.arch-item h5{
  font-size:12.5px; font-weight:500; line-height:1.32; color:var(--text-dim);
  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; margin-bottom:4px;
}
.arch-item:hover h5{ color:var(--blue-bright); }
.arch-item .arch-date{ font-size:10px; color:var(--text-faint); }
</style>
</head>
<body>
<div class="sticky-top-wrap" id="stickyTopWrap">
<div class="top-ticker-bar">
  <div class="wrap">
    <div class="running-text-box">
      <div class="running-text-track">
        <span>🔴 LIVE UPDATE - KAJIAN 4D NEWS &nbsp;|&nbsp; Portal Berita Update 2026 &nbsp;|&nbsp; Menyajikan Informasi Terkini Seputar Piala Dunia 2026, Sepak Bola Internasional, Teknologi, Bisnis, Hiburan, dan Berita Dunia. &nbsp;|&nbsp; Cepat • Akurat • Terpercaya • Update Setiap Hari &nbsp;&nbsp;&nbsp;</span>
        <span>🔴 LIVE UPDATE - KAJIAN 4D NEWS &nbsp;|&nbsp; Portal Berita Update 2026 &nbsp;|&nbsp; Menyajikan Informasi Terkini Seputar Piala Dunia 2026, Sepak Bola Internasional, Teknologi, Bisnis, Hiburan, dan Berita Dunia. &nbsp;|&nbsp; Cepat • Akurat • Terpercaya • Update Setiap Hari &nbsp;&nbsp;&nbsp;</span>
      </div>
    </div>
  </div>
</div>

<header class="site carbon-texture">
  <div class="header-top">
    <a class="brand" href="/berita">
      <div class="brand-logo"><img src="https://ik.imagekit.io/ehc8d8fve/kajian%20icon%20v5?updatedAt=1783465068596" alt="Logo"></div>
      <div class="brand-stack">
        <div class="brand-name">
          <span class="txt-kajian">KAJIAN</span>
          <span class="badge-4d"><span class="num4">4</span><span class="letd">D</span></span>
          <span class="txt-news">NEWS</span>
        </div>
        <div class="brand-tagline">Portal Berita Update 2026</div>
      </div>
    </a>
    <a class="header-banner" href="${bannerHref}" target="_blank" rel="noopener noreferrer">
      ${bannerImgTag}${bannerFallback}
    </a>
  </div>
  <nav class="categories"><div class="wrap"><ul>${categoryTabs}</ul></div></nav>
</header>

<div class="hotnews-bar">
  <div class="hotnews-label">🔥 Hot News</div>
  <div class="hotnews-track-wrap">
    <div class="hotnews-track" id="hotNewsTrack">
      <span>Memuat berita terpopuler...</span>
    </div>
  </div>
</div>

</div>

<div class="wrap layout">
<main>
  <div class="breadcrumb">
    <a href="/berita">Beranda</a>
    <span class="sep">/</span>
    <a href="/berita?kategori=${encodeURIComponent(kat)}">${escapeHtml(kat)}</a>
    <span class="sep">/</span>
    <span class="current">${escapeHtml(a.judul.length > 40 ? a.judul.slice(0, 40) + '...' : a.judul)}</span>
  </div>

    <article>
    <h1 class="article-title">${escapeHtml(a.judul)}</h1>
    <div class="article-meta">
  <span>${tanggal}</span>
  <span class="views-count" style="display:inline-flex;align-items:center;gap:4px;">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>
    ${(a.views || 0).toLocaleString('id-ID')} kali dibaca
  </span>
</div>
    ${a.thumbnail ? `<div class="article-cover"><img src="${escapeHtml(a.thumbnail)}" alt="${escapeHtml(a.judul)}"></div>` : ''}

    <div class="article-body">${a.konten || ''}</div>

    <div class="share-row">
      <span class="lbl">Bagikan:</span>
      <a class="share-btn" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(a.judul + ' - https://' + req.headers.host + '/berita/' + a.slug)}">WhatsApp</a>
      <a class="share-btn" target="_blank" rel="noopener" href="https://t.me/share/url?url=${encodeURIComponent('https://' + req.headers.host + '/berita/' + a.slug)}&text=${encodeURIComponent(a.judul)}">Telegram</a>
      <a class="share-btn" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://' + req.headers.host + '/berita/' + a.slug)}">Facebook</a>
    </div>
  </article>

<div class="section-label">
    <span class="tag">Baca Juga</span>
    <h2>Berita lainnya di kategori <span class="kat-name">${escapeHtml(kat)}</span></h2>
  </div>
  <div class="bacajuga-grid">${bacaJugaHtml}</div>

  <div class="allnews-section carbon-texture">
    <div class="section-label">
      <span class="tag">Semua Berita</span>
      <h2>Berita Terbaru — <span class="kat-name" id="dbKatLabel">Semua Kategori</span></h2>
    </div>
    <div class="db-tabs" id="dbTabs"></div>
    <div class="all-news-grid" id="dbGrid"><div class="loading-state">Memuat berita...</div></div>
    <div class="pagination-bar" id="dbPagination"></div>
  </div>

  </main>

 <aside class="sidebar carbon-texture">
    <div class="sidebar-title">Arsip Berita</div>
    <div id="accordion"><div class="loading-state">Memuat arsip...</div></div>
  </aside>
</div>

<div class="wrap">
  <div class="section-label">
    <span class="tag">Diskusi</span>
    <h2>Komentar Pembaca</h2>
  </div>
  <div class="comments-section" id="commentsSection">
    <div id="commentLoginArea"></div>
    <form id="commentForm" style="display:none;margin-bottom:24px;">
      <textarea id="commentInput" placeholder="Tulis komentar kamu..." maxlength="1000" required
        style="width:100%;min-height:90px;background:var(--card-bg);border:1px solid var(--card-border);border-radius:8px;padding:12px;color:var(--text-main);font-family:inherit;font-size:13.5px;resize:vertical;"></textarea>
      <button type="submit" style="margin-top:8px;background:var(--blue-accent);color:#fff;border:none;padding:9px 20px;border-radius:6px;font-weight:600;font-size:13px;cursor:pointer;">Kirim Komentar</button>
      <span id="commentStatus" style="margin-left:12px;font-size:12px;color:var(--text-dim);"></span>
    </form>
    <div id="commentsList"><div class="loading-state">Memuat komentar...</div></div>
  </div>
</div>

<footer class="site ftr2">
  <div class="ftr2-notice"><b>KAJIAN4D</b> adalah platform berita bola premium yang menyediakan informasi akurat seputar Piala Dunia 2026. PORTAL BERITA TER-UPDATE DAN TERPERCAYA</div>
  <div class="ftr2-grid">
    <div class="ftr2-col">
      <div class="ftr2-brand-row">
        <div class="ftr2-brand-logo"><img src="https://ik.imagekit.io/ehc8d8fve/kajian%20icon%20v5?updatedAt=1783465068596" alt="Logo"></div>
        <div class="ftr2-brand-name">KAJIAN<span>4D</span></div>
      </div>
      <p>Platform berita bola #1 Indonesia dengan data real-time Piala Dunia 2026.</p>
    </div>
    <div class="ftr2-col">
      <h4><span class="ftr2-ico">≡</span> Kategori</h4>
      <div class="ftr2-chips">${footerChips}</div>
    </div>
    <div class="ftr2-col">
      <h4><span class="ftr2-ico">✉</span> Kontak</h4>
      <ul class="ftr2-contact">
        <li><span class="ftr2-dot"></span> WA - Kajian 4D News</li>
        <li><span class="ftr2-dot"></span> Telegram: @kajian_4D_NEWS</li>
        <li><span class="ftr2-dot"></span> Twiter KAJIAN 4D NEWS</li>
        <li><span class="ftr2-dot"></span> Hub Kami</li>
      </ul>
    </div>
    </div>
    
  <div class="ftr2-divider"></div>
  <div class="ftr2-bottom">
    <div class="ftr2-bottom-inner">
      <div class="ftr2-brand-big">KAJIAN<span>4D</span></div>
      <div class="ftr2-tagline">Berita Bola Paling Akurat &amp; Terpercaya</div>
      <div class="ftr2-copy">&copy; 2026 KAJIAN4D. All Rights Reserved. Hak Cipta Dilindungi Undang-Undang. Portal Berita Bola Terpercaya Sejak 2020</div>
      <div class="ftr2-badges"><span>✔ Indonesia</span><span>🔒 UP - TO - DATE</span><span>🕐 24/7 Update</span></div>
    </div>
    <a class="ftr2-top-btn" href="#" title="Kembali ke atas">↑</a>
  </div>
</footer>
<script>
(function(){
  function esc(str){
    return (str || '').toString().replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
  function fmtDate(d){
    if(!d) return '';
    return new Date(d).toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' });
  }
  function articleUrl(a){ return '/berita/' + a.slug; }

  function syncStickyHeaderHeight(){
    const wrap = document.getElementById('stickyTopWrap');
    if(!wrap) return;
    const h = wrap.offsetHeight;
    document.documentElement.style.setProperty('--sticky-header-h', h + 'px');
  }

  function renderSidebarArchive(articles){
    const container = document.getElementById('accordion');
    if(!container) return;
    if(!articles.length){
      container.innerHTML = '<div class="empty-state">Belum ada arsip.</div>';
      return;
    }
    const groups = {};
    articles.forEach(a => {
      const key = fmtDate(a.tanggal) || 'Tanpa Tanggal';
      groups[key] = groups[key] || [];
      groups[key].push(a);
    });
    container.innerHTML = '';
    Object.keys(groups).forEach((date) => {
      const item = document.createElement('div');
      item.className = 'accordion-item open';

      const head = document.createElement('button');
      head.className = 'accordion-head';
      head.innerHTML = '<span>' + esc(date) + ' <span class="count">(' + groups[date].length + ')</span></span><span class="chevron">▾</span>';
      head.onclick = () => item.classList.toggle('open');

      const body = document.createElement('div');
      body.className = 'accordion-body';
      body.innerHTML = groups[date].map(a => \`
        <a href="\${articleUrl(a)}" class="arch-item">
          <div class="arch-thumb"><img src="\${esc(a.thumbnail || '')}" alt=""></div>
          <div class="arch-item-body">
            <h5>\${esc(a.judul)}</h5>
            <span class="arch-date">\${fmtDate(a.tanggal)}</span>
          </div>
        </a>
      \`).join('');

      item.appendChild(head);
      item.appendChild(body);
      container.appendChild(item);
    });
  }

  function renderHotNewsTicker(articles){
    const track = document.getElementById('hotNewsTrack');
    if(!track) return;
    if(!articles.length){ track.innerHTML = '<span>Belum ada berita.</span>'; return; }

    const highlighted = articles.filter(a => a.is_highlight);
    const rest = articles.filter(a => !a.is_highlight).sort((a, b) => (b.views || 0) - (a.views || 0));
    const hotPool = [...highlighted, ...rest].slice(0, 8);
    if(!hotPool.length){ track.innerHTML = '<span>Belum ada berita.</span>'; return; }

    const itemsHtml = hotPool.map(a => \`<a href="\${articleUrl(a)}">\${esc(a.judul)}</a>\`).join(' &nbsp;&nbsp;•&nbsp;&nbsp; ');
    track.innerHTML = \`<span>\${itemsHtml}&nbsp;&nbsp;&nbsp;</span><span>\${itemsHtml}&nbsp;&nbsp;&nbsp;</span>\`;
  }

  // ====== SECTION BARU: "Semua Berita" lintas kategori dengan tab + pagination ======
  const DB_CATEGORIES = ['SEMUA', 'SEPAK BOLA', 'TEKNOLOGI', 'OLAHRAGA', 'HIBURAN', 'BISNIS', 'GAYA HIDUP', 'HIGHLIGHT'];
  const DB_ITEMS_PER_PAGE = 6;
  let dbAllArticles = [];
  let dbCurrentCategory = 'SEMUA';
  let dbCurrentPage = 1;

  function dbKatList(a){
    if(Array.isArray(a.kategori)) return a.kategori.filter(Boolean).map(k => String(k).toUpperCase());
    if(typeof a.kategori === 'string' && a.kategori.trim()) return a.kategori.split(',').map(k => k.trim().toUpperCase()).filter(Boolean);
    return [];
  }
  function dbPrimaryKat(a){
    const k = dbKatList(a);
    return k.length ? k[0] : 'BERITA';
  }
  function dbFiltered(){
    if(dbCurrentCategory === 'SEMUA') return dbAllArticles;
    if(dbCurrentCategory === 'HIGHLIGHT') return dbAllArticles.filter(a => a.is_highlight);
    return dbAllArticles.filter(a => dbKatList(a).includes(dbCurrentCategory));
  }

  function renderDbTabs(){
    const wrap = document.getElementById('dbTabs');
    if(!wrap) return;
    wrap.innerHTML = DB_CATEGORIES.map(c =>
      \`<button type="button" data-cat="\${esc(c)}" class="\${c === dbCurrentCategory ? 'active' : ''}">\${esc(c)}</button>\`
    ).join('');
    wrap.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        dbCurrentCategory = btn.dataset.cat;
        dbCurrentPage = 1;
        renderDbTabs();
        renderDbGrid();
        const label = document.getElementById('dbKatLabel');
        if(label) label.textContent = dbCurrentCategory === 'SEMUA' ? 'Semua Kategori' : dbCurrentCategory;
      });
    });
  }

  function renderDbGrid(){
    const grid = document.getElementById('dbGrid');
    const pagBar = document.getElementById('dbPagination');
    if(!grid) return;

    const pool = dbFiltered().slice().sort((x, y) => new Date(y.tanggal || 0) - new Date(x.tanggal || 0));
    const totalPages = Math.max(1, Math.ceil(pool.length / DB_ITEMS_PER_PAGE));
    if(dbCurrentPage > totalPages) dbCurrentPage = totalPages;
    if(dbCurrentPage < 1) dbCurrentPage = 1;

    const start = (dbCurrentPage - 1) * DB_ITEMS_PER_PAGE;
    const pageItems = pool.slice(start, start + DB_ITEMS_PER_PAGE);

    if(!pool.length){
      grid.innerHTML = '<div class="bj-empty">Belum ada berita di kategori ini.</div>';
    } else {
      grid.innerHTML = pageItems.map(a => `
  <a href="${articleUrl(a)}" class="an-item">
    <div class="an-thumb"><img src="${esc(a.thumbnail || '')}" alt=""></div>
    <div class="an-body">
      <span class="badge" style="font-size:9px;padding:2px 7px;">${esc(dbPrimaryKat(a))}</span>
      <h4>${esc(a.judul)}</h4>
      <div class="an-meta"><span>${fmtDate(a.tanggal)}</span>${a.views ? `<span>${esc(a.views)}x dibaca</span>` : ''}</div>
    </div>
  </a>
`).join('');
    renderDbPagination(totalPages, pagBar);
  }

  function renderDbPagination(totalPages, bar){
    if(!bar) return;
    if(totalPages <= 1){ bar.innerHTML = ''; return; }

    let pageNums = [];
    for(let i = 1; i <= totalPages; i++) pageNums.push(i);
    let visible = pageNums;
    if(totalPages > 5){
      let startP = Math.max(1, dbCurrentPage - 2);
      let endP = Math.min(totalPages, startP + 4);
      startP = Math.max(1, endP - 4);
      visible = pageNums.slice(startP - 1, endP);
    }

    bar.innerHTML = \`
      <button class="pg-btn" data-act="start" \${dbCurrentPage === 1 ? 'disabled' : ''}>&laquo; Start</button>
      <button class="pg-btn" data-act="prev" \${dbCurrentPage === 1 ? 'disabled' : ''}>Prev</button>
      \${visible.map(p => \`<button class="pg-btn pg-num \${p === dbCurrentPage ? 'active' : ''}" data-page="\${p}">\${p}</button>\`).join('')}
      <button class="pg-btn" data-act="next" \${dbCurrentPage === totalPages ? 'disabled' : ''}>Next</button>
      <button class="pg-btn" data-act="end" \${dbCurrentPage === totalPages ? 'disabled' : ''}>End &raquo;</button>
    \`;

    bar.querySelectorAll('.pg-num').forEach(btn => {
      btn.addEventListener('click', () => {
        dbCurrentPage = parseInt(btn.dataset.page, 10);
        renderDbGrid();
        const sect = document.querySelector('.allnews-section');
        if(sect) sect.scrollIntoView({ behavior:'smooth', block:'start' });
      });
    });
    bar.querySelectorAll('[data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.act;
        if(act === 'start') dbCurrentPage = 1;
        if(act === 'end') dbCurrentPage = totalPages;
        if(act === 'prev') dbCurrentPage = Math.max(1, dbCurrentPage - 1);
        if(act === 'next') dbCurrentPage = Math.min(totalPages, dbCurrentPage + 1);
        renderDbGrid();
        const sect = document.querySelector('.allnews-section');
        if(sect) sect.scrollIntoView({ behavior:'smooth', block:'start' });
      });
    });
  }

  async function initSidebarAndTicker(){
    syncStickyHeaderHeight();
    window.addEventListener('resize', syncStickyHeaderHeight);
    renderDbTabs();
    try{
      const res = await fetch('/api/articles');
      const data = await res.json();
      if(Array.isArray(data) && data.length){
        renderSidebarArchive(data);
        renderHotNewsTicker(data);
        dbAllArticles = data;
        renderDbGrid();
      }
    }catch(e){
      const container = document.getElementById('accordion');
      if(container) container.innerHTML = '<div class="empty-state">Gagal memuat arsip.</div>';
      const grid = document.getElementById('dbGrid');
      if(grid) grid.innerHTML = '<div class="bj-empty">Gagal memuat berita.</div>';
    }
    syncStickyHeaderHeight();
  }

  initSidebarAndTicker();
})();
</script>
  <script>
(function(){
  const SLUG = ${JSON.stringify(a.slug)};
  const GOOGLE_CLIENT_ID = ${JSON.stringify(process.env.GOOGLE_CLIENT_ID || '')};
  let currentIdToken = null;

  function esc(str){
    return (str || '').toString().replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
  function timeAgo(dateStr){
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if(mins < 1) return 'baru saja';
    if(mins < 60) return mins + ' menit lalu';
    const hours = Math.floor(mins / 60);
    if(hours < 24) return hours + ' jam lalu';
    const days = Math.floor(hours / 24);
    if(days < 30) return days + ' hari lalu';
    return new Date(dateStr).toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' });
  }

  async function loadComments(){
    const listEl = document.getElementById('commentsList');
    try{
      const res = await fetch('/api/comments?slug=' + encodeURIComponent(SLUG));
      const data = await res.json();
      if(!Array.isArray(data) || data.length === 0){
        listEl.innerHTML = '<div class="empty-state">Belum ada komentar. Jadilah yang pertama!</div>';
        return;
      }
      listEl.innerHTML = data.map(c => \`
        <div style="display:flex;gap:12px;padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
          <img src="\${esc(c.user_photo || '')}" alt="" style="width:36px;height:36px;border-radius:50%;flex-shrink:0;background:var(--card-bg);">
          <div style="flex:1;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
              <strong style="font-size:13px;color:var(--text-main);">\${esc(c.user_name)}</strong>
              <span style="font-size:11px;color:var(--text-faint);">\${timeAgo(c.created_at)}</span>
            </div>
            <p style="font-size:13.5px;color:#c9d2db;line-height:1.5;">\${esc(c.content)}</p>
          </div>
        </div>
      \`).join('');
    }catch(e){
      listEl.innerHTML = '<div class="empty-state">Gagal memuat komentar.</div>';
    }
  }

  function handleGoogleLogin(response){
    currentIdToken = response.credential;
    document.getElementById('commentLoginArea').innerHTML = '<p style="font-size:12.5px;color:var(--text-dim);margin-bottom:14px;">✓ Login berhasil, silakan tulis komentar.</p>';
    document.getElementById('commentForm').style.display = 'block';
  }
  window.handleGoogleLogin = handleGoogleLogin;

  function initGoogleLogin(){
    if(!GOOGLE_CLIENT_ID || !window.google) return;
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleLogin,
    });
    google.accounts.id.renderButton(
      document.getElementById('commentLoginArea'),
      { theme: 'filled_blue', size: 'medium', text: 'signin_with' }
    );
  }

  document.getElementById('commentForm').addEventListener('submit', async function(e){
    e.preventDefault();
    const input = document.getElementById('commentInput');
    const statusEl = document.getElementById('commentStatus');
    const content = input.value.trim();
    if(!content || !currentIdToken) return;

    statusEl.textContent = 'Mengirim...';
    try{
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: SLUG, content, id_token: currentIdToken }),
      });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error || 'Gagal mengirim komentar.');
      input.value = '';
      statusEl.textContent = 'Terkirim!';
      loadComments();
      setTimeout(() => { statusEl.textContent = ''; }, 3000);
    }catch(err){
      statusEl.textContent = err.message;
    }
  });

  loadComments();
  window.addEventListener('load', () => setTimeout(initGoogleLogin, 300));
})();
</script>
</body>
</html>`;
    res.status(200).send(html);
  } catch (err) {
    res.status(500).send(`<pre style="color:#e7ebf0;background:#0b0d10;padding:20px;">Terjadi kesalahan server: ${escapeHtml(err.message)}</pre>`);
  }
};
