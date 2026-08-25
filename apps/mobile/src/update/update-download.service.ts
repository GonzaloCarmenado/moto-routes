import { appCacheDir, join } from '@tauri-apps/api/path';
import { fetch } from '@tauri-apps/plugin-http';
import { exists, mkdir, writeFile, remove, rename } from '@tauri-apps/plugin-fs';

const UPDATES_DIR = 'updates';
const TEMP_FILENAME = 'update.apk.part';
const FINAL_FILENAME = 'update.apk';

/** Progreso de una descarga en curso. `total` es `null` cuando la respuesta no trae `content-length`. */
export interface DownloadProgress {
  loaded: number;
  total: number | null;
}

export interface DownloadUpdateOptions {
  downloadUrl: string;
  onProgress?: (progress: DownloadProgress) => void;
}

/** Concatena los trozos leídos del stream en un único buffer, sin copias intermedias de más. */
function concatChunks(chunks: Uint8Array[], totalLength: number): Uint8Array {
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

/**
 * Descarga el APK de `downloadUrl` al directorio de caché de la app
 * (`$APPCACHE/updates/`, ya cubierto por el `FileProvider` existente sin
 * tocar el manifest — ver design.md). Progreso real en streaming (verificado:
 * `@tauri-apps/plugin-http` expone un `ReadableStream` real de verdad, no un
 * único blob). Escribe primero a un fichero temporal y solo lo renombra al
 * final del fichero destino tras completarse con éxito — un intento anterior
 * incompleto se borra antes de empezar, nunca se deja a medias ni se ofrece
 * como válido. Lanza si la descarga falla (HTTP no-ok o red), sin escribir
 * nada en disco.
 */
export async function downloadUpdate(options: DownloadUpdateOptions): Promise<string> {
  const cacheDir = await appCacheDir();
  const updatesDir = await join(cacheDir, UPDATES_DIR);
  if (!(await exists(updatesDir))) await mkdir(updatesDir, { recursive: true });

  const tempPath = await join(updatesDir, TEMP_FILENAME);
  const finalPath = await join(updatesDir, FINAL_FILENAME);

  if (await exists(tempPath)) await remove(tempPath);

  const response = await fetch(options.downloadUrl);
  if (!response.ok || !response.body) {
    throw new Error(`Descarga fallida (HTTP ${String(response.status)})`);
  }

  const contentLength = response.headers.get('content-length');
  const total = contentLength ? Number(contentLength) : null;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    options.onProgress?.({ loaded, total });
  }

  await writeFile(tempPath, concatChunks(chunks, loaded));
  await rename(tempPath, finalPath);
  return finalPath;
}
