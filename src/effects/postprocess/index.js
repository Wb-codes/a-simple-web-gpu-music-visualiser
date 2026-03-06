import {
  float, vec2, vec3, vec4, Fn,
  sin, cos, tan, abs, sqrt, pow, exp, log,
  min, max, clamp, mix, fract, floor,
  uniform, timerLocal
} from 'three/tsl';
import { FullScreenQuad } from 'three/webgpu';
import * as THREE from 'three';

export class PostProcessEffect {
  constructor(material) {
    this.material = material;
    this.fsQuad = new FullScreenQuad(material);
  }

  render(renderer, scene, camera) {
    renderer.setRenderTarget(null);
    this.fsQuad.render(renderer);
  }

  setSize(width, height) {
    if (this.material.uniforms?.resolution) {
      this.material.uniforms.resolution.value.set(width, height);
    }
  }

  dispose() {
    this.fsQuad.dispose();
    this.material.dispose();
  }
}

export const BloomEffect = (inputTexture, options = {}) => {
  const threshold = uniform(options.threshold || 0.8);
  const intensity = uniform(options.intensity || 1.0);
  const resolution = uniform(options.resolution || vec2(1920, 1080));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: inputTexture },
      threshold,
      intensity,
      resolution
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float threshold;
      uniform float intensity;
      uniform vec2 resolution;
      varying vec2 vUv;

      void main() {
        vec4 color = texture2D(tDiffuse, vUv);
        float brightness = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
        
        vec3 bloom = vec3(0.0);
        float total = 0.0;
        
        for (float x = -4.0; x <= 4.0; x += 1.0) {
          for (float y = -4.0; y <= 4.0; y += 1.0) {
            vec2 offset = vec2(x, y) / resolution * 2.0;
            vec4 sample = texture2D(tDiffuse, vUv + offset);
            float b = dot(sample.rgb, vec3(0.2126, 0.7152, 0.0722));
            if (b > threshold) {
              float weight = 1.0 - length(vec2(x, y)) / 5.66;
              bloom += sample.rgb * max(0.0, b - threshold) * weight;
              total += weight;
            }
          }
        }
        
        if (total > 0.0) bloom /= total;
        
        gl_FragColor = color + bloom * intensity;
      }
    `
  });

  return new PostProcessEffect(material);
};

export const ChromaticAberrationEffect = (inputTexture, options = {}) => {
  const amount = uniform(options.amount || 0.005);
  
  const material = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: inputTexture },
      amount
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float amount;
      varying vec2 vUv;

      void main() {
        vec2 dir = vUv - vec2(0.5);
        float dist = length(dir);
        vec2 offset = dir * dist * amount;
        
        float r = texture2D(tDiffuse, vUv + offset).r;
        float g = texture2D(tDiffuse, vUv).g;
        float b = texture2D(tDiffuse, vUv - offset).b;
        
        gl_FragColor = vec4(r, g, b, 1.0);
      }
    `
  });

  return new PostProcessEffect(material);
};

export const BlurEffect = (inputTexture, options = {}) => {
  const resolution = uniform(options.resolution || vec2(1920, 1080));
  const strength = uniform(options.strength || 1.0);
  
  const material = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: inputTexture },
      resolution,
      strength
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform vec2 resolution;
      uniform float strength;
      varying vec2 vUv;

      void main() {
        vec2 texelSize = strength / resolution;
        vec4 color = vec4(0.0);
        
        for (float x = -2.0; x <= 2.0; x += 1.0) {
          for (float y = -2.0; y <= 2.0; y += 1.0) {
            vec2 offset = vec2(x, y) * texelSize;
            color += texture2D(tDiffuse, vUv + offset);
          }
        }
        
        color /= 25.0;
        gl_FragColor = color;
      }
    `
  });

  return new PostProcessEffect(material);
};

export const VignetteEffect = (inputTexture, options = {}) => {
  const intensity = uniform(options.intensity || 0.5);
  const smoothness = uniform(options.smoothness || 0.5);
  
  const material = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: inputTexture },
      intensity,
      smoothness
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float intensity;
      uniform float smoothness;
      varying vec2 vUv;

      void main() {
        vec4 color = texture2D(tDiffuse, vUv);
        vec2 center = vUv - vec2(0.5);
        float dist = length(center);
        float vignette = smoothstep(0.5, 0.5 - smoothness, dist);
        vignette = mix(1.0, vignette, intensity);
        gl_FragColor = color * vignette;
      }
    `
  });

  return new PostProcessEffect(material);
};

export const FilmGrainEffect = (inputTexture, options = {}) => {
  const intensity = uniform(options.intensity || 0.1);
  const time = uniform(0);
  
  const material = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: inputTexture },
      intensity,
      time
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float intensity;
      uniform float time;
      varying vec2 vUv;

      float random(vec2 co) {
        return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
      }

      void main() {
        vec4 color = texture2D(tDiffuse, vUv);
        float noise = random(vUv + time) * 2.0 - 1.0;
        color.rgb += noise * intensity;
        gl_FragColor = color;
      }
    `
  });

  const effect = new PostProcessEffect(material);
  effect.update = (delta) => {
    time.value += delta;
  };
  
  return effect;
};

export const ScanlinesEffect = (inputTexture, options = {}) => {
  const frequency = uniform(options.frequency || 800);
  const intensity = uniform(options.intensity || 0.1);
  const time = uniform(0);
  
  const material = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: inputTexture },
      frequency,
      intensity,
      time
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float frequency;
      uniform float intensity;
      uniform float time;
      varying vec2 vUv;

      void main() {
        vec4 color = texture2D(tDiffuse, vUv);
        float scanline = sin(vUv.y * frequency + time * 2.0) * 0.5 + 0.5;
        color.rgb -= scanline * intensity;
        gl_FragColor = color;
      }
    `
  });

  const effect = new PostProcessEffect(material);
  effect.update = (delta) => {
    time.value += delta;
  };
  
  return effect;
};

export const ColorGradingEffect = (inputTexture, options = {}) => {
  const exposure = uniform(options.exposure || 1.0);
  const contrast = uniform(options.contrast || 1.0);
  const saturation = uniform(options.saturation || 1.0);
  const temperature = uniform(options.temperature || 0);
  
  const material = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: inputTexture },
      exposure,
      contrast,
      saturation,
      temperature
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float exposure;
      uniform float contrast;
      uniform float saturation;
      uniform float temperature;
      varying vec2 vUv;

      void main() {
        vec4 color = texture2D(tDiffuse, vUv);
        
        color.rgb *= exposure;
        
        color.rgb = (color.rgb - 0.5) * contrast + 0.5;
        
        float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
        color.rgb = mix(vec3(gray), color.rgb, saturation);
        
        color.r += temperature * 0.1;
        color.b -= temperature * 0.1;
        
        color.rgb = clamp(color.rgb, 0.0, 1.0);
        gl_FragColor = color;
      }
    `
  });

  return new PostProcessEffect(material);
};

export const initPostProcessEffect = (renderer, scene, camera, options = {}) => {
  return {
    name: 'postprocess',
    update: (delta) => {}
  };
};

