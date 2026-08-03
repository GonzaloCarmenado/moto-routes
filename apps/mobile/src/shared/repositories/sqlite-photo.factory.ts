import type { SqlDb } from './sqlite-photo.repository.js';

/**
 * Crea una instancia de SqlDb usando el plugin Tauri SQL.
 * Reutiliza la misma base de datos de rutas (moto-routes.db).
 * Solo funciona dentro de la WebView de Tauri (Desktop/Android).
 * En entorno navegador lanza un error descriptivo.
 */
export async function createSqlitePhotoDb(): Promise<SqlDb> {
  try {
    const { default: Database } = await import('@tauri-apps/plugin-sql');
    const db = await Database.load('sqlite:moto-routes.db');
    return {
      execute: (sql: string, params?: unknown[]) => db.execute(sql, params),
      select: (sql: string, params?: unknown[]) => db.select<Record<string, unknown>[]>(sql, params),
    };
  } catch {
    throw new Error(
      'SqlitePhotoRepository: Tauri SQL plugin not available. '
      + 'This repository requires Tauri environment (Desktop/Android). '
      + 'Use MemoryPhotoRepository for development/testing.',
    );
  }
}