/**
 * @module scenes/particles
 * @description Linked particles scene with audio-reactive particle network.
 * Particles are connected by dynamic links that form based on proximity.
 */

import * as THREE from 'three/webgpu';
import { 
    atan, cos, float, max, min, PI, PI2, sin, vec2, vec3, 
    Fn, hash, hue, If, instanceIndex, Loop, mix,
    mx_fractal_noise_float, 
    mx_fractal_noise_vec3, storage, deltaTime, time, uv, 
    uniform, step, pcurve, color
} from 'three/tsl';

import { audioBass, audioMid, audioHigh, audioOverall } from '../audio/uniforms.js';

/**
 * Particles scene state and configuration.
 * @type {Object}
 */
export const particlesScene = {
    /** @type {THREE.Scene|null} */
    scene: null,
    /** @type {Object|null} */
    updateParticles: null,
    /** @type {Object|null} */
    spawnParticles: null,
    /** @type {number} */
    nbParticles: Math.pow(2, 13),
    /** @type {number} */
    elapsedTime: 0,
    /** @type {THREE.PointLight|null} */
    light: null,
    /** @type {THREE.Mesh|null} */
    backgroundMesh: null,
    
    // === Uniforms (must be uniforms for TSL) ===
    /** @type {import('three/tsl').UniformNode} */
    timeScale: uniform(1.0),
    /** @type {import('three/tsl').UniformNode} */
    particleLifetime: uniform(0.5),
    /** @type {import('three/tsl').UniformNode} */
    particleSize: uniform(1.0),
    /** @type {import('three/tsl').UniformNode} */
    linksWidth: uniform(0.005),
    /** @type {import('three/tsl').UniformNode} */
    colorOffset: uniform(0.0),
    /** @type {import('three/tsl').UniformNode} */
    colorVariance: uniform(2.0),
    /** @type {import('three/tsl').UniformNode} */
    colorRotationSpeed: uniform(1.0),
    /** @type {import('three/tsl').UniformNode} */
    spawnIndex: uniform(0),
    /** @type {import('three/tsl').UniformNode} */
    nbToSpawn: uniform(5),
    /** @type {import('three/tsl').UniformNode} */
    spawnPosition: uniform(vec3(0.0)),
    /** @type {import('three/tsl').UniformNode} */
    previousSpawnPosition: uniform(vec3(0.0)),
    /** @type {import('three/tsl').UniformNode} */
    turbFrequency: uniform(0.5),
    /** @type {import('three/tsl').UniformNode} */
    turbAmplitude: uniform(0.5),
    /** @type {import('three/tsl').UniformNode} */
    turbOctaves: uniform(2),
    /** @type {import('three/tsl').UniformNode} */
    turbLacunarity: uniform(2.0),
    /** @type {import('three/tsl').UniformNode} */
    turbGain: uniform(0.5),
    /** @type {import('three/tsl').UniformNode} */
    turbFriction: uniform(0.01),
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
    const nbParticles = particlesScene.nbParticles;

    // === Particle Buffers ===
    const particlePositionsBuffer = new THREE.StorageInstancedBufferAttribute(nbParticles, 4);
    const particleVelocitiesBuffer = new THREE.StorageInstancedBufferAttribute(nbParticles, 4);
    const particlePositions = storage(particlePositionsBuffer, 'vec4', nbParticles);
    const particleVelocities = storage(particleVelocitiesBuffer, 'vec4', nbParticles);

    // === Link Buffers ===
    const nbVertices = nbParticles * 8;
    const linksVerticesSBA = new THREE.StorageBufferAttribute(nbVertices, 4);
    const linksColorsSBA = new THREE.StorageBufferAttribute(nbVertices, 4);

    // === Color Function ===
    const getInstanceColor = Fn(([i]) => {
        return hue(color(0x0000ff), particlesScene.colorOffset.add(mx_fractal_noise_float(i.toFloat().mul(.1), 2, 2.0, 0.5, particlesScene.colorVariance)));
    });

    // === Particle Material ===
    const particleGeom = new THREE.PlaneGeometry(0.05, 0.05);
    const particleMaterial = new THREE.SpriteNodeMaterial();
    particleMaterial.blending = THREE.AdditiveBlending;
    particleMaterial.depthWrite = false;
    particleMaterial.positionNode = particlePositions.toAttribute();
    particleMaterial.scaleNode = vec2(particlesScene.particleSize);
    particleMaterial.rotationNode = atan(particleVelocities.toAttribute().y, particleVelocities.toAttribute().x);
    particleMaterial.colorNode = Fn(() => {
        const life = particlePositions.toAttribute().w;
        const modLife = pcurve(life.oneMinus(), 8.0, 1.0);
        const pulse = pcurve(sin(hash(instanceIndex).mul(PI2).add(time.mul(0.5).mul(PI2))).mul(0.5).add(0.5), 0.25, 0.25).mul(10.0).add(1.0);
        return getInstanceColor(instanceIndex).mul(pulse.mul(modLife));
    })();
    particleMaterial.opacityNode = Fn(() => {
        const circle = step(uv().xy.sub(0.5).length(), 0.5);
        const life = particlePositions.toAttribute().w;
        return circle.mul(life);
    })();

    const particleMesh = new THREE.InstancedMesh(particleGeom, particleMaterial, nbParticles);
    particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    particleMesh.frustumCulled = false;
    scene.add(particleMesh);

    // === Links Geometry ===
    const linksIndices = [];
    for (let i = 0; i < nbParticles; i++) {
        const baseIndex = i * 8;
        for (let j = 0; j < 2; j++) {
            const offset = baseIndex + j * 4;
            linksIndices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
        }
    }
    const linksGeom = new THREE.BufferGeometry();
    linksGeom.setAttribute('position', linksVerticesSBA);
    linksGeom.setAttribute('color', linksColorsSBA);
    linksGeom.setIndex(linksIndices);

    const linksMaterial = new THREE.MeshBasicNodeMaterial();
    linksMaterial.vertexColors = true;
    linksMaterial.side = THREE.DoubleSide;
    linksMaterial.transparent = true;
    linksMaterial.depthWrite = false;
    linksMaterial.depthTest = false;
    linksMaterial.blending = THREE.AdditiveBlending;
    linksMaterial.opacityNode = storage(linksColorsSBA, 'vec4', nbVertices).toAttribute().w;

    const linksMesh = new THREE.Mesh(linksGeom, linksMaterial);
    linksMesh.frustumCulled = false;
    scene.add(linksMesh);

    // === Update Compute Shader ===
    const updateParticles = Fn(() => {
        const position = particlePositions.element(instanceIndex).xyz;
        const life = particlePositions.element(instanceIndex).w;
        const velocity = particleVelocities.element(instanceIndex).xyz;
        const dt = deltaTime.mul(0.1).mul(particlesScene.timeScale);

        If(life.greaterThan(0.0), () => {
            const localVel = mx_fractal_noise_vec3(position.mul(particlesScene.turbFrequency), particlesScene.turbOctaves, particlesScene.turbLacunarity, particlesScene.turbGain, particlesScene.turbAmplitude).mul(life.add(.01));
            velocity.addAssign(localVel);
            velocity.mulAssign(particlesScene.turbFriction.oneMinus());
            position.addAssign(velocity.mul(dt));
            life.subAssign(dt.mul(particlesScene.particleLifetime.reciprocal()));

            // Find closest particles for links
            const closestDist1 = float(10000.0).toVar();
            const closestPos1 = vec3(0.0).toVar();
            const closestLife1 = float(0.0).toVar();
            const closestDist2 = float(10000.0).toVar();
            const closestPos2 = vec3(0.0).toVar();
            const closestLife2 = float(0.0).toVar();

            Loop(nbParticles, ({ i }) => {
                const otherPart = particlePositions.element(i);
                If(i.notEqual(instanceIndex).and(otherPart.w.greaterThan(0.0)), () => {
                    const otherPosition = otherPart.xyz;
                    const dist = position.sub(otherPosition).lengthSq();
                    const moreThanZero = dist.greaterThan(0.0);
                    If(dist.lessThan(closestDist1).and(moreThanZero), () => {
                        closestDist1.assign(dist);
                        closestPos1.assign(otherPosition.xyz);
                        closestLife1.assign(otherPart.w);
                    }).ElseIf(dist.lessThan(closestDist2).and(moreThanZero), () => {
                        closestDist2.assign(dist);
                        closestPos2.assign(otherPosition.xyz);
                        closestLife2.assign(otherPart.w);
                    });
                });
            });

            // Update link positions
            const linksPositions = storage(linksVerticesSBA, 'vec4', nbVertices);
            const linksColors = storage(linksColorsSBA, 'vec4', nbVertices);
            const firstLinkIndex = instanceIndex.mul(8);
            const secondLinkIndex = firstLinkIndex.add(4);

            linksPositions.element(firstLinkIndex).xyz.assign(position);
            linksPositions.element(firstLinkIndex).y.addAssign(particlesScene.linksWidth);
            linksPositions.element(firstLinkIndex.add(1)).xyz.assign(position);
            linksPositions.element(firstLinkIndex.add(1)).y.addAssign(particlesScene.linksWidth.negate());
            linksPositions.element(firstLinkIndex.add(2)).xyz.assign(closestPos1);
            linksPositions.element(firstLinkIndex.add(2)).y.addAssign(particlesScene.linksWidth.negate());
            linksPositions.element(firstLinkIndex.add(3)).xyz.assign(closestPos1);
            linksPositions.element(firstLinkIndex.add(3)).y.addAssign(particlesScene.linksWidth);

            linksPositions.element(secondLinkIndex).xyz.assign(position);
            linksPositions.element(secondLinkIndex).y.addAssign(particlesScene.linksWidth);
            linksPositions.element(secondLinkIndex.add(1)).xyz.assign(position);
            linksPositions.element(secondLinkIndex.add(1)).y.addAssign(particlesScene.linksWidth.negate());
            linksPositions.element(secondLinkIndex.add(2)).xyz.assign(closestPos2);
            linksPositions.element(secondLinkIndex.add(2)).y.addAssign(particlesScene.linksWidth.negate());
            linksPositions.element(secondLinkIndex.add(3)).xyz.assign(closestPos2);
            linksPositions.element(secondLinkIndex.add(3)).y.addAssign(particlesScene.linksWidth);

            // Update link colors
            const linkColor = getInstanceColor(instanceIndex);
            const l1 = max(0.0, min(closestLife1, life)).pow(0.8);
            const l2 = max(0.0, min(closestLife2, life)).pow(0.8);

            Loop(4, ({ i }) => {
                linksColors.element(firstLinkIndex.add(i)).xyz.assign(linkColor);
                linksColors.element(firstLinkIndex.add(i)).w.assign(l1);
                linksColors.element(secondLinkIndex.add(i)).xyz.assign(linkColor);
                linksColors.element(secondLinkIndex.add(i)).w.assign(l2);
            });
        });
    })().compute(nbParticles);

    // === Spawn Compute Shader ===
    const spawnParticles = Fn(() => {
        const particleIndex = particlesScene.spawnIndex.add(instanceIndex).mod(float(nbParticles)).toInt();
        const position = particlePositions.element(particleIndex).xyz;
        const life = particlePositions.element(particleIndex).w;
        const velocity = particleVelocities.element(particleIndex).xyz;

        If(instanceIndex.lessThan(particlesScene.nbToSpawn), () => {
            life.assign(1.0);
            const rRange = float(0.01);
            const rTheta = hash(particleIndex).mul(PI2);
            const rPhi = hash(particleIndex.add(1)).mul(PI);
            const rx = sin(rTheta).mul(cos(rPhi));
            const ry = sin(rTheta).mul(sin(rPhi));
            const rz = cos(rTheta);
            const rDir = vec3(rx, ry, rz);
            const pos = mix(particlesScene.previousSpawnPosition, particlesScene.spawnPosition, instanceIndex.toFloat().div(particlesScene.nbToSpawn.sub(1).toFloat()).clamp());
            position.assign(pos.add(rDir.mul(rRange)));
            velocity.assign(rDir.mul(5.0));
        });
    })().compute(200); // Max possible spawn rate

    // === Initialize Particles ===
    renderer.compute(Fn(() => {
        particlePositions.element(instanceIndex).xyz.assign(vec3(10000.0));
        particlePositions.element(instanceIndex).w.assign(float(-1.0));
    })().compute(nbParticles));

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

    // === Store References ===
    particlesScene.scene = scene;
    particlesScene.backgroundMesh = backgroundMesh;
    particlesScene.updateParticles = updateParticles;
    particlesScene.spawnParticles = spawnParticles;
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
    const bass = audioBass.value;
    const mid = audioMid.value;
    const high = audioHigh.value;
    const overall = audioOverall.value;

    // Audio-reactive parameters
    particlesScene.nbToSpawn.value = Math.floor(settings.baseSpawnRate.value + bass * settings.bassSpawnRate.value);
    particlesScene.turbAmplitude.value = settings.baseTurbulence.value + mid * settings.midTurbulence.value;
    particlesScene.turbFrequency.value = 0.5 + mid * settings.midFrequency.value;
    particlesScene.particleSize.value = settings.baseSize.value + high * settings.highSize.value;
    particlesScene.colorRotationSpeed.value = 1.0 + high * settings.highColorSpeed.value;
    particlesScene.particleLifetime.value = 0.5 + (1 - overall * settings.overallLifetime.value) * 0.5;

    // Run compute shaders
    renderer.compute(particlesScene.updateParticles);
    renderer.compute(particlesScene.spawnParticles);

    // Update spawn index
    particlesScene.spawnIndex.value = (particlesScene.spawnIndex.value + particlesScene.nbToSpawn.value) % particlesScene.nbParticles;

    // Update spawn position orbit
    const radius = settings.baseRadius.value + bass * settings.bassRadius.value;
    const speed = 0.5 + mid * settings.midSpeed.value;
    particlesScene.elapsedTime += delta;
    
    const targetPos = new THREE.Vector3(
        Math.sin(particlesScene.elapsedTime * speed) * radius,
        Math.cos(particlesScene.elapsedTime * speed * 1.3) * radius * 0.5,
        Math.sin(particlesScene.elapsedTime * speed * 0.7) * radius
    );
    
    particlesScene.previousSpawnPosition.value.copy(particlesScene.spawnPosition.value);
    particlesScene.spawnPosition.value.lerp(targetPos, 0.1);

    // Update color offset
    particlesScene.colorOffset.value += delta * particlesScene.colorRotationSpeed.value * particlesScene.timeScale.value;

    // Animate light position
    particlesScene.light.position.set(
        Math.sin(particlesScene.elapsedTime * 0.5) * 30,
        Math.cos(particlesScene.elapsedTime * 0.3) * 30,
        Math.sin(particlesScene.elapsedTime * 0.2) * 30
    );

    // Green screen toggle - hide icosahedron and use flat green background
    const greenScreenEnabled = settings.greenScreen?.value === true;
    if (particlesScene.backgroundMesh) {
        particlesScene.backgroundMesh.visible = !greenScreenEnabled;
    }
    if (particlesScene.scene) {
        particlesScene.scene.background = greenScreenEnabled 
            ? new THREE.Color(0x00FF00) 
            : null;
    }
}
