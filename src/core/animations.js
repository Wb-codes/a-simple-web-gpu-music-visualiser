/**
 * @module core/animations
 * @description Animation name mappings and dynamic animation detection for GLB files.
 * Supports both predefined animations and runtime detection from loaded models.
 */

/**
 * Animation data from ANIMATION_LIST.md (legacy support)
 * Format: { cleanName: fullName }
 * fullName format: VRM|Name@frameCount
 * @deprecated Use dynamic animation detection instead
 */
export const ANIMATION_MAP = {
  'Action': 'VRM|Action@48',
  'Angry': 'VRM|Angry@20',
  'Consume Item': 'VRM|Consume Item@100',
  'Crawl': 'VRM|Crawl@41',
  'CrouchFwdLoop': 'VRM|CrouchFwdLoop@48',
  'CrouchIdleLoop': 'VRM|CrouchIdleLoop@70',
  'DanceBodyRoll': 'VRM|DanceBodyRoll@156',
  'DanceCharleston': 'VRM|DanceCharleston@56',
  'DanceLoop': 'VRM|DanceLoop@24',
  'DanceReachHip': 'VRM|DanceReachHip@61',
  'Death': 'VRM|Death@57',
  'DrivingLoop': 'VRM|DrivingLoop@57',
  'FixingKneeling': 'VRM|FixingKneeling@124',
  'HeadNod': 'VRM|HeadNod@21',
  'HitChest': 'VRM|HitChest@8',
  'HitHead': 'VRM|HitHead@10',
  'IdleListening': 'VRM|IdleListening@41',
  'IdleLoop': 'VRM|IdleLoop@60',
  'IdleTalkingLoop': 'VRM|IdleTalkingLoop@70',
  'JogFwdLoop': 'VRM|JogFwdLoop@22',
  'JumpLand': 'VRM|JumpLand@30',
  'JumpLoop': 'VRM|JumpLoop@60',
  'JumpStart': 'VRM|JumpStart@32',
  'Meditate': 'VRM|Meditate@36',
  'PickUpTable': 'VRM|PickUpTable@20',
  'PistolAimDown': 'VRM|PistolAimDown@4',
  'PistolAimNeutral': 'VRM|PistolAimNeutral@4',
  'PistolAimUp': 'VRM|PistolAimUp@4',
  'PistolIdleLoop': 'VRM|PistolIdleLoop@40',
  'PistolReload': 'VRM|PistolReload@40',
  'PistolShoot': 'VRM|PistolShoot@15',
  'PunchCross': 'VRM|PunchCross@24',
  'PunchEnter': 'VRM|PunchEnter@20',
  'PunchJab': 'VRM|PunchJab@20',
  'Reject': 'VRM|Reject@91',
  'Roll': 'VRM|Roll@35',
  'RunAnime': 'VRM|RunAnime@13',
  'Shivering': 'VRM|Shivering@6',
  'SittingEnter': 'VRM|SittingEnter@31',
  'SittingExit': 'VRM|SittingExit@24',
  'SittingIdleLoop': 'VRM|SittingIdleLoop@40',
  'SittingTalkingLoop': 'VRM|SittingTalkingLoop@70',
  'SpellSimpleEnter': 'VRM|SpellSimpleEnter@12',
  'SpellSimpleExit': 'VRM|SpellSimpleExit@10',
  'SpellSimpleIdleLoop': 'VRM|SpellSimpleIdleLoop@50',
  'SpellSimpleShoot': 'VRM|SpellSimpleShoot@12',
  'SprintLoop': 'VRM|SprintLoop@16',
  'SwimFwdLoop': 'VRM|SwimFwdLoop@80',
  'SwimIdleLoop': 'VRM|SwimIdleLoop@80',
  'SwordAttack': 'VRM|SwordAttack@36',
  'SwordIdle': 'VRM|SwordIdle@40',
  'Tired': 'VRM|Tired@32',
  'TiredHunched': 'VRM|TiredHunched@25',
  'TwohandBlast': 'VRM|TwohandBlast@11',
  'Victory': 'VRM|Victory@40',
  'WalkFormalLoop': 'VRM|WalkFormalLoop@32',
  'WalkLoop': 'VRM|WalkLoop@32'
};

/**
 * Dynamic animation map - populated at runtime from loaded GLB
 * @type {Object.<string, string>}
 */
export let DYNAMIC_ANIMATION_MAP = {};

/**
 * Dynamic animation names - populated at runtime
 * @type {string[]}
 */
export let DYNAMIC_ANIMATION_NAMES = [];

/**
 * Default animation name
 * @type {string}
 */
export let DEFAULT_ANIMATION = 'DanceLoop';

/**
 * Static animation names (for backward compatibility)
 * @type {string[]}
 */
export const ANIMATION_NAMES = Object.keys(ANIMATION_MAP);

/**
 * Currently loaded model path
 * @type {string|null}
 */
export let CURRENT_MODEL_PATH = null;

/**
 * Build animation map from GLB animation clips
 * Automatically detects animation naming patterns and creates clean names
 * @param {Array<THREE.AnimationClip>} animations - Animation clips from GLB
 * @param {string} modelPath - Path to the loaded model
 * @returns {Object} Object containing map, names array, and default animation
 */
export function buildAnimationMapFromGLB(animations, modelPath) {
  const map = {};
  
  animations.forEach(clip => {
    // Extract clean name from various formats
    const cleanName = extractAnimationName(clip.name);
    map[cleanName] = clip.name;
  });
  
  DYNAMIC_ANIMATION_MAP = map;
  DYNAMIC_ANIMATION_NAMES = Object.keys(map).sort();
  DEFAULT_ANIMATION = DYNAMIC_ANIMATION_NAMES[0] || '';
  CURRENT_MODEL_PATH = modelPath;
  
  console.log('Dynamic animations detected:', DYNAMIC_ANIMATION_NAMES);
  
  return {
    map,
    names: DYNAMIC_ANIMATION_NAMES,
    defaultAnimation: DEFAULT_ANIMATION
  };
}

/**
 * Extract clean animation name from various GLB naming formats
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
 * Get the full GLB animation name from a clean name
 * First checks dynamic map (runtime), falls back to static map (legacy)
 * @param {string} cleanName - Clean animation name (e.g., 'DanceLoop')
 * @returns {string|null} Full animation name (e.g., 'VRM|DanceLoop@24') or null if not found
 */
export function getFullAnimationName(cleanName) {
  // First check dynamic map (runtime loaded animations)
  if (DYNAMIC_ANIMATION_MAP[cleanName]) {
    return DYNAMIC_ANIMATION_MAP[cleanName];
  }
  
  // Fall back to static map (legacy support)
  return ANIMATION_MAP[cleanName] || null;
}

/**
 * Get the clean animation name from a full GLB animation name
 * @param {string} fullName - Full animation name (e.g., 'VRM|DanceLoop@24')
 * @returns {string|null} Clean animation name (e.g., 'DanceLoop') or null if not found
 */
export function getCleanAnimationName(fullName) {
  // First check dynamic map
  const dynamicEntry = Object.entries(DYNAMIC_ANIMATION_MAP).find(([_, full]) => full === fullName);
  if (dynamicEntry) return dynamicEntry[0];
  
  // Fall back to static map
  const staticEntry = Object.entries(ANIMATION_MAP).find(([_, full]) => full === fullName);
  return staticEntry ? staticEntry[0] : null;
}

/**
 * Clear dynamic animation data
 * Call this when loading a new model
 */
export function clearDynamicAnimations() {
  DYNAMIC_ANIMATION_MAP = {};
  DYNAMIC_ANIMATION_NAMES = [];
  DEFAULT_ANIMATION = '';
  CURRENT_MODEL_PATH = null;
}

/**
 * Array of clean animation names for dropdown options
 * Returns dynamic names if available, otherwise static names
 * @type {string[]}
 */
export function getAnimationNames() {
  return DYNAMIC_ANIMATION_NAMES.length > 0 ? DYNAMIC_ANIMATION_NAMES : Object.keys(ANIMATION_MAP);
}

/**
 * Get the default animation name
 * Returns dynamic default if available, otherwise static default
 * @type {string}
 */
export function getDefaultAnimation() {
  return DEFAULT_ANIMATION || 'DanceLoop';
}
