/**
 * @module main
 * @description Main window entry point for the music visualizer.
 * Uses shared bootstrap initialization with Electron-specific features.
 */

import { initVisualization, stopAnimation } from './src/core/bootstrap.js';
import { initAudio, analyzeAudio, isAudioActive } from './src/audio/capture.js';
import { createPointsGUI, createParticlesGUI, createSkinningGUI } from './src/gui/index.js';
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
let currentSceneType = 'particles';

/**
 * Initialize the application with scene and Spout support.
 * @param {string} sceneType - Scene type to initialize
 */
async function init(sceneType) {
    currentSceneType = sceneType;
    
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

    // Create scene-specific GUI
    const container = document.getElementById('controls');
    const isElectron = window.isElectron === true;
    
    if (sceneType === 'points') {
        createPointsGUI(settings, container, () => syncSettingsToSpout(settings), isElectron);
    } else if (sceneType === 'particles') {
        createParticlesGUI(settings, container, () => syncSettingsToSpout(settings), isElectron);
    } else if (sceneType === 'skinning') {
        createSkinningGUI(settings, container, () => syncSettingsToSpout(settings), isElectron);
    } else {
        console.warn('Unknown scene type:', sceneType);
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
