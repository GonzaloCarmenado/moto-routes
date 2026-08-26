/** Respuesta mínima esperada de `GET /admin/status` — solo se usa para validar la credencial, el cuerpo no se interpreta aquí. */
export interface AdminStatusProbeResponse {
  events: unknown[];
}
