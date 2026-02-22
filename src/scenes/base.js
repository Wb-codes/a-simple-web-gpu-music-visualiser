/**
 * @module scenes/base
 * @description Common scene utilities and base components.
 * Provides shared functionality for all visualization scenes.
 */

import * as THREE from 'three';
import { color } from 'three/tsl';

/**
 * Default background color (dark gray)
 * @constant {number}
 */
export const DEFAULT_BACKGROUND_COLOR = 0x14171a;

/**
 * Default light color (white)
 * @constant {number}
 */
export const DEFAULT_LIGHT_COLOR = 0xffffff;

/**
 * Default light intensity
 * @constant {number}
 */
export const DEFAULT_LIGHT_INTENSITY = 3000;

/**
 * Create a standard background mesh for scenes.
 * Uses an inverted icosahedron to create an environment sphere.
 * 
 * @param {Object} [options] - Background options
 * @param {number} [options.radius=100] - Background sphere radius
 * @param {number} [options.detail=5] - Geometry detail level
 * @param {number} [options.color=0x0] - Background color
 * @returns {THREE.Mesh} The background mesh
 */
export function createSceneBackground(options = {}) {
    const {
        radius = 100,
        detail = 5,
        color = 0x0
    } = options;

    const geometry = new THREE.IcosahedronGeometry(radius, detail).applyMatrix4(
        new THREE.Matrix4().makeScale(-1, 1, 1)
    );
    
    const material = new THREE.MeshStandardNodeMaterial();
    material.roughness = 0.4;
    material.metalness = 0.9;
    material.flatShading = true;
    material.colorNode = color(color);
    
    return new THREE.Mesh(geometry, material);
}

/**
 * Create a standard point light for scenes.
 * 
 * @param {Object} [options] - Light options
 * @param {number} [options.color=0xffffff] - Light color
 * @param {number} [options.intensity=3000] - Light intensity
 * @returns {THREE.PointLight} The point light
 */
export function createSceneLight(options = {}) {
    const {
        color = DEFAULT_LIGHT_COLOR,
        intensity = DEFAULT_LIGHT_INTENSITY
    } = options;

    return new THREE.PointLight(color, intensity);
}

/**
 * Create ambient light for scenes.
 * 
 * @param {Object} [options] - Ambient light options
 * @param {number} [options.color=0xffffff] - Light color
 * @param {number} [options.intensity=10] - Light intensity
 * @returns {THREE.AmbientLight} The ambient light
 */
export function createAmbientLight(options = {}) {
    const {
        color = 0xffffff,
        intensity = 10
    } = options;

    return new THREE.AmbientLight(color, intensity);
}

/**
 * Setup standard scene environment with background and lighting.
 * 
 * @param {THREE.Scene} scene - The scene to setup
 * @param {Object} [options] - Setup options
 * @param {boolean} [options.includeBackground=true] - Include background mesh
 * @param {boolean} [options.includePointLight=true] - Include point light
 * @param {boolean} [options.includeAmbient=false] - Include ambient light
 * @returns {Object} References to created objects
 */
export function setupSceneEnvironment(scene, options = {}) {
    const {
        includeBackground = true,
        includePointLight = true,
        includeAmbient = false
    } = options;

    const refs = {
        background: null,
        pointLight: null,
        ambientLight: null
    };

    if (includeBackground) {
        refs.background = createSceneBackground();
        scene.add(refs.background);
    }

    if (includePointLight) {
        refs.pointLight = createSceneLight();
        scene.add(refs.pointLight);
    }

    if (includeAmbient) {
        refs.ambientLight = createAmbientLight();
        scene.add(refs.ambientLight);
    }

    return refs;
}

/**
 * Update light position based on time for animation.
 * 
 * @param {THREE.PointLight} light - The light to animate
 * @param {number} elapsedTime - Elapsed time in seconds
 * @param {Object} [options] - Animation options
 * @param {number} [options.radius=30] - Orbit radius
 * @param {number} [options.speed=0.5] - Animation speed
 */
export function animateLightPosition(light, elapsedTime, options = {}) {
    const {
        radius = 30,
        speed = 0.5
    } = options;

    light.position.set(
        Math.sin(elapsedTime * speed) * radius,
        Math.cos(elapsedTime * speed * 0.6) * radius,
        Math.sin(elapsedTime * speed * 0.4) * radius
    );
}

/**
 * Create a sprite material with common settings.
 * 
 * @param {Object} options - Material options
 * @param {Object} options.colorNode - TSL color node
 * @param {Object} options.opacityNode - TSL opacity node
 * @param {Object} options.positionNode - TSL position node
 * @param {Object} options.sizeNode - TSL size node
 * @param {Object} options.rotationNode - TSL rotation node
 * @returns {THREE.SpriteNodeMaterial}
 */
export function createSpriteMaterial(options) {
    const material = new THREE.SpriteNodeMaterial();
    
    material.blending = THREE.AdditiveBlending;
    material.depthWrite = false;
    
    if (options.colorNode) material.colorNode = options.colorNode;
    if (options.opacityNode) material.opacityNode = options.opacityNode;
    if (options.positionNode) material.positionNode = options.positionNode;
    if (options.sizeNode) material.sizeNode = options.sizeNode;
    if (options.rotationNode) material.rotationNode = options.rotationNode;
    
    return material;
}

/**
 * Create instanced mesh with common settings.
 * 
 * @param {THREE.BufferGeometry} geometry - Base geometry
 * @param {THREE.Material} material - Material
 * @param {number} count - Instance count
 * @returns {THREE.InstancedMesh}
 */
export function createInstancedMesh(geometry, material, count) {
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    return mesh;
}

/**
 * Create storage buffer for compute shaders.
 * 
 * @param {number} count - Element count
 * @param {number} itemSize - Items per element
 * @returns {THREE.StorageBufferAttribute}
 */
export function createStorageBuffer(count, itemSize) {
    return new THREE.StorageBufferAttribute(count, itemSize);
}

/**
 * Create instanced storage buffer for compute shaders.
 * 
 * @param {number} count - Instance count
 * @param {number} itemSize - Items per instance
 * @returns {THREE.StorageInstancedBufferAttribute}
 */
export function createInstancedStorageBuffer(count, itemSize) {
    return new THREE.StorageInstancedBufferAttribute(count, itemSize);
}

/**
 * Standard scene camera positions by scene type.
 * @constant {Object.<string, THREE.Vector3>}
 */
export const SCENE_CAMERA_POSITIONS = {
    particles: new THREE.Vector3(0, 0, 15),
    points: new THREE.Vector3(-40, 0, 60),
    skinning: new THREE.Vector3(0, 300, -85)
};

/**
 * Standard scene camera targets by scene type.
 * @constant {Object.<string, THREE.Vector3>}
 */
export const SCENE_CAMERA_TARGETS = {
    particles: new THREE.Vector3(0, 0, 0),
    points: new THREE.Vector3(0, 0, 0),
    skinning: new THREE.Vector3(0, 0, -85)
};

/**
 * Position camera for a specific scene type.
 * 
 * @param {THREE.PerspectiveCamera} camera - The camera
 * @param {OrbitControls} controls - The controls
 * @param {string} sceneType - Scene type ('particles', 'points', 'skinning')
 */
export function positionCameraForScene(camera, controls, sceneType) {
    const position = SCENE_CAMERA_POSITIONS[sceneType];
    const target = SCENE_CAMERA_TARGETS[sceneType];
    
    if (position && target) {
        camera.position.copy(position);
        controls.target.copy(target);
        controls.update();
        
        if (sceneType === 'skinning') {
            camera.lookAt(target);
        }
    }
}
