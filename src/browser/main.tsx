// Browser preview entrypoint (main.tsx) works like a standard React DOM app

import { getBrowserDocument, isBrowserCanvas } from "./dom";
import { installNxJsPolyfills } from "./polyfills";

async function bootstrap(): Promise<void> {
  const doc = getBrowserDocument();
  if (!doc) {
    throw new Error("Expected a browser document (browser preview only)");
  }
  const canvas = doc.getElementById("screen");
  if (!isBrowserCanvas(canvas)) {
    throw new Error("Expected a <canvas id='screen'> element in index.html");
  }

  await installNxJsPolyfills(canvas);

  // Dynamically import everything AFTER the polyfills
  // This makes react-tela comfortable with rendering to the DOM instead of the OG runtime
  const [
    { default: React },
    { render },
    { App },
    { initializeInstalledIgdbMatches },
  ] = await Promise.all([
    import("react"),
    import("react-tela/render"),
    import("../App"),
    import("../lib/igdbBundledCatalog"),
  ]);

  const installedApps = Array.from(Switch.Application).filter((app) => app.icon);
  await Promise.all([loadFonts(), initializeInstalledIgdbMatches(installedApps)]);

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
