/**
 * @module audio/uniforms
 * @description Audio reactive uniforms for TSL shaders.
 * These uniforms are updated by audio analysis and used in shader materials.
 */

import { uniform } from 'three/tsl';

/**
 * Bass frequency level (0-1).
 * Represents low frequencies (kick drum, bass guitar).
 * @type {import('three/tsl').UniformNode}
 */
export const audioBass = uniform(0.0);

/**
 * Mid frequency level (0-1).
 * Represents mid frequencies (vocals, guitars, synths).
 * @type {import('three/tsl').UniformNode}
 */
export const audioMid = uniform(0.0);

/**
 * High frequency level (0-1).
 * Represents high frequencies (hi-hats, cymbals, high synths).
 * @type {import('three/tsl').UniformNode}
 */
export const audioHigh = uniform(0.0);

/**
 * Overall audio level (0-1).
 * Average of bass, mid, and high levels.
 * @type {import('three/tsl').UniformNode}
 */
export const audioOverall = uniform(0.0);

/**
 * Update all audio uniforms at once.
 * @param {{bass: number, mid: number, high: number, overall: number}} data - Audio analysis data
 */
export function updateAudioUniforms(data) {
    if (data.bass !== undefined) audioBass.value = data.bass;
    if (data.mid !== undefined) audioMid.value = data.mid;
    if (data.high !== undefined) audioHigh.value = data.high;
    if (data.overall !== undefined) audioOverall.value = data.overall;
}

/**
 * Reset all audio uniforms to zero.
 * Call when audio is disabled or not available.
 */
export function resetAudioUniforms() {
    audioBass.value = 0.0;
    audioMid.value = 0.0;
    audioHigh.value = 0.0;
    audioOverall.value = 0.0;
}
