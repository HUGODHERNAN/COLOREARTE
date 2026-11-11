/**
 * Initializes PWA Service Worker registration and binds install modal/prompt listeners.
 */
export function setupPwaInstall({ showToast }) {
    let deferredPwaPrompt = null;
    const installBtn = document.getElementById('btn-install-pwa');
    const modal = document.getElementById('pwa-install-modal');

    if (
        'serviceWorker' in navigator &&
        (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ) {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPwaPrompt = e;
        if (installBtn) {
            installBtn.classList.remove('hidden');
        }
    });

    window.addEventListener('appinstalled', () => {
        deferredPwaPrompt = null;
        if (installBtn) {
            installBtn.classList.add('hidden');
        }
        showToast('¡ColorMatch instalado en tu dispositivo!');
    });

    installBtn?.addEventListener('click', async () => {
        if (deferredPwaPrompt) {
            deferredPwaPrompt.prompt();
            const { outcome } = await deferredPwaPrompt.userChoice;
            if (outcome === 'accepted') {
                deferredPwaPrompt = null;
            }
        } else if (modal) {
            modal.classList.remove('hidden');
        }
    });

    modal?.addEventListener('click', (e) => {
        if (e.target === modal || e.target.closest('[data-action="close-install-modal"]')) {
            modal.classList.add('hidden');
        }
    });
}
