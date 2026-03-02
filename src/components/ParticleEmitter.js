/**
 * @module components/ParticleEmitter
 * @description Reusable particle emitter with linked particle system.
 * Audio-reactive particle network with dynamic spawning and proximity-based linking.
 */

import * as THREE from 'three/webgpu';
import {
    atan, cos, float, max, min, PI, PI2, sin, vec2, vec3,
    Fn, hash, hue, If, instanceIndex, Loop, mix,
    mx_fractal_noise_float,
    mx_fractal_noise_vec3, storage, deltaTime, time, uv,
    uniform, step, pcurve, color
} from 'three/tsl';

/**
 * Create a particle emitter component.
 * @param {THREE.WebGPURenderer} renderer - The WebGPU renderer
 * @param {THREE.Scene} scene - The scene to add meshes to
 * @param {Object} config - Configuration options
 * @param {number} [config.nbParticles=8192] - Number of particles
 * @returns {Object} Component interface with group, update, cleanup methods
 */
export function createParticleEmitter(renderer, scene, config = {}) {
    const nbParticles = config.nbParticles || Math.pow(2, 13);
    
    const emitterState = {
        group: new THREE.Group(),
        nbParticles,
        elapsedTime: 0,
        
        // Uniforms
        timeScale: uniform(1.0),
        particleLifetime: uniform(0.5),
        particleSize: uniform(1.0),
        linksWidth: uniform(0.005),
        colorOffset: uniform(0.0),
        colorVariance: uniform(2.0),
        colorRotationSpeed: uniform(1.0),
        spawnIndex: uniform(0),
        nbToSpawn: uniform(5),
        spawnPosition: uniform(vec3(0.0)),
        previousSpawnPosition: uniform(vec3(0.0)),
        turbFrequency: uniform(0.5),
        turbAmplitude: uniform(0.5),
        turbOctaves: uniform(2),
        turbLacunarity: uniform(2.0),
        turbGain: uniform(0.5),
        turbFriction: uniform(0.01),
        
        // Compute shaders (set after creation)
        updateParticles: null,
        spawnParticles: null,
        
        // Meshes
        particleMesh: null,
        particleGeometry: null,
        linksMesh: null,
        
        // Storage buffers
        particlePositionsBuffer: null,
        particleVelocitiesBuffer: null,
        linksVerticesSBA: null,
        linksColorsSBA: null,
    };

    init(renderer, scene);

    function init(renderer, scene) {
        // === Particle Buffers ===
        const particlePositionsBuffer = new THREE.StorageInstancedBufferAttribute(nbParticles, 4);
        const particleVelocitiesBuffer = new THREE.StorageInstancedBufferAttribute(nbParticles, 4);
        const particlePositions = storage(particlePositionsBuffer, 'vec4', nbParticles);
        const particleVelocities = storage(particleVelocitiesBuffer, 'vec4', nbParticles);

        // Store particle buffers for cleanup
        emitterState.particlePositionsBuffer = particlePositionsBuffer;
        emitterState.particleVelocitiesBuffer = particleVelocitiesBuffer;

        // === Link Buffers ===
        const nbVertices = nbParticles * 8;
        const linksVerticesSBA = new THREE.StorageBufferAttribute(nbVertices, 4);
        const linksColorsSBA = new THREE.StorageBufferAttribute(nbVertices, 4);

        // Store link buffers for cleanup
        emitterState.linksVerticesSBA = linksVerticesSBA;
        emitterState.linksColorsSBA = linksColorsSBA;

        // === Color Function ===
        const getInstanceColor = Fn(([i]) => {
            return hue(color(0x0000ff), emitterState.colorOffset.add(mx_fractal_noise_float(i.toFloat().mul(.1), 2, 2.0, 0.5, emitterState.colorVariance)));
        });

        // === Particle Material ===
        const particleGeom = new THREE.PlaneGeometry(0.05, 0.05);
        const particleMaterial = new THREE.SpriteNodeMaterial();
        particleMaterial.blending = THREE.AdditiveBlending;
        particleMaterial.depthWrite = false;
        particleMaterial.positionNode = particlePositions.toAttribute();
        particleMaterial.scaleNode = vec2(emitterState.particleSize);
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
        emitterState.group.add(particleMesh);
        emitterState.particleMesh = particleMesh;
        emitterState.particleGeometry = particleGeom;

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
        emitterState.group.add(linksMesh);
        emitterState.linksMesh = linksMesh;

        // === Update Compute Shader ===
        const updateParticles = Fn(() => {
            const position = particlePositions.element(instanceIndex).xyz;
            const life = particlePositions.element(instanceIndex).w;
            const velocity = particleVelocities.element(instanceIndex).xyz;
            const dt = deltaTime.mul(0.1).mul(emitterState.timeScale);

            If(life.greaterThan(0.0), () => {
                const localVel = mx_fractal_noise_vec3(position.mul(emitterState.turbFrequency), emitterState.turbOctaves, emitterState.turbLacunarity, emitterState.turbGain, emitterState.turbAmplitude).mul(life.add(.01));
                velocity.addAssign(localVel);
                velocity.mulAssign(emitterState.turbFriction.oneMinus());
                position.addAssign(velocity.mul(dt));
                life.subAssign(dt.mul(emitterState.particleLifetime.reciprocal()));

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
                linksPositions.element(firstLinkIndex).y.addAssign(emitterState.linksWidth);
                linksPositions.element(firstLinkIndex.add(1)).xyz.assign(position);
                linksPositions.element(firstLinkIndex.add(1)).y.addAssign(emitterState.linksWidth.negate());
                linksPositions.element(firstLinkIndex.add(2)).xyz.assign(closestPos1);
                linksPositions.element(firstLinkIndex.add(2)).y.addAssign(emitterState.linksWidth.negate());
                linksPositions.element(firstLinkIndex.add(3)).xyz.assign(closestPos1);
                linksPositions.element(firstLinkIndex.add(3)).y.addAssign(emitterState.linksWidth);

                linksPositions.element(secondLinkIndex).xyz.assign(position);
                linksPositions.element(secondLinkIndex).y.addAssign(emitterState.linksWidth);
                linksPositions.element(secondLinkIndex.add(1)).xyz.assign(position);
                linksPositions.element(secondLinkIndex.add(1)).y.addAssign(emitterState.linksWidth.negate());
                linksPositions.element(secondLinkIndex.add(2)).xyz.assign(closestPos2);
                linksPositions.element(secondLinkIndex.add(2)).y.addAssign(emitterState.linksWidth.negate());
                linksPositions.element(secondLinkIndex.add(3)).xyz.assign(closestPos2);
                linksPositions.element(secondLinkIndex.add(3)).y.addAssign(emitterState.linksWidth);

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
            const particleIndex = emitterState.spawnIndex.add(instanceIndex).mod(float(nbParticles)).toInt();
            const position = particlePositions.element(particleIndex).xyz;
            const life = particlePositions.element(particleIndex).w;
            const velocity = particleVelocities.element(particleIndex).xyz;

            If(instanceIndex.lessThan(emitterState.nbToSpawn), () => {
                life.assign(1.0);
                const rRange = float(0.01);
                const rTheta = hash(particleIndex).mul(PI2);
                const rPhi = hash(particleIndex.add(1)).mul(PI);
                const rx = sin(rTheta).mul(cos(rPhi));
                const ry = sin(rTheta).mul(sin(rPhi));
                const rz = cos(rTheta);
                const rDir = vec3(rx, ry, rz);
                const pos = mix(emitterState.previousSpawnPosition, emitterState.spawnPosition, instanceIndex.toFloat().div(emitterState.nbToSpawn.sub(1).toFloat()).clamp());
                position.assign(pos.add(rDir.mul(rRange)));
                velocity.assign(rDir.mul(5.0));
            });
        })().compute(200);

        // === Initialize Particles ===
        renderer.compute(Fn(() => {
            particlePositions.element(instanceIndex).xyz.assign(vec3(10000.0));
            particlePositions.element(instanceIndex).w.assign(float(-1.0));
        })().compute(nbParticles));

        // Store compute shaders
        emitterState.updateParticles = updateParticles;
        emitterState.spawnParticles = spawnParticles;

        // Add group to scene
        scene.add(emitterState.group);
    }

    /**
     * Update the particle emitter each frame.
     * @param {number} delta - Time since last frame in seconds
     * @param {Object} settings - Settings object (reads audio-reactive settings from this)
     */
    function update(delta, settings) {
        const bass = settings.audioBass || 0;
        const mid = settings.audioMid || 0;
        const high = settings.audioHigh || 0;
        const overall = settings.audioOverall || 0;

        // Audio-reactive parameters (read from global settings)
        emitterState.nbToSpawn.value = Math.floor(settings.baseSpawnRate.value + bass * settings.bassSpawnRate.value);
        emitterState.turbAmplitude.value = settings.baseTurbulence.value + mid * settings.midTurbulence.value;
        emitterState.turbFrequency.value = 0.5 + mid * settings.midFrequency.value;
        emitterState.particleSize.value = settings.baseSize.value + high * settings.highSize.value;
        emitterState.colorRotationSpeed.value = 1.0 + high * settings.highColorSpeed.value;
        emitterState.particleLifetime.value = 0.5 + (1 - overall * settings.overallLifetime.value) * 0.5;

        // Run compute shaders
        renderer.compute(emitterState.updateParticles);
        renderer.compute(emitterState.spawnParticles);

        // Update spawn index
        emitterState.spawnIndex.value = (emitterState.spawnIndex.value + emitterState.nbToSpawn.value) % nbParticles;

        // Update spawn position orbit
        const radius = settings.baseRadius.value + bass * settings.bassRadius.value;
        const speed = 0.5 + mid * settings.midSpeed.value;
        emitterState.elapsedTime += delta;

        const targetPos = new THREE.Vector3(
            Math.sin(emitterState.elapsedTime * speed) * radius,
            Math.cos(emitterState.elapsedTime * speed * 1.3) * radius * 0.5,
            Math.sin(emitterState.elapsedTime * speed * 0.7) * radius
        );

        emitterState.previousSpawnPosition.value.copy(emitterState.spawnPosition.value);
        emitterState.spawnPosition.value.lerp(targetPos, 0.1);

        // Update color offset
        emitterState.colorOffset.value += delta * emitterState.colorRotationSpeed.value * emitterState.timeScale.value;
    }

/**
* Cleanup and dispose all resources.
*/
function cleanup() {
	// Remove group from parent
	emitterState.group.parent?.remove(emitterState.group);

	// Dispose particle mesh and geometry
	if (emitterState.particleMesh) {
		emitterState.particleMesh.geometry?.dispose();
		emitterState.particleMesh.material?.dispose();
		emitterState.particleMesh = null;
	}
	if (emitterState.particleGeometry) {
		emitterState.particleGeometry.dispose();
		emitterState.particleGeometry = null;
	}

	// Dispose links mesh
	if (emitterState.linksMesh) {
		emitterState.linksMesh.geometry?.dispose();
		emitterState.linksMesh.material?.dispose();
		emitterState.linksMesh = null;
	}

	// Dispose storage buffers - use optional chaining as they may not have dispose method
	if (emitterState.particlePositionsBuffer?.dispose) {
		emitterState.particlePositionsBuffer.dispose();
	}
	emitterState.particlePositionsBuffer = null;
	
	if (emitterState.particleVelocitiesBuffer?.dispose) {
		emitterState.particleVelocitiesBuffer.dispose();
	}
	emitterState.particleVelocitiesBuffer = null;
	
	if (emitterState.linksVerticesSBA?.dispose) {
		emitterState.linksVerticesSBA.dispose();
	}
	emitterState.linksVerticesSBA = null;
	
	if (emitterState.linksColorsSBA?.dispose) {
		emitterState.linksColorsSBA.dispose();
	}
	emitterState.linksColorsSBA = null;

	// Clear compute shaders
	emitterState.updateParticles = null;
	emitterState.spawnParticles = null;

	// Reset state
	emitterState.elapsedTime = 0;
	emitterState.spawnIndex.value = 0;

	console.log('[ParticleEmitter] Cleanup complete');
}

    return {
        get group() { return emitterState.group; },
        update,
        cleanup,
    };
}
