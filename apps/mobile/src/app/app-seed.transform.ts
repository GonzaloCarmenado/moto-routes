/**
 * Parseo puro (sin DOM/localStorage/Cypress) del JSON de siembra de rutas para tests.
 * Envuelve JSON.parse en try/catch y valida con guardas explícitas — nunca `as`
 * sin comprobar sobre un `unknown` recién parseado (ESLint strict: no-unsafe-assignment).
 */

import type { CypressSeedData } from './app-seed.types.js';
import type { RoutePoint, RouteStop } from '../shared/models/route.types.js';
import type { Profile } from '../shared/models/profile.types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Interpreta el contenido de la clave `cypress-seed-routes` de `localStorage`.
 * Devuelve `null` ante cualquier entrada ausente, corrupta o sin la forma mínima
 * esperada (`routes` como array) — nunca lanza una excepción.
 */
export function parseCypressSeed(raw: string | null): CypressSeedData | null {
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.routes)) return null;
  // Si el seed incluye una clave `profile` pero no es un objeto plano, el seed
  // es inválido — no se puede sembrar un perfil a partir de un valor no-objeto
  // (se valida con `'profile' in parsed` para distinguir "no incluido" de
  // "incluido e inválido"; un perfil vacío con todos los campos a null es válido).
  if ('profile' in parsed && !isRecord(parsed.profile)) return null;

  return {
    routes: parsed.routes as CypressSeedData['routes'],
    ...(isRecord(parsed.points) ? { points: parsed.points as Record<string, RoutePoint[]> } : {}),
    ...(isRecord(parsed.stops) ? { stops: parsed.stops as Record<string, RouteStop[]> } : {}),
    ...(isRecord(parsed.profile) ? { profile: parsed.profile as unknown as Profile } : {}),
  };
}
