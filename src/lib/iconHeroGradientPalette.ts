/**
 * Use k-means to find the two most prominent colors in a game icon, then render
 */

import { COLORS } from "./colors";

export type Rgb = { r: number; g: number; b: number };

export type IconHeroRgbPair = { a: Rgb; b: Rgb };

const HERO_ICON_KMEANS_SIDE = 32;

const iconHeroRgbByKey = new Map<string, IconHeroRgbPair>();

export function iconHeroRgbCacheKey(appId: bigint, icon: ArrayBuffer): string {
  return `${appId}-${icon.byteLength}`;
}

export function clearIconHeroRgbCache(): void {
  iconHeroRgbByKey.clear();
}

export function hydrateIconHeroRgbPairCache(
  entries: Record<string, IconHeroRgbPair> | undefined,
): void {
  if (!entries) return;
  for (const [k, v] of Object.entries(entries)) {
    if (
      v &&
      typeof v === "object" &&
      typeof v.a?.r === "number" &&
      typeof v.b?.r === "number"
    ) {
      iconHeroRgbByKey.set(k, v);
    }
  }
}

export function serializeIconHeroRgbPairsForApps(
  apps: readonly { id: bigint; icon: ArrayBuffer }[],
): Record<string, IconHeroRgbPair> {
  const out: Record<string, IconHeroRgbPair> = {};
  for (const app of apps) {
    const key = iconHeroRgbCacheKey(app.id, app.icon);
    const hit = iconHeroRgbByKey.get(key);
    if (hit) out[key] = hit;
  }
  return out;
}

export function getCachedIconHeroRgbPair(
  appId: bigint,
  icon: ArrayBuffer | null | undefined,
): IconHeroRgbPair | null {
  if (!icon) return null;
  return iconHeroRgbByKey.get(iconHeroRgbCacheKey(appId, icon)) ?? null;
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

function meanRgb(points: readonly Rgb[]): Rgb {
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

function pickInitialCentroidsFarthestFirst(pixels: readonly Rgb[]): [Rgb, Rgb] {
  if (pixels.length < 2) {
    const one = pixels[0] ?? { r: 48, g: 44, b: 72 };
    return [one, one];
  }
  const seed = pixels[0]!;
  let bestI = 1;
  let bestD = -1;
  for (let i = 1; i < pixels.length; i++) {
    const d = colorDistanceSq(pixels[i]!, seed);
    if (d > bestD) {
      bestD = d;
      bestI = i;
    }
  }
  return [seed, pixels[bestI]!];
}

function contrastingPartner(primary: Rgb): Rgb {
  const lum = 0.2126 * primary.r + 0.7152 * primary.g + 0.0722 * primary.b;
  if (lum > 140) {
    return blendRgb(primary, { r: 22, g: 18, b: 48 }, 0.55);
  }
  return blendRgb(primary, { r: 120, g: 200, b: 255 }, 0.45);
}

/** Lloyd's k-means (k=2) over RGB pixels (assumed opaque). */
export function kMeansTwoColorsFromOpaquePixels(
  pixels: readonly Rgb[],
): IconHeroRgbPair {
  if (pixels.length < 2) {
    const one = pixels[0] ?? { r: 48, g: 44, b: 72 };
    return { a: one, b: contrastingPartner(one) };
  }

  let [c0, c1] = pickInitialCentroidsFarthestFirst(pixels);

  const bucket0: Rgb[] = [];
  const bucket1: Rgb[] = [];

  for (let iter = 0; iter < 16; iter++) {
    bucket0.length = 0;
    bucket1.length = 0;
    for (const p of pixels) {
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

function collectOpaqueRgbGrid32(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Rgb[] {
  const pixels: Rgb[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      pixels.push({
        r: data[i]!,
        g: data[i + 1]!,
        b: data[i + 2]!,
      });
    }
  }
  return pixels;
}

export function twoProminentColorsFromOpaqueImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): IconHeroRgbPair {
  const pixels = collectOpaqueRgbGrid32(data, width, height);
  return kMeansTwoColorsFromOpaquePixels(pixels);
}

async function decodeIconToImageData32x32(
  iconBytes: ArrayBuffer,
): Promise<ImageData | null> {
  try {
    const blob = new Blob([iconBytes]);
    const bmp = await createImageBitmap(blob);
    const S = HERO_ICON_KMEANS_SIDE;
    const canvas = new OffscreenCanvas(S, S);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bmp.close?.();
      return null;
    }
    const sw = bmp.width;
    const sh = bmp.height;
    const scale = Math.max(S / sw, S / sh);
    const dw = Math.round(sw * scale);
    const dh = Math.round(sh * scale);
    const dx = (S - dw) / 2;
    const dy = (S - dh) / 2;
    ctx.drawImage(bmp, dx, dy, dw, dh);
    bmp.close?.();
    return ctx.getImageData(0, 0, S, S);
  } catch {
    return null;
  }
}

async function computeIconHeroRgbPairFromIconBytes(
  iconBytes: ArrayBuffer,
): Promise<IconHeroRgbPair | null> {
  const imageData = await decodeIconToImageData32x32(iconBytes);
  if (!imageData) return null;
  if (
    imageData.width !== HERO_ICON_KMEANS_SIDE ||
    imageData.height !== HERO_ICON_KMEANS_SIDE
  ) {
    return null;
  }
  return twoProminentColorsFromOpaqueImageData(
    imageData.data,
    imageData.width,
    imageData.height,
  );
}

/**
 * Decodes each icon to 32×32, runs k-means on all {@link HERO_ICON_PIXELS} RGB samples,
 * and stores the result in {@link iconHeroRgbByKey}. Skips apps already present.
 */
export async function prewarmIconHeroRgbPairsForInstalledApps(
  apps: readonly { id: bigint; icon: ArrayBuffer }[],
): Promise<void> {
  const n = apps.length;
  for (let i = 0; i < n; i++) {
    const app = apps[i]!;
    const key = iconHeroRgbCacheKey(app.id, app.icon);
    if (iconHeroRgbByKey.has(key)) continue;
    const pair = await computeIconHeroRgbPairFromIconBytes(app.icon);
    if (pair) iconHeroRgbByKey.set(key, pair);
    if (i % 4 === 3 || i === n - 1) {
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
    }
  }
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
