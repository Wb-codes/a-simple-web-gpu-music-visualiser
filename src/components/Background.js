/**
 * @module components/Background
 * @description Reusable background sphere component for scenes.
 */

import * as THREE from 'three/webgpu';
import { color } from 'three/tsl';

/**
 * Create a background component.
 * @param {THREE.Scene} scene - The scene to add the background to
 * @param {Object} config - Configuration options
 * @param {number} [config.radius=100] - Radius of the background sphere
 * @param {number} [config.detail=5] - Detail level for icosahedron
 * @param {number} [config.roughness=0.4] - Material roughness
 * @param {number} [config.metalness=0.9] - Material metalness
 * @param {number} [config.color=0x0] - Base color
 * @returns {Object} Component interface with mesh, setVisible, setColor, cleanup methods
 */
export function createBackground(scene, config = {}) {
    const state = {
        radius: config.radius || 100,
        detail: config.detail || 5,
        roughness: config.roughness ?? 0.4,
        metalness: config.metalness ?? 0.9,
        color: config.color ?? 0x0,
        mesh: null,
    };

    init(scene);

    function init(scene) {
        const geometry = new THREE.IcosahedronGeometry(state.radius, state.detail)
            .applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1));

        const material = new THREE.MeshStandardNodeMaterial();
        material.roughness = state.roughness;
        material.metalness = state.metalness;
        material.flatShading = true;
        material.colorNode = color(state.color);

        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
        state.mesh = mesh;
    }

    /**
     * Set visibility of the background.
     * @param {boolean} visible - Whether the background is visible
     */
    function setVisible(visible) {
        if (state.mesh) {
            state.mesh.visible = visible;
        }
    }

    /**
     * Set the background color.
     * @param {number} colorHex - Color as hex number
     */
    function setColor(colorHex) {
        state.color = colorHex;
    }

    /**
     * Cleanup and dispose resources.
     */
    function cleanup() {
        if (state.mesh) {
            state.mesh.parent?.remove(state.mesh);
            state.mesh.geometry?.dispose();
            state.mesh.material?.dispose();
            state.mesh = null;
        }
    }

    return {
        get mesh() { return state.mesh; },
        setVisible,
        setColor,
        cleanup,
    };
}
