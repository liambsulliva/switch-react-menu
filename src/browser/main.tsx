// Browser preview entrypoint (main.tsx) works like a standard React DOM app

import { getBrowserDocument, isBrowserCanvas } from "./dom";
import { isEmbedOnlyBuild } from "../lib/rawgTransport";
import { installNxJsPolyfills } from "./polyfills";

function assertEmbedContext(doc: Document): void {
  if (!isEmbedOnlyBuild()) return;
  let embedded = false;
  try {
    embedded = window.self !== window.top;
  } catch {
    embedded = true;
  }
  if (embedded) return;

  doc.body.innerHTML =
    '<p style="margin:0;padding:24px;font:16px/1.5 system-ui,sans-serif;color:#ccc;background:#000;">This demo is embed-only. View it from the project page on liambsullivan.com.</p>';
  throw new Error("switch-menu embed-only: blocked top-level navigation");
}

async function bootstrap(): Promise<void> {
  const doc = getBrowserDocument();
  if (!doc) {
    throw new Error("Expected a browser document (browser preview only)");
  }
  assertEmbedContext(doc as unknown as Document);
  const canvas = doc.getElementById("screen");
  if (!isBrowserCanvas(canvas)) {
    throw new Error("Expected a <canvas id='screen'> element in index.html");
  }

  await installNxJsPolyfills(canvas);

  // Dynamically import everything AFTER the polyfills
  // This makes react-tela comfortable with rendering to the DOM instead of the OG runtime
  const [{ default: React }, { render }, { App }] = await Promise.all([
    import("react"),
    import("react-tela/render"),
    import("../App"),
  ]);

  await loadFonts();

  render(
    React.createElement(App),
    screen as unknown as Parameters<typeof render>[1],
  );
}

// Fetch Source Sans Pro for app
async function loadFonts(): Promise<void> {
  const fontDefs: ReadonlyArray<readonly [string, string]> = [
    ["SourceSansPro-Regular", "romfs:/fonts/SourceSansPro-Regular.otf"],
    ["SourceSansPro-Bold", "romfs:/fonts/SourceSansPro-Bold.otf"],
  ];
  await Promise.all(
    fontDefs.map(async ([family, path]) => {
      const data = await Switch.readFile(path);
      if (!data) {
        console.warn(`[browser] Failed to load font ${family} from ${path}`);
        return;
      }
      const face = new FontFace(family, data);
      await face.load();
      fonts.add(face);
    }),
  );
}

bootstrap().catch((err) => {
  console.error("[browser] bootstrap failed:", err);
});
