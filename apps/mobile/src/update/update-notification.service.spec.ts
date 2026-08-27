import { describe, it, expect, vi, beforeEach } from 'vitest';
import type * as UpdateNotificationModule from './update-notification.service.js';

const isPermissionGrantedMock = vi.fn();
const sendNotificationMock = vi.fn();

vi.mock('@tauri-apps/plugin-notification', () => ({
  isPermissionGranted: isPermissionGrantedMock,
  sendNotification: sendNotificationMock,
}));

async function importService(): Promise<typeof UpdateNotificationModule> {
  return import('./update-notification.service.js');
}

describe('notifyUpdateAvailable', () => {
  beforeEach(() => {
    vi.resetModules();
    isPermissionGrantedMock.mockReset();
    sendNotificationMock.mockReset();
    localStorage.clear();
  });

  it('sends a local notification the first time a version is detected', async () => {
    isPermissionGrantedMock.mockResolvedValue(true);

    const { notifyUpdateAvailable } = await importService();
    await notifyUpdateAvailable('0.1.18');

    expect(sendNotificationMock).toHaveBeenCalledOnce();
    expect(sendNotificationMock.mock.calls[0]?.[0]).toMatchObject({});
  });

  it('does not repeat the notification for the same version already notified', async () => {
    isPermissionGrantedMock.mockResolvedValue(true);

    const { notifyUpdateAvailable } = await importService();
    await notifyUpdateAvailable('0.1.18');
    await notifyUpdateAvailable('0.1.18');

    expect(sendNotificationMock).toHaveBeenCalledOnce();
  });

  it('notifies again for a newer version even if a previous one was already notified', async () => {
    isPermissionGrantedMock.mockResolvedValue(true);

    const { notifyUpdateAvailable } = await importService();
    await notifyUpdateAvailable('0.1.18');
    await notifyUpdateAvailable('0.1.19');

    expect(sendNotificationMock).toHaveBeenCalledTimes(2);
  });

  it('does not send anything when the notification permission is not granted', async () => {
    isPermissionGrantedMock.mockResolvedValue(false);

    const { notifyUpdateAvailable } = await importService();
    await notifyUpdateAvailable('0.1.18');

    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it('never throws, even if the notification plugin fails', async () => {
    isPermissionGrantedMock.mockRejectedValue(new Error('plugin unavailable'));

    const { notifyUpdateAvailable } = await importService();

    await expect(notifyUpdateAvailable('0.1.18')).resolves.toBeUndefined();
  });
});
