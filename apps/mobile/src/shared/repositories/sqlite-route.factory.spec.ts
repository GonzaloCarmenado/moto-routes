import { describe, it, expect, vi, afterEach } from 'vitest';

const loadMock = vi.fn();

vi.mock('@tauri-apps/plugin-sql', () => ({
  default: { load: loadMock },
}));

import { createSqliteDb } from './sqlite-route.factory.js';

describe('createSqliteDb', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('creates the connection and delegates execute/select to the Database instance', async () => {
    const executeMock = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const selectMock = vi.fn().mockResolvedValue([{ id: '1' }]);
    loadMock.mockResolvedValue({ execute: executeMock, select: selectMock });

    const db = await createSqliteDb();

    expect(loadMock).toHaveBeenCalledWith('sqlite:moto-routes.db');
    await db.execute('INSERT INTO routes VALUES (?)', ['x']);
    expect(executeMock).toHaveBeenCalledWith('INSERT INTO routes VALUES (?)', ['x']);
    await db.select('SELECT * FROM routes');
    expect(selectMock).toHaveBeenCalledWith('SELECT * FROM routes', undefined);
  });

  it('uses the given path instead of the default database file when provided', async () => {
    loadMock.mockResolvedValue({ execute: vi.fn(), select: vi.fn() });

    await createSqliteDb('sqlite:custom.db');

    expect(loadMock).toHaveBeenCalledWith('sqlite:custom.db');
  });

  it('throws a descriptive error when the Tauri SQL plugin is not available', async () => {
    loadMock.mockRejectedValue(new Error('plugin not registered'));

    await expect(createSqliteDb()).rejects.toThrow(
      'SqliteRouteRepository: Tauri SQL plugin not available.',
    );
  });
});
