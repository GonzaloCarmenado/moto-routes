/**
 * Una categoría del catálogo de tipos de parada (bar/restaurante, mirador,
 * monumento…). Nombrado `StopCategory`, no `StopType`, para no colisionar con
 * `route.types.ts` StopType ('manual' | 'auto', el origen de la detección).
 */
export interface StopCategory {
  id: number;
  key: string;
  label: string;
  icon: string;
}
