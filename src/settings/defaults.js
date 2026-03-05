/**
 * @module settings/defaults
 * @description Default visualization settings and their constraints.
 * All settings are reactive and control visual parameters.
 */

/**
 * @typedef {Object} NumberSetting
 * @property {number} value - Current value
 * @property {number} [min] - Minimum allowed value
 * @property {number} [max] - Maximum allowed value
 * @property {string} label - Display label for UI
 */

/**
 * @typedef {Object} BooleanSetting
 * @property {boolean} value - Current value
 * @property {string} label - Display label for UI
 */

/**
 * @typedef {Object} StringSetting
 * @property {string} value - Current value
 * @property {string} label - Display label for UI
 * @property {string[]} [options] - Optional array of options for dropdown
 */

/**
 * All visualization settings.
 * @constant
 * @type {Object.<string, NumberSetting|BooleanSetting|StringSetting>}
 */
export const defaultSettings = {
    // === Audio Sensitivity ===
    /** Bass frequency sensitivity multiplier */
    bassSensitivity: { value: 1.5, min: 0.1, max: 5, label: "Bass Sensitivity" },
    /** Mid frequency sensitivity multiplier */
    midSensitivity: { value: 1.5, min: 0.1, max: 5, label: "Mid Sensitivity" },
    /** High frequency sensitivity multiplier */
    highSensitivity: { value: 1.5, min: 0.1, max: 5, label: "High Sensitivity" },
    
    // === Bass Controls ===
    /** Bass-driven particle spawn rate */
    bassSpawnRate: { value: 50, min: 0, max: 200, label: "Bass -> Spawn Rate" },
    /** Bass-driven orbit radius */
    bassRadius: { value: 3, min: 0, max: 10, label: "Bass -> Orbit Radius" },
    /** Bass-driven bloom intensity */
    bassBloom: { value: 2, min: 0, max: 5, label: "Bass -> Bloom" },
    
    // === Mid Controls ===
    /** Mid-driven turbulence intensity */
    midTurbulence: { value: 2, min: 0, max: 5, label: "Mid -> Turbulence" },
    /** Mid-driven turbulence frequency */
    midFrequency: { value: 0.5, min: 0, max: 2, label: "Mid -> Frequency" },
    /** Mid-driven orbit speed */
    midSpeed: { value: 0.5, min: 0, max: 2, label: "Mid -> Orbit Speed" },
    
    // === High Controls ===
    /** High-driven particle size multiplier */
    highSize: { value: 2, min: 0, max: 5, label: "High -> Particle Size" },
    /** High-driven color rotation speed */
    highColorSpeed: { value: 3, min: 0, max: 10, label: "High -> Color Speed" },
    
    // === Overall Controls ===
    /** Global particle lifetime multiplier */
    overallLifetime: { value: 0.5, min: 0, max: 1, label: "Overall -> Lifetime" },
    
    // === Base Values ===
    /** Base particle spawn rate */
    baseSpawnRate: { value: 5, min: 1, max: 50, label: "Base Spawn Rate" },
    /** Base turbulence intensity */
    baseTurbulence: { value: 0.5, min: 0, max: 2, label: "Base Turbulence" },
    /** Base particle size */
    baseSize: { value: 1, min: 0.1, max: 3, label: "Base Size" },
    /** Base orbit radius */
    baseRadius: { value: 2, min: 0.5, max: 5, label: "Base Orbit Radius" },
    
    // === Bloom Post-Processing ===
    /** Base bloom strength */
    bloomStrength: { value: 0.75, min: 0, max: 3, label: "Base Bloom" },
    /** Bloom threshold for activation */
    bloomThreshold: { value: 0.1, min: 0, max: 2, label: "Bloom Threshold" },
	/** Bloom radius/blur amount */
	bloomRadius: { value: 0.5, min: 0, max: 1, label: "Bloom Radius" },

	// === Audio-reactive Bloom ===
	/** Bloom intensity base value */
	bloomIntensity: { value: 0.75, min: 0, max: 6, label: "Intensity" },
	/** Bloom bass sensitivity */
	bloomBass: { value: 0.5, min: 0, max: 2, label: "Bass Sens" },
	/** Bloom mid sensitivity */
	bloomMid: { value: 0.3, min: 0, max: 2, label: "Mid Sens" },
	/** Bloom high sensitivity */
	bloomHigh: { value: 0.2, min: 0, max: 2, label: "High Sens" },
    
// === Camera Controls ===
  /** Enable automatic camera rotation */
  autoRotate: { value: true, label: "Auto Rotate" },
  /** Camera rotation speed (negative for reverse) */
  autoRotateSpeed: { value: 2, min: -10, max: 10, label: "Rotate Speed" },

// === Skinning Scene Animation ===
/** Current animation for skinning scene (options populated at runtime) */
currentAnimation: { value: "DanceLoop", label: "Animation", options: [] },

// === Skinning Point Size ===
/** Base point size for skinning scene */
pointSize: { value: 5, min: 1, max: 20, label: "Point Size" },
/** Audio reactivity for point size */
pointSizeAudio: { value: 5, min: 0, max: 20, label: "Audio Size" },

// === Output ===
    /** Enable green screen background for OBS chroma key */
    greenScreen: { value: false, label: "Green Screen" },
    
// === Combi Scene ===
/** Show transform gizmo in combi scene */
combiShowGizmo: { value: false, label: "Show Gizmo" },
/** Turn off camera auto-rotate in combi scene */
combiAutoRotateOff: { value: false, label: "Stop Auto-Rotate" },
/** Gizmo transform mode: translate, rotate, or scale */
combiGizmoMode: { value: "translate", options: ["translate", "rotate", "scale"], label: "Gizmo Mode" },
/** Instance count for combi scene */
combiInstanceCount: { value: 1, min: 1, max: 3, label: "Instances" },
/** Stored transforms for each instance (serialized as arrays) */
combiInstanceTransforms: { value: [], label: "Instance Transforms" }
};

const STORAGE_KEY = 'music_visualizer_settings';

/**
* Save settings to localStorage
* @param {Object} settings - Settings object to save
*/
export function saveSettings(settings) {
try {
const values = {};
for (const [key, config] of Object.entries(settings)) {
values[key] = config.value;
}
localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
} catch (e) {
console.warn('[Settings] Failed to save:', e);
}
}

/**
* Load settings from localStorage
* @param {Object} settings - Settings object to restore into
*/
export function loadSettings(settings) {
try {
const saved = localStorage.getItem(STORAGE_KEY);
if (!saved) return;

const values = JSON.parse(saved);
for (const [key, value] of Object.entries(values)) {
if (settings[key] && settings[key].value !== undefined) {
settings[key].value = value;
}
}
console.log('[Settings] Restored from localStorage');
} catch (e) {
console.warn('[Settings] Failed to load:', e);
}
}

/**
* Create a reactive settings object from defaults.
* @returns {Object} Settings object with reactive values
*/
export function createSettings() {
const settings = {};
for (const [key, config] of Object.entries(defaultSettings)) {
settings[key] = { ...config };
}
loadSettings(settings);
return settings;
}

/**
* Reset settings to default values (does not clear localStorage)
* @param {Object} settings - Settings object to reset
*/
export function resetToDefaults(settings) {
for (const [key, config] of Object.entries(defaultSettings)) {
if (settings[key]) {
settings[key].value = config.value;
}
}
console.log('[Settings] Reset to defaults');
}

/**
* Clear all saved settings from localStorage
*/
export function clearSavedSettings() {
try {
localStorage.removeItem(STORAGE_KEY);
localStorage.removeItem('music_visualizer_scene');
console.log('[Settings] Cleared saved settings from localStorage');
} catch (e) {
console.warn('[Settings] Failed to clear:', e);
}
}

/**
* Save and confirm
* @param {Object} settings - Settings to save
*/
export function saveAndConfirm(settings) {
saveSettings(settings);
console.log('[Settings] Saved current state');
}

/**
* Reset everything to defaults and clear storage
* @param {Object} settings - Settings object to reset
*/
export function fullReset(settings) {
clearSavedSettings();
resetToDefaults(settings);
console.log('[Settings] Full reset complete');
}
