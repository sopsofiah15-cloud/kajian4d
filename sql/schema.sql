-- Jalankan ini sekali di Neon / Vercel Postgres (tab "Query") setelah database dibuat.

CREATE TABLE IF NOT EXISTS articles (
  id SERIAL PRIMARY KEY,
  judul TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  excerpt TEXT,
  kategori TEXT,
  tanggal DATE,
  thumbnail TEXT,
  konten TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- baris awal (admin_password_hash kosong = pakai ADMIN_DEFAULT_PASSWORD sampai direset)
INSERT INTO settings (key, value) VALUES
  ('admin_password_hash', ''),
  ('header_image', ''),
  ('custom_html', '')
ON CONFLICT (key) DO NOTHING;
