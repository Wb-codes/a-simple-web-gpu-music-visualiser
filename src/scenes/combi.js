/**
 * @module scenes/combi
 * @description Test scene combining particle emitter with other components.
 * Uses settings from Linked Particles scene for audio reactivity.
 */

import * as THREE from 'three/webgpu';
import { createParticleEmitter } from '../components/ParticleEmitter.js';
import { createTransformManager } from '../components/TransformManager.js';
import { audioBass, audioMid, audioHigh, audioOverall } from '../audio/uniforms.js';

/**
 * Combi scene state and configuration.
 * @type {Object}
 */
export const combiScene = {
    /** @type {THREE.Scene|null} */
    scene: null,
    /** @type {Array<Object>} */
    emitters: [],
    /** @type {THREE.PointLight|null} */
    light: null,
    /** @type {Object|null} */
    transformManager: null,
    /** @type {THREE.GridHelper|null} */
    gridHelper: null,
    /** @type {THREE.WebGPURenderer|null} */
    renderer: null,
    /** @type {Object|null} */
    controls: null,
    /** @type {number} */
    maxInstances: 3,
};

/**
 * Initialize the combi scene.
 * @param {THREE.WebGPURenderer} renderer - The WebGPU renderer
 * @param {THREE.PerspectiveCamera} camera - Main camera
 * @param {OrbitControls} controls - Camera controls
 * @returns {Promise<THREE.Scene>}
 */
export async function initCombiScene(renderer, camera, controls) {
    const scene = new THREE.Scene();

    // === Light ===
    const light = new THREE.PointLight(0xffffff, 3000);
    scene.add(light);

    // === Floor Plane Helper ===
    const gridHelper = new THREE.GridHelper(50, 50, 0x888888, 0x444444);
    gridHelper.position.y = -10;
    scene.add(gridHelper);
    combiScene.gridHelper = gridHelper;

    // === Transform Manager (Dynamic Gizmo System) ===
    console.log('[initCombiScene] Creating TransformManager...');
    const transformManager = createTransformManager(camera, renderer.domElement);
    transformManager.setOrbitControls(controls);
    
    // Create first emitter
    const emitter = createParticleEmitter(renderer, scene, { nbParticles: 4096 });
    emitter.group.position.set(-5, 0, 0);
    
    // Register component type
    transformManager.register(emitter, 'emitter', emitter.group);
    
    // Create first instance (so it shows up in instance list with gizmo)
    const instanceId = transformManager.createInstance('emitter', emitter.group, 0);
    
    // Store emitter
    combiScene.emitters.push({
        emitter,
        instanceId: instanceId || 'emitter_0',
        index: 0,
    });
    
    // Add gizmo helper to scene
    const gizmoHelper = transformManager.getGizmoHelper();
    if (gizmoHelper) {
        scene.add(gizmoHelper);
    }
    
    console.log('[initCombiScene] TransformManager created and first emitter registered');

    // === Store References ===
    combiScene.scene = scene;
    combiScene.light = light;
    combiScene.transformManager = transformManager;
    combiScene.renderer = renderer;
    combiScene.controls = controls;

    // === Set Camera ===
    camera.position.set(0, 0, 25);
    controls.target.set(0, 0, 0);
    controls.update();

    console.log('[Combi] Scene initialized with first emitter instance');

    return scene;
}

/**
 * Add a new emitter instance (public API)
 * @returns {boolean} True if added successfully
 */
export function addCombiEmitter() {
    if (!combiScene.transformManager || !combiScene.scene || !combiScene.renderer) {
        console.warn('[addCombiEmitter] Scene not initialized');
        return false;
    }
    
    // Check max instances
    if (combiScene.emitters.length >= combiScene.maxInstances) {
        console.log('[addCombiEmitter] Max instances reached:', combiScene.maxInstances);
        return false;
    }
    
    const index = combiScene.emitters.length;
    
    // Create emitter
    const emitter = createParticleEmitter(combiScene.renderer, combiScene.scene, { nbParticles: 4096 });
    
    // Position instances in a line
    emitter.group.position.set(-5 + (index * 5), 0, 0);
    
    // Create instance in transform manager
    const instanceId = combiScene.transformManager.createInstance('emitter', emitter.group, index);
    
    // Store emitter
    combiScene.emitters.push({
        emitter,
        instanceId: instanceId || `emitter_${index}`,
        index,
    });
    
    console.log(`[addCombiEmitter] Created emitter instance ${index} at position`, emitter.group.position);
    
    return true;
}

/**
 * Remove the last emitter instance
 * @returns {boolean} True if removed successfully
 */
export function removeCombiEmitter() {
    if (!combiScene.transformManager || combiScene.emitters.length <= 1) {
        console.warn('[removeCombiEmitter] Cannot remove - need at least 1 emitter');
        return false;
    }
    
    const lastItem = combiScene.emitters.pop();
    if (lastItem) {
        // Remove instance from transform manager
        combiScene.transformManager.removeInstance(lastItem.instanceId);
        
        // Cleanup emitter
        lastItem.emitter.cleanup();
        
        console.log(`[removeCombiEmitter] Removed emitter instance ${lastItem.index}`);
        return true;
    }
    
    return false;
}

/**
 * Get current emitter instance count
 * @returns {number}
 */
export function getCombiEmitterCount() {
    return combiScene.emitters.length;
}

/**
 * Get list of transformable instance IDs
 * @returns {string[]}
 */
export function getCombiInstanceIds() {
    if (combiScene.transformManager) {
        return combiScene.transformManager.getInstanceIds();
    }
    return [];
}

/**
 * Select a transformable instance by ID
 * @param {string} id - Instance ID
 * @returns {boolean}
 */
export function selectCombiInstance(id) {
    if (combiScene.transformManager) {
        combiScene.transformManager.select(id);
        return true;
    }
    return false;
}

/**
 * Get currently selected instance ID
 * @returns {string|null}
 */
export function getCombiSelectedInstance() {
    if (combiScene.transformManager) {
        return combiScene.transformManager.getSelectedName();
    }
    return null;
}

/**
 * Reset selected instance's position
 */
export function resetCombiPosition() {
    if (combiScene.transformManager) {
        combiScene.transformManager.resetPosition();
    }
}

/**
 * Reset selected instance's rotation
 */
export function resetCombiRotation() {
    if (combiScene.transformManager) {
        combiScene.transformManager.resetRotation();
    }
}

/**
 * Reset selected instance's scale
 */
export function resetCombiScale() {
    if (combiScene.transformManager) {
        combiScene.transformManager.resetScale();
    }
}

/**
 * Reset all transforms for selected instance
 */
export function resetCombiAll() {
    if (combiScene.transformManager) {
        combiScene.transformManager.resetAll();
    }
}

/**
 * Update combi scene each frame.
 * @param {number} delta - Time since last frame in seconds
 * @param {Object} settings - Current settings values (from Linked Particles scene)
 * @param {THREE.WebGPURenderer} renderer - The WebGPU renderer
 */
export function updateCombiScene(delta, settings, renderer) {
    // Update all emitter instances with audio data
    combiScene.emitters.forEach(({ emitter }) => {
        if (emitter) {
            emitter.update(delta, {
                ...settings,
                audioBass: audioBass.value,
                audioMid: audioMid.value,
                audioHigh: audioHigh.value,
                audioOverall: audioOverall.value
            });
        }
    });

    // Animate light position
    const elapsedTime = combiScene.emitters[0]?.emitter?.elapsedTime || 0;
    combiScene.light.position.set(
        Math.sin(elapsedTime * 0.5) * 30,
        Math.cos(elapsedTime * 0.3) * 30,
        Math.sin(elapsedTime * 0.2) * 30
    );

    // Toggle gizmo and grid visibility using TransformManager
    const showGizmo = settings.combiShowGizmo?.value === true;
    if (combiScene.transformManager) {
        combiScene.transformManager.update(showGizmo);
        
        // Update gizmo mode if changed
        const gizmoMode = settings.combiGizmoMode?.value || 'translate';
        if (combiScene.transformManager.getMode() !== gizmoMode) {
            combiScene.transformManager.setMode(gizmoMode);
        }
    }
    // Grid helper shows/hides with gizmo toggle
    if (combiScene.gridHelper) {
        combiScene.gridHelper.visible = showGizmo;
    }

    // Toggle camera auto-rotate
    if (combiScene.controls) {
        const autoRotateOff = settings.combiAutoRotateOff?.value === true;
        combiScene.controls.autoRotate = !autoRotateOff;
    }
}

/**
 * Cleanup combi scene and dispose resources.
 */
export function cleanupCombiScene() {
    if (!combiScene.scene) return;

    console.log('[Combi] Cleaning up scene...');

    // Cleanup all emitter instances
    combiScene.emitters.forEach(({ emitter }) => {
        if (emitter) {
            emitter.cleanup();
        }
    });
    combiScene.emitters = [];

    // Remove and dispose light
    if (combiScene.light) {
        combiScene.scene?.remove(combiScene.light);
        combiScene.light.dispose();
        combiScene.light = null;
    }

    // Remove grid helper
    if (combiScene.gridHelper) {
        combiScene.scene?.remove(combiScene.gridHelper);
        combiScene.gridHelper = null;
    }

    // Cleanup TransformManager (handles gizmo)
    if (combiScene.transformManager) {
        // Remove gizmo helper from scene
        const gizmoHelper = combiScene.transformManager.getGizmoHelper();
        if (gizmoHelper) {
            combiScene.scene?.remove(gizmoHelper);
        }
        combiScene.transformManager.cleanup();
        combiScene.transformManager = null;
    }

    // Clear references
    combiScene.scene = null;
    combiScene.renderer = null;
    combiScene.controls = null;

    console.log('[Combi] Cleanup complete');
}
