/** Un evento operacional de `apps/api` — mismo shape que `opslog.Event` (Go), serializado a JSON. */
export interface AdminEvent {
  timestamp: string;
  level: 'error' | 'warning';
  kind?: string;
  message: string;
  route?: string;
  method?: string;
  statusCode?: number;
  fields?: Record<string, string>;
}

/** Estado de un recurso del host (memoria o disco) en un instante dado — mismo shape que `sysmetrics.ResourceSnapshot` (Go). */
export interface ResourceSnapshot {
  usedBytes: number;
  totalBytes: number;
}

/** Cuerpo de `GET /admin/status` — `memory`/`disk`/`metricsTimestamp` ausentes si todavía no hay ninguna instantánea recolectada. */
export interface AdminStatusResponse {
  events: AdminEvent[];
  memory?: ResourceSnapshot;
  disk?: ResourceSnapshot;
  metricsTimestamp?: string;
}
