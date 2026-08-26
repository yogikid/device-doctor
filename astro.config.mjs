// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Device Doctor — full static (SSG), tanpa adapter.
// Semua logic diagnostic jalan di browser via Web API.
// Catatan: @vite-pwa/astro belum support Astro 6+/7, jadi kita pakai
// vite-plugin-pwa (engine yang sama, tim yang sama) sebagai Vite plugin.
export default defineConfig({
  output: 'static',
  integrations: [react()],
  vite: {
    plugins: [
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: 'Device Doctor',
          short_name: 'Device Doctor',
          description: 'Cek kesehatan HP kamu langsung dari browser',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#EDF2ED',
          theme_color: '#EDF2ED',
          lang: 'id',
          dir: 'ltr',
          categories: ['utilities', 'productivity'],
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: '/icons/icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          navigateFallback: '/',
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        },
      }),
    ],
  },
});
