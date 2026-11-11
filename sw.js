const CACHE_NAME = 'colormatch-v3';

const APP_SHELL_ASSETS = [
    './',
    './index.html',
    './manifest.webmanifest',
    './assets/og-cover.jpg',
    './assets/icons/favicon.svg',
    './assets/icons/apple-touch-icon.png',
    './assets/icons/icon-192.png',
    './assets/icons/icon-512.png',
    './src/styles/main.css',
    './src/config/tailwind.config.js',
    './src/config/constants.js',
    './src/domain/color.js',
    './src/domain/scoring.js',
    './src/domain/gameEngine.js',
    './src/network/peerTransport.js',
    './src/network/localTransport.js',
    './src/network/createTransport.js',
    './src/state/roomStore.js',
    './src/ui/utils/dom.js',
    './src/ui/utils/clipboard.js',
    './src/ui/components/toast.js',
    './src/ui/components/header.js',
    './src/ui/components/colorPicker.js',
    './src/ui/views/loadingView.js',
    './src/ui/views/registerView.js',
    './src/ui/views/menuView.js',
    './src/ui/views/lobbyView.js',
    './src/ui/views/memorizeView.js',
    './src/ui/views/guessView.js',
    './src/ui/views/resultsView.js',
    './src/ui/views/gameOverView.js',
    './src/ui/viewManager.js',
    './src/pwa/installPrompt.js',
    './src/main.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL_ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;

    // Network-first with cache fallback so deployed updates arrive immediately while keeping offline support
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (response && response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                }
                return response;
            })
            .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
    );
});
