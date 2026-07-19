/**
 * Servicio de almacenamiento de fotos en sistema de archivos (Tauri appDataDir).
 * En navegador/web usa MemoryPhotoRepository.
 * En Android Tauri copia el archivo a appDataDir/photos/ y guarda metadatos en SQLite.
 */

import type { IPhotoRepository } from '../models/photo.repository.js';
import type { CreatePhoto } from '../models/photo.types.js';

const PHOTOS_DIR = 'photos';

/**
 * Detecta si estamos en Tauri.
 */
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Guarda un archivo File en el directorio de fotos de la app.
 * En Tauri (Android), copia a appDataDir/photos/ usando el plugin fs.
 * En navegador, devuelve la ruta como blob URL.
 */
export async function savePhotoFile(file: File): Promise<string> {
  if (isTauri()) {
    return savePhotoFileTauri(file);
  }
  // En navegador, crear blob URL para visualización inmediata
  return URL.createObjectURL(file);
}

/**
 * En Tauri Android: copia el archivo a appDataDir/photos/<uuid>.jpg
 */
async function savePhotoFileTauri(file: File): Promise<string> {
  try {
    const { appDataDir } = await import('@tauri-apps/api/path');
    const { writeFile, exists, mkdir } = await import('@tauri-apps/plugin-fs');

    const appDir = await appDataDir();
    const photosDir = `${appDir}${PHOTOS_DIR}`;

    // Ensure photos directory exists
    const dirExists = await exists(photosDir);
    if (!dirExists) {
      await mkdir(photosDir, { recursive: true });
    }

    // Generate unique filename
    const ext = file.name.split('.').pop() ?? 'jpg';
    const filename = `${crypto.randomUUID()}.${ext}`;
    const filePath = `${photosDir}/${filename}`;

    // Read file as Uint8Array and write to appDataDir
    const buffer = await file.arrayBuffer();
    await writeFile(filePath, new Uint8Array(buffer));

    return filePath;
  } catch (err) {
    console.error('Error saving photo to appDataDir:', err);
    // Fallback: return blob URL (no persistente, solo para esta sesión)
    return URL.createObjectURL(file);
  }
}

/**
 * Obtiene la URL accesible para una foto guardada.
 * En Tauri, convierte la ruta del appDataDir a URL accesible por el WebView usando convertFileSrc.
 * En navegador, devuelve la misma URL (ya es blob:).
 */
export async function getPhotoUrl(filePath: string): Promise<string> {
  if (filePath.startsWith('blob:')) return filePath;
  if (filePath.startsWith('photos/')) return filePath; // placeholder

  // En Tauri, convertir ruta del appDataDir a asset URL
  if (isTauri()) {
    try {
      const { convertFileSrc } = await import('@tauri-apps/api/core');
      return convertFileSrc(filePath);
    } catch {
      // Ignorar
    }
  }

  return filePath;
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