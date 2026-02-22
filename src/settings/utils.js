/**
 * @module settings/utils
 * @description Settings utilities for serialization and deserialization.
 */

/**
 * Serialize settings object to plain object with just values.
 * Extracts the `.value` property from each setting.
 * 
 * @param {Object} settings - Settings object with { value, min, max, label } properties
 * @returns {Object} Plain object with just setting values
 * @example
 * const settings = {
 *   bassSensitivity: { value: 1.5, min: 0.1, max: 5, label: "Bass Sensitivity" },
 *   autoRotate: { value: true, label: "Auto Rotate" }
 * };
 * const values = serializeSettings(settings);
 * // Returns: { bassSensitivity: 1.5, autoRotate: true }
 */
export function serializeSettings(settings) {
    const values = {};
    for (const [key, config] of Object.entries(settings)) {
        if (config && typeof config === 'object' && 'value' in config) {
            values[key] = config.value;
        }
    }
    return values;
}

/**
 * Deserialize values back into settings object.
 * Updates the `.value` property of each setting.
 * 
 * @param {Object} settings - Settings object to update
 * @param {Object} values - Plain object with values
 * @example
 * const values = { bassSensitivity: 2.0, autoRotate: false };
 * deserializeSettings(settings, values);
 * // settings.bassSensitivity.value is now 2.0
 */
export function deserializeSettings(settings, values) {
    for (const [key, value] of Object.entries(values)) {
        if (settings[key] && typeof settings[key] === 'object') {
            settings[key].value = value;
        }
    }
}

/**
 * Create a subset of settings for specific categories.
 * Useful for syncing only relevant settings to external systems.
 * 
 * @param {Object} settings - Full settings object
 * @param {Array<string>} keys - Keys to include
 * @returns {Object} Filtered settings object
 * @example
 * const audioSettings = filterSettings(settings, [
 *   'bassSensitivity', 'midSensitivity', 'highSensitivity'
 * ]);
 */
export function filterSettings(settings, keys) {
    const filtered = {};
    for (const key of keys) {
        if (key in settings) {
            filtered[key] = settings[key];
        }
    }
    return filtered;
}

/**
 * Get category keys for different setting groups.
 * @constant {Object.<string, Array<string>>}
 */
export const SETTING_CATEGORIES = {
    audio: [
        'bassSensitivity',
        'midSensitivity',
        'highSensitivity'
    ],
    bass: [
        'bassSpawnRate',
        'bassRadius',
        'bassBloom'
    ],
    mid: [
        'midTurbulence',
        'midFrequency',
        'midSpeed'
    ],
    high: [
        'highSize',
        'highColorSpeed'
    ],
    base: [
        'baseSpawnRate',
        'baseTurbulence',
        'baseSize',
        'baseRadius'
    ],
    bloom: [
        'bloomStrength',
        'bloomThreshold',
        'bloomRadius'
    ],
    camera: [
        'autoRotate',
        'autoRotateSpeed'
    ],
    points: [
        'pulseSpeed',
        'minWidth',
        'maxWidth'
    ],
    spout: [
        'spoutEnabled',
        'spoutSenderName'
    ]
};

/**
 * Serialize settings by category.
 * Useful for partial syncing (e.g., only audio settings).
 * 
 * @param {Object} settings - Full settings object
 * @param {string} category - Category name from SETTING_CATEGORIES
 * @returns {Object} Serialized settings for that category
 * @example
 * const audioValues = serializeSettingsByCategory(settings, 'audio');
 * // Returns: { bassSensitivity: 1.5, midSensitivity: 1.5, highSensitivity: 1.5 }
 */
export function serializeSettingsByCategory(settings, category) {
    const keys = SETTING_CATEGORIES[category];
    if (!keys) {
        console.warn(`Unknown setting category: ${category}`);
        return {};
    }
    const filtered = filterSettings(settings, keys);
    return serializeSettings(filtered);
}

/**
 * Check if a setting exists and has a value property.
 * 
 * @param {Object} settings - Settings object
 * @param {string} key - Setting key to check
 * @returns {boolean}
 */
export function hasSetting(settings, key) {
    return key in settings && 
           settings[key] !== null && 
           typeof settings[key] === 'object' &&
           'value' in settings[key];
}

/**
 * Get setting value with fallback.
 * 
 * @param {Object} settings - Settings object
 * @param {string} key - Setting key
 * @param {*} [defaultValue] - Default value if setting doesn't exist
 * @returns {*} Setting value or default
 * @example
 * const value = getSettingValue(settings, 'bassSensitivity', 1.0);
 */
export function getSettingValue(settings, key, defaultValue) {
    if (hasSetting(settings, key)) {
        return settings[key].value;
    }
    return defaultValue;
}

/**
 * Set setting value safely.
 * Only sets if the setting exists.
 * 
 * @param {Object} settings - Settings object
 * @param {string} key - Setting key
 * @param {*} value - Value to set
 * @returns {boolean} True if setting was found and updated
 * @example
 * const success = setSettingValue(settings, 'bassSensitivity', 2.0);
 */
export function setSettingValue(settings, key, value) {
    if (hasSetting(settings, key)) {
        settings[key].value = value;
        return true;
    }
    return false;
}
