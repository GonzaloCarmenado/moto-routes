/**
 * Persistencia de la ruta grabada (inicio y fin) hacia el repositorio.
 * Extraído de cockpit.service.ts para mantener ese archivo centrado en el
 * estado de grabación en sí.
 */
import type { CockpitState } from '../cockpit.types.js';
import type { IRouteRepository } from '../../shared/models/route.repository.js';
import type { CreateRoute, CreateRoutePoint, CreateRouteStop } from '../../shared/models/route.types.js';
import { simplifyPolyline } from '../../shared/services/route-polyline.service.js';
import { showToast } from '../../shared/feedback/toast.js';
import { APP_EVENTS, dispatchAppEvent } from '../../shared/app-events.js';

const BACKUP_KEY = 'moto-routes-pending-backup';

function buildCreateRoute(s: CockpitState, name: string): CreateRoute {
  return {
    id: s.routeId,
    duration: s.elapsedTime,
    totalDistance: s.totalDistance,
    avgSpeed: s.avgSpeed,
    status: 'completed',
    visibility: 'private',
    origin: 'local',
    name,
  };
}

/** Fila mínima para la ruta activa, insertada nada más empezar a grabar. */
function buildActiveRoute(s: CockpitState): CreateRoute {
  return {
    id: s.routeId,
    duration: 0,
    totalDistance: 0,
    avgSpeed: 0,
    status: 'active',
    visibility: 'private',
    origin: 'local',
  };
}

function buildCreatePoints(s: CockpitState): CreateRoutePoint[] {
  return s.points.map((p) => ({
    routeId: '', // será asignado por el repositorio
    timestamp: p.timestamp,
    lat: p.lat,
    lng: p.lng,
    alt: p.alt,
    speed: p.speed,
  }));
}

/** Paradas manuales marcadas en vivo (ver cockpit.service.ts addManualStop) — las
 * únicas que se persisten; las detectadas automáticamente nunca llegan aquí. */
function buildStops(s: CockpitState): CreateRouteStop[] {
  return s.manualStops.map((m) => ({
    routeId: s.routeId,
    startTime: m.timestamp,
    endTime: null,
    lat: m.lat,
    lng: m.lng,
    type: 'manual',
    stopCategoryId: m.stopCategoryId,
  }));
}

function persistFallback(data: string): void {
  try {
    localStorage.setItem(BACKUP_KEY, data);
  } catch {
    // localStorage lleno o no disponible — silencioso
  }
}

/**
 * Persiste la ruta como 'completed' y, de forma independiente, el trazado
 * simplificado (AC-019). Deliberadamente NO se encadena vía
 * `save(...).then(() => updatePreviewPolyline(...))`: para MemoryRouteRepository
 * ambas mutaciones ya son síncronas dentro de cada llamada (aunque envueltas en
 * una promesa), así que llamarlas como sentencias secuenciales normales evita el
 * salto de microtarea que introduciría un `.then()` y que los tests existentes
 * (que hacen `await repo.getById(...)` justo después de `confirmSaveRecording()`)
 * no verían reflejado de forma fiable. Para SqliteRouteRepository ambas tocan
 * columnas disjuntas de una fila que ya existe (insertada como 'active' al
 * empezar a grabar), así que el orden relativo no afecta a la corrección.
 * Si `updatePreviewPolyline` falla, no debe impedir el resto del guardado — el
 * backfill perezoso del listado recalculará el trazado más adelante.
 */
export function persistRouteOnStop(repository: IRouteRepository | undefined, state: CockpitState, name: string): void {
  if (!repository) return;
  const route = buildCreateRoute(state, name);
  const points = buildCreatePoints(state);
  const stops = buildStops(state);
  repository.save(route, points, stops).then(() => {
    // Solo tras un guardado local confirmado — nunca desde persistRouteOnStart
    // (fila 'active' sin puntos todavía). app.element.ts escucha esto para
    // intentar la subida automática (ver subida-automatica-rutas, design.md D1);
    // cockpit sigue sin saber nada de auth/nube, solo anuncia el hecho.
    dispatchAppEvent(APP_EVENTS.ROUTE_SAVED, { routeId: state.routeId });
  }).catch(() => {
    // Si falla, guardar backup en localStorage (best-effort, ver persistFallback) y avisar
    // de forma visible — un guardado roto en silencio es justo el incidente real que
    // motivó este aviso (ruta larga sin ningún aviso hasta días después).
    persistFallback(JSON.stringify({ route, points, stops }));
    showToast('No se pudo guardar la ruta grabada. Los datos GPS podrían haberse perdido.', 'error');
  });

  const previewPolyline = simplifyPolyline(state.points);
  repository.updatePreviewPolyline(state.routeId, previewPolyline).catch(() => {
    // No crítico: el backfill perezoso del listado de rutas recalculará el
    // trazado a partir de route_points en la próxima carga.
  });
}

/**
 * Inserta la fila de la ruta en cuanto empieza la grabación (estado 'active', sin
 * puntos todavía). Necesario porque la tabla `photos` tiene FOREIGN KEY (route_id)
 * REFERENCES routes(id): una foto capturada en pleno directo se guarda con el mismo
 * routeId pre-generado (ver CockpitState.routeId), y sin esta fila previa el INSERT
 * de la foto viola la clave foránea. `save()` hace upsert por id, así que el guardado
 * final en persistRouteOnStop() actualiza esta misma fila en vez de duplicarla.
 */
export function persistRouteOnStart(repository: IRouteRepository | undefined, state: CockpitState): void {
  if (!repository) return;
  repository.save(buildActiveRoute(state), [], []).catch(() => {
    // Si falla, no bloqueamos la grabación: persistRouteOnStop() reintentará
    // el guardado completo (INSERT, ya que esta fila nunca llegó a crearse).
  });
}
