import { DEFAULT_TOTAL_ROUNDS } from '../../config/constants.js';
import { formatScore, getAverageAccuracy, sortFinalStandings } from '../../domain/scoring.js';
import { escapeHtml, setElementVisible } from '../utils/dom.js';

/**
 * Manages the final podium view and rematch / summary actions.
 */
export function createGameOverView({ onCopySummary, onReturnToLobby }) {
    const completedBadge = document.getElementById('final-completed-badge');
    const winnerTitle = document.getElementById('final-winner-title');
    const standingsList = document.getElementById('final-standings-list');
    const rematchBtn = document.getElementById('btn-host-rematch');

    document.getElementById('btn-copy-final-summary')?.addEventListener('click', () => onCopySummary());
    rematchBtn?.addEventListener('click', () => onReturnToLobby());

    function render(state) {
        const room = state.roomData;
        if (!room) return;

        const isHost = room.hostId === state.uid;
        const totalRounds = room.totalRounds || DEFAULT_TOTAL_ROUNDS;
        const playersList = Object.values(room.players || {});

        if (completedBadge) {
            completedBadge.textContent = `¡Partida de ${totalRounds} Rondas Completada!`;
        }

        const sorted = sortFinalStandings(playersList);
        const champion = sorted[0];
        if (champion && winnerTitle) {
            winnerTitle.innerHTML = `🏆 ¡${escapeHtml(champion.name)} gana con ${formatScore(champion.score)} puntos!`;
        }

        if (standingsList) {
            standingsList.innerHTML = '';
            const medals = ['🥇', '🥈', '🥉'];
            sorted.forEach((p, idx) => {
                const card = document.createElement('div');
                card.className = `p-4 sm:p-5 rounded-2xl border-2 border-hrInk flex items-center justify-between gap-4 ${
                    idx === 0 ? 'bg-hrYellow shadow-[0_4px_0_#111111]' : 'bg-[#FAF9F5]'
                }`;

                card.innerHTML = `
                    <div class="flex items-center gap-4">
                        <span class="text-2xl font-black w-10 text-center">${medals[idx] || `${idx + 1}°`}</span>
                        <div>
                            <div class="font-black text-lg text-hrInk">${escapeHtml(p.name)}</div>
                            <div class="text-xs font-medium text-neutral-700">Precisión promedio en ${totalRounds} rondas: <strong class="font-mono font-bold">${getAverageAccuracy(p)}%</strong></div>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="font-mono font-black text-2xl sm:text-3xl text-hrInk">${formatScore(p.score)}</span>
                        <span class="block text-[10px] font-bold uppercase tracking-wider text-neutral-600">Puntos</span>
                    </div>
                `;
                standingsList.appendChild(card);
            });
        }

        setElementVisible(rematchBtn, isHost, true);
    }

    return { render };
}

