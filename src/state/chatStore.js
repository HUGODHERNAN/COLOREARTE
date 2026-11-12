import { appendChatHistory, mergeChatHistory } from '../domain/chat.js';

/**
 * Reactive store for room chat history, dual display mode (lobby vs floating), and unread count.
 */
export function createChatStore() {
    let state = {
        mode: 'hidden',
        isOpen: false,
        unreadCount: 0,
        activePlayerId: null,
        messages: []
    };

    const listeners = new Set();
    const messageAddedListeners = new Set();

    function emit() {
        listeners.forEach(listener => listener(state));
    }

    function getState() {
        return state;
    }

    function setContext({ mode = 'hidden', activePlayerId = null } = {}) {
        const normalizedMode = mode === 'lobby' || mode === 'floating' ? mode : 'hidden';
        if (state.mode === normalizedMode && state.activePlayerId === activePlayerId) {
            return;
        }

        let nextOpen = state.isOpen;
        let nextUnread = state.unreadCount;

        if (normalizedMode === 'hidden') {
            nextOpen = false;
            nextUnread = 0;
        } else if (normalizedMode === 'lobby') {
            nextOpen = false;
            nextUnread = 0;
        } else if (normalizedMode === 'floating' && state.mode !== 'floating') {
            // Collapse cleanly to the floating button when entering active match rounds.
            nextOpen = false;
        }

        state = {
            ...state,
            mode: normalizedMode,
            activePlayerId,
            isOpen: nextOpen,
            unreadCount: nextUnread
        };
        emit();
    }

    function setOpen(open) {
        const nextOpen = Boolean(open);
        if (state.isOpen === nextOpen && (!nextOpen || state.unreadCount === 0)) return;
        state = {
            ...state,
            isOpen: nextOpen,
            unreadCount: nextOpen ? 0 : state.unreadCount
        };
        emit();
    }

    function toggleOpen() {
        setOpen(!state.isOpen);
    }

    function addMessage(message) {
        const nextMessages = appendChatHistory(state.messages, message);
        if (nextMessages === state.messages) return false;

        const isFromOther = message.playerId !== state.activePlayerId;
        const shouldIncrementUnread = state.mode === 'floating' && !state.isOpen && isFromOther;

        state = {
            ...state,
            messages: nextMessages,
            unreadCount: shouldIncrementUnread ? state.unreadCount + 1 : state.unreadCount
        };
        emit();
        messageAddedListeners.forEach(cb => cb(message, state));
        return true;
    }

    function replaceHistory(incomingMessages) {
        const nextMessages = mergeChatHistory(state.messages, incomingMessages);
        if (nextMessages === state.messages) return;
        state = {
            ...state,
            messages: nextMessages
        };
        emit();
    }

    function reset() {
        state = {
            mode: 'hidden',
            isOpen: false,
            unreadCount: 0,
            activePlayerId: null,
            messages: []
        };
        emit();
    }

    function subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    }

    function onMessageAdded(listener) {
        messageAddedListeners.add(listener);
        return () => messageAddedListeners.delete(listener);
    }

    return {
        getState,
        setContext,
        setOpen,
        toggleOpen,
        addMessage,
        replaceHistory,
        reset,
        subscribe,
        onMessageAdded
    };
}

