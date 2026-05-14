import type { RichGameDetails } from "./richGameDetails";

const SCHEMA = 1;
const LS_META_KEY = "switch-react-menu-rich-cache-meta-v1";
const LS_MATCHES_KEY = "switch-react-menu-rich-cache-matches-v1";
const IDB_NAME = "switch-react-menu-rich";
const IDB_STORE = "kv";
const IDB_CATALOG_KEY = "catalogGamesJson";

export type RichPersistentMeta = {
  schema: number;
  installedSignature: string;
  catalogGeneratedAt: string | null;
};

export type RichPersistentPayload = {
  meta: RichPersistentMeta;
  games: RichGameDetails[];
  matches: Record<string, RichGameDetails | null>;
};

function hasIndexedDB(): boolean {
  return typeof indexedDB !== "undefined" && indexedDB !== null;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
  });
}

async function idbGet(key: string): Promise<string | null> {
  if (!hasIndexedDB()) return null;
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const os = tx.objectStore(IDB_STORE);
      const g = os.get(key);
      g.onsuccess = () => {
        const v = g.result;
        resolve(typeof v === "string" ? v : null);
      };
      g.onerror = () => reject(g.error);
    });
  } catch {
    return null;
  }
}

async function idbSet(key: string, value: string): Promise<void> {
  if (!hasIndexedDB()) throw new Error("no indexedDB");
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(IDB_STORE).put(value, key);
  });
}

async function idbDeleteDatabase(): Promise<void> {
  if (!hasIndexedDB()) return;
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(IDB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

function readLsMeta(): RichPersistentMeta | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_META_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RichPersistentMeta>;
    if (parsed.schema !== SCHEMA) return null;
    if (typeof parsed.installedSignature !== "string") return null;
    return {
      schema: SCHEMA,
      installedSignature: parsed.installedSignature,
      catalogGeneratedAt:
        typeof parsed.catalogGeneratedAt === "string" ||
        parsed.catalogGeneratedAt === null
          ? (parsed.catalogGeneratedAt as string | null)
          : null,
    };
  } catch {
    return null;
  }
}

function writeLsMeta(meta: RichPersistentMeta): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(LS_META_KEY, JSON.stringify(meta));
  } catch {
    /* quota or disabled */
  }
}

function readLsMatches(): Record<string, RichGameDetails | null> | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_MATCHES_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, RichGameDetails | null>;
  } catch {
    return null;
  }
}

function writeLsMatches(matches: Record<string, RichGameDetails | null>): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(LS_MATCHES_KEY, JSON.stringify(matches));
  } catch {
    /* quota */
  }
}

export function clearRichPersistentCache(): void {
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(LS_META_KEY);
      localStorage.removeItem(LS_MATCHES_KEY);
    } catch {
      /* ignore */
    }
  }
  void idbDeleteDatabase();
}

export async function loadRichPersistentPayload(
  currentInstalledSignature: string,
): Promise<RichPersistentPayload | null> {
  const meta = readLsMeta();
  if (!meta || meta.installedSignature !== currentInstalledSignature) {
    return null;
  }

  const catalogJson = await idbGet(IDB_CATALOG_KEY);
  const matches = readLsMatches();

  if (!matches) return null;

  if (catalogJson) {
    try {
      const games = JSON.parse(catalogJson) as RichGameDetails[];
      if (!Array.isArray(games)) return null;
      return { meta, games, matches };
    } catch {
      return null;
    }
  }

  return { meta, games: [], matches };
}

export async function saveRichPersistentPayload(
  payload: RichPersistentPayload,
): Promise<void> {
  writeLsMeta(payload.meta);
  writeLsMatches(payload.matches);
  if (payload.games.length > 0 && hasIndexedDB()) {
    try {
      await idbSet(IDB_CATALOG_KEY, JSON.stringify(payload.games));
    } catch {
      /* catalog too large or IDB failed — matches still saved for fast resume */
    }
  }
}
