import { describe, it, expect, vi, afterEach } from 'vitest';

const { createSqliteDbMock } = vi.hoisted(() => ({ createSqliteDbMock: vi.fn() }));

vi.mock('./sqlite-route.factory.js', () => ({
  createSqliteDb: createSqliteDbMock,
}));

import { createStopTypesCacheRepository } from './sqlite-stop-types-cache.factory.js';
import { SqliteStopTypesCacheRepository } from './sqlite-stop-types-cache.repository.js';
import { MemoryStopTypesCacheRepository } from './memory-stop-types-cache.repository.js';

describe('createStopTypesCacheRepository', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns a SqliteStopTypesCacheRepository when the Tauri SQL plugin is available', async () => {
    createSqliteDbMock.mockResolvedValue({ execute: vi.fn(), select: vi.fn() });

    const repository = await createStopTypesCacheRepository();

    expect(repository).toBeInstanceOf(SqliteStopTypesCacheRepository);
  });

  it('falls back to MemoryStopTypesCacheRepository when the Tauri SQL plugin is not available', async () => {
    createSqliteDbMock.mockRejectedValue(new Error('plugin not registered'));

    const repository = await createStopTypesCacheRepository();

    expect(repository).toBeInstanceOf(MemoryStopTypesCacheRepository);
  });
});
