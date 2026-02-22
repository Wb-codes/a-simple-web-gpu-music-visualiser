/**
 * @module gui
 * @description Settings GUI creation and management.
 * Creates a collapsible folder-based interface for adjusting visualization parameters.
 */

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
 * @returns {{folder: HTMLElement, enableCheckbox: HTMLInputElement, nameInput: HTMLInputElement}}
 */
export function createSpoutControls(container, settings, onEnableChange, onNameChange) {
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
    
    container.appendChild(spoutFolder.folder);
    
    return { folder: spoutFolder.folder, enableCheckbox, nameInput };
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
