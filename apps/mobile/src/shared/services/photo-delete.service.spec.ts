import { describe, it, expect, vi } from 'vitest';
import type { IPhotoRepository } from '../models/photo.repository.js';
import type { Photo } from '../models/photo.types.js';
import '../feedback/confirm-dialog.element.js';
import { deletePhotoWithConfirmation } from './photo-delete.service.js';

function makePhoto(): Photo {
  return {
    id: 'photo-1',
    routeId: 'route-1',
    filePath: 'photos/photo-1.jpg',
    latitude: null,
    longitude: null,
    capturedAt: '2026-07-20T10:00:00.000Z',
    createdAt: '2026-07-20T10:00:00.000Z',
    remotePhotoId: null,
  };
}

function makeRepo(): IPhotoRepository {
  return {
    add: vi.fn(),
    getByRouteId: vi.fn(),
    getById: vi.fn(),
    delete: vi.fn().mockResolvedValue(undefined),
    countByRouteId: vi.fn(),
    markPhotoSynced: vi.fn().mockResolvedValue(undefined),
  };
}

async function waitDialog(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

describe('deletePhotoWithConfirmation', () => {
  it('deletes the photo row when the user confirms', async () => {
    const repo = makeRepo();
    const resultPromise = deletePhotoWithConfirmation(makePhoto(), repo);
    await waitDialog();

    const dialog = document.body.querySelector('confirm-dialog')!;
    (dialog.shadowRoot!.querySelector('[data-cy="confirm-dialog-action-confirm"]') as HTMLButtonElement).click();

    expect(await resultPromise).toBe('deleted');
    expect(repo.delete).toHaveBeenCalledWith('photo-1');
  });

  it('does not delete the photo row when the user cancels', async () => {
    const repo = makeRepo();
    const resultPromise = deletePhotoWithConfirmation(makePhoto(), repo);
    await waitDialog();

    const dialog = document.body.querySelector('confirm-dialog')!;
    (dialog.shadowRoot!.querySelector('[data-cy="confirm-dialog-action-cancel"]') as HTMLButtonElement).click();

    expect(await resultPromise).toBe('cancelled');
    expect(repo.delete).not.toHaveBeenCalled();
  });
});
