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
  loadModel, 
  importGLBFile, 
  reloadCurrentModel,
  setOnAnimationsLoaded,
  getAvailableAnimations,
  DISCOVERED_GLBS,
  scanSkinningFolder,
  loadAdditionalModel,
  toggleModelVisibility,
  loadedAdditionalModels,
  removeAdditionalModel,
  currentModelPath
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
    
    // Instanced Points folder
    const pointsFolder = createFolder('Instanced Points');
    addSlider(pointsFolder.content, settings.pulseSpeed, handleChange);
    addSlider(pointsFolder.content, settings.minWidth, handleChange);
    addSlider(pointsFolder.content, settings.maxWidth, handleChange);
    container.appendChild(pointsFolder.folder);
    
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
 * Create Spout controls (Electron only).
 * @param {HTMLElement} container - Container to append controls to
 * @param {Object} settings - Settings object
 * @param {Function} onEnableChange - Callback when enable state changes
 * @param {Function} onNameChange - Callback when sender name changes
 * @param {Function} [onResolutionChange] - Callback when resolution changes
 * @param {Function} [onFrameSkipChange] - Callback when frame skip changes
 * @returns {{folder: HTMLElement, enableCheckbox: HTMLInputElement, nameInput: HTMLInputElement}}
 */
export function createSpoutControls(container, settings, onEnableChange, onNameChange, onResolutionChange, onFrameSkipChange) {
  const spoutFolder = createFolder('Spout Output');

  // Enable checkbox
  const enableRow = document.createElement('div');
  enableRow.className = 'control-row';
  const enableLabel = document.createElement('label');
  enableLabel.textContent = 'Enable Spout';
  const enableCheckbox = document.createElement('input');
  enableCheckbox.type = 'checkbox';
  enableCheckbox.checked = settings.spoutEnabled.value;
  enableCheckbox.onchange = async () => {
    await onEnableChange(enableCheckbox.checked);
  };
  enableRow.appendChild(enableLabel);
  enableRow.appendChild(enableCheckbox);
  spoutFolder.content.appendChild(enableRow);

  // Sender name input
  const nameRow = document.createElement('div');
  nameRow.className = 'control-row';
  const nameLabel = document.createElement('label');
  nameLabel.textContent = 'Sender Name';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = settings.spoutSenderName.value;
  nameInput.style.flex = '1';
  nameInput.style.marginLeft = '8px';
  nameInput.style.background = '#222';
  nameInput.style.border = '1px solid #444';
  nameInput.style.color = '#fff';
  nameInput.style.padding = '4px 8px';
  nameInput.style.borderRadius = '3px';
  nameInput.onchange = async () => {
    settings.spoutSenderName.value = nameInput.value;
    if (onNameChange) await onNameChange(nameInput.value);
  };
  nameRow.appendChild(nameLabel);
  nameRow.appendChild(nameInput);
  spoutFolder.content.appendChild(nameRow);

  // Resolution selector
  const resolutionRow = document.createElement('div');
  resolutionRow.className = 'control-row';
  const resolutionLabel = document.createElement('label');
  resolutionLabel.textContent = 'Resolution';
  const resolutionSelect = document.createElement('select');
  resolutionSelect.style.cssText = `
    flex: 1;
    margin-left: 8px;
    background: #222;
    border: 1px solid #444;
    color: #fff;
    padding: 4px 8px;
    border-radius: 3px;
  `;
  ['1080p', '720p'].forEach(res => {
    const option = document.createElement('option');
    option.value = res;
    option.textContent = res;
    if (res === settings.spoutResolution?.value) option.selected = true;
    resolutionSelect.appendChild(option);
  });
  resolutionSelect.onchange = async () => {
    settings.spoutResolution.value = resolutionSelect.value;
    if (onResolutionChange) await onResolutionChange(resolutionSelect.value);
  };
  resolutionRow.appendChild(resolutionLabel);
  resolutionRow.appendChild(resolutionSelect);
  spoutFolder.content.appendChild(resolutionRow);

  // Frame skip slider
  const frameSkipRow = document.createElement('div');
  frameSkipRow.className = 'control-row';
  const frameSkipLabel = document.createElement('label');
  frameSkipLabel.textContent = 'Frame Skip';
  const frameSkipInput = document.createElement('input');
  frameSkipInput.type = 'range';
  frameSkipInput.min = 0;
  frameSkipInput.max = 2;
  frameSkipInput.step = 1;
  frameSkipInput.value = settings.spoutFrameSkip?.value || 0;
  frameSkipInput.style.flex = '1';
  frameSkipInput.style.margin = '0 8px';
  frameSkipInput.style.accentColor = '#667eea';
  const frameSkipValue = document.createElement('span');
  frameSkipValue.className = 'value';
  frameSkipValue.style.width = '45px';
  frameSkipValue.style.textAlign = 'right';
  frameSkipValue.style.color = '#888';
  frameSkipValue.style.fontSize = '10px';
  const frameSkipLabels = ['60fps', '30fps', '20fps'];
  frameSkipValue.textContent = frameSkipLabels[frameSkipInput.value];
  frameSkipInput.oninput = () => {
    const skip = parseInt(frameSkipInput.value);
    settings.spoutFrameSkip.value = skip;
    frameSkipValue.textContent = frameSkipLabels[skip];
    if (onFrameSkipChange) onFrameSkipChange(skip);
  };
  frameSkipRow.appendChild(frameSkipLabel);
  frameSkipRow.appendChild(frameSkipInput);
  frameSkipRow.appendChild(frameSkipValue);
  spoutFolder.content.appendChild(frameSkipRow);

  container.appendChild(spoutFolder.folder);

  return { folder: spoutFolder.folder, enableCheckbox, nameInput };
}

/**
 * Create GUI specifically for Instanced Points scene.
 * Audio-reactive parameters with sensitivity controls.
 * 
 * @param {Object} settings - Settings object
 * @param {HTMLElement} container - Container element
 * @param {Function} onChange - Callback when settings change
 * @param {boolean} isElectron - Whether running in Electron mode
 */
export function createPointsGUI(settings, container, onChange, isElectron) {
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

  // Point Size folder (4-slider)
  const sizeFolder = createFolder('Point Size', container);
  addSlider(sizeFolder.content, settings.pointsSizeIntensity, handleChange);
  addSlider(sizeFolder.content, settings.pointsSizeBass, handleChange);
  addSlider(sizeFolder.content, settings.pointsSizeMid, handleChange);
  addSlider(sizeFolder.content, settings.pointsSizeHigh, handleChange);

  // Radial Displacement folder (4-slider)
  const displacementFolder = createFolder('Radial Displacement', container);
  addSlider(displacementFolder.content, settings.pointsDisplacementIntensity, handleChange);
  addSlider(displacementFolder.content, settings.pointsDisplacementBass, handleChange);
  addSlider(displacementFolder.content, settings.pointsDisplacementMid, handleChange);
  addSlider(displacementFolder.content, settings.pointsDisplacementHigh, handleChange);

  // Pulse Speed folder (4-slider)
  const pulseFolder = createFolder('Pulse Speed', container);
  addSlider(pulseFolder.content, settings.pointsPulseIntensity, handleChange);
  addSlider(pulseFolder.content, settings.pointsPulseBass, handleChange);
  addSlider(pulseFolder.content, settings.pointsPulseMid, handleChange);
  addSlider(pulseFolder.content, settings.pointsPulseHigh, handleChange);

  // Rotation Speed folder (4-slider)
  const rotationFolder = createFolder('Rotation Speed', container);
  addSlider(rotationFolder.content, settings.pointsRotationIntensity, handleChange);
  addSlider(rotationFolder.content, settings.pointsRotationBass, handleChange);
  addSlider(rotationFolder.content, settings.pointsRotationMid, handleChange);
  addSlider(rotationFolder.content, settings.pointsRotationHigh, handleChange);

  // Curve Count folder (4-slider)
  const curveFolder = createFolder('Curve Count', container);
  addSlider(curveFolder.content, settings.pointsCurveCountIntensity, handleChange);
  addSlider(curveFolder.content, settings.pointsCurveCountBass, handleChange);
  addSlider(curveFolder.content, settings.pointsCurveCountMid, handleChange);
  addSlider(curveFolder.content, settings.pointsCurveCountHigh, handleChange);

  // Wave Speed folder (4-slider) - controls how fast the "snake" travels
  const waveSpeedFolder = createFolder('Wave Speed', container);
  addSlider(waveSpeedFolder.content, settings.pointsWaveSpeedIntensity, handleChange);
  addSlider(waveSpeedFolder.content, settings.pointsWaveSpeedBass, handleChange);
  addSlider(waveSpeedFolder.content, settings.pointsWaveSpeedMid, handleChange);
  addSlider(waveSpeedFolder.content, settings.pointsWaveSpeedHigh, handleChange);

  // Wave Length folder (single slider) - controls how many points are in the wave chain
  const waveLengthFolder = createFolder('Wave Length', container);
  addSlider(waveLengthFolder.content, settings.pointsWaveLength, handleChange);

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

  // Spout controls (Electron only)
  if (isElectron) {
    createSpoutControls(outputFolder.content, settings, async (enabled) => {
      if (enabled) {
        const options = {
          resolution: settings.spoutResolution?.value || '1080p',
          frameSkip: settings.spoutFrameSkip?.value || 0
        };
        const result = await window.spoutAPI.enable(options);
        if (result.success) {
          settings.spoutEnabled.value = true;
          if (onChange) onChange();
        }
      } else {
        await window.spoutAPI.disable();
        settings.spoutEnabled.value = false;
        if (onChange) onChange();
      }
    }, async (name) => {
      settings.spoutSenderName.value = name;
      if (settings.spoutEnabled.value) {
        await window.spoutAPI.updateName(name);
      }
    }, async (resolution) => {
      settings.spoutResolution.value = resolution;
    }, async (frameSkip) => {
      settings.spoutFrameSkip.value = frameSkip;
      if (settings.spoutEnabled.value) {
        await window.spoutAPI.updateFrameSkip(frameSkip);
      }
    });
  }

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
 * @param {boolean} isElectron - Whether running in Electron mode
 */
export function createParticlesGUI(settings, container, onChange, isElectron) {
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
    
  // Spout controls (Electron only)
  if (isElectron) {
    createSpoutControls(outputFolder.content, settings, async (enabled) => {
      if (enabled) {
        const options = {
          resolution: settings.spoutResolution?.value || '1080p',
          frameSkip: settings.spoutFrameSkip?.value || 0
        };
        const result = await window.spoutAPI.enable(options);
        if (result.success) {
          settings.spoutEnabled.value = true;
          if (onChange) onChange();
        }
      } else {
        await window.spoutAPI.disable();
        settings.spoutEnabled.value = false;
        if (onChange) onChange();
      }
    }, async (name) => {
      settings.spoutSenderName.value = name;
      if (settings.spoutEnabled.value) {
        await window.spoutAPI.updateName(name);
      }
    }, async (resolution) => {
      settings.spoutResolution.value = resolution;
    }, async (frameSkip) => {
      settings.spoutFrameSkip.value = frameSkip;
      if (settings.spoutEnabled.value) {
        await window.spoutAPI.updateFrameSkip(frameSkip);
      }
    });
  }

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
 * @param {boolean} isElectron - Whether running in Electron mode
 */
export function createSkinningGUI(settings, container, onChange, isElectron) {
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

  // Model Selection folder
  const modelFolder = createFolder('Model', container);
  
  // Model selector dropdown
  const modelLabel = document.createElement('label');
  modelLabel.textContent = 'Select Model:';
  modelLabel.style.cssText = 'color: #fff; font-size: 12px; display: block; margin-bottom: 5px;';
  modelFolder.content.appendChild(modelLabel);
  
  const modelSelect = document.createElement('select');
  modelSelect.style.cssText = `
    width: 100%;
    background: #333;
    color: #fff;
    border: 1px solid #555;
    border-radius: 3px;
    padding: 6px 8px;
    font-size: 12px;
    cursor: pointer;
    margin-bottom: 10px;
  `;
  
  // Add available models
  AVAILABLE_MODELS.forEach((model, index) => {
    const option = document.createElement('option');
    option.value = model.path;
    option.textContent = model.name;
    if (index === 0) option.selected = true;
    modelSelect.appendChild(option);
  });
  
  modelFolder.content.appendChild(modelSelect);
  
  // Reload button
  const reloadBtn = document.createElement('button');
  reloadBtn.textContent = '↻ Reload Model';
  reloadBtn.style.cssText = `
    background: #444;
    color: #fff;
    border: 1px solid #555;
    border-radius: 3px;
    padding: 6px 12px;
    font-size: 11px;
    cursor: pointer;
    width: 100%;
    margin-top: 5px;
  `;
  reloadBtn.onmouseenter = () => reloadBtn.style.background = '#555';
  reloadBtn.onmouseleave = () => reloadBtn.style.background = '#444';
  reloadBtn.onclick = async () => {
    reloadBtn.textContent = 'Loading...';
    reloadBtn.disabled = true;
    try {
      // Get current app context (renderer, camera, controls)
      // This will be handled by the scene reload
      await reloadCurrentModel();
      reloadBtn.textContent = '↻ Reload Model';
    } catch (error) {
      reloadBtn.textContent = 'Error! Retry';
    }
    reloadBtn.disabled = false;
  };
  modelFolder.content.appendChild(reloadBtn);
  
  // Handle model selection change
  modelSelect.addEventListener('change', async (e) => {
    const selectedPath = e.target.value;
    modelSelect.disabled = true;
    reloadBtn.textContent = 'Loading...';
    try {
      await loadModel(selectedPath);
      // Animation picker will be updated via callback
    } catch (error) {
      console.error('Failed to load model:', error);
      reloadBtn.textContent = 'Error Loading';
    }
    modelSelect.disabled = false;
    reloadBtn.textContent = '↻ Reload Model';
  });

  // File Import folder
  const importFolder = createFolder('Import GLB', container);
  
  // Drop zone
  const dropZone = document.createElement('div');
  dropZone.id = 'glb-drop-zone';
  dropZone.style.cssText = `
    border: 2px dashed #555;
    border-radius: 5px;
    padding: 20px;
    text-align: center;
    color: #888;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.3s ease;
    background: rgba(30, 30, 30, 0.5);
  `;
  dropZone.innerHTML = `
    <div style="font-size: 24px; margin-bottom: 5px;">📁</div>
    <div>Drop GLB file here</div>
    <div style="font-size: 10px; margin-top: 5px; color: #666;">or click to browse</div>
  `;
  
  // Drag effects
  dropZone.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#667eea';
    dropZone.style.background = 'rgba(102, 126, 234, 0.1)';
  });
  
  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#555';
    dropZone.style.background = 'rgba(30, 30, 30, 0.5)';
  });
  
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
  });
  
  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#555';
    dropZone.style.background = 'rgba(30, 30, 30, 0.5)';
    
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].name.endsWith('.glb')) {
      await handleGLBImport(files[0]);
    } else {
      dropZone.innerHTML = `<div style="color: #ff6b6b;">Please drop a .glb file</div>`;
      setTimeout(() => {
        dropZone.innerHTML = `
          <div style="font-size: 24px; margin-bottom: 5px;">📁</div>
          <div>Drop GLB file here</div>
          <div style="font-size: 10px; margin-top: 5px; color: #666;">or click to browse</div>
        `;
      }, 2000);
    }
  });
  
  // Click to browse
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.glb';
  fileInput.style.display = 'none';
  fileInput.addEventListener('change', async (e) => {
    if (e.target.files.length > 0) {
      await handleGLBImport(e.target.files[0]);
    }
  });
  
  dropZone.addEventListener('click', () => fileInput.click());
  
  importFolder.content.appendChild(dropZone);
  importFolder.content.appendChild(fileInput);
  
  // Import handler
  async function handleGLBImport(file) {
    dropZone.innerHTML = `<div style="color: #667eea;">Loading ${file.name}...</div>`;
    try {
      await importGLBFile(file);
      
      // Add to model dropdown
      const option = document.createElement('option');
      option.value = file.name;
      option.textContent = file.name.replace('.glb', '');
      modelSelect.appendChild(option);
      option.selected = true;
      
      dropZone.innerHTML = `
        <div style="color: #51cf66;">✓ ${file.name} loaded!</div>
      `;
      setTimeout(() => {
        dropZone.innerHTML = `
          <div style="font-size: 24px; margin-bottom: 5px;">📁</div>
          <div>Drop GLB file here</div>
          <div style="font-size: 10px; margin-top: 5px; color: #666;">or click to browse</div>
        `;
      }, 3000);
      
      if (onChange) onChange();
    } catch (error) {
      console.error('Import failed:', error);
      dropZone.innerHTML = `
        <div style="color: #ff6b6b;">Failed to load</div>
      `;
      setTimeout(() => {
        dropZone.innerHTML = `
          <div style="font-size: 24px; margin-bottom: 5px;">📁</div>
          <div>Drop GLB file here</div>
          <div style="font-size: 10px; margin-top: 5px; color: #666;">or click to browse</div>
        `;
      }, 3000);
    }
  }

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

  // Spout controls (Electron only)
  if (isElectron) {
    createSpoutControls(outputFolder.content, settings, async (enabled) => {
      if (enabled) {
        const options = {
          resolution: settings.spoutResolution?.value || '1080p',
          frameSkip: settings.spoutFrameSkip?.value || 0
        };
        const result = await window.spoutAPI.enable(options);
        if (result.success) {
          settings.spoutEnabled.value = true;
          if (onChange) onChange();
        }
      } else {
        await window.spoutAPI.disable();
        settings.spoutEnabled.value = false;
        if (onChange) onChange();
      }
    }, async (name) => {
      settings.spoutSenderName.value = name;
      if (settings.spoutEnabled.value) {
        await window.spoutAPI.updateName(name);
      }
    }, async (resolution) => {
      settings.spoutResolution.value = resolution;
    }, async (frameSkip) => {
      settings.spoutFrameSkip.value = frameSkip;
      if (settings.spoutEnabled.value) {
        await window.spoutAPI.updateFrameSkip(frameSkip);
      }
    });
  }

  // Show container by default
  container.classList.add('visible');

  // Apply fade behavior to settings panel
  applyFadeBehavior(container);

  // Create the top bar with all three dropdowns
  let modelPickersContainer = null;
  
  async function createModelPickers() {
    // Remove old pickers
    if (modelPickersContainer) {
      modelPickersContainer.remove();
    }
    
    // Scan for GLB files
    await scanSkinningFolder();
    
    // Create container for all pickers
    modelPickersContainer = document.createElement('div');
    modelPickersContainer.id = 'model-pickers-container';
    modelPickersContainer.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 200;
      display: flex;
      align-items: flex-start;
      gap: 20px;
      background: rgba(20, 23, 26, 0.9);
      padding: 8px 16px;
      border-radius: 5px;
    `;
    
  // === LEFT: Animated Models Dropdown ===
  const animatedContainer = createModelDropdown(
    'Animated Models',
    DISCOVERED_GLBS.animated,
    true, // has checkboxes
    async (modelName, isChecked) => {
      if (isChecked) {
        // Load the model
        const modelInfo = DISCOVERED_GLBS.animated.find(m => m.name === modelName);
        if (modelInfo) {
          try {
            // First unload any other animated models to keep only one active
            for (const [name, data] of loadedAdditionalModels) {
              if (data.hasAnimations && name !== modelName) {
                removeAdditionalModel(name);
              }
            }
            await loadAdditionalModel(modelInfo.path, true);
          } catch (error) {
            console.error('Failed to load animated model:', error);
          }
        }
      } else {
        // Unload the model completely when unchecked
        removeAdditionalModel(modelName);
      }
    }
  );
    
  // === CENTER: Animation Picker ===
  const availableAnims = getAvailableAnimations();
  console.log(`[GUI] Creating animation picker with ${availableAnims.length} animations:`, availableAnims);
  
  const animationContainer = createAnimationPicker(
    settings.currentAnimation.value,
    availableAnims,
    (animationName) => {
      console.log(`[GUI] Animation selected: ${animationName}`);
      settings.currentAnimation.value = animationName;
      const result = switchAnimation(animationName);
      console.log(`[GUI] switchAnimation result: ${result}`);
      if (onChange) onChange();
    }
  );
    // Remove fade behavior from animation picker (handled by container)
    animationContainer.style.position = 'static';
    animationContainer.style.transform = 'none';
    animationContainer.style.background = 'transparent';
    
  // === RIGHT: Static Models Dropdown ===
  const staticContainer = createModelDropdown(
    'Static Models',
    DISCOVERED_GLBS.static,
    true, // has checkboxes
    async (modelName, isChecked) => {
      console.log(`[GUI] Static model ${modelName} checkbox changed: ${isChecked}`);
      if (isChecked) {
        // Load the model
        const modelInfo = DISCOVERED_GLBS.static.find(m => m.name === modelName);
        console.log(`[GUI] Looking for static model info:`, modelInfo);
        if (modelInfo) {
          try {
            console.log(`[GUI] Loading static model: ${modelInfo.path}`);
            await loadAdditionalModel(modelInfo.path, true);
          } catch (error) {
            console.error('[GUI] Failed to load static model:', error);
          }
        } else {
          console.warn(`[GUI] Static model ${modelName} not found in DISCOVERED_GLBS.static`);
        }
      } else {
        // Unload the model completely when unchecked
        console.log(`[GUI] Unloading static model: ${modelName}`);
        removeAdditionalModel(modelName);
      }
    }
  );
    
    modelPickersContainer.appendChild(animatedContainer);
    modelPickersContainer.appendChild(animationContainer);
    modelPickersContainer.appendChild(staticContainer);
    document.body.appendChild(modelPickersContainer);
    
    // Apply fade behavior to the whole container
    applyFadeBehavior(modelPickersContainer);
  }
  
  // Set up callback for when animations load
  setOnAnimationsLoaded((animationNames, defaultAnimation) => {
    // Refresh the pickers when animations change
    createModelPickers();
  });
  
  // Create initial pickers
  createModelPickers();
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
  
  // Also remove the model pickers container
  const modelPickers = document.getElementById('model-pickers-container');
  if (modelPickers) modelPickers.remove();
}

/**
 * Create a model dropdown with checkboxes
 * @param {string} title - Title for the dropdown
 * @param {Array<{name: string, path: string}>} models - Array of model objects
 * @param {boolean} hasCheckboxes - Whether to show checkboxes
 * @param {Function} onToggle - Callback when checkbox is toggled (modelName, isChecked)
 * @returns {HTMLElement} The created dropdown container
 */
function createModelDropdown(title, models, hasCheckboxes, onToggle) {
  const container = document.createElement('div');
  container.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 4px;
  `;
  
  // Create label
  const label = document.createElement('label');
  label.textContent = title;
  label.style.cssText = `
    color: #fff;
    font-size: 11px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    white-space: nowrap;
    text-align: center;
    margin-bottom: 4px;
  `;
  container.appendChild(label);
  
  // Create dropdown button
  const dropdownBtn = document.createElement('button');
  dropdownBtn.textContent = `${models.length} models ▼`;
  dropdownBtn.style.cssText = `
    background: #333;
    color: #fff;
    border: 1px solid #555;
    border-radius: 3px;
    padding: 6px 12px;
    font-size: 12px;
    cursor: pointer;
    min-width: 120px;
    text-align: left;
  `;
  container.appendChild(dropdownBtn);
  
  // Create dropdown menu
  const menu = document.createElement('div');
  menu.style.cssText = `
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: #222;
    border: 1px solid #555;
    border-radius: 3px;
    margin-top: 4px;
    max-height: 200px;
    overflow-y: auto;
    z-index: 300;
    min-width: 150px;
  `;
  
  // Toggle dropdown visibility
  let isOpen = false;
  dropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    isOpen = !isOpen;
    menu.style.display = isOpen ? 'block' : 'none';
    dropdownBtn.textContent = `${models.length} models ${isOpen ? '▲' : '▼'}`;
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', () => {
    if (isOpen) {
      isOpen = false;
      menu.style.display = 'none';
      dropdownBtn.textContent = `${models.length} models ▼`;
    }
  });
  
  // Populate menu with model items
  models.forEach((model) => {
    const item = document.createElement('div');
    item.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      color: #fff;
      font-size: 12px;
      cursor: pointer;
      border-bottom: 1px solid #333;
    `;
    
    // Checkbox
    if (hasCheckboxes) {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.style.cssText = `
        cursor: pointer;
        width: 14px;
        height: 14px;
      `;
      // Check if model is loaded AND visible
      const modelData = loadedAdditionalModels.get(model.name);
      checkbox.checked = modelData ? modelData.visible : false;
      
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        if (onToggle) {
          onToggle(model.name, checkbox.checked);
        }
      });
      
      item.appendChild(checkbox);
    }
    
    // Model name
    const nameSpan = document.createElement('span');
    nameSpan.textContent = model.name;
    nameSpan.style.cssText = 'flex: 1;';
    item.appendChild(nameSpan);
    
    // Animation count badge (for animated models)
    if (model.animationCount > 0) {
      const badge = document.createElement('span');
      badge.textContent = `${model.animationCount} anim`;
      badge.style.cssText = `
        font-size: 9px;
        color: #888;
        background: #333;
        padding: 1px 4px;
        border-radius: 2px;
      `;
      item.appendChild(badge);
    }
    
    // Hover effect
    item.addEventListener('mouseenter', () => {
      item.style.background = '#333';
    });
    item.addEventListener('mouseleave', () => {
      item.style.background = 'transparent';
    });
    
    menu.appendChild(item);
  });
  
  // If no models
  if (models.length === 0) {
    const emptyItem = document.createElement('div');
    emptyItem.textContent = 'No models found';
    emptyItem.style.cssText = `
      padding: 6px 12px;
      color: #666;
      font-size: 12px;
      font-style: italic;
    `;
    menu.appendChild(emptyItem);
  }
  
  // Position menu below dropdown
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position: relative;';
  wrapper.appendChild(dropdownBtn);
  wrapper.appendChild(menu);
  container.appendChild(wrapper);
  
  return container;
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
