import { describe, it, expect, vi, afterEach } from 'vitest';

const loadMock = vi.fn();

vi.mock('@tauri-apps/plugin-sql', () => ({
  default: { load: loadMock },
}));

import { createSqliteProfileDb } from './sqlite-profile.factory.js';

describe('createSqliteProfileDb', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('creates the connection and delegates execute/select to the Database instance', async () => {
    const executeMock = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const selectMock = vi.fn().mockResolvedValue([{ id: 1 }]);
    loadMock.mockResolvedValue({ execute: executeMock, select: selectMock });

    const db = await createSqliteProfileDb();

    expect(loadMock).toHaveBeenCalledWith('sqlite:moto-routes.db');
    await db.execute('INSERT OR REPLACE INTO profile VALUES (?)', ['x']);
    expect(executeMock).toHaveBeenCalledWith('INSERT OR REPLACE INTO profile VALUES (?)', ['x']);
    await db.select('SELECT * FROM profile');
    expect(selectMock).toHaveBeenCalledWith('SELECT * FROM profile', undefined);
  });

  it('throws a descriptive error when the Tauri SQL plugin is not available', async () => {
    loadMock.mockRejectedValue(new Error('plugin not registered'));

    await expect(createSqliteProfileDb()).rejects.toThrow(
      'SqliteProfileRepository: Tauri SQL plugin not available.',
    );
  });
});
