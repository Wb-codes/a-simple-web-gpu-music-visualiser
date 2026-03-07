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

// Render mode: 'points' or 'plexus'
let renderMode = 'points';

// Frame counter for plexus updates (reduce CPU load)
let frameCounter = 0;

// Store original point size value for plexus mode scaling
let originalPointSizeBase = 5;
const PLEXUS_POINT_SIZE_MULTIPLIER = 2.5;

// Plexus configuration
const PLEXUS = {
  maxConnections: 8000,
  connectionDistance: 15,
  sampleCount: 500, // Maximum 500 points
  maxDistance: 100,
  outlierThreshold: 500,
  updateInterval: 2, // Update plexus every N frames (1 = every frame, 2 = every 2 frames, etc.)

  // Point regeneration (acts as random seed)
  randomSeed: uniform(0.5), // Used to regenerate random sampling when changed

  // Point distribution controls (legacy - kept for API compatibility)
  noiseType: 'hybrid',
  noiseScale: uniform(5),
  noiseStrength: uniform(0.5),
  shellThickness: uniform(0.5),
  noiseVariation: uniform(2),

  // Cycling animation
  cycleEnabled: false, // Enable cycling through connections
  cycleSpeed: uniform(1.0), // Speed of the scanline effect
  cycleFraction: uniform(0.3), // Fraction of connections visible at once (0.1 to 1.0)
  cyclePhase: 0 // Current phase (internal, updated at runtime)
};

/**
 * Set plexus connection distance (controls density)
 * @param {number} distance - Maximum distance for connections (lower = more dense, higher = less dense)
 */
export function setPlexusDistance(distance) {
  PLEXUS.connectionDistance = Math.max(3, Math.min(40, distance)); // Clamp between 3 and 40
  PLEXUS.maxDistance = PLEXUS.connectionDistance * 5; // Max is 5x connection distance
  console.log('[Skinning] Plexus connection distance set to:', PLEXUS.connectionDistance);
}

/**
 * Get current plexus connection distance
 * @returns {number} Current connection distance
 */
export function getPlexusDistance() {
  return PLEXUS.connectionDistance;
}

/**
 * Set plexus noise scale (controls pattern frequency)
 * @param {number} scale - Noise scale (higher = more frequent patterns, lower = smoother)
 */
export function setPlexusNoiseScale(scale) {
  PLEXUS.noiseScale.value = Math.max(1, Math.min(20, scale));
  console.log('[Skinning] Plexus noise scale set to:', PLEXUS.noiseScale.value);
}

/**
 * Get current plexus noise scale
 * @returns {number} Current noise scale
 */
export function getPlexusNoiseScale() {
  return PLEXUS.noiseScale.value;
}

/**
 * Set plexus noise strength (controls how much noise affects distribution)
 * @param {number} strength - Noise strength (0 = uniform, 1 = highly noise-influenced)
 */
export function setPlexusNoiseStrength(strength) {
  PLEXUS.noiseStrength.value = Math.max(0, Math.min(1, strength));
  console.log('[Skinning] Plexus noise strength set to:', PLEXUS.noiseStrength.value);
}

/**
 * Get current plexus noise strength
 * @returns {number} Current noise strength
 */
export function getPlexusNoiseStrength() {
  return PLEXUS.noiseStrength.value;
}

/**
 * Set plexus shell thickness (controls how many vertices are sampled)
 * @param {number} thickness - Shell thickness threshold (lower = more points, higher = fewer points)
 */
export function setPlexusShellThickness(thickness) {
  PLEXUS.shellThickness.value = Math.max(0.05, Math.min(0.95, thickness));
  console.log('[Skinning] Plexus point density set to:', PLEXUS.shellThickness.value);
}

/**
 * Get current plexus shell thickness
 * @returns {number} Current shell thickness
 */
export function getPlexusShellThickness() {
  return PLEXUS.shellThickness.value;
}

/**
 * Set plexus noise variation (controls pattern complexity)
 * @param {number} variation - Noise variation (higher = more complex patterns)
 */
export function setPlexusNoiseVariation(variation) {
  PLEXUS.noiseVariation.value = Math.max(1, Math.min(10, variation));
  console.log('[Skinning] Plexus noise variation set to:', PLEXUS.noiseVariation.value);
}

/**
 * Get current plexus noise variation
 * @returns {number} Current noise variation
 */
export function getPlexusNoiseVariation() {
  return PLEXUS.noiseVariation.value;
}

/**
 * Set plexus cycle enabled state
 * @param {boolean} enabled - Whether to cycle through connections
 */
export function setPlexusCycleEnabled(enabled) {
  PLEXUS.cycleEnabled = enabled;
  console.log('[Skinning] Plexus cycling', enabled ? 'enabled' : 'disabled');
}

/**
 * Get plexus cycle enabled state
 * @returns {boolean} Whether cycling is enabled
 */
export function getPlexusCycleEnabled() {
  return PLEXUS.cycleEnabled;
}

/**
 * Set plexus cycle speed
 * @param {number} speed - Cycle speed (0.1 to 5.0)
 */
export function setPlexusCycleSpeed(speed) {
  PLEXUS.cycleSpeed.value = Math.max(0.1, Math.min(5.0, speed));
  console.log('[Skinning] Plexus cycle speed set to:', PLEXUS.cycleSpeed.value);
}

/**
 * Get plexus cycle speed
 * @returns {number} Current cycle speed
 */
export function getPlexusCycleSpeed() {
  return PLEXUS.cycleSpeed.value;
}

/**
 * Set plexus cycle fraction (how many connections visible at once)
 * @param {number} fraction - Fraction of connections (0.1 to 1.0)
 */
export function setPlexusCycleFraction(fraction) {
  PLEXUS.cycleFraction.value = Math.max(0.1, Math.min(1.0, fraction));
  console.log('[Skinning] Plexus cycle fraction set to:', PLEXUS.cycleFraction.value);
}

/**
 * Get plexus cycle fraction
 * @returns {number} Current cycle fraction
 */
export function getPlexusCycleFraction() {
  return PLEXUS.cycleFraction.value;
}

/**
 * Set plexus random seed (regenerates sampling with new random points)
 * @param {number} seed - Seed value (0.0 to 1.0)
 */
export function setPlexusRandomSeed(seed) {
  PLEXUS.randomSeed.value = Math.max(0.0, Math.min(1.0, seed));
  console.log('[Skinning] Plexus random seed set to:', PLEXUS.randomSeed.value);
  regeneratePlexusSampling();
}

/**
 * Get current plexus random seed
 * @returns {number} Current seed value
 */
export function getPlexusRandomSeed() {
  return PLEXUS.randomSeed.value;
}

/**
 * Regenerate plexus sampling with new random points
 */
export function regeneratePlexusSampling() {
  loadedModels.forEach((modelData) => {
    modelData.gpuResources.forEach(resource => {
      if (resource.plexusMesh && resource.childMesh && resource.childMesh.skeleton) {
        regenerateSampling(resource.childMesh, resource);
      }
    });
  });
  console.log('[Skinning] Regenerated plexus sampling');
}

/**
 * Set the render mode for skinning scene
 * @param {string} mode - 'points' or 'plexus'
 */
export function setRenderMode(mode) {
  if (mode !== 'points' && mode !== 'plexus') {
    console.warn('[Skinning] Invalid render mode:', mode);
    return;
  }
  const previousMode = renderMode;
  renderMode = mode;
  console.log('[Skinning] Render mode set to:', mode);

  // Adjust point size for plexus mode
  if (mode === 'plexus' && previousMode !== 'plexus') {
    // Store original size and scale up for plexus
    originalPointSizeBase = pointSizeBase.value;
    pointSizeBase.value = originalPointSizeBase * PLEXUS_POINT_SIZE_MULTIPLIER;
    console.log('[Skinning] Point size scaled up:', originalPointSizeBase, '→', pointSizeBase.value);
  } else if (mode === 'points' && previousMode === 'plexus') {
    // Restore original size when switching back to points
    pointSizeBase.value = originalPointSizeBase;
    console.log('[Skinning] Point size restored:', pointSizeBase.value);
  }

  // Update visibility of point clouds and plexus meshes
  loadedModels.forEach((modelData) => {
    modelData.gpuResources.forEach(resource => {
      if (resource.sprite) {
        // Show sprites in both modes (more visible in plexus)
        resource.sprite.visible = true;
      }
      if (resource.plexusMesh) {
        resource.plexusMesh.visible = (renderMode === 'plexus');
      }
    });
  });
}

/**
 * Get the current render mode
 * @returns {string} - 'points' or 'plexus'
 */
export function getRenderMode() {
  return renderMode;
}

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

// Add plexus mesh if created
if (result.plexusMesh) {
skinningScene.scene.add(result.plexusMesh);
result.plexusMesh.visible = (renderMode === 'plexus');
}

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
if (skinningScene.scene && resource.plexusMesh) {
skinningScene.scene.remove(resource.plexusMesh);
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
 * Regenerate sampling indices with new random seed
 * @param {THREE.Mesh} childMesh - Child mesh to regenerate sampling for
 * @param {Object} resource - GPU resource object
 */
function regenerateSampling(childMesh, resource) {
  if (!resource.plexusGeometry) return;

  const geometry = childMesh.geometry;
  const positionAttr = geometry.getAttribute('position');
  const countOfPoints = positionAttr.count;

  // Create seeded random function based on PLEXUS.randomSeed.value
  const seed = PLEXUS.randomSeed.value;
  let randomIndex = 0;
  const seededRandom = () => {
    randomIndex = (randomIndex + 1) % 1000;
    const n = Math.sin(seed * 10000 + randomIndex) * 10000;
    return n - Math.floor(n);
  };

  // Get model bounds for normalization
  const boundingBox = new THREE.Box3().setFromObject(childMesh);
  const min = boundingBox.min;
  const size = boundingBox.getSize(new THREE.Vector3());
  const cellSize = size.clone().divideScalar(6);

  // Build grid cells
  const gridSize = 6;
  const gridCells = new Array(gridSize * gridSize * gridSize).fill(null).map(() => []);

  for (let i = 0; i < countOfPoints; i++) {
    const pos = new THREE.Vector3();
    pos.fromBufferAttribute(positionAttr, i);

    const gridX = Math.max(0, Math.min(gridSize - 1, Math.floor((pos.x - min.x) / cellSize.x)));
    const gridY = Math.max(0, Math.min(gridSize - 1, Math.floor((pos.y - min.y) / cellSize.y)));
    const gridZ = Math.max(0, Math.min(gridSize - 1, Math.floor((pos.z - min.z) / cellSize.z)));

    const cellIndex = gridZ * gridSize * gridSize + gridY * gridSize + gridX;
    if (gridCells[cellIndex]) {
      gridCells[cellIndex].push(i);
    }
  }

  // Sample vertices using seeded random
  const sampleIndices = [];

  // Collect non-empty cell indices
  const nonEmptyCells = [];
  let totalVertices = 0;
  for (let i = 0; i < gridCells.length; i++) {
    if (gridCells[i].length > 0) {
      nonEmptyCells.push(i);
      totalVertices += gridCells[i].length;
    }
  }

  if (nonEmptyCells.length === 0) {
    console.warn('[Skinning] No non-empty cells found');
    return;
  }

  // Shuffle cells using seeded random (Fisher-Yates shuffle)
  for (let i = nonEmptyCells.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom() * (i + 1));
    [nonEmptyCells[i], nonEmptyCells[j]] = [nonEmptyCells[j], nonEmptyCells[i]];
  }

  // Step 1: Get one vertex from each cell (ensures uniform coverage)
  for (const cellIndex of nonEmptyCells) {
    if (sampleIndices.length >= PLEXUS.sampleCount) break;

    const cell = gridCells[cellIndex];
    const randomIdx = Math.floor(seededRandom() * cell.length);
    sampleIndices.push(cell[randomIdx]);
  }

  // Step 2: Evenly distribute remaining points across all cells
  const remainingPoints = PLEXUS.sampleCount - sampleIndices.length;
  if (remainingPoints > 0) {
    const pointsPerCell = Math.floor(remainingPoints / nonEmptyCells.length);
    let extraPoints = remainingPoints - (pointsPerCell * nonEmptyCells.length);

    for (const cellIndex of nonEmptyCells) {
      if (sampleIndices.length >= PLEXUS.sampleCount) break;

      const cell = gridCells[cellIndex];
      const pointsFromCell = pointsPerCell + (extraPoints > 0 ? 1 : 0);
      if (extraPoints > 0) extraPoints--;

      // Select random vertices from this cell
      for (let j = 0; j < pointsFromCell && sampleIndices.length < PLEXUS.sampleCount; j++) {
        const randomIdx = Math.floor(seededRandom() * cell.length);
        sampleIndices.push(cell[randomIdx]);
      }
    }
  }

  // Update the geometry userData with new sample indices
  resource.plexusGeometry.userData = { sampleIndices: new Uint32Array(sampleIndices) };
  console.log('[Skinning] Regenerated sampling:', sampleIndices.length, 'points');
}

/**
 * Update plexus connections based on current skinned positions
 * @param {THREE.Mesh} childMesh - The skinned mesh
 * @param {Object} resource - GPU resources containing plexus mesh
 */
function updatePlexusConnections(childMesh, resource) {
if (!resource.plexusMesh || !resource.plexusGeometry) return;

const plexusGeo = resource.plexusGeometry;
const sampleIndices = plexusGeo.userData?.sampleIndices;
if (!sampleIndices || sampleIndices.length === 0) return;

// Get the plexus positions array from the geometry
const plexusPositions = plexusGeo.getAttribute('position').array;
if (!plexusPositions) return;

// Reuse pre-allocated arrays (avoid memory leaks)
const samplePositions = resource.samplePositions || (resource.samplePositions = new Array(sampleIndices.length));
const tempVec1 = resource.tempVec1 || (resource.tempVec1 = new THREE.Vector3());
const tempVec2 = resource.tempVec2 || (resource.tempVec2 = new THREE.Vector3());
let validPositions = resource.validPositions;
let centerPos = resource.centerPos;
let isValidPos = resource.isValidPos;
const outlierThreshold = PLEXUS.outlierThreshold;

// Calculate skinned world positions for sampled vertices
if (childMesh.skeleton && childMesh.isSkinnedMesh) {
  // Skinned mesh - compute skinned positions using skeleton
  const geometry = childMesh.geometry;
  const positionAttr = geometry.getAttribute('position');
  const skinIndexAttr = geometry.getAttribute('skinIndex');
  const skinWeightAttr = geometry.getAttribute('skinWeight');
  const skeleton = childMesh.skeleton;
  const bindMatrices = skeleton.boneMatrices;
  const boneMatrixTemp = resource.boneMatrixTemp || (resource.boneMatrixTemp = new THREE.Matrix4());

  for (let i = 0; i < sampleIndices.length; i++) {
    const vertexIndex = sampleIndices[i];

    // Get bind pose position
    tempVec1.fromBufferAttribute(positionAttr, vertexIndex);

    // Get bone influences (use fromBufferAttribute for safe access to all components)
    const skinIndex = skinIndexAttr ? tempVec2.fromBufferAttribute(skinIndexAttr, vertexIndex) : tempVec2.set(0, 0, 0, 0);
    const skinWeight = skinWeightAttr ? new THREE.Vector4().fromBufferAttribute(skinWeightAttr, vertexIndex) : new THREE.Vector4(1, 0, 0, 0);

    // Apply bone transforms using all 4 bone influences
    const skinnedPos = samplePositions[i] || (samplePositions[i] = new THREE.Vector3());
    skinnedPos.set(0, 0, 0); // Reset to zero before accumulation

    if (skinIndexAttr && skinWeightAttr) {
      const boneIndices = [
        Math.floor(skinIndex.x),
        Math.floor(skinIndex.y),
        Math.floor(skinIndex.z),
        Math.floor(skinIndex.w)
      ];
      const weights = [skinWeight.x, skinWeight.y, skinWeight.z, skinWeight.w];

      for (let j = 0; j < 4; j++) {
        const weight = weights[j];
        if (weight <= 0) continue;

        const boneIdx = boneIndices[j];
        if (boneIdx < 0 || boneIdx >= skeleton.bones.length) continue;

        // Get bind pose position
        tempVec1.fromBufferAttribute(positionAttr, vertexIndex);
        boneMatrixTemp.fromArray(bindMatrices, boneIdx * 16);
        tempVec1.applyMatrix4(boneMatrixTemp);
        skinnedPos.addScaledVector(tempVec1, weight);
      }
    }

    // Validate
    if (isNaN(skinnedPos.x) || !isFinite(skinnedPos.x)) {
      samplePositions[i].set(0, 0, 0);
    }
  }
} else {
  // Static mesh - use bind pose vertices with world matrix
  const originalGeo = childMesh.geometry;
  const positionAttr = originalGeo.getAttribute('position');
  if (!positionAttr) return;

  for (let i = 0; i < sampleIndices.length; i++) {
    tempVec1.fromBufferAttribute(positionAttr, sampleIndices[i]);
    tempVec1.applyMatrix4(childMesh.matrixWorld);
    const targetPos = samplePositions[i] || (samplePositions[i] = new THREE.Vector3());
    targetPos.copy(tempVec1);
  }
}

// Calculate center and valid positions (only once per session)
if (!validPositions || !centerPos) {
  validPositions = resource.validPositions || (resource.validPositions = new Array(sampleIndices.length));
  let validCount = 0;
  centerPos = resource.centerPos || (resource.centerPos = new THREE.Vector3());
  centerPos.set(0, 0, 0);

  for (let i = 0; i < samplePositions.length; i++) {
    const pos = samplePositions[i];
    if (!isNaN(pos.x) && Math.abs(pos.x) < outlierThreshold &&
        Math.abs(pos.y) < outlierThreshold && Math.abs(pos.z) < outlierThreshold) {
      centerPos.add(pos);
      validPositions[i] = true;
      validCount++;
    }
  }

  if (validCount > 0) {
    centerPos.divideScalar(validCount);
  }

  // Create validation helper
  isValidPos = resource.isValidPos || (resource.isValidPos = (i => {
    const pos = samplePositions[i];
    if (!pos || isNaN(pos.x) || Math.abs(pos.x) > outlierThreshold) return false;
    if (validPositions[i]) return true;
    return pos.distanceTo(centerPos) <= outlierThreshold;
  }));
}

// Find connections using distance-based algorithm (each point has up to 5 connections)
let connectionCount = 0;
const distanceThreshold = PLEXUS.connectionDistance;
const maxDistance = PLEXUS.maxDistance;
const maxConnectionsPerPoint = 5;

// Track connection degree for each point
const degrees = new Array(sampleIndices.length).fill(0);
const edges = new Map(); // Key: "i,j" sorted, Value: true

// Seeded random for consistent traversal order
const seed = PLEXUS.randomSeed.value;
let randomIdx = 0;
const seededRandom = () => {
  randomIdx = (randomIdx + 1) % 1000;
  const n = Math.sin(seed * 10000 + randomIdx) * 10000;
  return n - Math.floor(n);
};

// Shuffle indices to create random traversal order
const shuffledIndices = sampleIndices.map((_, i) => i);
for (let i = shuffledIndices.length - 1; i > 0; i--) {
  const j = Math.floor(seededRandom() * (i + 1));
  [shuffledIndices[i], shuffledIndices[j]] = [shuffledIndices[j], shuffledIndices[i]];
}

// Function to check if edge exists
const edgeExists = (i, j) => {
  const key = i < j ? `${i},${j}` : `${j},${i}`;
  return edges.has(key);
};

// Function to add edge
const addEdge = (i, j) => {
  const key = i < j ? `${i},${j}` : `${j},${i}`;
  edges.set(key, true);
  degrees[i]++;
  degrees[j]++;
};

// Calculate target connections based on point density
// Closer points = more connections (up to 5), farther = fewer (at least 1)
const calculateTargetConnections = (i) => {
  // Find average distance to nearest neighbors
  let totalDist = 0;
  let neighborsFound = 0;

  for (let j = 0; j < sampleIndices.length && neighborsFound < 10; j++) {
    if (i === j) continue;
    if (!isValidPos(j)) continue;

    const dist = samplePositions[i].distanceTo(samplePositions[j]);
    if (dist < distanceThreshold) {
      totalDist += dist;
      neighborsFound++;
    }
  }

  if (neighborsFound === 0) return 1; // At least 1 connection if possible

  const avgDist = totalDist / neighborsFound;
  // Map average distance to 1-5 connections (closer = more)
  const normalizedDist = avgDist / distanceThreshold;
  const targetConnections = Math.max(1, Math.min(5, Math.ceil(5 - normalizedDist * 4)));

  return targetConnections;
};

// Build connections based on distance and density
for (const i of shuffledIndices) {
  if (connectionCount >= PLEXUS.maxConnections) break;
  if (!isValidPos(i)) continue;

  const targetConnections = calculateTargetConnections(i);
  if (degrees[i] >= targetConnections) continue;

  // Find all potential neighbors sorted by distance
  const neighbors = [];
  for (let j = 0; j < sampleIndices.length; j++) {
    if (i === j) continue;
    if (!isValidPos(j)) continue;
    if (degrees[j] >= maxConnectionsPerPoint) continue;
    if (edgeExists(i, j)) continue;

    const dist = samplePositions[i].distanceTo(samplePositions[j]);
    if (dist < distanceThreshold && dist < maxDistance) {
      neighbors.push({ index: j, distance: dist });
    }
  }

  // Sort by distance (nearest first)
  neighbors.sort((a, b) => a.distance - b.distance);

  // Connect to nearest neighbor(s) based on target count
  for (let k = 0; k < neighbors.length && degrees[i] < targetConnections && connectionCount < PLEXUS.maxConnections; k++) {
    const neighbor = neighbors[k];
    const j = neighbor.index;

    if (degrees[j] >= maxConnectionsPerPoint) continue;

    const idx1 = connectionCount * 6 + 0;
    const idx2 = connectionCount * 6 + 3;

    const pos1 = samplePositions[i];
    const pos2 = samplePositions[j];

    plexusPositions[idx1 + 0] = pos1.x;
    plexusPositions[idx1 + 1] = pos1.y;
    plexusPositions[idx1 + 2] = pos1.z;

    plexusPositions[idx2 + 0] = pos2.x;
    plexusPositions[idx2 + 1] = pos2.y;
    plexusPositions[idx2 + 2] = pos2.z;

    addEdge(i, j);
    connectionCount++;
  }
}

// Set the draw range based on cycling state
if (PLEXUS.cycleEnabled && connectionCount > 0) {
  // Update cycle phase
  const visibleConnections = Math.ceil(connectionCount * PLEXUS.cycleFraction.value);

  // Set active range based on phase
  const phaseOffset = Math.floor((PLEXUS.cyclePhase % 1) * connectionCount);

  // Start from offset, limit by visible connections
  const startVertex = phaseOffset * 2;
  const maxVertex = Math.min(startVertex + visibleConnections * 2, connectionCount * 2);

  plexusGeo.setDrawRange(startVertex, maxVertex - startVertex);
} else {
  // Show all connections when cycling is disabled
  plexusGeo.setDrawRange(0, connectionCount * 2);
}

// Update the position attribute
const posAttr = plexusGeo.getAttribute('position');
posAttr.needsUpdate = true;
}

/**
 * Create a point cloud from a skinned or static mesh
 * @param {THREE.Mesh} child - Child mesh to process
 * @param {THREE.WebGPURenderer} renderer - Renderer for compute shaders
 * @param {THREE.Scene} scene - Scene to add to
 * @returns {Object} Point cloud resources
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

// Create plexus mesh for dynamic line connections
let plexusMesh = null;
let plexusGeometry = null;
let plexusPositions = null;
let plexusSampleIndices = null;

if (child.skeleton) {
  // Skinned mesh - create plexus with sampled vertices
  plexusGeometry = new THREE.BufferGeometry();

  // Multi-layer noise algorithm for creative shell distribution
  const sampleIndices = [];
  const positionAttr = child.geometry.getAttribute('position');

  // Get model bounds for normalization
  const boundingBox = new THREE.Box3().setFromObject(child);
  const center = boundingBox.getCenter(new THREE.Vector3());
  const size = boundingBox.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  // Get current density parameter
  const density = PLEXUS.shellThickness.value; // 0.05 to 0.95

  // UNIFORM SPATIAL SAMPLING: Use 3D grid to ensure points are distributed across all body parts
  const gridSize = 6; // 6x6x6 grid for coarse spatial distribution
  const gridCells = new Array(gridSize * gridSize * gridSize).fill(null).map(() => []);

  const min = boundingBox.min;
  const cellSize = size.clone().divideScalar(gridSize);

  // Categorize all vertices into grid cells
  for (let i = 0; i < countOfPoints; i++) {
    const pos = new THREE.Vector3();
    pos.fromBufferAttribute(positionAttr, i);

    // Clamp grid coordinates to [0, gridSize-1] to handle boundary/corner cases
    const gridX = Math.max(0, Math.min(gridSize - 1, Math.floor((pos.x - min.x) / cellSize.x)));
    const gridY = Math.max(0, Math.min(gridSize - 1, Math.floor((pos.y - min.y) / cellSize.y)));
    const gridZ = Math.max(0, Math.min(gridSize - 1, Math.floor((pos.z - min.z) / cellSize.z)));

    const cellIndex = gridZ * gridSize * gridSize + gridY * gridSize + gridX;
    if (gridCells[cellIndex]) {
      gridCells[cellIndex].push(i);
    }
  }

  // Step 1: Sample one vertex from each non-empty grid cell (ensures uniform coverage)
  const usedCells = new Set();
  for (let cellIndex = 0; cellIndex < gridCells.length; cellIndex++) {
    if (sampleIndices.length >= PLEXUS.sampleCount) break;

    const cell = gridCells[cellIndex];
    if (cell.length > 0 && !usedCells.has(cellIndex)) {
      const randomIdx = Math.floor(Math.random() * cell.length);
      sampleIndices.push(cell[randomIdx]);
      usedCells.add(cellIndex);
    }
  }

  // Step 2: Fill remaining points randomly from all cells based on density
  const totalCellsWithVertices = gridCells.filter(c => c.length > 0).length;
  const basePointsPerCell = Math.floor(PLEXUS.sampleCount / totalCellsWithVertices);

  for (let cellIndex = 0; cellIndex < gridCells.length; cellIndex++) {
    if (sampleIndices.length >= PLEXUS.sampleCount) break;

    const cell = gridCells[cellIndex];
    if (cell.length === 0) continue;

    const pointsFromCell = Math.min(
      basePointsPerCell + Math.ceil(Math.random() * basePointsPerCell * density * 2),
      cell.length,
      PLEXUS.sampleCount - sampleIndices.length
    );

    for (let j = 0; j < pointsFromCell; j++) {
      const randomIdx = Math.floor(Math.random() * cell.length);
      sampleIndices.push(cell[randomIdx]);
    }
  }

  plexusSampleIndices = new Uint32Array(sampleIndices);

  // Create line connections (maximum PLEXUS.maxConnections lines = 2 * maxConnections vertices)
  plexusPositions = new Float32Array(PLEXUS.maxConnections * 2 * 3);
  plexusGeometry.setAttribute('position', new THREE.BufferAttribute(plexusPositions, 3));

  // Log only on first load, not every model
  console.log('[Plexus] Created:', plexusSampleIndices.length, 'samples, max', PLEXUS.maxConnections, 'connections');

  // Create material for plexus (audio-reactive red color)
  const plexusMaterial = new THREE.LineBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  plexusMesh = new THREE.LineSegments(plexusGeometry, plexusMaterial);
  plexusMesh.frustumCulled = false;

  // Store sample indices for updates
  plexusGeometry.userData = { sampleIndices: plexusSampleIndices };

  console.log('[Plexus] Created:', plexusSampleIndices.length, 'samples (multi-layer noise shell), max', PLEXUS.maxConnections, 'connections');
}

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
  plexusMesh: plexusMesh,
  plexusGeometry: plexusGeometry,
  positionArray: pointPositionArray,
  speedArray: pointSpeedArray,
  positionBuffer: positionBuffer,
  material: materialPoints,
  childMesh: child,
  applyEffect: applyEffect,

  /**
   * Cleanup function to dispose GPU resources
   */
  dispose: () => {
// Dispose material
if (materialPoints) {
materialPoints.dispose();
}

// Dispose plexus mesh
if (plexusMesh) {
plexusGeometry.dispose();
if (plexusMesh.material) {
plexusMesh.material.dispose();
}
plexusMesh = null;
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

// Update plexus connections when in plexus mode (only every N frames to reduce CPU load)
if (renderMode === 'plexus') {
  frameCounter++;

  // Update cycle phase every frame for smooth animation
  if (PLEXUS.cycleEnabled) {
    PLEXUS.cyclePhase += delta * PLEXUS.cycleSpeed.value;
  }

  if (frameCounter % PLEXUS.updateInterval === 0) {
    loadedModels.forEach((modelData) => {
      modelData.gpuResources.forEach(resource => {
        if (resource.plexusMesh && resource.plexusMesh.visible && resource.childMesh) {
          updatePlexusConnections(resource.childMesh, resource);
        }
      });
    });
  }
}

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
