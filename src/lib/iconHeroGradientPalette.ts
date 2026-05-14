/**
 * Use k-means to find the two most prominent colors in a game icon, then render
 */

import { COLORS } from "./colors";

export type Rgb = { r: number; g: number; b: number };

const paletteByIconKey = new Map<string, Promise<{ a: Rgb; b: Rgb } | null>>();

function iconCacheKey(appId: bigint, icon: ArrayBuffer): string {
  return `${appId}-${icon.byteLength}`;
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function colorDistanceSq(a: Rgb, b: Rgb): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

function blendRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: clampByte(a.r + (b.r - a.r) * t),
    g: clampByte(a.g + (b.g - a.g) * t),
    b: clampByte(a.b + (b.b - a.b) * t),
  };
}

/** Eight UVs on a 3×3 ring (no center): corners + edge midpoints. */
const LOGO_SAMPLE_UV: readonly [number, number][] = [
  [0.12, 0.12],
  [0.5, 0.12],
  [0.88, 0.12],
  [0.12, 0.5],
  [0.88, 0.5],
  [0.12, 0.88],
  [0.5, 0.88],
  [0.88, 0.88],
];

function readRgbAtUv(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  u: number,
  v: number,
): Rgb | null {
  const x = Math.min(width - 1, Math.max(0, Math.round(u * (width - 1))));
  const y = Math.min(height - 1, Math.max(0, Math.round(v * (height - 1))));
  const i = (y * width + x) * 4;
  const a = data[i + 3]!;
  if (a < 12) return null;
  return {
    r: data[i]!,
    g: data[i + 1]!,
    b: data[i + 2]!,
  };
}

/**
 * Reads eight RGB samples from decoded icon pixels (transparent pixels skipped
 * at that UV; falls back to nearest ring sample logic via center read).
 */
export function collectEightLogoSamples(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Rgb[] {
  const out: Rgb[] = [];
  const center = readRgbAtUv(data, width, height, 0.5, 0.5);
  for (const [u, v] of LOGO_SAMPLE_UV) {
    let s = readRgbAtUv(data, width, height, u, v);
    if (!s) s = center ?? { r: 40, g: 38, b: 52 };
    out.push(s);
  }
  return out;
}

function meanRgb(points: Rgb[]): Rgb {
  let sr = 0;
  let sg = 0;
  let sb = 0;
  const n = points.length;
  for (const p of points) {
    sr += p.r;
    sg += p.g;
    sb += p.b;
  }
  const d = Math.max(1, n);
  return { r: clampByte(sr / d), g: clampByte(sg / d), b: clampByte(sb / d) };
}

function pickInitialCentroids(samples: Rgb[]): [Rgb, Rgb] {
  let bestI = 0;
  let bestJ = 1;
  let bestD = -1;
  for (let i = 0; i < samples.length; i++) {
    for (let j = i + 1; j < samples.length; j++) {
      const d = colorDistanceSq(samples[i]!, samples[j]!);
      if (d > bestD) {
        bestD = d;
        bestI = i;
        bestJ = j;
      }
    }
  }
  return [samples[bestI]!, samples[bestJ]!];
}

function contrastingPartner(primary: Rgb): Rgb {
  const lum = 0.2126 * primary.r + 0.7152 * primary.g + 0.0722 * primary.b;
  if (lum > 140) {
    return blendRgb(primary, { r: 22, g: 18, b: 48 }, 0.55);
  }
  return blendRgb(primary, { r: 120, g: 200, b: 255 }, 0.45);
}

/**
 * Lloyd's algorithm on eight points → two centroids (quantized RGB).
 */
export function quantizeEightSamplesToTwoColors(samples: Rgb[]): {
  a: Rgb;
  b: Rgb;
} {
  if (samples.length < 2) {
    const one = samples[0] ?? { r: 48, g: 44, b: 72 };
    return { a: one, b: contrastingPartner(one) };
  }

  let [c0, c1] = pickInitialCentroids(samples);

  for (let iter = 0; iter < 12; iter++) {
    const bucket0: Rgb[] = [];
    const bucket1: Rgb[] = [];
    for (const p of samples) {
      const d0 = colorDistanceSq(p, c0);
      const d1 = colorDistanceSq(p, c1);
      if (d0 <= d1) bucket0.push(p);
      else bucket1.push(p);
    }
    if (bucket0.length === 0) {
      c0 = blendRgb(c1, { r: 30, g: 28, b: 60 }, 0.35);
    } else c0 = meanRgb(bucket0);
    if (bucket1.length === 0) {
      c1 = contrastingPartner(c0);
    } else c1 = meanRgb(bucket1);
  }

  if (colorDistanceSq(c0, c1) < 25 * 25) {
    c1 = contrastingPartner(c0);
  }

  return { a: c0, b: c1 };
}

export function twoColorsFromEightSamples(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { a: Rgb; b: Rgb } {
  const samples = collectEightLogoSamples(data, width, height);
  return quantizeEightSamplesToTwoColors(samples);
}

export function twoProminentColorsFromImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { a: Rgb; b: Rgb } {
  return twoColorsFromEightSamples(data, width, height);
}

async function decodeIconToImageData(
  iconBytes: ArrayBuffer,
  maxSide: number,
): Promise<ImageData | null> {
  try {
    const blob = new Blob([iconBytes]);
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bmp.close?.();
      return null;
    }
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    return ctx.getImageData(0, 0, w, h);
  } catch {
    return null;
  }
}

export async function getTwoProminentColorsFromIconBytes(
  iconBytes: ArrayBuffer,
  appId: bigint,
): Promise<{ a: Rgb; b: Rgb } | null> {
  const key = iconCacheKey(appId, iconBytes);
  const hit = paletteByIconKey.get(key);
  if (hit) return hit;

  const computed = (async () => {
    const imageData = await decodeIconToImageData(iconBytes, 96);
    if (!imageData) return null;
    return twoColorsFromEightSamples(
      imageData.data,
      imageData.width,
      imageData.height,
    );
  })();

  paletteByIconKey.set(key, computed);
  return computed;
}

function rgbToCss(c: Rgb): string {
  return `rgb(${c.r},${c.g},${c.b})`;
}

function rgbFromHex(hex: string): Rgb {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function gridHomeBackgroundRgb(): Rgb {
  return rgbFromHex(COLORS.background);
}

// Pulls RGB toward black for hero backdrops.
export function darkenRgb(c: Rgb, towardBlack: number): Rgb {
  const t = Math.max(0, Math.min(1, towardBlack)) * 0.66;
  return blendRgb(c, { r: 0, g: 0, b: 0 }, t);
}

// Four evenly spaced stops from `a` to `b` (t = 0, ⅓, ⅔, 1).
function addFourStopsBetween(g: CanvasGradient, a: Rgb, b: Rgb): void {
  g.addColorStop(0, rgbToCss(a));
  g.addColorStop(1 / 3, rgbToCss(blendRgb(a, b, 1 / 3)));
  g.addColorStop(2 / 3, rgbToCss(blendRgb(a, b, 2 / 3)));
  g.addColorStop(1, rgbToCss(b));
}

export type RenderHeroGradientOptions = {
  width: number;
  height: number;
  a: Rgb;
  b: Rgb;
  /**
   * Top edge blends into this RGB with decreasing alpha (matches shell).
   * @default Grid home {@link COLORS.background}
   */
  fadeIntoBackgroundRgb?: Rgb;
  /** Blend factor toward black applied to both gradient endpoints (0–1). */
  darkenTowardBlack?: number;
  /** Portion of bitmap height used for the top fade (0–1). */
  topFadeHeightRatio?: number;
};

/** Static diagonal gradient: four stops, darkened, soft top fade to shell bg. */
export async function renderHeroGradientObjectUrl(
  options: RenderHeroGradientOptions,
): Promise<string> {
  const {
    width,
    height,
    a,
    b,
    fadeIntoBackgroundRgb = gridHomeBackgroundRgb(),
    darkenTowardBlack = 0.44,
    topFadeHeightRatio = 0.4,
  } = options;
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas unavailable for hero gradient");
  }
  const da = darkenRgb(a, darkenTowardBlack);
  const db = darkenRgb(b, darkenTowardBlack);

  const g = ctx.createLinearGradient(0, 0, w, h);
  addFourStopsBetween(g, da, db);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const fadeH = Math.max(
    32,
    Math.min(
      h,
      Math.floor(h * Math.max(0.08, Math.min(0.55, topFadeHeightRatio))),
    ),
  );
  const { r: fr, g: fg, b: fb } = fadeIntoBackgroundRgb;
  const vg = ctx.createLinearGradient(0, 0, 0, fadeH);
  vg.addColorStop(0, `rgba(${fr},${fg},${fb},1)`);
  vg.addColorStop(1, `rgba(${fr},${fg},${fb},0)`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, fadeH);

  const blob = await canvas.convertToBlob({ type: "image/png" });
  return URL.createObjectURL(blob);
}
