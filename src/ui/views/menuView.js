/**
 * Manages the create-room vs join-room menu view.
 */
export function createMenuView({ onCreateRoom, onJoinRoom, onChangeNickname }) {
    const greetingName = document.getElementById('menu-greeting-name');
    const createBtn = document.getElementById('btn-create-room');
    const joinBtn = document.getElementById('btn-join-room');
    const joinInput = document.getElementById('input-join-code');
    const changeNickBtn = document.getElementById('btn-change-nickname');

    function handleJoin() {
        onJoinRoom(joinInput?.value || '');
    }

    createBtn?.addEventListener('click', () => onCreateRoom());
    joinBtn?.addEventListener('click', handleJoin);
    joinInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleJoin();
    });
    changeNickBtn?.addEventListener('click', () => onChangeNickname());

    function prefillJoinCode(code) {
        if (joinInput && code) {
            joinInput.value = code;
        }
    }

    function render(state) {
        if (greetingName && state.nickname) {
            greetingName.textContent = state.nickname;
        }
    }

    return { prefillJoinCode, render };
}

