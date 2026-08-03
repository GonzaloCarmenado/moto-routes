/**
 * Ata el mecanismo de siembra de rutas para tests: lee `localStorage`, parsea con
 * parseCypressSeed() y, si es válido, puebla un MemoryRouteRepository vía seed() —
 * antes de que <cockpit-view>/<route-list>/<route-detail> reciban el repositorio.
 * Exclusivo de entornos de navegador/desarrollo (nunca en Tauri, AC-010).
 */

import { isTauri } from '../shared/services/photo-capture-adapter.service.js';
import { parseCypressSeed } from './app-seed.transform.js';
import type { MemoryRouteRepository } from '../shared/repositories/memory-route.repository.js';
import type { MemoryProfileRepository } from '../shared/repositories/memory-profile.repository.js';

const CYPRESS_SEED_KEY = 'cypress-seed-routes';

/**
 * Guarda `if (isTauri()) return;` propia y redundante con la de app.element.ts —
 * intencional (defensa en profundidad, mismo criterio que ADR-023 con
 * `PRAGMA foreign_keys`): así AC-010 queda cubierto por un test unitario real
 * sobre esta función pura, sin depender de que exista un app.element.spec.ts.
 *
 * El parámetro `profileRepo` es opcional para no romper las llamadas existentes
 * de un solo argumento (tests previos de `app-seed.service.spec.ts`); en
 * producción `app.element.ts` siempre lo pasa.
 */
export function applyCypressSeed(repo: MemoryRouteRepository, profileRepo?: MemoryProfileRepository): void {
  if (isTauri()) return;

  const seed = parseCypressSeed(localStorage.getItem(CYPRESS_SEED_KEY));
  if (!seed) return;
  // Si no hay rutas ni perfil que sembrar, no hacer nada (mantiene el
  // comportamiento previo de "sin siembra" para el caso común).
  if (seed.routes.length === 0 && !seed.profile) return;

  repo.seed(seed.routes, seed.points, seed.stops);
  if (seed.profile && profileRepo) {
    profileRepo.seed(seed.profile);
  }
}
