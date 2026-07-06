# KAJIAN4D — Panel Admin Berita + Backend (Vercel)

Struktur project ini murni **Node.js Serverless Functions** (bukan PHP, bukan Next.js) —
cocok untuk Vercel dan sudah lengkap dengan database supaya berita **tersimpan permanen**
dan bisa dibaca kapan pun oleh siapa pun, dari perangkat mana pun.

```
kajian4d-project/
├── admin.html          -> panel admin (login di sini)
├── berita/index.html   -> halaman publik daftar berita (untuk GSC)
├── api/
│   ├── login.js         -> cek ID + password
│   ├── reset-password.js-> reset password pakai kode 210514
│   ├── articles.js      -> simpan/ambil/hapus berita (database)
│   ├── settings.js      -> simpan/ambil header & custom HTML
│   ├── upload.js        -> upload gambar ke Vercel Blob
│   └── berita.js        -> render halaman detail /berita/:slug (untuk SEO)
├── lib/
│   ├── db.js
│   └── auth.js
├── sql/schema.sql       -> struktur tabel database
├── vercel.json          -> aturan URL /berita
├── package.json
└── .env.example
```

## Langkah 1 — Upload project ke GitHub (atau langsung lewat Vercel CLI)

Paling gampang: buat repository baru di GitHub, upload semua isi folder ini, lalu
di Vercel klik **Add New → Project → Import Git Repository** dan pilih repo tersebut.

Kalau mau tanpa GitHub, bisa juga pakai Vercel CLI langsung dari folder ini:
```bash
npm i -g vercel
vercel login
vercel
```

## Langkah 2 — Sambungkan Database (Postgres via Neon)

Vercel Postgres versi lama sudah tidak ada — sekarang pakai integrasi **Neon** lewat
Vercel Marketplace (masih gratis untuk skala kecil):

1. Buka project di dashboard Vercel → tab **Storage**
2. Klik **Create Database / Marketplace Database** → pilih **Neon (Postgres)**
3. Ikuti langkah connect — Vercel otomatis membuat environment variable
   `DATABASE_URL` (atau `POSTGRES_URL`, cek nama persisnya di tab Storage setelah dibuat)
   dan menyambungkannya ke project ini.
4. Buka database tersebut di dashboard (ada tab **Query**), lalu **paste isi
   file `sql/schema.sql`** dan jalankan sekali. Ini akan membuat tabel `articles`
   dan `settings`.

## Langkah 3 — Sambungkan Vercel Blob (untuk upload gambar)

1. Masih di tab **Storage** → **Create Database** → pilih **Blob**
2. Connect ke project ini — Vercel otomatis membuat `BLOB_READ_WRITE_TOKEN`

## Langkah 4 — Atur Environment Variables lainnya

Di dashboard project → **Settings → Environment Variables**, tambahkan:

| Nama | Nilai |
|---|---|
| `ADMIN_ID` | `kajian-admin` |
| `ADMIN_DEFAULT_PASSWORD` | `Bos210514.` |
| `ADMIN_RESET_CODE` | `210514` |
| `ADMIN_API_TOKEN` | string acak panjang, contoh: hasil dari `openssl rand -hex 32` |

`ADMIN_API_TOKEN` ini kunci rahasia yang dipakai panel admin untuk mengizinkan
simpan/hapus/upload — jangan dibagikan ke siapa pun.

## Langkah 5 — Deploy

Jika lewat GitHub: setiap kali kamu push, Vercel otomatis build & deploy.
Jika lewat CLI: jalankan
```bash
vercel --prod
```

## Langkah 6 — Akses

- Panel admin: `https://domainmu.vercel.app/admin.html`
- Daftar berita publik (untuk didaftarkan ke Google Search Console): `https://domainmu.vercel.app/berita`
- Detail satu berita: `https://domainmu.vercel.app/berita/nama-slug-berita`

Login pertama kali pakai:
- ID: `kajian-admin`
- Password: `Bos210514.`

Kalau lupa, klik **"Lupa Password?"**, masukkan kode `210514`, lalu buat password
baru. Password baru ini tersimpan di database (bukan di browser), jadi berlaku
di perangkat mana pun.

## Cara kerja penyimpanan data

- Semua berita, thumbnail (URL), dan pengaturan header disimpan di **database
  Postgres (Neon)** — permanen, tidak hilang walau kamu ganti perangkat atau
  browser dibersihkan.
- Gambar yang di-upload lewat "Upload dari Storage" dikirim ke **Vercel Blob**
  dan mendapat URL permanen, lalu URL itu yang disimpan di database.
- Halaman `/berita` dan `/berita/:slug` membaca langsung dari database yang sama,
  jadi begitu kamu simpan berita di panel admin, otomatis muncul di halaman publik.
- Halaman detail berita (`/berita/:slug`) dirender di server (bukan hanya lewat
  JavaScript) supaya judul, deskripsi, dan gambar bisa terbaca dengan baik oleh
  Google Search Console saat proses indexing.

## Catatan keamanan

Sistem login ini sengaja dibuat sederhana (satu akun admin) sesuai kebutuhanmu.
Untuk keamanan tambahan di kemudian hari, kamu bisa:
- Mengaktifkan **Vercel Authentication / Password Protection** di level project
  (Settings → Deployment Protection) sebagai lapisan tambahan sebelum halaman
  `admin.html` bisa diakses sama sekali.
- Mengganti `ADMIN_API_TOKEN` secara berkala.
