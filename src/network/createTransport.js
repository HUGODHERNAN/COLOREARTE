import { generateRoomCode } from '../domain/gameEngine.js';
import { createLocalTransport } from './localTransport.js';
import { createPeerTransport, isPeerTransportAvailable } from './peerTransport.js';

/**
 * Coordinates host room creation and guest joining over PeerJS WebRTC with automatic
 * fallback to local BroadcastChannel transport when WebRTC signaling is unavailable.
 */
export function createTransportManager({ onMessage, onPlayerDisconnect, onHostDisconnect }) {
    let activeTransport = null;

    function destroyActive() {
        if (activeTransport) {
            activeTransport.destroy();
            activeTransport = null;
        }
    }

    async function hostRoom({ onOpening } = {}) {
        destroyActive();
        let roomCode = generateRoomCode();

        if (!isPeerTransportAvailable()) {
            activeTransport = createLocalTransport({ onMessage, modeLabel: 'Vista Previa' });
            const res = await activeTransport.createHostSession(roomCode);
            return { ...res, roomCode };
        }

        // Retry with a fresh code if the PeerJS broker reports unavailable-id
        for (let attempt = 0; attempt < 3; attempt++) {
            onOpening?.(roomCode);
            const peerTransport = createPeerTransport({ onMessage, onPlayerDisconnect, onHostDisconnect });
            const res = await peerTransport.createHostSession(roomCode);

            if (res.ok) {
                activeTransport = peerTransport;
                return { ...res, roomCode };
            }

            peerTransport.destroy();
            if (res.retryCode) {
                roomCode = generateRoomCode();
                continue;
            }

            if (res.fallbackLocal) {
                activeTransport = createLocalTransport({
                    onMessage,
                    modeLabel: res.modeLabel || 'Vista Previa'
                });
                const localRes = await activeTransport.createHostSession(roomCode);
                return { ...localRes, roomCode };
            }
        }

        activeTransport = createLocalTransport({ onMessage, modeLabel: 'Modo Local' });
        const fallbackRes = await activeTransport.createHostSession(roomCode);
        return { ...fallbackRes, roomCode };
    }

    async function joinRoom(roomCode, { playerId, name, onConnecting } = {}) {
        destroyActive();

        if (!isPeerTransportAvailable()) {
            const local = createLocalTransport({ onMessage, modeLabel: 'Vista Previa' });
            activeTransport = local;
            const res = await local.joinGuestSession(roomCode, { playerId, name });
            if (!res.ok) destroyActive();
            return res;
        }

        onConnecting?.(roomCode);
        const peer = createPeerTransport({ onMessage, onPlayerDisconnect, onHostDisconnect });
        activeTransport = peer;
        const res = await peer.joinGuestSession(roomCode, { playerId, name });
        if (!res.ok) destroyActive();
        return res;
    }

    function sendToHost(message) {
        activeTransport?.sendToHost(message);
    }

    function sendToPlayer(playerId, message) {
        activeTransport?.sendToPlayer(playerId, message);
    }

    function broadcast(message) {
        activeTransport?.broadcast(message);
    }

    return {
        hostRoom,
        joinRoom,
        sendToHost,
        sendToPlayer,
        broadcast,
        destroy: destroyActive
    };
}

