/**
 * Escapes HTML special characters to prevent markup injection in dynamic templates.
 */
export function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Toggles visibility classes on an element cleanly, optionally applying flex layout when shown.
 */
export function setElementVisible(el, visible, useFlex = false) {
    if (!el) return;
    if (visible) {
        el.classList.remove('hidden');
        if (useFlex) el.classList.add('flex');
    } else {
        el.classList.add('hidden');
        if (useFlex) el.classList.remove('flex');
    }
}

