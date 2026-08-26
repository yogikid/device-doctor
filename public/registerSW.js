/**
 * Service Worker registration dengan auto-update dan lifecycle clean-up.
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  // Service worker baru terpasang, siap update
                  console.log('Device Doctor update tersedia.');
                }
              }
            };
          }
        };
      })
      .catch((err) => {
        console.warn('SW registration gagal:', err);
      });
  });
}
