/**
 * @module scenes/combi
 * @description Test scene combining particle emitter with other components.
 * Uses settings from Linked Particles scene for audio reactivity.
 */

import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { vec3, float, Fn, color, shapeCircle, instanceIndex, instancedArray, objectWorldMatrix, computeSkinning, instancedBufferAttribute, uniform } from 'three/tsl';
import { audioBass, audioMid, audioHigh, audioOverall } from '../audio/uniforms.js';
import { createParticleEmitter } from '../components/ParticleEmitter.js';
import { createTransformManager } from '../components/TransformManager.js';

// Shared animation state (set from skinning scene)
let sharedAnimationState = {
currentAnimation: '',
onAnimationChange: null
};

/**
* Update shared animation state (called from skinning scene)
* @param {string} animationName
*/
export function setSharedAnimation(animationName) {
sharedAnimationState.currentAnimation = animationName;
if (sharedAnimationState.onAnimationChange) {
sharedAnimationState.onAnimationChange(animationName);
}
}

/**
* Get current shared animation name
* @returns {string}
*/
export function getSharedAnimation() {
return sharedAnimationState.currentAnimation;
}

/**
* Register callback for animation changes
* @param {Function} callback
*/
export function onAnimationChange(callback) {
sharedAnimationState.onAnimationChange = callback;
}

// Point size uniforms for model instances
const pointSizeBase = uniform(5);
const pointSizeAudioMult = uniform(5);

/**
* Combi scene state and configuration.
* @type {Object}
*/
export const combiScene = {
/** @type {THREE.Scene|null} */
scene: null,
/** @type {Array<Object>} */
emitters: [],
/** @type {Array<Object>} */
modelInstances: [],
/** @type {THREE.PointLight|null} */
light: null,
/** @type {Object|null} */
transformManager: null,
/** @type {THREE.GridHelper|null} */
gridHelper: null,
/** @type {THREE.WebGPURenderer|null} */
renderer: null,
/** @type {Object|null} */
controls: null,
/** @type {number} */
maxInstances: 3,
/** @type {Map<string, Object>} */
loadedModels: new Map(),
};

/**
 * Initialize the combi scene.
 * @param {THREE.WebGPURenderer} renderer - The WebGPU renderer
 * @param {THREE.PerspectiveCamera} camera - Main camera
 * @param {OrbitControls} controls - Camera controls
 * @returns {Promise<THREE.Scene>}
 */
export async function initCombiScene(renderer, camera, controls) {
const scene = new THREE.Scene();

// Register callback for animation changes from skinning scene
onAnimationChange((animationName) => {
switchCombiAnimation(animationName);
});

// === Light ===
const light = new THREE.PointLight(0xffffff, 3000);
scene.add(light);

// === Floor Plane Helper ===
const gridHelper = new THREE.GridHelper(200, 20, 0x888888, 0x444444);
gridHelper.position.y = 0;
scene.add(gridHelper);
combiScene.gridHelper = gridHelper;

    // === Transform Manager (Dynamic Gizmo System) ===
    console.log('[initCombiScene] Creating TransformManager...');
    const transformManager = createTransformManager(camera, renderer.domElement);
    transformManager.setOrbitControls(controls);
    
    // Create first emitter
    const emitter = createParticleEmitter(renderer, scene, { nbParticles: 4096 });
    emitter.group.position.set(-5, 0, 0);
    
    // Register component type
    transformManager.register(emitter, 'emitter', emitter.group);
    
    // Create first instance (so it shows up in instance list with gizmo)
    const instanceId = transformManager.createInstance('emitter', emitter.group, 0);
    
    // Store emitter
    combiScene.emitters.push({
        emitter,
        instanceId: instanceId || 'emitter_0',
        index: 0,
    });
    
    // Add gizmo helper to scene
    const gizmoHelper = transformManager.getGizmoHelper();
    if (gizmoHelper) {
        scene.add(gizmoHelper);
    }
    
    console.log('[initCombiScene] TransformManager created and first emitter registered');

    // === Store References ===
    combiScene.scene = scene;
    combiScene.light = light;
    combiScene.transformManager = transformManager;
    combiScene.renderer = renderer;
    combiScene.controls = controls;

// === Set Camera ===
camera.position.set(0, 100, 200);
controls.target.set(0, 50, 0);
controls.update();

    console.log('[Combi] Scene initialized with first emitter instance');

    return scene;
}

/**
 * Add a new emitter instance (public API)
 * @returns {boolean} True if added successfully
 */
export function addCombiEmitter() {
    if (!combiScene.transformManager || !combiScene.scene || !combiScene.renderer) {
        console.warn('[addCombiEmitter] Scene not initialized');
        return false;
    }
    
    // Check max instances
    if (combiScene.emitters.length >= combiScene.maxInstances) {
        console.log('[addCombiEmitter] Max instances reached:', combiScene.maxInstances);
        return false;
    }
    
    const index = combiScene.emitters.length;
    
    // Create emitter
    const emitter = createParticleEmitter(combiScene.renderer, combiScene.scene, { nbParticles: 4096 });
    
    // Position instances in a line
    emitter.group.position.set(-5 + (index * 5), 0, 0);
    
    // Create instance in transform manager
    const instanceId = combiScene.transformManager.createInstance('emitter', emitter.group, index);
    
    // Store emitter
    combiScene.emitters.push({
        emitter,
        instanceId: instanceId || `emitter_${index}`,
        index,
    });
    
    console.log(`[addCombiEmitter] Created emitter instance ${index} at position`, emitter.group.position);
    
    return true;
}

/**
 * Remove the last emitter instance
 * @returns {boolean} True if removed successfully
 */
export function removeCombiEmitter() {
    if (!combiScene.transformManager || combiScene.emitters.length <= 1) {
        console.warn('[removeCombiEmitter] Cannot remove - need at least 1 emitter');
        return false;
    }
    
    const lastItem = combiScene.emitters.pop();
    if (lastItem) {
        // Remove instance from transform manager
        combiScene.transformManager.removeInstance(lastItem.instanceId);
        
        // Cleanup emitter
        lastItem.emitter.cleanup();
        
        console.log(`[removeCombiEmitter] Removed emitter instance ${lastItem.index}`);
        return true;
    }
    
    return false;
}

/**
 * Get current emitter instance count
 * @returns {number}
 */
export function getCombiEmitterCount() {
    return combiScene.emitters.length;
}

/**
 * Get list of transformable instance IDs
 * @returns {string[]}
 */
export function getCombiInstanceIds() {
    if (combiScene.transformManager) {
        return combiScene.transformManager.getInstanceIds();
    }
    return [];
}

/**
 * Select a transformable instance by ID
 * @param {string} id - Instance ID
 * @returns {boolean}
 */
export function selectCombiInstance(id) {
    if (combiScene.transformManager) {
        combiScene.transformManager.select(id);
        return true;
    }
    return false;
}

/**
 * Get currently selected instance ID
 * @returns {string|null}
 */
export function getCombiSelectedInstance() {
    if (combiScene.transformManager) {
        return combiScene.transformManager.getSelectedName();
    }
    return null;
}

/**
 * Reset selected instance's position
 */
export function resetCombiPosition() {
    if (combiScene.transformManager) {
        combiScene.transformManager.resetPosition();
    }
}

/**
 * Reset selected instance's rotation
 */
export function resetCombiRotation() {
    if (combiScene.transformManager) {
        combiScene.transformManager.resetRotation();
    }
}

/**
 * Reset selected instance's scale
 */
export function resetCombiScale() {
    if (combiScene.transformManager) {
        combiScene.transformManager.resetScale();
    }
}

/**
 * Reset all transforms for selected instance
 */
export function resetCombiAll() {
if (combiScene.transformManager) {
combiScene.transformManager.resetAll();
}
}

/**
* Get transforms for all instances (for saving)
* @returns {Array} Array of transform objects
*/
export function getCombiTransforms() {
const transforms = [];
combiScene.emitters.forEach(({ emitter, instanceId }, index) => {
if (emitter?.group) {
const g = emitter.group;
transforms.push({
index,
instanceId,
position: { x: g.position.x, y: g.position.y, z: g.position.z },
rotation: { x: g.rotation.x, y: g.rotation.y, z: g.rotation.z },
scale: { x: g.scale.x, y: g.scale.y, z: g.scale.z }
});
}
});
return transforms;
}

/**
* Restore instance count and transforms (from saved data)
* @param {number} targetCount - Number of instances to restore
* @param {Array} transforms - Array of transform objects
*/
export function restoreCombiState(targetCount, transforms) {
if (!targetCount || targetCount < 1) return;

// Add/remove instances to match target count
const currentCount = combiScene.emitters.length;

// Add instances if needed
while (combiScene.emitters.length < targetCount) {
const added = addCombiEmitter();
if (!added) break;
}

// Remove instances if needed
while (combiScene.emitters.length > targetCount) {
const removed = removeCombiEmitter();
if (!removed) break;
}

// Apply transforms
if (transforms && Array.isArray(transforms)) {
transforms.forEach((t, index) => {
if (combiScene.emitters[index]?.emitter?.group) {
const g = combiScene.emitters[index].emitter.group;
if (t.position) {
g.position.set(t.position.x, t.position.y, t.position.z);
}
if (t.rotation) {
g.rotation.set(t.rotation.x, t.rotation.y, t.rotation.z);
}
if (t.scale) {
g.scale.set(t.scale.x, t.scale.y, t.scale.z);
}
}
});
}

console.log('[Combi] Restored state:', combiScene.emitters.length, 'instances');
}

/**
* Create a skinning point cloud from a mesh (reused from skinning scene)
*/
function createCombiPointCloud(child, renderer, scene) {
const countOfPoints = child.geometry.getAttribute('position').count;

const pointPositionArray = instancedArray(countOfPoints, 'vec3').setPBO(true);
const pointSpeedArray = instancedArray(countOfPoints, 'vec3').setPBO(true);
const pointSpeedAttribute = pointSpeedArray.toAttribute();

let positionBuffer = null;

const materialPoints = new THREE.PointsNodeMaterial();

materialPoints.colorNode = pointSpeedAttribute.mul(.6).mix(
color(0x0066ff).mul(vec3(1.0).add(audioHigh.mul(0.5))),
color(0xff9000).mul(vec3(1.0).add(audioMid.mul(0.5)))
);

materialPoints.opacityNode = shapeCircle().mul(float(0.8).add(audioBass.mul(0.2)));
materialPoints.sizeNode = pointSpeedAttribute.length().exp().min(5).mul(pointSizeBase).add(1).add(audioBass.mul(pointSizeAudioMult));
materialPoints.sizeAttenuation = false;
materialPoints.alphaTest = 0.5;

if (child.skeleton) {
const skinnedPosition = computeSkinning(child);

const updateSkinningPoints = Fn(() => {
const pointPosition = pointPositionArray.element(instanceIndex);
const pointSpeed = pointSpeedArray.element(instanceIndex);
const skinnedWorldPos = objectWorldMatrix(child).mul(skinnedPosition);
const skinningSpeed = skinnedWorldPos.sub(pointPosition);
pointSpeed.assign(skinningSpeed);
pointPosition.assign(skinnedWorldPos);
}, 'void');

materialPoints.positionNode = Fn(() => {
updateSkinningPoints();
return pointPositionArray.toAttribute();
})().compute(countOfPoints).onInit(() => {
renderer.compute(updateSkinningPoints().compute(countOfPoints));
});
} else {
const positionData = child.geometry.getAttribute('position').array;
positionBuffer = new THREE.InstancedBufferAttribute(positionData, 3);

materialPoints.positionNode = Fn(() => {
return objectWorldMatrix(child).mul(instancedBufferAttribute(positionBuffer));
})();
}

const pointCloud = new THREE.Sprite(materialPoints);
pointCloud.count = countOfPoints;

return {
sprite: pointCloud,
positionArray: pointPositionArray,
speedArray: pointSpeedArray,
positionBuffer: positionBuffer,
material: materialPoints,
dispose: () => {
if (positionBuffer && typeof positionBuffer.dispose === 'function') {
positionBuffer.dispose();
}
if (pointPositionArray && typeof pointPositionArray.dispose === 'function') {
pointPositionArray.dispose();
}
if (pointSpeedArray && typeof pointSpeedArray.dispose === 'function') {
pointSpeedArray.dispose();
}
if (materialPoints) {
materialPoints.dispose();
}
}
};
}

/**
* Load a model into the combi scene
* @param {string} modelPath - Path to the GLB file
* @returns {Promise<boolean>}
*/
export async function loadCombiModel(modelPath) {
if (!combiScene.scene || !combiScene.renderer) {
console.warn('[Combi] Scene not initialized');
return false;
}

// Check if already loaded and still valid
const existingModel = combiScene.loadedModels.get(modelPath);
if (existingModel && existingModel.object && existingModel.object.parent) {
console.log('[Combi] Model already loaded and in scene:', modelPath);
return true;
}

// If exists but invalid (was cleaned up), remove it
if (existingModel) {
combiScene.loadedModels.delete(modelPath);
combiScene.modelInstances = combiScene.modelInstances.filter(m => m.path !== modelPath);
}

return new Promise((resolve) => {
const loader = new GLTFLoader();
loader.load(
modelPath,
(gltf) => {
console.log('[Combi] Model loaded:', modelPath);

const object = gltf.scene;
const mixer = new THREE.AnimationMixer(object);
const pointClouds = [];
const gpuResources = [];

object.traverse((child) => {
if (child.isMesh) {
child.visible = false;
const result = createCombiPointCloud(child, combiScene.renderer, combiScene.scene);
combiScene.scene.add(result.sprite);
pointClouds.push(result.sprite);
gpuResources.push(result);
}
});

object.scale.set(10, 10, 10);

// Position based on current model instances count
const offset = combiScene.modelInstances.length * 20;
object.position.set(offset, 0, 0);

combiScene.scene.add(object);

const modelData = {
path: modelPath,
object: object,
mixer: mixer,
animations: gltf.animations || [],
pointClouds: pointClouds,
gpuResources: gpuResources,
hasAnimations: gltf.animations && gltf.animations.length > 0
};

combiScene.loadedModels.set(modelPath, modelData);
combiScene.modelInstances.push(modelData);

// Play animation matching the current shared state
if (modelData.hasAnimations && gltf.animations.length > 0) {
const currentAnimName = sharedAnimationState.currentAnimation;
let clipToPlay = null;

if (currentAnimName) {
clipToPlay = gltf.animations.find(clip => {
const cleanName = clip.name.split('|').pop()?.split('@')[0] || clip.name;
return cleanName === currentAnimName || clip.name.includes(currentAnimName);
});
}

if (!clipToPlay) {
clipToPlay = gltf.animations[0];
}

const action = mixer.clipAction(clipToPlay);
action.play();
console.log('[Combi] Playing animation:', clipToPlay.name);
}

resolve(true);
},
undefined,
(error) => {
console.error('[Combi] Error loading model:', error);
resolve(false);
}
);
});
}

/**
* Remove a model from the combi scene
* @param {string} modelPath - Path to the GLB file
* @returns {boolean}
*/
export function removeCombiModel(modelPath) {
const modelData = combiScene.loadedModels.get(modelPath);
if (!modelData) return false;

modelData.mixer?.stopAllAction();

modelData.gpuResources.forEach(resource => {
if (combiScene.scene && resource.sprite) {
combiScene.scene.remove(resource.sprite);
}
if (resource.dispose) resource.dispose();
});

if (modelData.object) {
combiScene.scene?.remove(modelData.object);
modelData.object.traverse((child) => {
if (child.isMesh) {
child.geometry?.dispose();
if (Array.isArray(child.material)) {
child.material.forEach(m => m?.dispose());
} else {
child.material?.dispose();
}
}
});
}

combiScene.loadedModels.delete(modelPath);
combiScene.modelInstances = combiScene.modelInstances.filter(m => m.path !== modelPath);

console.log('[Combi] Removed model:', modelPath);
return true;
}

/**
* Switch animation on all loaded models
* @param {string} animationName
*/
export function switchCombiAnimation(animationName) {
combiScene.modelInstances.forEach((modelData) => {
if (modelData.hasAnimations && modelData.mixer && modelData.animations) {
let clipToPlay = modelData.animations.find(clip => {
const cleanName = clip.name.split('|').pop()?.split('@')[0] || clip.name;
return cleanName === animationName || clip.name.includes(animationName);
});

if (clipToPlay) {
modelData.mixer.stopAllAction();
const action = modelData.mixer.clipAction(clipToPlay);
action.play();
}
}
});
}

/**
* Get list of loaded model paths
* @returns {string[]}
*/
export function getCombiModelPaths() {
return Array.from(combiScene.loadedModels.keys());
}

/**
* Update point size settings
*/
export function updateCombiPointSettings(base, audioMult) {
pointSizeBase.value = base;
pointSizeAudioMult.value = audioMult;
}

/**
* Get current instance count
* @returns {number}
*/
export function getCombiInstanceCount() {
return combiScene.emitters.length;
}

/**
 * Update combi scene each frame.
 * @param {number} delta - Time since last frame in seconds
 * @param {Object} settings - Current settings values (from Linked Particles scene)
 * @param {THREE.WebGPURenderer} renderer - The WebGPU renderer
 */
export function updateCombiScene(delta, settings, renderer) {
// Update all emitter instances with audio data
combiScene.emitters.forEach(({ emitter }) => {
if (emitter) {
emitter.update(delta, {
...settings,
audioBass: audioBass.value,
audioMid: audioMid.value,
audioHigh: audioHigh.value,
audioOverall: audioOverall.value
});
}
});

// Update all model mixers (animations)
combiScene.modelInstances.forEach((modelData) => {
if (modelData.mixer) {
modelData.mixer.update(delta);
}
});

// Animate light position
const elapsedTime = combiScene.emitters[0]?.emitter?.elapsedTime || 0;
combiScene.light.position.set(
Math.sin(elapsedTime * 0.5) * 30,
Math.cos(elapsedTime * 0.3) * 30,
Math.sin(elapsedTime * 0.2) * 30
);

// Toggle gizmo and grid visibility using TransformManager
const showGizmo = settings.combiShowGizmo?.value === true;
if (combiScene.transformManager) {
combiScene.transformManager.update(showGizmo);

// Update gizmo mode if changed
const gizmoMode = settings.combiGizmoMode?.value || 'translate';
if (combiScene.transformManager.getMode() !== gizmoMode) {
combiScene.transformManager.setMode(gizmoMode);
}
}
// Grid helper shows/hides with gizmo toggle
if (combiScene.gridHelper) {
combiScene.gridHelper.visible = showGizmo;
}

// Toggle camera auto-rotate
if (combiScene.controls) {
const autoRotateOff = settings.combiAutoRotateOff?.value === true;
combiScene.controls.autoRotate = !autoRotateOff;
}

// Update point size from settings
if (settings.pointSize && settings.pointSizeAudio) {
updateCombiPointSettings(settings.pointSize.value, settings.pointSizeAudio.value);
}
}

/**
 * Cleanup combi scene and dispose resources.
 */
export function cleanupCombiScene() {
if (!combiScene.scene) return;

console.log('[Combi] Cleaning up scene...');

// Cleanup all emitter instances
combiScene.emitters.forEach(({ emitter }) => {
if (emitter) {
emitter.cleanup();
}
});
combiScene.emitters = [];

// Cleanup all model instances
combiScene.modelInstances.forEach((modelData) => {
modelData.mixer?.stopAllAction();
modelData.gpuResources?.forEach(resource => {
if (combiScene.scene && resource.sprite) {
combiScene.scene.remove(resource.sprite);
}
if (resource.dispose) {
try {
resource.dispose();
} catch (e) {
console.warn('[Combi] Error disposing GPU resource:', e.message);
}
}
});
if (modelData.object) {
combiScene.scene?.remove(modelData.object);
modelData.object.traverse((child) => {
if (child.isMesh) {
child.geometry?.dispose();
if (Array.isArray(child.material)) {
child.material.forEach(m => m?.dispose());
} else {
child.material?.dispose();
}
}
});
}
});
combiScene.modelInstances = [];
combiScene.loadedModels.clear();

// Remove and dispose light
if (combiScene.light) {
combiScene.scene?.remove(combiScene.light);
combiScene.light.dispose();
combiScene.light = null;
}

// Remove grid helper
if (combiScene.gridHelper) {
combiScene.scene?.remove(combiScene.gridHelper);
combiScene.gridHelper = null;
}

// Cleanup TransformManager (handles gizmo)
if (combiScene.transformManager) {
// Remove gizmo helper from scene
const gizmoHelper = combiScene.transformManager.getGizmoHelper();
if (gizmoHelper) {
combiScene.scene?.remove(gizmoHelper);
}
combiScene.transformManager.cleanup();
combiScene.transformManager = null;
}

// Clear references
combiScene.scene = null;
combiScene.renderer = null;
combiScene.controls = null;

console.log('[Combi] Cleanup complete');
}
