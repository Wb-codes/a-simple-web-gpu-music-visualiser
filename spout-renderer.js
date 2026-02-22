/**
 * @module spout-renderer
 * @description Spout window renderer - receives sync from main window
 */

import WebGPU from 'three/addons/capabilities/WebGPU.js';

import * as THREE from 'three/webgpu';

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
import { initScene, updateScene, getCurrentSceneType, switchScene, getSceneName } from './src/scenes/registry.js';
import { setupSpoutSyncListeners, updateAudioFromMain } from './src/spout/sync.js';
import { createSettings } from './src/settings/defaults.js';

const settings = createSettings();
let isInitialized = false;
let scene = null;

/**
 * Initialize the spout renderer.
 */
async function init() {
    if (!WebGPU.isAvailable()) {
        document.body.appendChild(WebGPU.getErrorMessage());
        throw new Error('No WebGPU support');
    }

    // Initialize renderer once
    if (!isInitialized) {
        await initRenderer({
            width: 1920,
            height: 1080,
            autoRotate: settings.autoRotate.value,
            autoRotateSpeed: settings.autoRotateSpeed.value
        });
        
        window.addEventListener('resize', () => onWindowResize(1920, 1080));
        isInitialized = true;
    }

    // Reset camera
    resetCamera();

    // Setup spout sync listeners
    setupSpoutSyncListeners({
        settings,
        onSettingsUpdate: (newSettings) => {
            // Settings are updated internally by setupSpoutSyncListeners
        },
        onAudioUpdate: (audioData) => {
            // Audio uniforms are updated internally
        },
        onSceneChange: async (sceneType) => {
            scene = await switchScene(sceneType, getRenderer(), getCamera(), getControls());
            setupPostProcessing(scene, {
                strength: settings.bloomStrength.value,
                threshold: settings.bloomThreshold.value,
                radius: settings.bloomRadius.value
            });
        }
    });

    // Initialize default scene
    scene = await initScene('particles', getRenderer(), getCamera(), getControls());

    // Setup post-processing
    setupPostProcessing(scene, {
        strength: settings.bloomStrength.value,
        threshold: settings.bloomThreshold.value,
        radius: settings.bloomRadius.value
    });

    console.log('Spout renderer starting, WebGPU available:', WebGPU.isAvailable());
    
    // Start animation loop
    setAnimationLoop(animate);
}

/**
 * Animation loop
 */
function animate() {
    const delta = getDelta();
    const renderer = getRenderer();

    // Update bloom
    updateBloom({
        strength: settings.bloomStrength.value,
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

// Initialize on load
init().catch(err => {
    console.error('Spout renderer init error:', err);
});
