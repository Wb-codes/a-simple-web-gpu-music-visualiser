/**
 * @module utils/disposal
 * @description Three.js object disposal utilities to prevent memory leaks
 */

import * as THREE from 'three/webgpu';

/**
 * Dispose of a Three.js object and all its children
 * Recursively disposes geometries, materials, and textures
 * @param {THREE.Object3D} object - The object to dispose
 */
export function disposeObject(object) {
  if (!object) return;

  // Traverse and dispose all children first
  object.traverse((child) => {
    disposeNode(child);
  });

  // Dispose the root object itself
  disposeNode(object);
}

/**
 * Dispose of a single Three.js node
 * @param {THREE.Object3D} node - The node to dispose
 */
function disposeNode(node) {
  if (!node) return;

  // Dispose geometry
  if (node.geometry) {
    node.geometry.dispose();
    node.geometry = null;
  }

  // Dispose material(s)
  if (node.material) {
    if (Array.isArray(node.material)) {
      node.material.forEach(material => disposeMaterial(material));
    } else {
      disposeMaterial(node.material);
    }
    node.material = null;
  }

  // Stop any animations on skinned meshes
  if (node.skeleton) {
    node.skeleton = null;
  }
}

/**
 * Dispose of a material and its textures
 * @param {THREE.Material} material - The material to dispose
 */
function disposeMaterial(material) {
  if (!material) return;

  // Dispose all textures in the material
  const textureProperties = [
    'map', 'alphaMap', 'bumpMap', 'displacementMap', 
    'emissiveMap', 'envMap', 'lightMap', 'metalnessMap',
    'normalMap', 'roughnessMap', 'specularMap'
  ];

  textureProperties.forEach(prop => {
    if (material[prop]) {
      material[prop].dispose();
      material[prop] = null;
    }
  });

  material.dispose();
}

/**
 * Dispose of an entire scene
 * @param {THREE.Scene} scene - The scene to dispose
 */
export function disposeScene(scene) {
  if (!scene) return;

  // Remove all children and dispose them
  while (scene.children.length > 0) {
    const child = scene.children[0];
    scene.remove(child);
    disposeObject(child);
  }

  // Dispose scene's background and environment if they exist
  if (scene.background) {
    if (scene.background.dispose) {
      scene.background.dispose();
    }
    scene.background = null;
  }

  if (scene.environment) {
    if (scene.environment.dispose) {
      scene.environment.dispose();
    }
    scene.environment = null;
  }
}

/**
 * Dispose of animation mixer
 * @param {THREE.AnimationMixer} mixer - The mixer to dispose
 */
export function disposeAnimationMixer(mixer) {
  if (!mixer) return;

  // Stop all actions
  mixer.stopAllAction();
  
  // Clear any references
  mixer.uncacheRoot(mixer.getRoot());
}

/**
 * Dispose of WebGPU resources
 * @param {THREE.WebGPURenderer} renderer - The renderer to cleanup
 */
export function disposeRenderer(renderer) {
  if (!renderer) return;

  renderer.dispose();
}

/**
 * Dispose of instanced arrays/buffers
 * @param {Object} arrays - Object containing instanced arrays to dispose
 */
export function disposeInstancedArrays(arrays) {
  if (!arrays) return;

  Object.values(arrays).forEach(array => {
    if (array && array.dispose) {
      array.dispose();
    }
  });
}
