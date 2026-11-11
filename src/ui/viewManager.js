const ALL_VIEW_IDS = [
    'view-loading',
    'view-register',
    'view-menu',
    'view-lobby',
    'view-memorize',
    'view-guess',
    'view-round-results',
    'view-game-over'
];

/**
 * Coordinates view visibility, header updates, and view unmount/render lifecycles.
 */
export function createViewManager({ header, views }) {
    let activeViewId = null;

    function resolveViewId(state) {
        if (state.viewId === 'view-loading') return 'view-loading';
        if (state.roomData) {
            const statusMap = {
                lobby: 'view-lobby',
                memorize: 'view-memorize',
                guess: 'view-guess',
                round_results: 'view-round-results',
                game_over: 'view-game-over'
            };
            return statusMap[state.roomData.status] || state.viewId;
        }
        return state.viewId;
    }

    function render(state) {
        const targetViewId = resolveViewId(state);

        if (activeViewId && activeViewId !== targetViewId) {
            views[activeViewId]?.unmount?.();
        }
        activeViewId = targetViewId;

        ALL_VIEW_IDS.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            if (id === targetViewId) el.classList.remove('hidden');
            else el.classList.add('hidden');
        });

        header.render(state);
        views[targetViewId]?.render?.(state);
    }

    return { render };
}

