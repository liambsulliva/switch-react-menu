export function canFetchRemoteRichAssets(): boolean {
  try {
    const doc = (globalThis as { document?: { createElement?: unknown } })
      .document;
    return typeof doc?.createElement === "function";
  } catch {
    return false;
  }
}
