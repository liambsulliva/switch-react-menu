import React from "react";
import { render } from "react-tela/render";
import { App } from "./App";

async function loadFonts() {
  const fontData =
    (await Switch.readFile("romfs:/fonts/SourceSansPro.otf")) || "";
  const font = new FontFace("SourceSansPro", fontData);
  fonts.add(font);
}

loadFonts();

render(<App />, screen);
