import { ALLOWED_ROUNDS, DEFAULT_TOTAL_ROUNDS } from '../../config/constants.js';
import { setElementVisible } from '../utils/dom.js';

/**
 * Controls the top navigation header badges, P2P status indicator, and room actions.
 */
export function createHeader({ onCopyRoomCode, onLeaveRoom }) {
    const p2pBadge = document.getElementById('header-p2p-status');
    const p2pDot = document.getElementById('p2p-dot');
    const p2pLabel = document.getElementById('p2p-status-text');
    const controlsRow = document.getElementById('header-controls-row');
    const rulesSummary = document.getElementById('header-rules-summary');
    const roomBadge = document.getElementById('header-room-badge');
    const roomCodeEl = document.getElementById('header-room-code');
    const userBadge = document.getElementById('header-user-badge');
    const usernameEl = document.getElementById('header-username');
    const copyRoomBtn = document.getElementById('btn-copy-room-code');
    const leaveBtn = document.getElementById('btn-leave-room');

    copyRoomBtn?.addEventListener('click', () => onCopyRoomCode());
    leaveBtn?.addEventListener('click', () => onLeaveRoom());

    function renderP2PBadge(badge) {
        if (!badge) {
            setElementVisible(p2pBadge, false, true);
            return;
        }
        setElementVisible(p2pBadge, true, true);
        p2pLabel.textContent = badge.text || 'P2P Activo';

        if (badge.state === 'connecting') {
            p2pDot.className = 'w-2.5 h-2.5 rounded-full bg-[#FF9500] border border-hrInk animate-ping';
        } else if (badge.state === 'connected') {
            p2pDot.className = 'w-2.5 h-2.5 rounded-full bg-[#28CD41] border border-hrInk';
        } else {
            p2pDot.className = 'w-2.5 h-2.5 rounded-full bg-[#FF3B30] border border-hrInk';
        }
    }

    function render(state) {
        renderP2PBadge(state.p2pBadge);

        const hasUser = Boolean(state.nickname);
        setElementVisible(controlsRow, hasUser, true);
        setElementVisible(userBadge, hasUser, true);
        if (hasUser && usernameEl) {
            usernameEl.textContent = state.nickname;
        }

        const inRoom = Boolean(state.currentRoomCode);
        setElementVisible(roomBadge, inRoom, true);
        setElementVisible(leaveBtn, inRoom, true);
        if (inRoom && roomCodeEl) {
            roomCodeEl.textContent = state.currentRoomCode;
        }

        if (rulesSummary && state.roomData) {
            const totalRounds = ALLOWED_ROUNDS.includes(Number(state.roomData.totalRounds))
                ? Number(state.roomData.totalRounds)
                : DEFAULT_TOTAL_ROUNDS;
            rulesSummary.textContent = `5s Ver · 20s Buscar · ${totalRounds} Rondas`;
        }
    }

    return { render };
}

