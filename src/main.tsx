import React from "react";
import { render } from "react-tela/render";
import { App } from "./App";
import { initializeInstalledIgdbMatches } from "./lib/igdbBundledCatalog";

async function loadFonts() {
  const regularFontData =
    (await Switch.readFile("romfs:/fonts/SourceSansPro-Regular.otf")) || "";
  const regularFont = new FontFace("SourceSansPro-Regular", regularFontData);
  fonts.add(regularFont);

  const boldFontData =
    (await Switch.readFile("romfs:/fonts/SourceSansPro-Bold.otf")) || "";
  const boldFont = new FontFace("SourceSansPro-Bold", boldFontData);
  fonts.add(boldFont);
}

async function bootstrap() {
  const installedApps = Array.from(Switch.Application).filter((app) => app.icon);
  await Promise.all([loadFonts(), initializeInstalledIgdbMatches(installedApps)]);

  render(<App />, screen as unknown as Parameters<typeof render>[1]);
}

void bootstrap();
