/**
* @module core/constants
* @description Shared constants used across the application
*/

/**
* Audio frequency band boundaries for analysis.
* FFT bin indices for separating bass, mid, and high frequencies.
* @constant
* @type {{bassEnd: number, midEnd: number}}
*/
export const AUDIO_BANDS = {
/** End index for bass frequencies (bins 0-3) */
bassEnd: 4,
/** End index for mid frequencies (bins 4-19) */
midEnd: 20
};

/**
* Scene type identifiers.
* @typedef {'particles' | 'skinning' | 'combi'} SceneType
*/

/**
* Human-readable scene names for UI display.
* @constant
* @type {Object.<SceneType, string>}
*/
export const SCENE_NAMES = {
particles: 'Linked Particles',
skinning: 'Skinning Points',
combi: 'Particle Combi'
};

/**
* Renderer configuration constants.
* @constant
* @type {{width: number, height: number, pixelRatio: number}}
*/
export const RENDERER_CONFIG = {
/** Default canvas width */
width: window.innerWidth,
/** Default canvas height */
height: window.innerHeight,
/** Pixel ratio for rendering */
pixelRatio: Math.min(window.devicePixelRatio, 2)
};
