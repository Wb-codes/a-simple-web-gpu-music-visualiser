/**
 * @module gui/audio-selector
 * @description Audio source selector UI for Electron mode.
 * Provides a modal dialog for selecting audio sources.
 */

/**
 * Show audio source selector UI (Electron mode).
 * @param {Array<{id: string, name: string, thumbnail: string}>} audioSources - Available audio sources
 * @param {Function} onSelect - Callback when a source is selected
 */
export function showAudioSourceSelector(audioSources, onSelect) {
    let selector = document.getElementById('audio-selector');
    if (!selector) {
        selector = document.createElement('div');
        selector.id = 'audio-selector';
        selector.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(20, 23, 26, 0.98);
            padding: 20px;
            border-radius: 10px;
            z-index: 2000;
            max-width: 400px;
            max-height: 60vh;
            overflow-y: auto;
            border: 1px solid #444;
        `;
        document.body.appendChild(selector);
    }
    
    selector.innerHTML = `
        <h3 style="color: #fff; margin-bottom: 15px; font-size: 16px;">Select Audio Source</h3>
        <div style="color: #888; font-size: 12px; margin-bottom: 10px;">
            Choose a window/screen to capture audio from:
        </div>
        <div id="audio-source-list" style="display: flex; flex-direction: column; gap: 8px;"></div>
        <button id="audio-cancel" style="
            margin-top: 15px;
            padding: 8px 16px;
            background: #444;
            border: none;
            color: #fff;
            border-radius: 5px;
            cursor: pointer;
            width: 100%;
        ">Cancel</button>
    `;
    
    const list = document.getElementById('audio-source-list');
    audioSources.forEach(source => {
        const item = document.createElement('div');
        item.style.cssText = `
            padding: 10px;
            background: #2a2d30;
            border-radius: 5px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 10px;
            transition: background 0.2s;
        `;
        item.onmouseenter = () => item.style.background = '#3a3d40';
        item.onmouseleave = () => item.style.background = '#2a2d30';
        item.innerHTML = `
            <div style="
                width: 60px;
                height: 40px;
                background: #111;
                border-radius: 3px;
                overflow: hidden;
                flex-shrink: 0;
            "><img src="${source.thumbnail}" style="width: 100%; height: 100%; object-fit: cover;"></div>
            <div style="color: #fff; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${source.name}</div>
        `;
        item.onclick = () => {
            onSelect(source);
            selector.remove();
        };
        list.appendChild(item);
    });
    
    document.getElementById('audio-cancel').onclick = () => {
        selector.remove();
    };
}

/**
 * Hide the audio source selector.
 */
export function hideAudioSourceSelector() {
    const selector = document.getElementById('audio-selector');
    if (selector) selector.remove();
}

/**
 * Update status display.
 * @param {string} message - Status message
 * @param {string} [type=''] - Status type ('', 'active', 'error')
 */
export function updateAudioStatus(message, type = '') {
    const statusEl = document.getElementById('audio-status');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = type;
    }
}

/**
 * Set audio status to connecting state.
 */
export function setAudioConnecting() {
    updateAudioStatus('Audio: Connecting...', '');
}

/**
 * Set audio status to active state.
 * @param {string} sourceName - Name of the audio source
 */
export function setAudioActive(sourceName) {
    const statusEl = document.getElementById('audio-status');
    if (statusEl) {
        statusEl.textContent = 'Audio: ' + sourceName.substring(0, 20);
        statusEl.className = 'active';
        statusEl.title = sourceName;
    }
}

/**
 * Set audio status to error state.
 * @param {string} message - Error message
 */
export function setAudioError(message) {
    updateAudioStatus('Audio: ' + message, 'error');
}

/**
 * Set audio status to select screen state.
 */
export function setAudioSelectScreen() {
    updateAudioStatus('Audio: Select screen to share', '');
}
