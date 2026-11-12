export const ROOM_PREFIX = 'colormatch-pe-room-';
export const LOCAL_STORAGE_PREFIX = 'colormatch_sandbox_room_';
export const SANDBOX_CHANNEL_NAME = 'colormatch_sandbox_sync';

export const PEER_CONFIG = {
    debug: 0,
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' }
        ]
    }
};

export const ALLOWED_ROUNDS = [5, 7, 10, 12, 15];
export const DEFAULT_TOTAL_ROUNDS = 10;
export const MEMORIZE_DURATION_MS = 5000;
export const GUESS_DURATION_MS = 20000;

export const DEFAULT_TARGET_HEX = '#FF5733';
export const DEFAULT_GUESS_HEX = '#808080';

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 5;

export const BOT_NAMES = [
    'Bot Croma',
    'Bot Prisma',
    'Bot Pixel',
    'Bot Estudio',
    'Bot Iris',
    'Bot Matiz',
    'Bot Neón',
    'Bot Pastel'
];

export const SOLID_AVATAR_COLORS = [
    '#F7E354',
    '#2684FF',
    '#FF3B30',
    '#28CD41',
    '#FF9500',
    '#AF52DE'
];

export const CHAT_EMOJIS = ['🔥', '😂', '🎯', '🤯', '👏', '👀', '😱', '💀'];

export const CHAT_PHRASES = [
    { id: 'suban_nivel', text: 'Suban el nivel' },
    { id: 'sobra_tiempo', text: 'Me sobra tiempo' },
    { id: 'prendan_pantallas', text: 'Prendan las pantallas' },
    { id: 'arranquemos', text: '¡Arranquemos! 🚀' },
    { id: 'lo_clave', text: '¡Lo clavé! 🎯' },
    { id: 'casi_igual', text: '¡Casi idéntico! 👀' },
    { id: 'tono_dificil', text: '¡Qué tono difícil! 😅' },
    { id: 'revancha', text: '¡Revancha! 🔥' }
];

export const CHAT_MAX_TEXT_LENGTH = 120;
export const CHAT_COOLDOWN_MS = 1000;
export const CHAT_MAX_HISTORY = 50;
export const CHAT_JOIN_HISTORY_LIMIT = 20;

