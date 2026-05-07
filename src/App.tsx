import React from "react";
import { useSettings } from "./settings/settingsStore";
import { CompactHome } from "./navigation/CompactHome";
import { GridHome } from "./navigation/GridHome";

export function App() {
  const settings = useSettings();

  if (settings.compactView) {
    return <CompactHome />;
  }

  return <GridHome />;
}
