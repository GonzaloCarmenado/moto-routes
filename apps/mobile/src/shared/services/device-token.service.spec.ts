import { describe, it, expect, vi, afterEach } from 'vitest';
import { registerDeviceTokenAfterLogin, reregisterDeviceTokenAfterRefresh } from './device-token.service.js';
import * as notificationPlugin from '@tauri-apps/plugin-notification';
import * as commands from '../tauri/commands.js';
import * as notificationsApi from '../http/notifications-api.service.js';
import type { Session } from '../models/session.types.js';

vi.mock('@tauri-apps/plugin-notification', () => ({
  isPermissionGranted: vi.fn(),
  requestPermission: vi.fn(),
}));
vi.mock('../tauri/commands.js', () => ({
  getNotificationToken: vi.fn(),
  getPendingTokenRefresh: vi.fn(),
  clearPendingTokenRefresh: vi.fn(),
}));
vi.mock('../http/notifications-api.service.js', () => ({ registerDeviceToken: vi.fn() }));

const BASE_URL = 'http://localhost:8080';
const session: Session = { token: 'jwt-token', email: 'rider@example.com' };

describe('registerDeviceTokenAfterLogin', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('con permiso ya concedido, registra el token sin volver a pedirlo', async () => {
    vi.mocked(notificationPlugin.isPermissionGranted).mockResolvedValue(true);
    vi.mocked(commands.getNotificationToken).mockResolvedValue('fcm-token-abc');

    await registerDeviceTokenAfterLogin(BASE_URL, session);

    expect(notificationPlugin.requestPermission).not.toHaveBeenCalled();
    expect(notificationsApi.registerDeviceToken).toHaveBeenCalledWith(BASE_URL, 'jwt-token', 'fcm-token-abc', 'android');
  });

  it('sin permiso concedido, lo solicita y registra el token si se concede', async () => {
    vi.mocked(notificationPlugin.isPermissionGranted).mockResolvedValue(false);
    vi.mocked(notificationPlugin.requestPermission).mockResolvedValue('granted');
    vi.mocked(commands.getNotificationToken).mockResolvedValue('fcm-token-abc');

    await registerDeviceTokenAfterLogin(BASE_URL, session);

    expect(notificationPlugin.requestPermission).toHaveBeenCalledOnce();
    expect(notificationsApi.registerDeviceToken).toHaveBeenCalledWith(BASE_URL, 'jwt-token', 'fcm-token-abc', 'android');
  });

  it('si el usuario deniega el permiso, no registra nada ni lanza', async () => {
    vi.mocked(notificationPlugin.isPermissionGranted).mockResolvedValue(false);
    vi.mocked(notificationPlugin.requestPermission).mockResolvedValue('denied');

    await expect(registerDeviceTokenAfterLogin(BASE_URL, session)).resolves.toBeUndefined();

    expect(commands.getNotificationToken).not.toHaveBeenCalled();
    expect(notificationsApi.registerDeviceToken).not.toHaveBeenCalled();
  });

  it('sin token de dispositivo disponible, no registra nada', async () => {
    vi.mocked(notificationPlugin.isPermissionGranted).mockResolvedValue(true);
    vi.mocked(commands.getNotificationToken).mockResolvedValue(null);

    await registerDeviceTokenAfterLogin(BASE_URL, session);

    expect(notificationsApi.registerDeviceToken).not.toHaveBeenCalled();
  });

  it('un fallo de red al registrar el token no lanza (best-effort)', async () => {
    vi.mocked(notificationPlugin.isPermissionGranted).mockResolvedValue(true);
    vi.mocked(commands.getNotificationToken).mockResolvedValue('fcm-token-abc');
    vi.mocked(notificationsApi.registerDeviceToken).mockRejectedValue(new Error('network down'));

    await expect(registerDeviceTokenAfterLogin(BASE_URL, session)).resolves.toBeUndefined();
  });
});

describe('reregisterDeviceTokenAfterRefresh', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('con un token pendiente, lo registra y lo borra de pendientes', async () => {
    vi.mocked(commands.getPendingTokenRefresh).mockResolvedValue('fcm-token-rotated');
    vi.mocked(notificationsApi.registerDeviceToken).mockResolvedValue(undefined);

    await reregisterDeviceTokenAfterRefresh(BASE_URL, session);

    expect(notificationsApi.registerDeviceToken).toHaveBeenCalledWith(BASE_URL, 'jwt-token', 'fcm-token-rotated', 'android');
    expect(commands.clearPendingTokenRefresh).toHaveBeenCalledOnce();
  });

  it('sin token pendiente, no registra nada ni lo borra', async () => {
    vi.mocked(commands.getPendingTokenRefresh).mockResolvedValue(null);

    await reregisterDeviceTokenAfterRefresh(BASE_URL, session);

    expect(notificationsApi.registerDeviceToken).not.toHaveBeenCalled();
    expect(commands.clearPendingTokenRefresh).not.toHaveBeenCalled();
  });

  it('un fallo de red al registrar no lanza y no borra el pendiente (best-effort, se reintenta en el próximo arranque)', async () => {
    vi.mocked(commands.getPendingTokenRefresh).mockResolvedValue('fcm-token-rotated');
    vi.mocked(notificationsApi.registerDeviceToken).mockRejectedValue(new Error('network down'));

    await expect(reregisterDeviceTokenAfterRefresh(BASE_URL, session)).resolves.toBeUndefined();

    expect(commands.clearPendingTokenRefresh).not.toHaveBeenCalled();
  });
});
