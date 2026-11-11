import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '../src/config/constants.js';
import {
    addBotPlayer,
    advanceToNextRound,
    areAllPlayersReady,
    createInitialRoom,
    finalizeRound,
    generateRoomCode,
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
} from '../src/domain/gameEngine.js';
import { assert, suite } from './testRunner.js';

suite('domain/gameEngine', (test) => {
    test('generateRoomCode builds 5 chars from unambiguous alphabet', () => {
        const code = generateRoomCode(() => 0);
        assert.equal(code.length, ROOM_CODE_LENGTH);
        assert.equal(code, ROOM_CODE_ALPHABET[0].repeat(ROOM_CODE_LENGTH));
    });

    test('createInitialRoom initializes lobby state with host and targets', () => {
        const room = createInitialRoom({
            code: 'ABC23',
            hostId: 'host-1',
            hostName: 'Ana',
            totalRounds: 7,
            now: 1000,
            rng: () => 0.4
        });
        assert.equal(room.status, 'lobby');
        assert.equal(room.totalRounds, 7);
        assert.equal(room.roundTargets.length, 7);
        assert.equal(room.players['host-1'].isHost, true);
        assert.equal(room.players['host-1'].name, 'Ana');
    });

    test('upsertPlayer and removePlayerInLobby handle join and lobby leave safely', () => {
        let room = createInitialRoom({ code: 'K7X9P', hostId: 'h1', hostName: 'Host', now: 100 });
        const joined = upsertPlayer(room, { playerId: 'g1', name: 'Carlos', now: 200 });
        assert.equal(joined.isNewPlayer, true);
        assert.equal(joined.room.players['g1'].name, 'Carlos');

        const updated = upsertPlayer(joined.room, { playerId: 'g1', name: 'Carlos2', now: 250 });
        assert.equal(updated.isNewPlayer, false);
        assert.equal(updated.room.players['g1'].name, 'Carlos2');

        const left = removePlayerInLobby(updated.room, 'g1');
        assert.equal(left.removedPlayer.id, 'g1');
        assert.equal(left.room.players['g1'], undefined);
    });

    test('updateTotalRounds resizes targets while preserving existing ones', () => {
        const room = createInitialRoom({ code: 'K7X9P', hostId: 'h1', hostName: 'Host', totalRounds: 5, rng: () => 0.2 });
        const firstColor = room.roundTargets[0];
        const expanded = updateTotalRounds(room, 10, () => 0.8);
        assert.equal(expanded.totalRounds, 10);
        assert.equal(expanded.room.roundTargets.length, 10);
        assert.equal(expanded.room.roundTargets[0], firstColor);

        const invalid = updateTotalRounds(expanded.room, 99);
        assert.equal(invalid.totalRounds, 10);
    });

    test('full round lifecycle: startMatch -> guess -> recordGuess -> finalizeRound -> advanceToNextRound -> returnToLobby', () => {
        let room = createInitialRoom({ code: 'K7X9P', hostId: 'h1', hostName: 'Host', totalRounds: 5, now: 1000 });

        // Rejects match with fewer than 2 players
        const tooFew = startMatch(room, { now: 1100 });
        assert.equal(tooFew.ok, false);
        assert.equal(tooFew.reason, 'NOT_ENOUGH_PLAYERS');

        // Add bot and start with custom first-round color
        const botAdded = addBotPlayer(room, { now: 1050, rng: () => 0.1 });
        room = botAdded.room;
        assert.equal(botAdded.bot.isBot, true);

        const started = startMatch(room, { customInput: '#FF0000, #00FF00', now: 2000, rng: () => 0.5 });
        assert.equal(started.ok, true);
        room = started.room;
        assert.equal(room.status, 'memorize');
        assert.equal(room.roundTargets[0], '#FF0000');
        assert.equal(room.roundTargets[1], '#00FF00');
        assert.equal(room.phaseEndTime, 7000);

        // Transition to guess auto-submits bot guess
        const guessPhase = transitionToGuessPhase(room, { now: 7000, rng: () => 0.5 });
        room = guessPhase.room;
        assert.equal(room.status, 'guess');
        assert.equal(guessPhase.botsGuessed, 1);
        assert.equal(areAllPlayersReady(room), false);

        // Host submits exact color
        const hostGuess = recordGuess(room, { playerId: 'h1', hex: '#FF0000', now: 8000 });
        assert.equal(hostGuess.accepted, true);
        room = hostGuess.room;
        assert.equal(areAllPlayersReady(room), true);

        // Finalize scores
        const finalized = finalizeRound(room, { now: 9000 });
        assert.equal(finalized.finalized, true);
        room = finalized.room;
        assert.equal(room.status, 'round_results');
        assert.equal(room.players['h1'].score, 100);
        assert.equal(room.players['h1'].roundsPlayed, 1);

        // Second finalize call is idempotent
        const finalizedAgain = finalizeRound(room, { now: 9100 });
        assert.equal(finalizedAgain.finalized, false);

        // Advance to round 2 with custom override
        const next = advanceToNextRound(room, { customNextHex: '#112233', now: 10000 });
        assert.equal(next.isGameOver, false);
        assert.equal(next.room.currentRound, 1);
        assert.equal(next.room.roundTargets[1], '#112233');

        // Advance past final round triggers game_over
        const lastRoundRoom = { ...next.room, currentRound: 4, totalRounds: 5 };
        const over = advanceToNextRound(lastRoundRoom, { now: 20000 });
        assert.equal(over.isGameOver, true);
        assert.equal(over.room.status, 'game_over');

        // Return to lobby keeps players and removes bot cleanly if requested
        const lobby = returnToLobby(over.room).room;
        assert.equal(lobby.status, 'lobby');
        assert.equal(lobby.currentRound, 0);
        const removeHuman = removeBotPlayer(lobby, 'h1');
        assert.equal(removeHuman.removed, false);
        const removeBot = removeBotPlayer(lobby, botAdded.bot.id);
        assert.equal(removeBot.removed, true);
    });

    test('sanitizeRoomForGuest hides future roundTargets and in-progress guess hexes', () => {
        let room = createInitialRoom({ code: 'K7X9P', hostId: 'h1', hostName: 'Host', totalRounds: 5 });
        room = upsertPlayer(room, { playerId: 'g1', name: 'Guest' }).room;
        room = startMatch(room, { customInput: '#111111, #222222' }).room;

        // Memorize exposes only currentTargetHex, never roundTargets array
        const memGuest = sanitizeRoomForGuest(room);
        assert.equal(memGuest.roundTargets, undefined);
        assert.equal(memGuest.currentTargetHex, '#111111');

        // Guess hides target hex AND hides opponent guess hexes
        room = transitionToGuessPhase(room).room;
        room = recordGuess(room, { playerId: 'h1', hex: '#111111' }).room;
        const guessGuest = sanitizeRoomForGuest(room);
        assert.equal(guessGuest.currentTargetHex, null);
        assert.equal(guessGuest.guesses['h1'].hex, undefined);
        assert.equal(guessGuest.guesses['h1'].playerId, 'h1');

        // Results reveals both currentTargetHex and full guess details
        room = finalizeRound(room).room;
        const resGuest = sanitizeRoomForGuest(room);
        assert.equal(resGuest.currentTargetHex, '#111111');
        assert.equal(resGuest.guesses['h1'].hex, '#111111');
    });

    test('setPlayerConnection excludes disconnected players from readiness check and restores on rejoin', () => {
        let room = createInitialRoom({ code: 'K7X9P', hostId: 'h1', hostName: 'Host', totalRounds: 5 });
        room = upsertPlayer(room, { playerId: 'g1', name: 'Guest' }).room;
        room = startMatch(room).room;
        room = transitionToGuessPhase(room).room;
        room = recordGuess(room, { playerId: 'h1', hex: '#111111' }).room;

        assert.equal(areAllPlayersReady(room), false);

        // Guest disconnects mid-round -> connected players are now all ready
        const disconnected = setPlayerConnection(room, 'g1', false);
        assert.equal(disconnected.updated, true);
        assert.equal(disconnected.room.players['g1'].connected, false);
        assert.equal(areAllPlayersReady(disconnected.room), true);

        // Guest reconnects -> connected returns to true
        const rejoined = upsertPlayer(disconnected.room, { playerId: 'g1', name: 'Guest' });
        assert.equal(rejoined.isNewPlayer, false);
        assert.equal(rejoined.room.players['g1'].connected, true);
        assert.equal(areAllPlayersReady(rejoined.room), false);
    });
});

