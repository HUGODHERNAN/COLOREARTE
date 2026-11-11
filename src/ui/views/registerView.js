import { setElementVisible } from '../utils/dom.js';

/**
 * Manages the nickname registration and invite banner view.
 */
export function createRegisterView({ onSubmitNickname }) {
    const nicknameInput = document.getElementById('input-nickname');
    const submitBtn = document.getElementById('btn-submit-nickname');
    const inviteBanner = document.getElementById('invite-banner');
    const inviteCodeLabel = document.getElementById('invite-code-label');

    function handleSubmit() {
        onSubmitNickname(nicknameInput?.value || '');
    }

    submitBtn?.addEventListener('click', handleSubmit);
    nicknameInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSubmit();
    });

    function hydrateSavedNickname(savedName) {
        if (nicknameInput && savedName) {
            nicknameInput.value = savedName;
        }
    }

    function render(state) {
        const hasInvite = Boolean(state.pendingInviteCode);
        setElementVisible(inviteBanner, hasInvite);
        if (hasInvite && inviteCodeLabel) {
            inviteCodeLabel.textContent = state.pendingInviteCode;
        }
    }

    return { hydrateSavedNickname, render };
}

