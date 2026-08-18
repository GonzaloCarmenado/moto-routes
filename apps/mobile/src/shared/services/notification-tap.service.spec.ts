import { describe, it, expect, vi, afterEach } from 'vitest';
import { listen } from '@tauri-apps/api/event';
import { listenForNotificationTaps } from './notification-tap.service.js';

vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));

describe('listenForNotificationTaps', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('escucha el evento nativo y llama al callback para route_share_invite', async () => {
    let handler: ((event: { payload: { type: string } }) => void) | undefined;
    vi.mocked(listen).mockImplementation((_event, cb) => {
      handler = cb as typeof handler;
      return Promise.resolve(vi.fn());
    });
    const onRouteShareInvite = vi.fn();

    listenForNotificationTaps(onRouteShareInvite);
    await Promise.resolve();
    await Promise.resolve();

    handler?.({ payload: { type: 'route_share_invite' } });

    expect(onRouteShareInvite).toHaveBeenCalledOnce();
  });

  it('ignora tipos de evento desconocidos', async () => {
    let handler: ((event: { payload: { type: string } }) => void) | undefined;
    vi.mocked(listen).mockImplementation((_event, cb) => {
      handler = cb as typeof handler;
      return Promise.resolve(vi.fn());
    });
    const onRouteShareInvite = vi.fn();

    listenForNotificationTaps(onRouteShareInvite);
    await Promise.resolve();
    await Promise.resolve();

    handler?.({ payload: { type: 'some_future_event' } });

    expect(onRouteShareInvite).not.toHaveBeenCalled();
  });

  it('llamar a la función devuelta deja de escuchar', async () => {
    const unlistenFn = vi.fn();
    vi.mocked(listen).mockResolvedValue(unlistenFn);

    const stop = listenForNotificationTaps(vi.fn());
    await Promise.resolve();
    await Promise.resolve();
    stop();

    expect(unlistenFn).toHaveBeenCalledOnce();
  });

  it('si listen() falla (plataforma sin soporte), no lanza', () => {
    vi.mocked(listen).mockRejectedValue(new Error('not available'));

    expect(() => listenForNotificationTaps(vi.fn())).not.toThrow();
  });
});
