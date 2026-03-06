/**
 * @module gui
 * @description Settings GUI creation and management.
 * Creates a collapsible folder-based interface for adjusting visualization parameters.
 */

import { SCENE_NAMES } from '../core/constants.js';
import {
  DISCOVERED_GLBS,
  setOnModelsDiscovered,
  setOnAnimationsLoaded,
  toggleModel,
  isModelLoaded,
  getModelAnimations,
  playModelAnimation
} from '../scenes/skinning.js';
import {
  loadCombiModel,
  removeCombiModel,
  getCombiModelPaths
} from '../scenes/combi.js';
import { updatePostProcessingScene } from '../core/renderer.js';
import { applyFadeBehavior, removeAllFadeBehaviors, applyFadeToSettingsButton } from './fade-manager.js';
import { saveSettings, clearSavedSettings, resetToDefaults } from '../settings/defaults.js';

export { removeAllFadeBehaviors };

/**
 * Create a folder in the GUI.
 * @param {string} name - Folder display name
 * @param {HTMLElement} [container] - Optional container to append folder to
 * @returns {{folder: HTMLElement, content: HTMLElement}}
 */
export function createFolder(name, container) {
    const folder = document.createElement('div');
    folder.className = 'folder open';
    
    const h3 = document.createElement('h3');
    h3.textContent = name + ' ▼';
    h3.style.cursor = 'pointer';
    h3.onclick = () => {
        folder.classList.toggle('open');
        h3.textContent = name + (folder.classList.contains('open') ? ' ▼' : ' ▶');
    };
    
    const content = document.createElement('div');
    content.className = 'folder-content';
    
    folder.appendChild(h3);
    folder.appendChild(content);
    
    if (container) {
        container.appendChild(folder);
    }
    
    return { folder, content };
}

/**
 * Add a slider control to a container.
 * @param {HTMLElement} container - Container element
 * @param {Object} setting - Setting object with value, min, max, label
 * @param {Function} [onChange] - Callback when value changes
 * @returns {HTMLElement} The created row element
 */
export function addSlider(container, setting, onChange) {
    const row = document.createElement('div');
    row.className = 'control-row';
    
    const label = document.createElement('label');
    label.textContent = setting.label;
    
    if (typeof setting.value === 'boolean') {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = setting.value;
        checkbox.onchange = () => {
            setting.value = checkbox.checked;
            if (onChange) onChange(setting);
        };
        row.appendChild(label);
        row.appendChild(checkbox);
    } else {
        const input = document.createElement('input');
        input.type = 'range';
        input.min = setting.min;
        input.max = setting.max;
        input.step = (setting.max - setting.min) / 100;
        input.value = setting.value;
        
        const valueDisplay = document.createElement('span');
        valueDisplay.className = 'value';
        valueDisplay.textContent = setting.value.toFixed(2);
        
        input.oninput = () => {
            setting.value = parseFloat(input.value);
            valueDisplay.textContent = setting.value.toFixed(2);
            if (onChange) onChange(setting);
        };
        
        row.appendChild(label);
        row.appendChild(input);
        row.appendChild(valueDisplay);
    }
    
    container.appendChild(row);
    return row;
}

/**
 * Add a text input control to a container.
 * @param {HTMLElement} container - Container element
 * @param {Object} setting - Setting object with value and label
 * @param {Function} [onChange] - Callback when value changes
 * @returns {HTMLElement} The created row element
 */
export function addTextInput(container, setting, onChange) {
    const row = document.createElement('div');
    row.className = 'control-row';
    
    const label = document.createElement('label');
    label.textContent = setting.label;
    
    const input = document.createElement('input');
    input.type = 'text';
    input.value = setting.value;
    input.style.flex = '1';
    input.style.marginLeft = '8px';
    input.style.background = '#222';
    input.style.border = '1px solid #444';
    input.style.color = '#fff';
    input.style.padding = '4px 8px';
    input.style.borderRadius = '3px';
    
    input.onchange = () => {
        setting.value = input.value;
        if (onChange) onChange(setting);
    };
    
    row.appendChild(label);
    row.appendChild(input);
    container.appendChild(row);
    return row;
}

/**
 * Add a checkbox control to a container.
 * @param {HTMLElement} container - Container element
 * @param {Object} setting - Setting object with value and label
 * @param {Function} [onChange] - Callback when value changes
 * @returns {HTMLElement} The created row element
 */
export function addCheckbox(container, setting, onChange) {
  return addSlider(container, setting, onChange);
}

/**
 * Refresh all GUI controls to match current settings values.
 * @param {HTMLElement} container - The GUI container element
 * @param {Object} settings - Settings object
 */
export function refreshGUIValues(container, settings) {
const rows = container.querySelectorAll('.control-row');
rows.forEach(row => {
const label = row.querySelector('label');
const input = row.querySelector('input');
const valueDisplay = row.querySelector('.value');

if (!label || !input) return;

// Find the matching setting by label
const labelText = label.textContent;
for (const [key, config] of Object.entries(settings)) {
if (config.label === labelText) {
switch (input.type) {
case 'checkbox':
input.checked = config.value;
break;
case 'range':
input.value = config.value;
if (valueDisplay) {
valueDisplay.textContent = typeof config.value === 'number'
? config.value.toFixed(2)
: config.value;
}
break;
}
break;
}
}
});
}

/**
 * Create Save State and Reset State buttons.
 * @param {HTMLElement} container - Container to append buttons to
 * @param {Object} settings - Settings object
 * @param {Function} [onReset] - Optional callback after reset
 * @returns {HTMLElement} The created buttons row
 */
export function addStateButtons(container, settings, onReset) {
  const row = document.createElement('div');
  row.className = 'control-row';
  row.style.cssText = 'display: flex; gap: 8px; padding: 8px 0;';

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save State';
  saveBtn.style.cssText = `
    background: #2b6e3f;
    border: none;
    color: #fff;
    padding: 6px 12px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
    flex: 1;
  `;
  saveBtn.onmouseenter = () => saveBtn.style.background = '#3d8a53';
  saveBtn.onmouseleave = () => saveBtn.style.background = '#2b6e3f';
  saveBtn.onclick = () => {
    saveSettings(settings);
    const msg = document.createElement('span');
    msg.textContent = ' ✓';
    msg.style.color = '#51cf66';
    saveBtn.parentElement.appendChild(msg);
    setTimeout(() => msg.remove(), 1500);
  };

  const resetBtn = document.createElement('button');
  resetBtn.textContent = 'Reset State';
  resetBtn.style.cssText = `
    background: #8b3a3a;
    border: none;
    color: #fff;
    padding: 6px 12px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
    flex: 1;
  `;
  resetBtn.onmouseenter = () => resetBtn.style.background = '#a64d4d';
  resetBtn.onmouseleave = () => resetBtn.style.background = '#8b3a3a';
  resetBtn.onclick = () => {
    clearSavedSettings();
    resetToDefaults(settings);
    refreshGUIValues(container, settings);
    if (onReset) onReset();
    const msg = document.createElement('span');
    msg.textContent = ' Reset!';
    msg.style.color = '#ffa94d';
    resetBtn.parentElement.appendChild(msg);
    setTimeout(() => msg.remove(), 1500);
  };

  row.appendChild(saveBtn);
  row.appendChild(resetBtn);
  container.appendChild(row);
  return row;
}

/**
 * Create a scene selector dropdown at the top-left of the screen.
 * @param {string} currentScene - Current scene type
 * @param {Function} onSceneChange - Callback when scene changes, receives sceneType
 * @returns {HTMLElement} The created dropdown container
 */
export function createSceneSelector(currentScene, onSceneChange) {
  // Remove existing scene selector if present
  const existing = document.getElementById('scene-selector');
  if (existing) existing.remove();

  // Create container
  const container = document.createElement('div');
  container.id = 'scene-selector';
  container.style.cssText = `
    position: fixed;
    top: 10px;
    left: 10px;
    z-index: 200;
    background: rgba(20, 23, 26, 0.9);
    padding: 8px 12px;
    border-radius: 5px;
    display: flex;
    align-items: center;
    gap: 8px;
  `;

  // Create label
  const label = document.createElement('label');
  label.textContent = 'Scene:';
  label.style.cssText = `
    color: #fff;
    font-size: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  // Create select dropdown
  const select = document.createElement('select');
  select.style.cssText = `
    background: #333;
    color: #fff;
    border: 1px solid #555;
    border-radius: 3px;
    padding: 4px 8px;
    font-size: 12px;
    cursor: pointer;
    min-width: 140px;
  `;

  // Add scene options
  Object.entries(SCENE_NAMES).forEach(([key, name]) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = name;
    if (key === currentScene) option.selected = true;
    select.appendChild(option);
  });

  // Handle change
  select.addEventListener('change', (e) => {
    const newScene = e.target.value;
    if (onSceneChange) onSceneChange(newScene);
  });

  container.appendChild(label);
  container.appendChild(select);
  document.body.appendChild(container);

  // Apply fade behavior
  applyFadeBehavior(container);

  return container;
}

/**
 * Update the scene selector dropdown value.
 * @param {string} sceneType - New scene type to select
 */
export function updateSceneSelector(sceneType) {
  const selector = document.getElementById('scene-selector');
  if (selector) {
    const select = selector.querySelector('select');
    if (select) select.value = sceneType;
  }
}

/**
 * Create the full settings GUI.
 * @param {Object} settings - Settings object with all parameters
 * @param {HTMLElement} [customContainer] - Optional custom container element
 * @param {Function} [onSettingChange] - Callback when any setting changes
 * @returns {{container: HTMLElement, toggleBtn: HTMLElement}}
 */
export function createGUI(settings, customContainer, onSettingChange) {
    const container = customContainer || document.getElementById('controls');
    const toggleBtn = document.getElementById('toggle-controls');
    
    if (toggleBtn) {
        toggleBtn.classList.add('visible');
        toggleBtn.onclick = () => {
            container.classList.toggle('visible');
            toggleBtn.textContent = container.classList.contains('visible') ? 'Hide' : 'Settings';
        };
    }
    
    // Clear existing content
    container.innerHTML = '';
    
    // Create onChange wrapper
    const handleChange = () => {
        if (onSettingChange) onSettingChange();
    };
    
    // Audio Sensitivity folder
    const audioFolder = createFolder('Audio Sensitivity');
    addSlider(audioFolder.content, settings.bassSensitivity, handleChange);
    addSlider(audioFolder.content, settings.midSensitivity, handleChange);
    addSlider(audioFolder.content, settings.highSensitivity, handleChange);
    container.appendChild(audioFolder.folder);
    
    // Bass Response folder
    const bassFolder = createFolder('Bass Response');
    addSlider(bassFolder.content, settings.bassSpawnRate, handleChange);
    addSlider(bassFolder.content, settings.bassRadius, handleChange);
    addSlider(bassFolder.content, settings.bassBloom, handleChange);
    container.appendChild(bassFolder.folder);
    
    // Mid Response folder
    const midFolder = createFolder('Mid Response');
    addSlider(midFolder.content, settings.midTurbulence, handleChange);
    addSlider(midFolder.content, settings.midFrequency, handleChange);
    addSlider(midFolder.content, settings.midSpeed, handleChange);
    container.appendChild(midFolder.folder);
    
    // High Response folder
    const highFolder = createFolder('High Response');
    addSlider(highFolder.content, settings.highSize, handleChange);
    addSlider(highFolder.content, settings.highColorSpeed, handleChange);
    container.appendChild(highFolder.folder);
    
    // Overall folder
    const overallFolder = createFolder('Overall');
    addSlider(overallFolder.content, settings.overallLifetime, handleChange);
    container.appendChild(overallFolder.folder);
    
	// Base Values folder
	const baseFolder = createFolder('Base Values');
	addSlider(baseFolder.content, settings.baseSpawnRate, handleChange);
	addSlider(baseFolder.content, settings.baseTurbulence, handleChange);
	addSlider(baseFolder.content, settings.baseSize, handleChange);
	addSlider(baseFolder.content, settings.baseRadius, handleChange);
	container.appendChild(baseFolder.folder);

	// Bloom folder
	const bloomFolder = createFolder('Bloom');
	addSlider(bloomFolder.content, settings.bloomStrength, handleChange);
	addSlider(bloomFolder.content, settings.bloomThreshold, handleChange);
	addSlider(bloomFolder.content, settings.bloomRadius, handleChange);
	container.appendChild(bloomFolder.folder);

	// Camera folder
	const cameraFolder = createFolder('Camera');
	addSlider(cameraFolder.content, settings.autoRotate, handleChange);
	addSlider(cameraFolder.content, settings.autoRotateSpeed, handleChange);
	container.appendChild(cameraFolder.folder);

	// Output folder
	const outputFolder = createFolder('Output');
	addCheckbox(outputFolder.content, settings.greenScreen, handleChange);
	container.appendChild(outputFolder.folder);

	// Show by default
	container.classList.add('visible');
	if (toggleBtn) {
		toggleBtn.textContent = 'Hide';
	}

return { container, toggleBtn };
}

/**
 * Create GUI for Linked Particles scene.
 *
 * @param {Object} settings - Settings object
 * @param {HTMLElement} container - Container element
 * @param {Function} onChange - Callback when settings change
 */
export function createParticlesGUI(settings, container, onChange) {
    const handleChange = () => {
        if (onChange) onChange();
    };
    
    // Get toggle button
    const toggleBtn = document.getElementById('toggle-controls');
    
    // Setup toggle button
    if (toggleBtn) {
        toggleBtn.classList.add('visible');
        toggleBtn.textContent = 'Hide';
        toggleBtn.onclick = () => {
            container.classList.toggle('visible');
            toggleBtn.textContent = container.classList.contains('visible') ? 'Hide' : 'Settings';
        };
    }
    
    // Clear existing content
    container.innerHTML = '';
    
    // Spawn folder
    const spawnFolder = createFolder('Spawn', container);
    addSlider(spawnFolder.content, settings.bassSpawnRate, handleChange);
    addSlider(spawnFolder.content, settings.baseSpawnRate, handleChange);
    
    // Radius folder
    const radiusFolder = createFolder('Radius', container);
    addSlider(radiusFolder.content, settings.bassRadius, handleChange);
    addSlider(radiusFolder.content, settings.baseRadius, handleChange);
    
    // Turbulence folder
    const turbFolder = createFolder('Turbulence', container);
    addSlider(turbFolder.content, settings.midTurbulence, handleChange);
    addSlider(turbFolder.content, settings.midFrequency, handleChange);
    addSlider(turbFolder.content, settings.baseTurbulence, handleChange);
    
    // Particle Size folder
    const sizeFolder = createFolder('Particle Size', container);
    addSlider(sizeFolder.content, settings.highSize, handleChange);
    addSlider(sizeFolder.content, settings.baseSize, handleChange);
    
    // Bloom folder
    const bloomFolder = createFolder('Bloom', container);
    addSlider(bloomFolder.content, settings.bloomIntensity, handleChange);
    addSlider(bloomFolder.content, settings.bloomBass, handleChange);
    addSlider(bloomFolder.content, settings.bloomMid, handleChange);
    addSlider(bloomFolder.content, settings.bloomHigh, handleChange);
    
// Output folder
  const outputFolder = createFolder('Output', container);
  addSlider(outputFolder.content, settings.autoRotate, handleChange);
  addSlider(outputFolder.content, settings.autoRotateSpeed, handleChange);
  addCheckbox(outputFolder.content, settings.greenScreen, handleChange);

  // State buttons
  addStateButtons(container, settings);

  // Show container by default
  container.classList.add('visible');

  // Apply fade behavior to settings panel
  applyFadeBehavior(container);
}

/**
 * Create GUI for Skinning Points scene.
*
* @param {Object} settings - Settings object
* @param {HTMLElement} container - Container element
* @param {Function} onChange - Callback when settings change
*/
export function createSkinningGUI(settings, container, onChange) {
const handleChange = () => {
if (onChange) onChange();
};

// Set up callback for animations
setOnAnimationsLoaded((animationNames, defaultAnimation) => {
if (animationNames && animationNames.length > 0) {
createAnimationPicker(defaultAnimation || animationNames[0], animationNames, (newAnimation) => {
switchAnimation(newAnimation);
});
}
});

// Get toggle button
const toggleBtn = document.getElementById('toggle-controls');

// Setup toggle button
if (toggleBtn) {
	toggleBtn.classList.add('visible');
	toggleBtn.textContent = 'Hide';
	toggleBtn.onclick = () => {
	container.classList.toggle('visible');
	toggleBtn.textContent = container.classList.contains('visible') ? 'Hide' : 'Settings';
	};
}

// Clear existing content
container.innerHTML = '';

// Model info
const infoFolder = createFolder('Model Info', container);
const infoText = document.createElement('div');
infoText.style.cssText = 'color: #888; font-size: 11px; padding: 5px 0;';
infoText.innerHTML = `
<p style="margin: 3px 0;">Place GLB files in:</p>
<p style="margin: 3px 0; color: #667eea;">models/gltf/skinning/</p>
<p style="margin: 8px 0 3px 0;">Models detected automatically</p>
`;
infoFolder.content.appendChild(infoText);

// Model selector with checkboxes
const modelSelectorFolder = createFolder('Models', container);

const modelsListContainer = document.createElement('div');
modelsListContainer.style.cssText = 'max-height: 200px; overflow-y: auto;';

const populateModelCheckboxes = () => {
modelsListContainer.innerHTML = '';

const createModelRow = (model, type) => {
const row = document.createElement('div');
row.style.cssText = 'display: flex; align-items: center; padding: 4px 0; gap: 8px;';

const checkbox = document.createElement('input');
checkbox.type = 'checkbox';
checkbox.id = `model-${model.name}`;
checkbox.checked = isModelLoaded(model.path);
checkbox.style.cssText = 'cursor: pointer;';

const label = document.createElement('label');
label.htmlFor = `model-${model.name}`;
label.textContent = model.name;
label.style.cssText = `cursor: pointer; color: ${type === 'animated' ? '#51cf66' : '#888'}; font-size: 12px; flex: 1;`;

checkbox.onchange = async () => {
const enabled = checkbox.checked;
checkbox.disabled = true;
label.style.opacity = '0.5';

const success = await toggleModel(model.path, enabled);

if (success) {
if (enabled) {
const scene = (await import('../scenes/skinning.js')).skinningScene?.scene;
if (scene) {
updatePostProcessingScene(scene);
}
}
} else {
checkbox.checked = !enabled;
}

checkbox.disabled = false;
label.style.opacity = '1';
};

row.appendChild(checkbox);
row.appendChild(label);
return row;
};

if (DISCOVERED_GLBS.animated.length > 0) {
const header = document.createElement('div');
header.textContent = 'Animated:';
header.style.cssText = 'color: #51cf66; font-size: 11px; font-weight: bold; margin-top: 8px;';
modelsListContainer.appendChild(header);

DISCOVERED_GLBS.animated.forEach(model => {
modelsListContainer.appendChild(createModelRow(model, 'animated'));
});
}

if (DISCOVERED_GLBS.static.length > 0) {
const header = document.createElement('div');
header.textContent = 'Static:';
header.style.cssText = 'color: #888; font-size: 11px; font-weight: bold; margin-top: 8px;';
modelsListContainer.appendChild(header);

DISCOVERED_GLBS.static.forEach(model => {
modelsListContainer.appendChild(createModelRow(model, 'static'));
});
}

if (DISCOVERED_GLBS.animated.length === 0 && DISCOVERED_GLBS.static.length === 0) {
const emptyMsg = document.createElement('div');
emptyMsg.textContent = 'No models found';
emptyMsg.style.cssText = 'color: #666; font-size: 11px; padding: 8px 0;';
modelsListContainer.appendChild(emptyMsg);
}
};

modelSelectorFolder.content.appendChild(modelsListContainer);

// Initial population
populateModelCheckboxes();

// Update when models change
setOnModelsDiscovered(() => {
populateModelCheckboxes();
});

// Animation dropdown will be created via callback when model loads
setOnAnimationsLoaded((animationNames, defaultAnimation, modelPath) => {
if (animationNames && animationNames.length > 0) {
createAnimationPicker(defaultAnimation || animationNames[0], animationNames);
}
});

// Check if there's already a loaded animated model and create picker
const loadedAnimated = DISCOVERED_GLBS.animated.filter(m => isModelLoaded(m.path));
if (loadedAnimated.length > 0) {
const firstModel = loadedAnimated[0];
const anims = getModelAnimations(firstModel.path);
if (anims && anims.length > 0) {
createAnimationPicker(anims[0], anims);
}
}

// Point Size folder
const pointSizeFolder = createFolder('Point Size', container);
addSlider(pointSizeFolder.content, settings.pointSize, handleChange);
addSlider(pointSizeFolder.content, settings.pointSizeAudio, handleChange);

// Effects folder - apply procedural effects to point clouds
const effectsFolder = createFolder('Effects', container);

// Effect selector
const effectRow = document.createElement('div');
effectRow.className = 'control-row';
effectRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 8px 0;';

const effectLabel = document.createElement('label');
effectLabel.textContent = 'Effect';
effectLabel.style.cssText = 'color: #fff; font-size: 12px;';

const effectSelect = document.createElement('select');
effectSelect.style.cssText = 'background: #222; border: 1px solid #444; color: #fff; padding: 4px 8px; border-radius: 3px; flex: 1; margin-left: 8px;';

const effectOptions = [
  { value: '', label: 'None (Default)' },
  { value: 'simplex', label: 'Simplex Noise' },
  { value: 'perlin', label: 'Perlin Noise' },
  { value: 'voronoi', label: 'Voronoi' },
  { value: 'fbm', label: 'Fractal Brownian Motion' },
  { value: 'wave', label: 'Wave Field' },
  { value: 'ripple', label: 'Ripple' },
  { value: 'spectral', label: 'Spectral Gradient' },
  { value: 'noise-displace', label: 'Noise Displace' }
];

effectOptions.forEach(opt => {
  const option = document.createElement('option');
  option.value = opt.value;
  option.textContent = opt.label;
  effectSelect.appendChild(option);
});

effectSelect.onchange = () => {
  import('../scenes/skinning.js').then(module => {
    module.setPointCloudEffect(effectSelect.value || null);
  });
};

effectRow.appendChild(effectLabel);
effectRow.appendChild(effectSelect);
effectsFolder.content.appendChild(effectRow);

// Effect parameters
const effectScaleRow = document.createElement('div');
effectScaleRow.className = 'control-row';
effectsFolder.content.appendChild(effectScaleRow);

const effectScaleLabel = document.createElement('label');
effectScaleLabel.textContent = 'Scale';

const effectScaleInput = document.createElement('input');
effectScaleInput.type = 'range';
effectScaleInput.min = '0.1';
effectScaleInput.max = '5';
effectScaleInput.step = '0.1';
effectScaleInput.value = '1';

const effectScaleValue = document.createElement('span');
effectScaleValue.className = 'value';
effectScaleValue.textContent = '1.00';

effectScaleInput.oninput = () => {
  const val = parseFloat(effectScaleInput.value);
  effectScaleValue.textContent = val.toFixed(2);
  import('../scenes/skinning.js').then(module => {
    module.updateEffectParams({ scale: val });
  });
};

effectScaleRow.appendChild(effectScaleLabel);
effectScaleRow.appendChild(effectScaleInput);
effectScaleRow.appendChild(effectScaleValue);

// Effect speed
const effectSpeedRow = document.createElement('div');
effectSpeedRow.className = 'control-row';
effectsFolder.content.appendChild(effectSpeedRow);

const effectSpeedLabel = document.createElement('label');
effectSpeedLabel.textContent = 'Speed';

const effectSpeedInput = document.createElement('input');
effectSpeedInput.type = 'range';
effectSpeedInput.min = '0';
effectSpeedInput.max = '5';
effectSpeedInput.step = '0.1';
effectSpeedInput.value = '1';

const effectSpeedValue = document.createElement('span');
effectSpeedValue.className = 'value';
effectSpeedValue.textContent = '1.00';

effectSpeedInput.oninput = () => {
  const val = parseFloat(effectSpeedInput.value);
  effectSpeedValue.textContent = val.toFixed(2);
  import('../scenes/skinning.js').then(module => {
    module.updateEffectParams({ speed: val });
  });
};

effectSpeedRow.appendChild(effectSpeedLabel);
effectSpeedRow.appendChild(effectSpeedInput);
effectSpeedRow.appendChild(effectSpeedValue);

// Effect intensity
const effectIntensityRow = document.createElement('div');
effectIntensityRow.className = 'control-row';
effectsFolder.content.appendChild(effectIntensityRow);

const effectIntensityLabel = document.createElement('label');
effectIntensityLabel.textContent = 'Intensity';

const effectIntensityInput = document.createElement('input');
effectIntensityInput.type = 'range';
effectIntensityInput.min = '0';
effectIntensityInput.max = '5';
effectIntensityInput.step = '0.1';
effectIntensityInput.value = '0.5';

const effectIntensityValue = document.createElement('span');
effectIntensityValue.className = 'value';
effectIntensityValue.textContent = '0.50';

effectIntensityInput.oninput = () => {
  const val = parseFloat(effectIntensityInput.value);
  effectIntensityValue.textContent = val.toFixed(2);
  import('../scenes/skinning.js').then(module => {
    module.updateEffectParams({ intensity: val });
  });
};

effectIntensityRow.appendChild(effectIntensityLabel);
effectIntensityRow.appendChild(effectIntensityInput);
effectIntensityRow.appendChild(effectIntensityValue);

container.appendChild(effectsFolder.folder);

// Bloom folder
const bloomFolder = createFolder('Bloom', container);
addSlider(bloomFolder.content, settings.bloomIntensity, handleChange);
addSlider(bloomFolder.content, settings.bloomBass, handleChange);
addSlider(bloomFolder.content, settings.bloomMid, handleChange);
addSlider(bloomFolder.content, settings.bloomHigh, handleChange);
addSlider(bloomFolder.content, settings.bloomThreshold, handleChange);
addSlider(bloomFolder.content, settings.bloomRadius, handleChange);

// Output folder
  const outputFolder = createFolder('Output', container);
  addSlider(outputFolder.content, settings.autoRotate, handleChange);
  addSlider(outputFolder.content, settings.autoRotateSpeed, handleChange);
  addCheckbox(outputFolder.content, settings.greenScreen, handleChange);

  // State buttons
  addStateButtons(container, settings);

  // Show container by default
  container.classList.add('visible');

// Apply fade behavior to settings panel
  applyFadeBehavior(container);
}

/**
 * Create animation picker with dropdown and model switcher buttons.
 * @param {string} currentAnimation - Currently selected animation name
 * @param {string[]} animationOptions - Array of available animation names
 */
export function createAnimationPicker(currentAnimation, animationOptions) {
const existing = document.getElementById('animation-picker');
if (existing) existing.remove();

if (!animationOptions || animationOptions.length === 0) return null;

const animatedModels = DISCOVERED_GLBS.animated;
let currentModelIndex = 0;
let currentModelPathAnim = null;

const loadedAnimatedModels = animatedModels.filter(m => isModelLoaded(m.path));
if (loadedAnimatedModels.length > 0) {
currentModelPathAnim = loadedAnimatedModels[0].path;
}

const container = document.createElement('div');
container.id = 'animation-picker';
container.style.cssText = `
position: fixed;
top: 10px;
left: 50%;
transform: translateX(-50%);
z-index: 200;
background: rgba(20, 23, 26, 0.9);
padding: 8px 12px;
border-radius: 5px;
display: flex;
align-items: center;
gap: 8px;
`;

const createButton = (text, onClick) => {
const btn = document.createElement('button');
btn.textContent = text;
btn.style.cssText = `
background: #333;
color: #fff;
border: 1px solid #555;
border-radius: 3px;
padding: 4px 10px;
font-size: 12px;
cursor: pointer;
min-width: 32px;
`;
btn.onmouseenter = () => btn.style.background = '#444';
btn.onmouseleave = () => btn.style.background = '#333';
btn.onclick = onClick;
return btn;
};

const prevModelBtn = createButton('⏮', () => {
const loadedAnimated = animatedModels.filter(m => isModelLoaded(m.path));
if (loadedAnimated.length <= 1) return;
currentModelIndex = (currentModelIndex - 1 + loadedAnimated.length) % loadedAnimated.length;
currentModelPathAnim = loadedAnimated[currentModelIndex].path;
updateAnimationList();
});

const select = document.createElement('select');
select.style.cssText = `
background: #333;
color: #fff;
border: 1px solid #555;
border-radius: 3px;
padding: 4px 8px;
font-size: 12px;
cursor: pointer;
min-width: 140px;
`;

const nextModelBtn = createButton('⏭', () => {
const loadedAnimated = animatedModels.filter(m => isModelLoaded(m.path));
if (loadedAnimated.length <= 1) return;
currentModelIndex = (currentModelIndex + 1) % loadedAnimated.length;
currentModelPathAnim = loadedAnimated[currentModelIndex].path;
updateAnimationList();
});

const modelLabel = document.createElement('span');
modelLabel.style.cssText = `
color: #51cf66;
font-size: 11px;
min-width: 60px;
`;

const updateAnimationList = () => {
const model = animatedModels.find(m => m.path === currentModelPathAnim);
if (model) modelLabel.textContent = model.name;

const anims = getModelAnimations(currentModelPathAnim);
select.innerHTML = '';

if (anims.length === 0) {
const opt = document.createElement('option');
opt.textContent = '(none)';
select.appendChild(opt);
return;
}

anims.forEach(animName => {
const option = document.createElement('option');
option.value = animName;
option.textContent = animName;
select.appendChild(option);
});

select.value = anims[0];
playModelAnimation(currentModelPathAnim, anims[0]);
};

select.addEventListener('change', (e) => {
if (currentModelPathAnim && e.target.value) {
playModelAnimation(currentModelPathAnim, e.target.value);
}
});

const loadedAnimated = animatedModels.filter(m => isModelLoaded(m.path));
if (loadedAnimated.length > 0) {
currentModelPathAnim = loadedAnimated[0].path;
modelLabel.textContent = loadedAnimated[0]?.name || '';

const anims = getModelAnimations(currentModelPathAnim);
select.innerHTML = '';
anims.forEach(animName => {
const option = document.createElement('option');
option.value = animName;
option.textContent = animName;
if (animName === currentAnimation) option.selected = true;
select.appendChild(option);
});
} else {
animationOptions.forEach(animName => {
const option = document.createElement('option');
option.value = animName;
option.textContent = animName;
if (animName === currentAnimation) option.selected = true;
select.appendChild(option);
});
}

container.appendChild(prevModelBtn);
container.appendChild(modelLabel);
container.appendChild(select);
container.appendChild(nextModelBtn);

document.body.appendChild(container);
applyFadeBehavior(container);

return container;
}

/**
* Remove the animation picker from the DOM.
*/
export function removeAnimationPicker() {
const picker = document.getElementById('animation-picker');
if (picker) picker.remove();
}

/**
* Get all setting values as a plain object.
* @param {Object} settings - Settings object
* @returns {Object} Plain object with setting values
*/
export function getSettingsValues(settings) {
    const values = {};
    for (const [key, config] of Object.entries(settings)) {
        values[key] = config.value;
    }
    return values;
}

/**
 * Create GUI for Particle Combi scene.
 * 
 * @param {Object} settings - Settings object
* @param {HTMLElement} container - Container element
* @param {Function} onChange - Callback when settings change
*/
export function createCombiGUI(settings, container, onChange) {
console.log('[createCombiGUI] Creating Combi scene GUI');

const handleChange = () => {
// Save instance transforms when settings change
import('../scenes/combi.js').then(module => {
if (module.getCombiTransforms) {
settings.combiInstanceTransforms.value = module.getCombiTransforms();
}
if (module.getCombiInstanceCount) {
settings.combiInstanceCount.value = module.getCombiInstanceCount();
}
if (onChange) onChange();
});
};

// Get toggle button
const toggleBtn = document.getElementById('toggle-controls');

// Setup toggle button
if (toggleBtn) {
toggleBtn.classList.add('visible');
toggleBtn.textContent = 'Hide';
toggleBtn.onclick = () => {
container.classList.toggle('visible');
toggleBtn.textContent = container.classList.contains('visible') ? 'Hide' : 'Settings';
};
}

// Clear existing content
container.innerHTML = '';

// Models folder
const modelsFolder = createFolder('Models', container);

const modelSelectRow = document.createElement('div');
modelSelectRow.className = 'control-row';
modelSelectRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 8px 0;';

const modelLabel = document.createElement('label');
modelLabel.textContent = 'Add Model';
modelLabel.style.cssText = 'color: #fff; font-size: 14px;';

const modelSelect = document.createElement('select');
modelSelect.style.cssText = 'background: #222; border: 1px solid #444; color: #fff; padding: 4px 8px; border-radius: 3px; flex: 1; margin-left: 8px;';

const defaultOpt = document.createElement('option');
defaultOpt.value = '';
defaultOpt.textContent = '-- Select Model --';
modelSelect.appendChild(defaultOpt);

// Populate with skinning scene models
const allModels = [...DISCOVERED_GLBS.animated, ...DISCOVERED_GLBS.static];
allModels.forEach(model => {
const opt = document.createElement('option');
opt.value = model.path;
opt.textContent = model.name;
modelSelect.appendChild(opt);
});

modelSelect.onchange = async () => {
if (modelSelect.value) {
await loadCombiModel(modelSelect.value);
modelSelect.value = '';
}
};

modelSelectRow.appendChild(modelLabel);
modelSelectRow.appendChild(modelSelect);
modelsFolder.content.appendChild(modelSelectRow);

// Loaded models list
const loadedModelsList = document.createElement('div');
loadedModelsList.style.cssText = 'padding: 8px 0;';

const updateLoadedModelsList = () => {
loadedModelsList.innerHTML = '';
const loadedPaths = getCombiModelPaths ? getCombiModelPaths() : [];

if (loadedPaths.length === 0) {
loadedModelsList.innerHTML = '<div style="color: #666; font-size: 12px;">No models loaded</div>';
return;
}

loadedPaths.forEach(path => {
const model = allModels.find(m => m.path === path);
const row = document.createElement('div');
row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 4px 0;';

const name = document.createElement('span');
name.textContent = model?.name || path.split('/').pop();
name.style.cssText = 'color: #51cf66; font-size: 12px;';

const removeBtn = document.createElement('button');
removeBtn.textContent = '×';
removeBtn.style.cssText = 'background: #8b3a3a; border: none; color: #fff; width: 20px; height: 20px; border-radius: 3px; cursor: pointer; font-size: 14px;';
removeBtn.onmouseenter = () => removeBtn.style.background = '#a64d4d';
removeBtn.onmouseleave = () => removeBtn.style.background = '#8b3a3a';
removeBtn.onclick = () => {
removeCombiModel(path);
updateLoadedModelsList();
};

row.appendChild(name);
row.appendChild(removeBtn);
loadedModelsList.appendChild(row);
});
};

modelsFolder.content.appendChild(loadedModelsList);

// Point Size folder for combi
const pointSizeFolder = createFolder('Point Size', container);
addSlider(pointSizeFolder.content, settings.pointSize, handleChange);
addSlider(pointSizeFolder.content, settings.pointSizeAudio, handleChange);

// Transform folder
    const transformFolder = createFolder('Transform', container);
    
    // Show Gizmo checkbox
    addCheckbox(transformFolder.content, settings.combiShowGizmo, () => {
        if (onChange) onChange();
    });
    
    // Gizmo Mode selector
    const modeSelectRow = document.createElement('div');
    modeSelectRow.className = 'control-row';
    modeSelectRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 8px 0;';
    
    const modeLabel = document.createElement('label');
    modeLabel.textContent = settings.combiGizmoMode?.label || 'Gizmo Mode';
    modeLabel.style.cssText = 'color: #fff; font-size: 14px;';
    
    const modeSelect = document.createElement('select');
    modeSelect.style.cssText = 'background: #222; border: 1px solid #444; color: #fff; padding: 4px 8px; border-radius: 3px;';
    
    // Add mode options
    const modes = ['translate', 'rotate', 'scale'];
    modes.forEach(mode => {
        const option = document.createElement('option');
        option.value = mode;
        option.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
        option.selected = settings.combiGizmoMode?.value === mode;
        modeSelect.appendChild(option);
    });
    
    modeSelect.onchange = () => {
        settings.combiGizmoMode.value = modeSelect.value;
        if (onChange) onChange();
    };
    
    modeSelectRow.appendChild(modeLabel);
    modeSelectRow.appendChild(modeSelect);
    transformFolder.content.appendChild(modeSelectRow);
    
    // Instance count and controls
    const instanceRow = document.createElement('div');
    instanceRow.className = 'control-row';
    instanceRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 8px 0;';
    
    const instanceLabel = document.createElement('label');
    instanceLabel.textContent = 'Instances';
    instanceLabel.style.cssText = 'color: #fff; font-size: 14px;';
    
    const instanceCount = document.createElement('span');
    instanceCount.style.cssText = 'color: #51cf66; font-weight: bold; font-size: 14px;';
    
    const buttonGroup = document.createElement('div');
    buttonGroup.style.cssText = 'display: flex; gap: 8px;';
    
    const addBtn = document.createElement('button');
    addBtn.textContent = '+';
    addBtn.style.cssText = 'background: #2b6e3f; border: none; color: #fff; width: 28px; height: 28px; border-radius: 3px; cursor: pointer; font-size: 18px; font-weight: bold;';
    addBtn.onmouseenter = () => addBtn.style.background = '#3d8a53';
    addBtn.onmouseleave = () => addBtn.style.background = '#2b6e3f';
    
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '-';
    removeBtn.style.cssText = 'background: #8b3a3a; border: none; color: #fff; width: 28px; height: 28px; border-radius: 3px; cursor: pointer; font-size: 18px; font-weight: bold;';
    removeBtn.onmouseenter = () => removeBtn.style.background = '#a64d4d';
    removeBtn.onmouseleave = () => removeBtn.style.background = '#8b3a3a';
    
    // Update count display
    const updateCount = () => {
        import('../scenes/combi.js').then(module => {
            const count = module.getCombiEmitterCount ? module.getCombiEmitterCount() : 0;
            instanceCount.textContent = `${count}/3`;
            addBtn.disabled = count >= 3;
            removeBtn.disabled = count <= 1;
            addBtn.style.opacity = count >= 3 ? '0.5' : '1';
            removeBtn.style.opacity = count <= 1 ? '0.5' : '1';
        });
    };
    
    addBtn.onclick = () => {
        import('../scenes/combi.js').then(module => {
            if (module.addCombiEmitter && module.addCombiEmitter()) {
                updateCount();
                populateInstanceSelect();
            }
        });
    };
    
    removeBtn.onclick = () => {
        import('../scenes/combi.js').then(module => {
            if (module.removeCombiEmitter && module.removeCombiEmitter()) {
                updateCount();
                populateInstanceSelect();
            }
        });
    };
    
    buttonGroup.appendChild(removeBtn);
    buttonGroup.appendChild(instanceCount);
    buttonGroup.appendChild(addBtn);
    
    instanceRow.appendChild(instanceLabel);
    instanceRow.appendChild(buttonGroup);
    transformFolder.content.appendChild(instanceRow);
    
    // Instance selector dropdown
    const instanceSelectRow = document.createElement('div');
    instanceSelectRow.className = 'control-row';
    instanceSelectRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 8px 0;';
    
    const selectLabel = document.createElement('label');
    selectLabel.textContent = 'Select Instance';
    selectLabel.style.cssText = 'color: #fff; font-size: 14px;';
    
    const instanceSelect = document.createElement('select');
    instanceSelect.style.cssText = 'background: #222; border: 1px solid #444; color: #fff; padding: 4px 8px; border-radius: 3px; flex: 1; margin-left: 8px;';
    
    // Function to populate instance dropdown
    const populateInstanceSelect = () => {
        instanceSelect.innerHTML = '';
        import('../scenes/combi.js').then(module => {
            const instanceIds = module.getCombiInstanceIds ? module.getCombiInstanceIds() : [];
            const selected = module.getCombiSelectedInstance ? module.getCombiSelectedInstance() : null;
            
            instanceIds.forEach((id, idx) => {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = `Emitter ${idx + 1}`;
                option.selected = id === selected;
                instanceSelect.appendChild(option);
            });
            
            if (instanceIds.length === 0) {
                const option = document.createElement('option');
                option.textContent = 'No instances';
                instanceSelect.appendChild(option);
                instanceSelect.disabled = true;
            } else {
                instanceSelect.disabled = false;
            }
        });
    };
    
    instanceSelect.onchange = () => {
        import('../scenes/combi.js').then(module => {
            if (module.selectCombiInstance) {
                module.selectCombiInstance(instanceSelect.value);
            }
        });
    };
    
    instanceSelectRow.appendChild(selectLabel);
    instanceSelectRow.appendChild(instanceSelect);
    transformFolder.content.appendChild(instanceSelectRow);
    
    // Reset buttons
    const resetRow = document.createElement('div');
    resetRow.className = 'control-row';
    resetRow.style.cssText = 'display: flex; gap: 8px; padding: 12px 0; flex-wrap: wrap;';
    
    function createResetButton(label, onClick) {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.style.cssText = `
            background: #333;
            border: 1px solid #555;
            color: #fff;
            padding: 6px 12px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            flex: 1;
            min-width: 60px;
        `;
        btn.onmouseenter = () => btn.style.background = '#444';
        btn.onmouseleave = () => btn.style.background = '#333';
        btn.onclick = () => {
            import('../scenes/combi.js').then(module => {
                onClick(module);
            });
        };
        return btn;
    }
    
    resetRow.appendChild(createResetButton('Reset Pos', (m) => m.resetCombiPosition && m.resetCombiPosition()));
    resetRow.appendChild(createResetButton('Reset Rot', (m) => m.resetCombiRotation && m.resetCombiRotation()));
    resetRow.appendChild(createResetButton('Reset Scale', (m) => m.resetCombiScale && m.resetCombiScale()));
    resetRow.appendChild(createResetButton('Reset All', (m) => m.resetCombiAll && m.resetCombiAll()));
    
    transformFolder.content.appendChild(resetRow);
    
// Auto-rotate off checkbox
  addCheckbox(transformFolder.content, settings.combiAutoRotateOff, () => {
    if (onChange) onChange();
  });

  // State buttons
  addStateButtons(container, settings, () => {
    updateCount();
    populateInstanceSelect();
  });

  // Initial updates
  setTimeout(() => {
updateCount();
populateInstanceSelect();

// Restore saved state after scene fully initializes
import('../scenes/combi.js').then(module => {
const savedCount = settings.combiInstanceCount?.value || 1;
const savedTransforms = settings.combiInstanceTransforms?.value || [];
if (module.restoreCombiState && (savedCount > 1 || savedTransforms.length > 0)) {
module.restoreCombiState(savedCount, savedTransforms);
console.log('[Combi] Restored state:', savedCount, 'instances with transforms');
// Update UI after restore
setTimeout(() => {
updateCount();
populateInstanceSelect();
}, 100);
}
});
}, 200);

container.classList.add('visible');

// Apply fade behavior to settings panel
applyFadeBehavior(container);

console.log('[createCombiGUI] Combi GUI creation complete');
}
