/**
 * @module spout-renderer
 * @description Spout window renderer - receives sync from main window.
 * Uses shared bootstrap initialization with sync listeners.
 */

import { initVisualization } from './src/core/bootstrap.js';
import { createSettings } from './src/settings/defaults.js';
import { deserializeSettings } from './src/settings/utils.js';
import { setupSpoutSyncListeners, isSpoutSyncAvailable } from './src/spout/sync.js';

const settings = createSettings();

/**
 * Initialize the spout renderer.
 */
async function init() {
    console.log('[Spout] Initializing...');
    
    // Setup spout sync listeners first
    if (isSpoutSyncAvailable()) {
        setupSpoutSyncListeners({
            settings,
            onSettingsUpdate: (newSettings) => {
                deserializeSettings(settings, newSettings);
            },
            onSceneChange: async (sceneType) => {
                console.log('[Spout] Scene change to:', sceneType);
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

    // Initialize with default scene immediately
    await initVisualization({
        settings,
        sceneType: 'particles',
        rendererConfig: {
            width: 1920,
            height: 1080
        }
    });

    console.log('[Spout] Renderer initialized');
}

// Initialize on load
init().catch(err => {
    console.error('[Spout] Init error:', err);
});
