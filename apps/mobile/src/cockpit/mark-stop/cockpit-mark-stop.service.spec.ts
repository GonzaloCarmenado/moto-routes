import { describe, it, expect, vi, beforeEach } from 'vitest';
import { markStopFlow } from './cockpit-mark-stop.service.js';
import type { CockpitService } from '../cockpit.service.js';
import type { IStopTypesCacheRepository } from '../../shared/models/stop-types-cache.repository.js';
import type { StopCategory } from '../../shared/stop-types/stop-types.types.js';

vi.mock('../stop-type-dialog/cockpit-stop-type-dialog.element.js', () => ({
  openStopTypeDialog: vi.fn(),
}));
vi.mock('../../shared/feedback/toast.js', () => ({
  showToast: vi.fn(),
}));

import { openStopTypeDialog } from '../stop-type-dialog/cockpit-stop-type-dialog.element.js';
import { showToast } from '../../shared/feedback/toast.js';

const CATEGORIES: StopCategory[] = [
  { id: 1, key: 'gas_station', label: 'Gasolinera', icon: 'fuel' },
  { id: 2, key: 'viewpoint', label: 'Mirador', icon: 'viewpoint' },
];

function createService(): CockpitService {
  return { addManualStop: vi.fn() } as unknown as CockpitService;
}

function createCache(categories: StopCategory[] = CATEGORIES): IStopTypesCacheRepository {
  return { getAll: vi.fn().mockResolvedValue(categories) } as unknown as IStopTypesCacheRepository;
}

describe('markStopFlow', () => {
  beforeEach(() => {
    vi.mocked(openStopTypeDialog).mockReset();
    vi.mocked(showToast).mockReset();
  });

  it('registers the manual stop and shows a success toast when the user chooses a category', async () => {
    vi.mocked(openStopTypeDialog).mockResolvedValue(CATEGORIES[1]!);
    const service = createService();
    const cache = createCache();

    await markStopFlow(service, cache);

    expect(cache.getAll).toHaveBeenCalledOnce();
    expect(openStopTypeDialog).toHaveBeenCalledWith(CATEGORIES);
    expect(service.addManualStop).toHaveBeenCalledWith(2);
    expect(showToast).toHaveBeenCalledWith('Parada marcada: Mirador', 'success');
  });

  it('does nothing when the user closes the dialog without choosing a category', async () => {
    vi.mocked(openStopTypeDialog).mockResolvedValue(null);
    const service = createService();
    const cache = createCache();

    await markStopFlow(service, cache);

    expect(service.addManualStop).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it('opens the dialog with the cached catalog, even when it is empty (offline with no cache yet)', async () => {
    vi.mocked(openStopTypeDialog).mockResolvedValue(null);
    const service = createService();
    const cache = createCache([]);

    await markStopFlow(service, cache);

    expect(openStopTypeDialog).toHaveBeenCalledWith([]);
    expect(service.addManualStop).not.toHaveBeenCalled();
  });
});
