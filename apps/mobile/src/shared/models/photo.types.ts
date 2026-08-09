/**
 * Modelos de dominio para fotos de ruta.
 * Entidades puras — sin dependencias de DOM, Tauri, React ni ningún framework.
 * Tipado estricto: propiedades con tipo explícito, readonly en inmutables.
 */

/* ------------------------------------------------------------------ */
/*  Entidad (lectura)                                                  */
/* ------------------------------------------------------------------ */

/** Foto capturada para una ruta (entidad de lectura). */
export interface Photo {
  readonly id: string;
  readonly routeId: string;
  readonly filePath: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly capturedAt: string; // ISO 8601
  readonly createdAt: string; // ISO 8601
  /** Id de esta foto en el backend de fotos, o `null` si nunca se ha subido. */
  readonly remotePhotoId: string | null;
}

/* ------------------------------------------------------------------ */
/*  Tipo de creación (escritura — sin id ni createdAt)                 */
/* ------------------------------------------------------------------ */

/** Datos necesarios para crear una foto (escritura — sin `id` ni `createdAt`). */
export interface CreatePhoto {
  routeId: string;
  filePath: string;
  latitude: number | null;
  longitude: number | null;
  capturedAt: string; // ISO 8601
}