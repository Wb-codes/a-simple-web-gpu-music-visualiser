/**
 * @module components/TransformManager
 * @description Centralized transform gizmo manager for scenes.
 * Automatically handles transform controls for any registered component.
 */

import * as THREE from 'three/webgpu';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

/**
 * Create a transform manager that handles gizmos for multiple components.
 * @param {THREE.Camera} camera - The camera for the gizmo
 * @param {HTMLElement} domElement - The canvas/dom element for mouse events
 * @returns {Object} TransformManager interface
 */
export function createTransformManager(camera, domElement) {
    const state = {
        camera,
        domElement,
        /** @type {TransformControls|null} */
        transformControls: null,
        /** @type {THREE.Object3D|null} */
        gizmoHelper: null,
        /** @type {Array<{name: string, component: Object, group: THREE.Group, initialTransform: Object}>} */
        registered: [],
        /** @type {Array<{instanceId: string, componentName: string, group: THREE.Group, initialTransform: Object, index: number}>} */
        instances: [],
        /** @type {string|null} */
        selectedName: null,
        /** @type {Object|null} */
        orbitControls: null,
        visible: false,
    };

    init();

    function init() {
        // Create transform controls
        const transformControls = new TransformControls(camera, domElement);
        transformControls.setMode('translate');
        transformControls.visible = false;
        transformControls.enabled = false;

        // Get the helper (actual gizmo visualization)
        const gizmoHelper = transformControls.getHelper();
        gizmoHelper.visible = false;

        // Store references
        state.transformControls = transformControls;
        state.gizmoHelper = gizmoHelper;

        // Setup dragging event
        transformControls.addEventListener('dragging-changed', (event) => {
            if (state.orbitControls) {
                state.orbitControls.enabled = !event.value;
            }
        });

        console.log('[TransformManager] Initialized');
    }

    /**
     * Set the orbit controls reference for disabling during gizmo drag
     * @param {Object} controls - OrbitControls instance
     */
    function setOrbitControls(controls) {
        state.orbitControls = controls;
    }

    /**
     * Register a component that can be transformed
     * @param {Object} component - The component (for cleanup reference)
     * @param {string} name - Unique name for this component
     * @param {THREE.Group} group - The transformable group
     * @returns {boolean} True if registered successfully
     */
    function register(component, name, group) {
        // Check if name already exists
        if (state.registered.find(item => item.name === name)) {
            console.warn(`[TransformManager] Component with name "${name}" already registered`);
            return false;
        }

        // Check if group is valid
        if (!group || !group.isGroup) {
            console.warn(`[TransformManager] Invalid group for component "${name}"`);
            return false;
        }

        // Store initial transform
        const initialTransform = {
            position: group.position.clone(),
            rotation: group.rotation.clone(),
            scale: group.scale.clone(),
            quaternion: group.quaternion.clone(),
        };

        state.registered.push({
            name,
            component,
            group,
            initialTransform,
        });

        console.log(`[TransformManager] Registered component: ${name}`);

        // Auto-select if this is the first registration
        if (state.registered.length === 1) {
            select(name);
        }

        return true;
    }

    /**
     * Unregister a component
     * @param {string} name - Name of component to unregister
     */
    function unregister(name) {
        const index = state.registered.findIndex(item => item.name === name);
        if (index === -1) {
            console.warn(`[TransformManager] Component "${name}" not found`);
            return;
        }

        // If currently selected, deselect first
        if (state.selectedName === name) {
            deselect();
        }

        // Also remove all instances of this component
        const instancesToRemove = state.instances.filter(item => item.componentName === name);
        instancesToRemove.forEach(instance => {
            const instanceIndex = state.instances.findIndex(item => item.instanceId === instance.instanceId);
            if (instanceIndex !== -1) {
                state.instances.splice(instanceIndex, 1);
            }
        });

        state.registered.splice(index, 1);
        console.log(`[TransformManager] Unregistered component: ${name}`);
    }

    /**
     * Create an instance of a registered component
     * @param {string} componentName - Name of registered component
     * @param {THREE.Group} group - The group for this instance
     * @param {number} index - Instance index
     * @returns {string|null} Instance ID or null if failed
     */
    function createInstance(componentName, group, index) {
        const registered = state.registered.find(item => item.name === componentName);
        if (!registered) {
            console.warn(`[TransformManager] Cannot create instance - component "${componentName}" not registered. Registered:`, state.registered.map(r => r.name));
            return null;
        }

        const instanceId = `${componentName}_${index}`;
        
        // Check if instance already exists
        if (state.instances.find(item => item.instanceId === instanceId)) {
            console.warn(`[TransformManager] Instance "${instanceId}" already exists`);
            return null;
        }

        // Store initial transform
        const initialTransform = {
            position: group.position.clone(),
            rotation: group.rotation.clone(),
            scale: group.scale.clone(),
            quaternion: group.quaternion.clone(),
        };

        state.instances.push({
            instanceId,
            componentName,
            group,
            initialTransform,
            index,
        });

        console.log(`[TransformManager] Created instance: ${instanceId}`);
        
        // Auto-select first instance
        if (state.instances.length === 1) {
            select(instanceId);
        }
        
    return instanceId;
}

/**
     * Reset selected component's position to initial
     */
    function resetPosition() {
        if (!state.selectedName) return;
        
        // Check if selected is an instance
        const instance = state.instances.find(item => item.instanceId === state.selectedName);
        if (instance && instance.initialTransform) {
            instance.group.position.copy(instance.initialTransform.position);
            console.log(`[TransformManager] Reset position for "${state.selectedName}"`);
            return;
        }
        
        // Fall back to registered component
        const item = state.registered.find(item => item.name === state.selectedName);
        if (item && item.initialTransform) {
            item.group.position.copy(item.initialTransform.position);
            console.log(`[TransformManager] Reset position for "${state.selectedName}"`);
        }
    }

    /**
     * Reset selected component's rotation to initial
     */
    function resetRotation() {
        if (!state.selectedName) return;
        
        // Check if selected is an instance
        const instance = state.instances.find(item => item.instanceId === state.selectedName);
        if (instance && instance.initialTransform) {
            instance.group.rotation.copy(instance.initialTransform.rotation);
            instance.group.quaternion.copy(instance.initialTransform.quaternion);
            console.log(`[TransformManager] Reset rotation for "${state.selectedName}"`);
            return;
        }
        
        // Fall back to registered component
        const item = state.registered.find(item => item.name === state.selectedName);
        if (item && item.initialTransform) {
            item.group.rotation.copy(item.initialTransform.rotation);
            item.group.quaternion.copy(item.initialTransform.quaternion);
            console.log(`[TransformManager] Reset rotation for "${state.selectedName}"`);
        }
    }

    /**
     * Reset selected component's scale to initial
     */
    function resetScale() {
        if (!state.selectedName) return;
        
        // Check if selected is an instance
        const instance = state.instances.find(item => item.instanceId === state.selectedName);
        if (instance && instance.initialTransform) {
            instance.group.scale.copy(instance.initialTransform.scale);
            console.log(`[TransformManager] Reset scale for "${state.selectedName}"`);
            return;
        }
        
        // Fall back to registered component
        const item = state.registered.find(item => item.name === state.selectedName);
        if (item && item.initialTransform) {
            item.group.scale.copy(item.initialTransform.scale);
            console.log(`[TransformManager] Reset scale for "${state.selectedName}"`);
        }
    }

    /**
     * Reset all transforms for selected component
     */
    function resetAll() {
        resetPosition();
        resetRotation();
        resetScale();
        console.log(`[TransformManager] Reset all transforms for "${state.selectedName}"`);
    }

    /**
     * Set the transform mode (translate, rotate, scale)
     * @param {string} mode - Transform mode
     */
    function setMode(mode) {
        if (!state.transformControls) return;
        
        const validModes = ['translate', 'rotate', 'scale'];
        if (validModes.includes(mode)) {
            state.transformControls.setMode(mode);
            console.log(`[TransformManager] Mode set to: ${mode}`);
        }
    }

    /**
     * Get current transform mode
     * @returns {string}
     */
    function getMode() {
        return state.transformControls?.mode || 'translate';
    }

    /**
     * Select a component or instance to transform
     * @param {string} name - Name of registered component or instance ID
     * @returns {boolean} True if selected successfully
     */
    function select(name) {
        // Check if it's an instance first
        const instance = state.instances.find(item => item.instanceId === name);
        if (instance) {
            // Detach from previous
            if (state.transformControls) {
                state.transformControls.detach();
            }

            // Attach to instance group
            state.transformControls.attach(instance.group);
            state.selectedName = name;

            // Update visibility based on current state
            updateVisibility();

            console.log(`[TransformManager] Selected instance: ${name}`);
            return true;
        }

        // Fall back to registered component
        const item = state.registered.find(item => item.name === name);
        if (!item) {
            console.warn(`[TransformManager] Cannot select "${name}" - not found`);
            return false;
        }

        // Detach from previous
        if (state.transformControls) {
            state.transformControls.detach();
        }

        // Attach to component group
        state.transformControls.attach(item.group);
        state.selectedName = name;

        // Update visibility based on current state
        updateVisibility();

        console.log(`[TransformManager] Selected component: ${name}`);
        return true;
    }

    /**
     * Deselect current component
     */
    function deselect() {
        if (state.transformControls) {
            state.transformControls.detach();
        }
        state.selectedName = null;
        updateVisibility();
    }

    /**
     * Get the gizmo helper to add to scene
     * @returns {THREE.Object3D|null}
     */
    function getGizmoHelper() {
        return state.gizmoHelper;
    }

    /**
     * Update visibility and state
     * @param {boolean} shouldBeVisible - Whether gizmo should be visible
     */
    function update(shouldBeVisible) {
        state.visible = shouldBeVisible;
        updateVisibility();
    }

    /**
     * Internal: update gizmo visibility based on state
     */
    function updateVisibility() {
        const hasSelection = state.selectedName !== null;
        const shouldShow = state.visible && hasSelection;

        if (state.gizmoHelper) {
            state.gizmoHelper.visible = shouldShow;
        }
        if (state.transformControls) {
            state.transformControls.enabled = shouldShow;
        }
    }

    /**
     * Get list of registered component names
     * @returns {string[]}
     */
    function getRegisteredNames() {
        return state.registered.map(item => item.name);
    }

    /**
     * Get currently selected component name
     * @returns {string|null}
     */
    function getSelectedName() {
        return state.selectedName;
    }

    /**
     * Create an instance of a registered component
     * @param {string} componentName - Name of registered component
     * @param {THREE.Group} group - The group for this instance
     * @param {number} index - Instance index
     * @returns {string|null} Instance ID or null if failed
     */
    function createInstance(componentName, group, index) {
        const registered = state.registered.find(item => item.name === componentName);
        if (!registered) {
            console.warn(`[TransformManager] Cannot create instance - component "${componentName}" not registered`);
            return null;
        }

        const instanceId = `${componentName}_${index}`;
        
        // Check if instance already exists
        if (state.instances.find(item => item.instanceId === instanceId)) {
            console.warn(`[TransformManager] Instance "${instanceId}" already exists`);
            return null;
        }

        // Store initial transform
        const initialTransform = {
            position: group.position.clone(),
            rotation: group.rotation.clone(),
            scale: group.scale.clone(),
            quaternion: group.quaternion.clone(),
        };

        state.instances.push({
            instanceId,
            componentName,
            group,
            initialTransform,
            index,
        });

        console.log(`[TransformManager] Created instance: ${instanceId}`);
        
        // Auto-select first instance
        if (state.instances.length === 1) {
            select(instanceId);
        }
        
        return instanceId;
    }

    /**
     * Remove an instance
     * @param {string} instanceId - Instance ID to remove
     */
    function removeInstance(instanceId) {
        const index = state.instances.findIndex(item => item.instanceId === instanceId);
        if (index === -1) {
            console.warn(`[TransformManager] Instance "${instanceId}" not found`);
            return;
        }

        // If currently selected, deselect first
        if (state.selectedName === instanceId) {
            deselect();
        }

        state.instances.splice(index, 1);
        console.log(`[TransformManager] Removed instance: ${instanceId}`);
    }

    /**
     * Get all instances for a component
     * @param {string} componentName - Component name
     * @returns {Array}
     */
    function getInstances(componentName) {
        return state.instances.filter(item => item.componentName === componentName);
    }

    /**
     * Get instance count for a component
     * @param {string} componentName - Component name
     * @returns {number}
     */
    function getInstanceCount(componentName) {
        return state.instances.filter(item => item.componentName === componentName).length;
    }

    /**
     * Get all instance IDs
     * @returns {string[]}
     */
    function getInstanceIds() {
        return state.instances.map(item => item.instanceId);
    }

    /**
     * Cleanup and dispose all resources
     */
    function cleanup() {
        // Dispose transform controls
        if (state.transformControls) {
            state.transformControls.dispose();
            state.transformControls = null;
        }

        // Clear gizmo helper reference (scene should remove from graph)
        state.gizmoHelper = null;

        // Clear registered components
        state.registered = [];
        state.instances = [];
        state.selectedName = null;
        state.orbitControls = null;

        console.log('[TransformManager] Cleanup complete');
    }

    return {
        setOrbitControls,
        setMode,
        getMode,
        register,
        unregister,
        createInstance,
        removeInstance,
        getInstances,
        getInstanceCount,
        getInstanceIds,
        select,
        deselect,
        resetPosition,
        resetRotation,
        resetScale,
        resetAll,
        getGizmoHelper,
        update,
        getRegisteredNames,
        getSelectedName,
        cleanup,
    };

}
