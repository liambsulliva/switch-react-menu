const DEFAULT_WEB_APPLET_URL = "https://google.com";

export function openSwitchWebApplet(url: string = DEFAULT_WEB_APPLET_URL): void {
  void (async () => {
    const applet = new Switch.WebApplet(url);
    await applet.start({ jsExtension: true });
  })();
}
