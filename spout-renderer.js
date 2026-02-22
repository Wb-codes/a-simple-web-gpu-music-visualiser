/**
 * @module spout-renderer
 * @description Spout window renderer - receives sync from main window.
 * Uses shared bootstrap initialization with sync listeners.
 */

import { initVisualization } from './src/core/bootstrap.js';
import { createSettings, deserializeSettings } from './src/settings/defaults.js';
import { setupSpoutSyncListeners, isSpoutSyncAvailable } from './src/spout/sync.js';

const settings = createSettings();

/**
 * Initialize the spout renderer.
 */
async function init() {
    // Setup spout sync listeners first
    if (isSpoutSyncAvailable()) {
        setupSpoutSyncListeners({
            settings,
            onSettingsUpdate: (newSettings) => {
                deserializeSettings(settings, newSettings);
            },
            onSceneChange: async (sceneType) => {
                // Reinitialize with new scene
                await initVisualization({
                    settings,
                    sceneType,
                    rendererConfig: {
                        width: 1920,
                        height: 1080
                    }
                });
            }
        });
    }

    // Initialize with default scene
    await initVisualization({
        settings,
        sceneType: 'particles',
        rendererConfig: {
            width: 1920,
            height: 1080
        }
    });

    console.log('Spout renderer initialized');
}

// Initialize on load
init().catch(err => {
    console.error('Spout renderer init error:', err);
});
