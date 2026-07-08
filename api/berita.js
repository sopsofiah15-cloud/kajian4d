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
<link rel="icon" type="image/png" href="https://ik.imagekit.io/ehc8d8fve/kajian%20icon%20v5?updatedAt=1783465068596">
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
  html{-webkit-text-size-adjust:100%;overflow-x:hidden;}
  body{
    background-color:var(--bg-carbon);
    background-image:
      repeating-linear-gradient(135deg, var(--line-diag) 0px, var(--line-diag) 1px, transparent 1px, transparent 26px),
      radial-gradient(ellipse at top, #171b20 0%, #0b0d10 60%);
    color:var(--text-main); font-family:var(--font-body); line-height:1.6; min-height:100vh; overflow-x:hidden;
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

  .article-cover{width:100%;border-radius:12px;overflow:hidden;margin:22px 0 28px;border:1px solid var(--card-border);background:var(--card-bg);max-height:460px;}
  .article-cover img{width:100%;height:100%;object-fit:cover;max-height:460px;}

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
</style>
</head>
<body>

<header class="site">
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

<div class="wrap">
  <div class="breadcrumb">
    <a href="/berita">Beranda</a>
    <span class="sep">/</span>
    <a href="/berita?kategori=${encodeURIComponent(kat)}">${escapeHtml(kat)}</a>
    <span class="sep">/</span>
    <span class="current">${escapeHtml(a.judul)}</span>
  </div>

  <article>
    <div class="article-head">
      ${kategoriPillsHead}
      <h1 class="article-title">${escapeHtml(a.judul)}</h1>
      <div class="article-meta"><span>${tanggal}</span></div>
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

</body>
</html>`;
    res.status(200).send(html);
  } catch (err) {
    res.status(500).send(`<pre style="color:#e7ebf0;background:#0b0d10;padding:20px;">Terjadi kesalahan server: ${escapeHtml(err.message)}</pre>`);
  }
};
