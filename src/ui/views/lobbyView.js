import {
    ALLOWED_ROUNDS,
    DEFAULT_TOTAL_ROUNDS,
    SOLID_AVATAR_COLORS
} from '../../config/constants.js';
import { buildScoringRuleSummary } from '../../domain/scoring.js';
import { escapeHtml, setElementVisible } from '../utils/dom.js';

/**
 * Manages the room lobby view: invite controls, dynamic player grid, and host settings.
 */
export function createLobbyView({
    onCopyRoomCode,
    onCopyInviteLink,
    onShareWhatsApp,
    onSelectRounds,
    onAddBot,
    onRemoveBot,
    onStartGame
}) {
    const roomCodeEl = document.getElementById('lobby-room-code');
    const playerCountEl = document.getElementById('lobby-player-count');
    const hostNameEl = document.getElementById('lobby-host-name');
    const startBtnLabel = document.getElementById('btn-start-game-label');
    const guestRoundsCount = document.getElementById('guest-lobby-rounds-count');
    const guestRoundsPill = document.getElementById('guest-rounds-pill');
    const ruleBadge = document.getElementById('lobby-scoring-rule-badge');
    const playersGrid = document.getElementById('lobby-players-grid');
    const hostControls = document.getElementById('host-lobby-controls');
    const guestWait = document.getElementById('guest-lobby-wait');
    const roundSelectorGroup = document.getElementById('round-selector-group');
    const customColorsInput = document.getElementById('host-custom-colors');

    document.getElementById('btn-lobby-copy-code')?.addEventListener('click', () => onCopyRoomCode());
    document.getElementById('btn-lobby-copy-link')?.addEventListener('click', () => onCopyInviteLink());
    document.getElementById('btn-lobby-whatsapp')?.addEventListener('click', () => onShareWhatsApp());
    document.getElementById('btn-add-bot')?.addEventListener('click', () => onAddBot());
    document.getElementById('btn-start-game')?.addEventListener('click', () => {
        onStartGame(customColorsInput?.value.trim() || '');
    });

    roundSelectorGroup?.addEventListener('click', (e) => {
        const btn = e.target.closest('.round-opt-btn');
        if (!btn) return;
        const rounds = Number(btn.getAttribute('data-rounds'));
        if (rounds) onSelectRounds(rounds);
    });

    playersGrid?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="remove-bot"]');
        if (!btn) return;
        const botId = btn.getAttribute('data-bot-id');
        if (botId) onRemoveBot(botId);
    });

    function renderPlayersGrid(playersList, currentUid, isHost) {
        if (!playersGrid) return;
        playersGrid.innerHTML = '';

        playersList.forEach((p, i) => {
            const slot = document.createElement('div');
            const isMe = p.id === currentUid;
            const colorIdx = i % SOLID_AVATAR_COLORS.length;
            const avatarColor = SOLID_AVATAR_COLORS[colorIdx];
            const avatarText = (colorIdx === 1 || colorIdx === 2 || colorIdx === 5) ? '#FFFFFF' : '#111111';

            slot.className = `p-4 rounded-2xl border-2 border-hrInk flex items-center justify-between animate-pop ${
                isMe ? 'bg-hrYellow shadow-[0_3px_0_#111111]' : 'bg-[#FAF9F5]'
            }`;
            slot.innerHTML = `
                <div class="flex items-center gap-3 truncate">
                    <div class="w-10 h-10 rounded-full border-[1.5px] border-hrInk font-black flex items-center justify-center text-sm flex-shrink-0" style="background-color: ${avatarColor}; color: ${avatarText};">
                        ${escapeHtml(p.name.charAt(0).toUpperCase())}
                    </div>
                    <div class="truncate">
                        <div class="font-bold text-sm text-hrInk flex items-center gap-1.5 truncate">
                            <span>${escapeHtml(p.name)}</span>
                            ${isMe ? '<span class="text-[10px] px-2 py-0.5 rounded-full bg-white border border-hrInk font-black">TÚ</span>' : ''}
                        </div>
                        <div class="text-[11px] font-medium text-neutral-600">
                            ${p.isHost ? '<i class="fa-solid fa-crown mr-1"></i>Líder de Sala' : (p.isBot ? '<i class="fa-solid fa-robot mr-1"></i>Bot IA' : `Jugador #${i + 1}`)}
                        </div>
                    </div>
                </div>
                ${isHost && p.isBot ? `
                    <button type="button" data-action="remove-bot" data-bot-id="${escapeHtml(p.id)}" class="w-7 h-7 rounded-full bg-white border border-hrInk text-hrInk hover:bg-[#FF3B30] hover:text-white text-xs flex items-center justify-center" title="Quitar Bot">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                ` : '<span class="w-3 h-3 rounded-full bg-[#28CD41] border border-hrInk mr-1"></span>'}
            `;
            playersGrid.appendChild(slot);
        });

        const waitingSlot = document.createElement('div');
        waitingSlot.className = 'p-4 rounded-2xl border-2 border-dashed border-neutral-300 bg-[#FAF9F5]/50 flex items-center justify-center text-xs text-neutral-400 font-semibold h-[74px]';
        waitingSlot.innerHTML = `<i class="fa-solid fa-user-plus mr-2"></i> Esperando jugador #${playersList.length + 1}...`;
        playersGrid.appendChild(waitingSlot);
    }

    function render(state) {
        const room = state.roomData;
        if (!room) return;

        const isHost = room.hostId === state.uid;
        const playersList = Object.values(room.players || {}).sort((a, b) => a.joinedAt - b.joinedAt);
        const selectedRounds = ALLOWED_ROUNDS.includes(Number(room.totalRounds))
            ? Number(room.totalRounds)
            : DEFAULT_TOTAL_ROUNDS;

        if (roomCodeEl) roomCodeEl.textContent = room.code;
        if (playerCountEl) playerCountEl.textContent = playersList.length;
        if (hostNameEl) hostNameEl.textContent = room.hostName || 'Líder';
        if (startBtnLabel) startBtnLabel.textContent = `¡Iniciar Partida (${selectedRounds} Rondas)!`;
        if (guestRoundsCount) guestRoundsCount.textContent = selectedRounds;
        if (guestRoundsPill) guestRoundsPill.textContent = `${selectedRounds} Rondas`;

        document.querySelectorAll('.round-opt-btn').forEach(btn => {
            const rVal = Number(btn.getAttribute('data-rounds'));
            btn.className = rVal === selectedRounds
                ? 'round-opt-btn px-3.5 py-1.5 hr-pill-yellow text-xs font-black'
                : 'round-opt-btn px-3.5 py-1.5 hr-pill-white text-xs font-bold';
        });

        if (ruleBadge) {
            ruleBadge.textContent = buildScoringRuleSummary();
            ruleBadge.className = 'text-xs font-bold px-3.5 py-1 rounded-full bg-hrYellow text-hrInk border border-hrInk';
        }

        renderPlayersGrid(playersList, state.uid, isHost);
        setElementVisible(hostControls, isHost);
        setElementVisible(guestWait, !isHost);
    }

    return { render };
}

