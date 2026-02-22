/**
 * @module core/bootstrap
 * @description Shared application initialization for both browser and Electron versions.
 * Provides common setup logic that works across all entry points.
 */

import WebGPU from 'three/addons/capabilities/WebGPU.js';
import { initRenderer, setupPostProcessing, updateBloom, updateControls, resetCamera, onWindowResize, getRenderer, getCamera, getControls, setAnimationLoop, render } from './renderer.js';
import { getDelta } from './animation.js';
import { initScene, updateScene, getCurrentSceneType } from '../scenes/registry.js';
import { analyzeAudio } from '../audio/capture.js';

/**
 * Application state
 * @type {Object}
 */
const appState = {
    settings: null,
    isInitialized: false,
    onSettingsChange: null,
    onAudioUpdate: null,
    onRender: null
};

/**
 * Initialize the visualization application.
 * Works for both browser and Electron versions.
 * 
 * @param {Object} options - Initialization options
 * @param {Object} options.settings - Settings object
 * @param {string} options.sceneType - Scene type to initialize ('particles', 'points', 'skinning')
 * @param {Object} [options.rendererConfig] - Renderer configuration
 * @param {number} [options.rendererConfig.width] - Canvas width
 * @param {number} [options.rendererConfig.height] - Canvas height
 * @param {boolean} [options.rendererConfig.autoRotate] - Enable auto rotation
 * @param {number} [options.rendererConfig.autoRotateSpeed] - Rotation speed
 * @param {Function} [options.onSettingsChange] - Callback when settings change
 * @param {Function} [options.onAudioUpdate] - Callback when audio updates
 * @param {Function} [options.onRender] - Callback before each render
 * @returns {Promise<{scene: THREE.Scene, cleanup: Function}>}
 * @throws {Error} If WebGPU is not available
 */
export async function initVisualization(options) {
    const { settings, sceneType, rendererConfig = {}, onSettingsChange, onAudioUpdate, onRender } = options;
    
    appState.settings = settings;
    appState.onSettingsChange = onSettingsChange;
    appState.onAudioUpdate = onAudioUpdate;
    appState.onRender = onRender;

    // Check WebGPU support
    if (!WebGPU.isAvailable()) {
        document.body.appendChild(WebGPU.getErrorMessage());
        throw new Error('No WebGPU support');
    }

    // Initialize renderer once
    if (!appState.isInitialized) {
        await initRenderer({
            width: rendererConfig.width,
            height: rendererConfig.height,
            autoRotate: settings.autoRotate.value,
            autoRotateSpeed: settings.autoRotateSpeed.value
        });
        
        window.addEventListener('resize', () => onWindowResize(
            rendererConfig.width,
            rendererConfig.height
        ));
        
        appState.isInitialized = true;
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

    // Start animation loop
    setAnimationLoop(() => animate());

    // Return scene and cleanup function
    return {
        scene,
        cleanup: () => {
            setAnimationLoop(null);
            appState.isInitialized = false;
        }
    };
}

/**
 * Main animation loop - shared across all versions
 */
function animate() {
    const delta = getDelta();
    const renderer = getRenderer();
    const settings = appState.settings;

    if (!settings) return;

    // Analyze audio
    const audioData = analyzeAudio(settings);
    
    // Notify audio update callback
    if (appState.onAudioUpdate) {
        appState.onAudioUpdate(audioData);
    }

    // Update bloom (works fine even with audioData = {bass:0, ...})
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

    // Pre-render callback
    if (appState.onRender) {
        appState.onRender(delta, audioData);
    }

    // Render
    render();
}

/**
 * Get the current scene type
 * @returns {string|null}
 */
export function getCurrentScene() {
    return getCurrentSceneType();
}

/**
 * Check if application is initialized
 * @returns {boolean}
 */
export function isAppInitialized() {
    return appState.isInitialized;
}

/**
 * Update renderer options dynamically
 * @param {Object} options
 * @param {boolean} [options.autoRotate]
 * @param {number} [options.autoRotateSpeed]
 */
export function updateRendererOptions(options) {
    updateControls(options);
}

/**
 * Stop the animation loop
 */
export function stopAnimation() {
    setAnimationLoop(null);
}

/**
 * Restart the animation loop
 */
export function startAnimation() {
    setAnimationLoop(() => animate());
}
