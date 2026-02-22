/**
 * @module spout/sync
 * @description Spout synchronization between main window and spout output window.
 * Handles syncing settings, audio, scene, and time data via IPC.
 */

import { audioBass, audioMid, audioHigh, audioOverall } from '../audio/uniforms.js';

/**
 * Check if Spout API is available.
 * @returns {boolean}
 */
export function isSpoutAvailable() {
    return typeof window.spoutAPI !== 'undefined';
}

/**
 * Check if Spout is currently enabled.
 * @param {Object} settings - Settings object with spoutEnabled property
 * @returns {boolean}
 */
export function isSpoutEnabled(settings) {
    return isSpoutAvailable() && settings.spoutEnabled?.value === true;
}

/**
 * Sync settings to Spout window.
 * @param {Object} settings - Settings object to sync
 */
export function syncSettingsToSpout(settings) {
    if (!isSpoutAvailable() || !settings.spoutEnabled?.value) return;
    
    const settingsData = {
        bassSensitivity: settings.bassSensitivity?.value,
        midSensitivity: settings.midSensitivity?.value,
        highSensitivity: settings.highSensitivity?.value,
        bassSpawnRate: settings.bassSpawnRate?.value,
        bassRadius: settings.bassRadius?.value,
        bassBloom: settings.bassBloom?.value,
        midTurbulence: settings.midTurbulence?.value,
        midFrequency: settings.midFrequency?.value,
        midSpeed: settings.midSpeed?.value,
        highSize: settings.highSize?.value,
        highColorSpeed: settings.highColorSpeed?.value,
        overallLifetime: settings.overallLifetime?.value,
        baseSpawnRate: settings.baseSpawnRate?.value,
        baseTurbulence: settings.baseTurbulence?.value,
        baseSize: settings.baseSize?.value,
        baseRadius: settings.baseRadius?.value,
        bloomStrength: settings.bloomStrength?.value,
        bloomThreshold: settings.bloomThreshold?.value,
        bloomRadius: settings.bloomRadius?.value,
        pulseSpeed: settings.pulseSpeed?.value,
        minWidth: settings.minWidth?.value,
        maxWidth: settings.maxWidth?.value,
        autoRotate: settings.autoRotate?.value,
        autoRotateSpeed: settings.autoRotateSpeed?.value,
        greenScreen: settings.greenScreen?.value
    };
    
    window.spoutAPI.syncSettings(settingsData);
}

/**
 * Sync audio data to Spout window.
 * @param {Object} audioData - Audio data with bass, mid, high, overall properties
 */
export function syncAudioToSpout(audioData) {
    if (!isSpoutAvailable()) return;
    window.spoutAPI.syncAudio(audioData);
}

/**
 * Sync scene type to Spout window.
 * @param {string} sceneType - Scene type identifier ('particles', 'points', 'skinning')
 */
export function syncSceneToSpout(sceneType) {
    if (!isSpoutAvailable()) return;
    window.spoutAPI.syncScene(sceneType);
}

/**
 * Sync elapsed time to Spout window.
 * @param {number} elapsedTime - Elapsed time in seconds
 */
export function syncTimeToSpout(elapsedTime) {
    if (!isSpoutAvailable()) return;
    window.spoutAPI.syncTime(elapsedTime);
}

/**
 * Sync all data to Spout window at once.
 * @param {Object} options - Sync options
 * @param {Object} options.settings - Settings object
 * @param {Object} options.audioData - Audio data
 * @param {string} options.sceneType - Scene type
 * @param {number} options.elapsedTime - Elapsed time
 */
export function syncAllToSpout(options) {
    const { settings, audioData, sceneType, elapsedTime } = options;
    
    if (settings) syncSettingsToSpout(settings);
    if (audioData) syncAudioToSpout(audioData);
    if (sceneType) syncSceneToSpout(sceneType);
    if (elapsedTime !== undefined) syncTimeToSpout(elapsedTime);
}

// ============================================================
// Spout Window (Receiver) Functions
// ============================================================

/**
 * Check if Spout Sync API is available (for spout-renderer).
 * @returns {boolean}
 */
export function isSpoutSyncAvailable() {
    return typeof window.spoutSync !== 'undefined';
}

/**
 * Register callback for settings updates from main window.
 * @param {Function} callback - Callback function receiving settings object
 */
export function onSettingsUpdate(callback) {
    if (!isSpoutSyncAvailable()) return;
    window.spoutSync.onSettings(callback);
}

/**
 * Register callback for audio updates from main window.
 * @param {Function} callback - Callback function receiving audio data
 */
export function onAudioUpdate(callback) {
    if (!isSpoutSyncAvailable()) return;
    window.spoutSync.onAudio(callback);
}

/**
 * Register callback for scene changes from main window.
 * @param {Function} callback - Callback function receiving scene type
 */
export function onSceneChange(callback) {
    if (!isSpoutSyncAvailable()) return;
    window.spoutSync.onScene(callback);
}

/**
 * Register callback for time updates from main window.
 * @param {Function} callback - Callback function receiving elapsed time
 */
export function onTimeUpdate(callback) {
    if (!isSpoutSyncAvailable()) return;
    window.spoutSync.onTime(callback);
}

/**
 * Update local settings from main window data.
 * @param {Object} settings - Local settings object to update
 * @param {Object} newSettings - New settings from main window
 */
export function updateSettingsFromMain(settings, newSettings) {
    if (!newSettings) return;
    
    for (const key in newSettings) {
        if (settings.hasOwnProperty(key)) {
            settings[key].value = newSettings[key];
        }
    }
}

/**
 * Update local audio uniforms from main window data.
 * @param {Object} audioData - Audio data from main window
 */
export function updateAudioFromMain(audioData) {
    if (!audioData) return;
    
    audioBass.value = audioData.bass || 0;
    audioMid.value = audioData.mid || 0;
    audioHigh.value = audioData.high || 0;
    audioOverall.value = audioData.overall || 0;
}

/**
 * Setup all spout sync listeners for spout-renderer.
 * @param {Object} options - Setup options
 * @param {Object} options.settings - Local settings object
 * @param {Function} options.onSettingsUpdate - Called when settings update
 * @param {Function} options.onAudioUpdate - Called when audio updates
 * @param {Function} options.onSceneChange - Called when scene changes
 */
export function setupSpoutSyncListeners(options) {
    const { settings, onSettingsUpdate, onAudioUpdate, onSceneChange: handleSceneChange } = options;
    
    if (isSpoutSyncAvailable()) {
        window.spoutSync.onSettings((newSettings) => {
            if (settings) updateSettingsFromMain(settings, newSettings);
            if (onSettingsUpdate) onSettingsUpdate(newSettings);
        });
        
        window.spoutSync.onAudio((audioData) => {
            updateAudioFromMain(audioData);
            if (onAudioUpdate) onAudioUpdate(audioData);
        });
        
        window.spoutSync.onScene((sceneType) => {
            console.log('Spout scene change received:', sceneType, 'type:', typeof sceneType, 'handler:', handleSceneChange);
            if (!sceneType) {
                console.error('ERROR: sceneType is undefined or null');
                return;
            }
            if (typeof sceneType !== 'string') {
                console.error('ERROR: sceneType is not a string:', sceneType);
                return;
            }
            if (handleSceneChange) handleSceneChange(sceneType);
            else console.error('ERROR: handleSceneChange is undefined');
        });
    }
}
