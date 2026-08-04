/// <reference types="vite/client" />

declare module '*.css?inline' {
  const content: string;
  export default content;
}

interface ImportMetaEnv {
  /** URL base de apps/api. Ver apps/mobile/.env.example — el host real de
   * producción nunca vive en un fichero versionado (ver ADR-035). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}