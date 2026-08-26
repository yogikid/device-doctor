# Device Doctor 🩺

**Cek kesehatan HP kamu langsung dari browser.**

PWA mobile-first yang dibangun dengan Astro (full static), neobrutalism-components,
Tailwind CSS v4, dan vanilla TypeScript buat engine diagnostic-nya.
Semua hasil dibingkai sebagai **indikasi** dari data yang bisa dibaca browser —
bukan diagnosis pasti. Jujur soal keterbatasan itu inti app ini.

## Fitur

- **Info Device** — baterai (level/cas), koneksi, perangkat & browser, layar, GPU,
  penyimpanan origin, lokasi on-demand. Card API-nya tak didukung tetap tampil
  nonaktif + alasan.
- **Periksa** — 9 test interaktif: layar sentuh (dead zone), dead pixel (flash warna),
  speaker (nada L/R), mikrofon (level meter), kamera (preview depan/belakang),
  getar, sensor gerak (bubble level), benchmark CPU/GPU (FPS), GPS presisi.
- **Ringkasan** — rule-based recommendation engine + stempel diagnosis:
  SEHAT / PERLU PERHATIAN / PERIKSA LEBIH LANJUT.

Yang **sengaja tidak ada**: battery health/wear level, dBm sinyal, test tombol fisik,
proximity sensor, kualitas port charging — datanya memang tidak pernah terekspos ke web.

## Struktur

```
src/
├── components/        # Island React (chrome UI): tabs, reset button, ui/*
├── layouts/           # BaseLayout (head, fonts, PWA register)
├── lib/
│   ├── diagnostics/   # Engine: info dashboard, tests, recommendation, store, types
│   └── dom.ts         # Helper DOM kecil
├── pages/index.astro  # Halaman utama (markup statis + islands)
└── styles/global.css  # Design tokens softened neo-brutalism
scripts/gen-icons.mjs  # Generator ikon PWA (zero-dependency)
```

## Menjalankan

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # output ke dist/
npm run preview   # preview hasil build
```

## Deploy ke Cloudflare Workers

Project ini full static (SSG) — tanpa adapter, deploy sebagai Workers static assets:

```bash
npm install -g wrangler   # atau: npx wrangler
wrangler login
wrangler deploy           # pakai wrangler.jsonc (assets.directory → ./dist)
```

HTTPS otomatis di `*.workers.dev`, jadi semua secure-context API
(geolocation/kamera/mic/motion) langsung jalan.

## Catatan teknis

- `@vite-pwa/astro` (per rilis saat ini) belum support Astro 6+; PWA dipasang via
  `vite-plugin-pwa` (engine yang sama) langsung di `astro.config.mjs`.
- Komponen UI dari registry neobrutalism (`npx shadcn add`) — warna default library
  ditimpa lewat design tokens sage pastel di `global.css`.
- Logic diagnostic sengaja vanilla TypeScript (tanpa React) supaya payload JS minimal;
  React cuma dipakai buat chrome UI dan di-hydrate sesuai kebutuhan.
