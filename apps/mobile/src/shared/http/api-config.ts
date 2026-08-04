/** URL base de apps/api usada cuando VITE_API_BASE_URL no está definida (desarrollo local). */
const DEFAULT_API_BASE_URL = 'http://localhost:8080';

/**
 * URL base de `apps/api` para esta build. En desarrollo local usa el valor
 * por defecto; el host real de producción se inyecta vía `VITE_API_BASE_URL`
 * en `apps/mobile/.env.local` (nunca versionado — ver ADR-035).
 */
export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;
}
