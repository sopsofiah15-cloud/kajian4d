const { getSql } = require('../lib/db');

function escapeXml(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = async (req, res) => {
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT slug, updated_at, thumbnail, judul
      FROM articles
      ORDER BY updated_at DESC
    `;
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const baseUrl = `${protocol}://${host}`;

    const urls = [
      { loc: `${baseUrl}/berita`, lastmod: new Date().toISOString() },
      ...rows.map((r) => ({
        loc: `${baseUrl}/berita/${r.slug}`,
        lastmod: new Date(r.updated_at || Date.now()).toISOString(),
        image: r.thumbnail,
        title: r.judul,
      })),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>${
      u.image
        ? `
    <image:image>
      <image:loc>${escapeXml(u.image)}</image:loc>
      <image:title>${escapeXml(u.title || '')}</image:title>
    </image:image>`
        : ''
    }
  </url>`
  )
  .join('\n')}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml');
    res.status(200).send(xml);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
