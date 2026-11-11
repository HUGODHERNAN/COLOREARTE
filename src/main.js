import { DEFAULT_TOTAL_ROUNDS } from './config/constants.js';
import {
    addBotPlayer,
    advanceToNextRound,
    areAllPlayersReady,
    createInitialRoom,
    finalizeRound,
    recordGuess,
    removeBotPlayer,
    removePlayerInLobby,
    returnToLobby,
    sanitizeRoomForGuest,
    setPlayerConnection,
    startMatch,
    transitionToGuessPhase,
    updateTotalRounds,
    upsertPlayer
} from './domain/gameEngine.js';
import { formatScore, getAverageAccuracy, sortFinalStandings } from './domain/scoring.js';
import { createTransportManager } from './network/createTransport.js';
import { setupPwaInstall } from './pwa/installPrompt.js';
import { createRoomStore } from './state/roomStore.js';
import { createHeader } from './ui/components/header.js';
import { createToast } from './ui/components/toast.js';
import { copyText } from './ui/utils/clipboard.js';
import { createViewManager } from './ui/viewManager.js';
import { createGameOverView } from './ui/views/gameOverView.js';
import { createGuessView } from './ui/views/guessView.js';
import { createLoadingView } from './ui/views/loadingView.js';
import { createLobbyView } from './ui/views/lobbyView.js';
import { createMenuView } from './ui/views/menuView.js';
import { createMemorizeView } from './ui/views/memorizeView.js';
import { createRegisterView } from './ui/views/registerView.js';
import { createResultsView } from './ui/views/resultsView.js';

function bootstrap() {
    const showToast = createToast();
    const store = createRoomStore();

    setupPwaInstall({ showToast });

    const transport = createTransportManager({
        onMessage: (msg) => {
            const state = store.getState();
            if (state.isHost) {
                handleHostIncomingMessage(msg);
            } else {
                handleGuestIncomingMessage(msg);
            }
        },
        onPlayerDisconnect: (playerId) => {
            const state = store.getState();
            if (!state.isHost || !state.roomData) return;

            if (state.roomData.status === 'lobby') {
                const res = removePlayerInLobby(state.roomData, playerId);
                if (res.removedPlayer) {
                    showToast(`${res.removedPlayer.name} salió de la sala`, 'warning');
                    commitAndBroadcastHostRoom(res.room);
                }
            } else {
                const res = setPlayerConnection(state.roomData, playerId, false);
                if (res.updated) {
                    commitAndBroadcastHostRoom(res.room);
                }
            }
        },
        onHostDisconnect: (reason) => {
            showToast(reason || 'Se cerró la conexión con el líder de la sala', 'warning');
            leaveRoom();
        }
    });

    function commitAndBroadcastHostRoom(room) {
        let nextRoom = room;
        if (nextRoom.status === 'guess' && areAllPlayersReady(nextRoom)) {
            const finalized = finalizeRound(nextRoom, {
                fallbackPlayerId: store.getState().uid,
                fallbackHex: guessView.getCurrentHex()
            });
            if (finalized.finalized) {
                nextRoom = finalized.room;
            }
        }

        store.setState({ roomData: nextRoom });
        transport.broadcast({
            type: 'STATE_SYNC',
            serverNow: Date.now(),
            roomData: sanitizeRoomForGuest(nextRoom)
        });
    }

    function handleHostIncomingMessage(msg) {
        const state = store.getState();
        const room = state.roomData;
        if (!room || !msg || typeof msg !== 'object') return;

        if (msg.type === 'JOIN_REQUEST') {
            const res = upsertPlayer(room, {
                playerId: msg.playerId,
                name: msg.name
            });
            if (res.isNewPlayer) {
                showToast(`${res.playerName} se unió a la sala`);
            }
            transport.sendToPlayer(msg.playerId, {
                type: 'STATE_SYNC',
                serverNow: Date.now(),
                roomData: sanitizeRoomForGuest(res.room)
            });
            commitAndBroadcastHostRoom(res.room);
        } else if (msg.type === 'REQUEST_SYNC' && msg.playerId) {
            transport.sendToPlayer(msg.playerId, {
                type: 'STATE_SYNC',
                serverNow: Date.now(),
                roomData: sanitizeRoomForGuest(room)
            });
        } else if (msg.type === 'SUBMIT_GUESS') {
            const res = recordGuess(room, {
                playerId: msg.playerId,
                hex: msg.hex
            });
            if (res.accepted) {
                commitAndBroadcastHostRoom(res.room);
            }
        }
    }

    function handleGuestIncomingMessage(msg) {
        if (!msg || typeof msg !== 'object') return;

        if (msg.type === 'JOIN_REJECTED') {
            showToast(msg.reason || 'No se pudo entrar a la sala', 'error');
            leaveRoom();
            return;
        }

        if (msg.type === 'STATE_SYNC' && msg.roomData) {
            const room = { ...msg.roomData };
            if (msg.serverNow && room.phaseEndTime > msg.serverNow) {
                room.localPhaseEndTime = Date.now() + (room.phaseEndTime - msg.serverNow);
            } else {
                room.localPhaseEndTime = 0;
            }
            store.setState({ roomData: room, viewId: 'view-lobby' });
        }
    }

    function leaveRoom() {
        transport.destroy();
        store.resetRoomSession('view-menu');
    }

    async function handleCreateRoom() {
        const state = store.getState();
        store.setState({
            isHost: true,
            viewId: 'view-loading',
            loadingMessage: 'Creando sala en la red WebRTC...',
            p2pBadge: { state: 'connecting', text: 'Abriendo Sala...' }
        });

        const res = await transport.hostRoom({
            onOpening: (code) => {
                store.setState({ loadingMessage: `Creando sala ${code} en la red WebRTC...` });
            }
        });

        const initialRoom = createInitialRoom({
            code: res.roomCode,
            hostId: state.uid,
            hostName: state.nickname,
            totalRounds: DEFAULT_TOTAL_ROUNDS
        });

        store.setState({
            currentRoomCode: res.roomCode,
            viewId: 'view-lobby',
            p2pBadge: { state: 'connected', text: res.modeLabel }
        });
        commitAndBroadcastHostRoom(initialRoom);
        showToast(`¡Sala ${res.roomCode} creada! Comparte el link o añade Bots IA.`);
    }

    async function handleJoinRoom(rawCode) {
        const code = String(rawCode || '').trim().toUpperCase();
        if (code.length < 4) {
            showToast('Ingresa el código de 5 letras de la sala', 'warning');
            document.getElementById('input-join-code')?.focus();
            return;
        }

        const state = store.getState();
        store.setState({
            isHost: false,
            viewId: 'view-loading',
            loadingMessage: `Conectando con la sala ${code}...`,
            p2pBadge: { state: 'connecting', text: 'Conectando...' }
        });

        const res = await transport.joinRoom(code, {
            playerId: state.uid,
            name: state.nickname
        });

        if (!res.ok) {
            showToast(res.reason || `No se encontró la sala ${code}.`, res.reason?.includes('Vista Previa') ? 'warning' : 'error');
            leaveRoom();
            return;
        }

        store.setState({
            currentRoomCode: code,
            p2pBadge: { state: 'connected', text: res.modeLabel }
        });
    }

    function copyRoomCode() {
        const code = store.getState().currentRoomCode;
        if (!code) return;
        copyText(code, `¡Código ${code} copiado!`, showToast);
    }

    function copyInviteLink() {
        const code = store.getState().currentRoomCode;
        if (!code) return;
        const link = `${window.location.origin}${window.location.pathname}?room=${code}`;
        copyText(link, '¡Link directo de la sala copiado!', showToast);
    }

    function shareOnWhatsApp() {
        const code = store.getState().currentRoomCode;
        if (!code) return;
        const link = `${window.location.origin}${window.location.pathname}?room=${code}`;
        const text = `🎨 ¡Entra a mi sala de *ColorMatch*!\n🔑 Código de sala: *${code}*\n👉 Link directo: ${link}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    }

    function copyFinalSummary() {
        const room = store.getState().roomData;
        if (!room) return;
        const totalRounds = room.totalRounds || DEFAULT_TOTAL_ROUNDS;
        const players = sortFinalStandings(Object.values(room.players || {}));
        const medals = ['🥇', '🥈', '🥉'];

        let text = `🎨 *ColorMatch: Duelo de Memoria (${totalRounds} Rondas)*\n`;
        text += `🔑 Sala: ${room.code}\n\n`;
        players.forEach((p, i) => {
            text += `${medals[i] || `${i + 1}°`} *${p.name}*: ${formatScore(p.score)} pts (Precisión: ${getAverageAccuracy(p)}%)\n`;
        });
        copyText(text, '¡Resumen final copiado al portapapeles!', showToast);
    }

    const header = createHeader({
        onCopyRoomCode: copyRoomCode,
        onLeaveRoom: leaveRoom
    });

    const registerView = createRegisterView({
        onSubmitNickname: (rawName) => {
            const name = rawName.trim();
            if (!name) {
                showToast('Por favor escribe tu nombre o apodo para continuar', 'warning');
                document.getElementById('input-nickname')?.focus();
                return;
            }
            const nickname = name.slice(0, 16);
            localStorage.setItem('colormatch_nickname', nickname);
            store.setState({ nickname, viewId: 'view-menu' });

            const inviteCode = store.getState().pendingInviteCode;
            if (inviteCode) {
                menuView.prefillJoinCode(inviteCode);
                showToast(`Código ${inviteCode} listo. Pulsa "Entrar a la Sala"`);
            }
        }
    });

    const menuView = createMenuView({
        onCreateRoom: handleCreateRoom,
        onJoinRoom: handleJoinRoom,
        onChangeNickname: () => store.setState({ viewId: 'view-register' })
    });

    const lobbyView = createLobbyView({
        onCopyRoomCode: copyRoomCode,
        onCopyInviteLink: copyInviteLink,
        onShareWhatsApp: shareOnWhatsApp,
        onSelectRounds: (rounds) => {
            const { isHost, roomData } = store.getState();
            if (!isHost || !roomData) return;
            const res = updateTotalRounds(roomData, rounds);
            showToast(`Partida actualizada a ${res.totalRounds} rondas para toda la sala`);
            commitAndBroadcastHostRoom(res.room);
        },
        onAddBot: () => {
            const { isHost, roomData } = store.getState();
            if (!isHost || !roomData) return;
            const res = addBotPlayer(roomData);
            commitAndBroadcastHostRoom(res.room);
        },
        onRemoveBot: (botId) => {
            const { isHost, roomData } = store.getState();
            if (!isHost || !roomData) return;
            const res = removeBotPlayer(roomData, botId);
            if (res.removed) commitAndBroadcastHostRoom(res.room);
        },
        onStartGame: (customInput) => {
            const { isHost, roomData } = store.getState();
            if (!isHost || !roomData) return;
            const res = startMatch(roomData, { customInput });
            if (!res.ok) {
                showToast('Se necesitan al menos 2 jugadores (invita a un amigo o añade un Bot IA)', 'warning');
                return;
            }
            res.room.localPhaseEndTime = res.room.phaseEndTime;
            commitAndBroadcastHostRoom(res.room);
        }
    });

    const memorizeView = createMemorizeView({
        onMemorizeTimeout: () => {
            const { isHost, roomData } = store.getState();
            if (!isHost || roomData?.status !== 'memorize') return;
            const res = transitionToGuessPhase(roomData);
            res.room.localPhaseEndTime = res.room.phaseEndTime;
            commitAndBroadcastHostRoom(res.room);
        }
    });

    const guessView = createGuessView({
        onSubmitGuess: (hex, isAutoTimeout) => {
            if (!isAutoTimeout) {
                showToast(`¡Color ${hex} enviado!`);
            }
            const { isHost, roomData, uid } = store.getState();
            if (isHost && roomData) {
                const res = recordGuess(roomData, { playerId: uid, hex });
                if (res.accepted) commitAndBroadcastHostRoom(res.room);
            } else {
                transport.sendToHost({ type: 'SUBMIT_GUESS', playerId: uid, hex });
            }
        },
        onGuessTimeout: () => {
            const { isHost, roomData, uid } = store.getState();
            if (!isHost || !roomData || roomData.roundScored) return;
            const res = finalizeRound(roomData, {
                fallbackPlayerId: uid,
                fallbackHex: guessView.getCurrentHex()
            });
            if (res.finalized) commitAndBroadcastHostRoom(res.room);
        }
    });

    const resultsView = createResultsView({
        onNextRound: (customNextHex) => {
            const { isHost, roomData } = store.getState();
            if (!isHost || !roomData) return;
            const res = advanceToNextRound(roomData, { customNextHex });
            if (!res.isGameOver) {
                res.room.localPhaseEndTime = res.room.phaseEndTime;
            }
            commitAndBroadcastHostRoom(res.room);
        }
    });

    const gameOverView = createGameOverView({
        onCopySummary: copyFinalSummary,
        onReturnToLobby: () => {
            const { isHost, roomData } = store.getState();
            if (!isHost || !roomData) return;
            const res = returnToLobby(roomData);
            commitAndBroadcastHostRoom(res.room);
        }
    });

    const viewManager = createViewManager({
        header,
        views: {
            'view-loading': createLoadingView(),
            'view-register': registerView,
            'view-menu': menuView,
            'view-lobby': lobbyView,
            'view-memorize': memorizeView,
            'view-guess': guessView,
            'view-round-results': resultsView,
            'view-game-over': gameOverView
        }
    });

    store.subscribe(viewManager.render);

    const savedName = localStorage.getItem('colormatch_nickname');
    if (savedName) {
        registerView.hydrateSavedNickname(savedName);
    }

    const invitedRoom = new URLSearchParams(window.location.search).get('room');
    const pendingInviteCode = invitedRoom ? invitedRoom.trim().toUpperCase() : null;
    if (pendingInviteCode) {
        menuView.prefillJoinCode(pendingInviteCode);
    }

    store.setState({ pendingInviteCode, viewId: 'view-register' });
}

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', bootstrap);
} else {
    bootstrap();
}
