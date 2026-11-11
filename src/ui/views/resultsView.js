import {
    DEFAULT_GUESS_HEX,
    DEFAULT_TARGET_HEX,
    DEFAULT_TOTAL_ROUNDS
} from '../../config/constants.js';
import { calculateSimilarity } from '../../domain/color.js';
import { buildScoringRuleSummary, formatScore } from '../../domain/scoring.js';
import { escapeHtml, setElementVisible } from '../utils/dom.js';

/**
 * Manages the per-round similarity comparison and host advance controls.
 */
export function createResultsView({ onNextRound }) {
    const roundNumEl = document.getElementById('res-round-num');
    const totalRoundsEl = document.getElementById('res-total-rounds');
    const targetSwatch = document.getElementById('res-target-swatch');
    const targetHexEl = document.getElementById('res-target-hex');
    const ruleNote = document.getElementById('res-scoring-rule-note');
    const headlineEl = document.getElementById('res-headline');
    const playersListEl = document.getElementById('res-players-list');
    const hostControls = document.getElementById('host-next-round-controls');
    const guestWait = document.getElementById('guest-next-round-wait');
    const nextBtnText = document.getElementById('btn-next-round-text');
    const customHexWrap = document.getElementById('next-round-custom-hex-wrap');
    const customHexInput = document.getElementById('next-round-custom-hex');

    document.getElementById('btn-next-round')?.addEventListener('click', () => {
        const customHex = customHexInput?.value.trim() || '';
        if (customHexInput && customHex) {
            customHexInput.value = '';
        }
        onNextRound(customHex);
    });

    function render(state) {
        const room = state.roomData;
        if (!room) return;

        const isHost = room.hostId === state.uid;
        const roundIdx = room.currentRound || 0;
        const totalRounds = room.totalRounds || DEFAULT_TOTAL_ROUNDS;
        const targetHex = room.currentTargetHex || room.roundTargets?.[roundIdx] || DEFAULT_TARGET_HEX;
        const guesses = room.guesses || {};
        const playersList = Object.values(room.players || {}).sort((a, b) => a.joinedAt - b.joinedAt);

        if (roundNumEl) roundNumEl.textContent = roundIdx + 1;
        if (totalRoundsEl) totalRoundsEl.textContent = totalRounds;
        if (targetSwatch) targetSwatch.style.backgroundColor = targetHex;
        if (targetHexEl) targetHexEl.textContent = targetHex;
        if (ruleNote) ruleNote.textContent = `(${buildScoringRuleSummary()})`;

        const resultsList = playersList.map(p => {
            const g = guesses[p.id] || { hex: DEFAULT_GUESS_HEX };
            const sim = Number((typeof g.similarity === 'number'
                ? g.similarity
                : calculateSimilarity(targetHex, g.hex)).toFixed(1));
            return {
                ...p,
                guessHex: g.hex,
                similarity: sim,
                pointsEarned: typeof g.pointsEarned === 'number' ? g.pointsEarned : sim
            };
        }).sort((a, b) => b.similarity - a.similarity);

        const topWinner = resultsList[0];
        if (topWinner && headlineEl) {
            headlineEl.innerHTML = `¡<span class="underline decoration-hrYellow decoration-4">${escapeHtml(topWinner.name)}</span> logró ${topWinner.similarity.toFixed(1)}% (+${topWinner.similarity.toFixed(1)} pts)!`;
        }

        if (playersListEl) {
            playersListEl.innerHTML = '';
            resultsList.forEach((item, idx) => {
                const isFirstPlace = idx === 0;
                const ptsText = formatScore(Number(item.pointsEarned.toFixed(1)));

                const row = document.createElement('div');
                row.className = `p-4 rounded-2xl border-2 border-hrInk flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 ${
                    isFirstPlace ? 'bg-hrYellow shadow-[0_3px_0_#111111]' : 'bg-[#FAF9F5]'
                }`;

                row.innerHTML = `
                    <div class="flex items-center gap-3.5 min-w-[210px]">
                        <div class="w-10 h-10 rounded-full ${isFirstPlace ? 'bg-white text-hrInk' : 'bg-neutral-200 text-neutral-700'} border-[1.5px] border-hrInk font-black flex items-center justify-center text-sm flex-shrink-0">
                            #${idx + 1}
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="font-extrabold text-base text-hrInk">${escapeHtml(item.name)}</span>
                                <span class="px-2.5 py-0.5 rounded-full text-[11px] font-black ${isFirstPlace ? 'bg-[#28CD41] text-hrInk' : 'bg-white text-hrInk'} border border-hrInk">+${ptsText} PTS</span>
                            </div>
                            <div class="text-xs font-medium text-neutral-700">
                                Marcador acumulado: <strong class="font-mono font-black">${formatScore(item.score)} pts</strong>
                            </div>
                        </div>
                    </div>

                    <div class="flex-grow max-w-md w-full">
                        <div class="h-12 rounded-xl overflow-hidden flex border-2 border-hrInk relative">
                            <div class="w-1/2 h-full flex items-center justify-start pl-3 text-[11px] font-mono font-bold" style="background-color: ${targetHex};">
                                <span class="px-2 py-0.5 rounded bg-white text-hrInk border border-hrInk">REF ${targetHex}</span>
                            </div>
                            <div class="w-1/2 h-full flex items-center justify-end pr-3 text-[11px] font-mono font-bold" style="background-color: ${item.guessHex};">
                                <span class="px-2 py-0.5 rounded bg-white text-hrInk border border-hrInk">${item.guessHex}</span>
                            </div>
                            <div class="absolute inset-y-0 left-1/2 w-0.5 bg-hrInk"></div>
                        </div>
                    </div>

                    <div class="text-right min-w-[110px]">
                        <div class="font-mono font-black text-2xl text-hrInk">
                            ${item.similarity.toFixed(1)}%
                        </div>
                        <span class="text-[10px] uppercase tracking-wider text-neutral-600 font-bold">Similitud</span>
                    </div>
                `;
                playersListEl.appendChild(row);
            });
        }

        const isLastRound = roundIdx + 1 >= totalRounds;
        if (nextBtnText) {
            nextBtnText.textContent = isLastRound
                ? 'Ver Podio Final (Fin de Partida)'
                : `Iniciar Ronda ${roundIdx + 2} de ${totalRounds}`;
        }
        setElementVisible(customHexWrap, !isLastRound);
        setElementVisible(hostControls, isHost);
        setElementVisible(guestWait, !isHost);
    }

    return { render };
}

