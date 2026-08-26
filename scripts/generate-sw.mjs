// Post-build: generate service worker (dist/sw.js) via workbox-build.
// Catatan: hook internal vite-plugin-pwa buat membangun SW tidak tereksekusi
// di pipeline Astro 7, jadi kita panggil workbox langsung — hasilnya identik
// dengan strategi generateSW bawaan plugin.
import { generateSW } from 'workbox-build';

const result = await generateSW({
  globDirectory: 'dist',
  globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'],
  swDest: 'dist/sw.js',
  navigateFallback: 'index.html',
  skipWaiting: true,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  sourcemap: false,
  maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
});

console.log(`Service worker digenerate: precache ${result.count} file (${(result.size / 1024).toFixed(0)} KB).`);
