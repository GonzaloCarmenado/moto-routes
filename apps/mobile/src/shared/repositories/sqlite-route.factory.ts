import type { SqlDb } from './sqlite-route.repository.js';

/**
 * Crea una instancia de SqlDb usando el plugin Tauri SQL.
 * Solo funciona dentro de la WebView de Tauri (Desktop/Android).
 * En entorno navegador lanza un error descriptivo.
 */
export async function createSqliteDb(path?: string): Promise<SqlDb> {
  try {
    const { default: Database } = await import('@tauri-apps/plugin-sql');
    const dbPath = path ?? 'sqlite:moto-routes.db';
    const db = await Database.load(dbPath);
    return {
      execute: (sql: string, params?: unknown[]) => db.execute(sql, params),
      select: (sql: string, params?: unknown[]) => db.select<Record<string, unknown>[]>(sql, params),
    };
  } catch {
    throw new Error(
      'SqliteRouteRepository: Tauri SQL plugin not available. '
      + 'This repository requires Tauri environment (Desktop/Android). '
      + 'Use MemoryRouteRepository for development/testing.',
    );
  }
}