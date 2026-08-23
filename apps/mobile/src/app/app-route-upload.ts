/**
 * Maneja el evento `ROUTE_SAVED` (`shared/app-events.ts`): intenta subir
 * automáticamente a la nube una ruta recién grabada y guardada en local, con
 * feedback visible vía `route-upload-snackbar.ts` — extraído de
 * `app.element.ts` (único punto con `IRouteRepository`+`ISessionRepository`
 * a la vez) para poder testearlo de forma aislada, sin sufijo `.element`
 * (excepción de extracción por límite de líneas ya documentada en
 * `CLAUDE.md`). Sin sesión activa no hace nada — mismo criterio que la
 * acción manual "Subir a la nube", que tampoco existe sin sesión. Nunca
 * reintenta solo un fallo (ver design.md, Non-Goals) — el usuario puede
 * reintentar con la acción manual del detalle.
 */
import type { IRouteRepository } from '../shared/models/route.repository.js';
import type { ISessionRepository } from '../shared/models/session.repository.js';
import { uploadRouteToCloud } from '../routes/detail/route-detail-cloud.service.js';
import { showRouteUploadSnackbar } from '../shared/feedback/route-upload-snackbar.js';
import { toErrorMessage } from '../shared/utils/errors.js';

export interface HandleRouteSavedOptions {
  apiBaseUrl: string;
  sessionRepository: ISessionRepository;
  repository: IRouteRepository;
  routeId: string;
}

/** Ver el comentario de cabecera de este fichero para el criterio completo. */
export async function handleRouteSaved(options: HandleRouteSavedOptions): Promise<void> {
  const session = await options.sessionRepository.get();
  if (!session) return;

  const route = await options.repository.getById(options.routeId);
  if (!route) return;

  const snackbar = showRouteUploadSnackbar('Subiendo ruta…');
  try {
    await uploadRouteToCloud(options.apiBaseUrl, session, options.repository, route);
    snackbar.succeed();
  } catch (err) {
    snackbar.fail(toErrorMessage(err, 'No se pudo subir la ruta'));
  }
}
