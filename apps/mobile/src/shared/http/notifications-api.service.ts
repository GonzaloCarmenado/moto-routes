import { fetchJson } from './external-api.service.js';

/** `POST /api/device-tokens` — registra (o reasigna) el token de notificaciones del dispositivo actual. */
export async function registerDeviceToken(apiBaseUrl: string, token: string, deviceToken: string, platform: string): Promise<void> {
  await fetchJson(`${apiBaseUrl}/api/device-tokens`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    checkStatus: true,
    body: { token: deviceToken, platform },
  });
}
