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
  opacity: 0.5, // Temporarily increased from 0.15 for visibility testing
  density: 0.7, // Increased from 0.5 for more visible pattern
  angle: 0,
  blendMode: 'overlay', // Changed from 'multiply' for better visibility
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
    'dots',
    'lines',
    'grid',
    'wood',
    'water',
    'paper',
    'stone',
    'rust',
    'concrete',
    'brushed-metal',
    'carbon-fiber',
    'chain-link',
    'diamond-plate',
    'rivets',
    'corrugated',
    'cross-hatch',
    'hexagons',
    'waves',
    'perlin',
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

