/**
 * @module gui
 * @description Settings GUI creation and management.
 * Creates a collapsible folder-based interface for adjusting visualization parameters.
 */

import { SCENE_NAMES } from '../core/constants.js';
import { ANIMATION_NAMES, DEFAULT_ANIMATION, DYNAMIC_ANIMATION_NAMES } from '../core/animations.js';
import {
AVAILABLE_MODELS,
switchAnimation,
setOnAnimationsLoaded,
getAvailableAnimations
} from '../scenes/skinning.js';
import { applyFadeBehavior, removeAllFadeBehaviors, applyFadeToSettingsButton } from './fade-manager.js';

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

  // Bloom folder (audio-reactive)
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

	// Show container by default
	container.classList.add('visible');

	// Apply fade behavior to settings panel
	applyFadeBehavior(container);
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
	<p style="margin: 8px 0 3px 0;">Available models:</p>
`;
AVAILABLE_MODELS.forEach(m => {
	infoText.innerHTML += `<p style="margin: 2px 0; color: #51cf66;">• ${m.name}</p>`;
});
infoFolder.content.appendChild(infoText);

// Animation dropdown will be created via callback when model loads
// Set up callback for when animations are loaded
setOnAnimationsLoaded((animationNames, defaultAnimation) => {
	createAnimationPicker(defaultAnimation || animationNames[0], animationNames, (newAnimation) => {
	switchAnimation(newAnimation);
	});
});

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

// Show container by default
container.classList.add('visible');

// Apply fade behavior to settings panel
applyFadeBehavior(container);
}

/**
* Create animation picker dropdown at the top center of the screen.
              console.log(`[GUI] Loading animated model: ${modelInfo.path}`);
              for (const [name, data] of loadedAdditionalModels) {
                if (data.hasAnimations && name !== modelName) {
                  removeAdditionalModel(name);
                }
              }
              await loadAdditionalModel(modelInfo.path, true);
            }
          } catch (error) {
            console.error('[GUI] Failed to load animated model:', error);
          }
        }
      } else {
}

/**
* Create animation picker dropdown at the top center of the screen.
* @param {string} currentAnimation - Currently selected animation name
* @param {string[]} animationOptions - Array of available animation names
* @param {Function} onChange - Callback when animation changes
* @returns {HTMLElement} The created dropdown container
*/
export function createAnimationPicker(currentAnimation, animationOptions, onChange) {
  // Remove existing picker if present
  const existing = document.getElementById('animation-picker');
  if (existing) existing.remove();

  // Create container
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

  // Create label
  const label = document.createElement('label');
  label.textContent = 'Animation:';
  label.style.cssText = `
    color: #fff;
    font-size: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    white-space: nowrap;
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
    max-width: 200px;
  `;

  // Add animation options
  animationOptions.forEach((animName) => {
    const option = document.createElement('option');
    option.value = animName;
    option.textContent = animName;
    if (animName === currentAnimation) option.selected = true;
    select.appendChild(option);
  });

  // Handle change
  select.addEventListener('change', (e) => {
    const newAnimation = e.target.value;
    if (onChange) onChange(newAnimation);
  });

  container.appendChild(label);
  container.appendChild(select);
  document.body.appendChild(container);

  // Apply fade behavior
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
        console.log('[createCombiGUI] Setting changed:', settings.combiShowGizmo?.label, 'new value:', settings.combiShowGizmo?.value);
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
    
    // Initial updates
    setTimeout(() => {
        updateCount();
        populateInstanceSelect();
    }, 100);
    
    container.classList.add('visible');

    // Apply fade behavior to settings panel
    applyFadeBehavior(container);
    
    console.log('[createCombiGUI] Combi GUI creation complete');
}
