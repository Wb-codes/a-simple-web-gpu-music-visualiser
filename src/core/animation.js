/**
 * @module core/animation
 * @description Animation loop management and timing utilities.
 */

import * as THREE from 'three/webgpu';

/**
 * @typedef {Object} AnimationState
 * @property {number} delta - Time since last frame in seconds
 * @property {number} elapsed - Total elapsed time in seconds
 * @property {number} frameCount - Total frames rendered
 */

/** @type {THREE.Clock} */
const clock = new THREE.Clock();

/** @type {number} */
let frameCount = 0;

/** @type {Function|null} */
let updateCallback = null;

/** @type {Function|null} */
let renderCallback = null;

/**
 * Get delta time since last frame.
 * @returns {number} Delta time in seconds
 */
export function getDelta() {
    return clock.getDelta();
}

/**
 * Get total elapsed time.
 * @returns {number} Elapsed time in seconds
 */
export function getElapsedTime() {
    return clock.getElapsedTime();
}

/**
 * Get current frame count.
 * @returns {number}
 */
export function getFrameCount() {
    return frameCount;
}

/**
 * Get current animation state.
 * @returns {AnimationState}
 */
export function getAnimationState() {
    return {
        delta: clock.getDelta(),
        elapsed: clock.getElapsedTime(),
        frameCount
    };
}

/**
 * Set the update callback function.
 * Called each frame with delta time.
 * @param {Function} callback - Update function (delta: number) => void
 */
export function setUpdateCallback(callback) {
    updateCallback = callback;
}

/**
 * Set the render callback function.
 * Called after update, handles actual rendering.
 * @param {Function} callback - Render function () => void
 */
export function setRenderCallback(callback) {
    renderCallback = callback;
}

/**
 * Reset the animation clock.
 * Useful when switching scenes or restarting.
 */
export function resetClock() {
    clock.start();
    frameCount = 0;
}

/**
 * Create an animation loop handler.
 * Returns a function suitable for passing to renderer.setAnimationLoop().
 * @param {Object} options - Animation options
 * @param {Function} [options.update] - Update callback (delta, state) => void
 * @param {Function} [options.render] - Render callback () => void
 * @param {Function} [options.updateAudio] - Audio update callback () => void
 * @param {Function} [options.updateBloom] - Bloom update callback () => void
 * @param {Function} [options.updateControls] - Controls update callback () => void
 * @param {Function} [options.updateScene] - Scene update callback (delta, sceneType) => void
 * @param {Function} [options.syncToSpout] - Spout sync callback () => void
 * @returns {Function} Animation loop function
 */
export function createAnimationLoop(options = {}) {
    const {
        update,
        render,
        updateAudio,
        updateBloom,
        updateControls,
        updateScene,
        syncToSpout,
        getSceneType
    } = options;

    return function animationLoop() {
        const delta = clock.getDelta();
        frameCount++;

        // Update audio analysis
        if (updateAudio) updateAudio();

        // Update bloom effects
        if (updateBloom) updateBloom();

        // Update camera controls
        if (updateControls) updateControls();

        // Update current scene
        if (updateScene && getSceneType) {
            updateScene(delta, getSceneType());
        }

        // Custom update callback
        if (update) update(delta, getAnimationState());

        // Sync to Spout window
        if (syncToSpout) syncToSpout();

        // Render frame
        if (render) render();
    };
}

/**
 * Simple animation loop for spout renderer.
 * Minimal setup without audio/GUI.
 * @param {Object} sceneUpdaters - Scene update functions
 * @param {Function} sceneUpdaters.particles - Update particles scene
 * @param {Function} sceneUpdaters.points - Update points scene
 * @param {Function} sceneUpdaters.skinning - Update skinning scene
 * @returns {Function} Animation loop function
 */
export function createSimpleAnimationLoop(sceneUpdaters) {
    return function simpleAnimationLoop() {
        const delta = clock.getDelta();
        frameCount++;

        // Update controls
        // Handled by render() in renderer.js
        
        // Render handled externally
    };
}
