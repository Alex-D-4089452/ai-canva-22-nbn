/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Absolute API base (e.g. https://host/api). Empty → "/api" (Vite proxy / same-origin). */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}