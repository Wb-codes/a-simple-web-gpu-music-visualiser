import {
  float, vec3, vec4, vec2, Fn,
  sin, cos, tan, abs, sqrt, pow, exp, log,
  min, max, clamp, mix, fract, floor, ceil,
  hash, positionLocal, timerLocal, uniform
} from 'three/tsl';

// Simple hash-based noise that works in TSL
// hash() returns a float, so we use it to create procedural patterns
const hashNoise3D = (pos) => {
  const p = pos.mul(50);
  const fx = floor(p.x);
  const fy = floor(p.y);
  const fz = floor(p.z);
  const h = hash(vec3(fx, fy, fz));
  return h.mul(2).sub(1);
};

// Different implementations for Simplex vs Perlin
export const SimplexNoise3D = Fn((pos = positionLocal, scale = float(1), time = float(0)) => {
  // Simple value noise
  const p = pos.mul(scale).add(time.mul(0.1));
  const ip = floor(p);
  const fp = fract(p);
  const u = fp.mul(fp).mul(float(3).sub(fp.mul(float(2))));
  const a = hash(ip);
  const b = hash(ip.add(vec3(1, 0, 0)));
  const c = hash(ip.add(vec3(0, 1, 0)));
  const d = hash(ip.add(vec3(1, 1, 0)));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y).mul(2).sub(1);
});

export const PerlinNoise3D = Fn((pos = positionLocal, scale = float(1), time = float(0)) => {
  // Classic Perlin with smoother interpolation
  const p = pos.mul(scale).add(time.mul(0.1));
  const ip = floor(p);
  const fp = fract(p);
  const u = fp.mul(fp).mul(fp.mul(float(3)).sub(float(2)));
  const a = hash(ip);
  const b = hash(ip.add(vec3(1, 0, 0)));
  const c = hash(ip.add(vec3(0, 1, 0)));
  const d = hash(ip.add(vec3(1, 1, 0)));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
});

export const VoronoiNoise = Fn((pos = positionLocal, scale = float(1)) => {
  const p = pos.mul(scale);
  const ip = floor(p);
  const fp = fract(p);
  let minDist = float(10);
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        const neighbor = vec3(float(x), float(y), float(z));
        const point = hash(ip.add(neighbor));
        const diff = neighbor.add(point.sub(fp));
        const dist = length(diff);
        minDist = min(minDist, dist);
      }
    }
  }
  return minDist;
});

export const FractalBrownianMotion = Fn((pos = positionLocal, octaves = float(4), persistence = float(0.5), lacunarity = float(2)) => {
  let total = float(0);
  let frequency = float(1);
  let amplitude = float(1);
  let maxValue = float(0);
  for (let i = 0; i < octaves; i++) {
    total = total.add(hashNoise3D(pos.mul(frequency)).mul(amplitude));
    maxValue = maxValue.add(amplitude);
    amplitude = amplitude.mul(persistence);
    frequency = frequency.mul(lacunarity);
  }
  return total.div(maxValue.add(0.001));
});

export const WaveField = Fn((pos = positionLocal, frequency = float(1), amplitude = float(1), speed = float(1)) => {
  const t = timerLocal.mul(speed);
  return sin(pos.x.mul(frequency).add(t))
    .add(sin(pos.y.mul(frequency).add(t.mul(0.5))))
    .add(sin(pos.z.mul(frequency).add(t.mul(0.3))))
    .mul(amplitude);
});

export const Ripple = Fn((pos = positionLocal, center = vec3(0, 0, 0), frequency = float(10), amplitude = float(0.5), speed = float(2)) => {
  const t = timerLocal.mul(speed);
  const dist = length(pos.sub(center));
  return sin(dist.mul(frequency).sub(t)).mul(amplitude).div(dist.add(float(1)));
});

export const GradientLinear = Fn((colorA, colorB, t) => {
  return mix(colorA, colorB, t);
});

export const GradientRadial = Fn((colorCenter, colorEdge, uv) => {
  const dist = length(uv.sub(vec2(0.5, 0.5))).mul(2);
  return mix(colorCenter, colorEdge, clamp(dist, 0, 1));
});

// Animated spectral gradient that cycles over time
export const GradientSpectral = Fn(() => {
  const t = timerLocal.mul(0.5);
  const r = sin(t.add(float(0))).mul(0.5).add(0.5);
  const g = sin(t.add(float(2.094))).mul(0.5).add(0.5);
  const b = sin(t.add(float(4.189))).mul(0.5).add(0.5);
  return vec3(r, g, b);
});

// Static spectral gradient based on input value
export const GradientSpectralStatic = Fn((t) => {
  const tVal = t.add(float(0.5)).fract().mul(6.283);
  const r = sin(tVal).mul(0.5).add(0.5);
  const g = sin(tVal.add(float(2.094))).mul(0.5).add(0.5);
  const b = sin(tVal.add(float(4.189))).mul(0.5).add(0.5);
  return vec3(r, g, b);
});

export const DisplacementMap = Fn((pos = positionLocal, normal, strength = float(0.1), time = float(0)) => {
  const displacement = hashNoise3D(pos.add(time)).mul(strength);
  return pos.add(normal.mul(displacement));
});

export const ColorUtils = {
  hsvToRgb: Fn((h, s, v) => {
    const c = vec3(h, h, h);
    const k = vec4(1, 2, 3, 0).add(float(6).mul(h));
    return v.sub(v.mul(s).mul(abs(fract(k).sub(0.5))));
  }),
  
  rgbToHsv: Fn((rgb) => {
    const maxC = max(max(rgb.r, rgb.g), rgb.b);
    const minC = min(min(rgb.r, rgb.g), rgb.b);
    const delta = maxC.sub(minC);
    const s = delta.div(maxC.add(0.00001));
    const v = maxC;
    const h = float(0);
    return vec3(h, s, v);
  }),
  
  brightness: Fn((rgb) => {
    return rgb.r.mul(0.299).add(rgb.g.mul(0.587)).add(rgb.b.mul(0.114));
  }),
  
  invert: Fn((rgb) => {
    return float(1).sub(rgb);
  }),
  
  saturate: Fn((rgb, amount = float(1)) => {
    const gray = rgb.r.mul(0.299).add(rgb.g.mul(0.587)).add(rgb.b.mul(0.114));
    return mix(vec3(gray), rgb, amount);
  })
};

export const MathUtils = {
  remap: Fn((value, inMin, inMax, outMin, outMax) => {
    return outMin.add(outMax.sub(outMin).mul(value.sub(inMin).div(inMax.sub(inMin))));
  }),
  
  smoothstep: Fn((edge0, edge1, x) => {
    const t = clamp(x.sub(edge0).div(edge1.sub(edge0)), 0, 1);
    return t.mul(t).mul(float(3).sub(t.mul(float(2))));
  }),
  
  step: Fn((edge, x) => {
    return clamp(x.sub(edge).add(0.5).sign(), 0, 1);
  }),
  
  lerp: Fn((a, b, t) => {
    return a.add(b.sub(a).mul(t));
  })
};

export const initProceduralEffect = (renderer, scene, camera, options = {}) => {
  return {
    name: 'procedural',
    update: (delta) => {}
  };
};
