/**
 * @module core/animations
 * @description Dynamic animation detection for GLB files.
 * Automatically extracts and maps animation names from loaded models.
 */

/**
 * Dynamic animation map - populated at runtime from loaded GLB.
 * Maps clean animation names to full GLB animation names.
 * @type {Object.<string, string>}
 */
export let DYNAMIC_ANIMATION_MAP = {};

/**
 * Dynamic animation names - populated at runtime.
 * Array of clean animation names for UI dropdowns.
 * @type {string[]}
 */
export let DYNAMIC_ANIMATION_NAMES = [];

/**
 * Default animation name for current model.
 * Set when a model is loaded with animations.
 * @type {string}
 */
export let DEFAULT_ANIMATION = '';

/**
 * Currently loaded model path.
 * @type {string|null}
 */
export let CURRENT_MODEL_PATH = null;

/**
 * Build animation map from GLB animation clips.
 * Automatically detects animation naming patterns and creates clean names.
 * @param {Array<THREE.AnimationClip>} animations - Animation clips from GLB
 * @param {string} modelPath - Path to the loaded model
 * @returns {Object} Object containing map, names array, and default animation
 */
export function buildAnimationMapFromGLB(animations, modelPath) {
  const map = {};

  animations.forEach(clip => {
    const cleanName = extractAnimationName(clip.name);
    map[cleanName] = clip.name;
  });

  const names = Object.keys(map).sort();
  const defaultAnimation = names[0] || '';

  CURRENT_MODEL_PATH = modelPath;

  // Update dynamic exports
  DYNAMIC_ANIMATION_MAP = map;
  DYNAMIC_ANIMATION_NAMES = names;
  DEFAULT_ANIMATION = defaultAnimation;

  console.log('[Animations] Detected for', modelPath, ':', names);

  return { map, names, defaultAnimation };
}

/**
 * Extract clean animation name from various GLB naming formats.
 * Supports:
 * - VRM format: VRM|Name@frame → Name
 * - Standard: Name|Action → Name Action
 * - Simple: Walk → Walk
 * - With numbers: Walk_01 → Walk
 * @param {string} fullName - Raw animation name from GLB
 * @returns {string} Clean, readable animation name
 */
function extractAnimationName(fullName) {
  let name = fullName;

  // Remove VRM| prefix if present
  if (name.includes('|')) {
    name = name.split('|')[1] || name;
  }

  // Remove @frame suffix if present
  if (name.includes('@')) {
    name = name.split('@')[0];
  }

  // Remove trailing numbers and underscores (e.g., Walk_01 → Walk)
  name = name.replace(/[_\-]\d+$/g, '');

  // Convert camelCase or PascalCase to readable format
  // e.g., "WalkLoop" → "Walk Loop"
  name = name.replace(/([a-z])([A-Z])/g, '$1 $2');

  // Clean up any extra spaces
  name = name.trim();

  return name || fullName;
}

/**
 * Get the full GLB animation name from a clean name.
 * @param {string} cleanName - Clean animation name (e.g., 'Dance Loop')
 * @returns {string|null} Full animation name (e.g., 'VRM|DanceLoop@24') or null if not found
 */
export function getFullAnimationName(cleanName) {
  return DYNAMIC_ANIMATION_MAP[cleanName] || null;
}

/**
 * Get the clean animation name from a full GLB animation name.
 * @param {string} fullName - Full animation name (e.g., 'VRM|DanceLoop@24')
 * @returns {string|null} Clean animation name (e.g., 'Dance Loop') or null if not found
 */
export function getCleanAnimationName(fullName) {
  const entry = Object.entries(DYNAMIC_ANIMATION_MAP).find(([_, full]) => full === fullName);
  return entry ? entry[0] : null;
}

/**
 * Clear dynamic animation data.
 * Call this when loading a new model or during cleanup.
 */
export function clearDynamicAnimations() {
  DYNAMIC_ANIMATION_MAP = {};
  DYNAMIC_ANIMATION_NAMES = [];
  DEFAULT_ANIMATION = '';
  CURRENT_MODEL_PATH = null;
}

/**
 * Get array of clean animation names for dropdown options.
 * @returns {string[]} Array of animation names
 */
export function getAnimationNames() {
  return DYNAMIC_ANIMATION_NAMES;
}

/**
 * Get the default animation name for current model.
 * @returns {string} Default animation name or empty string if no model loaded
 */
export function getDefaultAnimation() {
  return DEFAULT_ANIMATION;
}
