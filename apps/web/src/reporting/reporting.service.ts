import { authorizedFetch } from '../shared/http/authorized-fetch.js';
import type { AdminStatusResponse } from './reporting.types.js';

/** `GET /admin/status` — eventos operacionales recientes e instantánea de memoria/disco del host. */
export async function getAdminStatus(): Promise<AdminStatusResponse> {
  return authorizedFetch<AdminStatusResponse>('/admin/status');
}
