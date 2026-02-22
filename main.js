/**
 * @module main
 * @description Main window entry point for the music visualizer.
 * Uses shared bootstrap initialization with Electron-specific features.
 */

import { initVisualization, stopAnimation } from './src/core/bootstrap.js';
import { initAudio, analyzeAudio, isAudioActive } from './src/audio/capture.js';
import { createGUI, createSpoutControls } from './src/gui/index.js';
import { createSettings } from './src/settings/defaults.js';
import { getSceneName } from './src/scenes/registry.js';
import { 
    syncSettingsToSpout, 
    syncAudioToSpout, 
    syncSceneToSpout,
    isSpoutAvailable
} from './src/spout/sync.js';

// === State ===
const settings = createSettings();
let app = null;

/**
 * Initialize the application with scene and Spout support.
 * @param {string} sceneType - Scene type to initialize
 */
async function init(sceneType) {
    // Initialize visualization
    app = await initVisualization({
        settings,
        sceneType,
        onSettingsChange: () => syncSettingsToSpout(settings),
        onAudioUpdate: (audioData) => {
            if (isAudioActive()) {
                syncAudioToSpout(audioData);
            }
        }
    });

    // Sync scene to Spout
    syncSceneToSpout(sceneType);

    // Create GUI
    createGUI(settings, null, () => syncSettingsToSpout(settings));

    // Add Spout controls if in Electron
    if (isSpoutAvailable() && window.isElectron) {
        const container = document.getElementById('controls');
        createSpoutControls(container, settings, async (enabled) => {
            if (enabled) {
                const result = await window.spoutAPI.enable();
                if (result.success) {
                    settings.spoutEnabled.value = true;
                    syncSettingsToSpout(settings);
                }
            } else {
                await window.spoutAPI.disable();
                settings.spoutEnabled.value = false;
            }
        }, async (name) => {
            if (settings.spoutEnabled.value) {
                await window.spoutAPI.updateName(name);
            }
        });

        // Listen for scene requests from spout window
        window.spoutAPI.onSceneRequest(() => {
            // Already handled by sync.js setupSpoutSyncListeners
        });

        window.spoutAPI.onStatusChange((enabled) => {
            settings.spoutEnabled.value = enabled;
        });
    }

    // Update scene indicator
    const indicator = document.getElementById('scene-indicator');
    if (indicator) {
        indicator.classList.add('visible');
        document.getElementById('scene-name').textContent = getSceneName(sceneType);
    }
}

// === Event Listeners ===

// Scene selection buttons
document.querySelectorAll('.scene-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        const sceneType = e.target.dataset.scene;
        document.getElementById('start-overlay').style.display = 'none';
        
        // Initialize audio first
        await initAudio();
        
        // Initialize visualization
        await init(sceneType);
        
        // Sync scene to Spout
        syncSceneToSpout(sceneType);
    });
});

// Scene change on indicator click
document.getElementById('scene-indicator')?.addEventListener('click', () => {
    // Stop animation
    stopAnimation();
    
    // Cleanup app if exists
    if (app) {
        app.cleanup();
        app = null;
    }
    
    // Show overlay again
    document.getElementById('start-overlay').style.display = 'flex';
    document.getElementById('scene-indicator').classList.remove('visible');
    
    // Clear controls
    document.getElementById('controls').innerHTML = '';
    document.getElementById('toggle-controls').classList.remove('visible');
});
