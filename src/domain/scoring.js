import { DEFAULT_GUESS_HEX } from '../config/constants.js';
import { calculateSimilarity, normalizeHex } from './color.js';

/**
 * Formats a numeric score with 1 fixed decimal place.
 */
export function formatScore(val) {
    const num = Number(val || 0);
    return num.toFixed(1);
}

/**
 * Returns the human-readable scoring rule summary displayed in Lobby and Results.
 */
export function buildScoringRuleSummary() {
    return 'Puntaje justo: Tu % de similitud suma directo en decimal (ej: 85.9% = +85.9 pts)';
}

/**
 * Scores and ranks all player guesses against the round target HEX color.
 */
export function scoreRound(targetHex, playerIds, guessesMap = {}) {
    const entries = playerIds.map(pid => {
        const rawGuess = guessesMap[pid]?.hex;
        const gHex = normalizeHex(rawGuess) || DEFAULT_GUESS_HEX;
        const similarity = Number(calculateSimilarity(targetHex, gHex).toFixed(1));
        return {
            playerId: pid,
            hex: gHex,
            similarity,
            pointsEarned: similarity
        };
    });

    entries.sort((a, b) => b.similarity - a.similarity);

    return entries.map((item, index) => ({
        ...item,
        rank: index + 1
    }));
}

/**
 * Sorts players for the final podium by total score descending, using totalAccuracy as tie-breaker.
 */
export function sortFinalStandings(playersList) {
    return [...playersList].sort((a, b) => {
        if ((b.score || 0) !== (a.score || 0)) {
            return (b.score || 0) - (a.score || 0);
        }
        return (b.totalAccuracy || 0) - (a.totalAccuracy || 0);
    });
}

/**
 * Calculates formatted average accuracy percentage for a player across played rounds.
 */
export function getAverageAccuracy(player) {
    if (!player || !player.roundsPlayed) return '0.0';
    return ((player.totalAccuracy || 0) / player.roundsPlayed).toFixed(1);
}

