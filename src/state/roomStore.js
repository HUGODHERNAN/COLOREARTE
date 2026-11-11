const SESSION_UID_KEY = 'colormatch_session_uid';

function loadOrCreateSessionUid() {
    try {
        const existing = sessionStorage.getItem(SESSION_UID_KEY);
        if (existing) return existing;
        const fresh = 'p-' + Math.random().toString(36).substring(2, 10);
        sessionStorage.setItem(SESSION_UID_KEY, fresh);
        return fresh;
    } catch (e) {
        return 'p-' + Math.random().toString(36).substring(2, 10);
    }
}

/**
 * Creates a lightweight reactive store for client session and room state.
 */
export function createRoomStore() {
    let state = {
        uid: loadOrCreateSessionUid(),
        nickname: '',
        isHost: false,
        currentRoomCode: null,
        pendingInviteCode: null,
        roomData: null,
        viewId: 'view-register',
        loadingMessage: 'Iniciando motor WebRTC P2P...',
        p2pBadge: null
    };

    const listeners = new Set();

    function getState() {
        return state;
    }

    function setState(patch) {
        const nextPatch = typeof patch === 'function' ? patch(state) : patch;
        state = { ...state, ...nextPatch };
        listeners.forEach(listener => listener(state));
    }

    function subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    }

    function resetRoomSession(viewId = 'view-menu') {
        setState({
            isHost: false,
            currentRoomCode: null,
            roomData: null,
            p2pBadge: null,
            viewId
        });
    }

    return {
        getState,
        setState,
        subscribe,
        resetRoomSession
    };
}

