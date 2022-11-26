/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HTTP_ENDPOINT: string;
  readonly VITE_WS_ENDPOINT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
