import type { SqlDb } from './sqlite-photo.repository.js';
import type { IProfileRepository } from '../models/profile.repository.js';
import type { Profile, CreateProfile } from '../models/profile.types.js';

export type { SqlDb };

/** Perfil vacío por defecto, usado como base del coalescido cuando no se ha guardado nada todavía. */
const EMPTY_PROFILE: Profile = {
  vehicleType: null,
  vehicleMake: null,
  vehicleModel: null,
};

// `avatar_path`/`name` se mantienen en el esquema (nunca `DROP COLUMN`, mismo
// patrón aditivo-only que `ensurePreviewPolylineColumn` en
// sqlite-route.repository.ts) aunque ya no se lean ni escriban — ver
// unificar-perfil-cuenta, ADR-055.
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    avatar_path TEXT,
    name TEXT,
    vehicle_type TEXT,
    vehicle_make TEXT,
    vehicle_model TEXT
  );
`;

interface ProfileRow {
  id: number;
  avatar_path: string | null;
  name: string | null;
  vehicle_type: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
}

function rowToProfile(r: ProfileRow): Profile {
  return {
    vehicleType: (r.vehicle_type as Profile['vehicleType']) ?? null,
    vehicleMake: r.vehicle_make ?? null,
    vehicleModel: r.vehicle_model ?? null,
  };
}

/**
 * Implementación de IProfileRepository usando SQLite via Tauri plugin.
 * La tabla `profile` es de fila única (`id` fijo a `1`, `CHECK (id = 1)`):
 * no hay autenticación ni multi-usuario en el proyecto (ver `perfil-usuario.md`).
 * Recibe SqlDb inyectado para poder mockear en tests.
 */
export class SqliteProfileRepository implements IProfileRepository {
  private initPromise: Promise<void> | null = null;

  constructor(private readonly db: SqlDb) {}

  // Memoiza la propia promesa (no un booleano) — mismo motivo que
  // SqliteRouteRepository.ensureSchema(): llamadas concurrentes deben esperar
  // la misma migración en curso en vez de disparar cada una la suya.
  private ensureSchema(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.runMigrations();
    }
    return this.initPromise;
  }

  private async runMigrations(): Promise<void> {
    // A diferencia de SqliteRouteRepository/SqlitePhotoRepository (ADR-023), esta
    // tabla no tiene ninguna FOREIGN KEY (no depende de routes ni de photos), así
    // que no necesita `PRAGMA foreign_keys = ON;` — omisión intencional, no un olvido.
    const statements = SCHEMA.split(';').filter((s) => s.trim().length > 0);
    for (const stmt of statements) {
      await this.db.execute(stmt);
    }
  }

  async get(): Promise<Profile | null> {
    await this.ensureSchema();
    const rows = await this.db.select('SELECT * FROM profile WHERE id = 1');
    if (rows.length === 0) return null;
    return rowToProfile(rows[0] as unknown as ProfileRow);
  }

  async save(patch: CreateProfile): Promise<Profile> {
    await this.ensureSchema();

    const rows = await this.db.select('SELECT * FROM profile WHERE id = 1');
    const existingRow = (rows[0] as unknown as ProfileRow | undefined) ?? null;
    const existing = existingRow ? rowToProfile(existingRow) : EMPTY_PROFILE;

    // Coalescido por campo: 'campo' in patch distingue "no incluido en el patch"
    // (conserva el valor existente) de "incluido explícitamente" (sobrescribe,
    // incluso a null si así se pasa) — ver JSDoc de IProfileRepository.save().
    const merged: Profile = {
      vehicleType: 'vehicleType' in patch ? (patch.vehicleType ?? null) : existing.vehicleType,
      vehicleMake: 'vehicleMake' in patch ? (patch.vehicleMake ?? null) : existing.vehicleMake,
      vehicleModel: 'vehicleModel' in patch ? (patch.vehicleModel ?? null) : existing.vehicleModel,
    };

    // avatar_path/name se conservan tal cual estaban (columnas muertas, ver
    // ADR-055) — nunca se vuelven a escribir desde aquí.
    // INSERT OR REPLACE (nunca INSERT simple): la fila id=1 ya existe a partir del
    // segundo save(), y un INSERT normal fallaría por violar la PRIMARY KEY.
    await this.db.execute(
      `INSERT OR REPLACE INTO profile (id, avatar_path, name, vehicle_type, vehicle_make, vehicle_model)
       VALUES (1, ?, ?, ?, ?, ?)`,
      [existingRow?.avatar_path ?? null, existingRow?.name ?? null, merged.vehicleType, merged.vehicleMake, merged.vehicleModel],
    );

    return merged;
  }
}
