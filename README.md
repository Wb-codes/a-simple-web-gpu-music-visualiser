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

## Quick Start

```bash
npm install
npm start
```

Open http://localhost:8080 in your browser.

> **Note:** Uses screen/tab sharing for audio capture. Grant microphone permission when prompted.

## Requirements

- Node.js 18+
- Modern browser with WebGPU support (Chrome 113+, Edge 113+)

## Architecture

### Modular Design

The codebase is organized into focused modules under `src/`:

- **`src/core/`** - Rendering infrastructure
  - `bootstrap.js` - App initialization
  - `renderer.js` - WebGPU setup, camera, post-processing
  - `animation.js` - Timing utilities
  - `constants.js` - Shared constants
  - `animations.js` - Animation name mapping

- **`src/scenes/`** - Visualization scenes
  - `particles.js` - Linked particles scene
  - `skinning.js` - Animated model point cloud scene
  - `combi.js` - Combined particle emitter scene
  - `registry.js` - Scene management and switching

- **`src/audio/`** - Audio processing
  - `capture.js` - Audio input handling and analysis
  - `uniforms.js` - TSL audio-reactive uniforms
  - `reactive.js` - Audio calculation utilities

- **`src/gui/`** - User interface
  - `index.js` - Settings panels with collapsible folders
  - `fade-manager.js` - Auto-fade UI behavior
  - `audio-selector.js` - Audio source selection

- **`src/settings/`** - Configuration
  - `defaults.js` - Default settings values
  - `utils.js` - Settings serialization

- **`src/components/`** - Reusable components
  - `ParticleEmitter.js` - GPU compute particle system
  - `TransformManager.js` - Object transform controls
  - `Background.js` - Scene background mesh

- **`src/utils/`** - Utilities
  - `disposal.js` - Three.js object disposal helpers

## Project Structure

```
music_vis/
├── index.html           # Main app HTML
├── main.js              # Entry point
├── package.json         # Dependencies
├── src/
│   ├── audio/           # Audio processing
│   │   ├── capture.js
│   │   ├── uniforms.js
│   │   ├── reactive.js
│   │   └── index.js
│   ├── components/      # Reusable components
│   │   ├── ParticleEmitter.js
│   │   ├── TransformManager.js
│   │   └── Background.js
│   ├── core/            # Core rendering
│   │   ├── bootstrap.js
│   │   ├── renderer.js
│   │   ├── animation.js
│   │   ├── constants.js
│   │   ├── animations.js
│   │   └── index.js
│   ├── gui/             # User interface
│   │   ├── index.js
│   │   ├── fade-manager.js
│   │   └── audio-selector.js
│   ├── scenes/          # Visualization scenes
│   │   ├── particles.js
│   │   ├── skinning.js
│   │   ├── combi.js
│   │   ├── registry.js
│   │   ├── base.js
│   │   └── index.js
│   ├── settings/        # Configuration
│   │   ├── defaults.js
│   │   ├── utils.js
│   │   └── index.js
│   └── utils/           # Utilities
│       └── disposal.js
└── models/              # GLTF models
    └── gltf/
        └── skinning/    # Models for skinning scene
            ├── Michelle.glb
            ├── boltvis.glb
            └── cliptest.glb
```

## Available Models

The skinning scene includes these pre-loaded models:

| Model | Type | Description |
|-------|------|-------------|
| Michelle | Animated | Human character with dance animations |
| Boltvis | Static | Creature model (no animations) |
| cliptest | Static | Test model (no animations) |

To add new models, place `.glb` files in `models/gltf/skinning/` and add them to `AVAILABLE_MODELS` in `src/scenes/skinning.js`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start development server (port 8080) |
| `npm run dev` | Same as start |

## Key Technologies

- **Three.js r179** - 3D rendering library (WebGPU build)
- **WebGPU** - Modern graphics API
- **TSL (Three.js Shading Language)** - Node-based shader programming
- **ES6 Modules** - Native JavaScript modules

## Scene Controls

### Linked Particles
- Particle lifetime, size, spawn rate
- Link width, color variance
- Turbulence settings (bass, mid frequencies)
- Radius settings (bass-driven)

### Skinning Points
- Animation selection dropdown
- Bloom intensity (audio-reactive)
- Auto-rotation

### Global Settings
- Audio sensitivity (bass, mid, high)
- Bloom strength, threshold, radius
- Auto-rotate, rotation speed
- Green screen toggle

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome 113+ | Full support |
| Edge 113+ | Full support |
| Firefox Nightly | WebGPU experimental |
| Safari Technology Preview | WebGPU experimental |

Check WebGPU support: https://webgpureport.org/

## Adding New Scenes

1. Create a new file in `src/scenes/myScene.js`
2. Export `initMyScene()`, `updateMyScene()`, `cleanupMyScene()`
3. Register in `src/scenes/registry.js`
4. Add scene name to `SCENE_NAMES` in `src/core/constants.js`
5. Create GUI in `src/gui/index.js`/e

## Development Notes

- Uses native ES6 modules (no bundler required)
- TSL shaders are compiled at runtime by Three.js
- Storage buffers (`instancedArray`) are GPU-managed
- Memory cleanup is handled in scene `cleanup()` functions

## License

ISC

## Credits

- Three.js - https://threejs.org/
- Michelle model - three.js examples
