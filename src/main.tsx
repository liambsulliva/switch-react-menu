import React from "react";
import { render } from "react-tela/render";
import { App } from "./App";

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

loadFonts();

render(<App />, screen);
