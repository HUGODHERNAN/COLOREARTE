/**
 * Manages the floating toast notification banner.
 */
export function createToast() {
    let toastTimer = null;

    return function showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const msg = document.getElementById('toast-msg');
        const icon = document.getElementById('toast-icon');
        if (!toast || !msg || !icon) return;

        msg.textContent = message;
        if (type === 'error') {
            icon.className = 'fa-solid fa-circle-xmark text-[#FF3B30] text-lg';
        } else if (type === 'warning') {
            icon.className = 'fa-solid fa-triangle-exclamation text-[#FF9500] text-lg';
        } else {
            icon.className = 'fa-solid fa-circle-check text-[#28CD41] text-lg';
        }

        toast.classList.remove('hidden', 'translate-y-2', 'opacity-0');
        toast.classList.add('translate-y-0', 'opacity-100');

        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toast.classList.add('translate-y-2', 'opacity-0');
            setTimeout(() => toast.classList.add('hidden'), 250);
        }, 3000);
    };
}

