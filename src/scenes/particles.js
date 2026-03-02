/**
 * @module scenes/particles
 * @description Linked particles scene with audio-reactive particle network.
 * Particles are connected by dynamic links that form based on proximity.
 */

import * as THREE from 'three/webgpu';
import { audioBass, audioMid, audioHigh, audioOverall } from '../audio/uniforms.js';
import { createParticleEmitter } from '../components/ParticleEmitter.js';
import { createBackground } from '../components/Background.js';

/**
 * Particles scene state and configuration.
 * @type {Object}
 */
export const particlesScene = {
/** @type {THREE.Scene|null} */
scene: null,
/** @type {Object|null} */
emitter: null,
/** @type {THREE.PointLight|null} */
light: null,
/** @type {Object|null} */
background: null,
/** @type {THREE.Color} */
greenScreenColor: new THREE.Color(0x007900),
};

/**
 * Initialize the linked particles scene.
 * @param {THREE.WebGPURenderer} renderer - The WebGPU renderer
 * @param {THREE.PerspectiveCamera} camera - Main camera
 * @param {OrbitControls} controls - Camera controls
 * @returns {Promise<THREE.Scene>}
 */
export async function initParticlesScene(renderer, camera, controls) {
    const scene = new THREE.Scene();

    // === Create Particle Emitter Component ===
    const emitter = createParticleEmitter(renderer, scene, { nbParticles: Math.pow(2, 13) });
    particlesScene.emitter = emitter;

    // === Background Component ===
    const background = createBackground(scene, { radius: 100, detail: 5 });
    particlesScene.background = background;

    // === Light ===
    const light = new THREE.PointLight(0xffffff, 3000);
    scene.add(light);

    // === Store References ===
    particlesScene.scene = scene;
    particlesScene.light = light;
    
    // === Set Camera ===
    camera.position.set(0, 0, 15);
    controls.target.set(0, 0, 0);
    controls.update();
    
    return scene;
}

/**
 * Update particles scene each frame.
 * @param {number} delta - Time since last frame in seconds
 * @param {Object} settings - Current settings values
 * @param {THREE.WebGPURenderer} renderer - The WebGPU renderer
 */
export function updateParticlesScene(delta, settings, renderer) {
    // Update particle emitter component
    if (particlesScene.emitter) {
        particlesScene.emitter.update(delta, {
            ...settings,
            audioBass: audioBass.value,
            audioMid: audioMid.value,
            audioHigh: audioHigh.value,
            audioOverall: audioOverall.value
        });
    }

    // Animate light position
    const elapsedTime = particlesScene.emitter?.elapsedTime || 0;
    particlesScene.light.position.set(
        Math.sin(elapsedTime * 0.5) * 30,
        Math.cos(elapsedTime * 0.3) * 30,
        Math.sin(elapsedTime * 0.2) * 30
    );

    // Green screen toggle - hide background sphere and use flat green background
    const greenScreenEnabled = settings.greenScreen?.value === true;
    if (particlesScene.background) {
        particlesScene.background.setVisible(!greenScreenEnabled);
    }
	if (particlesScene.scene) {
		particlesScene.scene.background = greenScreenEnabled
			? particlesScene.greenScreenColor
			: null;
	}
}

/**
 * Cleanup particles scene and dispose resources
 */
export function cleanupParticlesScene() {
    if (!particlesScene.scene) return;

    console.log('[Particles] Cleaning up scene...');

    // Cleanup particle emitter component
    if (particlesScene.emitter) {
        particlesScene.emitter.cleanup();
        particlesScene.emitter = null;
    }

    // Cleanup background component
    if (particlesScene.background) {
        particlesScene.background.cleanup();
        particlesScene.background = null;
    }

    // Remove and dispose light
    if (particlesScene.light) {
        particlesScene.scene?.remove(particlesScene.light);
        particlesScene.light.dispose();
        particlesScene.light = null;
    }

    // Clear scene reference
    particlesScene.scene = null;

    console.log('[Particles] Cleanup complete');
}
