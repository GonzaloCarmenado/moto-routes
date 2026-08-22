/**
 * @packageDocumentation
 * Descarga y cachea el avatar de la cuenta autenticada como fichero local
 * (mismo mecanismo que `photo-storage.service.ts`), sin ninguna tabla SQLite
 * propia — solo la ruta del fichero en memoria mientras dura la sesión de la
 * app (ver design.md de unificar-perfil-cuenta, Decisión 3 / ADR-055). Se
 * vuelve a descargar en cada `refresh()` (arranque en frío, login
 * interactivo): un fallo (red, 404) nunca lanza, solo deja de mostrar avatar
 * hasta la próxima descarga con éxito — nunca bloquea el resto de Perfil.
 */
import { fetchAccountAvatar } from '../shared/http/avatar-api.service.js';
import { isTauri } from '../shared/services/photo-capture-adapter.service.js';

/** Directorio y fichero local fijo (siempre el mismo, sustituido en cada descarga con éxito) — sin UUID, a diferencia de las fotos de ruta.
 * Vive bajo `photos/` para reutilizar el scope de capacidades ya concedido a ese directorio (`fs:allow-write-file` en `capabilities/default.json`)
 * en vez de abrir un scope nuevo solo para este fichero — `$APPDATA` a secas no está permitido. */
const ACCOUNT_AVATAR_CACHE_DIR = 'photos';
const ACCOUNT_AVATAR_CACHE_FILENAME = 'account-avatar.bin';

/** Escribe los bytes del avatar en `appDataDir/photos` (Tauri) y devuelve una `blob:` URL a partir del mismo `Blob` ya descargado, sin releer el fichero. */
async function cacheAvatarTauri(blob: Blob): Promise<string> {
  const { appDataDir, join } = await import('@tauri-apps/api/path');
  const { writeFile, exists, mkdir } = await import('@tauri-apps/plugin-fs');
  const photosDir = await join(await appDataDir(), ACCOUNT_AVATAR_CACHE_DIR);
  if (!(await exists(photosDir))) {
    await mkdir(photosDir, { recursive: true });
  }
  const path = await join(photosDir, ACCOUNT_AVATAR_CACHE_FILENAME);
  const buffer = await blob.arrayBuffer();
  await writeFile(path, new Uint8Array(buffer));
  return URL.createObjectURL(blob);
}

/**
 * Descarga y cachea el avatar de la cuenta autenticada. Devuelve `null` si
 * la cuenta no tiene avatar configurado (404) o si la descarga falla por
 * cualquier otro motivo (red, timeout, error del servidor) — nunca lanza.
 * @param apiBaseUrl - URL base de `apps/api`.
 * @param token - Token de sesión de la cuenta autenticada.
 */
export async function resolveAccountAvatarUrl(apiBaseUrl: string, token: string): Promise<string | null> {
  try {
    const blob = await fetchAccountAvatar(apiBaseUrl, token);
    return isTauri() ? await cacheAvatarTauri(blob) : URL.createObjectURL(blob);
  } catch {
    return null;
  }
}
