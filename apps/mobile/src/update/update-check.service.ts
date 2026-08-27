import { getVersion } from '@tauri-apps/api/app';
import { fetch } from '@tauri-apps/plugin-http';
import { isTauri } from '../shared/services/photo-capture-adapter.service.js';
import type { GithubLatestRelease, UpdateCheckResult } from './update-check.types.js';

const RELEASES_API_URL = 'https://api.github.com/repos/crzverde/moto-routes/releases/latest';
const NO_UPDATE: UpdateCheckResult = { hasUpdate: false, latestVersion: null, downloadUrl: null };

/**
 * `true` solo dentro de un WebView Android real ejecutando Tauri — replicado del
 * mismo criterio que `cockpit/gps/cockpit-native-gps.service.ts::isAndroidTauri()`
 * en vez de importarlo (update/ no importa de otro dominio, solo de shared/).
 */
function isAndroidTauri(): boolean {
  return isTauri() && /android/i.test(navigator.userAgent);
}

/**
 * Comprueba si hay una versión más reciente publicada en GitHub Releases que la
 * instalada. Nunca lanza: fuera de Android/Tauri, sin conexión, con un error de la
 * API o sin ningún asset `.apk` en la release, resuelve a "sin actualización".
 */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  if (!isAndroidTauri()) return NO_UPDATE;

  try {
    const [installedVersion, response] = await Promise.all([getVersion(), fetch(RELEASES_API_URL)]);
    if (!response.ok) return NO_UPDATE;

    const release = (await response.json()) as GithubLatestRelease;
    const latestVersion = release.tag_name.replace(/^v/, '');
    if (latestVersion === installedVersion) return NO_UPDATE;

    const asset = release.assets.find((a) => a.name.endsWith('.apk'));
    if (!asset) return NO_UPDATE;

    return { hasUpdate: true, latestVersion, downloadUrl: asset.browser_download_url };
  } catch {
    return NO_UPDATE;
  }
}
