# Device Doctor

Aplikasi web progressive (PWA) untuk diagnostik perangkat keras, analisis parameter jaringan, dan evaluasi spesifikasi smartphone secara real-time langsung melalui browser tanpa instalasi aplikasi native.

Dibangun menggunakan **Astro v5 (Full Static SSG)**, **TypeScript**, **Tailwind CSS v4 (Neo-Brutalism Design)**, dan dioptimalkan untuk performa tinggi dengan arsitektur zero-bloat.

---

## Fitur Utama

### 1. Spesifikasi Hardware & Jaringan (14 Modul)
- **Identifikasi Model Hardware:** Mendeteksi vendor, model komersial (via *High-Entropy Client Hints API*), arsitektur CPU, dan platform OS.
- **Jaringan & Edge IP:** Deteksi IP Publik, nama ISP/Operator, Autonomous System (ASN), kota/region, dan protokol koneksi (HTTP/2, HTTP/3, TLS 1.3).
- **GPU & WebGL2 Engine:** Deteksi chipset renderer (ARM Mali, Adreno, Apple GPU), batas dimensi tekstur, dan WebGPU support.
- **Layar & Tampilan:** Resolusi fisik aktual (DPR scaled), color depth, HDR support, Display-P3 wide gamut, dan monitor refresh rate.
- **Sensor & Peripheral:** Deteksi akselerometer, gyroscope, motor haptic getar, Screen WakeLock, WebUSB, WebHID, WebSerial, dan Web NFC.
- **Audio & Multimedia:** WebAudio context latency, channel routing stereo, MediaStream, audio/video codecs (AV1, HEVC, VP9, H.264, Opus, FLAC).
- **Penyimpanan & Memori:** Quota Storage Manager, OPFS (Origin Private File System), dan V8 JS Heap Memory allocation.

### 2. Pengujian Hardware Interaktif (9 Rangkaian Test)
- **Layar Sentuh:** 60-grid multi-touch matrix untuk memetakan dead-zone layar sentuh secara edge-to-edge.
- **Dead Pixel:** Pengujian 8 spektrum warna solid murni (Red, Green, Blue, White, Black, Yellow, Cyan, Magenta).
- **Speaker Stereo:** Uji isolasi kanal frekuensi audio kiri (600 Hz) dan kanan (800 Hz).
- **Mikrofon:** Visualizer decibel meter real-time via WebAudio Analyser.
- **Modul Kamera:** Preview live feed sensor kamera belakang dan kamera depan.
- **Motor Getar (Haptics):** Pengujian multi-pattern haptic pulse (Burst, SOS Morse, Pulse, Long).
- **Sensor Gerak (Gyro):** Visualisasi leveling bola 3D sudut kemiringan X/Y secara real-time.
- **Benchmark CPU/GPU:** Stress-test kalkulasi matriks matematika floating-point.
- **Kuncian Sinyal GPS:** Pengukuran radius presisi satelit GNSS dan visualisasi koordinat pada OpenStreetMap.
- **Mode Auto-Run:** Opsi pengujian seluruh rangkaian hardware secara berurutan otomatis sekali klik.

### 3. Asisten Diagnosa & Evaluasi AI
- Dilengkapi **Dokter Device AI** dengan integrasi **Super RAG Context** yang menganalisis 100% parameter hardware dan hasil pengujian fisik perangkat.
- Mendukung percakapan multi-turn berkelanjutan dengan memori sesi obrolan.

---

## Struktur Direktori

```
device-doctor/
├── public/                 # Static assets, favicon, PWA icons, manifest
├── scripts/
│   ├── generate-sw.mjs     # Workbox Service Worker build generator
│   └── gen-icons.mjs       # Script generator aset ikon PWA
├── src/
│   ├── components/         # Island React components (Navigation, Modals, UI)
│   ├── layouts/            # BaseLayout (ClientRouter SPA, Meta tags, SEO)
│   ├── lib/
│   │   ├── diagnostics/    # Logic engine (info, tests, store, AI client)
│   │   └── dom.ts          # Utility DOM & formatting
│   ├── pages/              # Astro multi-page routes (/, /periksa, /lokasi, /ringkasan)
│   └── styles/             # Global CSS & Neo-Brutalism design system
├── worker/
│   ├── index.ts            # Cloudflare Worker entry (Static serving + /api/ip + /api/ai proxy)
│   └── tsconfig.json       # TypeScript config untuk Worker environment
├── astro.config.mjs        # Konfigurasi Astro & Tailwind integration
├── package.json
└── wrangler.jsonc          # Konfigurasi Cloudflare Workers
```

---

## Pengembangan Lokal

Pastikan Node.js v18+ atau v20+ sudah terpasang.

```bash
# Clone repository
git clone https://github.com/yogikid/device-doctor.git
cd device-doctor

# Install dependensi
npm install

# Jalankan development server
npm run dev
```

Aplikasi dapat diakses pada `http://localhost:4321`.

---

## Build & Panduan Deployment

### 1. Build Static Asset

```bash
npm run build
```
Output static files akan berada di direktori `./dist/` lengkap dengan `sw.js` (PWA offline caching).

---

### 2. Opsi Deployment

#### A. Cloudflare Workers / Cloudflare Pages (Rekomendasi)

Project ini menyertakan script proxy worker di direktori `./worker/index.ts` untuk melayani static assets dan endpoint edge API (`/api/ip` & `/api/ai`).

```bash
# Login ke Cloudflare
npx wrangler login

# Deploy ke Workers
npx wrangler deploy
```

Atau jika menggunakan **Cloudflare Pages**:
- Build command: `npm run build`
- Build output directory: `dist`

---

#### B. Vercel

```bash
# Install Vercel CLI jika belum ada
npm install -g vercel

# Deploy
vercel --prod
```
- Framework Preset: **Astro**
- Build Command: `npm run build`
- Output Directory: `dist`

---

#### C. Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist
```

Atau hubungkan repository di dashboard Netlify:
- Build command: `npm run build`
- Publish directory: `dist`

---

#### D. Docker / Nginx Self-Hosted

Buat file `Dockerfile` di root project:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Contoh konfigurasi `nginx.conf`:

```nginx
server {
    listen 80;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache control untuk PWA & Assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|webmanifest)$ {
        expires 1y;
        add_header Cache-Control "public, no-transform";
    }

    location = /sw.js {
        add_header Cache-Control "no-cache";
    }
}
```

Build dan jalankan container:

```bash
docker build -t device-doctor .
docker run -d -p 8080:80 device-doctor
```

---

## Kompatibilitas Browser

Aplikasi ini menggunakan Web APIs modern standar W3C. Fitur pengujian hardware tingkat rendah (High-Entropy Client Hints, Vibration API, WebAudio Channel Merger, WebGPU) berjalan optimal pada browser berbasis **Chromium**:
- Google Chrome (Desktop & Mobile)
- Microsoft Edge
- Brave Browser
- Samsung Internet
- Opera

---

## Lisensi

Proyek ini dirilis di bawah lisensi **MIT License**.
