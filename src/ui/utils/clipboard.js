/**
 * Copies text to the system clipboard using the modern Clipboard API with textarea fallback.
 */
export async function copyText(text, successMessage, showToast) {
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            showToast(successMessage);
            return;
        } catch (e) {}
    }

    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
        document.execCommand('copy');
        showToast(successMessage);
    } catch (e) {
        showToast('No se pudo copiar automáticamente', 'warning');
    }
    document.body.removeChild(ta);
}

