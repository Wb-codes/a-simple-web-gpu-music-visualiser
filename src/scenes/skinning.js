/**
 * @module scenes/skinning
 * @description Skinning points scene with animated character point cloud.
 * Supports dynamic GLB loading with automatic animation detection.
 * Loads a GLTF model and renders it as audio-reactive points.
 */

import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { 
  vec3, float, Fn, color, shapeCircle, instanceIndex,
  instancedArray, objectWorldMatrix, computeSkinning, instancedBufferAttribute,
  attribute
} from 'three/tsl';

import { audioBass, audioMid, audioHigh } from '../audio/uniforms.js';
import { 
  getFullAnimationName, 
  buildAnimationMapFromGLB,
  clearDynamicAnimations,
  getAnimationNames,
  getDefaultAnimation,
  DYNAMIC_ANIMATION_NAMES
} from '../core/animations.js';
import { getUploadedGLBs, saveUploadedGLB, getGLBBlobUrl } from '../utils/file-storage.js';

/**
 * Available GLB models in the skinning folder
 * This will be populated by scanning the folder or user selection
 * @type {Array<{name: string, path: string}>}
 */
export const AVAILABLE_MODELS = [
  { name: 'Michelle', path: 'models/gltf/skinning/Michelle.glb' },
  { name: 'Boltvis', path: 'models/gltf/skinning/boltvis.glb' }
];

/**
 * GLB files discovered in the skinning folder
 * Categorized by whether they have animations
 * @type {Object}
 */
export const DISCOVERED_GLBS = {
  animated: [], // GLBs with animations
  static: []    // GLBs without animations
};

/**
 * Currently loaded additional models (not the main model)
 * @type {Map<string, {model: THREE.Group, visible: boolean, hasAnimations: boolean}>}
 */
export const loadedAdditionalModels = new Map();

/**
 * Name of the currently visible animated model (for checkbox state)
 * @type {string|null}
 */
export let currentAnimatedModel = null;

/**
 * Set the currently visible animated model
 * @param {string} modelName - Name of the visible animated model
 */
export function setCurrentAnimatedModel(modelName) {
  currentAnimatedModel = modelName;
}

/**
 * Get the currently visible animated model
 * @returns {string|null}
 */
export function getCurrentAnimatedModel() {
  return currentAnimatedModel;
}

/**
 * Clear current animated model (when none visible)
 */
export function clearCurrentAnimatedModel() {
  currentAnimatedModel = null;
}

/**
 * Scan the skinning folder for GLB files
 * Uses a manifest file (index.json) if available, falls back to hardcoded list
 * Loads each GLB to verify animations and categorize accordingly
 * @returns {Promise<Object>} Object with animated and static arrays
 */
export async function scanSkinningFolder() {
  const skinningPath = 'models/gltf/skinning/';
  let fileList = [];
  
  // Save uploaded models to preserve them
  const uploadedAnimated = DISCOVERED_GLBS.animated.filter(m => m.isImported);
  const uploadedStatic = DISCOVERED_GLBS.static.filter(m => m.isImported);
  
  // Reset discovered lists (keeping uploaded models)
  DISCOVERED_GLBS.animated = [...uploadedAnimated];
  DISCOVERED_GLBS.static = [...uploadedStatic];
  
  // Try to load manifest file first (backward compatible)
  try {
    const response = await fetch(skinningPath + 'index.json');
    if (response.ok) {
      const manifest = await response.json();
      fileList = manifest.models.map(m => ({
        file: m.path.split('/').pop(),
        path: m.path
      }));
      console.log(`[Skinning] Loaded ${fileList.length} models from manifest`);
    } else {
      throw new Error('Manifest not found');
    }
  } catch (error) {
    // Fallback to hardcoded list (backward compatibility)
    console.log('[Skinning] Manifest not found, using hardcoded list');
    fileList = [
      { file: 'Michelle.glb', path: 'models/gltf/skinning/Michelle.glb' },
      { file: 'boltvis.glb', path: 'models/gltf/skinning/boltvis.glb' },
      { file: 'cliptest.glb', path: 'models/gltf/skinning/cliptest.glb' }
    ];
  }
  
  // Update AVAILABLE_MODELS to match discovered files (do NOT clear, only add missing)
  // First, add uploaded models (preserve them)
  const uploadedModels = AVAILABLE_MODELS.filter(m => m.isImported);
  uploadedModels.forEach(m => {
    // Check if model with this path already exists (avoid duplicates)
    const exists = AVAILABLE_MODELS.some(existing => existing.path === m.path);
    if (!exists) AVAILABLE_MODELS.push(m);
  });
  
  // Add manifest models (only if not already in list by path OR name)
  fileList.forEach(({ file, path }) => {
    const name = file.replace('.glb', '');
    // Check if model with same name OR same path already exists
    // This prevents duplicates from manifest vs uploaded with same name
    const alreadyExists = AVAILABLE_MODELS.some(m => 
      m.path === path || m.name === name
    );
    if (!alreadyExists) {
      AVAILABLE_MODELS.push({ name, path });
    }
  });

  // Also scan uploaded GLBs from IndexedDB (virtual storage)
  try {
    const uploadedFromDB = await getUploadedGLBs();
    if (uploadedFromDB && uploadedFromDB.length > 0) {
      console.log(`[Skinning] Found ${uploadedFromDB.length} uploaded GLBs in virtual storage`);
      
      for (const uploaded of uploadedFromDB) {
        const uploadedName = uploaded.name.replace('.glb', '');
        const indexedPath = `indexeddb://${uploaded.name}`;
        
        // Check if already in AVAILABLE_MODELS
        const existsInAvailable = AVAILABLE_MODELS.some(m => m.name === uploadedName);
        if (!existsInAvailable) {
          // Add to AVAILABLE_MODELS with indexeddb:// path
          AVAILABLE_MODELS.push({
            name: uploadedName,
            path: indexedPath,
            isImported: true,
            hasAnimations: false // Will be determined on load
          });
          console.log(`[Skinning] Restored from IndexedDB: ${uploadedName}`);
        }
        
        // Check if already in DISCOVERED_GLBS
        const existsInAnimated = DISCOVERED_GLBS.animated.some(m => m.name === uploadedName);
        const existsInStatic = DISCOVERED_GLBS.static.some(m => m.name === uploadedName);
        
        if (!existsInAnimated && !existsInStatic) {
          // We need to scan it to determine if it's animated
          fileList.push({
            file: uploaded.name,
            path: indexedPath
          });
        }
      }
    }
  } catch (error) {
    console.warn('[Skinning] Failed to scan uploaded GLBs:', error);
  }
  
// Verify each file by loading it
  const loader = new GLTFLoader();

  for (const { file, path } of fileList) {
    try {
      console.log(`[Skinning] Scanning ${file}...`);
      
      // Handle indexeddb:// paths specially
      let loadPath = path;
      let isTemporaryBlob = false;
      
      if (path.startsWith('indexeddb://')) {
        const modelName = file.replace('.glb', '');
        console.log(`[Skinning] Converting indexeddb:// path for scanning: ${modelName}`);
        
        try {
          const glbData = await getUploadedGLB(file);
          if (glbData && glbData.data) {
            const blob = new Blob([glbData.data], { type: 'model/gltf-binary' });
            loadPath = URL.createObjectURL(blob);
            isTemporaryBlob = true;
            console.log(`[Skinning] Created blob URL for scanning: ${modelName}`);
          } else {
            console.warn(`[Skinning] Model not found in IndexedDB: ${file}`);
            continue;
          }
        } catch (dbError) {
          console.warn(`[Skinning] Error reading from IndexedDB: ${dbError.message}`);
          continue;
        }
      }
      
      const gltf = await new Promise((resolve, reject) => {
        loader.load(loadPath, resolve, undefined, reject);
      });
      
      // Clean up temporary blob URL
      if (isTemporaryBlob) {
        URL.revokeObjectURL(loadPath);
        console.log(`[Skinning] Revoked temporary blob URL after scanning`);
      }

      const hasAnimations = gltf.animations && gltf.animations.length > 0;
      const modelInfo = {
        name: file.replace('.glb', ''),
        path: path, // Keep original indexeddb:// path
        hasAnimations: hasAnimations,
        animationCount: hasAnimations ? gltf.animations.length : 0
      };

      console.log(`[Skinning] Scanned ${file}: animations=${modelInfo.animationCount}`);

      if (hasAnimations) {
        DISCOVERED_GLBS.animated.push(modelInfo);
      } else {
        DISCOVERED_GLBS.static.push(modelInfo);
      }
    } catch (error) {
      console.warn(`[Skinning] Failed to scan ${file}:`, error);
    }
  }
  
console.log('[Skinning] Scan complete:', {
  animated: DISCOVERED_GLBS.animated.length,
  static: DISCOVERED_GLBS.static.length
});

return DISCOVERED_GLBS;
}

/**
 * Currently selected model
 * @type {string}
 */
export let currentModelPath = AVAILABLE_MODELS[0]?.path || 'models/gltf/skinning/Michelle.glb';

/**
 * Callback for when animations are loaded (for UI updates)
 * @type {Function|null}
 */
let onAnimationsLoadedCallback = null;

/**
 * Skinning scene state and configuration.
 * @type {Object}
 */
export const skinningScene = {
  /** @type {THREE.Scene|null} */
  scene: null,
  /** @type {THREE.AnimationMixer|null} */
  mixer: null,
  /** @type {THREE.Clock} */
  clock: new THREE.Clock(),
  /** @type {boolean} */
  loaded: false,
  /** @type {THREE.Color} */
  backgroundColor: new THREE.Color(0x111111),
  /** @type {Array<THREE.AnimationClip>|null} */
  animations: null,
  /** @type {THREE.AnimationAction|null} */
  currentAction: null,
  /** @type {string} */
  currentAnimationName: getDefaultAnimation(),
  /** @type {THREE.Group|null} */
  model: null,
  /** @type {string|null} */
  currentModelPath: null,
  /** @type {Array<THREE.Sprite>} */
  pointClouds: [],
  /** @type {THREE.WebGPURenderer|null} */
  renderer: null,
  /** @type {THREE.PerspectiveCamera|null} */
  camera: null,
  /** @type {OrbitControls|null} */
  controls: null
};

/**
 * Set callback for when animations are loaded
 * @param {Function} callback - Function to call with animation names array
 */
export function setOnAnimationsLoaded(callback) {
  onAnimationsLoadedCallback = callback;
}

/**
 * Load a specific GLB model
 * @param {string} modelPath - Path to the GLB file
 * @param {THREE.WebGPURenderer} renderer - The WebGPU renderer
 * @param {THREE.PerspectiveCamera} camera - Main camera
 * @param {OrbitControls} controls - Camera controls
 * @returns {Promise<THREE.Scene>}
 */
// loadModel is now defined below with proper parameter handling

/**
 * Reload the current model (useful after file changes)
 * Uses stored renderer, camera, and controls from scene state
 * @returns {Promise<THREE.Scene>}
 */
export async function reloadCurrentModel() {
  if (!skinningScene.renderer || !skinningScene.camera || !skinningScene.controls) {
    console.error('Cannot reload: scene not properly initialized');
    throw new Error('Scene not initialized');
  }
  return loadModel(currentModelPath, skinningScene.renderer, skinningScene.camera, skinningScene.controls);
}

/**
 * Import a GLB file via drag and drop or file picker
 * Saves file to IndexedDB and adds to model lists WITHOUT loading
 * The model is only loaded when selected from the dropdown
 * Supports up to 100MB of storage
 * @param {File} file - The GLB file to import
 * @returns {Promise<Object>} Object with hasAnimations, animationCount, modelName, blobUrl
 */
export async function importGLBFile(file) {
  const modelName = file.name.replace('.glb', '');
  
  console.log(`[Skinning] Importing GLB file: ${file.name}`);

  try {
    // Step 1: Save file to IndexedDB for persistence
    console.log(`[Skinning] Saving to IndexedDB...`);
    const savedFile = await saveUploadedGLB(file);
    console.log(`[Skinning] Saved to IndexedDB: ${savedFile.name}, blobUrl: ${savedFile.blobUrl}`);

    // Step 2: Check if model already exists and remove to prevent duplicates
    const existingAnimatedIndex = DISCOVERED_GLBS.animated.findIndex(m => m.name === modelName);
    const existingStaticIndex = DISCOVERED_GLBS.static.findIndex(m => m.name === modelName);
    
    if (existingAnimatedIndex !== -1) {
      console.log(`[Skinning] Removing existing animated model entry: ${modelName}`);
      DISCOVERED_GLBS.animated.splice(existingAnimatedIndex, 1);
    }
    if (existingStaticIndex !== -1) {
      console.log(`[Skinning] Removing existing static model entry: ${modelName}`);
      DISCOVERED_GLBS.static.splice(existingStaticIndex, 1);
    }

    // Step 3: Scan the file to check for animations (lightweight scan, no rendering)
    let hasAnimations = false;
    let animationCount = 0;
    
    try {
      // Quick scan without full scene initialization
      const arrayBuffer = await file.arrayBuffer();
      const gltfLoader = new GLTFLoader();
      
      await new Promise((resolve, reject) => {
        gltfLoader.parse(arrayBuffer, '', (gltf) => {
          hasAnimations = gltf.animations && gltf.animations.length > 0;
          animationCount = hasAnimations ? gltf.animations.length : 0;
          console.log(`[Skinning] Scanned ${file.name}: animations=${animationCount}`);
          resolve();
        }, (error) => {
          console.warn(`[Skinning] Failed to scan ${file.name}:`, error);
          reject(error);
        });
      });
    } catch (error) {
      console.warn(`[Skinning] Animation scan failed, defaulting to static: ${error.message}`);
      hasAnimations = false;
      animationCount = 0;
    }

    // Step 4: Create model info with special IndexedDB identifier
    // Use "indexeddb://" prefix to indicate this model needs to be loaded from IndexedDB
    const modelInfo = {
      name: modelName,
      path: `indexeddb://${modelName}.glb`, // Special identifier for IndexedDB loading
      hasAnimations: hasAnimations,
      animationCount: animationCount,
      isImported: true
    };

    // Step 5: Add to appropriate DISCOVERED_GLBS list
    if (hasAnimations) {
      DISCOVERED_GLBS.animated.push(modelInfo);
      console.log(`[Skinning] Added animated model to list: ${modelName} (${animationCount} animations)`);
    } else {
      DISCOVERED_GLBS.static.push(modelInfo);
      console.log(`[Skinning] Added static model to list: ${modelName}`);
    }

    // Step 6: Add to AVAILABLE_MODELS for main dropdown
    const existingAvailableIndex = AVAILABLE_MODELS.findIndex(m => m.name === modelName);
    if (existingAvailableIndex !== -1) {
      console.log(`[Skinning] Updating AVAILABLE_MODELS entry: ${modelName}`);
      AVAILABLE_MODELS[existingAvailableIndex] = modelInfo;
    } else {
      AVAILABLE_MODELS.push(modelInfo);
      console.log(`[Skinning] Added to AVAILABLE_MODELS: ${modelName}`);
    }

    // IMPORTANT: Model is NOT loaded into scene - it will be loaded when selected
    console.log(`[Skinning] Import complete: ${modelName} ready for selection`);

    return { hasAnimations, animationCount, modelName, path: `indexeddb://${modelName}.glb` };
  } catch (error) {
    console.error(`[Skinning] Import failed for ${file.name}:`, error);
    throw error;
  }
}

/**
 * Load a specific GLB model with stored scene references
 * Uses stored renderer, camera, and controls from scene state
 * @param {string} modelPath - Path to the GLB file
 * @returns {Promise<THREE.Scene>}
 */
export async function loadModel(modelPath) {
  if (!skinningScene.renderer || !skinningScene.camera || !skinningScene.controls) {
    console.error('Cannot load: scene not properly initialized');
    throw new Error('Scene not initialized');
  }
  return loadModelWithParams(modelPath, skinningScene.renderer, skinningScene.camera, skinningScene.controls);
}

/**
 * Load a specific GLB model with proper cleanup of previous model
 * Replaces the current model in the scene
 * @param {string} modelPath - Path to the GLB file
 * @param {THREE.WebGPURenderer} renderer - The WebGPU renderer
 * @param {THREE.PerspectiveCamera} camera - Main camera
 * @param {OrbitControls} controls - Camera controls
 * @returns {Promise<THREE.Scene>}
 */
async function loadModelWithParams(modelPath, renderer, camera, controls) {
  console.log(`[Skinning] Loading model with params: ${modelPath}`);
  
  // Clear previous model data and scene
  clearDynamicAnimations();
  
  if (skinningScene.scene) {
    // Remove old point clouds
    if (skinningScene.pointClouds) {
      skinningScene.pointClouds.forEach(cloud => {
        skinningScene.scene.remove(cloud);
        // Dispose geometry and material to free memory
        cloud.geometry?.dispose();
        cloud.material?.dispose();
      });
      skinningScene.pointClouds = [];
    }
    
    // Remove old model
    if (skinningScene.model) {
      skinningScene.scene.remove(skinningScene.model);
      // Dispose meshes
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
    }
  }
  
  // Stop previous mixer
  if (skinningScene.mixer) {
    skinningScene.mixer.stopAllAction();
    skinningScene.mixer = null;
  }
  
  skinningScene.loaded = false;
  skinningScene.currentModelPath = modelPath;
  currentModelPath = modelPath;
  
  // Get the model name from path
  const modelName = modelPath.split('/').pop().replace('.glb', '');
  
  // Check if this is an imported model that needs to be retrieved from IndexedDB
  let url = modelPath;
  let isTemporaryBlob = false;
  
  if (modelPath.startsWith('indexeddb://')) {
    console.log(`[Skinning] Loading from IndexedDB: ${modelName}`);
    try {
      const glbData = await getUploadedGLB(modelName + '.glb');
      if (glbData && glbData.data) {
        // Create fresh blob URL from stored data
        const blob = new Blob([glbData.data], { type: 'model/gltf-binary' });
        url = URL.createObjectURL(blob);
        isTemporaryBlob = true;
        console.log(`[Skinning] Created fresh blob URL from IndexedDB data: ${modelName}`);
      } else {
        console.error(`[Skinning] Model not found in IndexedDB: ${modelName}`);
        throw new Error(`Model ${modelName} not found in storage`);
      }
    } catch (error) {
      console.error(`[Skinning] Error loading from IndexedDB: ${error.message}`);
      throw error;
    }
  } else if (modelPath.startsWith('blob:')) {
    console.log(`[Skinning] Using provided blob URL: ${modelName}`);
    url = modelPath;
  }
  
  try {
    const result = await loadModelFromURL(url, modelName, renderer, camera, controls);
    return result.scene;
  } finally {
    // Clean up temporary blob URL if we created one
    if (url !== modelPath && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
      console.log(`[Skinning] Revoked temporary blob URL for: ${modelName}`);
    }
  }
}

/**
 * Load a specific GLB model (internal with params)
 * @param {string} modelPath - Path to the GLB file
 * @param {THREE.WebGPURenderer} renderer - The WebGPU renderer
 * @param {THREE.PerspectiveCamera} camera - Main camera
 * @param {OrbitControls} controls - Camera controls
 * @returns {Promise<{scene: THREE.Scene, hasAnimations: boolean, animationCount: number}>}
 */
async function loadModelFromURL(url, filename, renderer, camera, controls) {
  const scene = skinningScene.scene || new THREE.Scene();
  if (!skinningScene.scene) {
    scene.background = skinningScene.backgroundColor;
    scene.add(new THREE.AmbientLight(0xffffff, 10));
  }
  
  const loader = new GLTFLoader();
  
  return new Promise((resolve, reject) => {
    console.log('Loading model from:', url);
    loader.load(
      url,
      (gltf) => {
        console.log('Model loaded:', filename);
        console.log('Animations found:', gltf.animations.map(a => a.name));
        
        // Build dynamic animation map
        const animData = buildAnimationMapFromGLB(gltf.animations, url);
        console.log('Animation map built:', animData.names);
        
        // Notify UI of new animations
        if (onAnimationsLoadedCallback) {
          onAnimationsLoadedCallback(animData.names, animData.defaultAnimation);
        }
        
      const object = gltf.scene;
      skinningScene.model = object;
      skinningScene.mixer = new THREE.AnimationMixer(object);
      skinningScene.animations = gltf.animations;

      // Play default animation
      const defaultAnim = animData.defaultAnimation || gltf.animations[0]?.name;
      if (defaultAnim) {
        playAnimation(defaultAnim);
      }

      // Process meshes and create point clouds (main model)
      const mainPointClouds = processModelMeshes(object, renderer, scene, 'main');

      // Setup model transform
      object.scale.set(100, 100, 100);
      object.rotation.x = -Math.PI / 2;

      // Hide the original GLB meshes - only show point clouds
      object.traverse((child) => {
        if (child.isMesh) {
          child.visible = false;
        }
      });

      scene.add(object);

      // Add main model to loadedAdditionalModels so it can be toggled
      // Extract model name from URL, not filename (which might be 'model')
      const modelName = url.split('/').pop().replace('.glb', '');
      const mainModelData = {
        model: object,
        gltf: gltf,
        visible: true,
        hasAnimations: gltf.animations && gltf.animations.length > 0,
        mixer: skinningScene.mixer,
        currentAction: skinningScene.currentAction,
        name: modelName,
        pointClouds: mainPointClouds
      };
      loadedAdditionalModels.set(modelName, mainModelData);

      skinningScene.scene = scene;
        skinningScene.loaded = true;
        skinningScene.currentAnimationName = defaultAnim || '';
        
        // Set camera based on model bounds
        setupCameraForModel(object, camera, controls);
        
        console.log('Skinning scene initialized for:', filename);
        resolve({
          scene,
          hasAnimations: gltf.animations && gltf.animations.length > 0,
          animationCount: gltf.animations ? gltf.animations.length : 0
        });
      },
      (progress) => {
        const percent = (progress.loaded / progress.total) * 100;
        console.log(`Loading: ${percent.toFixed(1)}%`);
      },
      (error) => {
        console.error('Error loading GLB:', error);
        reject(error);
      }
    );
  });
}

/**
 * Track point clouds per model
 * @type {Map<string, Array<THREE.Sprite>>}
 */
export const modelPointClouds = new Map();

/**
 * Process model meshes and create point clouds
 * @param {THREE.Group} object - The loaded model
 * @param {THREE.WebGPURenderer} renderer - The WebGPU renderer
 * @param {THREE.Scene} scene - The scene to add point clouds to
 * @param {string} modelName - Name of the model (for tracking)
 * @returns {Array<THREE.Sprite>} Array of created point clouds
 */
export function processModelMeshes(object, renderer, scene, modelName = 'main') {
  const pointClouds = [];
  
  object.traverse((child) => {
    if (child.isMesh) {
      // Hide the original mesh
      child.visible = false;

      const countOfPoints = child.geometry.getAttribute('position').count;

      const pointPositionArray = instancedArray(countOfPoints, 'vec3').setPBO(true);
      const pointSpeedArray = instancedArray(countOfPoints, 'vec3').setPBO(true);

      const pointSpeedAttribute = pointSpeedArray.toAttribute();

      const materialPoints = new THREE.PointsNodeMaterial();

      // Audio-reactive color - mix between blue and orange based on audio
      materialPoints.colorNode = pointSpeedAttribute.mul(.6).mix(
        color(0x0066ff).mul(vec3(1.0).add(audioHigh.mul(0.5))),
        color(0xff9000).mul(vec3(1.0).add(audioMid.mul(0.5)))
      );

      materialPoints.opacityNode = shapeCircle().mul(float(0.8).add(audioBass.mul(0.2)));

      // Audio-reactive size - base size scales with bass
      materialPoints.sizeNode = pointSpeedAttribute.length().exp().min(5).mul(5).add(1).add(audioBass.mul(10));

      materialPoints.sizeAttenuation = false;
      materialPoints.alphaTest = 0.5;

      // For skinned meshes, animate the points; for static meshes, just show the points
      if (child.skeleton) {
        // Skinned mesh - compute skinning positions
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
        // Static mesh - create a buffer attribute and use it directly
        // We need to create an instanced buffer attribute from the geometry positions
        const positionData = child.geometry.getAttribute('position').array;
        const positionBuffer = new THREE.InstancedBufferAttribute(positionData, 3);
        
        materialPoints.positionNode = Fn(() => {
          return objectWorldMatrix(child).mul(instancedBufferAttribute(positionBuffer));
        })();
      }

      const pointCloud = new THREE.Sprite(materialPoints);
      pointCloud.count = countOfPoints;
      pointCloud.userData = { parentModel: modelName };
      scene.add(pointCloud);
      
      pointClouds.push(pointCloud);

      // Track in scene's point clouds
      if (modelName === 'main') {
        skinningScene.pointClouds.push(pointCloud);
      }
    }
  });
  
  // Track per-model point clouds
  modelPointClouds.set(modelName, pointClouds);
  
  return pointClouds;
}

/**
 * Setup camera based on model bounds
 * @param {THREE.Group} object - The loaded model
 * @param {THREE.PerspectiveCamera} camera - Main camera
 * @param {OrbitControls} controls - Camera controls
 */
function setupCameraForModel(object, camera, controls) {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  
  const maxDim = Math.max(size.x, size.y, size.z);
  const distance = maxDim * 5; // Increased from 2 to 5 to prevent clipping

  camera.position.set(center.x, center.y + distance * 0.5, center.z + distance);
  camera.lookAt(center);
  controls.target.copy(center);
  controls.update();
}

/**
 * Initialize the skinning points scene.
 * @param {THREE.WebGPURenderer} renderer - The WebGPU renderer
 * @param {THREE.PerspectiveCamera} camera - Main camera
 * @param {OrbitControls} controls - Camera controls
 * @returns {Promise<THREE.Scene>}
 */
export async function initSkinningScene(renderer, camera, controls) {
  // Store references for later reloading
  skinningScene.renderer = renderer;
  skinningScene.camera = camera;
  skinningScene.controls = controls;
  
  // If already initialized with a different model, reload
  if (skinningScene.loaded && skinningScene.currentModelPath !== currentModelPath) {
    return reloadCurrentModel();
  }
  
  // If already initialized with same model, return existing scene
  if (skinningScene.loaded) {
    return skinningScene.scene;
  }
  
  const result = await loadModelFromURL(currentModelPath, 'model', renderer, camera, controls);
  return result.scene;
}

/**
 * Play a specific animation by clean name
 * @param {string} cleanName - Clean animation name (e.g., 'DanceLoop')
 * @returns {boolean} True if animation was found and played
 */
function playAnimation(cleanName, targetModelData = null) {
  console.log(`[Skinning] playAnimation: ${cleanName}, targetModelData=${targetModelData ? targetModelData.name : 'main'}`);
  
  // Determine which model to play animation on
  let mixer, animations, modelData;
  
  if (targetModelData) {
    // Use provided model data (for additional loaded models)
    modelData = targetModelData;
    mixer = modelData.mixer;
    animations = modelData.gltf?.animations;
    console.log(`[Skinning] Using additional model ${modelData.name}: mixer=${!!mixer}, animations=${animations?.length || 0}`);
  } else {
    // Use main skinning scene
    modelData = skinningScene;
    mixer = skinningScene.mixer;
    animations = skinningScene.animations;
    console.log(`[Skinning] Using main model: mixer=${!!mixer}, animations=${animations?.length || 0}`);
  }
  
  if (!mixer || !animations) {
    console.warn('[Skinning] Cannot play animation: mixer or animations not loaded');
    return false;
  }

  const fullName = getFullAnimationName(cleanName);
  console.log(`[Skinning] Looking for animation: ${cleanName} -> ${fullName}`);
  
  if (!fullName) {
    console.warn('[Skinning] Unknown animation:', cleanName);
    return false;
  }

  const clip = animations.find(a => a.name === fullName);
  if (!clip) {
    console.warn('[Skinning] Animation clip not found in model:', fullName);
    return false;
  }

  // Stop current action if exists
  if (modelData.currentAction) {
    console.log(`[Skinning] Stopping current action on ${modelData.name || 'main'}`);
    modelData.currentAction.stop();
  }

  // Play new action
  console.log(`[Skinning] Creating clip action for ${fullName}`);
  const action = mixer.clipAction(clip);
  action.play();
  modelData.currentAction = action;
  
  if (targetModelData) {
    // Update the loaded additional model data
    targetModelData.currentAnimationName = cleanName;
  } else {
    skinningScene.currentAnimationName = cleanName;
  }

  console.log('[Skinning] Playing animation:', cleanName);
  return true;
}

/**
 * Switch to a different animation
 * @param {string} cleanName - Clean animation name (e.g., 'DanceLoop')
 * @returns {boolean} True if successful
 */
export function switchAnimation(cleanName) {
  console.log(`[Skinning] switchAnimation called: ${cleanName}`);
  
  // First check if this is the main model's current animation
  if (cleanName === skinningScene.currentAnimationName) {
    console.log(`[Skinning] Already playing ${cleanName} on main model`);
    return true; // Already playing this animation
  }
  
  // Check loaded additional models for the animation
  for (const [modelName, modelData] of loadedAdditionalModels) {
    if (modelData.hasAnimations && modelData.gltf?.animations) {
      const fullName = getFullAnimationName(cleanName);
      console.log(`[Skinning] Checking model ${modelName}: fullName=${fullName}, hasAnimation=${!!modelData.gltf.animations.find(a => a.name === fullName)}`);
      
      if (fullName && modelData.gltf.animations.find(a => a.name === fullName)) {
        // Found the animation in this model
        if (cleanName === modelData.currentAnimationName) {
          console.log(`[Skinning] Already playing ${cleanName} on ${modelName}`);
          return true; // Already playing
        }
        console.log(`[Skinning] Playing ${cleanName} on model ${modelName}`);
        return playAnimation(cleanName, modelData);
      }
    }
  }
  
  // Fallback to main model
  console.log(`[Skinning] Falling back to main model for ${cleanName}`);
  return playAnimation(cleanName);
}

/**
 * Get currently available animations
 * Returns animations from the first visible animated model, or main scene
 * @returns {Array<string>} Array of animation names
 */
export function getAvailableAnimations() {
  // First check loaded additional models for visible animated ones
  for (const [modelName, modelData] of loadedAdditionalModels) {
    if (modelData.visible && modelData.hasAnimations && modelData.gltf?.animations) {
      // Build animation map from this model's animations
      const animData = buildAnimationMapFromGLB(modelData.gltf.animations, modelData.name);
      return animData.names;
    }
  }
  
  // Fall back to dynamic animation names or main scene animations
  if (DYNAMIC_ANIMATION_NAMES.length > 0) {
    return DYNAMIC_ANIMATION_NAMES;
  }
  
  if (skinningScene.animations) {
    return skinningScene.animations.map(a => a.name);
  }
  
  return [];
}

/**
 * Load an additional GLB model (for multi-model scenes)
 * @param {string} modelPath - Path to the GLB file
 * @param {boolean} visible - Whether the model should be visible initially
 * @returns {Promise<Object>} Object with model info
 */
export async function loadAdditionalModel(modelPath, visible = false) {
  console.log(`[Skinning] loadAdditionalModel called: ${modelPath}, visible=${visible}`);

  if (!skinningScene.renderer || !skinningScene.camera || !skinningScene.controls) {
    console.error('[Skinning] Cannot load additional model: scene not initialized');
    throw new Error('Scene not initialized');
  }

  const modelName = modelPath.split('/').pop().replace('.glb', '');
  console.log(`[Skinning] Model name extracted: ${modelName}`);

  // Check if already loaded
  if (loadedAdditionalModels.has(modelName)) {
    console.log(`[Skinning] Model ${modelName} already loaded`);
    return loadedAdditionalModels.get(modelName);
  }

  // Check if this is an imported model that needs to be retrieved from IndexedDB
  let url = modelPath;
  let isTemporaryBlob = false;
  
  if (modelPath.startsWith('indexeddb://')) {
    console.log(`[Skinning] Loading additional model from IndexedDB: ${modelName}`);
    try {
      const glbData = await getUploadedGLB(modelName + '.glb');
      if (glbData && glbData.data) {
        // Create fresh blob URL from stored data
        const blob = new Blob([glbData.data], { type: 'model/gltf-binary' });
        url = URL.createObjectURL(blob);
        isTemporaryBlob = true;
        console.log(`[Skinning] Created fresh blob URL from IndexedDB data: ${modelName}`);
      } else {
        console.error(`[Skinning] Model not found in IndexedDB: ${modelName}`);
        throw new Error(`Model ${modelName} not found in storage`);
      }
    } catch (error) {
      console.error(`[Skinning] Error loading from IndexedDB: ${error.message}`);
      throw error;
    }
  } else if (modelPath.startsWith('blob:')) {
    console.log(`[Skinning] Using provided blob URL: ${modelName}`);
    url = modelPath;
  }

  console.log(`[Skinning] Loading additional model: ${modelName} from ${url}`);

  const loader = new GLTFLoader();

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        const object = gltf.scene;
        const hasAnimations = gltf.animations && gltf.animations.length > 0;
        
      console.log(`[Skinning] GLTF loaded: ${modelName}, hasAnimations=${hasAnimations}, meshes=${object.children.length}`);
      
      // Process meshes and create point clouds (similar to main model)
      const createdPointClouds = processModelMeshes(object, skinningScene.renderer, skinningScene.scene, modelName);
      console.log(`[Skinning] Created ${createdPointClouds.length} point clouds for ${modelName}`);

      // Setup model transform
      object.scale.set(100, 100, 100);
      object.rotation.x = -Math.PI / 2;

      // Hide the original GLB meshes
      object.traverse((child) => {
        if (child.isMesh) {
          child.visible = false;
        }
      });

      // Set visibility on point clouds
      createdPointClouds.forEach(cloud => {
        cloud.visible = visible;
      });

      // Set up animation mixer if the model has animations
      let mixer = null;
      let currentAction = null;
      if (hasAnimations) {
        mixer = new THREE.AnimationMixer(object);
        // Play first animation by default
        const clip = gltf.animations[0];
        currentAction = mixer.clipAction(clip);
        if (visible) {
          currentAction.play();
        }
      }

      // Add to scene but keep invisible
      object.visible = false;
      skinningScene.scene.add(object);

      const modelData = {
        model: object,
        gltf: gltf,
        visible: visible,
        hasAnimations: hasAnimations,
        mixer: mixer,
        currentAction: currentAction,
        name: modelName,
        pointClouds: createdPointClouds
      };

        loadedAdditionalModels.set(modelName, modelData);
        console.log(`[Skinning] Successfully loaded: ${modelName} (animations: ${hasAnimations}, pointClouds: ${createdPointClouds.length})`);

        // Notify UI about animations if this is an animated model
        if (hasAnimations && gltf.animations.length > 0) {
          console.log(`[Skinning] Notifying UI about ${gltf.animations.length} animations for ${modelName}`);
          const animData = buildAnimationMapFromGLB(gltf.animations, modelPath);
          if (onAnimationsLoadedCallback) {
            onAnimationsLoadedCallback(animData.names, animData.defaultAnimation);
          }
        }

        // Clean up temporary blob URL if we created one
        if (isTemporaryBlob) {
          URL.revokeObjectURL(url);
          console.log(`[Skinning] Revoked temporary blob URL for: ${modelName}`);
        }

        resolve(modelData);
      },
      undefined,
      (error) => {
        console.error(`Error loading ${modelPath}:`, error);
        reject(error);
      }
    );
  });
}

/**
 * Toggle visibility of an additional model
 * @param {string} modelName - Name of the model (without .glb extension)
 * @param {boolean} visible - Whether the model should be visible
 */
export function toggleModelVisibility(modelName, visible) {
  const modelData = loadedAdditionalModels.get(modelName);
  if (!modelData) {
    console.warn(`Model ${modelName} not found in loaded models`);
    return false;
  }
  
  // Update visibility state
  modelData.visible = visible;
  
  // Show/hide the model's point clouds
  if (skinningScene.scene) {
    skinningScene.scene.traverse((child) => {
      if (child.isSprite && child.userData && child.userData.parentModel === modelName) {
        child.visible = visible;
      }
    });
  }
  
  // Also hide the original GLB meshes
  modelData.model.traverse((child) => {
    if (child.isMesh) {
      child.visible = false; // Keep meshes hidden, only show via point clouds
    }
  });
  
  // Handle animation
  if (modelData.hasAnimations && modelData.currentAction) {
    if (visible) {
      modelData.currentAction.play();
    } else {
      modelData.currentAction.stop();
    }
  }
  
  console.log(`Toggled ${modelName}: ${visible ? 'visible' : 'hidden'}`);
  return true;
}

/**
 * Remove an additional model from the scene
 * Also removes from DISCOVERED_GLBS and AVAILABLE_MODELS if it's an imported model
 * @param {string} modelName - Name of the model to remove
 */
export function removeAdditionalModel(modelName) {
  console.log(`[Skinning] Removing model: ${modelName}`);
  const modelData = loadedAdditionalModels.get(modelName);
  let removedFromScene = false;
  
  if (modelData) {
    // Remove from scene
    if (skinningScene.scene) {
      skinningScene.scene.remove(modelData.model);
    }
    console.log(`[Skinning] Removed model object from scene`);

    // Remove point clouds
    if (modelData.pointClouds) {
      console.log(`[Skinning] Removing ${modelData.pointClouds.length} point clouds`);
      modelData.pointClouds.forEach(cloud => {
        if (skinningScene.scene) {
          skinningScene.scene.remove(cloud);
        }
      });
    }

    // Clean up from modelPointClouds tracking
    modelPointClouds.delete(modelName);
    loadedAdditionalModels.delete(modelName);
    removedFromScene = true;
  }
  
  // Check if this is an imported model in DISCOVERED_GLBS and remove it
  // This handles the case where imported models were never added to loadedAdditionalModels
  let removedFromDiscovered = false;
  
  const animatedIndex = DISCOVERED_GLBS.animated.findIndex(m => m.name === modelName && m.isImported);
  if (animatedIndex !== -1) {
    console.log(`[Skinning] Removing imported animated model from DISCOVERED_GLBS: ${modelName}`);
    DISCOVERED_GLBS.animated.splice(animatedIndex, 1);
    removedFromDiscovered = true;
  }
  
  const staticIndex = DISCOVERED_GLBS.static.findIndex(m => m.name === modelName && m.isImported);
  if (staticIndex !== -1) {
    console.log(`[Skinning] Removing imported static model from DISCOVERED_GLBS: ${modelName}`);
    DISCOVERED_GLBS.static.splice(staticIndex, 1);
    removedFromDiscovered = true;
  }
  
  // Also remove from AVAILABLE_MODELS if it's an imported model
  const availableIndex = AVAILABLE_MODELS.findIndex(m => m.name === modelName && m.isImported);
  if (availableIndex !== -1) {
    console.log(`[Skinning] Removing imported model from AVAILABLE_MODELS: ${modelName}`);
    AVAILABLE_MODELS.splice(availableIndex, 1);
    removedFromDiscovered = true;
  }
  
  if (removedFromScene || removedFromDiscovered) {
    console.log(`[Skinning] Successfully removed model: ${modelName}`);
    return true;
  }
  
  console.warn(`[Skinning] Model ${modelName} not found for removal`);
  return false;
}

/**
 * Get list of loaded additional models
 * @returns {Array<{name: string, visible: boolean, hasAnimations: boolean}>}
 */
export function getLoadedModels() {
  const models = [];
  loadedAdditionalModels.forEach((data, name) => {
    models.push({
      name: name,
      visible: data.visible,
      hasAnimations: data.hasAnimations
    });
  });
  return models;
}

/**
 * Update skinning scene each frame.
 * @param {number} delta - Time since last frame in seconds
 * @param {Object} settings - Current settings values (unused in this scene)
 * @param {THREE.WebGPURenderer} renderer - The WebGPU renderer (unused in update)
 */
export function updateSkinningScene(delta, settings, renderer) {
  if (skinningScene.mixer) {
    skinningScene.mixer.update(delta);
  }
  
  // Update animations for additional models
  loadedAdditionalModels.forEach((modelData) => {
    if (modelData.mixer && modelData.visible) {
      modelData.mixer.update(delta);
    }
  });
  
  // Green screen toggle
  const greenColor = new THREE.Color(0x007900);
  const darkColor = new THREE.Color(0x111111);
  skinningScene.backgroundColor.copy(settings.greenScreen.value ? greenColor : darkColor);
}

/**
 * Cleanup skinning scene and dispose all resources
 */
export function cleanupSkinningScene() {
  if (!skinningScene.scene) return;

  console.log('[Skinning] Cleaning up scene...');

  // Stop and dispose main mixer
  if (skinningScene.mixer) {
    skinningScene.mixer.stopAllAction();
    skinningScene.mixer = null;
  }

  // Remove and dispose all loaded additional models
  loadedAdditionalModels.forEach((modelData, name) => {
    console.log(`[Skinning] Disposing model: ${name}`);
    
    // Stop mixer for this model
    if (modelData.mixer) {
      modelData.mixer.stopAllAction();
    }

    // Remove from scene
    if (skinningScene.scene && modelData.model) {
      skinningScene.scene.remove(modelData.model);
      
      // Dispose all meshes
      modelData.model.traverse((child) => {
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

    // Dispose point clouds
    if (modelData.pointClouds) {
      modelData.pointClouds.forEach(cloud => {
        if (skinningScene.scene) {
          skinningScene.scene.remove(cloud);
        }
        cloud.geometry?.dispose();
        cloud.material?.dispose();
      });
    }
  });

  // Clear all maps
  loadedAdditionalModels.clear();
  modelPointClouds.clear();

  // Dispose main model
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

  // Dispose main point clouds
  if (skinningScene.pointClouds) {
    skinningScene.pointClouds.forEach(cloud => {
      if (skinningScene.scene) {
        skinningScene.scene.remove(cloud);
      }
      cloud.geometry?.dispose();
      cloud.material?.dispose();
    });
    skinningScene.pointClouds = [];
  }

  // Clear scene reference
  skinningScene.scene = null;
  skinningScene.animations = null;
  skinningScene.currentAction = null;
  skinningScene.currentAnimationName = '';
  skinningScene.loaded = false;

  // Don't clear the DISCOVERED_GLBS or AVAILABLE_MODELS - those should persist across scene switches

  console.log('[Skinning] Cleanup complete');
}
  
