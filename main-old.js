/**
 * @module main
 * @description Main window entry point for the music visualizer.
 * Initializes WebGPU renderer, audio capture, scene management, and GUI.
 */

import WebGPU from 'three/addons/capabilities/WebGPU.js';

import { 
    initRenderer, 
    setupPostProcessing, 
    updateBloom, 
    updateControls, 
    resetCamera, 
    onWindowResize, 
    getRenderer, 
    getCamera, 
    getControls, 
    setAnimationLoop, 
    render 
} from './src/core/renderer.js';

import { getDelta } from './src/core/animation.js';
import { initScene, updateScene, getCurrentSceneType, getSceneName } from './src/scenes/registry.js';
import { initAudio, analyzeAudio, isAudioActive } from './src/audio/capture.js';
import { createGUI, createSpoutControls } from './src/gui/index.js';
import { createSettings } from './src/settings/defaults.js';
import { 
    syncSettingsToSpout, 
    syncAudioToSpout, 
    syncSceneToSpout 
} from './src/spout/sync.js';

// === State ===
const settings = createSettings();
let isInitialized = false;

/**
 * Main initialization function.
 * @param {string} sceneType - Scene type to initialize
 */
async function init(sceneType) {
    if (!WebGPU.isAvailable()) {
        document.body.appendChild(WebGPU.getErrorMessage());
        throw new Error('No WebGPU support');
    }

    // Initialize renderer once
    if (!isInitialized) {
        await initRenderer({
            autoRotate: settings.autoRotate.value,
            autoRotateSpeed: settings.autoRotateSpeed.value
        });
        
        window.addEventListener('resize', () => onWindowResize());
        isInitialized = true;
    }

    // Reset camera
    resetCamera();

    // Initialize scene
    const scene = await initScene(sceneType, getRenderer(), getCamera(), getControls());

    // Setup post-processing
    setupPostProcessing(scene, {
        strength: settings.bloomStrength.value,
        threshold: settings.bloomThreshold.value,
        radius: settings.bloomRadius.value
    });

    // Sync scene to Spout
    syncSceneToSpout(sceneType);
    
    // Create GUI
    createGUI(settings, null, () => syncSettingsToSpout(settings));
    
    // Add Spout controls if in Electron
    if (window.isElectron && window.spoutAPI) {
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
            const current = getCurrentSceneType();
            if (current) {
                window.spoutAPI.syncScene(current);
            }
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
    
    // Start animation loop
    setAnimationLoop(animate);
}

/**
 * Main animation loop.
 */
function animate() {
    const delta = getDelta();
    const renderer = getRenderer();

    // Analyze audio
    const audioData = analyzeAudio(settings);
    
    // Sync audio to Spout
    if (isAudioActive()) {
        syncAudioToSpout(audioData);
    }

    // Update bloom
    updateBloom({
        strength: settings.bloomStrength.value + audioData.bass * settings.bassBloom.value,
        threshold: settings.bloomThreshold.value,
        radius: settings.bloomRadius.value
    });

    // Update controls
    updateControls({
        autoRotate: settings.autoRotate.value,
        autoRotateSpeed: settings.autoRotateSpeed.value
    });

    // Update current scene
    updateScene(delta, settings, renderer);

    // Render
    render();
}

// === Event Listeners ===

// Scene selection buttons
document.querySelectorAll('.scene-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        const sceneType = e.target.dataset.scene;
        document.getElementById('start-overlay').style.display = 'none';
        await initAudio();
        await init(sceneType);
        
        // Sync scene to Spout
        syncSceneToSpout(sceneType);
    });
});

// Scene change on indicator click
document.getElementById('scene-indicator')?.addEventListener('click', () => {
    // Stop animation
    setAnimationLoop(null);
    
    // Show overlay again
    document.getElementById('start-overlay').style.display = 'flex';
    document.getElementById('scene-indicator').classList.remove('visible');
    
    // Clear controls
    document.getElementById('controls').innerHTML = '';
    document.getElementById('toggle-controls').classList.remove('visible');
});
