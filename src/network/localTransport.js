import { LOCAL_STORAGE_PREFIX, SANDBOX_CHANNEL_NAME } from '../config/constants.js';

const LOCAL_JOIN_WAIT_MS = 1200;

/**
 * Local fallback transport using BroadcastChannel and localStorage events for sandboxed previews
 * and same-browser multi-tab sessions.
 */
export function createLocalTransport({ onMessage, modeLabel = 'Vista Previa' }) {
    let activeRoomCode = null;
    let isHostMode = false;
    let destroyed = false;
    let joinResolver = null;

    const channel = typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel(SANDBOX_CHANNEL_NAME)
        : null;

    function dispatchIncoming(msg) {
        if (destroyed || !msg || !activeRoomCode || msg.roomCode !== activeRoomCode) return;

        if (!isHostMode && msg.type === 'STATE_SYNC' && joinResolver) {
            const resolve = joinResolver;
            joinResolver = null;
            resolve({ ok: true, modeLabel });
        }

        onMessage?.(msg, { senderId: msg.playerId || 'local' });
    }

    if (channel) {
        channel.onmessage = (event) => dispatchIncoming(event.data);
    }

    function onStorage(event) {
        if (isHostMode) return;
        if (event.key === `${LOCAL_STORAGE_PREFIX}${activeRoomCode}` && event.newValue) {
            try {
                dispatchIncoming(JSON.parse(event.newValue));
            } catch (e) {}
        }
    }

    window.addEventListener('storage', onStorage);

    function postChannel(payload) {
        if (channel) {
            try { channel.postMessage(payload); } catch (e) {}
        }
    }

    function createHostSession(roomCode) {
        isHostMode = true;
        activeRoomCode = roomCode;
        return Promise.resolve({ ok: true, modeLabel });
    }

    function joinGuestSession(roomCode, { playerId, name }) {
        isHostMode = false;
        activeRoomCode = roomCode;

        return new Promise((resolve) => {
            let done = false;
            const finish = (result) => {
                if (done) return;
                done = true;
                joinResolver = null;
                resolve(result);
            };

            joinResolver = finish;
            postChannel({
                type: 'JOIN_REQUEST',
                roomCode,
                playerId,
                name
            });

            setTimeout(() => {
                finish({
                    ok: false,
                    reason: 'En Vista Previa crea una sala y usa "+ Añadir Bot IA", o alójalo en GitHub/Netlify para conectar varios dispositivos.'
                });
            }, LOCAL_JOIN_WAIT_MS);
        });
    }

    function sendToHost(message) {
        if (!activeRoomCode) return;
        postChannel({ ...message, roomCode: activeRoomCode });
    }

    function sendToPlayer(playerId, message) {
        if (!activeRoomCode) return;
        postChannel({ ...message, roomCode: activeRoomCode, targetPlayerId: playerId });
    }

    function broadcast(message) {
        if (!activeRoomCode) return;
        const payload = { ...message, roomCode: activeRoomCode };
        postChannel(payload);
        try {
            localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${activeRoomCode}`, JSON.stringify(payload));
        } catch (e) {}
    }

    function destroy() {
        if (destroyed) return;
        destroyed = true;
        joinResolver = null;
        window.removeEventListener('storage', onStorage);
        if (channel) {
            try { channel.close(); } catch (e) {}
        }
    }

    return {
        createHostSession,
        joinGuestSession,
        sendToHost,
        sendToPlayer,
        broadcast,
        destroy
    };
}

