import {
    DEFAULT_TARGET_HEX,
    DEFAULT_TOTAL_ROUNDS,
    MEMORIZE_DURATION_MS
} from '../../config/constants.js';

/**
 * Manages the 5-second color memorization countdown view.
 */
export function createMemorizeView({ onMemorizeTimeout }) {
    const roundNumEl = document.getElementById('mem-round-num');
    const totalRoundsEl = document.getElementById('mem-total-rounds');
    const colorBox = document.getElementById('memorize-color-box');
    const timerText = document.getElementById('mem-timer-text');
    const bigCountdown = document.getElementById('mem-big-countdown');
    const progressBar = document.getElementById('mem-progress-bar');

    let timerInterval = null;
    let renderedRound = -1;

    function clearTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    function render(state) {
        const room = state.roomData;
        if (!room) return;

        const roundIdx = room.currentRound || 0;
        if (renderedRound === roundIdx) return;
        renderedRound = roundIdx;

        clearTimer();
        const isHost = room.hostId === state.uid;
        const totalRounds = room.totalRounds || DEFAULT_TOTAL_ROUNDS;
        const targetHex = room.currentTargetHex || room.roundTargets?.[roundIdx] || DEFAULT_TARGET_HEX;

        if (roundNumEl) roundNumEl.textContent = roundIdx + 1;
        if (totalRoundsEl) totalRoundsEl.textContent = totalRounds;
        if (colorBox) colorBox.style.backgroundColor = targetHex;

        const endTime = room.localPhaseEndTime || room.phaseEndTime || (Date.now() + MEMORIZE_DURATION_MS);

        timerInterval = setInterval(() => {
            const remainingMs = Math.max(0, endTime - Date.now());
            const remainingSec = (remainingMs / 1000).toFixed(1);
            const pct = Math.max(0, Math.min(100, (remainingMs / MEMORIZE_DURATION_MS) * 100));

            if (timerText) timerText.textContent = `${remainingSec}s`;
            if (bigCountdown) bigCountdown.textContent = remainingSec;
            if (progressBar) progressBar.style.width = `${pct}%`;

            if (remainingMs <= 0) {
                clearTimer();
                if (isHost) onMemorizeTimeout();
            }
        }, 60);
    }

    function unmount() {
        clearTimer();
        renderedRound = -1;
    }

    return { render, unmount };
}

