// Mock data for `Switch.Application` in the browser.
// Each entry produces a 256x256 PNG icon at runtime via OffscreenCanvas
// TODO: Use real icons, replace these placeholders with public/mock-icons and `fetch()`

export interface MockAppDefinition {
  id: bigint;
  name: string;
  author: string;
  version: string;
  colors: [string, string];
  glyph: string;
  hasSaveData?: boolean;
}

export const MOCK_APPS: MockAppDefinition[] = [
  {
    id: 0x0100000000010000n,
    name: "Super Mario Odyssey",
    author: "Nintendo",
    version: "1.3.0",
    colors: ["#e60012", "#ffb84d"],
    glyph: "M",
  },
  {
    id: 0x01007ef00011e000n,
    name: "The Legend of Zelda: BOTW",
    author: "Nintendo",
    version: "1.6.0",
    colors: ["#1d3a2a", "#7fc6a4"],
    glyph: "Z",
  },
  {
    id: 0x010003f003a34000n,
    name: "Splatoon 2",
    author: "Nintendo",
    version: "5.5.1",
    colors: ["#3a0f7d", "#f6ff00"],
    glyph: "S",
  },
  {
    id: 0x01006a800016e000n,
    name: "Super Smash Bros. Ultimate",
    author: "Bandai Namco / Sora Ltd.",
    version: "13.0.3",
    colors: ["#b71540", "#ffffff"],
    glyph: "★",
  },
  {
    id: 0x0100ae00096b6000n,
    name: "Animal Crossing: New Horizons",
    author: "Nintendo",
    version: "2.0.6",
    colors: ["#42b87f", "#fff5b1"],
    glyph: "A",
  },
  {
    id: 0x0100abf008968000n,
    name: "Mario Kart 8 Deluxe",
    author: "Nintendo",
    version: "3.0.3",
    colors: ["#0044aa", "#ff3333"],
    glyph: "K",
  },
  {
    id: 0x0100c1f0051b6000n,
    name: "Pokémon Sword",
    author: "Game Freak",
    version: "1.3.2",
    colors: ["#1a73e8", "#9ad9ff"],
    glyph: "P",
  },
  {
    id: 0x0100000011d90000n,
    name: "Hollow Knight",
    author: "Team Cherry",
    version: "1.4.3",
    colors: ["#0a0e2a", "#88aaff"],
    glyph: "H",
    hasSaveData: false,
  },
  {
    id: 0x0100b41013c82000n,
    name: "Celeste",
    author: "Maddy Makes Games",
    version: "1.4.0",
    colors: ["#7e3ff2", "#ff8ee9"],
    glyph: "C",
  },
  {
    id: 0x010028600ebda000n,
    name: "Stardew Valley",
    author: "ConcernedApe",
    version: "1.5.6",
    colors: ["#5b8c2a", "#fff2a8"],
    glyph: "S",
  },
  {
    id: 0x0100abf008968001n,
    name: "Hades",
    author: "Supergiant Games",
    version: "1.0",
    colors: ["#1a0033", "#ff6b00"],
    glyph: "H",
  },
  {
    id: 0x010055d009f78000n,
    name: "Cuphead",
    author: "Studio MDHR",
    version: "1.3.3",
    colors: ["#f5deb3", "#a52a2a"],
    glyph: "C",
    hasSaveData: false,
  },
];

/**
 * Synthesize a PNG icon byte buffer for a mock app. Returned as ArrayBuffer
 * so it matches the shape of `Switch.Application.icon` exactly (which is also
 * an ArrayBuffer of an encoded image, just JPEG instead of PNG).
 */
export async function generateIconBytes(
  def: MockAppDefinition,
  size = 256,
): Promise<ArrayBuffer> {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("OffscreenCanvas 2D context unavailable");

  // @nx.js/runtime's OffscreenCanvasRenderingContext2D omits shadow*; real
  // browsers implement them (same as CanvasRenderingContext2D).
  const draw = ctx as OffscreenCanvasRenderingContext2D & {
    shadowColor: string;
    shadowBlur: number;
  };

  const grad = draw.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, def.colors[0]);
  grad.addColorStop(1, def.colors[1]);
  draw.fillStyle = grad;
  draw.fillRect(0, 0, size, size);

  draw.fillStyle = "rgba(0, 0, 0, 0.25)";
  draw.fillRect(0, size - 36, size, 36);

  draw.fillStyle = "white";
  draw.font = `bold ${Math.floor(size * 0.55)}px -apple-system, "Segoe UI", sans-serif`;
  draw.textAlign = "center";
  draw.textBaseline = "middle";
  draw.shadowColor = "rgba(0,0,0,0.4)";
  draw.shadowBlur = 8;
  draw.fillText(def.glyph, size / 2, size / 2);

  const blob = await canvas.convertToBlob({ type: "image/png" });
  return await blob.arrayBuffer();
}
