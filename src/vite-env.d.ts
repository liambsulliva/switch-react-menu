/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RAWG_PROXY_BASE?: string;
  readonly VITE_EMBED_ONLY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
