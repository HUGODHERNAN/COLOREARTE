import {
    DEFAULT_GUESS_HEX,
    DEFAULT_TOTAL_ROUNDS,
    GUESS_DURATION_MS
} from '../../config/constants.js';
import { createColorPicker } from '../components/colorPicker.js';

/**
 * Manages the 20-second blind color reconstruction view and countdown timer.
 */
export function createGuessView({ onSubmitGuess, onGuessTimeout }) {
    const roundNumEl = document.getElementById('guess-round-num');
    const totalRoundsEl = document.getElementById('guess-total-rounds');
    const timerDisplay = document.getElementById('guess-timer-display');
    const progressBar = document.getElementById('guess-progress-bar');
    const readyCountEl = document.getElementById('guess-ready-count');
    const submitBtn = document.getElementById('btn-submit-guess');

    const colorPicker = createColorPicker();
    let timerInterval = null;
    let finalizeTimeout = null;
    let renderedRound = -1;
    let hasSubmitted = false;

    function clearTimers() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        if (finalizeTimeout) {
            clearTimeout(finalizeTimeout);
            finalizeTimeout = null;
        }
    }

    function lockSubmission(isAutoTimeout = false) {
        if (hasSubmitted) return;
        hasSubmitted = true;
        colorPicker.lock();

        const selectedHex = colorPicker.getHex();
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.className = 'w-full sm:w-auto px-8 py-4 rounded-full font-bold text-base bg-[#28CD41] text-hrInk border-2 border-hrInk flex items-center justify-center gap-2 cursor-not-allowed';
            submitBtn.innerHTML = `<i class="fa-solid fa-lock"></i><span>Color Fijado (${selectedHex})</span>`;
        }

        onSubmitGuess(selectedHex, isAutoTimeout);
    }

    submitBtn?.addEventListener('click', () => lockSubmission(false));

    function render(state) {
        const room = state.roomData;
        if (!room) return;

        const roundIdx = room.currentRound || 0;
        const totalRounds = room.totalRounds || DEFAULT_TOTAL_ROUNDS;
        const isHost = room.hostId === state.uid;
        const players = Object.values(room.players || {});
        const activePlayers = players.filter(p => p.connected !== false);
        const guesses = room.guesses || {};

        if (readyCountEl) {
            readyCountEl.textContent = `${Object.keys(guesses).length}/${activePlayers.length || players.length}`;
        }

        if (renderedRound === roundIdx) return;
        renderedRound = roundIdx;

        clearTimers();
        hasSubmitted = Boolean(guesses[state.uid]);
        if (roundNumEl) roundNumEl.textContent = roundIdx + 1;
        if (totalRoundsEl) totalRoundsEl.textContent = totalRounds;

        colorPicker.reset();
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.className = 'w-full sm:w-auto px-8 py-4 hr-pill-yellow font-black text-base flex items-center justify-center gap-2';
            submitBtn.innerHTML = '<i class="fa-solid fa-check-double"></i><span>¡Confirmar y Enviar Tono!</span>';
        }

        const endTime = room.localPhaseEndTime || room.phaseEndTime || (Date.now() + GUESS_DURATION_MS);

        timerInterval = setInterval(() => {
            const remainingMs = Math.max(0, endTime - Date.now());
            const remainingSec = (remainingMs / 1000).toFixed(1);
            const pct = Math.max(0, Math.min(100, (remainingMs / GUESS_DURATION_MS) * 100));

            if (timerDisplay) timerDisplay.textContent = `${remainingSec}s`;
            if (progressBar) progressBar.style.width = `${pct}%`;

            if (remainingMs <= 0) {
                clearTimers();
                if (!hasSubmitted) {
                    lockSubmission(true);
                }
                if (isHost) {
                    finalizeTimeout = setTimeout(() => onGuessTimeout(), 450);
                }
            }
        }, 80);
    }

    function getCurrentHex() {
        return colorPicker.getHex() || DEFAULT_GUESS_HEX;
    }

    function unmount() {
        clearTimers();
        renderedRound = -1;
        hasSubmitted = false;
    }

    return { render, unmount, getCurrentHex };
}

