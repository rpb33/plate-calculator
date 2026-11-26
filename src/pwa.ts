interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const installButton = document.querySelector<HTMLButtonElement>('#install-app')!;
const updateButton = document.querySelector<HTMLButtonElement>('#update-app')!;
let installPrompt: InstallPrompt | undefined;
let reloadForUpdate = false;

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event as InstallPrompt;
  installButton.hidden = false;
});
window.addEventListener('appinstalled', () => {
  installPrompt = undefined;
  installButton.hidden = true;
});
installButton.addEventListener('click', async () => {
  const prompt = installPrompt;
  if (!prompt) return;
  installButton.hidden = true;
  installPrompt = undefined;
  try {
    await prompt.prompt();
    await prompt.userChoice;
  } catch { /* Native installation is optional; browser menus remain available. */ }
});

async function registerOfflineApp(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.register(
      new URL(`${import.meta.env.BASE_URL}sw.js`, document.baseURI),
      { updateViaCache: 'none' },
    );
    const showUpdate = () => {
      if (registration.waiting && navigator.serviceWorker.controller) updateButton.hidden = false;
    };
    showUpdate();
    registration.addEventListener('updatefound', () => {
      registration.installing?.addEventListener('statechange', showUpdate);
    });
    updateButton.addEventListener('click', () => {
      if (!registration.waiting) return;
      reloadForUpdate = true;
      updateButton.disabled = true;
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    });
    const checkForUpdates = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void registration.update().catch(() => { /* Keep the cached app when offline. */ });
      }
    };
    document.addEventListener('visibilitychange', checkForUpdates);
    window.addEventListener('online', checkForUpdates);
  } catch (error) {
    console.warn('Offline support could not be enabled.', error);
  }
}

// Keep Vite's development server free of service worker caches and stale assets.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadForUpdate) { reloadForUpdate = false; window.location.reload(); }
  });
  if (document.readyState === 'complete') void registerOfflineApp();
  else window.addEventListener('load', () => { void registerOfflineApp(); }, { once: true });
}
