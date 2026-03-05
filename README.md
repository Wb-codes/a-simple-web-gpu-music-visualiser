# Music Visualizer

A real-time audio-reactive music visualizer built with Three.js and WebGPU. Features three unique scenes with GPU-accelerated particle systems and post-processing effects.

## Features

- **Three Visualization Scenes**
  - **Linked Particles** - Interconnected particle network with dynamic links
  - **Skinning Points** - Animated character rendered as audio-reactive point cloud
  - **Particle Combi** - Combined scene with transformable particle emitters

- **Audio Reactivity** - Bass, mid, and high frequency response
- **Real-time Controls** - Adjust sensitivity, bloom, turbulence, and more
- **WebGPU Powered** - Modern GPU rendering with compute shaders
- **Auto-Save Settings** - Configuration persists across sessions
- **Model Auto-Detection** - Drop `.glb` files for instant use

## Quick Start

```bash
npm install
npm start
```

Open http://localhost:8080 in your browser and click "Start Visualizer". Grant microphone permission when prompted to enable audio reactivity.

## Usage

### 1. Start the Application

After installing dependencies, start the development server:

```bash
npm start
```

Or use the dev command:

```bash
npm run dev
```

The server runs on **port 8080** by default. Open http://localhost:8080 in a supported browser.

### 2. Grant Audio Permission

When you click "Start Visualizer", the browser will request microphone permission:

1. Click "Allow" when prompted for microphone access
2. The visualizer will analyze audio in real-time
3. Play music or use system audio to see reactive effects

> **Note:** The visualizer captures audio input from your default recording device (usually your microphone). Use a virtual audio cable or system audio capture to visualize music playing on your computer.

### 3. Switch Between Scenes

Use the scene selector dropdown (top right corner) to change between visualization scenes:

- **Linked Particles** - Classic particle network with bloom effects
- **Skinning Points** - Animated 3D models rendered as point clouds
- **Particle Combi** - Multi-emitter particle system with transform controls

### 4. Adjust Settings

All settings are accessed via the collapsible control panel (fades after 2 seconds, hover to show). Settings are auto-saved to localStorage.

#### Common Settings

| Setting | Description | Default Range |
|---------|-------------|---------------|
| **Audio Sensitivity** | Bass/Mid/High frequency reactivity | 0-100 |
| **Bloom Strength** | Post-processing glow intensity | 0-3 |
| **Bloom Threshold** | Minimum brightness for bloom | 0-1 |
| **Auto-Rotate** | Enable camera rotation | Toggle |
| **Rotation Speed** | Rotation speed when enabled | 0-2 |

#### Scene-Specific Settings

**Linked Particles:**
- Particle lifetime, size, spawn rate
- Link width and color variance
- Turbulence (bass and mid frequency driven)
- Radius expansion on bass hits

**Skinning Points:**
- Model selection (auto-detected from `models/gltf/skinning/`)
- Animation selection (for models with animations)
- Bloom intensity (audio-reactive)
- Auto-rotation toggle

**Particle Combi:**
- Multiple particle emitters with position/rotation controls
- Instance count and transform settings
- Individual emitter audio reactivity

### 5. Keyboard Shortcuts

No keyboard shortcuts are configured. Use the GUI controls for all interactions.

### 6. OBS Browser Source Mode

The visualizer supports OBS Studio integration. Use these URL parameters:

```
http://localhost:8080?obs=true&audio=dummy
```

- `obs=true` - Enables dummy audio mode (no permission prompt)
- `audio=dummy` - Tests visualizer without real audio input

Perfect for streaming applications where you don't want a permission dialog.

## Requirements

### System Requirements

- **Node.js**: Version 18 or higher
- **Browser**: Modern browser with WebGPU support
  - Chrome 113+ (recommended)
  - Edge 113+
  - Firefox Nightly (experimental WebGPU)
  - Safari Technology Preview (experimental WebGPU)

### Browser Compatibility

| Browser | WebGPU Status | Tested |
|---------|---------------|--------|
| Chrome 113+ | ✅ Full support | ✅ Yes |
| Edge 113+ | ✅ Full support | ✅ Yes |
| Firefox Nightly | ⚠️ Experimental | ❌ No |
| Safari TP | ⚠️ Experimental | ❌ No |

Check WebGPU support: https://webgpureport.org/

## Adding Custom Models

The skinning scene automatically detects `.glb` (glTF Binary) files placed in the directory:

```
models/gltf/skinning/
```

### How to Add Models

1. Place your `.glb` files in `models/gltf/skinning/`
2. Refresh the browser
3. Models appear in the **Model** dropdown in the settings panel
4. Select a model to load it

### Model Classification

Models are automatically classified after loading:
- **Animated** - Models with animations (shows animation picker in settings)
- **Static** - Models without animations (rendered as static point clouds)

Both types work with the audio-reactive point cloud renderer.

### Recommended Models

- Use models with good vertex distribution for best point cloud effects
- Keep polygon count reasonable (under 100k triangles recommended)
- Models with skeleton/rigging animate more smoothly
- Test multiple models to find visually interesting ones

## Troubleshooting

### "WebGPU not supported" Error

**Problem:** Visualizer fails to load with WebGPU error.

**Solutions:**
1. Update Chrome/Edge to the latest version (minimum 113+)
2. Enable WebGPU flags in `chrome://flags` (if needed):
   - `chrome://flags/#enable-unsafe-webgpu`
3. Try a different browser (Chrome recommended)
4. Check WebGPU report: https://webgpureport.org/

### No Audio Reactivity

**Problem:** Visualizer runs but particles don't respond to audio.

**Solutions:**
1. Verify microphone permission was granted (check browser address bar icon)
2. Increase **Audio Sensitivity** settings (bass, mid, high sliders)
3. Play audio loud enough to register
4. Check browser console (F12) for audio capture errors
5. Ensure your default recording device picks up audio

### Microphone Permission Denied

**Problem:** Browser blocks microphone access.

**Solutions:**
1. Click the lock/icon in address bar > Site settings > Reset permissions
2. Refresh the page and try again
3. Check OS privacy settings for microphone access
4. Use dummy audio mode for testing: `?audio=dummy`

### Visualizer Not Starting

**Problem:** Clicking "Start Visualizer" does nothing.

**Solutions:**
1. Open browser console (F12) for error messages
2. Check that port 8080 is available (no other service using it)
3. Verify Node.js is installed: `node --version`
4. Reinstall dependencies: `rm -rf node_modules && npm install`

### Settings Not Persisting

**Problem:** Settings reset on page refresh.

**Solutions:**
1. Check if localStorage is enabled in your browser
2. Ensure cookies/localStorage not blocked
3. Open console for "Failed to save settings" errors

### Performance Issues

**Problem:** Low frame rate or stuttering.

**Solutions:**
1. Reduce **Particle Count** settings
2. Lower **Bloom Strength** and **Bloom Radius**
3. Close other browser tabs/applications
4. Disable GPU acceleration in other browser tabs
5. Check GPU drivers are up to date

## Development

### Architecture

Modular ES6 module architecture with no build step:

```
src/
├── audio/           # Audio capture and reactivity
│   ├── capture.js     # Web Audio API setup
│   ├── uniforms.js    # TSL audio-reactive uniforms
│   └── reactive.js    # Audio calculation utilities
├── components/      # Reusable GPU components
│   ├── ParticleEmitter.js    # GPU compute particle system
│   ├── TransformManager.js   # Object transform controls
│   └── Background.js         # Scene background mesh
├── core/            # Rendering infrastructure
│   ├── bootstrap.js   # App initialization
│   ├── renderer.js    # WebGPU renderer setup
│   ├── constants.js   # Scene names and constants
│   └── animation.js   # Timing utilities
├── gui/             # User interface
│   ├── index.js        # Settings panels with folders
│   └── fade-manager.js # Auto-fade UI behavior
├── scenes/          # Visualization scenes
│   ├── particles.js    # Linked particles scene
│   ├── skinning.js     # Model point cloud scene
│   ├── combi.js        # Combined particle emitter scene
│   └── registry.js     # Scene management and switching
└── settings/        # Configuration
    └── defaults.js     # Default settings values
```

### Tech Stack

- **Three.js r179** - 3D rendering (WebGPU build)
- **WebGPU** - Modern graphics API
- **TSL** - Three.js Shading Language (node-based shaders)
- **ES6 Modules** - Native JavaScript modules (no bundler)
- **Web Audio API** - Real-time audio analysis

### Adding a New Scene

1. Create scene file: `src/scenes/myScene.js`

```javascript
import * as THREE from 'three/webgpu';
import { audioBass } from '../audio/uniforms.js';

export const sceneState = {
  scene: null,
  initialized: false
};

export async function initScene(renderer, settings) {
  const scene = new THREE.Scene();
  // Add scene setup code
  return scene;
}

export function updateScene(settings, audio) {
  // Update scene per frame
}

export function cleanupScene() {
  // Clean up resources
  sceneState.initialized = false;
}
```

2. Register in `src/scenes/registry.js`

3. Add scene name to `SCENE_NAMES` in `src/core/constants.js`

4. Create GUI in `src/gui/index.js`

### Coding Guidelines

- **Imports**: ES6 modules with `.js` extension (required for browser)
- **Naming**: camelCase functions, PascalCase exports, kebab-case files
- **Shaders**: TSL node-based only (no raw WGSL)
- **Error Handling**: try/catch with console.error, continue on non-critical errors
- **File Limit**: Keep files under 200 lines
- **Debug**: Use `console.log('[Module] message')` for debugging

## Scripts

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm start` | Start development server (port 8080) |
| `npm run dev` | Same as `npm start` |

## License

ISC

## Credits

- Three.js - https://threejs.org/
- Michelle model - three.js examples
- WebGPU - https://webgpu.github.io/webgpu-samples/
