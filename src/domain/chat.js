import {
    CHAT_COOLDOWN_MS,
    CHAT_EMOJIS,
    CHAT_MAX_HISTORY,
    CHAT_MAX_TEXT_LENGTH,
    CHAT_PHRASES,
    SOLID_AVATAR_COLORS
} from '../config/constants.js';

const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F]/g;

/**
 * Strips control characters, normalizes whitespace, and caps free-text chat input safely.
 */
export function sanitizeChatText(rawText, maxLength = CHAT_MAX_TEXT_LENGTH) {
    const cleaned = String(rawText ?? '')
        .replace(/[\r\n\t]+/g, ' ')
        .replace(CONTROL_CHARS_RE, '')
        .replace(/\s+/g, ' ')
        .trim();

    if (!cleaned) return '';
    return Array.from(cleaned).slice(0, maxLength).join('').trim();
}

const PAYLOAD_RESOLVERS = {
    phrase(value) {
        const key = String(value ?? '').trim();
        const found = CHAT_PHRASES.find(item => item.id === key || item.text === key);
        if (!found) return { ok: false, reason: 'INVALID_PHRASE' };
        return { ok: true, kind: 'phrase', text: found.text, phraseId: found.id };
    },
    emoji(value) {
        const emoji = String(value ?? '').trim();
        if (!CHAT_EMOJIS.includes(emoji)) {
            return { ok: false, reason: 'INVALID_EMOJI' };
        }
        return { ok: true, kind: 'emoji', text: emoji };
    },
    text(value) {
        const text = sanitizeChatText(value);
        if (!text) return { ok: false, reason: 'EMPTY_TEXT' };
        return { ok: true, kind: 'text', text };
    }
};

/**
 * Validates and resolves an incoming chat payload by kind (phrase, emoji, or free text).
 */
export function resolveChatPayload({ kind, value } = {}) {
    const resolver = PAYLOAD_RESOLVERS[kind];
    if (!resolver) return { ok: false, reason: 'INVALID_KIND' };
    return resolver(value);
}

/**
 * Computes a player's palette color index consistent with the lobby player order.
 */
export function getPlayerColorIndex(room, playerId) {
    const sorted = Object.values(room?.players || {}).sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
    const idx = sorted.findIndex(p => p.id === playerId);
    return idx >= 0 ? idx % SOLID_AVATAR_COLORS.length : 0;
}

/**
 * Builds a normalized, JSON-serializable room chat message record.
 */
export function createChatMessage({
    id,
    playerId,
    playerName,
    colorIndex = 0,
    kind = 'text',
    text,
    createdAt = Date.now()
}) {
    const normalizedIdx = Math.abs(Number(colorIndex) || 0) % SOLID_AVATAR_COLORS.length;
    return {
        id: id || `chat-${createdAt}-${Math.random().toString(36).slice(2, 7)}`,
        playerId: String(playerId || ''),
        playerName: sanitizeChatText(playerName || 'Jugador', 16) || 'Jugador',
        colorIndex: normalizedIdx,
        kind: PAYLOAD_RESOLVERS[kind] ? kind : 'text',
        text: sanitizeChatText(text),
        createdAt: Number(createdAt) || Date.now()
    };
}

/**
 * Checks whether a player has waited out the chat cooldown window.
 */
export function checkChatRateLimit(lastSentMap, playerId, now = Date.now(), cooldownMs = CHAT_COOLDOWN_MS) {
    if (!playerId) return { allowed: false, retryAfterMs: cooldownMs };
    const lastSentAt = lastSentMap?.get(playerId);
    if (typeof lastSentAt === 'number') {
        const elapsed = now - lastSentAt;
        if (elapsed < cooldownMs) {
            return { allowed: false, retryAfterMs: cooldownMs - elapsed };
        }
    }
    return { allowed: true, retryAfterMs: 0 };
}

/**
 * Appends a single message to chat history without duplicates and enforces the history cap.
 */
export function appendChatHistory(history, message, maxHistory = CHAT_MAX_HISTORY) {
    const base = Array.isArray(history) ? history : [];
    if (!message || !message.id || !message.text) return base;
    if (base.some(item => item.id === message.id)) return base;

    const next = [...base, message];
    return next.length > maxHistory ? next.slice(next.length - maxHistory) : next;
}

/**
 * Merges an incoming batch of historical messages chronologically without duplicates.
 */
export function mergeChatHistory(history, incomingMessages, maxHistory = CHAT_MAX_HISTORY) {
    if (!Array.isArray(incomingMessages) || incomingMessages.length === 0) {
        return Array.isArray(history) ? history : [];
    }
    let next = Array.isArray(history) ? [...history] : [];
    incomingMessages.forEach(msg => {
        next = appendChatHistory(next, msg, maxHistory);
    });
    return next;
}

