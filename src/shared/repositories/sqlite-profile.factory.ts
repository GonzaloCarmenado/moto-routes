import type { SqlDb } from './sqlite-photo.repository.js';

/**
 * Crea una instancia de SqlDb usando el plugin Tauri SQL.
 * Reutiliza la misma base de datos de rutas/fotos (moto-routes.db).
 * Solo funciona dentro de la WebView de Tauri (Desktop/Android).
 * En entorno navegador lanza un error descriptivo.
 */
export async function createSqliteProfileDb(): Promise<SqlDb> {
  try {
    const { default: Database } = await import('@tauri-apps/plugin-sql');
    const db = await Database.load('sqlite:moto-routes.db');
    return {
      execute: (sql: string, params?: unknown[]) => db.execute(sql, params),
      select: (sql: string, params?: unknown[]) => db.select<Record<string, unknown>[]>(sql, params),
    };
  } catch {
    throw new Error(
      'SqliteProfileRepository: Tauri SQL plugin not available. '
      + 'This repository requires Tauri environment (Desktop/Android). '
      + 'Use MemoryProfileRepository for development/testing.',
    );
  }
}
