import {
    CHAT_COOLDOWN_MS,
    CHAT_MAX_TEXT_LENGTH
} from '../src/config/constants.js';
import {
    appendChatHistory,
    checkChatRateLimit,
    createChatMessage,
    getPlayerColorIndex,
    mergeChatHistory,
    resolveChatPayload,
    sanitizeChatText
} from '../src/domain/chat.js';
import { createChatStore } from '../src/state/chatStore.js';
import { assert, suite } from './testRunner.js';

suite('domain/chat & state/chatStore', (test) => {
    test('resolveChatPayload accepts required custom preset phrases and allowed emojis', () => {
        const p1 = resolveChatPayload({ kind: 'phrase', value: 'suban_nivel' });
        const p2 = resolveChatPayload({ kind: 'phrase', value: 'sobra_tiempo' });
        const p3 = resolveChatPayload({ kind: 'phrase', value: 'prendan_pantallas' });
        const emoji = resolveChatPayload({ kind: 'emoji', value: '🔥' });

        assert.equal(p1.ok, true);
        assert.equal(p1.text, 'Suban el nivel');
        assert.equal(p2.text, 'Me sobra tiempo');
        assert.equal(p3.text, 'Prendan las pantallas');
        assert.equal(emoji.ok, true);
        assert.equal(emoji.text, '🔥');

        assert.equal(resolveChatPayload({ kind: 'phrase', value: 'no_existe' }).ok, false);
        assert.equal(resolveChatPayload({ kind: 'emoji', value: '🚀' }).ok, false);
    });

    test('sanitizeChatText normalizes whitespace, strips control chars, and enforces length limit', () => {
        assert.equal(sanitizeChatText('  Hola\n\tmundo   libre  '), 'Hola mundo libre');
        assert.equal(sanitizeChatText('   '), '');

        const longInput = 'a'.repeat(CHAT_MAX_TEXT_LENGTH + 25);
        assert.equal(Array.from(sanitizeChatText(longInput)).length, CHAT_MAX_TEXT_LENGTH);

        const emojiRun = '🔥'.repeat(10);
        assert.equal(Array.from(sanitizeChatText(emojiRun, 4)).join(''), '🔥🔥🔥🔥');
    });

    test('checkChatRateLimit enforces cooldown per player', () => {
        const lastSent = new Map();
        const t0 = 10000;

        assert.equal(checkChatRateLimit(lastSent, 'p1', t0, CHAT_COOLDOWN_MS).allowed, true);
        lastSent.set('p1', t0);

        const blocked = checkChatRateLimit(lastSent, 'p1', t0 + 300, CHAT_COOLDOWN_MS);
        assert.equal(blocked.allowed, false);
        assert.ok(blocked.retryAfterMs > 0);

        assert.equal(checkChatRateLimit(lastSent, 'p1', t0 + CHAT_COOLDOWN_MS, CHAT_COOLDOWN_MS).allowed, true);
    });

    test('appendChatHistory and mergeChatHistory deduplicate IDs and cap history length', () => {
        const m1 = createChatMessage({ id: 'm1', playerId: 'p1', text: 'Hola', createdAt: 1 });
        const m2 = createChatMessage({ id: 'm2', playerId: 'p2', text: '🔥', kind: 'emoji', createdAt: 2 });
        const m3 = createChatMessage({ id: 'm3', playerId: 'p1', text: 'Suban el nivel', kind: 'phrase', createdAt: 3 });

        let history = appendChatHistory([], m1, 2);
        history = appendChatHistory(history, m1, 2);
        assert.equal(history.length, 1);

        history = mergeChatHistory(history, [m1, m2, m3], 2);
        assert.deepEqual(history.map(m => m.id), ['m2', 'm3']);
    });

    test('getPlayerColorIndex matches room join order', () => {
        const room = {
            players: {
                p2: { id: 'p2', joinedAt: 200 },
                p1: { id: 'p1', joinedAt: 100 }
            }
        };
        assert.equal(getPlayerColorIndex(room, 'p1'), 0);
        assert.equal(getPlayerColorIndex(room, 'p2'), 1);
    });

    test('chatStore tracks lobby/floating mode, unread badge, and preserves history across game start', () => {
        const chatStore = createChatStore();
        chatStore.setContext({ mode: 'lobby', activePlayerId: 'me' });

        chatStore.addMessage(createChatMessage({ id: 'c1', playerId: 'other', text: 'Prendan las pantallas', kind: 'phrase' }));
        assert.equal(chatStore.getState().unreadCount, 0);
        assert.equal(chatStore.getState().messages.length, 1);

        chatStore.setContext({ mode: 'floating', activePlayerId: 'me' });
        assert.equal(chatStore.getState().isOpen, false);
        assert.equal(chatStore.getState().messages.length, 1);

        chatStore.addMessage(createChatMessage({ id: 'c2', playerId: 'other', text: '🔥', kind: 'emoji' }));
        chatStore.addMessage(createChatMessage({ id: 'c3', playerId: 'me', text: 'Me sobra tiempo', kind: 'phrase' }));
        assert.equal(chatStore.getState().unreadCount, 1);

        chatStore.setOpen(true);
        assert.equal(chatStore.getState().unreadCount, 0);

        chatStore.reset();
        assert.equal(chatStore.getState().mode, 'hidden');
        assert.equal(chatStore.getState().messages.length, 0);
    });
});

