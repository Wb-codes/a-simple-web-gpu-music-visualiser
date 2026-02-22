/**
 * @module scenes/points
 * @description Instanced points scene with audio-reactive hilbert curve visualization.
 * Points flow along a 3D Hilbert curve path with pulsing animation.
 */

import * as THREE from 'three/webgpu';
import * as GeometryUtils from 'three/addons/utils/GeometryUtils.js';
import { 
    color, storage, Fn, instancedBufferAttribute, instanceIndex, sin, time, float, uniform, shapeCircle, mix, vec3
} from 'three/tsl';

import { audioBass, audioMid, audioHigh } from '../audio/uniforms.js';

/**
 * Points scene state and configuration.
 * @type {Object}
 */
export const pointsScene = {
    /** @type {THREE.Scene|null} */
    scene: null,
    /** @type {Object|null} */
    computeSize: null,
    /** @type {number} */
    divisions: 0,
    /** @type {number} */
    elapsedTime: 0,
    /** @type {THREE.PointLight|null} */
    light: null,
    /** @type {THREE.PointsNodeMaterial|null} */
    material: null,
    /** @type {THREE.Mesh|null} */
    backgroundMesh: null,
    
    // === Uniforms ===
    /** @type {import('three/tsl').UniformNode} */
    pulseSpeed: uniform(6),
    /** @type {import('three/tsl').UniformNode} */
    minWidth: uniform(6),
    /** @type {import('three/tsl').UniformNode} */
    maxWidth: uniform(20),
};

/**
 * Initialize the instanced points scene.
 * @param {THREE.WebGPURenderer} renderer - The WebGPU renderer
 * @param {THREE.PerspectiveCamera} camera - Main camera
 * @param {OrbitControls} controls - Camera controls
 * @returns {Promise<THREE.Scene>}
 */
export async function initPointsScene(renderer, camera, controls) {
    const scene = new THREE.Scene();

    // === Generate Hilbert Curve Points ===
    const points = GeometryUtils.hilbert3D(new THREE.Vector3(0, 0, 0), 20.0, 1, 0, 1, 2, 3, 4, 5, 6, 7);
    const spline = new THREE.CatmullRomCurve3(points);
    const divisions = Math.round(4 * points.length);
    pointsScene.divisions = divisions;

    const position = new THREE.Vector3();
    const pointColor = new THREE.Color();

    const positions = [];
    const colors = [];
    const sizes = new Float32Array(divisions);

    for (let i = 0; i < divisions; i++) {
        const t = i / divisions;
        spline.getPoint(t, position);
        positions.push(position.x, position.y, position.z);

        pointColor.setHSL(t, 1.0, 0.5, THREE.SRGBColorSpace);
        colors.push(pointColor.r, pointColor.g, pointColor.b);

        sizes[i] = 10.0;
    }

    // === Instanced Points ===
    const positionAttribute = new THREE.InstancedBufferAttribute(new Float32Array(positions), 3);
    const colorsAttribute = new THREE.InstancedBufferAttribute(new Float32Array(colors), 3);

    const instanceSizeBufferAttribute = new THREE.StorageInstancedBufferAttribute(sizes, 1);
    const instanceSizeStorage = storage(instanceSizeBufferAttribute, 'float', instanceSizeBufferAttribute.count);

    // === Compute Shader ===
    pointsScene.computeSize = Fn(() => {
        const relativeTime = time.add(float(instanceIndex));
        const sizeFactor = sin(relativeTime.mul(pointsScene.pulseSpeed)).add(1).div(2);
        instanceSizeStorage.element(instanceIndex).assign(sizeFactor.mul(pointsScene.maxWidth.sub(pointsScene.minWidth)).add(pointsScene.minWidth));
    })().compute(divisions);

    // === Material / Sprites ===
    const attributeRange = instancedBufferAttribute(instanceSizeBufferAttribute);
    const pointColors = mix(vec3(0.0), instancedBufferAttribute(colorsAttribute), attributeRange.div(float(pointsScene.maxWidth)));

    const material = new THREE.PointsNodeMaterial({
        colorNode: pointColors,
        opacityNode: shapeCircle(),
        positionNode: instancedBufferAttribute(positionAttribute),
        sizeNode: instancedBufferAttribute(instanceSizeBufferAttribute),
        vertexColors: true,
        sizeAttenuation: false,
        alphaToCoverage: true
    });

    const instancedPoints = new THREE.Sprite(material);
    instancedPoints.count = divisions;
    scene.add(instancedPoints);

    // === Background ===
    const backgroundGeom = new THREE.IcosahedronGeometry(100, 5).applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1));
    const backgroundMaterial = new THREE.MeshStandardNodeMaterial();
    backgroundMaterial.roughness = 0.4;
    backgroundMaterial.metalness = 0.9;
    backgroundMaterial.flatShading = true;
    backgroundMaterial.colorNode = color(0x0);
    const backgroundMesh = new THREE.Mesh(backgroundGeom, backgroundMaterial);
    scene.add(backgroundMesh);

    // === Light ===
    const light = new THREE.PointLight(0xffffff, 3000);
    scene.add(light);
    pointsScene.light = light;

    pointsScene.scene = scene;
    pointsScene.material = material;
    pointsScene.backgroundMesh = backgroundMesh;

    // === Set Camera ===
    camera.position.set(-40, 0, 60);
    controls.target.set(0, 0, 0);
    controls.update();

    return scene;
}

/**
 * Update points scene each frame.
 * @param {number} delta - Time since last frame in seconds
 * @param {Object} settings - Current settings values
 * @param {THREE.WebGPURenderer} renderer - The WebGPU renderer
 * @param {Object} audioData - Audio analysis data with bass, mid, high, overall
 */
export function updatePointsScene(delta, settings, renderer, audioData) {
    const { bass, mid, high } = audioData || { bass: 0, mid: 0, high: 0 };
    
    // Audio-reactive Max Width
    const maxWidth = settings.pointsMaxWidth.value + 
        (bass * settings.pointsMaxWidthBass.value) +
        (mid * settings.pointsMaxWidthMid.value) +
        (high * settings.pointsMaxWidthHigh.value);
    pointsScene.maxWidth.value = Math.min(maxWidth, 30); // Clamp to max
    
    // Audio-reactive Min Width
    const minWidth = settings.pointsMinWidth.value +
        (bass * settings.pointsMinWidthBass.value) +
        (mid * settings.pointsMinWidthMid.value) +
        (high * settings.pointsMinWidthHigh.value);
    pointsScene.minWidth.value = Math.min(minWidth, 30); // Clamp to max
    
    // Audio-reactive Pulse Speed
    const pulseSpeed = settings.pointsPulseSpeed.value +
        (bass * settings.pointsPulseSpeedBass.value) +
        (mid * settings.pointsPulseSpeedMid.value) +
        (high * settings.pointsPulseSpeedHigh.value);
    pointsScene.pulseSpeed.value = pulseSpeed;
    
    pointsScene.elapsedTime += delta;
    renderer.compute(pointsScene.computeSize);
    
    // Green screen toggle - hide icosahedron and use flat green background
    if (pointsScene.backgroundMesh) {
        pointsScene.backgroundMesh.visible = !settings.greenScreen.value;
    }
    if (pointsScene.scene) {
        pointsScene.scene.background = settings.greenScreen.value
            ? new THREE.Color(0x007900)
            : null;
    }
}
