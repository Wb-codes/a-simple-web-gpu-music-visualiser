/**
* @module scenes/skinning
* @description Skinning points scene with animated character point cloud.
* Loads a GLTF model and renders it as audio-reactive points.
*/

import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { vec3, float, Fn, color, shapeCircle, instanceIndex, instancedArray, objectWorldMatrix, computeSkinning, instancedBufferAttribute } from 'three/tsl';
import { audioBass, audioMid, audioHigh } from '../audio/uniforms.js';
import { getFullAnimationName, buildAnimationMapFromGLB, clearDynamicAnimations, getAnimationNames, getDefaultAnimation } from '../core/animations.js';

/**
* Available GLB models in the skinning folder
* @type {Array<{name: string, path: string}>}
*/
export const AVAILABLE_MODELS = [
{ name: 'Michelle', path: 'models/gltf/skinning/Michelle.glb' },
{ name: 'Boltvis', path: 'models/gltf/skinning/boltvis.glb' },
{ name: 'cliptest', path: 'models/gltf/skinning/cliptest.glb' }
];

/**
* GLB files discovered in the skinning folder
* @type {Object}
*/
export const DISCOVERED_GLBS = {
animated: [],
static: []
};

/**
* Currently selected model path
* @type {string}
*/
export let currentModelPath = AVAILABLE_MODELS[0]?.path || 'models/gltf/skinning/Michelle.glb';

/**
* Skinning scene state
* @type {Object}
*/
export const skinningScene = {
scene: null,
mixer: null,
clock: new THREE.Clock(),
loaded: false,
backgroundColor: new THREE.Color(0x111111),
animations: null,
currentAction: null,
currentAnimationName: getDefaultAnimation(),
model: null,
currentModelPath: null,
renderer: null,
camera: null,
controls: null,
greenScreenColor: new THREE.Color(0x007900),

// Track GPU resources for proper cleanup
pointClouds: [],
gpuResources: [], // { sprite, positionArray, speedArray, positionBuffer }
};

/**
* Callback for when animations are loaded
* @type {Function|null}
*/
let onAnimationsLoadedCallback = null;

/**
* Set callback for when animations are loaded
* @param {Function} callback - Function to call with animation names array
*/
export function setOnAnimationsLoaded(callback) {
onAnimationsLoadedCallback = callback;
}

/**
* Simple scan of skinning folder using hardcoded list
* @returns {Promise<Object>}
*/
export async function scanSkinningFolder() {
DISCOVERED_GLBS.animated = [];
DISCOVERED_GLBS.static = [];

for (const model of AVAILABLE_MODELS) {
const modelInfo = {
name: model.name,
path: model.path,
hasAnimations: model.name !== 'Boltvis' && model.name !== 'cliptest',
animationCount: model.name !== 'Boltvis' && model.name !== 'cliptest' ? 1 : 0
};

if (modelInfo.hasAnimations) {
DISCOVERED_GLBS.animated.push(modelInfo);
} else {
DISCOVERED_GLBS.static.push(modelInfo);
}
}

console.log('[Skinning] Models available:', {
animated: DISCOVERED_GLBS.animated.length,
static: DISCOVERED_GLBS.static.length
});

return DISCOVERED_GLBS;
}

/**
* Create a skinning point cloud from a mesh
* This is a reusable function that can be used in any scene
* @param {THREE.Mesh} child - The mesh to convert
* @param {THREE.WebGPURenderer} renderer - The WebGPU renderer
* @param {THREE.Scene} scene - The scene to add the point cloud to
* @returns {Object} Object with sprite and cleanup function
*/
export function createSkinningPointCloud(child, renderer, scene) {
const countOfPoints = child.geometry.getAttribute('position').count;

// Create storage arrays
const pointPositionArray = instancedArray(countOfPoints, 'vec3').setPBO(true);
const pointSpeedArray = instancedArray(countOfPoints, 'vec3').setPBO(true);
const pointSpeedAttribute = pointSpeedArray.toAttribute();

// Track position buffer for static meshes
let positionBuffer = null;

const materialPoints = new THREE.PointsNodeMaterial();

// Audio-reactive color
materialPoints.colorNode = pointSpeedAttribute.mul(.6).mix(
color(0x0066ff).mul(vec3(1.0).add(audioHigh.mul(0.5))),
color(0xff9000).mul(vec3(1.0).add(audioMid.mul(0.5)))
);

materialPoints.opacityNode = shapeCircle().mul(float(0.8).add(audioBass.mul(0.2)));
materialPoints.sizeNode = pointSpeedAttribute.length().exp().min(5).mul(5).add(1).add(audioBass.mul(10));
materialPoints.sizeAttenuation = false;
materialPoints.alphaTest = 0.5;

if (child.skeleton) {
// Skinned mesh - use compute skinning
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
// Static mesh - use buffer attribute
const positionData = child.geometry.getAttribute('position').array;
positionBuffer = new THREE.InstancedBufferAttribute(positionData, 3);

materialPoints.positionNode = Fn(() => {
return objectWorldMatrix(child).mul(instancedBufferAttribute(positionBuffer));
})();
}

const pointCloud = new THREE.Sprite(materialPoints);
pointCloud.count = countOfPoints;

// Return sprite and resources for tracking
return {
sprite: pointCloud,
positionArray: pointPositionArray,
speedArray: pointSpeedArray,
positionBuffer: positionBuffer,
material: materialPoints,

/**
* Cleanup function to dispose GPU resources
*/
dispose: () => {
// Dispose material
if (materialPoints) {
materialPoints.dispose();
}

// Dispose position buffer (for static meshes)
if (positionBuffer?.dispose) {
positionBuffer.dispose();
}

// Note: instancedArray (PBO) disposal is handled by Three.js
// but we null the references to help GC
}
};
}

/**
* Process model meshes and create point clouds
*/
function processModelMeshes(object, renderer, scene) {
	object.traverse((child) => {
		if (child.isMesh) {
			child.visible = false;

			const result = createSkinningPointCloud(child, renderer, scene);
			scene.add(result.sprite);

			// Track for cleanup
			skinningScene.pointClouds.push(result.sprite);
			skinningScene.gpuResources.push(result);
		}
	});
}

/**
* Load a specific GLB model
*/
async function loadModelFromURL(url, filename, renderer, camera, controls) {
const scene = skinningScene.scene || new THREE.Scene();
if (!skinningScene.scene) {
scene.background = skinningScene.backgroundColor;
scene.add(new THREE.AmbientLight(0xffffff, 10));
}

const loader = new GLTFLoader();

return new Promise((resolve, reject) => {
console.log('[Skinning] Loading model:', filename);
loader.load(
url,
(gltf) => {
console.log('[Skinning] Model loaded:', filename);

const animData = buildAnimationMapFromGLB(gltf.animations, url);

if (onAnimationsLoadedCallback) {
onAnimationsLoadedCallback(animData.names, animData.defaultAnimation);
}

const object = gltf.scene;
skinningScene.model = object;
skinningScene.mixer = new THREE.AnimationMixer(object);
skinningScene.animations = gltf.animations;

const defaultAnim = animData.defaultAnimation || gltf.animations[0]?.name;
if (defaultAnim) {
playAnimation(defaultAnim);
}

processModelMeshes(object, renderer, scene);

object.scale.set(100, 100, 100);
object.rotation.x = -Math.PI / 2;

scene.add(object);

skinningScene.scene = scene;
skinningScene.loaded = true;
skinningScene.currentAnimationName = defaultAnim || '';

setupCameraForModel(object, camera, controls);

resolve({
scene,
hasAnimations: gltf.animations && gltf.animations.length > 0,
animationCount: gltf.animations ? gltf.animations.length : 0
});
},
(progress) => {
const percent = (progress.loaded / progress.total) * 100;
console.log(`[Skinning] Loading: ${percent.toFixed(1)}%`);
},
(error) => {
console.error('[Skinning] Error loading:', error);
reject(error);
}
);
});
}

/**
* Setup camera based on model bounds
*/
function setupCameraForModel(object, camera, controls) {
const box = new THREE.Box3().setFromObject(object);
const center = box.getCenter(new THREE.Vector3());
const size = box.getSize(new THREE.Vector3());

const maxDim = Math.max(size.x, size.y, size.z);
const distance = maxDim * 5;

camera.position.set(center.x, center.y + distance * 0.5, center.z + distance);
camera.lookAt(center);
controls.target.copy(center);
controls.update();
}

/**
* Play a specific animation
*/
function playAnimation(cleanName) {
if (!skinningScene.mixer || !skinningScene.animations) {
console.warn('[Skinning] Cannot play animation: mixer or animations not loaded');
return false;
}

const fullName = getFullAnimationName(cleanName);
if (!fullName) {
console.warn('[Skinning] Unknown animation:', cleanName);
return false;
}

const clip = skinningScene.animations.find(a => a.name === fullName);
if (!clip) {
console.warn('[Skinning] Animation clip not found:', fullName);
return false;
}

if (skinningScene.currentAction) {
skinningScene.currentAction.stop();
}

const action = skinningScene.mixer.clipAction(clip);
action.play();
skinningScene.currentAction = action;
skinningScene.currentAnimationName = cleanName;

console.log('[Skinning] Playing animation:', cleanName);
return true;
}

/**
* Switch to a different animation
*/
export function switchAnimation(cleanName) {
return playAnimation(cleanName);
}

/**
* Get available animations
*/
export function getAvailableAnimations() {
return getAnimationNames();
}

/**
* Initialize the skinning scene
*/
export async function initSkinningScene(renderer, camera, controls) {
// Reset state
skinningScene.renderer = renderer;
skinningScene.camera = camera;
skinningScene.controls = controls;
skinningScene.pointClouds = [];
skinningScene.gpuResources = [];

const result = await loadModelFromURL(currentModelPath, 'model', renderer, camera, controls);
return result.scene;
}

/**
* Update skinning scene each frame
*/
export function updateSkinningScene(delta, settings, renderer) {
if (skinningScene.mixer) {
skinningScene.mixer.update(delta);
}

const darkColor = new THREE.Color(0x111111);
skinningScene.backgroundColor.copy(settings.greenScreen?.value ? skinningScene.greenScreenColor : darkColor);
}

/**
* Cleanup skinning scene and dispose all GPU resources
*/
export function cleanupSkinningScene() {
console.log('[Skinning] Starting cleanup...');

// Clear dynamic animations
clearDynamicAnimations();

// Stop and dispose animation mixer
if (skinningScene.mixer) {
skinningScene.mixer.stopAllAction();
try {
skinningScene.mixer.uncacheRoot(skinningScene.mixer.getRoot());
} catch (e) {
// Ignore errors if root already disposed
}
skinningScene.mixer = null;
}

// Dispose GPU resources (point clouds with their buffers)
skinningScene.gpuResources.forEach(resource => {
// Remove from scene
if (skinningScene.scene && resource.sprite) {
skinningScene.scene.remove(resource.sprite);
}

// Call the dispose method
if (resource.dispose) {
resource.dispose();
}
});
skinningScene.gpuResources = [];
skinningScene.pointClouds = [];

// Dispose model meshes
if (skinningScene.model) {
skinningScene.model.traverse((child) => {
if (child.isMesh) {
child.geometry?.dispose();
if (Array.isArray(child.material)) {
child.material.forEach(m => m?.dispose());
} else {
child.material?.dispose();
}
}
});
skinningScene.model = null;
}

// Reset state
skinningScene.scene = null;
skinningScene.animations = null;
skinningScene.currentAction = null;
skinningScene.currentAnimationName = '';
skinningScene.loaded = false;

console.log('[Skinning] Cleanup complete');
}

// Re-export functions needed by GUI
export { playAnimation };
