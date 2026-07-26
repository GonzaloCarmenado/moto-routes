/**
 * Servicio de almacenamiento de fotos en sistema de archivos (Tauri appDataDir).
 * En navegador/web usa MemoryPhotoRepository.
 * En Android Tauri copia el archivo a appDataDir/photos/ y guarda metadatos en SQLite.
 */

import type { IPhotoRepository } from '../models/photo.repository.js';
import type { CreatePhoto } from '../models/photo.types.js';
import { isTauri } from './photo-capture-adapter.service.js';

const PHOTOS_DIR = 'photos';

/**
 * Convierte un File a base64 data URL para persistencia duradera (localStorage).
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (): void => { resolve(reader.result as string); };
    reader.onerror = (): void => { reject(new Error('Error leyendo el archivo de imagen')); };
    reader.readAsDataURL(file);
  });
}

/**
 * Guarda un archivo File en el directorio de fotos de la app.
 * En Tauri (Android), copia a appDataDir/photos/ usando el plugin fs — devuelve una ruta persistente.
 * En navegador, devuelve un data URL base64 persistente (localStorage no admite blob: entre sesiones).
 */
export async function savePhotoFile(file: File): Promise<string> {
  if (isTauri()) {
    return savePhotoFileTauri(file);
  }
  return fileToBase64(file);
}

/**
 * En Tauri Android: copia el archivo a appDataDir/photos/<uuid>.jpg
 */
async function savePhotoFileTauri(file: File): Promise<string> {
  const { appDataDir, join } = await import('@tauri-apps/api/path');
  const { writeFile, exists, mkdir } = await import('@tauri-apps/plugin-fs');

  const appDir = await appDataDir();
  const photosDir = await join(appDir, PHOTOS_DIR);

  // Ensure photos directory exists
  const dirExists = await exists(photosDir);
  if (!dirExists) {
    await mkdir(photosDir, { recursive: true });
  }

  // Generate unique filename
  const ext = file.name.split('.').pop() ?? 'jpg';
  const filename = `${crypto.randomUUID()}.${ext}`;
  const filePath = await join(photosDir, filename);

  // Read file as Uint8Array and write to appDataDir
  const buffer = await file.arrayBuffer();
  await writeFile(filePath, new Uint8Array(buffer));

  return filePath;
}

function mimeTypeFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  return ext === 'png' ? 'image/png' : 'image/jpeg';
}

/**
 * Obtiene la URL accesible para una foto guardada.
 * En Tauri, lee los bytes del archivo con el plugin fs y construye un blob: URL — evita
 * depender del protocolo asset:// / convertFileSrc, que en Android no sirve el fichero
 * aunque el asset-protocol scope y el CSP estén correctamente configurados.
 * En navegador, devuelve la misma URL (ya es data: o blob:).
 */
export async function getPhotoUrl(filePath: string): Promise<string> {
  if (filePath.startsWith('blob:') || filePath.startsWith('data:')) return filePath;
  if (filePath.startsWith('photos/')) return filePath; // placeholder

  if (isTauri()) {
    try {
      const { readFile } = await import('@tauri-apps/plugin-fs');
      const bytes = await readFile(filePath);
      const blob = new Blob([bytes], { type: mimeTypeFromPath(filePath) });
      return URL.createObjectURL(blob);
    } catch {
      // Fallback silencioso: se devuelve filePath tal cual, ver return de abajo
    }
  }

  return filePath;
}

/**
 * Borra el archivo físico de una foto guardada.
 * En Tauri, usa el plugin fs para borrar de appDataDir/photos/ — el borrado es
 * best-effort (si el archivo ya no existe, no lanza: el objetivo es no dejar
 * basura en disco, no bloquear el borrado de la fila en BBDD por su culpa).
 * En navegador es un no-op: la foto vive como base64 en la propia fila.
 */
export async function deletePhotoFile(filePath: string): Promise<void> {
  if (!isTauri()) return;
  try {
    const { remove } = await import('@tauri-apps/plugin-fs');
    await remove(filePath);
  } catch {
    // Best-effort: el archivo puede no existir ya, o el borrado fallar por otra
    // razón — no debe impedir borrar el registro en BBDD.
  }
}

/**
 * Crea el repositorio adecuado según el entorno:
 * - Tauri: SqlitePhotoRepository
 * - Navegador: MemoryPhotoRepository
 */
export async function createPhotoRepository(): Promise<IPhotoRepository> {
  if (isTauri()) {
    try {
      const { SqlitePhotoRepository } = await import('../repositories/sqlite-photo.repository.js');
      const { createSqlitePhotoDb } = await import('../repositories/sqlite-photo.factory.js');
      const db = await createSqlitePhotoDb();
      return new SqlitePhotoRepository(db);
    } catch {
      // Fallback a memoria si SQLite no está disponible
    }
  }
  const { MemoryPhotoRepository } = await import('../repositories/memory-photo.repository.js');
  return new MemoryPhotoRepository();
}

/**
 * Crea un CreatePhoto a partir de un archivo capturado y la información de la ruta.
 */
export function buildPhotoMetadata(
  filePath: string,
  routeId: string,
  latitude: number | null,
  longitude: number | null,
): CreatePhoto {
  return {
    routeId,
    filePath,
    latitude,
    longitude,
    capturedAt: new Date().toISOString(),
  };
}