/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RAWG_API_KEY?: string;
  readonly VITE_RAWG_PROXY_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
