# Music Visualizer

A real-time audio-reactive music visualizer built with Three.js and WebGPU. Features three unique scenes with GPU-accelerated particle systems and post-processing effects.

## Features

- **Three Visualization Scenes**
  - **Linked Particles** - Interconnected particle network with dynamic links
  - **Instanced Points** - Flowing points along a Hilbert curve
  - **Skinning Points** - Animated character with point cloud overlay

- **Audio Reactivity** - Bass, mid, and high frequency response
- **Real-time Controls** - Adjust sensitivity, bloom, turbulence, and more
- **Spout Output** - Send visualization to OBS, Resolume, TouchDesigner (Windows only)

## Quick Start

### Browser Mode

```bash
npm install
npm start
```

Open http://localhost:port in your browser.

> **Note:** Browser version uses screen/tab sharing for audio. For system audio capture, use the Electron version.

### Electron Mode (Windows)

```bash
npm install
npm run electron
```

## Requirements

- Node.js 18+
- Modern browser with WebGPU support (Chrome 113+, Edge 113+)
- For Spout output: Windows 10/11

## Spout Output (Windows Only)

Spout allows you to send the visualization directly to other applications like OBS Studio, Resolume Arena, TouchDesigner, and other Spout-compatible software.

### Prerequisites

1. **CMake** - Download from https://cmake.org/download/
   - During installation, select "Add CMake to system PATH"

2. **Visual Studio Build Tools** - Download from https://visualstudio.microsoft.com/visual-cpp-build-tools/
   - Install "Desktop development with C++" workload
   - Include Windows 10/11 SDK

3. **Spout SDK** (optional) - For testing with SpoutReceiver
   - Download from https://github.com/leadedge/Spout2/releases

### Building the Native Module

After installing the prerequisites:

```bash
# Clean and rebuild
Remove-Item -Recurse -Force node_modules\electron-spout\build
npm run rebuild-spout
```

If successful, you'll see no errors and can run:

```bash
npm run electron
```

### Using Spout in the App

1. Start the Electron app: `npm run electron`
2. Select a scene
3. Open Settings panel
4. Find "Spout Output" folder
5. Check "Enable Spout"
6. Optionally change the sender name

The sender name identifies your visualization in receiving applications.

### Receiving in OBS Studio

1. Install OBS Spout plugin: https://github.com/leadedge/Spout-Plugin-for-OBS
2. In OBS, add a new source
3. Select "Spout Capture"
4. Choose your sender name (default: "Music Visualizer")

### Troubleshooting Spout

**"Spout not available" dialog**
- Ensure CMake is installed and in PATH
- Ensure Visual Studio Build Tools with C++ workload is installed
- Run `npm run rebuild-spout` from the project directory
- Check for build errors in the console

**Build errors about missing libraries**
- Install vcpkg: https://vcpkg.io/
- Run: `vcpkg install spout:x64-windows`
- Set `Spout_DIR` environment variable to vcpkg installed path

**OBS shows black screen**
- WebGPU may not support shared textures in offscreen mode
- The app automatically falls back to bitmap transfer
- This is slightly slower but works reliably

**Runtime library mismatch errors**
- The Spout static library requires `/MD` (MultiThreadedDLL)
- This is handled in CMakeLists.txt automatically

## Architecture

### Modular Design

The codebase is organized into focused modules under `src/`:

- **`src/core/`** - Rendering infrastructure shared by all entry points
  - `bootstrap.js` - Common initialization for browser and Electron
  - `renderer.js` - WebGPU setup, camera, post-processing
  - `animation.js` - Timing utilities
  - `constants.js` - Shared constants

- **`src/scenes/`** - Visualization scenes with shared utilities
  - `base.js` - Common scene components (background, lighting, camera positions)
  - `particles.js` - Linked particles scene
  - `points.js` - Instanced points scene
  - `skinning.js` - Skinning points scene
  - `registry.js` - Scene management and switching

- **`src/audio/`** - Audio processing
  - `capture.js` - Audio input handling and analysis
  - `uniforms.js` - TSL audio-reactive uniforms

- **`src/gui/`** - User interface
  - Settings panels with collapsible folders
  - Audio source selector (Electron mode)

- **`src/spout/`** - IPC synchronization
  - `sync.js` - Settings/audio/scene synchronization

- **`src/settings/`** - Configuration
  - `defaults.js` - Default settings values
  - `utils.js` - Settings serialization/deserialization

### Entry Points

Both `main.js` (browser) and `spout-renderer.js` (Electron) use:
- `src/core/bootstrap.js` for shared initialization
- `src/settings/utils.js` for settings serialization

## Project Structure

```
music_vis/
├── index.html              # Main app HTML
├── main.js                 # Browser entry point (~100 lines)
├── spout-output.html       # Spout window HTML
├── spout-renderer.js       # Electron/Spout entry point (~50 lines)
├── preload.js              # Electron IPC bridge
├── electron/
│   └── main.js             # Electron main process
├── src/
│   ├── audio/              # Audio processing
│   │   ├── capture.js
│   │   ├── uniforms.js
│   │   └── index.js
│   ├── core/               # Core rendering
│   │   ├── bootstrap.js    # Shared initialization
│   │   ├── renderer.js
│   │   ├── animation.js
│   │   ├── constants.js
│   │   └── index.js
│   ├── scenes/             # Visualization scenes
│   │   ├── base.js         # Scene utilities
│   │   ├── particles.js
│   │   ├── points.js
│   │   ├── skinning.js
│   │   ├── registry.js
│   │   └── index.js
│   ├── gui/                # User interface
│   │   ├── index.js
│   │   └── audio-selector.js
│   ├── settings/           # Configuration
│   │   ├── defaults.js
│   │   ├── utils.js        # Settings utilities
│   │   └── index.js
│   └── spout/              # Spout synchronization
│       ├── sync.js
│       └── index.js
├── models/                 # GLTF models for skinning scene
└── vcpkg/                  # Package manager for C++ dependencies
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Run in browser mode (port 3002) |
| `npm run dev` | Same as start |
| `npm run electron` | Run in Electron |
| `npm run rebuild-spout` | Compile Spout native module |

### Key Technologies

- **Three.js** - 3D rendering library
- **WebGPU** - Modern graphics API
- **TSL (Three.js Shading Language)** - Node-based shader programming
- **Electron** - Desktop app wrapper
- **Spout** - Windows inter-app video sharing

## Scene Controls

Each scene has unique adjustable parameters:

### Linked Particles
- Particle lifetime, size, spawn rate
- Link width, color variance
- Turbulence settings

### Instanced Points
- Point size, density
- Color settings

### Skinning Points
- Animation playback
- Point cloud density

### Global Settings
- Audio sensitivity (bass, mid, high)
- Bloom strength, threshold, radius
- Auto-rotate, rotation speed

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome 113+ | Full support |
| Edge 113+ | Full support |
| Firefox | WebGPU in development |
| Safari | WebGPU in development |

> **Note:** The browser version uses screen/tab sharing for audio capture. For system audio capture on Windows, use the Electron version.

Check WebGPU support: https://webgpureport.org/

## License

ISC

## Credits

- Three.js - https://threejs.org/
- Electron Spout - https://github.com/cnSchwarzer/electron-spout
- Spout SDK - https://github.com/leadedge/Spout2
