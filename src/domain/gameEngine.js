import {
    ALLOWED_ROUNDS,
    BOT_NAMES,
    DEFAULT_GUESS_HEX,
    DEFAULT_TARGET_HEX,
    DEFAULT_TOTAL_ROUNDS,
    GUESS_DURATION_MS,
    MEMORIZE_DURATION_MS,
    ROOM_CODE_ALPHABET,
    ROOM_CODE_LENGTH
} from '../config/constants.js';
import {
    generateBotGuessHex,
    generateRandomTargetHex,
    normalizeHex
} from './color.js';
import { scoreRound } from './scoring.js';

/**
 * Deep-clones plain JSON-serializable room objects so domain transitions remain pure.
 */
function cloneRoom(room) {
    return JSON.parse(JSON.stringify(room));
}

/**
 * Generates an unambiguous uppercase room code.
 */
export function generateRoomCode(rng = Math.random) {
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        code += ROOM_CODE_ALPHABET.charAt(Math.floor(rng() * ROOM_CODE_ALPHABET.length));
    }
    return code;
}

/**
 * Creates a normalized player record.
 */
export function createPlayer({ id, name, isHost = false, isBot = false, connected = true, joinedAt = Date.now() }) {
    return {
        id,
        name: (name || 'Jugador').trim().slice(0, 16) || 'Jugador',
        isHost: Boolean(isHost),
        isBot: Boolean(isBot),
        connected: Boolean(connected),
        score: 0,
        totalAccuracy: 0,
        roundsPlayed: 0,
        joinedAt
    };
}

/**
 * Parses a comma-separated string of custom HEX codes and pads remaining rounds randomly.
 */
export function buildRoundTargets(totalRounds, customInput = '', rng = Math.random) {
    const trimmed = String(customInput || '').trim();
    const customHexes = trimmed
        ? trimmed.split(',').map(s => normalizeHex(s)).filter(Boolean)
        : [];

    const targets = [];
    for (let i = 0; i < totalRounds; i++) {
        targets.push(customHexes[i] || generateRandomTargetHex(rng));
    }
    return targets;
}

/**
 * Creates the initial room state owned by the host in the lobby phase.
 */
export function createInitialRoom({
    code,
    hostId,
    hostName,
    totalRounds = DEFAULT_TOTAL_ROUNDS,
    now = Date.now(),
    rng = Math.random
}) {
    const validRounds = ALLOWED_ROUNDS.includes(Number(totalRounds))
        ? Number(totalRounds)
        : DEFAULT_TOTAL_ROUNDS;

    return {
        code,
        hostId,
        hostName: (hostName || 'Líder').trim().slice(0, 16) || 'Líder',
        status: 'lobby',
        currentRound: 0,
        totalRounds: validRounds,
        roundTargets: Array.from({ length: validRounds }, () => generateRandomTargetHex(rng)),
        phaseStartTime: now,
        phaseEndTime: 0,
        roundScored: false,
        players: {
            [hostId]: createPlayer({
                id: hostId,
                name: hostName,
                isHost: true,
                isBot: false,
                joinedAt: now
            })
        },
        guesses: {}
    };
}

/**
 * Inserts a new player or updates an existing player's nickname in the room.
 */
export function upsertPlayer(room, { playerId, name, now = Date.now() }) {
    const nextRoom = cloneRoom(room);
    const safeName = (name || 'Jugador').trim().slice(0, 16) || 'Jugador';
    const existing = nextRoom.players[playerId];

    if (existing) {
        existing.name = safeName;
        existing.connected = true;
        return { room: nextRoom, isNewPlayer: false, playerName: safeName };
    }

    nextRoom.players[playerId] = createPlayer({
        id: playerId,
        name: safeName,
        isHost: false,
        isBot: false,
        joinedAt: now
    });

    return { room: nextRoom, isNewPlayer: true, playerName: safeName };
}

/**
 * Removes a player when the room is still in the lobby.
 */
export function removePlayerInLobby(room, playerId) {
    const nextRoom = cloneRoom(room);
    const player = nextRoom.players?.[playerId];
    if (!player || nextRoom.status !== 'lobby') {
        return { room: nextRoom, removedPlayer: null };
    }
    delete nextRoom.players[playerId];
    return { room: nextRoom, removedPlayer: player };
}

/**
 * Updates a player's connection flag during an active match without erasing their score.
 */
export function setPlayerConnection(room, playerId, connected) {
    const nextRoom = cloneRoom(room);
    const player = nextRoom.players?.[playerId];
    if (!player) {
        return { room: nextRoom, updated: false };
    }
    player.connected = Boolean(connected);
    return { room: nextRoom, updated: true, playerName: player.name };
}

/**
 * Updates the match round count in lobby while preserving already-generated targets.
 */
export function updateTotalRounds(room, roundsCount, rng = Math.random) {
    const nextRoom = cloneRoom(room);
    const validRounds = ALLOWED_ROUNDS.includes(Number(roundsCount))
        ? Number(roundsCount)
        : DEFAULT_TOTAL_ROUNDS;

    const currentTargets = Array.isArray(nextRoom.roundTargets) ? nextRoom.roundTargets : [];
    const updatedTargets = [];
    for (let i = 0; i < validRounds; i++) {
        updatedTargets.push(currentTargets[i] || generateRandomTargetHex(rng));
    }

    nextRoom.totalRounds = validRounds;
    nextRoom.roundTargets = updatedTargets;
    return { room: nextRoom, totalRounds: validRounds };
}

/**
 * Adds a simulated AI bot player to the room.
 */
export function addBotPlayer(room, { now = Date.now(), rng = Math.random } = {}) {
    const nextRoom = cloneRoom(room);
    const count = Object.keys(nextRoom.players || {}).length;
    const botId = 'bot-' + Math.floor(rng() * 1e9).toString(36).slice(0, 5);
    const baseName = BOT_NAMES[Math.max(0, count - 1) % BOT_NAMES.length];
    const botName = `${baseName} ${count > BOT_NAMES.length ? count : ''}`.trim();

    const bot = createPlayer({
        id: botId,
        name: botName,
        isHost: false,
        isBot: true,
        joinedAt: now
    });
    nextRoom.players[botId] = bot;

    return { room: nextRoom, bot };
}

/**
 * Removes a bot player from the room.
 */
export function removeBotPlayer(room, botId) {
    const nextRoom = cloneRoom(room);
    const target = nextRoom.players?.[botId];
    if (!target || !target.isBot) {
        return { room: nextRoom, removed: false };
    }
    delete nextRoom.players[botId];
    return { room: nextRoom, removed: true };
}

/**
 * Starts a match from the lobby, resetting player scores and opening round 1 memorize phase.
 */
export function startMatch(room, { customInput = '', now = Date.now(), rng = Math.random } = {}) {
    const playerIds = Object.keys(room.players || {});
    if (playerIds.length < 2) {
        return { ok: false, reason: 'NOT_ENOUGH_PLAYERS', room };
    }

    const nextRoom = cloneRoom(room);
    const totalRounds = ALLOWED_ROUNDS.includes(Number(nextRoom.totalRounds))
        ? Number(nextRoom.totalRounds)
        : DEFAULT_TOTAL_ROUNDS;

    nextRoom.totalRounds = totalRounds;
    nextRoom.roundTargets = buildRoundTargets(totalRounds, customInput, rng);

    playerIds.forEach(pid => {
        nextRoom.players[pid] = {
            ...nextRoom.players[pid],
            score: 0,
            totalAccuracy: 0,
            roundsPlayed: 0
        };
    });

    nextRoom.status = 'memorize';
    nextRoom.currentRound = 0;
    nextRoom.guesses = {};
    nextRoom.roundScored = false;
    nextRoom.phaseStartTime = now;
    nextRoom.phaseEndTime = now + MEMORIZE_DURATION_MS;

    return { ok: true, room: nextRoom };
}

/**
 * Transitions from memorize to guess phase and populates guesses for all bots.
 */
export function transitionToGuessPhase(room, { now = Date.now(), rng = Math.random } = {}) {
    const nextRoom = cloneRoom(room);
    const roundIdx = nextRoom.currentRound || 0;
    const targetHex = nextRoom.roundTargets?.[roundIdx] || DEFAULT_TARGET_HEX;

    nextRoom.status = 'guess';
    nextRoom.phaseStartTime = now;
    nextRoom.phaseEndTime = now + GUESS_DURATION_MS;
    nextRoom.guesses = {};
    nextRoom.roundScored = false;

    let botsGuessed = 0;
    Object.values(nextRoom.players || {}).forEach(player => {
        if (player.isBot) {
            nextRoom.guesses[player.id] = {
                playerId: player.id,
                hex: generateBotGuessHex(targetHex, rng),
                submittedAt: now
            };
            botsGuessed += 1;
        }
    });

    return { room: nextRoom, botsGuessed };
}

/**
 * Records a player's submitted color guess during the active guess phase.
 */
export function recordGuess(room, { playerId, hex, now = Date.now() }) {
    if (!room || room.status !== 'guess' || !playerId || !room.players?.[playerId]) {
        return { room, accepted: false };
    }
    const nextRoom = cloneRoom(room);
    nextRoom.guesses[playerId] = {
        playerId,
        hex: normalizeHex(hex) || DEFAULT_GUESS_HEX,
        submittedAt: now
    };
    return { room: nextRoom, accepted: true };
}

/**
 * Returns true when every currently connected player in the room has submitted a guess.
 */
export function areAllPlayersReady(room) {
    if (!room || room.status !== 'guess') return false;
    const activePlayers = Object.values(room.players || {}).filter(p => p.connected !== false);
    if (activePlayers.length === 0) return false;
    const guesses = room.guesses || {};
    return activePlayers.every(p => Boolean(guesses[p.id]));
}

/**
 * Finalizes the current round, applies similarity scores, and enters round_results.
 */
export function finalizeRound(room, {
    fallbackPlayerId = null,
    fallbackHex = DEFAULT_GUESS_HEX,
    now = Date.now()
} = {}) {
    if (!room || room.roundScored) {
        return { room, finalized: false };
    }

    const nextRoom = cloneRoom(room);
    const roundIdx = nextRoom.currentRound || 0;
    const targetHex = nextRoom.roundTargets?.[roundIdx] || DEFAULT_TARGET_HEX;
    const playerIds = Object.keys(nextRoom.players || {});
    const guessesMap = nextRoom.guesses || {};

    playerIds.forEach(pid => {
        if (!guessesMap[pid]) {
            guessesMap[pid] = {
                playerId: pid,
                hex: pid === fallbackPlayerId ? (normalizeHex(fallbackHex) || DEFAULT_GUESS_HEX) : DEFAULT_GUESS_HEX,
                submittedAt: now
            };
        }
    });

    const ranking = scoreRound(targetHex, playerIds, guessesMap);
    ranking.forEach(item => {
        const player = nextRoom.players[item.playerId];
        if (player) {
            player.score = Number(((player.score || 0) + item.pointsEarned).toFixed(1));
            player.totalAccuracy = Number(((player.totalAccuracy || 0) + item.similarity).toFixed(1));
            player.roundsPlayed = (player.roundsPlayed || 0) + 1;
        }
        guessesMap[item.playerId].similarity = item.similarity;
        guessesMap[item.playerId].pointsEarned = item.pointsEarned;
        guessesMap[item.playerId].rank = item.rank;
    });

    nextRoom.guesses = guessesMap;
    nextRoom.status = 'round_results';
    nextRoom.roundScored = true;
    return { room: nextRoom, finalized: true };
}

/**
 * Advances either to the next round's memorize phase or to game_over after the last round.
 */
export function advanceToNextRound(room, { customNextHex = '', now = Date.now() } = {}) {
    const nextRoom = cloneRoom(room);
    const totalRounds = nextRoom.totalRounds || DEFAULT_TOTAL_ROUNDS;
    const nextRound = (nextRoom.currentRound || 0) + 1;

    if (nextRound >= totalRounds) {
        nextRoom.status = 'game_over';
        return { room: nextRoom, isGameOver: true };
    }

    const validCustom = normalizeHex(customNextHex);
    if (validCustom) {
        nextRoom.roundTargets[nextRound] = validCustom;
    }

    nextRoom.status = 'memorize';
    nextRoom.currentRound = nextRound;
    nextRoom.guesses = {};
    nextRoom.roundScored = false;
    nextRoom.phaseStartTime = now;
    nextRoom.phaseEndTime = now + MEMORIZE_DURATION_MS;

    return { room: nextRoom, isGameOver: false };
}

/**
 * Resets a completed match back to the lobby keeping connected players.
 */
export function returnToLobby(room) {
    const nextRoom = cloneRoom(room);
    nextRoom.status = 'lobby';
    nextRoom.currentRound = 0;
    nextRoom.guesses = {};
    nextRoom.roundScored = false;
    return { room: nextRoom };
}

/**
 * Projects a guest-safe copy of room state so future round targets and in-progress
 * opponent guesses are never leaked over the network.
 */
export function sanitizeRoomForGuest(room) {
    const roundIdx = room.currentRound || 0;
    const revealTarget = room.status === 'memorize' || room.status === 'round_results';
    const revealGuesses = room.status === 'round_results';

    const sanitizedGuesses = {};
    Object.entries(room.guesses || {}).forEach(([pid, g]) => {
        if (revealGuesses) {
            sanitizedGuesses[pid] = { ...g };
        } else {
            sanitizedGuesses[pid] = {
                playerId: pid,
                submittedAt: g.submittedAt
            };
        }
    });

    return {
        code: room.code,
        hostId: room.hostId,
        hostName: room.hostName,
        status: room.status,
        currentRound: roundIdx,
        totalRounds: room.totalRounds,
        currentTargetHex: revealTarget
            ? (room.roundTargets?.[roundIdx] || DEFAULT_TARGET_HEX)
            : null,
        phaseStartTime: room.phaseStartTime,
        phaseEndTime: room.phaseEndTime,
        roundScored: room.roundScored,
        players: cloneRoom(room.players || {}),
        guesses: sanitizedGuesses
    };
}

