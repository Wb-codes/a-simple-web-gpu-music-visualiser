/**
* @module scenes/skinning
* @description Skinning points scene with animated character point cloud.
* Loads a GLTF model and renders it as audio-reactive points.
*/

import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { vec3, float, Fn, color, shapeCircle, instanceIndex, instancedArray, objectWorldMatrix, computeSkinning, instancedBufferAttribute, uniform, positionLocal, positionWorld, sin, cos, hash, length } from 'three/tsl';
import { audioBass, audioMid, audioHigh } from '../audio/uniforms.js';
import { buildAnimationMapFromGLB, clearDynamicAnimations } from '../core/animations.js';
import { updatePostProcessingScene } from '../core/renderer.js';
import { setSharedAnimation } from './combi.js';
import { SimplexNoise3D, PerlinNoise3D, VoronoiNoise, FractalBrownianMotion, WaveField, Ripple, GradientLinear, ColorUtils } from '../effects/procedural/index.js';

// Point size uniforms
const pointSizeBase = uniform(5);
const pointSizeAudioMult = uniform(5);

// Effect uniforms
const effectScale = uniform(1.0);
const effectSpeed = uniform(1.0);
const effectIntensity = uniform(0.5);
const effectTime = uniform(0);

/**
 * Update effect time uniform (call from animation loop)
 * @param {number} delta - Time delta in seconds
 */
export function updateEffectTime(delta) {
  effectTime.value += delta;
}

/** @type {string|null} */
let currentEffect = null;

/**
 * Set the current effect for point clouds
 * @param {string|null} effectName - Effect name or null for default
 */
export function setPointCloudEffect(effectName) {
  currentEffect = effectName;
  console.log('[Skinning] Effect set to:', effectName);
  
  // Update all loaded model materials
  loadedModels.forEach((modelData) => {
    modelData.gpuResources.forEach((resource) => {
      if (resource.applyEffect) {
        resource.applyEffect(effectName);
      }
    });
  });
}

/**
 * Get the current effect name
 * @returns {string|null}
 */
export function getPointCloudEffect() {
  return currentEffect;
}

/**
 * Update effect parameters
 * @param {Object} params - { scale, speed, intensity }
 */
export function updateEffectParams(params) {
  if (params.scale !== undefined) effectScale.value = params.scale;
  if (params.speed !== undefined) effectSpeed.value = params.speed;
  if (params.intensity !== undefined) effectIntensity.value = params.intensity;
}

/**
* Update point size uniforms
* @param {number} base - Base point size
* @param {number} audioMult - Audio multiplier for point size
*/
export function updatePointSettings(base, audioMult) {
pointSizeBase.value = base;
pointSizeAudioMult.value = audioMult;
}

/**
* GLB files discovered in the skinning folder
* @type {{animated: Array, static: Array, pending: Array}}
*/
export const DISCOVERED_GLBS = {
animated: [],
static: [],
pending: []
};

/**
* Currently selected model path
* @type {string}
*/
export let currentModelPath = null;

/**
* Callbacks for when models are discovered
* @type {Function|null}
*/
let onModelsDiscoveredCallback = null;

/**
* Set callback for when models are discovered
* @param {Function} callback - Function to call with discovered models
*/
export function setOnModelsDiscovered(callback) {
onModelsDiscoveredCallback = callback;
}

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
currentAnimationName: '',
renderer: null,
camera: null,
controls: null,
greenScreenColor: new THREE.Color(0x007900),
};

/**
* Track loaded models and their resources
* @type {Map<string, Object>}
*/
export const loadedModels = new Map();

/**
* Get all loaded model paths
* @returns {string[]}
*/
export function getLoadedModelPaths() {
return Array.from(loadedModels.keys());
}

/**
* Check if a model is currently loaded
* @param {string} modelPath
* @returns {boolean}
*/
export function isModelLoaded(modelPath) {
return loadedModels.has(modelPath);
}

/**
* Toggle a model on/off
* @param {string} modelPath
* @param {boolean} enabled
* @returns {Promise<boolean>}
*/
export async function toggleModel(modelPath, enabled) {
if (!skinningScene.renderer || !skinningScene.camera || !skinningScene.controls) {
console.error('[Skinning] Cannot toggle model: scene not initialized');
return false;
}

if (enabled) {
if (loadedModels.has(modelPath)) {
console.log('[Skinning] Model already loaded:', modelPath);
return true;
}

const modelInfo = [...DISCOVERED_GLBS.animated, ...DISCOVERED_GLBS.static].find(m => m.path === modelPath);
if (!modelInfo) {
console.error('[Skinning] Model not found in discovered list:', modelPath);
return false;
}

const result = await loadModelIntoScene(modelPath);
return result !== null;
} else {
if (!loadedModels.has(modelPath)) {
console.log('[Skinning] Model not loaded:', modelPath);
return true;
}

unloadModel(modelPath);
return true;
}
}

/**
* Load a model into the current scene
* @param {string} modelPath
* @returns {Promise<Object|null>}
*/
async function loadModelIntoScene(modelPath) {
if (!skinningScene.scene) {
skinningScene.scene = new THREE.Scene();
skinningScene.scene.background = skinningScene.backgroundColor;
skinningScene.scene.add(new THREE.AmbientLight(0xffffff, 10));
}

const loader = new GLTFLoader();

return new Promise((resolve, reject) => {
console.log('[Skinning] Loading model:', modelPath);
loader.load(
modelPath,
(gltf) => {
console.log('[Skinning] Model loaded:', modelPath);

const object = gltf.scene;
const mixer = new THREE.AnimationMixer(object);

const pointClouds = [];
const gpuResources = [];

object.traverse((child) => {
if (child.isMesh) {
child.visible = false;
const result = createSkinningPointCloud(child, skinningScene.renderer, skinningScene.scene);
skinningScene.scene.add(result.sprite);
pointClouds.push(result.sprite);
gpuResources.push(result);
}
});

object.scale.set(100, 100, 100);

skinningScene.scene.add(object);

const modelData = {
path: modelPath,
object: object,
mixer: mixer,
animations: gltf.animations || [],
pointClouds: pointClouds,
gpuResources: gpuResources,
hasAnimations: gltf.animations && gltf.animations.length > 0,
animationNames: [],
animationMap: {},
currentAction: null
};

loadedModels.set(modelPath, modelData);

if (modelData.hasAnimations && gltf.animations.length > 0) {
const animData = buildAnimationMapFromGLB(gltf.animations, modelPath);
modelData.animationNames = animData.names;
modelData.animationMap = animData.map;
if (onAnimationsLoadedCallback) {
onAnimationsLoadedCallback(animData.names, animData.defaultAnimation, modelPath);
}
const defaultAnim = animData.defaultAnimation || animData.names[0];
if (defaultAnim) {
playModelAnimation(modelPath, defaultAnim);
}
}

if (!skinningScene.loaded) {
skinningScene.loaded = true;
}

resolve({
hasAnimations: modelData.hasAnimations,
animationCount: gltf.animations ? gltf.animations.length : 0
});
},
(progress) => {
const percent = (progress.loaded / progress.total) * 100;
console.log(`[Skinning] Loading: ${percent.toFixed(1)}%`);
},
(error) => {
console.error('[Skinning] Error loading model:', error);
reject(error);
}
);
});
}

/**
* Unload a model from the scene
* @param {string} modelPath
*/
function unloadModel(modelPath) {
const modelData = loadedModels.get(modelPath);
if (!modelData) return;

console.log('[Skinning] Unloading model:', modelPath);

modelData.mixer?.stopAllAction();

modelData.gpuResources.forEach(resource => {
if (skinningScene.scene && resource.sprite) {
skinningScene.scene.remove(resource.sprite);
}
if (resource.dispose) {
try {
resource.dispose();
} catch (e) {
console.warn('[Skinning] Error disposing GPU resource:', e.message);
}
}
});

if (modelData.object) {
skinningScene.scene?.remove(modelData.object);
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

loadedModels.delete(modelPath);
console.log('[Skinning] Model unloaded:', modelPath);
}

/**
* Play animation on a specific model
* @param {string} modelPath
* @param {string} animationName
*/
export function playModelAnimation(modelPath, animationName) {
const modelData = loadedModels.get(modelPath);
if (!modelData || !modelData.mixer || !modelData.animations) return;

const fullName = modelData.animationMap[animationName] || animationName;

const clip = modelData.animations.find(a => a.name === fullName);
if (!clip) {
console.warn('[Skinning] Animation clip not found:', fullName, 'for model:', modelPath);
return;
}

if (modelData.currentAction) {
modelData.currentAction.stop();
}

const action = modelData.mixer.clipAction(clip);
action.reset();
action.play();
modelData.currentAction = action;

skinningScene.currentAnimationName = animationName;

// Update shared animation state for combi scene
setSharedAnimation(animationName);

console.log('[Skinning] Playing animation:', animationName, 'on model:', modelPath);
}

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
* Classify all pending models by loading them and checking for animations
*/
async function classifyAllPendingModels() {
const pending = [...DISCOVERED_GLBS.pending];
console.log('[Skinning] Classifying', pending.length, 'models...');

for (const model of pending) {
try {
const response = await fetch(model.path, { method: 'HEAD' });
if (!response.ok) continue;

const gltfData = await new Promise((resolve, reject) => {
const loader = new GLTFLoader();
loader.load(model.path, (gltf) => resolve(gltf), undefined, reject);
});

const hasAnimations = gltfData.animations && gltfData.animations.length > 0;
const animationCount = gltfData.animations ? gltfData.animations.length : 0;

model.hasAnimations = hasAnimations;
model.animationCount = animationCount;

DISCOVERED_GLBS.pending = DISCOVERED_GLBS.pending.filter(m => m.path !== model.path);

if (hasAnimations) {
DISCOVERED_GLBS.animated.push(model);
console.log(`[Skinning] ${model.name}: animated (${animationCount} animations)`);
} else {
DISCOVERED_GLBS.static.push(model);
console.log(`[Skinning] ${model.name}: static`);
}

gltfData.scene.traverse((child) => {
if (child.isMesh) {
child.geometry?.dispose();
if (Array.isArray(child.material)) {
child.material.forEach(m => m?.dispose());
} else {
child.material?.dispose();
}
}
});
} catch (error) {
console.warn('[Skinning] Failed to classify model:', model.name, error);
DISCOVERED_GLBS.pending = DISCOVERED_GLBS.pending.filter(m => m.path !== model.path);
DISCOVERED_GLBS.static.push(model);
}
}

if (onModelsDiscoveredCallback) {
onModelsDiscoveredCallback(DISCOVERED_GLBS);
}
}

/**
* Dynamically scan skinning folder for GLB files
* @returns {Promise<Object>}
*/
export async function scanSkinningFolder() {
DISCOVERED_GLBS.animated = [];
DISCOVERED_GLBS.static = [];
DISCOVERED_GLBS.pending = [];

const SKINNING_FOLDER = 'models/gltf/skinning/';

try {
const indexResponse = await fetch(SKINNING_FOLDER + 'index.json');
if (indexResponse.ok) {
const data = await indexResponse.json();
if (data.models && Array.isArray(data.models)) {
for (const model of data.models) {
const modelInfo = {
name: model.name,
path: model.path,
filename: model.path.split('/').pop(),
hasAnimations: null,
animationCount: null
};
DISCOVERED_GLBS.pending.push(modelInfo);
}
console.log('[Skinning] Models loaded from index.json:', data.models.length, '(will classify)');
await classifyAllPendingModels();
return DISCOVERED_GLBS;
}
}
} catch (error) {
console.warn('[Skinning] index.json not found, will probe for known models');
}

const knownModelFiles = ['Michelle.glb', 'boltvis.glb', 'cliptest.glb', 'model.glb', 'character.glb', 'anim.glb'];

for (const filename of knownModelFiles) {
try {
const probeResponse = await fetch(SKINNING_FOLDER + filename, { method: 'HEAD' });
if (probeResponse.ok) {
DISCOVERED_GLBS.pending.push({
name: filename.replace('.glb', ''),
path: SKINNING_FOLDER + filename,
filename: filename,
hasAnimations: null,
animationCount: null
});
}
} catch (e) {
}
}

if (DISCOVERED_GLBS.pending.length > 0) {
await classifyAllPendingModels();
}

if (DISCOVERED_GLBS.animated.length === 0 && DISCOVERED_GLBS.static.length === 0) {
console.warn('[Skinning] No models found. Place .glb files in models/gltf/skinning/');
}

return DISCOVERED_GLBS;
}

/**
* Update model classification after loading (animated vs static)
* @param {string} modelPath - Path to the model
* @param {boolean} hasAnimations - Whether model has animations
* @param {number} animationCount - Number of animations
*/
export function updateModelClassification(modelPath, hasAnimations, animationCount) {
const pendingModel = DISCOVERED_GLBS.pending.find(m => m.path === modelPath);
const animatedModel = DISCOVERED_GLBS.animated.find(m => m.path === modelPath);
const staticModel = DISCOVERED_GLBS.static.find(m => m.path === modelPath);

const model = pendingModel || animatedModel || staticModel;

if (!model) {
console.warn('[Skinning] Model not found:', modelPath);
return;
}

if (pendingModel) {
DISCOVERED_GLBS.pending = DISCOVERED_GLBS.pending.filter(m => m.path !== modelPath);
} else if (animatedModel) {
DISCOVERED_GLBS.animated = DISCOVERED_GLBS.animated.filter(m => m.path !== modelPath);
} else if (staticModel) {
DISCOVERED_GLBS.static = DISCOVERED_GLBS.static.filter(m => m.path !== modelPath);
}

model.hasAnimations = hasAnimations;
model.animationCount = animationCount;

if (hasAnimations) {
if (!DISCOVERED_GLBS.animated.find(m => m.path === modelPath)) {
DISCOVERED_GLBS.animated.push(model);
}
} else {
if (!DISCOVERED_GLBS.static.find(m => m.path === modelPath)) {
DISCOVERED_GLBS.static.push(model);
}
}

if (onModelsDiscoveredCallback) {
onModelsDiscoveredCallback(DISCOVERED_GLBS);
}
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
materialPoints.sizeNode = pointSpeedAttribute.length().exp().min(5).mul(pointSizeBase).add(1).add(audioBass.mul(pointSizeAudioMult));
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

// Store original position node for effect application
const basePositionNode = materialPoints.positionNode;

/**
 * Apply an effect to the point cloud material
 * @param {string|null} effectName - Effect to apply
 */
function applyEffect(effectName) {
  if (!effectName) {
    // Reset to default
    materialPoints.colorNode = pointSpeedAttribute.mul(.6).mix(
      color(0x0066ff).mul(vec3(1.0).add(audioHigh.mul(0.5))),
      color(0xff9000).mul(vec3(1.0).add(audioMid.mul(0.5)))
    );
    materialPoints.positionNode = basePositionNode;
    return;
  }

  const time = effectTime.mul(effectSpeed);
  
  // Use world position for effects (more meaningful for point clouds)
  const pos = positionWorld;
  
  // Helper for spectral colors
  const spectralColor = (t) => {
    const r = sin(t.add(float(0))).mul(0.5).add(0.5);
    const g = sin(t.add(float(2.094))).mul(0.5).add(0.5);
    const b = sin(t.add(float(4.189))).mul(0.5).add(0.5);
    return vec3(r, g, b);
  };
  
  switch (effectName) {
    case 'simplex':
      materialPoints.colorNode = spectralColor(pos.y.add(1).div(2).add(audioBass.mul(0.5)).add(time.mul(0.1)));
      materialPoints.positionNode = basePositionNode;
      break;
      
    case 'perlin':
      materialPoints.colorNode = spectralColor(pos.x.add(pos.y).add(1).div(3).add(audioMid.mul(0.3)).add(time.mul(0.15)));
      materialPoints.positionNode = basePositionNode;
      break;
      
    case 'voronoi':
      materialPoints.colorNode = spectralColor(sin(pos.x.mul(effectScale).add(time)).mul(0.5).add(0.5));
      materialPoints.positionNode = basePositionNode;
      break;
      
    case 'fbm':
      materialPoints.colorNode = spectralColor(pos.z.add(1).div(2).mul(audioHigh.add(1)).add(time.mul(0.2)));
      materialPoints.positionNode = basePositionNode;
      break;
      
    case 'wave':
      materialPoints.colorNode = spectralColor(
        sin(pos.x.mul(effectScale).add(time))
          .add(sin(pos.y.mul(effectScale).add(time.mul(0.7))))
          .add(sin(pos.z.mul(effectScale).add(time.mul(0.5))))
          .mul(0.33).add(0.5)
      );
      materialPoints.positionNode = Fn(() => {
        const audioMod = float(1).add(audioBass.mul(2)).add(audioMid.mul(1)).add(audioHigh.mul(0.5));
        const displacement = vec3(
          sin(pos.y.mul(effectScale).add(time)).mul(effectIntensity.mul(5).mul(audioMod)),
          cos(pos.x.mul(effectScale).add(time)).mul(effectIntensity.mul(5).mul(audioMod)),
          sin(pos.z.mul(effectScale).add(time.mul(0.7))).mul(effectIntensity.mul(5).mul(audioMod))
        );
        return basePositionNode.add(displacement);
      })();
      break;
      
    case 'ripple':
      materialPoints.colorNode = spectralColor(length(pos).mul(effectScale).add(time.mul(-1)).fract());
      materialPoints.positionNode = Fn(() => {
        const audioMod = float(1).add(audioBass.mul(3)).add(audioMid.mul(1.5)).add(audioHigh.mul(0.5));
        const dist = length(pos);
        const dir = pos.div(dist.add(0.001));
        const ripple = sin(dist.mul(effectScale.mul(10)).sub(time)).mul(effectIntensity.mul(8).mul(audioMod));
        return basePositionNode.add(dir.mul(ripple));
      })();
      break;
      
    case 'spectral':
      materialPoints.colorNode = spectralColor(pos.y.add(1).div(2).add(audioBass.mul(0.3)).add(audioMid.mul(0.2)).add(audioHigh.mul(0.1)));
      materialPoints.positionNode = basePositionNode;
      break;
      
    case 'noise-displace':
      materialPoints.colorNode = pointSpeedAttribute.mul(.6).mix(
        color(0x0066ff).mul(vec3(1.0).add(audioHigh.mul(0.5))),
        color(0xff9000).mul(vec3(1.0).add(audioMid.mul(0.5)))
      );
      materialPoints.positionNode = Fn(() => {
        const audioMod = float(1).add(audioBass.mul(2.5)).add(audioMid.mul(1)).add(audioHigh.mul(0.5));
        const displacement = vec3(
          sin(pos.y.mul(effectScale.mul(2)).add(time)).mul(effectIntensity.mul(4).mul(audioMod)),
          cos(pos.x.mul(effectScale.mul(2)).add(time.mul(1.3))).mul(effectIntensity.mul(4).mul(audioMod)),
          sin(pos.z.mul(effectScale.mul(2)).add(time.mul(0.7))).mul(effectIntensity.mul(4).mul(audioMod))
        );
        return basePositionNode.add(displacement);
      })();
      break;
       
    default:
      console.warn('[Skinning] Unknown effect:', effectName);
  }
}

// Apply initial effect if set
if (currentEffect) {
  applyEffect(currentEffect);
}

// Return sprite and resources for tracking
return {
  sprite: pointCloud,
  positionArray: pointPositionArray,
  speedArray: pointSpeedArray,
  positionBuffer: positionBuffer,
  material: materialPoints,
  applyEffect: applyEffect,

  /**
   * Cleanup function to dispose GPU resources
   */
  dispose: () => {
// Dispose material
if (materialPoints) {
materialPoints.dispose();
}

// Dispose position buffer (for static meshes)
if (positionBuffer && typeof positionBuffer.dispose === 'function') {
positionBuffer.dispose();
}

// Dispose instanced arrays if available
if (pointPositionArray && typeof pointPositionArray.dispose === 'function') {
pointPositionArray.dispose();
}
if (pointSpeedArray && typeof pointSpeedArray.dispose === 'function') {
pointSpeedArray.dispose();
}
}
};
}

/**
* Setup camera based on model bounds
*/
function setupCameraForModel(object, camera, controls) {
const box = new THREE.Box3().setFromObject(object);
const center = box.getCenter(new THREE.Vector3());
const size = box.getSize(new THREE.Vector3());

const maxDim = Math.max(size.x, size.y, size.z);
const distance = Math.max(maxDim * 8, 500);

camera.position.set(center.x, center.y + distance * 0.3, center.z + distance);
camera.lookAt(center);
controls.target.copy(center);
controls.update();
}

/**
* Play animation by name on the first loaded animated model
*/
function playAnimation(cleanName) {
let played = false;
loadedModels.forEach((modelData) => {
if (modelData.hasAnimations && modelData.mixer && modelData.animations && modelData.animationMap) {
const fullName = modelData.animationMap[cleanName] || cleanName;

const clip = modelData.animations.find(a => a.name === fullName);
if (clip) {
const action = modelData.mixer.clipAction(clip);
action.play();
played = true;
}
}
});

if (played) {
skinningScene.currentAnimationName = cleanName;
console.log('[Skinning] Playing animation:', cleanName);
}
return played;
}

/**
* Get animations for a specific model
*/
export function getModelAnimations(modelPath) {
const modelData = loadedModels.get(modelPath);
return modelData?.animationNames || [];
}

/**
* Get current animation name
* @returns {string}
*/
export function getSkinningCurrentAnimation() {
return skinningScene.currentAnimationName || '';
}

/**
* Initialize the skinning scene
*/
export async function initSkinningScene(renderer, camera, controls) {
skinningScene.renderer = renderer;
skinningScene.camera = camera;
skinningScene.controls = controls;

skinningScene.scene = new THREE.Scene();
skinningScene.scene.background = skinningScene.backgroundColor;
skinningScene.scene.add(new THREE.AmbientLight(0xffffff, 10));

const gridHelper = new THREE.GridHelper(1000, 20, 0x444444, 0x333333);
gridHelper.position.y = 0;
skinningScene.scene.add(gridHelper);

camera.position.set(0, 200, 400);
controls.target.set(0, 100, 0);
controls.minDistance = 50;
controls.maxDistance = 800;
controls.update();

await scanSkinningFolder();

const firstModel = DISCOVERED_GLBS.animated[0] || DISCOVERED_GLBS.static[0];
if (!firstModel) {
console.error('[Skinning] No models found');
return null;
}

const result = await loadModelIntoScene(firstModel.path);

if (result) {
currentModelPath = firstModel.path;
}

return skinningScene.scene;
}

/**
* Update skinning scene each frame
*/
export function updateSkinningScene(delta, settings, renderer) {
loadedModels.forEach((modelData) => {
if (modelData.mixer) {
modelData.mixer.update(delta);
}
});

const darkColor = new THREE.Color(0x111111);
if (skinningScene.scene) {
skinningScene.scene.background = settings.greenScreen?.value ? skinningScene.greenScreenColor : darkColor;
}

// Update point size from settings
if (settings.pointSize && settings.pointSizeAudio) {
updatePointSettings(settings.pointSize.value, settings.pointSizeAudio.value);
}

// Update effect time
updateEffectTime(delta);
}

/**
* Cleanup skinning scene and dispose all GPU resources
*/
export function cleanupSkinningScene() {
console.log('[Skinning] Starting cleanup...');

clearDynamicAnimations();

loadedModels.forEach((modelData, path) => {
unloadModel(path);
});
loadedModels.clear();

if (skinningScene.scene) {
skinningScene.scene.traverse((child) => {
if (child.isMesh) {
child.geometry?.dispose();
if (Array.isArray(child.material)) {
child.material.forEach(m => m?.dispose());
} else {
child.material?.dispose();
}
}
});
skinningScene.scene = null;
}

skinningScene.loaded = false;
skinningScene.currentAnimationName = '';
currentModelPath = null;

console.log('[Skinning] Cleanup complete');
}
