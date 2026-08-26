// Post-build: generate service worker (dist/sw.js) via workbox-build.
// Catatan: Karena ini multi-page SSG (/periksa/index.html, /lokasi/index.html, /ringkasan/index.html),
// navigateFallback JANGAN diarahkan ke index.html root karena akan membajak seluruh rute sub-halaman!
import { generateSW } from 'workbox-build';

const result = await generateSW({
  globDirectory: 'dist',
  globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'],
  swDest: 'dist/sw.js',
  navigateFallback: null,
  skipWaiting: true,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  sourcemap: false,
  maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
});

console.log(`Service worker digenerate: precache ${result.count} file (${(result.size / 1024).toFixed(0)} KB).`);
