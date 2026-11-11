import { PEER_CONFIG, ROOM_PREFIX } from '../config/constants.js';

const HOST_OPEN_TIMEOUT_MS = 7000;
const GUEST_CONNECT_TIMEOUT_MS = 12000;
const HEARTBEAT_INTERVAL_MS = 8000;

/**
 * Checks whether PeerJS and external WebSocket signaling are available in the current environment.
 */
export function isPeerTransportAvailable() {
    if (typeof window.Peer === 'undefined') return false;

    const host = (window.location.hostname || '').toLowerCase();
    const isCanvasSandbox = host.includes('googleusercontent.com') || host.includes('scf.usercontent.goog');
    if (!isCanvasSandbox && (window.location.protocol === 'https:' || host === 'localhost' || host === '127.0.0.1')) {
        return true;
    }

    try {
        const testWs = new window.WebSocket('wss://0.peerjs.com:443/peerjs');
        testWs.close();
        return true;
    } catch (err) {
        return false;
    }
}

/**
 * WebRTC P2P transport backed by PeerJS.
 */
export function createPeerTransport({ onMessage, onPlayerDisconnect, onHostDisconnect }) {
    let peer = null;
    let hostConnection = null;
    let heartbeatTimer = null;
    let isHostMode = false;
    let destroyed = false;
    const guestConnections = new Map();

    function startHeartbeat() {
        stopHeartbeat();
        heartbeatTimer = setInterval(() => {
            if (destroyed) return;
            if (isHostMode) {
                guestConnections.forEach(conn => {
                    if (conn && conn.open) {
                        try { conn.send({ type: 'PING', t: Date.now() }); } catch (e) {}
                    }
                });
            } else if (hostConnection && hostConnection.open) {
                try { hostConnection.send({ type: 'PING', t: Date.now() }); } catch (e) {}
            }
        }, HEARTBEAT_INTERVAL_MS);
    }

    function stopHeartbeat() {
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
        }
    }

    function attachGuestConnection(conn) {
        conn.on('data', (msg) => {
            if (destroyed || !msg || typeof msg !== 'object') return;
            if (msg.type === 'PING') {
                try { conn.send({ type: 'PONG', t: Date.now() }); } catch (e) {}
                return;
            }
            if (msg.type === 'JOIN_REQUEST' && msg.playerId) {
                conn.playerId = msg.playerId;
                guestConnections.set(msg.playerId, conn);
            }
            onMessage?.(msg, { senderId: conn.playerId || msg.playerId });
        });

        conn.on('close', () => {
            const pId = conn.playerId;
            if (pId && guestConnections.get(pId) === conn) {
                guestConnections.delete(pId);
                if (!destroyed) onPlayerDisconnect?.(pId);
            }
        });
    }

    function createHostSession(roomCode) {
        isHostMode = true;
        const peerId = `${ROOM_PREFIX}${roomCode}`;

        return new Promise((resolve) => {
            let settled = false;
            const finish = (result) => {
                if (settled) return;
                settled = true;
                resolve(result);
            };

            try {
                peer = new window.Peer(peerId, PEER_CONFIG);
            } catch (err) {
                finish({ ok: false, fallbackLocal: true });
                return;
            }

            const openTimer = setTimeout(() => {
                if (!settled) {
                    destroy();
                    finish({ ok: false, fallbackLocal: true, modeLabel: 'Modo Local' });
                }
            }, HOST_OPEN_TIMEOUT_MS);

            peer.on('open', () => {
                clearTimeout(openTimer);
                if (destroyed) return;
                startHeartbeat();
                finish({ ok: true, modeLabel: 'Online P2P Activo' });
            });

            peer.on('connection', attachGuestConnection);

            peer.on('disconnected', () => {
                if (!destroyed && peer && !peer.destroyed) {
                    try { peer.reconnect(); } catch (e) {}
                }
            });

            peer.on('error', (err) => {
                clearTimeout(openTimer);
                if (err && err.type === 'unavailable-id') {
                    destroy();
                    finish({ ok: false, retryCode: true });
                    return;
                }
                if (!settled) {
                    destroy();
                    finish({ ok: false, fallbackLocal: true, modeLabel: 'Vista Previa' });
                }
            });
        });
    }

    function joinGuestSession(roomCode, { playerId, name }) {
        isHostMode = false;

        return new Promise((resolve) => {
            let settled = false;
            const finish = (result) => {
                if (settled) return;
                settled = true;
                resolve(result);
            };

            try {
                peer = new window.Peer(undefined, PEER_CONFIG);
            } catch (err) {
                finish({ ok: false, reason: 'PEER_INIT_FAILED' });
                return;
            }

            const connectTimer = setTimeout(() => {
                if (!settled) {
                    destroy();
                    finish({
                        ok: false,
                        reason: `No se encontró la sala ${roomCode}. Verifica que el líder la tenga abierta.`
                    });
                }
            }, GUEST_CONNECT_TIMEOUT_MS);

            peer.on('open', () => {
                if (destroyed) return;
                const conn = peer.connect(`${ROOM_PREFIX}${roomCode}`, { reliable: true });
                hostConnection = conn;

                conn.on('open', () => {
                    clearTimeout(connectTimer);
                    if (destroyed) return;
                    startHeartbeat();
                    conn.send({ type: 'JOIN_REQUEST', playerId, name });
                    finish({ ok: true, modeLabel: 'Online P2P' });
                });

                conn.on('data', (msg) => {
                    if (destroyed || !msg || typeof msg !== 'object') return;
                    if (msg.type === 'PING') {
                        try { conn.send({ type: 'PONG', t: Date.now() }); } catch (e) {}
                        return;
                    }
                    onMessage?.(msg, { senderId: 'host' });
                });

                conn.on('close', () => {
                    clearTimeout(connectTimer);
                    if (!destroyed) {
                        if (!settled) {
                            finish({ ok: false, reason: 'Se cerró la conexión con el líder de la sala' });
                        } else {
                            onHostDisconnect?.('Se cerró la conexión con el líder de la sala');
                        }
                    }
                });

                conn.on('error', () => {
                    clearTimeout(connectTimer);
                    if (!destroyed) {
                        if (!settled) {
                            finish({ ok: false, reason: 'Error de comunicación con la sala' });
                        } else {
                            onHostDisconnect?.('Error de comunicación con la sala');
                        }
                    }
                });
            });

            peer.on('error', () => {
                clearTimeout(connectTimer);
                if (!settled) {
                    destroy();
                    finish({
                        ok: false,
                        reason: `No se encontró la sala ${roomCode} o el líder no está conectado.`
                    });
                }
            });
        });
    }

    function sendToHost(message) {
        if (hostConnection && hostConnection.open) {
            try { hostConnection.send(message); } catch (e) {}
        }
    }

    function sendToPlayer(playerId, message) {
        const conn = guestConnections.get(playerId);
        if (conn && conn.open) {
            try { conn.send(message); } catch (e) {}
        }
    }

    function broadcast(message) {
        guestConnections.forEach(conn => {
            if (conn && conn.open) {
                try { conn.send(message); } catch (e) {}
            }
        });
    }

    function destroy() {
        if (destroyed) return;
        destroyed = true;
        stopHeartbeat();
        if (hostConnection) {
            try { hostConnection.close(); } catch (e) {}
            hostConnection = null;
        }
        guestConnections.forEach(conn => {
            try { conn.close(); } catch (e) {}
        });
        guestConnections.clear();
        if (peer) {
            try { peer.destroy(); } catch (e) {}
            peer = null;
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

