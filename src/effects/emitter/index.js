import {
  float, vec3, vec4, Fn,
  sin, cos, tan, abs, sqrt, pow,
  min, max, clamp, mix, fract, floor,
  instancedArray, instanceIndex, storage,
  timerLocal, timerGlobal, positionLocal, hash
} from 'three/tsl';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import * as THREE from 'three';

export class GPUParticleEmitter {
  constructor(count = 10000) {
    this.count = count;
    this.particlePositions = null;
    this.particleVelocities = null;
    this.particleColors = null;
    this.particleSizes = null;
    this.particleLifetimes = null;
    this.particleAge = null;
    this.mesh = null;
    this.computeShader = null;
  }

  init(renderer) {
    const geometry = new THREE.BufferGeometry();
    
    // Create position attribute for the points
    const positions = new Float32Array(this.count * 3);
    const velocities = new Float32Array(this.count * 3);
    const colors = new Float32Array(this.count * 4);
    const sizes = new Float32Array(this.count);
    const lifetimes = new Float32Array(this.count);
    const ages = new Float32Array(this.count);

    for (let i = 0; i < this.count; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;

      velocities[i * 3] = (Math.random() - 0.5) * 2;
      velocities[i * 3 + 1] = Math.random() * 2;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 2;

      colors[i * 4] = Math.random();
      colors[i * 4 + 1] = Math.random();
      colors[i * 4 + 2] = Math.random();
      colors[i * 4 + 3] = 1;

      sizes[i] = Math.random() * 10 + 5;
      lifetimes[i] = Math.random() * 3 + 2;
      ages[i] = Math.random() * lifetimes[i];
    }

    // Set position attribute so points render
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.particlePositions = instancedArray(this.count, 'vec3').setPBO(true);
    this.particleVelocities = instancedArray(this.count, 'vec3').setPBO(true);
    this.particleColors = instancedArray(this.count, 'vec4').setPBO(true);
    this.particleSizes = instancedArray(this.count, 'float').setPBO(true);
    this.particleLifetimes = instancedArray(this.count, 'float').setPBO(true);
    this.particleAge = instancedArray(this.count, 'float').setPBO(true);

    const material = new MeshStandardNodeMaterial();
    material.positionNode = this.particlePositions.element(instanceIndex);
    material.colorNode = this.particleColors.element(instanceIndex);

    this.mesh = new THREE.Points(geometry, material);
    this.mesh.frustumCulled = false;

    return this.mesh;
  }

  getComputeShader() {
    const gravity = vec3(0, -9.8, 0);
    const deltaTime = float(1 / 60);

    this.computeShader = Fn(() => {
      const pos = this.particlePositions.element(instanceIndex);
      const vel = this.particleVelocities.element(instanceIndex);
      const age = this.particleAge.element(instanceIndex);
      const lifetime = this.particleLifetimes.element(instanceIndex);

      // Update age
      const newAge = age.add(deltaTime);
      const lifeRatio = newAge.div(lifetime);
      const isDead = lifeRatio.greaterThan(float(1));

      // Apply velocity with gravity
      const newVel = vel.add(gravity.mul(deltaTime));
      const newPos = pos.add(newVel.mul(deltaTime));

      // Reset dead particles with new random values
      const newLifetime = mix(
        lifetime,
        hash(instanceIndex.add(timerLocal).add(float(3))).mul(3).add(2),
        isDead
      );
      
      const resetPos = mix(newPos, vec3(0, 0, 0), isDead);
      const resetVel = mix(
        newVel,
        vec3(
          hash(instanceIndex.add(timerLocal)).sub(0.5).mul(2),
          hash(instanceIndex.add(timerLocal).add(1)).mul(2),
          hash(instanceIndex.add(timerLocal).add(2)).sub(0.5).mul(2)
        ),
        isDead
      );
      const resetAge = mix(newAge, float(0), isDead);

      this.particlePositions.element(instanceIndex).assign(resetPos);
      this.particleVelocities.element(instanceIndex).assign(resetVel);
      this.particleAge.element(instanceIndex).assign(resetAge);
      this.particleLifetimes.element(instanceIndex).assign(newLifetime);
    }).compute(this.count);

    return this.computeShader;
  }

  update(renderer) {
    if (this.computeShader) {
      renderer.compute(this.computeShader);
    }
  }

  setPosition(x, y, z) {
    if (this.mesh) {
      this.mesh.position.set(x, y, z);
    }
  }

  dispose() {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
    }
  }
}

export const EmitterBurst = Fn((center = vec3(0, 0, 0), count = float(100), speed = float(5), spread = float(1)) => {
  const dir = vec3(
    hash(instanceIndex.add(timerLocal)).sub(0.5),
    hash(instanceIndex.add(timerLocal).add(1)).sub(0.5),
    hash(instanceIndex.add(timerLocal).add(2)).sub(0.5)
  ).normalize();
  
  return center.add(dir.mul(speed.mul(spread)));
});

export const EmitterCone = Fn((direction = vec3(0, 1, 0), angle = float(0.5), speed = float(5)) => {
  const randomDir = vec3(
    hash(instanceIndex.add(timerLocal)).sub(0.5),
    hash(instanceIndex.add(timerLocal).add(1)).sub(0.5),
    hash(instanceIndex.add(timerLocal).add(2)).sub(0.5)
  );
  
  return direction.normalize().add(randomDir.mul(angle)).normalize().mul(speed);
});

// Helper function for smoothstep (must be defined before use)
const smoothstep = Fn((edge0, edge1, x) => {
  const t = clamp(x.sub(edge0).div(edge1.sub(edge0)), 0, 1);
  return t.mul(t).mul(float(3).sub(t.mul(float(2))));
});

export const EmitterRing = Fn((center = vec3(0, 0, 0), radius = float(5), speed = float(5)) => {
  const angle = instanceIndex.mul(0.1).add(timerLocal);
  const dir = vec3(cos(angle), 0, sin(angle));
  return center.add(dir.mul(radius.add(speed)));
});

export const SizeOverLife = Fn((size, age, lifetime) => {
  const lifeRatio = age.div(lifetime);
  const fadeIn = smoothstep(0, 0.1, lifeRatio);
  const fadeOut = smoothstep(1, 0.8, lifeRatio).mul(-1).add(1);
  return size.mul(fadeIn).mul(fadeOut);
});

export const ColorOverLife = Fn((colorStart, colorEnd, age, lifetime) => {
  const lifeRatio = age.div(lifetime);
  return mix(colorStart, colorEnd, lifeRatio);
});

export const RotationOverLife = Fn((rotationSpeed, age) => {
  return age.mul(rotationSpeed);
});
  return t.mul(t).mul(float(3).sub(t.mul(float(2))));
});

export const initEmitterEffect = (renderer, scene, camera, options = {}) => {
  const count = options.count || 10000;
  
  const emitter = new GPUParticleEmitter(count);
  const mesh = emitter.init(renderer);
  
  scene.add(mesh);
  
  return {
    name: 'emitter',
    mesh,
    emitter,
    update: (delta) => {
      emitter.update(renderer);
    },
    dispose: () => {
      emitter.dispose();
      scene.remove(mesh);
    }
  };
};
