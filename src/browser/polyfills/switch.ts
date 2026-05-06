// Polyfills the `Switch` namespace used by nx.js code.
// Covers `Switch.readFile` (via `fetch`) and `Switch.Application` to read from /mock-data folder.

import {
  MOCK_APPS,
  type MockAppDefinition,
  generateIconBytes,
} from "../mock-data/apps";

type LaunchToast = {
  textContent: string;
  style: Record<string, string>;
  remove(): void;
};

type MinimalDom = {
  createElement(tag: string): LaunchToast;
  body: { appendChild(node: LaunchToast): void };
};

function getMinimalDom(): MinimalDom | undefined {
  const doc = (globalThis as Record<string, unknown>)["document"];
  if (!doc || typeof doc !== "object" || doc === null) return undefined;
  if (!("createElement" in doc) || !("body" in doc)) return undefined;
  return doc as MinimalDom;
}

interface MockApplication {
  readonly id: bigint;
  readonly name: string;
  readonly author: string;
  readonly version: string;
  readonly icon: ArrayBuffer;
  readonly nacp: ArrayBuffer;
  launch(): void;
}

class BrowserMockApplication implements MockApplication {
  readonly id: bigint;
  readonly name: string;
  readonly author: string;
  readonly version: string;
  readonly icon: ArrayBuffer;
  readonly nacp: ArrayBuffer = new ArrayBuffer(0);

  constructor(def: MockAppDefinition, icon: ArrayBuffer) {
    this.id = def.id;
    this.name = def.name;
    this.author = def.author;
    this.version = def.version;
    this.icon = icon;
  }

  launch(): void {
    // On Switch this is `never` (the OS replaces the running process).
    // Here we just surface the action visually so devs can verify wiring.
    console.info(`[Switch.Application] launch(): ${this.name} (${this.id.toString(16)})`);
    const dom = getMinimalDom();
    if (!dom) return;
    const flash = dom.createElement("div");
    flash.textContent = `Launching: ${this.name}`;
    Object.assign(flash.style, {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      padding: "16px 24px",
      background: "rgba(0,0,0,0.85)",
      color: "white",
      fontFamily: "ui-monospace, Menlo, monospace",
      fontSize: "14px",
      borderRadius: "8px",
      zIndex: "9999",
      pointerEvents: "none",
    });
    dom.body.appendChild(flash);
    setTimeout(() => flash.remove(), 900);
  }
}

const PATH_PREFIX_MAP: ReadonlyArray<readonly [string, string]> = [
  ["romfs:/", "/"],
  ["sdmc:/", "/sdmc/"],
];

async function readFilePolyfill(path: string): Promise<ArrayBuffer | null> {
  let url = path;
  for (const [prefix, replacement] of PATH_PREFIX_MAP) {
    if (path.startsWith(prefix)) {
      url = replacement + path.slice(prefix.length);
      break;
    }
  }
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch (err) {
    console.warn(`[Switch.readFile] failed to fetch '${url}'`, err);
    return null;
  }
}

export async function installSwitchPolyfill(): Promise<void> {
  // Synthesize icon byte buffers up front so the App's iterator is
  // synchronous (matches nx.js semantics).
  const apps: BrowserMockApplication[] = await Promise.all(
    MOCK_APPS.map(async (def) => {
      const icon = await generateIconBytes(def);
      return new BrowserMockApplication(def, icon);
    })
  );

  // The `Switch.Application` value used by code in this repo is *both* a
  // constructor and an iterable (via `Symbol.iterator`). We mirror that
  // shape by attaching the iterator to the function object itself.
  function Application(_: bigint | string | URL | ArrayBuffer): MockApplication {
    throw new Error(
      "[Switch.Application] constructing arbitrary Application instances is not supported in browser preview"
    );
  }
  (Application as unknown as { [Symbol.iterator]: () => Iterator<MockApplication> })[
    Symbol.iterator
  ] = function* () {
    for (const app of apps) yield app;
  };

  const SwitchPolyfill = {
    readFile: readFilePolyfill,
    Application,
  };

  Object.defineProperty(globalThis, "Switch", {
    value: SwitchPolyfill,
    configurable: true,
    writable: true,
  });
}
