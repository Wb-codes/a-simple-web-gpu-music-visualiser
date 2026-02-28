/**
 * @module scenes/registry
 * @description Scene registry for managing scene switching and lifecycle.
 */

import * as THREE from 'three/webgpu';

import { initParticlesScene, updateParticlesScene, cleanupParticlesScene } from './particles.js';
import { initPointsScene, updatePointsScene, cleanupPointsScene } from './points.js';
import { initSkinningScene, updateSkinningScene, cleanupSkinningScene } from './skinning.js';
import { SCENE_NAMES } from '../core/constants.js';
import { disposeScene } from '../utils/disposal.js';

/** @typedef {'particles' | 'points' | 'skinning'} SceneType */

/** @type {Object.<SceneType, {init: Function, update: Function, cleanup: Function}>} */
const sceneRegistry = {
  particles: {
    init: initParticlesScene,
    update: updateParticlesScene,
    cleanup: cleanupParticlesScene
  },
  points: {
    init: initPointsScene,
    update: updatePointsScene,
    cleanup: cleanupPointsScene
  },
  skinning: {
    init: initSkinningScene,
    update: updateSkinningScene,
    cleanup: cleanupSkinningScene
  }
};

/** @type {SceneType|null} */
let currentSceneType = null;

/** @type {THREE.Scene|null} */
let currentScene = null;

/** @type {Function|null} */
let currentSceneCleanup = null;

/**
 * Get the current scene type.
 * @returns {SceneType|null}
 */
export function getCurrentSceneType() {
    return currentSceneType;
}

/**
 * Initialize a scene by type.
 * @param {SceneType} sceneType - The scene to initialize
 * @param {THREE.WebGPURenderer} renderer - The WebGPU renderer
 * @param {THREE.PerspectiveCamera} camera - Main camera
 * @param {OrbitControls} controls - Camera controls
 * @returns {Promise<THREE.Scene>}
 */
export async function initScene(sceneType, renderer, camera, controls) {
  const sceneConfig = sceneRegistry[sceneType];
  if (!sceneConfig) {
    throw new Error(`Unknown scene type: ${sceneType}`);
  }

  // Cleanup previous scene before switching
  if (currentScene && currentSceneCleanup) {
    console.log(`[Registry] Cleaning up previous scene: ${currentSceneType}`);
    try {
      currentSceneCleanup();
      disposeScene(currentScene);
    } catch (err) {
      console.error('[Registry] Error cleaning up scene:', err);
    }
    currentScene = null;
    currentSceneCleanup = null;
  }

  currentSceneType = sceneType;
  const scene = await sceneConfig.init(renderer, camera, controls);
  currentScene = scene;
  currentSceneCleanup = sceneConfig.cleanup;
  
  return scene;
}

/**
 * Update the current scene.
 * @param {number} delta - Time since last frame in seconds
 * @param {Object} settings - Current settings values
 * @param {THREE.WebGPURenderer} renderer - The WebGPU renderer
 * @param {Object} audioData - Audio analysis data with bass, mid, high, overall
 */
export function updateScene(delta, settings, renderer, audioData) {
    if (!currentSceneType) return;
    
    const sceneConfig = sceneRegistry[currentSceneType];
    if (sceneConfig) {
        sceneConfig.update(delta, settings, renderer, audioData);
    }
}

/**
 * Get human-readable scene name.
 * @param {SceneType} sceneType
 * @returns {string}
 */
export function getSceneName(sceneType) {
    return SCENE_NAMES[sceneType] || sceneType;
}

/**
 * Get all available scene types.
 * @returns {SceneType[]}
 */
export function getAvailableScenes() {
    return Object.keys(sceneRegistry);
}

/**
 * Switch to a different scene.
 * @param {SceneType} sceneType - The scene type to switch to
 * @param {THREE.WebGPURenderer} renderer - The WebGPU renderer
 * @param {THREE.PerspectiveCamera} camera - Main camera
 * @param {OrbitControls} controls - Camera controls
 * @returns {Promise<THREE.Scene>}
 */
export async function switchScene(sceneType, renderer, camera, controls) {
    console.log('switchScene called with:', sceneType, 'type:', typeof sceneType);
    
    if (!sceneType || typeof sceneType !== 'string') {
        console.error('Invalid sceneType:', sceneType);
        throw new Error('Invalid sceneType: ' + sceneType);
    }
    
    // Reset camera for new scene
    if (camera && controls) {
        camera.position.set(0, 0, 15);
        controls.target.set(0, 0, 0);
        controls.update();
    }
    
    return initScene(sceneType, renderer, camera, controls);
}
