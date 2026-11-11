/**
 * Renders the connection/loading view status message.
 */
export function createLoadingView() {
    const statusMsg = document.getElementById('loading-status-msg');

    function render(state) {
        if (statusMsg && state.loadingMessage) {
            statusMsg.textContent = state.loadingMessage;
        }
    }

    return { render };
}

