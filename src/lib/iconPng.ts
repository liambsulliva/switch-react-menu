interface RasterIconSpec {
  key: string;
  size: number;
  viewBoxSize: number;
  fill: string;
  paths: string[];
}

const iconUrlCache = new Map<string, Promise<string>>();

async function rasterizeIcon({
  key,
  size,
  viewBoxSize,
  fill,
  paths,
}: RasterIconSpec) {
  const cached = iconUrlCache.get(key);
  if (cached) return cached;

  const next = (async () => {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("2D canvas context unavailable while rasterizing icon");
    }

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = fill;
    const scale = size / viewBoxSize;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    for (const d of paths) {
      ctx.fill(new Path2D(d));
    }

    const blob = await canvas.convertToBlob({ type: "image/png" });
    return URL.createObjectURL(blob);
  })();

  iconUrlCache.set(key, next);
  return next;
}

const PREV_PATHS = [
  "M8.5 5H13l-5 7l5 7H8.5l-5-7z",
  "M15.5 5H20l-5 7l5 7h-4.5l-5-7z",
];

const NEXT_PATHS = [
  "M15.5 5H11l5 7l-5 7h4.5l5-7z",
  "M8.5 5H4l5 7l-5 7h4.5l5-7z",
];

const SETTINGS_COG_PATHS = [
  "m9.25 22l-.4-3.2q-.325-.125-.612-.3t-.563-.375L4.7 19.375l-2.75-4.75l2.575-1.95Q4.5 12.5 4.5 12.338v-.675q0-.163.025-.338L1.95 9.375l2.75-4.75l2.975 1.25q.275-.2.575-.375t.6-.3l.4-3.2h5.5l.4 3.2q.325.125.613.3t.562.375l2.975-1.25l2.75 4.75l-2.575 1.95q.025.175.025.338v.674q0 .163-.05.338l2.575 1.95l-2.75 4.75l-2.95-1.25q-.275.2-.575.375t-.6.3l-.4 3.2zm2.8-6.5q1.45 0 2.475-1.025T15.55 12t-1.025-2.475T12.05 8.5q-1.475 0-2.488 1.025T8.55 12t1.013 2.475T12.05 15.5",
];

const CORNER_PATHS = [
  "m11.2 8.375l3.5-6q2.275.6 4.038 2.2t2.562 3.8zm-2.775 2.5L5 4.875q1.35-1.325 3.138-2.1T12 2q.325 0 .75.038t.775.087zm-6.1 3.625q-.15-.6-.238-1.225T2 12q0-1.775.575-3.35T4.2 5.775L9.25 14.5zm7 7.125q-2.275-.6-4.05-2.2t-2.575-3.8h10.075zM12 22q-.375 0-.763-.05t-.737-.1l5.075-8.725l3.425 6q-1.35 1.325-3.137 2.1T12 22m7.8-3.775L14.75 9.5h6.925q.15.6.238 1.225T22 12q0 1.75-.612 3.35T19.8 18.225",
];

const ALBUM_PATHS = [
  "M20.5 14.136V5.5h-17v8.35l4.7-3.8c.462-.375 1.205-.357 1.65.035l4.477 3.933l2.282-1.94c.462-.394 1.198-.386 1.646.017zM2.992 4h18.016c.537 0 .992.481.992 1.075v13.85c0 .596-.444 1.075-.992 1.075H2.992C2.455 20 2 19.519 2 18.925V5.075C2 4.479 2.444 4 2.992 4",
];

export const getPrevArrowPng = (fill: string) =>
  rasterizeIcon({
    key: `prev-${fill}-96`,
    size: 96,
    viewBoxSize: 24,
    fill,
    paths: PREV_PATHS,
  });

export const getNextArrowPng = (fill: string) =>
  rasterizeIcon({
    key: `next-${fill}-96`,
    size: 96,
    viewBoxSize: 24,
    fill,
    paths: NEXT_PATHS,
  });

export const getSettingsCogPng = (fill: string) =>
  rasterizeIcon({
    key: `settings-${fill}-96`,
    size: 96,
    viewBoxSize: 24,
    fill,
    paths: SETTINGS_COG_PATHS,
  });

export const getCornerIconPng = (fill: string) =>
  rasterizeIcon({
    key: `corner-${fill}-96`,
    size: 96,
    viewBoxSize: 24,
    fill,
    paths: CORNER_PATHS,
  });

export const getAlbumIconPng = (fill: string) =>
  rasterizeIcon({
    key: `album-${fill}-96`,
    size: 96,
    viewBoxSize: 24,
    fill,
    paths: ALBUM_PATHS,
  });
