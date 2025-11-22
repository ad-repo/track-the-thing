/**
 * Texture Generator Service
 * Generates canvas-based texture patterns for UI elements
 */

export interface TextureOptions {
  scale: number;        // 0.5-2.0 (pattern size)
  opacity: number;      // 0-1
  density: number;      // 0.1-1.0 (pattern frequency)
  angle: number;        // 0-360 degrees
  blendMode: string;    // CSS blend mode
  colorTint?: string;   // Optional color overlay
  seed?: number;        // Random seed for reproducible patterns
}

export type PatternName =
  | 'noise'
  | 'rusted-metal'
  | 'wood-oak'
  | 'water-ocean'
  | 'water-shallow'
  | 'water-pool'
  | 'water-deep'
  | 'dots'
  | 'lines'
  | 'grid'
  | 'wood'
  | 'water'
  | 'paper'
  | 'stone'
  | 'rust'
  | 'concrete'
  | 'brushed-metal'
  | 'carbon-fiber'
  | 'chain-link'
  | 'diamond-plate'
  | 'rivets'
  | 'corrugated'
  | 'cross-hatch'
  | 'hexagons'
  | 'waves'
  | 'perlin'
  | 'random';

const DEFAULT_OPTIONS: TextureOptions = {
  scale: 1.0,
  opacity: 0.2,
  density: 0.5,
  angle: 0,
  blendMode: 'multiply',
  seed: Date.now(),
};

// Cache for generated textures
const textureCache = new Map<string, string>();

/**
 * Seeded random number generator for reproducible patterns
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

/**
 * Perlin Noise implementation for organic textures
 */
class PerlinNoise {
  private permutation: number[];
  private p: number[];

  constructor(seed: number) {
    const random = new SeededRandom(seed);
    
    this.permutation = [];
    for (let i = 0; i < 256; i++) {
      this.permutation[i] = i;
    }
    
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(random.next() * (i + 1));
      [this.permutation[i], this.permutation[j]] = [this.permutation[j], this.permutation[i]];
    }
    
    this.p = [...this.permutation, ...this.permutation];
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number): number {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  noise(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    
    x -= Math.floor(x);
    y -= Math.floor(y);
    
    const u = this.fade(x);
    const v = this.fade(y);
    
    const a = this.p[X] + Y;
    const b = this.p[X + 1] + Y;
    
    return this.lerp(v,
      this.lerp(u, this.grad(this.p[a], x, y), this.grad(this.p[b], x - 1, y)),
      this.lerp(u, this.grad(this.p[a + 1], x, y - 1), this.grad(this.p[b + 1], x - 1, y - 1))
    );
  }

  octaveNoise(x: number, y: number, octaves: number, persistence: number): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;
    
    for (let i = 0; i < octaves; i++) {
      total += this.noise(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }
    
    return total / maxValue;
  }
}

/**
 * Generate a cache key for a texture
 */
function getCacheKey(pattern: PatternName, options: TextureOptions): string {
  return `${pattern}-${options.scale}-${options.opacity}-${options.density}-${options.angle}-${options.seed}`;
}

/**
 * Create a canvas element
 */
function createCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }
  return [canvas, ctx];
}

/**
 * Apply rotation to canvas
 */
function applyRotation(ctx: CanvasRenderingContext2D, angle: number, size: number) {
  if (angle !== 0) {
    ctx.translate(size / 2, size / 2);
    ctx.rotate((angle * Math.PI) / 180);
    ctx.translate(-size / 2, -size / 2);
  }
}

/**
 * Noise/Grain pattern
 */
function generateNoise(size: number, options: TextureOptions): string {
  const [canvas, ctx] = createCanvas(size);
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;
  const random = new SeededRandom(options.seed || Date.now());

  const threshold = options.density;
  
  for (let i = 0; i < data.length; i += 4) {
    if (random.next() < threshold) {
      const value = Math.floor(random.next() * 255);
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = Math.floor(options.opacity * 255);
    } else {
      data[i + 3] = 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL();
}

/**
 * Rusted Metal Texture
 */
function generateRustedMetal(size: number, options: TextureOptions): string {
  const [canvas, ctx] = createCanvas(size);
  applyRotation(ctx, options.angle, size);
  
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;
  
  const perlin = new PerlinNoise(options.seed || Date.now());
  const random = new SeededRandom(options.seed || Date.now());
  
  const noiseScale = 0.01 / options.scale;
  const detailScale = 0.05 / options.scale;
  
  const rustColors = [
    { r: 150, g: 100, b: 70 },
    { r: 165, g: 110, b: 80 },
    { r: 180, g: 120, b: 90 },
    { r: 170, g: 115, b: 85 },
    { r: 160, g: 105, b: 75 },
    { r: 155, g: 100, b: 72 },
  ];
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      
      const baseNoise = perlin.octaveNoise(x * noiseScale, y * noiseScale, 4, 0.5);
      const detailNoise = perlin.octaveNoise(x * detailScale, y * detailScale, 6, 0.6);
      const turbulence = perlin.octaveNoise(x * 0.02, y * 0.02, 3, 0.4);
      
      const combined = (baseNoise * 0.5 + detailNoise * 0.3 + turbulence * 0.2 + 1) / 2;
      
      const colorIndex = Math.floor(combined * rustColors.length * options.density);
      const safeIndex = Math.min(Math.max(0, colorIndex), rustColors.length - 1);
      const baseColor = rustColors[safeIndex];
      
      const variation = (random.next() - 0.5) * 15 * options.density;
      
      let r = Math.floor(baseColor.r + variation + detailNoise * 20);
      let g = Math.floor(baseColor.g + variation + detailNoise * 15);
      let b = Math.floor(baseColor.b + variation + detailNoise * 10);
      
      r = Math.min(255, Math.max(0, r));
      g = Math.min(255, Math.max(0, g));
      b = Math.min(255, Math.max(0, b));
      
      const textureIntensity = Math.abs(combined - 0.5) * 1.2;
      
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = Math.floor(options.opacity * textureIntensity * 255);
      
      if (random.next() < 0.05 * options.density) {
        const darken = random.next() * 0.6;
        data[idx] = Math.floor(data[idx] * darken);
        data[idx + 1] = Math.floor(data[idx + 1] * darken);
        data[idx + 2] = Math.floor(data[idx + 2] * darken);
        data[idx + 3] = Math.floor(options.opacity * 255);
      }
      
      if (random.next() < 0.02 * options.density) {
        const brighten = 1.3 + random.next() * 0.4;
        data[idx] = Math.min(255, Math.floor(data[idx] * brighten));
        data[idx + 1] = Math.min(255, Math.floor(data[idx + 1] * brighten));
        data[idx + 2] = Math.min(255, Math.floor(data[idx + 2] * brighten));
        data[idx + 3] = Math.floor(options.opacity * 255);
      }
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL();
}

/**
 * Oak Wood Texture
 */
function generateWoodOak(size: number, options: TextureOptions): string {
  const [canvas, ctx] = createCanvas(size);
  applyRotation(ctx, options.angle, size);
  
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;
  
  const perlin = new PerlinNoise(options.seed || Date.now());
  const random = new SeededRandom(options.seed || Date.now());
  
  const baseColor = { r: 200, g: 175, b: 145 };
  const darkGrain = { r: 175, g: 150, b: 120 };
  const lightHighlight = { r: 215, g: 190, b: 160 };
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      
      const grainPattern = Math.sin(x * 0.02 / options.scale + perlin.octaveNoise(x * 0.005, y * 0.005, 4, 0.5) * 10);
      const variation = (grainPattern + 1) / 2;
      
      let r = baseColor.r + (darkGrain.r - baseColor.r) * variation * options.density;
      let g = baseColor.g + (darkGrain.g - baseColor.g) * variation * options.density;
      let b = baseColor.b + (darkGrain.b - baseColor.b) * variation * options.density;
      
      if (variation > 0.7) {
        r += (lightHighlight.r - r) * 0.3;
        g += (lightHighlight.g - g) * 0.3;
        b += (lightHighlight.b - b) * 0.3;
      }
      
      const noise = (random.next() - 0.5) * 8 * options.density;
      
      const grainIntensity = Math.abs(variation - 0.5) * 1.0;
      
      data[idx] = Math.min(255, Math.max(0, Math.floor(r + noise)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.floor(g + noise)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.floor(b + noise)));
      data[idx + 3] = Math.floor(options.opacity * grainIntensity * 255);
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL();
}

/**
 * Ocean Water Texture
 */
function generateWaterOcean(size: number, options: TextureOptions): string {
  const [canvas, ctx] = createCanvas(size);
  applyRotation(ctx, options.angle, size);
  
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;
  
  const perlin = new PerlinNoise(options.seed || Date.now());
  const random = new SeededRandom(options.seed || Date.now());
  
  const deepBlue = { r: 80, g: 120, b: 150 };
  const mediumBlue = { r: 100, g: 135, b: 165 };
  const lightBlue = { r: 120, g: 150, b: 180 };
  const foam = { r: 160, g: 180, b: 195 };
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      
      const wave1 = perlin.octaveNoise(x * 0.02, y * 0.02, 4, 0.5);
      const wave2 = perlin.octaveNoise(x * 0.04, y * 0.04, 3, 0.6);
      
      const depth = (wave1 + wave2 + 2) / 4;
      
      let r, g, b;
      if (depth < 0.3) {
        r = deepBlue.r;
        g = deepBlue.g;
        b = deepBlue.b;
      } else if (depth < 0.6) {
        const t = (depth - 0.3) / 0.3;
        r = deepBlue.r + (mediumBlue.r - deepBlue.r) * t;
        g = deepBlue.g + (mediumBlue.g - deepBlue.g) * t;
        b = deepBlue.b + (mediumBlue.b - deepBlue.b) * t;
      } else if (depth < 0.85) {
        const t = (depth - 0.6) / 0.25;
        r = mediumBlue.r + (lightBlue.r - mediumBlue.r) * t;
        g = mediumBlue.g + (lightBlue.g - mediumBlue.g) * t;
        b = mediumBlue.b + (lightBlue.b - mediumBlue.b) * t;
      } else {
        const t = (depth - 0.85) / 0.15;
        r = lightBlue.r + (foam.r - lightBlue.r) * t;
        g = lightBlue.g + (foam.g - lightBlue.g) * t;
        b = lightBlue.b + (foam.b - lightBlue.b) * t;
      }
      
      const shimmer = (random.next() - 0.5) * 10 * options.density;
      
      const waveIntensity = Math.abs(depth - 0.5) * 1.0;
      
      data[idx] = Math.min(255, Math.max(0, Math.floor(r + shimmer)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.floor(g + shimmer)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.floor(b + shimmer)));
      data[idx + 3] = Math.floor(options.opacity * waveIntensity * 255);
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL();
}

/**
 * Shallow Water Texture
 */
function generateWaterShallow(size: number, options: TextureOptions): string {
  const [canvas, ctx] = createCanvas(size);
  applyRotation(ctx, options.angle, size);
  
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;
  
  const perlin = new PerlinNoise(options.seed || Date.now());
  const random = new SeededRandom(options.seed || Date.now());
  
  const lightTurquoise = { r: 140, g: 195, b: 180 };
  const mediumTurquoise = { r: 120, g: 180, b: 170 };
  const deepTurquoise = { r: 100, g: 165, b: 160 };
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      
      const caustic1 = Math.abs(Math.sin(x * 0.1 + perlin.noise(x * 0.02, y * 0.02) * 5));
      const caustic2 = Math.abs(Math.sin(y * 0.1 + perlin.noise(x * 0.03, y * 0.03) * 5));
      const caustics = (caustic1 + caustic2) / 2;
      
      const depth = perlin.octaveNoise(x * 0.01, y * 0.01, 3, 0.5);
      
      let r, g, b;
      if (depth < -0.3) {
        r = deepTurquoise.r;
        g = deepTurquoise.g;
        b = deepTurquoise.b;
      } else if (depth < 0.3) {
        const t = (depth + 0.3) / 0.6;
        r = deepTurquoise.r + (mediumTurquoise.r - deepTurquoise.r) * t;
        g = deepTurquoise.g + (mediumTurquoise.g - deepTurquoise.g) * t;
        b = deepTurquoise.b + (mediumTurquoise.b - deepTurquoise.b) * t;
      } else {
        const t = (depth - 0.3) / 0.7;
        r = mediumTurquoise.r + (lightTurquoise.r - mediumTurquoise.r) * t;
        g = mediumTurquoise.g + (lightTurquoise.g - mediumTurquoise.g) * t;
        b = mediumTurquoise.b + (lightTurquoise.b - mediumTurquoise.b) * t;
      }
      
      r += caustics * 30 * options.density;
      g += caustics * 30 * options.density;
      b += caustics * 20 * options.density;
      
      const noise = (random.next() - 0.5) * 6 * options.density;
      
      const causticIntensity = Math.min(0.6, caustics / 3);
      
      data[idx] = Math.min(255, Math.max(0, Math.floor(r + noise)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.floor(g + noise)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.floor(b + noise)));
      data[idx + 3] = Math.floor(options.opacity * causticIntensity * 255);
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL();
}

/**
 * Pool Water Texture
 */
function generateWaterPool(size: number, options: TextureOptions): string {
  const [canvas, ctx] = createCanvas(size);
  applyRotation(ctx, options.angle, size);
  
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;
  
  const perlin = new PerlinNoise(options.seed || Date.now());
  const random = new SeededRandom(options.seed || Date.now());
  
  const lightBlue = { r: 140, g: 180, b: 205 };
  const mediumBlue = { r: 120, g: 165, b: 190 };
  const deepBlue = { r: 100, g: 150, b: 180 };
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      
      const caustic1 = Math.abs(Math.sin(x * 0.12 + perlin.noise(x * 0.025, y * 0.025) * 6));
      const caustic2 = Math.abs(Math.sin(y * 0.12 + perlin.noise(x * 0.035, y * 0.035) * 6));
      const caustics = Math.pow((caustic1 + caustic2) / 2, 1.5);
      
      const ripple = perlin.octaveNoise(x * 0.015, y * 0.015, 4, 0.5);
      
      let r, g, b;
      if (ripple < -0.2) {
        r = deepBlue.r;
        g = deepBlue.g;
        b = deepBlue.b;
      } else if (ripple < 0.2) {
        const t = (ripple + 0.2) / 0.4;
        r = deepBlue.r + (mediumBlue.r - deepBlue.r) * t;
        g = deepBlue.g + (mediumBlue.g - deepBlue.g) * t;
        b = deepBlue.b + (mediumBlue.b - deepBlue.b) * t;
      } else {
        const t = (ripple - 0.2) / 0.8;
        r = mediumBlue.r + (lightBlue.r - mediumBlue.r) * t;
        g = mediumBlue.g + (lightBlue.g - mediumBlue.g) * t;
        b = mediumBlue.b + (lightBlue.b - mediumBlue.b) * t;
      }
      
      r += caustics * 40 * options.density;
      g += caustics * 35 * options.density;
      b += caustics * 25 * options.density;
      
      const noise = (random.next() - 0.5) * 5 * options.density;
      
      const poolCausticIntensity = Math.min(0.5, caustics / 4);
      
      data[idx] = Math.min(255, Math.max(0, Math.floor(r + noise)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.floor(g + noise)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.floor(b + noise)));
      data[idx + 3] = Math.floor(options.opacity * poolCausticIntensity * 255);
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL();
}

/**
 * Deep Water Texture
 */
function generateWaterDeep(size: number, options: TextureOptions): string {
  const [canvas, ctx] = createCanvas(size);
  applyRotation(ctx, options.angle, size);
  
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;
  
  const perlin = new PerlinNoise(options.seed || Date.now());
  const random = new SeededRandom(options.seed || Date.now());
  
  const veryDeep = { r: 80, g: 100, b: 120 };
  const deep = { r: 90, g: 110, b: 130 };
  const medium = { r: 100, g: 120, b: 140 };
  const surface = { r: 115, g: 135, b: 155 };
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      
      const layer1 = perlin.octaveNoise(x * 0.01, y * 0.01, 4, 0.5);
      const layer2 = perlin.octaveNoise(x * 0.02, y * 0.02, 3, 0.6);
      const layer3 = perlin.octaveNoise(x * 0.03, y * 0.03, 2, 0.7);
      
      const layers = (layer1 + layer2 * 0.5 + layer3 * 0.25) / 1.75;
      
      let r, g, b;
      if (layers < -0.5) {
        r = veryDeep.r;
        g = veryDeep.g;
        b = veryDeep.b;
      } else if (layers < 0) {
        const t = (layers + 0.5) / 0.5;
        r = veryDeep.r + (deep.r - veryDeep.r) * t;
        g = veryDeep.g + (deep.g - veryDeep.g) * t;
        b = veryDeep.b + (deep.b - veryDeep.b) * t;
      } else if (layers < 0.5) {
        const t = layers / 0.5;
        r = deep.r + (medium.r - deep.r) * t;
        g = deep.g + (medium.g - deep.g) * t;
        b = deep.b + (medium.b - deep.b) * t;
      } else {
        const t = (layers - 0.5) / 0.5;
        r = medium.r + (surface.r - medium.r) * t;
        g = medium.g + (surface.g - medium.g) * t;
        b = medium.b + (surface.b - medium.b) * t;
      }
      
      const noise = (random.next() - 0.5) * 4 * options.density;
      
      const deepIntensity = Math.abs(layers - 0.5) * 0.8;
      
      data[idx] = Math.min(255, Math.max(0, Math.floor(r + noise)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.floor(g + noise)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.floor(b + noise)));
      data[idx + 3] = Math.floor(options.opacity * deepIntensity * 255);
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL();
}

/**
 * Dots pattern
 */
function generateDots(size: number, options: TextureOptions): string {
  const [canvas, ctx] = createCanvas(size);
  applyRotation(ctx, options.angle, size);

  const spacing = Math.max(8, Math.floor(24 / options.density)) * options.scale;
  const dotSize = Math.max(1, Math.floor(3 * options.scale));

  ctx.fillStyle = `rgba(0, 0, 0, ${options.opacity})`;

  for (let x = 0; x < size + spacing; x += spacing) {
    for (let y = 0; y < size + spacing; y += spacing) {
      ctx.beginPath();
      ctx.arc(x, y, dotSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return canvas.toDataURL();
}

/**
 * Lines pattern
 */
function generateLines(size: number, options: TextureOptions): string {
  const [canvas, ctx] = createCanvas(size);
  applyRotation(ctx, options.angle, size);

  const spacing = Math.max(4, Math.floor(16 / options.density)) * options.scale;
  const lineWidth = Math.max(1, Math.floor(1.5 * options.scale));

  ctx.strokeStyle = `rgba(0, 0, 0, ${options.opacity})`;
  ctx.lineWidth = lineWidth;

  for (let y = 0; y < size + spacing; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  return canvas.toDataURL();
}

/**
 * Grid pattern
 */
function generateGrid(size: number, options: TextureOptions): string {
  const [canvas, ctx] = createCanvas(size);
  applyRotation(ctx, options.angle, size);

  const spacing = Math.max(8, Math.floor(32 / options.density)) * options.scale;
  const lineWidth = Math.max(1, Math.floor(1 * options.scale));

  ctx.strokeStyle = `rgba(0, 0, 0, ${options.opacity})`;
  ctx.lineWidth = lineWidth;

  // Vertical lines
  for (let x = 0; x < size + spacing; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }

  // Horizontal lines
  for (let y = 0; y < size + spacing; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  return canvas.toDataURL();
}

/**
 * Wood grain pattern
 */
function generateWood(size: number, options: TextureOptions): string {
  const [canvas, ctx] = createCanvas(size);
  applyRotation(ctx, options.angle, size);
  
  const random = new SeededRandom(options.seed || Date.now());
  const grainCount = Math.floor(5 * options.density);

  for (let i = 0; i < grainCount; i++) {
    const y = random.next() * size;
    const amplitude = (5 + random.next() * 10) * options.scale;
    const frequency = 0.02 + random.next() * 0.03;

    ctx.strokeStyle = `rgba(0, 0, 0, ${options.opacity * (0.3 + random.next() * 0.4)})`;
    ctx.lineWidth = Math.max(0.5, random.next() * 2 * options.scale);

    ctx.beginPath();
    for (let x = 0; x < size; x++) {
      const offsetY = y + Math.sin(x * frequency) * amplitude;
      if (x === 0) {
        ctx.moveTo(x, offsetY);
      } else {
        ctx.lineTo(x, offsetY);
      }
    }
    ctx.stroke();
  }

  return canvas.toDataURL();
}

/**
 * Water pattern
 */
function generateWater(size: number, options: TextureOptions): string {
  const [canvas, ctx] = createCanvas(size);
  applyRotation(ctx, options.angle, size);
  
  const random = new SeededRandom(options.seed || Date.now());
  const waveCount = Math.floor(8 * options.density);

  for (let i = 0; i < waveCount; i++) {
    const y = (i / waveCount) * size;
    const amplitude = (3 + random.next() * 8) * options.scale;
    const frequency = 0.03 + random.next() * 0.05;
    const phase = random.next() * Math.PI * 2;

    ctx.strokeStyle = `rgba(100, 150, 200, ${options.opacity * 0.6})`;
    ctx.lineWidth = Math.max(0.5, random.next() * 1.5 * options.scale);

    ctx.beginPath();
    for (let x = 0; x < size; x++) {
      const offsetY = y + Math.sin(x * frequency + phase) * amplitude;
      if (x === 0) {
        ctx.moveTo(x, offsetY);
      } else {
        ctx.lineTo(x, offsetY);
      }
    }
    ctx.stroke();
  }

  return canvas.toDataURL();
}

/**
 * Paper texture pattern
 */
function generatePaper(size: number, options: TextureOptions): string {
  const [canvas, ctx] = createCanvas(size);
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;
  const random = new SeededRandom(options.seed || Date.now());

  for (let i = 0; i < data.length; i += 4) {
    if (random.next() < options.density * 0.3) {
      const value = 200 + Math.floor(random.next() * 55);
      data[i] = value;
      data[i + 1] = value - 10;
      data[i + 2] = value - 20;
      data[i + 3] = Math.floor(options.opacity * 255 * 0.5);
    } else {
      data[i + 3] = 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL();
}

/**
 * Stone texture pattern
 */
function generateStone(size: number, options: TextureOptions): string {
  const [canvas, ctx] = createCanvas(size);
  const random = new SeededRandom(options.seed || Date.now());
  
  const stoneCount = Math.floor(15 * options.density);

  for (let i = 0; i < stoneCount; i++) {
    const x = random.next() * size;
    const y = random.next() * size;
    const radius = (5 + random.next() * 15) * options.scale;

    ctx.fillStyle = `rgba(100, 100, 100, ${options.opacity * (0.2 + random.next() * 0.3)})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas.toDataURL();
}

/**
 * Rusted metal pattern
 */
function generateRust(size: number, options: TextureOptions): string {
  const [canvas, ctx] = createCanvas(size);
  const random = new SeededRandom(options.seed || Date.now());
  
  const rustSpots = Math.floor(30 * options.density);

  for (let i = 0; i < rustSpots; i++) {
    const x = random.next() * size;
    const y = random.next() * size;
    const radius = (2 + random.next() * 8) * options.scale;
    const r = 150 + Math.floor(random.next() * 80);
    const g = 60 + Math.floor(random.next() * 40);
    const b = 20 + Math.floor(random.next() * 20);

    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${options.opacity * (0.3 + random.next() * 0.4)})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas.toDataURL();
}

/**
 * Broken concrete pattern
 */
function generateConcrete(size: number, options: TextureOptions): string {
  const [canvas, ctx] = createCanvas(size);
  const random = new SeededRandom(options.seed || Date.now());
  
  // Cracks
  const crackCount = Math.floor(5 * options.density);
  
  for (let i = 0; i < crackCount; i++) {
    const startX = random.next() * size;
    const startY = random.next() * size;
    const segments = 5 + Math.floor(random.next() * 10);

    ctx.strokeStyle = `rgba(0, 0, 0, ${options.opacity * 0.8})`;
    ctx.lineWidth = Math.max(0.5, random.next() * 2 * options.scale);

    ctx.beginPath();
    ctx.moveTo(startX, startY);

    let x = startX;
    let y = startY;

    for (let j = 0; j < segments; j++) {
      x += (random.next() - 0.5) * 30 * options.scale;
      y += (random.next() - 0.5) * 30 * options.scale;
      ctx.lineTo(x, y);
    }

    ctx.stroke();
  }

  // Texture
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    if (random.next() < options.density * 0.2) {
      const value = 120 + Math.floor(random.next() * 80);
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = Math.floor(options.opacity * 255 * 0.3);
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL();
}

/**
 * Brushed metal pattern
 */
function generateBrushedMetal(size: number, options: TextureOptions): string {
  const [canvas, ctx] = createCanvas(size);
  applyRotation(ctx, options.angle, size);
  
  const random = new SeededRandom(options.seed || Date.now());
  const lineCount = Math.floor(size * options.density);

  for (let i = 0; i < lineCount; i++) {
    const y = random.next() * size;
    const alpha = options.opacity * (0.1 + random.next() * 0.2);

    ctx.strokeStyle = `rgba(200, 200, 200, ${alpha})`;
    ctx.lineWidth = Math.max(0.3, random.next() * options.scale);

    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  return canvas.toDataURL();
}

/**
 * Carbon fiber pattern
 */
function generateCarbonFiber(size: number, options: TextureOptions): string {
  const [canvas, ctx] = createCanvas(size);
  applyRotation(ctx, options.angle, size);
  
  const tileSize = Math.floor(16 * options.scale);
  const cols = Math.ceil(size / tileSize);
  const rows = Math.ceil(size / tileSize);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * tileSize;
      const y = row * tileSize;

      // Alternating weave pattern
      if ((row + col) % 2 === 0) {
        ctx.fillStyle = `rgba(0, 0, 0, ${options.opacity * 0.6})`;
      } else {
        ctx.fillStyle = `rgba(50, 50, 50, ${options.opacity * 0.4})`;
      }

      ctx.fillRect(x, y, tileSize, tileSize);

      // Highlight
      ctx.fillStyle = `rgba(255, 255, 255, ${options.opacity * 0.1})`;
      ctx.fillRect(x, y, tileSize / 2, tileSize / 2);
    }
  }

  return canvas.toDataURL();
}

/**
 * Chain link fence pattern
 */
function generateChainLink(size: number, options: TextureOptions): string {
  const [canvas, ctx] = createCanvas(size);
  applyRotation(ctx, options.angle, size);
  
  const spacing = Math.floor(20 * options.scale);
  const radius = Math.floor(8 * options.scale);

  ctx.strokeStyle = `rgba(150, 150, 150, ${options.opacity})`;
  ctx.lineWidth = Math.max(1, Math.floor(1.5 * options.scale));

  for (let y = -radius; y < size + radius; y += spacing) {
    for (let x = -radius; x < size + radius; x += spacing * 2) {
      // Diamond shape
      ctx.beginPath();
      ctx.moveTo(x, y - radius);
      ctx.lineTo(x + radius, y);
      ctx.lineTo(x, y + radius);
      ctx.lineTo(x - radius, y);
      ctx.closePath();
      ctx.stroke();
    }
  }

  return canvas.toDataURL();
}

/**
 * Diamond plate pattern
 */
function generateDiamondPlate(size: number, options: TextureOptions): string {
  const [canvas, ctx] = createCanvas(size);
  applyRotation(ctx, options.angle, size);
  
  const spacing = Math.floor(24 * options.scale);
  const diamondSize = Math.floor(10 * options.scale);

  for (let y = 0; y < size + spacing; y += spacing) {
    for (let x = 0; x < size + spacing; x += spacing) {
      // Diamond
      ctx.fillStyle = `rgba(0, 0, 0, ${options.opacity * 0.3})`;
      ctx.beginPath();
      ctx.moveTo(x, y - diamondSize);
      ctx.lineTo(x + diamondSize, y);
      ctx.lineTo(x, y + diamondSize);
      ctx.lineTo(x - diamondSize, y);
      ctx.closePath();
      ctx.fill();

      // Highlight
      ctx.strokeStyle = `rgba(255, 255, 255, ${options.opacity * 0.2})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  return canvas.toDataURL();
}

/**
 * Rivets pattern
 */
function generateRivets(size: number, options: TextureOptions): string {
  const [canvas, ctx] = createCanvas(size);
  
  const spacing = Math.floor(32 * options.scale);
  const rivetRadius = Math.floor(4 * options.scale);

  for (let y = spacing / 2; y < size; y += spacing) {
    for (let x = spacing / 2; x < size; x += spacing) {
      // Rivet base
      ctx.fillStyle = `rgba(100, 100, 100, ${options.opacity * 0.5})`;
      ctx.beginPath();
      ctx.arc(x, y, rivetRadius, 0, Math.PI * 2);
      ctx.fill();

      // Rivet highlight
      ctx.fillStyle = `rgba(200, 200, 200, ${options.opacity * 0.3})`;
      ctx.beginPath();
      ctx.arc(x - rivetRadius / 3, y - rivetRadius / 3, rivetRadius / 2, 0, Math.PI * 2);
      ctx.fill();

      // Rivet shadow
      ctx.fillStyle = `rgba(0, 0, 0, ${options.opacity * 0.3})`;
      ctx.beginPath();
      ctx.arc(x + rivetRadius / 3, y + rivetRadius / 3, rivetRadius / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return canvas.toDataURL();
}

/**
 * Corrugated metal pattern
 */
function generateCorrugated(size: number, options: TextureOptions): string {
  const [canvas, ctx] = createCanvas(size);
  applyRotation(ctx, options.angle, size);
  
  const waveWidth = Math.floor(16 * options.scale);
  const waveHeight = Math.floor(8 * options.scale);

  for (let x = 0; x < size; x++) {
    const wave = Math.sin((x / waveWidth) * Math.PI * 2) * waveHeight + size / 2;
    
    for (let y = 0; y < size; y++) {
      const distance = Math.abs(y - wave);
      const alpha = options.opacity * (1 - distance / waveHeight) * 0.4;
      
      if (alpha > 0) {
        ctx.fillStyle = `rgba(150, 150, 150, ${alpha})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  return canvas.toDataURL();
}

/**
 * Cross-hatch pattern
 */
function generateCrossHatch(size: number, options: TextureOptions): string {
  const [canvas, ctx] = createCanvas(size);
  
  const spacing = Math.max(8, Math.floor(16 / options.density)) * options.scale;
  const lineWidth = Math.max(1, Math.floor(1 * options.scale));

  ctx.strokeStyle = `rgba(0, 0, 0, ${options.opacity})`;
  ctx.lineWidth = lineWidth;

  // Diagonal lines (45 degrees)
  for (let offset = -size; offset < size * 2; offset += spacing) {
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset + size, size);
    ctx.stroke();
  }

  // Diagonal lines (-45 degrees)
  for (let offset = -size; offset < size * 2; offset += spacing) {
    ctx.beginPath();
    ctx.moveTo(offset, size);
    ctx.lineTo(offset + size, 0);
    ctx.stroke();
  }

  return canvas.toDataURL();
}

/**
 * Hexagons pattern
 */
function generateHexagons(size: number, options: TextureOptions): string {
  const [canvas, ctx] = createCanvas(size);
  applyRotation(ctx, options.angle, size);
  
  const hexSize = Math.floor(16 * options.scale);
  const hexHeight = hexSize * Math.sqrt(3);

  ctx.strokeStyle = `rgba(0, 0, 0, ${options.opacity})`;
  ctx.lineWidth = Math.max(1, Math.floor(1.5 * options.scale));

  for (let row = -1; row < size / hexHeight + 1; row++) {
    for (let col = -1; col < size / (hexSize * 1.5) + 1; col++) {
      const x = col * hexSize * 1.5;
      const y = row * hexHeight + (col % 2 === 0 ? 0 : hexHeight / 2);

      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const hx = x + hexSize * Math.cos(angle);
        const hy = y + hexSize * Math.sin(angle);
        if (i === 0) {
          ctx.moveTo(hx, hy);
        } else {
          ctx.lineTo(hx, hy);
        }
      }
      ctx.closePath();
      ctx.stroke();
    }
  }

  return canvas.toDataURL();
}

/**
 * Waves pattern
 */
function generateWaves(size: number, options: TextureOptions): string {
  const [canvas, ctx] = createCanvas(size);
  applyRotation(ctx, options.angle, size);
  
  const waveCount = Math.floor(8 * options.density);
  const amplitude = 20 * options.scale;
  const frequency = 0.05;

  for (let i = 0; i < waveCount; i++) {
    const yOffset = (i / waveCount) * size;
    const phase = (i / waveCount) * Math.PI * 2;

    ctx.strokeStyle = `rgba(0, 0, 0, ${options.opacity})`;
    ctx.lineWidth = Math.max(1, Math.floor(1.5 * options.scale));

    ctx.beginPath();
    for (let x = 0; x < size; x++) {
      const y = yOffset + Math.sin(x * frequency + phase) * amplitude;
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }

  return canvas.toDataURL();
}

/**
 * Perlin noise pattern (simplified)
 */
function generatePerlin(size: number, options: TextureOptions): string {
  const [canvas, ctx] = createCanvas(size);
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;
  const random = new SeededRandom(options.seed || Date.now());

  // Generate simple pseudo-Perlin noise
  const scale = 50 * options.scale;
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / scale;
      const ny = y / scale;
      
      // Simple interpolated noise
      const value = (
        Math.sin(nx * 3 + ny * 2) * 0.5 +
        Math.sin(nx * 5 - ny * 3) * 0.3 +
        Math.sin(nx * 7 + ny * 5) * 0.2
      );
      
      const normalized = ((value + 1) / 2) * 255;
      const idx = (y * size + x) * 4;
      
      data[idx] = normalized;
      data[idx + 1] = normalized;
      data[idx + 2] = normalized;
      data[idx + 3] = Math.floor(options.opacity * 255);
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL();
}

/**
 * Generate a texture pattern
 */
export function generateTexture(
  pattern: PatternName,
  options: Partial<TextureOptions> = {}
): string {
  const opts: TextureOptions = { ...DEFAULT_OPTIONS, ...options };
  const cacheKey = getCacheKey(pattern, opts);

  // Check cache
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey)!;
  }

  // Default canvas size (will be repeated via CSS)
  const size = 256;

  let dataURL: string;

  switch (pattern) {
    case 'noise':
      dataURL = generateNoise(size, opts);
      break;
    case 'rusted-metal':
      dataURL = generateRustedMetal(size, opts);
      break;
    case 'wood-oak':
      dataURL = generateWoodOak(size, opts);
      break;
    case 'water-ocean':
      dataURL = generateWaterOcean(size, opts);
      break;
    case 'water-shallow':
      dataURL = generateWaterShallow(size, opts);
      break;
    case 'water-pool':
      dataURL = generateWaterPool(size, opts);
      break;
    case 'water-deep':
      dataURL = generateWaterDeep(size, opts);
      break;
    case 'dots':
      dataURL = generateDots(size, opts);
      break;
    case 'lines':
      dataURL = generateLines(size, opts);
      break;
    case 'grid':
      dataURL = generateGrid(size, opts);
      break;
    case 'wood':
      dataURL = generateWood(size, opts);
      break;
    case 'water':
      dataURL = generateWater(size, opts);
      break;
    case 'paper':
      dataURL = generatePaper(size, opts);
      break;
    case 'stone':
      dataURL = generateStone(size, opts);
      break;
    case 'rust':
      dataURL = generateRust(size, opts);
      break;
    case 'concrete':
      dataURL = generateConcrete(size, opts);
      break;
    case 'brushed-metal':
      dataURL = generateBrushedMetal(size, opts);
      break;
    case 'carbon-fiber':
      dataURL = generateCarbonFiber(size, opts);
      break;
    case 'chain-link':
      dataURL = generateChainLink(size, opts);
      break;
    case 'diamond-plate':
      dataURL = generateDiamondPlate(size, opts);
      break;
    case 'rivets':
      dataURL = generateRivets(size, opts);
      break;
    case 'corrugated':
      dataURL = generateCorrugated(size, opts);
      break;
    case 'cross-hatch':
      dataURL = generateCrossHatch(size, opts);
      break;
    case 'hexagons':
      dataURL = generateHexagons(size, opts);
      break;
    case 'waves':
      dataURL = generateWaves(size, opts);
      break;
    case 'perlin':
      dataURL = generatePerlin(size, opts);
      break;
    case 'random':
      // Random will be handled by the context
      dataURL = generateNoise(size, opts);
      break;
    default:
      dataURL = generateNoise(size, opts);
  }

  // Cache the result
  textureCache.set(cacheKey, dataURL);

  return dataURL;
}

/**
 * Get all available pattern names (excluding 'random')
 */
export function getAllPatterns(): PatternName[] {
  return [
    'noise',
    'rusted-metal',
    'wood-oak',
    'water-ocean',
    'water-shallow',
    'water-pool',
    'water-deep',
  ];
}

/**
 * Get pattern display name
 */
export function getPatternDisplayName(pattern: PatternName): string {
  const names: Record<PatternName, string> = {
    'noise': 'Noise/Grain',
    'dots': 'Dots',
    'lines': 'Lines',
    'grid': 'Grid',
    'wood': 'Wood Grain',
    'water': 'Water',
    'paper': 'Paper',
    'stone': 'Stone',
    'rust': 'Rusted Metal',
    'concrete': 'Broken Concrete',
    'brushed-metal': 'Brushed Metal',
    'carbon-fiber': 'Carbon Fiber',
    'chain-link': 'Chain Link',
    'diamond-plate': 'Diamond Plate',
    'rivets': 'Rivets',
    'corrugated': 'Corrugated Metal',
    'cross-hatch': 'Cross-Hatch',
    'hexagons': 'Hexagons',
    'waves': 'Waves',
    'perlin': 'Perlin Noise',
    'random': 'Random',
  };
  return names[pattern] || pattern;
}

/**
 * Clear the texture cache
 */
export function clearTextureCache(): void {
  textureCache.clear();
}

