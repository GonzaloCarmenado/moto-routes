import { describe, it, expect, vi, afterEach } from 'vitest';

const loadMock = vi.fn();

vi.mock('@tauri-apps/plugin-sql', () => ({
  default: { load: loadMock },
}));

import { createSqlitePhotoDb } from './sqlite-photo.factory.js';

describe('createSqlitePhotoDb', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('creates the connection and delegates execute/select to the Database instance', async () => {
    const executeMock = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const selectMock = vi.fn().mockResolvedValue([{ id: '1' }]);
    loadMock.mockResolvedValue({ execute: executeMock, select: selectMock });

    const db = await createSqlitePhotoDb();

    expect(loadMock).toHaveBeenCalledWith('sqlite:moto-routes.db');
    await db.execute('INSERT INTO photos VALUES (?)', ['x']);
    expect(executeMock).toHaveBeenCalledWith('INSERT INTO photos VALUES (?)', ['x']);
    await db.select('SELECT * FROM photos');
    expect(selectMock).toHaveBeenCalledWith('SELECT * FROM photos', undefined);
  });

  it('throws a descriptive error when the Tauri SQL plugin is not available', async () => {
    loadMock.mockRejectedValue(new Error('plugin not registered'));

    await expect(createSqlitePhotoDb()).rejects.toThrow(
      'SqlitePhotoRepository: Tauri SQL plugin not available.',
    );
  });
});
