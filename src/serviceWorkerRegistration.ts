import { syncManager } from './services/syncManager';

export function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  // New update available
                  console.log('Versi baru aplikasi tersedia.');
                } else {
                  console.log('Aplikasi siap digunakan secara offline!');
                }
              }
            });
          }
        });

        // Register background sync if supported by browser
        if ('sync' in registration) {
          try {
            await (registration as any).sync.register('sync-cloud-firestore');
          } catch (e) {
            // Background sync not allowed or ignored
          }
        }
      } catch (error) {
        console.warn('Gagal meregistrasi Service Worker:', error);
      }
    });

    // Listen for messages from Service Worker (e.g. TRIGGER_AUTO_SYNC)
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'TRIGGER_AUTO_SYNC') {
        syncManager.triggerAutoSync();
      }
    });
  }
}
