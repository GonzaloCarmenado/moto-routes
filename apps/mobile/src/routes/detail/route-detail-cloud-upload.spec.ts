import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildSyncIconButton } from './route-detail-cloud-upload.js';
import type { IRouteRepository } from '../../shared/models/route.repository.js';
import type { Route } from '../../shared/models/route.types.js';
import type { Session } from '../../shared/models/session.types.js';
import type { UploadedRoutePoint } from '../../shared/http/route-cloud-api.service.js';

vi.mock('./route-detail-cloud.service.js', () => ({
  uploadRouteToCloud: vi.fn(),
}));
vi.mock('../../shared/feedback/toast.js', () => ({
  showToast: vi.fn(),
}));

import { uploadRouteToCloud } from './route-detail-cloud.service.js';
import { showToast } from '../../shared/feedback/toast.js';

function flushPromises(): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, 0); });
}

function baseOptions(overrides: { isSynced?: boolean; onUploaded?: (points: UploadedRoutePoint[]) => void } = {}): Parameters<typeof buildSyncIconButton>[0] {
  return {
    apiBaseUrl: 'https://api.test',
    session: {} as Session,
    repository: {} as IRouteRepository,
    route: { id: 'route-1' } as Route,
    isSynced: overrides.isSynced ?? false,
    onUploaded: overrides.onUploaded ?? vi.fn(),
  };
}

describe('buildSyncIconButton', () => {
  beforeEach(() => {
    vi.mocked(uploadRouteToCloud).mockReset();
    vi.mocked(showToast).mockReset();
  });

  it('renders the "upload" icon and label when not synced yet', () => {
    const btn = buildSyncIconButton(baseOptions({ isSynced: false }));
    expect(btn.classList.contains('sync-icon-btn--synced')).toBe(false);
    expect(btn.getAttribute('aria-label')).toBe('Subir a la nube');
  });

  it('renders the "synced" icon and label, still clickable to force a re-upload', () => {
    const btn = buildSyncIconButton(baseOptions({ isSynced: true }));
    expect(btn.classList.contains('sync-icon-btn--synced')).toBe(true);
    expect(btn.getAttribute('aria-label')).toBe('Volver a subir a la nube');
    expect(btn.disabled).toBe(false);
  });

  it('disables the button during the upload and shows a success toast, calling onUploaded with the resulting points', async () => {
    const onUploaded = vi.fn();
    const uploaded: UploadedRoutePoint[] = [{ timestamp: 1000, lat: 40.1001, lng: -3.1001, alt: 600, speed: 10 }];
    let resolveUpload!: (points: UploadedRoutePoint[]) => void;
    vi.mocked(uploadRouteToCloud).mockReturnValue(new Promise<UploadedRoutePoint[]>((resolve) => { resolveUpload = resolve; }));
    const btn = buildSyncIconButton(baseOptions({ onUploaded }));

    btn.click();
    expect(btn.disabled).toBe(true);

    resolveUpload(uploaded);
    await flushPromises();

    expect(btn.disabled).toBe(false);
    expect(showToast).toHaveBeenCalledWith('Ruta subida a la nube', 'success');
    expect(onUploaded).toHaveBeenCalledWith(uploaded);
  });

  it('re-enables the button and shows an error toast when the upload fails, without calling onUploaded', async () => {
    const onUploaded = vi.fn();
    vi.mocked(uploadRouteToCloud).mockRejectedValue(new Error('sin conexión'));
    const btn = buildSyncIconButton(baseOptions({ onUploaded }));

    btn.click();
    await flushPromises();

    expect(btn.disabled).toBe(false);
    expect(showToast).toHaveBeenCalledWith('sin conexión', 'error');
    expect(onUploaded).not.toHaveBeenCalled();
  });
});
