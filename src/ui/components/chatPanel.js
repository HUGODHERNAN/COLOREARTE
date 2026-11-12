import { CHAT_EMOJIS, CHAT_PHRASES, SOLID_AVATAR_COLORS } from '../../config/constants.js';
import { setElementVisible } from '../utils/dom.js';

const MAX_LIVE_BUBBLES = 3;
const LIVE_BUBBLE_DURATION_MS = 2600;

/**
 * Builds a single safe message row element using textContent to prevent HTML injection.
 */
function createMessageRow(msg, isMine) {
    const row = document.createElement('div');
    row.className = `flex flex-col ${isMine ? 'items-end' : 'items-start'}`;

    const meta = document.createElement('div');
    meta.className = 'flex items-center gap-1.5 mb-0.5 px-1';

    const dot = document.createElement('span');
    dot.className = 'w-2.5 h-2.5 rounded-full border border-hrInk flex-shrink-0';
    dot.style.backgroundColor = SOLID_AVATAR_COLORS[msg.colorIndex % SOLID_AVATAR_COLORS.length];

    const author = document.createElement('span');
    author.className = 'text-[10px] font-bold text-neutral-600 truncate max-w-[140px]';
    author.textContent = isMine ? 'Tú' : msg.playerName;

    meta.append(dot, author);
    row.appendChild(meta);

    if (msg.kind === 'emoji') {
        const bubble = document.createElement('div');
        bubble.className = 'px-2.5 py-1 rounded-2xl bg-white border-[1.5px] border-hrInk text-2xl leading-none shadow-[0_2px_0_#111111]';
        bubble.textContent = msg.text;
        row.appendChild(bubble);
        return row;
    }

    const bubble = document.createElement('div');
    if (msg.kind === 'phrase') {
        bubble.className = `px-3 py-1.5 rounded-2xl border-[1.5px] border-hrInk text-xs font-bold break-words max-w-[85%] shadow-[0_2px_0_#111111] ${isMine ? 'bg-hrYellow text-hrInk' : 'bg-[#FEF9C3] text-hrInk'
            }`;
    } else {
        bubble.className = `px-3 py-1.5 rounded-2xl border-[1.5px] border-hrInk text-xs font-medium break-words max-w-[85%] shadow-[0_2px_0_#111111] ${isMine ? 'bg-hrYellow text-hrInk' : 'bg-white text-hrInk'
            }`;
    }
    bubble.textContent = msg.text;
    row.appendChild(bubble);
    return row;
}

/**
 * Manages the adaptive room chat UI (anchored inside lobby, floating drawer + bubbles during match).
 */
export function createChatPanel({ onSendChat, onToggleFloating, onCloseFloating }) {
    const lobbySlot = document.getElementById('lobby-chat-slot');
    const floatingRoot = document.getElementById('floating-chat-root');
    const floatingDrawer = document.getElementById('floating-chat-drawer');
    const toggleFloatingBtn = document.getElementById('btn-toggle-floating-chat');
    const toggleBtnLabel = document.getElementById('floating-chat-btn-label');
    const floatingBadge = document.getElementById('floating-chat-badge');
    const liveBubblesEl = document.getElementById('chat-live-bubbles');

    const parkingRoot = document.getElementById('chat-parking-root');
    const panelEl = document.getElementById('room-chat-panel');
    const modePill = document.getElementById('chat-mode-pill');
    const closeFloatingBtn = document.getElementById('btn-close-floating-chat');
    const messagesListEl = document.getElementById('chat-messages-list');
    const emptyStateEl = document.getElementById('chat-empty-state');
    const emojiBar = document.getElementById('chat-emoji-bar');
    const phraseBar = document.getElementById('chat-phrase-bar');
    const textForm = document.getElementById('chat-text-form');
    const textInput = document.getElementById('chat-text-input');

    let lastRenderedMessages = null;
    let lastMode = 'hidden';
    let lastOpen = false;
    const bubbleTimers = new Set();

    function populateQuickActions() {
        if (emojiBar) {
            emojiBar.innerHTML = '';
            CHAT_EMOJIS.forEach((emoji) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.setAttribute('data-emoji', emoji);
                btn.className = 'w-8 h-8 rounded-full bg-[#FAF9F5] border-[1.5px] border-hrInk hover:bg-hrYellow text-base flex items-center justify-center flex-shrink-0 transition active:translate-y-0.5';
                btn.textContent = emoji;
                btn.title = `Enviar ${emoji}`;
                emojiBar.appendChild(btn);
            });
        }

        if (phraseBar) {
            phraseBar.innerHTML = '';
            CHAT_PHRASES.forEach((phrase) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.setAttribute('data-phrase-id', phrase.id);
                btn.className = 'px-3 py-1 rounded-full hr-pill-white text-[11px] font-bold whitespace-nowrap flex-shrink-0 hover:bg-hrYellow';
                btn.textContent = phrase.text;
                phraseBar.appendChild(btn);
            });
        }
    }

    function clearLiveBubbles() {
        bubbleTimers.forEach(timer => clearTimeout(timer));
        bubbleTimers.clear();
        if (liveBubblesEl) liveBubblesEl.innerHTML = '';
    }

    function scrollMessagesToBottom() {
        if (!messagesListEl) return;
        messagesListEl.scrollTop = messagesListEl.scrollHeight;
    }

    function renderMessages(messages, activePlayerId) {
        if (!messagesListEl || messages === lastRenderedMessages) return;
        lastRenderedMessages = messages;

        messagesListEl.innerHTML = '';
        if (!messages || messages.length === 0) {
            if (emptyStateEl) {
                setElementVisible(emptyStateEl, true, true);
                messagesListEl.appendChild(emptyStateEl);
            }
            return;
        }

        if (emptyStateEl) setElementVisible(emptyStateEl, false, true);
        const fragment = document.createDocumentFragment();
        messages.forEach(msg => {
            fragment.appendChild(createMessageRow(msg, msg.playerId === activePlayerId));
        });
        messagesListEl.appendChild(fragment);
        scrollMessagesToBottom();
    }

    function movePanelTo(target) {
        if (!panelEl || !target || panelEl.parentElement === target) return;
        target.appendChild(panelEl);
    }

    function render(chatState) {
        const { mode, isOpen, unreadCount, activePlayerId, messages } = chatState;

        if (mode === 'lobby') {
            clearLiveBubbles();
            setElementVisible(floatingRoot, false, true);
            setElementVisible(floatingDrawer, false);
            setElementVisible(lobbySlot, true);
            setElementVisible(closeFloatingBtn, false, true);
            movePanelTo(lobbySlot);

            if (panelEl) {
                panelEl.className = 'hr-subcard overflow-hidden flex flex-col bg-[#FAF9F5]';
            }
            if (modePill) modePill.textContent = 'En Lobby';
        } else if (mode === 'floating') {
            setElementVisible(lobbySlot, false);
            setElementVisible(floatingRoot, true, true);
            setElementVisible(closeFloatingBtn, true, true);
            movePanelTo(floatingDrawer);

            if (panelEl) {
                panelEl.className = 'bg-[#FAF9F5] border-2 border-hrInk rounded-2xl shadow-[0_5px_0_#111111] overflow-hidden flex flex-col max-h-[68vh]';
            }
            if (modePill) modePill.textContent = 'En Vivo';
            setElementVisible(floatingDrawer, isOpen);

            if (toggleBtnLabel) {
                toggleBtnLabel.textContent = isOpen ? 'Ocultar Chat' : 'Chat';
            }

            if (floatingBadge) {
                const showBadge = !isOpen && unreadCount > 0;
                setElementVisible(floatingBadge, showBadge, true);
                if (showBadge) {
                    floatingBadge.textContent = unreadCount > 9 ? '9+' : String(unreadCount);
                }
            }

            if (isOpen && (!lastOpen || lastMode !== 'floating')) {
                clearLiveBubbles();
                requestAnimationFrame(scrollMessagesToBottom);
            }
        } else {
            clearLiveBubbles();
            setElementVisible(lobbySlot, false);
            setElementVisible(floatingRoot, false, true);
            setElementVisible(floatingDrawer, false);
            movePanelTo(parkingRoot);
        }

        lastMode = mode;
        lastOpen = isOpen;
        renderMessages(messages, activePlayerId);
    }

    function showLiveBubble(msg, chatState) {
        if (!liveBubblesEl || chatState.mode !== 'floating' || chatState.isOpen) return;

        while (liveBubblesEl.children.length >= MAX_LIVE_BUBBLES) {
            liveBubblesEl.removeChild(liveBubblesEl.firstChild);
        }

        const bubble = document.createElement('div');
        bubble.className = 'chat-live-bubble animate-pop bg-white border-[1.5px] border-hrInk rounded-full px-3 py-1.5 text-xs flex items-center gap-1.5 max-w-full';

        const dot = document.createElement('span');
        dot.className = 'w-2.5 h-2.5 rounded-full border border-hrInk flex-shrink-0';
        dot.style.backgroundColor = SOLID_AVATAR_COLORS[msg.colorIndex % SOLID_AVATAR_COLORS.length];

        const author = document.createElement('span');
        author.className = 'font-extrabold text-hrInk flex-shrink-0';
        author.textContent = `${msg.playerId === chatState.activePlayerId ? 'Tú' : msg.playerName}:`;

        const content = document.createElement('span');
        content.className = `${msg.kind === 'emoji' ? 'text-base leading-none' : 'font-semibold text-neutral-700 truncate'}`;
        content.textContent = msg.text;

        bubble.append(dot, author, content);
        liveBubblesEl.appendChild(bubble);

        const fadeTimer = setTimeout(() => {
            bubble.classList.add('opacity-0', '-translate-y-1');
            const removeTimer = setTimeout(() => {
                bubble.remove();
                bubbleTimers.delete(removeTimer);
            }, 260);
            bubbleTimers.add(removeTimer);
            bubbleTimers.delete(fadeTimer);
        }, LIVE_BUBBLE_DURATION_MS);

        bubbleTimers.add(fadeTimer);
    }

    populateQuickActions();

    emojiBar?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-emoji]');
        if (!btn) return;
        const emoji = btn.getAttribute('data-emoji');
        if (emoji) onSendChat({ kind: 'emoji', value: emoji });
    });

    phraseBar?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-phrase-id]');
        if (!btn) return;
        const phraseId = btn.getAttribute('data-phrase-id');
        if (phraseId) onSendChat({ kind: 'phrase', value: phraseId });
    });

    textForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!textInput) return;
        const raw = textInput.value;
        const sent = onSendChat({ kind: 'text', value: raw });
        if (sent) {
            textInput.value = '';
        }
    });

    toggleFloatingBtn?.addEventListener('click', () => onToggleFloating());
    closeFloatingBtn?.addEventListener('click', () => onCloseFloating());

    return {
        render,
        showLiveBubble
    };
}
