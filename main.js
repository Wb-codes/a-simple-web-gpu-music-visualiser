/** 
 * @module main
 * @description Main window entry point for the music visualizer.
 * Uses shared bootstrap initialization with Electron-specific features.
 */

console.log('[Main] main.js loaded');

// Immediate check for start button
console.log('[Main] Looking for start button:', document.getElementById('start-btn'));

import { initVisualization, stopAnimation } from './src/core/bootstrap.js';
import { initAudio, analyzeAudio, isAudioActive } from './src/audio/capture.js';
import { createPointsGUI, createParticlesGUI, createSkinningGUI, createSceneSelector, updateSceneSelector, removeAnimationPicker, removeAllFadeBehaviors } from './src/gui/index.js';
import { applyFadeToSettingsButton, applyFadeBehavior } from './src/gui/fade-manager.js';
import { createSettings } from './src/settings/defaults.js';
import { 
    syncSettingsToSpout, 
    syncAudioToSpout,
    syncSceneToSpout,
    isSpoutAvailable
} from './src/spout/sync.js';

// === State ===
const settings = createSettings();
let app = null;
let currentSceneType = 'particles';
let audioInitialized = false;

/**
 * Initialize the application with scene and Spout support.
 * @param {string} sceneType - Scene type to initialize
 */
async function init(sceneType) {
  console.log('[Main] Initializing scene:', sceneType);
  currentSceneType = sceneType;

  try {
    // Initialize visualization
    console.log('[Main] Calling initVisualization...');
    app = await initVisualization({
      settings,
      sceneType,
      onSettingsChange: () => syncSettingsToSpout(settings),
      onAudioUpdate: (audioData) => {
        if (isAudioActive()) {
          syncAudioToSpout(audioData);
        }
      }
    });
    console.log('[Main] initVisualization completed successfully');

    // Sync scene to Spout
    syncSceneToSpout(sceneType);

// Create scene-specific GUI
  const container = document.getElementById('controls');
  const isElectron = window.isElectron === true;

  if (sceneType === 'points') {
    createPointsGUI(settings, container, () => syncSettingsToSpout(settings), isElectron);
  } else if (sceneType === 'particles') {
    createParticlesGUI(settings, container, () => syncSettingsToSpout(settings), isElectron);
  } else if (sceneType === 'skinning') {
    createSkinningGUI(settings, container, () => syncSettingsToSpout(settings), isElectron);
  } else {
    console.warn('Unknown scene type:', sceneType);
  }

  // Hide scene indicator (using dropdown instead)
  const indicator = document.getElementById('scene-indicator');
  if (indicator) {
    indicator.style.display = 'none';
  }

  // Create scene selector dropdown
  createSceneSelector(sceneType, switchSceneWithGUI);

  // Apply fade behavior to settings button
  applyFadeToSettingsButton();

  // Apply fade behavior to scene selector
  const sceneSelector = document.getElementById('scene-selector');
  if (sceneSelector) {
    applyFadeBehavior(sceneSelector);
  }
    
    console.log('[Main] Scene initialization complete');
  } catch (err) {
    console.error('[Main] Initialization failed:', err);
    console.error('[Main] Error stack:', err.stack);
    
    // Show error in UI
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
      background: rgba(200, 50, 50, 0.9); color: white; padding: 20px;
      border-radius: 10px; font-family: sans-serif; z-index: 10000;
      max-width: 80%; text-align: center;
    `;
    errorDiv.innerHTML = `
      <h3>Initialization Failed</h3>
      <p>Error: ${err.message}</p>
      <p>Check browser console for details (Ctrl+Shift+I)</p>
    `;
    document.body.appendChild(errorDiv);
    
    throw err;
  }
}

/**
 * Switch to a different scene without reinitializing audio.
 * @param {string} sceneType - The scene type to switch to
 */
export async function switchSceneWithGUI(sceneType) {
  if (sceneType === currentSceneType) return;

  console.log('Switching scene from', currentSceneType, 'to', sceneType);

  // Remove animation picker when leaving skinning scene
  if (currentSceneType === 'skinning') {
    removeAnimationPicker();
  }

  currentSceneType = sceneType;

  // Stop current animation
  stopAnimation();

  // Cleanup current scene
  if (app) {
    app.cleanup();
  }

  // Remove all fade behaviors from previous scene
  removeAllFadeBehaviors();

  // Clear controls
  document.getElementById('controls').innerHTML = '';

  // Initialize new scene
  app = await initVisualization({
    settings,
    sceneType,
    onSettingsChange: () => syncSettingsToSpout(settings),
    onAudioUpdate: (audioData) => {
      if (isAudioActive()) {
        syncAudioToSpout(audioData);
      }
    }
  });

  // Sync scene to Spout
  syncSceneToSpout(sceneType);

  // Create scene-specific GUI
  const container = document.getElementById('controls');
  const isElectron = window.isElectron === true;

  if (sceneType === 'points') {
    createPointsGUI(settings, container, () => syncSettingsToSpout(settings), isElectron);
  } else if (sceneType === 'particles') {
    createParticlesGUI(settings, container, () => syncSettingsToSpout(settings), isElectron);
  } else if (sceneType === 'skinning') {
    createSkinningGUI(settings, container, () => syncSettingsToSpout(settings), isElectron);
  }

  // Update scene selector dropdown
  updateSceneSelector(sceneType);

  // Apply fade behavior to settings button
  applyFadeToSettingsButton();

  // Apply fade behavior to scene selector
  const newSceneSelector = document.getElementById('scene-selector');
  if (newSceneSelector) {
    applyFadeBehavior(newSceneSelector);
  }
}

// === Event Listeners ===

// Flag to prevent duplicate event listeners
let startButtonHandlersAttached = false;

// Wait for DOM to be fully loaded before attaching event listeners
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', attachStartButtonHandler);
} else {
  attachStartButtonHandler();
}

function attachStartButtonHandler() {
  // Prevent duplicate handlers
  if (startButtonHandlersAttached) {
    console.log('[Main] Start button handlers already attached, skipping');
    return;
  }
  startButtonHandlersAttached = true;
  
  console.log('[Main] Attaching start button handler');
  
  const startBtn = document.getElementById('start-btn');
  const startOverlay = document.getElementById('start-overlay');
  
  if (!startBtn) {
    console.error('[Main] Start button not found!');
    return;
  }
  
  if (!startOverlay) {
    console.error('[Main] Start overlay not found!');
    return;
  }
  
  console.log('[Main] Found start button and overlay');
  
  // Attach click handler to button
  startBtn.addEventListener('mousedown', () => {
    console.log('[Main] Start button mousedown detected');
  });
  
  startBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[Main] Start button clicked');
    console.log('[Main] User Agent:', navigator.userAgent);
    console.log('[Main] URL:', window.location.href);
    
    await startVisualizer();
  });

  // Also allow clicking the entire overlay (but not the button itself)
  startOverlay.addEventListener('click', async (e) => {
    // Only respond if clicking the overlay background or text elements, not interactive elements
    if (e.target === startOverlay || e.target.tagName === 'H1' || e.target.tagName === 'P') {
      e.preventDefault();
      e.stopPropagation();
      console.log('[Main] Overlay clicked');
      await startVisualizer();
    }
  });
  
  console.log('[Main] Start button handlers attached');
}

// Make startVisualizer available globally for fallback
window.startVisualizer = startVisualizer;
window.handleStartButtonClick = () => {
  console.log('[Main] Fallback button click handler');
  startVisualizer();
};

// Flag to prevent multiple simultaneous calls to startVisualizer
let isStarting = false;

// Auto-start for OBS Browser Source or when ?autostart=true
async function startVisualizer() {
  // Prevent multiple simultaneous executions
  if (isStarting) {
    console.log('[Main] startVisualizer already running, skipping duplicate call');
    return;
  }
  
  if (audioInitialized) {
    console.log('[Main] Audio already initialized, just hiding overlay');
    document.getElementById('start-overlay').style.display = 'none';
    return;
  }
  
  isStarting = true;

  try {
    document.getElementById('start-overlay').style.display = 'none';

    // Check if we should use dummy audio
    const urlParams = new URLSearchParams(window.location.search);
    const isOBS = navigator.userAgent.toLowerCase().includes('obs') ||
      navigator.userAgent.toLowerCase().includes('cef') ||
      urlParams.get('obs') === 'true';
    const useDummyAudio = urlParams.get('audio') === 'dummy' || isOBS;

    if (isOBS) {
      console.log('[Main] OBS Browser Source detected - using dummy audio');
    }
    if (useDummyAudio) {
      console.log('[Main] Dummy audio mode - no permission dialogs');
    }

    // Initialize audio only once
    if (!audioInitialized) {
      console.log('[Main] Initializing audio...');
      try {
        await initAudio();
        audioInitialized = true;
        console.log('[Main] Audio initialized');
      } catch (err) {
        console.error('[Main] Audio init failed:', err);
        // Continue anyway - scene will still render
      }
    }

    // Start with particles scene (or scene from URL)
    const sceneParam = urlParams.get('scene') || 'particles';
    console.log('[Main] Starting scene:', sceneParam);

    await init(sceneParam);
    console.log('[Main] Initialization complete');
  } catch (err) {
    console.error('[Main] Start visualizer failed:', err);
    // Show error to user
    const audioStatus = document.getElementById('audio-status');
    if (audioStatus) {
      audioStatus.textContent = 'Error: Failed to start';
      audioStatus.className = 'error';
    }
  } finally {
    // Reset the flag whether successful or not
    isStarting = false;
  }
}

// Auto-start if requested
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('autostart') === 'true') {
  console.log('[Main] Auto-starting visualizer...');
  setTimeout(() => startVisualizer(), 100); // Small delay to ensure DOM is ready
}
